import { NextResponse } from 'next/server'
import { serverCache } from '@/lib/serverCache'
import { isAuthenticated } from '@/lib/auth'

// 🔧 强制动态渲染
export const dynamic = 'force-dynamic'

/**
 * 🔄 版本管理 API
 * 分类型版本管理 - 每种内容类型独立版本号
 * 支持客户端缓存自动失效机制
 * 
 * 🔑 关键修复：
 * - 版本号固定为 v1，避免 Vercel 冷启动导致版本号变化
 * - 只有手动点击"刷新缓存"才会更新版本号
 */
const VERSION_KEYS = {
  music: 'version-music',
  movies: 'version-movies', 
  photos: 'version-photos',
  reflections: 'version-reflections',
  projects: 'version-projects',
  homepage: 'version-homepage'
} as const

// 🔑 固定的初始版本号
const INITIAL_VERSION = 'v1'

type ContentType = keyof typeof VERSION_KEYS

/**
 * 获取当前内容版本号
 * 支持查询参数: ?type=music 获取特定类型版本
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') as ContentType
    
    if (type && VERSION_KEYS[type]) {
      // 获取特定类型的版本号
      let version = await serverCache.get<string>(VERSION_KEYS[type])
      
      if (!version) {
        // 🔑 使用固定的初始版本号，不用 Date.now()
        version = INITIAL_VERSION
        serverCache.set(VERSION_KEYS[type], version, 365 * 24 * 60 * 60 * 1000) // 1年
      }
      
      const response = NextResponse.json({
        type,
        version,
        timestamp: new Date().toISOString()
      })
      
      // 🚀 关键优化：添加缓存响应头，减少API调用
      response.headers.set(
        'Cache-Control',
        'public, max-age=3600, s-maxage=3600' // 1小时缓存
      )
      
      return response
    } else {
      // 获取所有类型的版本号
      const versions: Record<string, string> = {}
      
      for (const [contentType, versionKey] of Object.entries(VERSION_KEYS)) {
        let version = await serverCache.get<string>(versionKey)
        if (!version) {
          // 🔑 使用固定的初始版本号
          version = INITIAL_VERSION
          serverCache.set(versionKey, version, 365 * 24 * 60 * 60 * 1000) // 1年
        }
        versions[contentType] = version
      }
      
      const response = NextResponse.json({
        versions,
        timestamp: new Date().toISOString()
      })
      
      // 🚀 关键优化：添加缓存响应头
      response.headers.set(
        'Cache-Control',
        'public, max-age=3600, s-maxage=3600' // 1小时缓存
      )
      
      return response
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to get version' },
      { status: 500 }
    )
  }
}

/**
 * 更新内容版本号（需要认证）
 * 支持更新特定类型的版本号: POST /api/version { "type": "music" }
 */
export async function POST(request: Request) {
  // 认证检查
  if (!isAuthenticated(request)) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  }

  try {
    const { type } = await request.json()
    // 🔑 使用时间戳作为新版本号（只在手动刷新时生成）
    const newVersion = `v${Date.now()}`
    
    if (type && VERSION_KEYS[type as ContentType]) {
      // 更新特定类型的版本号
      const versionKey = VERSION_KEYS[type as ContentType]
      serverCache.set(versionKey, newVersion, 365 * 24 * 60 * 60 * 1000) // 1年
      
      return NextResponse.json({
        success: true,
        type,
        newVersion,
        message: `${type} 内容版本已更新，对应客户端缓存将失效`,
        timestamp: new Date().toISOString()
      })
    } else {
      // 更新所有类型的版本号
      for (const versionKey of Object.values(VERSION_KEYS)) {
        serverCache.set(versionKey, newVersion, 365 * 24 * 60 * 60 * 1000) // 1年
      }
      
      return NextResponse.json({
        success: true,
        type: 'all',
        newVersion,
        message: '所有内容版本已更新，全部客户端缓存将失效',
        timestamp: new Date().toISOString()
      })
    }
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to update version' },
      { status: 500 }
    )
  }
}
