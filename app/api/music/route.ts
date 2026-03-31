import { NextResponse } from 'next/server'
import { getMusic } from '@/content/music'

/**
 * 音乐列表 API
 * 已从 Notion API 迁移到本地静态文件
 */
export async function GET() {
  try {
    const music = getMusic()

    const response = NextResponse.json(music)

    // 静态内容可以设置更长的缓存时间
    response.headers.set(
      'Cache-Control',
      'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800'
    )

    response.headers.set('ETag', `"music-static-${music?.length || 0}"`)

    return response
  } catch (error) {
    console.error('Failed to fetch music:', error)
    return NextResponse.json(
      { error: 'Failed to fetch music' },
      { status: 500 }
    )
  }
}
