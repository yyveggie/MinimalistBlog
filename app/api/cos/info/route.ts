import { NextResponse } from 'next/server'
import { COSImageManager } from '@/lib/cos'

// 🔧 强制动态渲染，避免构建时超时
export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

/**
 * 🔍 COS信息查询API
 * GET /api/cos/info - 获取COS存储桶状态和统计信息
 */
export async function GET() {
  try {
    const bucketInfo = await COSImageManager.getBucketInfo()
    
    if (!bucketInfo) {
      return NextResponse.json({
        success: false,
        error: 'Failed to fetch COS bucket info'
      }, { status: 500 })
    }

    return NextResponse.json({
      success: true,
      data: {
        bucket: bucketInfo.bucketName,
        region: bucketInfo.region,
        imageCount: bucketInfo.imageCount,
        images: bucketInfo.images.slice(0, 20), // 只返回前20个图片信息
        totalImages: bucketInfo.imageCount,
        cosUrl: `https://${bucketInfo.bucketName}.cos.${bucketInfo.region}.myqcloud.com`,
        status: 'connected',
        lastUpdated: new Date().toISOString()
      }
    })
    
  } catch (error) {
    console.error('❌ COS信息查询失败:', error)
    
    return NextResponse.json({
      success: false,
      error: 'COS connection failed',
      message: error instanceof Error ? error.message : 'Unknown error',
      status: 'disconnected'
    }, { status: 500 })
  }
}
