import { NextRequest, NextResponse } from 'next/server'
import { getReflectionById, incrementViews } from '@/lib/notion'
import { serverCache, SERVER_CACHE_TTL } from '@/lib/serverCache'

// 🔧 强制动态渲染
export const dynamic = 'force-dynamic'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Next.js 15 要求先 await params
    const { id } = await params
    
    // 🚀 使用服务端缓存获取反思详情 - 提升性能  
    const reflection = await serverCache.get(
      `reflection:detail:${id}`,
      () => getReflectionById(id),
      SERVER_CACHE_TTL.MEDIUM // 反思文章中等缓存
    )
    
    if (!reflection) {
      return NextResponse.json(
        { error: 'Reflection not found' },
        { status: 404 }
      )
    }

    // 增加阅读量（异步执行，不阻塞响应）
    incrementViews(id).catch(() => {})

    const response = NextResponse.json(reflection)
    
    // 设置 HTTP 缓存策略
    response.headers.set(
      'Cache-Control', 
      'public, max-age=1800, s-maxage=3600, stale-while-revalidate=21600'
    )
    
    // 添加 ETag 用于条件请求
    response.headers.set('ETag', `"reflection-${id}-${reflection.views || 0}"`)
    
    return response
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch reflection' },
      { status: 500 }
    )
  }
}
