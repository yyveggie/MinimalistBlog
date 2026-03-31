import { NextResponse } from 'next/server'
import { getHomepageSettings } from '@/lib/notion'
import { serverCache, SERVER_CACHE_TTL } from '@/lib/serverCache'

// 🔧 强制动态渲染
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    // 使用服务端缓存获取主页设置数据
    const homepage = await serverCache.get(
      'homepage:settings',
      () => getHomepageSettings(),
      SERVER_CACHE_TTL.VERY_LONG // 24小时缓存 - 首页很少更新
    )
    
    const response = NextResponse.json(homepage)
    
    // 设置 HTTP 缓存策略
    response.headers.set(
      'Cache-Control', 
      'public, max-age=1800, s-maxage=1800, stale-while-revalidate=86400'
      // 浏览器缓存30分钟，CDN缓存30分钟，过期后24小时内可用
    )
    
    // 添加 ETag 用于条件请求
    response.headers.set('ETag', `"homepage-settings"`)
    
    return response
  } catch (error) {
    return NextResponse.json({ message: 'Failed to fetch homepage settings' }, { status: 500 })
  }
}
