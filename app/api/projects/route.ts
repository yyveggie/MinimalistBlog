import { NextResponse } from 'next/server'
import { getProjects } from '@/content/projects'

/**
 * 项目列表 API
 * 已从 Notion API 迁移到本地静态文件
 */
export async function GET() {
  try {
    const projects = getProjects()

    const response = NextResponse.json(projects)

    // 静态内容可以设置更长的缓存时间
    response.headers.set(
      'Cache-Control',
      'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800'
      // 浏览器和CDN都缓存1天，过期后1周内可用
    )

    response.headers.set('ETag', `"projects-static-${projects?.length || 0}"`)

    return response
  } catch (error) {
    console.error('Failed to fetch projects:', error)
    return NextResponse.json(
      { error: 'Failed to fetch projects' },
      { status: 500 }
    )
  }
}
