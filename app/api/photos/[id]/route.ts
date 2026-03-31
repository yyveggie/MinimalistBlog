import { NextRequest, NextResponse } from 'next/server'
import { getPhotoById } from '@/content/photos'

/**
 * 照片详情 API
 * 已从 Notion API 迁移到本地静态文件
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const photo = getPhotoById(id)

    if (!photo) {
      return NextResponse.json(
        { error: 'Photo not found' },
        { status: 404 }
      )
    }

    const response = NextResponse.json(photo)

    // 静态内容可以设置更长的缓存时间
    response.headers.set(
      'Cache-Control',
      'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800'
    )

    response.headers.set('ETag', `"photo-static-${id}"`)

    return response
  } catch (err) {
    console.error('Failed to fetch photo:', err)
    return NextResponse.json(
      { error: 'Failed to fetch photo' },
      { status: 500 }
    )
  }
}
