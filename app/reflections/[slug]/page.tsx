'use client'

import { Calendar, Clock, ArrowLeft, Tag, Eye } from 'lucide-react'
import Link from 'next/link'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import { useState, useEffect } from 'react'
import { NotionReflectionDetail, renderNotionContent } from '@/lib/notion'
import { useSidebarLayout } from '@/hooks/useSidebarLayout'
import NotionContent from '@/components/NotionContent'
import useVersionedCache from '@/hooks/useVersionedCache'

/**
 * 单篇随记详情页面组件
 * 从 Notion 获取和展示文章内容
 */
export default function ReflectionDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { mainContentClass } = useSidebarLayout()
  const [reflection, setReflection] = useState<NotionReflectionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [slug, setSlug] = useState<string | null>(null)

  // 🔄 使用版本化缓存
  const { cachedData, isCacheValid, isCheckingVersion, saveToCache, currentVersion } = useVersionedCache<NotionReflectionDetail>({
    cacheKey: `reflection-detail-${slug}`,
    contentType: 'reflections',
  })

  // 处理 params Promise
  useEffect(() => {
    const getSlug = async () => {
      const resolvedParams = await params
      setSlug(resolvedParams.slug)
    }
    getSlug()
  }, [params])

  useEffect(() => {
    if (slug) {
      fetchReflection()
    }
  }, [slug, isCacheValid, cachedData, isCheckingVersion])

  const fetchReflection = async () => {
    if (!slug) return
    
    try {
      // ✅ 如果有有效缓存，直接使用
      if (isCacheValid && cachedData) {
        setReflection(cachedData)
        setLoading(false)
        return
      }

      if (isCheckingVersion) return
      
      setLoading(true)
      // 🔄 使用版本号绕过HTTP缓存
      const versionParam = currentVersion ? `?v=${currentVersion}` : ''
      const response = await fetch(`/api/reflections/${slug}${versionParam}`)
      
      if (!response.ok) {
        if (response.status === 404) {
          setError('文章不存在')
        } else {
          setError('获取文章失败')
        }
        return
      }

      const data = await response.json()
      setReflection(data)
      
      // 💾 保存到缓存
      await saveToCache(data)
    } catch (err) {
      setError('网络错误，请稍后重试')
      // 🔄 如果API失败，尝试使用缓存数据
      if (cachedData) {
        setReflection(cachedData)
      }
    } finally {
      setLoading(false)
    }
  }

  // 🔧 加载中或版本检查中：显示加载状态
  if (loading || isCheckingVersion) {
    return (
      <div className="min-h-screen bg-white">
        <Sidebar />
        <Header />
        <main className={mainContentClass}>
          <div className="container-custom py-16">
            <div className="text-center">
              <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900 mx-auto"></div>
              <p className="mt-4 text-gray-600">正在加载文章...</p>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // 🔧 确认失败：只在加载完成且确实没有数据时显示
  if (!reflection) {
    return (
      <div className="min-h-screen bg-white">
        <Sidebar />
        <Header />
        <main className={mainContentClass}>
          <div className="container-custom py-16">
            <div className="text-center">
              <p className="text-gray-600 text-lg">{error || '文章不存在'}</p>
              <Link 
                href="/reflections"
                className="inline-block mt-6 bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-colors"
              >
                返回文章列表
              </Link>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      {/* 侧边栏 */}
      <Sidebar />
      
      {/* 顶部导航 */}
      <Header />

      {/* 主要内容区域 */}
      <main className="ml-20 lg:ml-24 pt-16">
        {/* 返回按钮 */}
        <div className="container-custom pt-8">
          <Link 
            href="/reflections"
            className="inline-flex items-center text-gray-600 hover:text-black transition-colors duration-300 group"
          >
            <ArrowLeft size={18} className="mr-2" />
            <span>返回随记列表</span>
          </Link>
        </div>

        <article className="container-custom py-12">
          {/* 文章头部 */}
          <header className="max-w-4xl mx-auto mb-12">
            {/* 标签 */}
            <div className="flex flex-wrap gap-2 mb-6">
              {reflection.tags.map((tag) => (
                <span
                  key={tag}
                  className="bg-gray-100 text-gray-700 text-sm px-3 py-1 rounded-full flex items-center"
                >
                  <Tag size={12} className="mr-1" />
                  {tag}
                </span>
              ))}
            </div>

            {/* 标题 */}
            <h1 className="font-serif text-3xl md:text-4xl lg:text-5xl font-light text-gray-900 mb-6 leading-tight">
              {reflection.title}
            </h1>

            {/* 文章信息 */}
            <div className="flex flex-wrap items-center justify-between border-b border-gray-200 pb-6">
              <div className="flex items-center space-x-6 text-gray-600">
                <div className="flex items-center">
                  <Calendar size={16} className="mr-2" />
                  <span>更新于 {new Date(reflection.updatedAt).toLocaleDateString('zh-CN')}</span>
                </div>
              </div>
            </div>
          </header>

          {/* 文章内容 */}
          <div className="max-w-4xl mx-auto">
            <div className="prose prose-lg prose-gray max-w-none 
              prose-img:!border-0 prose-img:!outline-0">
              <NotionContent 
                articleId={reflection.id}
                contentType="reflection"
                htmlContent={renderNotionContent(reflection.content)}
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
                  [&>img]:rounded-lg [&>img]:my-8 [&>img]:mx-auto [&>img]:!border-0 [&>img]:!outline-0
                  [&_.notion-optimized-image]:rounded-lg [&_.notion-optimized-image]:!border-0 [&_.notion-optimized-image]:!outline-0
                  [&_.optimized-image-wrapper]:!border-0 [&_.optimized-image-wrapper]:!outline-0
                  [&_.notion-image-container]:!border-0 [&_.notion-image-container]:!outline-0
                  [&_a]:text-blue-600 [&_a]:hover:text-blue-800 [&_a]:underline
                  [&_.video-embed-container]:my-8
                  [&_.video-container]:my-8
                  [&_.embed-container]:my-8"
              />
            </div>
          </div>

        </article>
      </main>
    </div>
  )
}