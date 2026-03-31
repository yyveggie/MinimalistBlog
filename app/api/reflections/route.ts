import { NextResponse } from 'next/server'
import { getReflections } from '@/lib/notion'
import { serverCache, SERVER_CACHE_KEYS, SERVER_CACHE_TTL } from '@/lib/serverCache'

// 禁用Next.js路由缓存，避免2MB限制
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // 使用服务端缓存获取随记数据 - 所有用户共享同一份缓存
    const reflections = await serverCache.get(
      SERVER_CACHE_KEYS.REFLECTIONS,
      () => getReflections(),
      SERVER_CACHE_TTL.MEDIUM // 随记数据变化中等，使用中等缓存
    )
    
    const response = NextResponse.json(reflections)
    
    // 设置 HTTP 缓存策略 - 个人网站几天才更新一次，缓存1小时
    response.headers.set(
      'Cache-Control', 
      'public, max-age=3600, s-maxage=3600, stale-while-revalidate=7200'
      // 浏览器和CDN都缓存1小时，过期后2小时内可用
    )
    
    // 添加 ETag 用于条件请求
    response.headers.set('ETag', `"reflections-${reflections?.length || 0}"`)
    
    return response
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch reflections' },
      { status: 500 }
    )
  }
}
