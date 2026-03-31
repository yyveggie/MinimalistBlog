import { NextRequest, NextResponse } from 'next/server'
import { getMusicById } from '@/content/music'

/**
 * 音乐详情 API
 * 已从 Notion API 迁移到本地静态文件
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const music = getMusicById(id)

    if (!music) {
      return NextResponse.json(
        { error: 'Music not found' },
        { status: 404 }
      )
    }

    // 将 htmlContent 转换为 content 数组格式（兼容前端）
    const response = NextResponse.json({
      ...music,
      content: [{ type: 'prerendered_html', html: music.htmlContent }]
    })

    // 静态内容可以设置更长的缓存时间
    response.headers.set(
      'Cache-Control',
      'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800'
    )

    response.headers.set('ETag', `"music-static-${id}"`)

    return response
  } catch (err) {
    console.error('Failed to fetch music:', err)
    return NextResponse.json(
      { error: 'Failed to fetch music' },
      { status: 500 }
    )
  }
}
