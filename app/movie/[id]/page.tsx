'use client'

import { motion } from 'framer-motion'
import { ArrowLeft, ExternalLink, Film, Calendar, User, Clapperboard } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import OptimizedImage from '@/components/ui/OptimizedImage'
import { NotionMovie, NotionMovieDetail, renderNotionContent } from '@/lib/notion'
import NotionContent from '@/components/NotionContent'
import { useSidebarLayout } from '@/hooks/useSidebarLayout'
import useVersionedCache from '@/hooks/useVersionedCache'

/**
 * 电影详情页面组件
 * 显示单部电影的完整信息
 */
export default function MovieDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { mainContentClass } = useSidebarLayout()
  const router = useRouter()
  const [movie, setMovie] = useState<NotionMovieDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [movieId, setMovieId] = useState<string>('')

  // 🔄 使用版本化缓存
  const { cachedData, isCacheValid, isCheckingVersion, saveToCache, currentVersion } = useVersionedCache<NotionMovieDetail>({
    cacheKey: `movie-detail-${movieId}`,
    contentType: 'movies',
  })

  useEffect(() => {
    const getParams = async () => {
      const resolvedParams = await params
      setMovieId(resolvedParams.id)
    }
    getParams()
  }, [params])

  useEffect(() => {
    if (!movieId) return

    const fetchMovie = async () => {
      try {
        // ✅ 如果有有效缓存，直接使用
        if (isCacheValid && cachedData) {
          setMovie(cachedData)
          setLoading(false)
          return
        }

        // 📡 从API获取新数据，使用版本号绕过HTTP缓存
        const versionParam = currentVersion ? `?v=${currentVersion}` : ''
        const response = await fetch(`/api/movie/${movieId}${versionParam}`, {
          headers: {
            'Cache-Control': 'no-cache'
          }
        })
        
        if (response.ok) {
          const movieDetail = await response.json()
          setMovie(movieDetail)
          
          // 💾 保存到版本化缓存
          await saveToCache(movieDetail)
        } else {
          setMovie(null)
        }
      } catch (error) {
        console.error('获取电影详情失败:', error)
        
        // 🔄 如果API失败，尝试使用缓存数据
        if (cachedData) {
          setMovie(cachedData)
        } else {
          setMovie(null)
        }
      } finally {
        setLoading(false)
      }
    }

    // 等待版本检查完成后再获取数据
    if (!isCheckingVersion) {
      fetchMovie()
    }
  }, [movieId, isCacheValid, cachedData, isCheckingVersion])

  // 🔧 加载中或版本检查中：显示加载状态
  if (loading || isCheckingVersion) {
    return (
      <div className="min-h-screen bg-white">
        <Sidebar />
        <Header />
        <main className={mainContentClass}>
          <div className="container-custom py-20">
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
                <p className="text-gray-600">正在加载电影详情...</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // 🔧 确认失败：只在加载完成且确实没有数据时显示
  if (!movie) {
    return (
      <div className="min-h-screen bg-white">
        <Sidebar />
        <Header />
        <main className={mainContentClass}>
          <div className="container-custom py-20">
            <div className="text-center">
              <p className="text-gray-600 mb-8">找不到您要查看的电影</p>
              <button
                onClick={() => router.back()}
                className="bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-colors duration-300"
              >
                返回
              </button>
            </div>
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <Sidebar />
      <Header />

      <main className={mainContentClass}>
        <div className="container-custom py-12">
          {/* 返回按钮 */}
          <motion.button
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
            onClick={() => router.back()}
            className="flex items-center text-gray-600 hover:text-gray-900 transition-colors duration-300 mb-8"
          >
            <ArrowLeft size={20} className="mr-2" />
            返回电影列表
          </motion.button>

          <div className="grid lg:grid-cols-7 gap-12 px-20">
            {/* 左侧：海报 */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="lg:col-span-2"
            >
              {/* 海报 */}
              <div className="rounded-xl overflow-hidden shadow-lg mb-6">
                <OptimizedImage
                  src={`/api/images/notion/movie/${movie.id}${currentVersion ? `?v=${currentVersion}` : ''}`}
                  alt={movie.title}
                  className="w-full"
                  aspectRatio="auto"
                  objectFit="contain"
                  style={{ height: 'auto' }}
                  priority="high" // 详情页图片高优先级
                  lazy={false} // 详情页不需要懒加载
                  fallback={
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-400 to-gray-500">
                      <Film className="text-white" size={80} />
                    </div>
                  }
                  onRetry={async (retryAttempt) => {
                    // 智能重试逻辑
                    try {
                      const response = await fetch(`/api/movie/${movie.id}`)
                      const data = await response.json()
                      return data ? `/api/images/notion/movie/${movie.id}` : null
                    } catch (error) {
                      return null
                    }
                  }}
                />
              </div>

              {/* 基本信息卡片 */}
              <div className="bg-gray-50 rounded-xl p-6">
                <div className="space-y-3">
                  <div className="flex items-center">
                    <Clapperboard size={16} className="text-gray-500 mr-3" />
                    <span className="text-gray-700">
                      {movie.genre}
                    </span>
                  </div>
                  {movie.director && (
                    <div className="flex items-center pt-3 border-t border-gray-200">
                      <User size={16} className="text-gray-500 mr-3" />
                      <span className="text-gray-700">
                        导演：{movie.director}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center pt-3 border-t border-gray-200">
                    <Calendar size={16} className="text-gray-500 mr-3" />
                    <span className="text-gray-700">
                      更新于 {new Date(movie.updatedAt).toLocaleDateString('zh-CN')}
                    </span>
                  </div>
                  <div className="flex items-center pt-3 border-t border-gray-200">
                    <a
                      href={movie.doubanUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-gray-700 hover:text-gray-900"
                    >
                      <ExternalLink size={16} className="mr-2" />
                      在豆瓣中查看
                    </a>
                  </div>
                </div>
              </div>
            </motion.div>

            {/* 右侧：标题和正文内容 */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              className="lg:col-span-5"
            >
              {/* 标题 */}
              <h1 className="font-serif text-3xl md:text-4xl font-light text-gray-900 mb-8">
                {movie.title}
              </h1>

              {/* Notion正文内容 */}
              {movie.content && movie.content.length > 0 ? (
                <div className="bg-white">
                  <NotionContent
                    articleId={movie.id}
                    contentType="movie"
                    htmlContent={renderNotionContent(movie.content)}
                    className="prose prose-lg max-w-none
                      [&>ul]:mb-6 [&>ul]:pl-6 [&>ul>li]:mb-2 [&>ul>li]:list-disc
                      [&>ol]:mb-6 [&>ol]:pl-6 [&>ol>li]:mb-2 [&>ol>li]:list-decimal
                      [&_img]:max-w-full [&_img]:h-auto [&_img]:max-h-[500px] [&_img]:object-contain [&_img]:mx-auto [&_img]:block"
                  />
                </div>
              ) : (
                <div className="bg-white">
                  <p className="text-gray-500 text-center py-8">
                    暂无详细内容...
                  </p>
                </div>
              )}
            </motion.div>
          </div>
        </div>
      </main>
    </div>
  )
}
