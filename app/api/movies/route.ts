import { NextResponse } from 'next/server'
import { getMovies } from '@/content/movies'

/**
 * 电影列表 API
 * 已从 Notion API 迁移到本地静态文件
 */
export async function GET() {
  try {
    const movies = getMovies()

    const response = NextResponse.json(movies)

    // 静态内容可以设置更长的缓存时间
    response.headers.set(
      'Cache-Control',
      'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800'
    )

    response.headers.set('ETag', `"movies-static-${movies?.length || 0}"`)

    return response
  } catch (error) {
    console.error('Failed to fetch movies:', error)
    return NextResponse.json(
      { error: 'Failed to fetch movies' },
      { status: 500 }
    )
  }
}
