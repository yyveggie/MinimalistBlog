#!/usr/bin/env node

/**
 * 🗂️ 缓存管理工具
 * 统一管理文本缓存和图片缓存
 */

const fetch = require('node-fetch')

// 获取API基础URL
function getApiBaseUrl() {
  // 优先使用环境变量
  if (process.env.NEXT_PUBLIC_SITE_URL) {
    return process.env.NEXT_PUBLIC_SITE_URL
  }
  
  // 检查命令行参数 --url
  const urlArg = process.argv.find(arg => arg.startsWith('--url='))
  if (urlArg) {
    return urlArg.split('=')[1]
  }
  
  // 默认开发环境
  console.warn('⚠️  未设置 NEXT_PUBLIC_SITE_URL，使用开发环境 localhost:3000')
  console.warn('⚠️  生产环境请使用: --url=https://overflowing.live')
  return 'http://localhost:3000'
}

const baseUrl = getApiBaseUrl()

// 认证信息
const AUTH_PASSWORD = process.env.ADMIN_PASSWORD || 'mypage2024'

/**
 * 调用API
 */
async function callApi(endpoint, options = {}) {
  const url = `${baseUrl}${endpoint}`
  console.log(`🌐 ${options.description || '调用API'}`)
  console.log(`🔗 URL: ${url}`)

  try {
    const response = await fetch(url, {
      method: options.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...options.headers
      },
      body: options.body ? JSON.stringify(options.body) : undefined
    })

    if (response.redirected) {
      console.log(`✅ 响应: Redirecting...`)
      console.log(`➡️ 重定向到: ${response.url}`)
      return
    }

    const text = await response.text()
    try {
      const json = JSON.parse(text)
      console.log('✅ 响应:', JSON.stringify(json, null, 2))
    } catch {
      console.log('✅ 响应:', text)
    }
  } catch (error) {
    console.error('❌ API调用失败:', error.message)
  }
}

const command = process.argv[2]
const subCommand = process.argv[3]

switch (command) {
  case 'stats':
    callApi(`/api/cache/stats?pwd=${AUTH_PASSWORD}`, {
      description: '📊 获取缓存统计信息'
    })
    break

  case 'clear':
    if (subCommand === 'text') {
      callApi(`/api/cache/clear?pwd=${AUTH_PASSWORD}`, {
        method: 'POST',
        body: { type: 'text' },
        description: '🗑️ 清除文本缓存'
      })
    } else if (subCommand === 'images') {
      callApi(`/api/cache/clear?pwd=${AUTH_PASSWORD}`, {
        method: 'POST',
        body: { type: 'images' },
        description: '🗑️ 清除图片缓存'
      })
    } else {
      callApi(`/api/cache/clear?pwd=${AUTH_PASSWORD}`, {
        method: 'DELETE',
        description: '🗑️ 清除所有缓存'
      })
    }
    break

  case 'warmup':
    callApi(`/api/cache/warmup?pwd=${AUTH_PASSWORD}`, {
      method: 'POST',
      description: '🚀 预热所有缓存'
    })
    break

  case undefined:
  case 'help':
    console.log(`
🗂️ 缓存管理工具 - 使用说明

环境配置：
  当前API地址: ${baseUrl}
  认证密码: ${AUTH_PASSWORD}
  
  配置自定义域名：
  export NEXT_PUBLIC_SITE_URL=https://yourdomain.com
  export ADMIN_PASSWORD=your_password

可用命令：

📊 统计信息：
  npm run cache:stats              # 获取综合缓存统计

🗑️ 清理缓存：
  npm run cache:clear              # 清除所有缓存
  npm run cache:clear:text         # 仅清除文本缓存
  npm run cache:clear:images       # 仅清除图片缓存

🚀 预热缓存：
  npm run cache:warmup             # 预热所有缓存

🖼️ COS相关：
  npm run cos:info                 # COS存储桶信息
  npm run cos:cache                # COS缓存测试

缓存策略说明：
┌─────────────────┬─────────────────┬─────────────────┐
│   缓存类型      │     存储位置     │     管理方式     │
├─────────────────┼─────────────────┼─────────────────┤
│ 文本内容        │ 服务端内存       │ TTL自动过期     │
│ 图片URL(服务端) │ 本地JSON文件     │ 版本检测更新    │
│ 图片URL(客户端) │ localStorage     │ 24小时过期      │
└─────────────────┴─────────────────┴─────────────────┘

示例：
  # 本地开发
  npm run cache:stats
  
  # 生产环境
  NEXT_PUBLIC_SITE_URL=https://yourdomain.com npm run cache:stats
`)
    break

  default:
    console.error(`❌ 未知命令: ${command}`)
    console.log('运行 npm run cache:help 查看帮助')
    process.exit(1)
}
