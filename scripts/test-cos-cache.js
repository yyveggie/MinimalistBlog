#!/usr/bin/env node

/**
 * 🧪 测试腾讯云COS缓存功能
 */

const { COSImageManager } = require('../lib/cos.ts')

async function testCache() {
  console.log('🧪 开始测试COS缓存功能...\n')
  
  try {
    // 测试缓存统计
    console.log('📊 缓存统计信息:')
    const stats = COSImageManager.getCacheStats()
    console.log(JSON.stringify(stats, null, 2))
    
    console.log('\n📊 COS存储桶信息:')
    const bucketInfo = await COSImageManager.getBucketInfo()
    if (bucketInfo) {
      console.log(`存储桶: ${bucketInfo.bucketName}`)
      console.log(`地域: ${bucketInfo.region}`)
      console.log(`图片数量: ${bucketInfo.imageCount}`)
      console.log(`缓存统计: ${bucketInfo.cache.totalCached} 个条目`)
      console.log(`缓存大小: ${bucketInfo.cache.cacheSizeFormatted}`)
      console.log(`缓存按类型分布:`, bucketInfo.cache.byType)
    } else {
      console.log('❌ 无法获取存储桶信息')
    }
    
  } catch (error) {
    console.error('❌ 测试失败:', error.message)
  }
}

// 运行测试
testCache()
