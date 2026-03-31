#!/usr/bin/env node

/**
 * 🚀 随记文章图片预加载脚本
 * 
 * 功能：
 * - 批量获取所有已发布的随记文章
 * - 提取文章中的所有Notion图片
 * - 预先下载并上传到COS
 * - 避免用户首次访问时加载超时
 * 
 * 使用场景：
 * - 发布新文章后手动运行
 * - 部署后自动运行（postbuild脚本）
 * - 定时任务（cron）
 */

require('dotenv').config({ path: '.env.local' })

const https = require('https')
const http = require('http')

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'

/**
 * HTTP(S) 请求辅助函数
 */
function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http
    
    protocol.get(url, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            resolve(JSON.parse(data))
          } catch (e) {
            resolve(data)
          }
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`))
        }
      })
    }).on('error', reject)
  })
}

/**
 * 获取所有随记文章
 */
async function fetchReflections() {
  console.log(`📡 获取随记文章列表...`)
  const reflections = await fetchUrl(`${SITE_URL}/api/reflections`)
  console.log(`✅ 找到 ${reflections.length} 篇文章`)
  return reflections
}

/**
 * 获取单篇文章详情
 */
async function fetchReflectionDetail(id) {
  console.log(`  📄 获取文章详情: ${id}`)
  try {
    const detail = await fetchUrl(`${SITE_URL}/api/reflections/${id}`)
    return detail
  } catch (error) {
    console.error(`  ❌ 获取失败: ${error.message}`)
    return null
  }
}

/**
 * 从Notion内容块中提取图片URL
 */
function extractImageUrls(blocks) {
  const imageUrls = []
  
  if (!blocks || !Array.isArray(blocks)) {
    return imageUrls
  }
  
  blocks.forEach(block => {
    if (block.type === 'image') {
      const url = block.image?.type === 'external' 
        ? block.image.external?.url 
        : block.image?.file?.url
      
      if (url) {
        imageUrls.push(url)
      }
    }
  })
  
  return imageUrls
}

/**
 * 预加载单张图片
 */
async function preloadImage(imageUrl, articleId, imageIndex) {
  // 生成图片ID（与NotionContent.tsx保持一致）
  const stableUrl = imageUrl.split('?')[0]
  const urlHash = Buffer.from(stableUrl).toString('base64')
    .replace(/[^a-zA-Z0-9]/g, '')
    .substring(0, 16)
  
  const articlePrefix = articleId.replace(/-/g, '').substring(0, 8)
  const imageId = `${articlePrefix}-${urlHash}-${imageIndex}`
  
  const encodedOriginal = encodeURIComponent(imageUrl)
  const proxyUrl = `${SITE_URL}/api/images/notion/reflection-inline/${imageId}?original=${encodedOriginal}`
  
  console.log(`    🖼️  图片 ${imageIndex + 1}: ${imageId}`)
  
  try {
    // 发起HTTP请求，触发图片下载和上传到COS
    await new Promise((resolve, reject) => {
      const protocol = proxyUrl.startsWith('https') ? https : http
      const timeout = setTimeout(() => reject(new Error('Timeout')), 60000) // 60秒超时
      
      protocol.get(proxyUrl, (res) => {
        clearTimeout(timeout)
        
        // 读取响应但不保存（只是触发处理）
        res.on('data', () => {})
        res.on('end', () => {
          if (res.statusCode === 200 || res.statusCode === 302) {
            console.log(`    ✅ 预加载成功`)
            resolve()
          } else {
            console.warn(`    ⚠️  HTTP ${res.statusCode}`)
            resolve() // 不阻塞其他图片
          }
        })
      }).on('error', (err) => {
        clearTimeout(timeout)
        console.error(`    ❌ 预加载失败: ${err.message}`)
        resolve() // 不阻塞其他图片
      })
    })
  } catch (error) {
    console.error(`    ❌ 预加载异常: ${error.message}`)
  }
}

/**
 * 预加载单篇文章的所有图片
 */
async function preloadReflectionImages(reflection) {
  console.log(`\n📖 处理文章: ${reflection.title}`)
  
  const detail = await fetchReflectionDetail(reflection.id)
  if (!detail || !detail.content) {
    console.log(`  ⚠️  跳过（无内容）`)
    return { success: 0, failed: 0, skipped: 1 }
  }
  
  const imageUrls = extractImageUrls(detail.content)
  
  if (imageUrls.length === 0) {
    console.log(`  ℹ️  无图片`)
    return { success: 0, failed: 0, skipped: 1 }
  }
  
  console.log(`  🎨 找到 ${imageUrls.length} 张图片`)
  
  let success = 0
  let failed = 0
  
  // 串行处理，避免并发过多
  for (let i = 0; i < imageUrls.length; i++) {
    try {
      await preloadImage(imageUrls[i], reflection.id, i)
      success++
    } catch (error) {
      console.error(`    ❌ 图片 ${i + 1} 预加载失败:`, error.message)
      failed++
    }
    
    // 每张图片之间稍作延迟，避免压力过大
    if (i < imageUrls.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000))
    }
  }
  
  return { success, failed, skipped: 0 }
}

/**
 * 主函数
 */
async function main() {
  console.log('🚀 开始预加载随记文章图片...\n')
  console.log(`📍 目标站点: ${SITE_URL}\n`)
  
  const startTime = Date.now()
  
  try {
    // 1. 获取所有文章
    const reflections = await fetchReflections()
    
    if (reflections.length === 0) {
      console.log('ℹ️  没有文章需要处理')
      return
    }
    
    // 2. 逐篇处理
    let totalSuccess = 0
    let totalFailed = 0
    let totalSkipped = 0
    
    for (const reflection of reflections) {
      const result = await preloadReflectionImages(reflection)
      totalSuccess += result.success
      totalFailed += result.failed
      totalSkipped += result.skipped
      
      // 文章之间稍作延迟
      await new Promise(resolve => setTimeout(resolve, 2000))
    }
    
    // 3. 总结
    const duration = ((Date.now() - startTime) / 1000).toFixed(2)
    
    console.log('\n' + '='.repeat(50))
    console.log('📊 预加载完成')
    console.log('='.repeat(50))
    console.log(`📝 处理文章: ${reflections.length} 篇`)
    console.log(`✅ 成功图片: ${totalSuccess} 张`)
    console.log(`❌ 失败图片: ${totalFailed} 张`)
    console.log(`⏭️  跳过文章: ${totalSkipped} 篇`)
    console.log(`⏱️  总耗时: ${duration} 秒`)
    console.log('='.repeat(50))
    
  } catch (error) {
    console.error('\n❌ 预加载失败:', error)
    process.exit(1)
  }
}

// 运行
if (require.main === module) {
  main().catch(error => {
    console.error('Fatal error:', error)
    process.exit(1)
  })
}

