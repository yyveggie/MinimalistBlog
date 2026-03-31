#!/usr/bin/env node

/**
 * 🧹 彻底清除所有缓存的脚本
 */

const fs = require('fs')
const path = require('path')

console.log('🧹 开始彻底清除所有缓存...')

// 1. 删除本地COS缓存文件
const cacheFiles = [
  path.join(__dirname, '../public/cos-cache.json'),
  '/tmp/cos-cache.json' // Vercel环境
]

cacheFiles.forEach(filePath => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath)
      console.log(`✅ 已删除: ${filePath}`)
    } else {
      console.log(`ℹ️ 文件不存在: ${filePath}`)
    }
  } catch (error) {
    console.log(`⚠️ 删除失败: ${filePath} - ${error.message}`)
  }
})

// 2. 删除Next.js缓存
const nextCacheDir = path.join(__dirname, '../.next')
if (fs.existsSync(nextCacheDir)) {
  try {
    fs.rmSync(nextCacheDir, { recursive: true, force: true })
    console.log('✅ 已删除Next.js缓存目录')
  } catch (error) {
    console.log(`⚠️ 删除Next.js缓存失败: ${error.message}`)
  }
} else {
  console.log('ℹ️ Next.js缓存目录不存在')
}

// 3. 删除node_modules缓存
const nodeModulesCacheDir = path.join(__dirname, '../node_modules/.cache')
if (fs.existsSync(nodeModulesCacheDir)) {
  try {
    fs.rmSync(nodeModulesCacheDir, { recursive: true, force: true })
    console.log('✅ 已删除node_modules缓存目录')
  } catch (error) {
    console.log(`⚠️ 删除node_modules缓存失败: ${error.message}`)
  }
} else {
  console.log('ℹ️ node_modules缓存目录不存在')
}

console.log(`
🎉 缓存清除完成！

📋 请手动执行以下步骤：

1. 🌐 浏览器缓存清除：
   - Chrome: Ctrl+Shift+Delete (Win) / Cmd+Shift+Delete (Mac)
   - 选择"全部时间"和所有缓存选项

2. 🔧 开发者工具设置：
   - F12 → Network → 勾选 "Disable cache"
   - 强制刷新: Ctrl+Shift+R (Win) / Cmd+Shift+R (Mac)

3. 📱 本地存储清除：
   - F12 → Application → Local Storage
   - 删除所有 "photo-data-" 和 "mypage-image-cache" 条目

4. 🚀 重新启动开发服务器：
   - npm run dev

完成这些步骤后，所有图片应该重新加载并显示正确！
`)
