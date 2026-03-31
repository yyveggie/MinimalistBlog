'use client'

import { motion } from 'framer-motion'
import { Play, ArrowLeft, Music, Calendar, User, Album } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Sidebar from '@/components/Sidebar'
import Header from '@/components/Header'
import OptimizedImage from '@/components/ui/OptimizedImage'
import { NotionMusic, renderNotionContent } from '@/lib/notion'
import NotionContent from '@/components/NotionContent'
import { useSidebarLayout } from '@/hooks/useSidebarLayout'
import useVersionedCache from '@/hooks/useVersionedCache'

/**
 * 音乐详情页面组件
 * 显示单首歌曲的完整信息
 */
interface NotionMusicDetail extends NotionMusic {
  content?: any[] // Notion页面内容块
}

export default function MusicDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { mainContentClass } = useSidebarLayout()
  const router = useRouter()
  const [music, setMusic] = useState<NotionMusicDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [musicId, setMusicId] = useState<string>('')

  // 🔄 使用版本化缓存
  const { cachedData, isCacheValid, isCheckingVersion, saveToCache, currentVersion } = useVersionedCache<NotionMusicDetail>({
    cacheKey: `music-detail-${musicId}`,
    contentType: 'music',
  })

  useEffect(() => {
    const getParams = async () => {
      const resolvedParams = await params
      setMusicId(resolvedParams.id)
    }
    getParams()
  }, [params])

  useEffect(() => {
    if (!musicId) return

    const fetchMusic = async () => {
      try {
        // ✅ 如果有有效缓存，直接使用
        if (isCacheValid && cachedData) {
          setMusic(cachedData)
          setLoading(false)
          return
        }

        // 📡 从API获取新数据，使用版本号绕过HTTP缓存
        const versionParam = currentVersion ? `?v=${currentVersion}` : ''
        const response = await fetch(`/api/music/${musicId}${versionParam}`, {
          headers: {
            'Cache-Control': 'no-cache'
          }
        })
        
        if (response.ok) {
          const musicDetail = await response.json()
          setMusic(musicDetail)
          
          // 💾 保存到版本化缓存
          await saveToCache(musicDetail)
        } else {
          setMusic(null)
        }
      } catch (error) {
        console.error('获取音乐详情失败:', error)
        
        // 🔄 如果API失败，尝试使用缓存数据
        if (cachedData) {
          setMusic(cachedData)
        } else {
          setMusic(null)
        }
      } finally {
        setLoading(false)
      }
    }

    // 等待版本检查完成后再获取数据
    if (!isCheckingVersion) {
      fetchMusic()
    }
  }, [musicId, isCacheValid, cachedData, isCheckingVersion])

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
                <p className="text-gray-600">正在加载音乐详情...</p>
              </div>
            </div>
          </div>
        </main>
      </div>
    )
  }

  // 🔧 确认失败：只在加载完成且确实没有数据时显示
  if (!music) {
    return (
      <div className="min-h-screen bg-white">
        <Sidebar />
        <Header />
        <main className={mainContentClass}>
          <div className="container-custom py-20">
            <div className="text-center">
              <p className="text-gray-600 mb-8">找不到您要查看的音乐</p>
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
            返回音乐列表
          </motion.button>

          <div className="grid lg:grid-cols-7 gap-12 px-20">
            {/* 左侧：封面 */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8 }}
              className="lg:col-span-2"
            >
              {/* 封面 */}
              <div className="rounded-xl overflow-hidden shadow-lg mb-6">
                <OptimizedImage
                  src={`/api/images/notion/music/${music.id}${currentVersion ? `?v=${currentVersion}` : ''}`}
                  alt={music.title}
                  className="w-full"
                  aspectRatio="auto"
                  objectFit="contain"
                  style={{ height: 'auto' }}
                  priority="high" // 详情页图片高优先级
                  lazy={false} // 详情页不需要懒加载
                  fallback={
                    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gray-400 to-gray-500">
                      <Music className="text-white" size={80} />
                    </div>
                  }
                  onRetry={async (retryAttempt) => {
                    // 智能重试逻辑
                    try {
                      const response = await fetch(`/api/music`)
                      const data = await response.json()
                      const updatedMusic = data.find((m: any) => m.id === music.id)
                      return updatedMusic ? `/api/images/notion/music/${music.id}` : null
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
                    <User size={16} className="text-gray-500 mr-3" />
                    <span className="text-gray-700">{music.artist}</span>
                  </div>
                  <div className="flex items-center pt-3 border-t border-gray-200">
                    <Music size={16} className="text-gray-500 mr-3" />
                    <span className="text-gray-700">
                      {music.genre}
                    </span>
                  </div>
                  <div className="flex items-center pt-3 border-t border-gray-200">
                    <Calendar size={16} className="text-gray-500 mr-3" />
                    <span className="text-gray-700">
                      更新于 {new Date(music.updatedAt).toLocaleDateString('zh-CN')}
                    </span>
                  </div>
                  <div className="flex items-center pt-3 border-t border-gray-200">
                    <a
                      href={music.linkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center text-gray-700 hover:text-gray-900"
                    >
                      <Play size={16} className="mr-2" />
                      在网易云音乐中打开
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
                {music.title}
              </h1>

              {/* Notion正文内容 */}
              {music.content && music.content.length > 0 ? (
                <div className="bg-white">
                  <NotionContent 
                    articleId={music.id}
                    contentType="music"
                    htmlContent={renderNotionContent(music.content)}
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
