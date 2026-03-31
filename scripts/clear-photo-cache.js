#!/usr/bin/env node

/**
 * 清除特定照片的 COS 缓存
 * 用于解决添加新图片后索引越界导致的错误缓存
 * 
 * 使用方法：
 * node scripts/clear-photo-cache.js [photoId]
 * 
 * 例如：
 * node scripts/clear-photo-cache.js abc123def456
 * 
 * 如果不提供 photoId，会清除所有照片缓存
 */

const fs = require('fs')
const path = require('path')

const photoId = process.argv[2]

console.log('🧹 清除照片缓存...\n')

// COS 缓存文件路径
const cacheFilePaths = [
  path.join(process.cwd(), 'public', 'cos-cache.json'),
  '/tmp/cos-cache.json'
]

cacheFilePaths.forEach(cachePath => {
  if (!fs.existsSync(cachePath)) {
    console.log(`ℹ️  ${cachePath} 不存在，跳过\n`)
    return
  }

  try {
    const cacheData = JSON.parse(fs.readFileSync(cachePath, 'utf-8'))
    const totalEntries = Object.keys(cacheData).length
    
    const filteredCache = {}
    let removedCount = 0
    
    Object.entries(cacheData).forEach(([key, value]) => {
      // 如果指定了 photoId，只清除该照片的缓存
      if (photoId) {
        if (key.startsWith(`photo:${photoId}`)) {
          console.log(`🗑️  清除: ${key}`)
          removedCount++
        } else {
          filteredCache[key] = value
        }
      } 
      // 否则清除所有照片缓存
      else {
        if (key.startsWith('photo:')) {
          console.log(`🗑️  清除: ${key}`)
          removedCount++
        } else {
          filteredCache[key] = value
        }
      }
    })
    
    fs.writeFileSync(cachePath, JSON.stringify(filteredCache, null, 2))
    console.log(`\n✅ ${cachePath}`)
    console.log(`   总条目: ${totalEntries}`)
    console.log(`   已清除: ${removedCount}`)
    console.log(`   保留: ${Object.keys(filteredCache).length}\n`)
  } catch (error) {
    console.warn(`⚠️  清除 ${cachePath} 失败:`, error.message)
  }
})

// 提示清除客户端缓存
console.log('📱 别忘了清除浏览器缓存：')
if (photoId) {
  console.log(`   在浏览器 Console 中运行：`)
  console.log(`   localStorage.removeItem("mypage-image-cache")`)
  console.log(`   location.reload()`)
} else {
  console.log('   按 Ctrl+Shift+R (Windows) 或 Cmd+Shift+R (Mac) 强制刷新')
}
console.log('\n✨ 缓存清理完成！')

