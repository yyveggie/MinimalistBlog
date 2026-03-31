import { NextRequest, NextResponse } from 'next/server'
import { getProjectById } from '@/content/projects'

/**
 * 项目详情 API
 * 已从 Notion API 迁移到本地静态文件
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params

    const project = getProjectById(id)

    if (!project) {
      return NextResponse.json(
        { error: 'Project not found' },
        { status: 404 }
      )
    }

    // 转换为前端期望的格式（将 htmlContent 转为 content 数组模拟 Notion 格式）
    const responseData = {
      ...project,
      // 前端期望的是 content 数组，我们用一个特殊标记表示这是预渲染的 HTML
      content: [{ type: 'prerendered_html', html: project.htmlContent }]
    }

    const response = NextResponse.json(responseData)

    // 静态内容可以设置更长的缓存时间
    response.headers.set(
      'Cache-Control',
      'public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800'
    )

    response.headers.set('ETag', `"project-static-${id}"`)

    return response
  } catch (err) {
    const error = err as Error
    console.error('Failed to fetch project:', error)
    return NextResponse.json(
      { error: 'Failed to fetch project' },
      { status: 500 }
    )
  }
}
