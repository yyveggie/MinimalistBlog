#!/usr/bin/env node

/**
 * 清除图片缓存脚本
 * 用于解决缓存键冲突导致的图片错误问题
 */

const fs = require('fs')
const path = require('path')

console.log('🧹 清除图片缓存...\n')

// 1. 清除服务端 COS 缓存文件
const cacheFilePaths = [
  path.join(process.cwd(), 'public', 'cos-cache.json'),
  '/tmp/cos-cache.json'
]

cacheFilePaths.forEach(cachePath => {
  if (fs.existsSync(cachePath)) {
    try {
      // 读取现有缓存
      const cacheData = JSON.parse(fs.readFileSync(cachePath, 'utf-8'))
      const totalEntries = Object.keys(cacheData).length
      
      // 只清除 reflection-inline 类型的缓存（有问题的缓存）
      const filteredCache = {}
      let removedCount = 0
      
      Object.entries(cacheData).forEach(([key, value]) => {
        if (key.startsWith('reflection-inline:')) {
          removedCount++
        } else {
          filteredCache[key] = value
        }
      })
      
      // 写回过滤后的缓存
      fs.writeFileSync(cachePath, JSON.stringify(filteredCache, null, 2))
      console.log(`✅ ${cachePath}`)
      console.log(`   总条目: ${totalEntries}`)
      console.log(`   已清除: ${removedCount}`)
      console.log(`   保留: ${Object.keys(filteredCache).length}\n`)
    } catch (error) {
      console.warn(`⚠️  清除 ${cachePath} 失败:`, error.message)
    }
  } else {
    console.log(`ℹ️  ${cachePath} 不存在，跳过\n`)
  }
})

// 2. 提示清除客户端缓存
console.log('📱 客户端缓存清除方法：')
console.log('   1. 打开浏览器开发者工具 (F12)')
console.log('   2. 进入 Console 标签')
console.log('   3. 运行以下命令：')
console.log('\n   localStorage.removeItem("mypage-image-cache")\n')
console.log('   或者刷新页面时按 Ctrl+Shift+R (Windows) 或 Cmd+Shift+R (Mac)\n')

console.log('✨ 缓存清理完成！')
console.log('💡 建议：重启开发服务器使更改生效')

