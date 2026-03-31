'use client'

import { motion } from 'framer-motion'
import { Play, ExternalLink, Music, Film } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Layout from '@/components/Layout'
import OptimizedImage from '@/components/ui/OptimizedImage'
import { NotionMusic, NotionMovie } from '@/lib/notion'
import useVersionedCache from '@/hooks/useVersionedCache'

/**
 * 音乐和电影页面组件
 * 展示个人喜好的音乐作品和电影作品
 */
export default function MusicMoviePage() {
  const router = useRouter()
  const [musicData, setMusicData] = useState<NotionMusic[]>([])
  const [movieData, setMovieData] = useState<NotionMovie[]>([])
  const [loading, setLoading] = useState(true)

  // 🔄 使用分类型版本化缓存
  const musicCache = useVersionedCache<NotionMusic[]>({
    cacheKey: 'music-list-data',
    contentType: 'music'
  })
  
  const movieCache = useVersionedCache<NotionMovie[]>({
    cacheKey: 'movie-list-data', 
    contentType: 'movies'
  })
  
  // 筛选器状态
  const [selectedGenre, setSelectedGenre] = useState('全部')

  // 生成统一的流派选项
  const allGenres = ['全部', ...new Set([
    ...musicData.map(music => music.genre).filter(genre => genre),
    ...movieData.map(movie => movie.genre).filter(genre => genre)
  ])]

  // 筛选数据并按更新时间降序排序（最新的在前面）
  const filteredMusicData = (selectedGenre === '全部' 
    ? musicData 
    : musicData.filter(music => music.genre === selectedGenre))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

  const filteredMovieData = (selectedGenre === '全部' 
    ? movieData 
    : movieData.filter(movie => movie.genre === selectedGenre))
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())

  // 创建混合的内容数组
  const mixedData = [...filteredMusicData, ...filteredMovieData]
    .sort((a, b) => {
      // 按更新时间降序排列（最新更新在前面）
      return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    })

  // 获取最新8个项目（用于首个特色展示区域）
  const latestData = [...musicData, ...movieData]
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
    .slice(0, 8)

  // 从API获取数据 - 使用新的分类型版本化缓存
  useEffect(() => {
    const fetchData = async () => {
      try {
        // ✅ 使用音乐缓存
        if (musicCache.isCacheValid && musicCache.cachedData) {
          setMusicData(musicCache.cachedData)
        } else if (!musicCache.isCheckingVersion) {
          // 获取音乐数据
          try {
            // 🔄 使用版本号绕过HTTP缓存
            const versionParam = musicCache.currentVersion ? `?v=${musicCache.currentVersion}` : ''
            const response = await fetch(`/api/music/${versionParam}`)
            if (response.ok) {
              const music = await response.json()
              setMusicData(music)
              await musicCache.saveToCache(music)
            }
          } catch (error) {
            console.error('获取音乐数据失败:', error)
            if (musicCache.cachedData) {
              setMusicData(musicCache.cachedData)
            }
          }
        }

        // ✅ 使用电影缓存
        if (movieCache.isCacheValid && movieCache.cachedData) {
          setMovieData(movieCache.cachedData)
        } else if (!movieCache.isCheckingVersion) {
          // 获取电影数据
          try {
            // 🔄 使用版本号绕过HTTP缓存  
            const versionParam = movieCache.currentVersion ? `?v=${movieCache.currentVersion}` : ''
            const response = await fetch(`/api/movies/${versionParam}`)
            if (response.ok) {
              const movies = await response.json()
              setMovieData(movies)
              await movieCache.saveToCache(movies)
            }
          } catch (error) {
            console.error('获取电影数据失败:', error)
            if (movieCache.cachedData) {
              setMovieData(movieCache.cachedData)
            }
          }
        }

        // 检查加载状态
        const musicReady = musicCache.isCacheValid || !musicCache.isCheckingVersion
        const movieReady = movieCache.isCacheValid || !movieCache.isCheckingVersion
        
        if (musicReady && movieReady) {
          setLoading(false)
        }
      } catch (error) {
        console.error('Error fetching data:', error)
        setLoading(false)
      }
    }

    fetchData()
  }, [
    musicCache.isCacheValid, 
    musicCache.cachedData,
    musicCache.isCheckingVersion,
    movieCache.isCacheValid, 
    movieCache.cachedData,
    movieCache.isCheckingVersion
  ])

  // 加载状态
  if (loading) {
    return (
      <Layout>
        <div className="container-custom py-20">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
              <p className="text-gray-600">正在加载音乐和电影数据...</p>
            </div>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
        <div className="py-16 px-4 sm:px-6 lg:px-8 lg:pr-24 max-w-7xl mx-auto">
          {/* 筛选器 */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mb-16"
          >
            <div className="max-w-6xl mx-auto">
              <div className="flex flex-wrap gap-2 justify-center">
                {allGenres.map((genre) => (
                  <button
                    key={genre}
                    onClick={() => setSelectedGenre(genre)}
                    className={`px-4 py-2 rounded-full text-sm font-light transition-all duration-300 ${
                      selectedGenre === genre
                        ? 'bg-black text-white shadow-lg transform scale-105'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-md'
                    }`}
                  >
                    {genre}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>

          {/* 左右两栏布局 - 缩窄宽度 */}
          <div className="max-w-4xl mx-auto">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              
              {/* 左侧：音乐列表 */}
              <motion.div
                initial={{ x: -30, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.3 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2 mb-6">
                  <h2 className="text-lg font-light text-gray-900">音乐</h2>
                  <span className="text-sm text-gray-500">({filteredMusicData.length})</span>
                </div>

                <div className="space-y-4">
                  {filteredMusicData.map((music, index) => (
                    <motion.div
                      key={music.id}
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ duration: 0.5, delay: 0.4 + index * 0.05 }}
                      onClick={() => router.push(`/music/${music.id}`)}
                      className="group bg-white rounded-lg overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer flex p-3"
                    >
                      {/* 封面缩略图 - 左侧，缩小 */}
                      <div className="w-16 h-16 flex-shrink-0 relative rounded-lg overflow-hidden">
                        <OptimizedImage
                          src={`/api/images/notion/music/${music.id}${musicCache.currentVersion ? `?v=${musicCache.currentVersion}` : ''}`}
                          alt={music.title}
                          className="w-full h-full"
                          aspectRatio="1"
                          objectFit="cover"
                          priority={index < 3 ? "high" : "normal"}
                          lazy={false}
                          fallback={
                            <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
                              <Music className="text-gray-400" size={20} />
                            </div>
                          }
                        />
                      </div>

                      {/* 右侧内容区域 - 垂直居中，左对齐 */}
                      <div className="flex-1 ml-3 flex flex-col justify-center">
                        {/* 标题和艺术家在同一行 */}
                        <h3 className="font-medium text-gray-900 text-sm mb-2 line-clamp-1">
                          {music.title}
                          <span className="text-gray-500 text-xs font-normal ml-1">- {music.artist}</span>
                        </h3>

                        {/* 标签和链接左对齐 */}
                        <div className="flex items-center gap-2">
                          <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded">
                            {music.genre}
                          </span>
                          {music.linkUrl && music.linkUrl !== '#' && (
                            <a
                              href={music.linkUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                window.open(music.linkUrl, '_blank')
                              }}
                              className="w-6 h-6 bg-gray-800 text-white rounded-full flex items-center justify-center hover:bg-black transition-all duration-300"
                            >
                              <Play size={10} className="ml-0.5" />
                            </a>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {filteredMusicData.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    <Music className="mx-auto mb-3 text-gray-300" size={48} />
                    <p>暂无音乐数据</p>
                  </div>
                )}
              </motion.div>

              {/* 右侧：电影列表 */}
              <motion.div
                initial={{ x: 30, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ duration: 0.8, delay: 0.3 }}
                className="space-y-4"
              >
                <div className="flex items-center gap-2 mb-6">
                  <h2 className="text-lg font-light text-gray-900">电影</h2>
                  <span className="text-sm text-gray-500">({filteredMovieData.length})</span>
                </div>

                <div className="space-y-4">
                  {filteredMovieData.map((movie, index) => (
                    <motion.div
                      key={movie.id}
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ duration: 0.5, delay: 0.4 + index * 0.05 }}
                      onClick={() => router.push(`/movie/${movie.id}`)}
                      className="group bg-white rounded-lg overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer flex p-3"
                    >
                      {/* 海报缩略图 - 左侧，缩小 */}
                      <div className="w-16 h-16 flex-shrink-0 relative rounded-lg overflow-hidden">
                        <OptimizedImage
                          src={`/api/images/notion/movie/${movie.id}${movieCache.currentVersion ? `?v=${movieCache.currentVersion}` : ''}`}
                          alt={movie.title}
                          className="w-full h-full"
                          aspectRatio="1"
                          objectFit="cover"
                          priority={index < 3 ? "high" : "normal"}
                          lazy={false}
                          fallback={
                            <div className="absolute inset-0 flex items-center justify-center bg-gray-200">
                              <Film className="text-gray-400" size={20} />
                            </div>
                          }
                        />
                      </div>

                      {/* 右侧内容区域 - 垂直居中，左对齐 */}
                      <div className="flex-1 ml-3 flex flex-col justify-center">
                        {/* 标题和导演在同一行 */}
                        <h3 className="font-medium text-gray-900 text-sm mb-2 line-clamp-1">
                          {movie.title}
                          {movie.director && (
                            <span className="text-gray-500 text-xs font-normal ml-1">- {movie.director}</span>
                          )}
                        </h3>

                        {/* 标签和链接左对齐 */}
                        <div className="flex items-center gap-2">
                          <span className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded">
                            {movie.genre}
                          </span>
                          {movie.doubanUrl && movie.doubanUrl !== '#' && (
                            <a
                              href={movie.doubanUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              onClick={(e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                window.open(movie.doubanUrl, '_blank')
                              }}
                              className="w-6 h-6 bg-gray-800 text-white rounded-full flex items-center justify-center hover:bg-black transition-all duration-300"
                            >
                              <ExternalLink size={10} />
                            </a>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>

                {filteredMovieData.length === 0 && (
                  <div className="text-center py-12 text-gray-500">
                    <Film className="mx-auto mb-3 text-gray-300" size={48} />
                    <p>暂无电影数据</p>
                  </div>
                )}
              </motion.div>

            </div>
          </div>

        {/* 底部空间 */}
        <div className="h-20"></div>
        </div>
    </Layout>
  )
}
