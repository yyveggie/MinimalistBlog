import { NextResponse } from 'next/server'
import { getCacheStats, getCacheHealth } from '@/lib/serverCache'
import { COSImageManager } from '@/lib/cos'
import { isAuthenticated, createUnauthorizedResponse } from '@/lib/auth'

// 🔧 强制动态渲染
export const dynamic = 'force-dynamic'

export async function GET(request: Request) {
  // 🔐 认证检查
  if (!isAuthenticated(request)) {
    return createUnauthorizedResponse()
  }

  try {
    // 获取内存缓存统计（文本内容）
    const memoryStats = getCacheStats()
    const memoryHealth = getCacheHealth()
    
    // 获取COS图片缓存统计
    const cosStats = COSImageManager.getCacheStats()
    const cosInfo = await COSImageManager.getBucketInfo()
    
    const response = NextResponse.json({
      environment: process.env.VERCEL ? 'production' : 'development',
      
      // 内存缓存（文本内容 - 所有环境）
      textCache: {
        stats: memoryStats,
        health: memoryHealth,
        description: '存储文本内容：文章、音乐列表、电影列表等'
      },
      
      // 图片缓存（COS系统）
      imageCache: {
        stats: cosStats,
        cosInfo: cosInfo ? {
          bucket: cosInfo.bucketName,
          region: cosInfo.region,
          totalImages: cosInfo.imageCount,
          cache: cosInfo.cache
        } : null,
        description: 'COS永久图片缓存 + 本地URL缓存'
      },
      
      // 综合状态
      overall: {
        status: memoryHealth.status === 'healthy' && cosInfo ? 'healthy' : 'degraded',
        textCacheStatus: memoryHealth.status,
        imageCacheStatus: cosInfo ? 'connected' : 'disconnected',
        recommendations: getRecommendations(memoryHealth, cosStats)
      },
      
      timestamp: new Date().toISOString()
    })
    
    // 不缓存统计数据
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    
    return response
  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to get cache stats',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * 获取优化建议
 */
function getRecommendations(memoryHealth: any, cosStats: any): string[] {
  const recommendations: string[] = []
  
  if (memoryHealth.hitRate < 70) {
    recommendations.push('文本缓存命中率较低，考虑增加TTL或预热缓存')
  }
  
  if (memoryHealth.status === 'warning') {
    recommendations.push('内存缓存使用率偏高，考虑清理或扩容')
  }
  
  if (cosStats.totalCached === 0) {
    recommendations.push('图片缓存为空，建议预热图片缓存')
  }
  
  if (cosStats.totalCached > 0 && cosStats.totalCached < 10) {
    recommendations.push('图片缓存较少，可能需要预热更多图片')
  }
  
  return recommendations
}
