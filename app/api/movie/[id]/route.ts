import { NextRequest, NextResponse } from 'next/server'
import { getMovieById } from '@/lib/notion'
import { serverCache, SERVER_CACHE_TTL } from '@/lib/serverCache'

// 🔧 强制动态渲染
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    
    // 🚀 使用服务端缓存获取电影详情 - 提升性能
    const movie = await serverCache.get(
      `movie:detail:${id}`,
      () => getMovieById(id),
      SERVER_CACHE_TTL.VERY_LONG // 电影详情很少更新，使用长缓存
    )
    
    if (!movie) {
      return NextResponse.json(
        { error: 'Movie not found' },
        { status: 404 }
      )
    }

    // 只返回已发布的电影
    if (movie.status !== '已发布') {
      return NextResponse.json(
        { error: 'Movie not found' },
        { status: 404 }
      )
    }

    const response = NextResponse.json(movie)
    
    // 设置 HTTP 缓存策略
    response.headers.set(
      'Cache-Control', 
      'public, max-age=240, s-maxage=600, stale-while-revalidate=1200'
    )
    
    // 添加 ETag 用于条件请求
    response.headers.set('ETag', `"movie-${id}"`)
    
    return response
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch movie' },
      { status: 500 }
    )
  }
}
