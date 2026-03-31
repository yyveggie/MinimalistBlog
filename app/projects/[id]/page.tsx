'use client'

import { ArrowLeft, ExternalLink, Calendar, Star, Code2, Tag } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Layout from '@/components/Layout'
import OptimizedImage from '@/components/ui/OptimizedImage'
import { renderNotionContent } from '@/lib/notion'
import NotionContent from '@/components/NotionContent'

interface StaticProjectDetail {
  id: string
  title: string
  description: string
  category: string
  technologies: string[]
  demo?: string
  image?: string
  featured: boolean
  status: string
  startDate: string
  endDate?: string
  slug: string
  content: any[]
}

/**
 * 确保URL包含协议前缀
 */
const ensureProtocol = (url: string): string => {
  if (!url) return url
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url
  }
  return `https://${url}`
}

/**
 * 项目详情页面组件
 * 从本地静态文件获取数据
 */
export default function ProjectDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [project, setProject] = useState<StaticProjectDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [projectId, setProjectId] = useState<string>('')

  useEffect(() => {
    const getParams = async () => {
      const resolvedParams = await params
      setProjectId(resolvedParams.id)
    }
    getParams()
  }, [params])

  useEffect(() => {
    if (projectId) {
      fetchProject()
    }
  }, [projectId])

  const fetchProject = async () => {
    if (!projectId) return

    try {
      setLoading(true)
      // 添加时间戳强制刷新（开发时）
      const response = await fetch(`/api/projects/${projectId}?t=${Date.now()}`)

      if (!response.ok) {
        if (response.status === 404) {
          setError('项目不存在')
        } else {
          setError('获取项目失败')
        }
        return
      }

      const data = await response.json()
      setProject(data)
    } catch (err) {
      setError('网络错误，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <Layout>
        <div className="container-custom py-16">
          <div className="text-center">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-4 text-gray-600">正在加载项目...</p>
          </div>
        </div>
      </Layout>
    )
  }

  if (!project) {
    return (
      <Layout>
        <div className="container-custom py-16">
          <div className="text-center">
            <p className="text-gray-600 text-lg">{error || '项目不存在'}</p>
            <button
              onClick={() => router.back()}
              className="mt-6 bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-colors"
            >
              返回项目列表
            </button>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="container-custom pt-8">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center text-gray-600 hover:text-black transition-colors duration-300 group"
        >
          <ArrowLeft size={18} className="mr-2" />
          <span>返回项目列表</span>
        </button>
      </div>

      <article className="container-custom py-12">
        <header className="max-w-4xl mx-auto mb-12">
          <div className="flex flex-wrap gap-2 mb-6">
            <span className="bg-gray-100 text-gray-700 text-sm px-3 py-1 rounded-full flex items-center">
              <Tag size={12} className="mr-1" />
              {project.category}
            </span>
            {project.featured && (
              <span className="bg-yellow-100 text-yellow-800 text-sm px-3 py-1 rounded-full flex items-center">
                <Star size={12} className="mr-1" />
                特色项目
              </span>
            )}
          </div>

          <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl font-light text-gray-900 mb-6 leading-tight">
            {project.title}
          </h1>

          {/* 项目信息 */}
          <div className="bg-gray-100 px-6 py-4 rounded-lg mb-8 text-sm font-light text-gray-1000 space-y-3">
            <div>开始日期：{new Date(project.startDate).toLocaleDateString('zh-CN')}</div>
            <div>分类：{project.category}</div>
            <div>项目描述：{project.description}</div>
            {project.demo && (
              <div className="flex items-center">
                <span>在线演示：</span>
                <a
                  href={ensureProtocol(project.demo)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 underline ml-1"
                >
                  访问站点
                </a>
              </div>
            )}
          </div>
        </header>

        {/* 项目封面图 */}
        {project.image && (
          <div className="max-w-4xl mx-auto mb-12">
            <div className="rounded-lg overflow-hidden shadow-lg" style={{ minHeight: '300px' }}>
              <img
                src={project.image}
                alt={project.title}
                className="w-full h-auto rounded-lg"
              />
            </div>
          </div>
        )}

        <div className="max-w-4xl mx-auto">

          {/* 项目详情内容 */}
          <div className="prose prose-lg prose-gray max-w-none">
            <NotionContent
              articleId={project.id}
              contentType="project"
              htmlContent={renderNotionContent(project.content)}
              className="leading-relaxed text-gray-800 
                  [&>h1]:font-serif [&>h1]:text-3xl [&>h1]:font-medium [&>h1]:text-gray-900 [&>h1]:mt-12 [&>h1]:mb-8
                  [&>h2]:font-serif [&>h2]:text-2xl [&>h2]:font-medium [&>h2]:text-gray-900 [&>h2]:mt-12 [&>h2]:mb-6 
                  [&>h3]:font-serif [&>h3]:text-xl [&>h3]:font-medium [&>h3]:text-gray-900 [&>h3]:mt-8 [&>h3]:mb-4 
                  [&>p]:mb-6 [&>p]:leading-relaxed 
                  [&>ul]:mb-6 [&>ul]:pl-6 [&>ul>li]:mb-2 [&>ul>li]:list-disc
                  [&>ol]:mb-6 [&>ol]:pl-6 [&>ol>li]:mb-2 [&>ol>li]:list-decimal
                  [&>blockquote]:border-l-4 [&>blockquote]:border-gray-300 [&>blockquote]:pl-6 [&>blockquote]:italic [&>blockquote]:text-gray-700 [&>blockquote]:my-8
                  [&>pre]:bg-gray-100 [&>pre]:p-4 [&>pre]:rounded-lg [&>pre]:overflow-x-auto [&>pre]:my-6
                  [&>code]:bg-gray-100 [&>code]:px-2 [&>code]:py-1 [&>code]:rounded [&>code]:text-sm
                  [&>img]:rounded-lg [&>img]:my-8 [&>img]:mx-auto
                  [&_a]:text-blue-600 [&_a]:hover:text-blue-800 [&_a]:underline
                  [&_.video-embed-container]:my-8
                  [&_.video-container]:my-8
                  [&_.embed-container]:my-8"
            />
          </div>
        </div>

        <div className="max-w-4xl mx-auto mt-16 pt-8 border-t border-gray-200">
          <div className="flex items-center space-x-4">
            <div>
              <h4 className="font-medium text-gray-900">OverFlowing</h4>
              <p className="text-gray-600">Developer & Adventurer</p>
            </div>
          </div>
        </div>

      </article>
    </Layout>
  )
}
