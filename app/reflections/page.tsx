'use client'

import { motion } from 'framer-motion'
import { Calendar, Eye } from 'lucide-react'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Layout from '@/components/Layout'
import { NotionReflection } from '@/lib/notion'
import useVersionedCache from '@/hooks/useVersionedCache'

/**
 * 个人随记页面组件
 * 从 Notion 数据库获取文章数据
 */
export default function ReflectionsPage() {
  const [selectedTag, setSelectedTag] = useState('全部')
  const [reflections, setReflections] = useState<NotionReflection[]>([])
  const [tags, setTags] = useState<string[]>(['全部'])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 🔄 使用版本化缓存
  const { cachedData, isCacheValid, isCheckingVersion, saveToCache, currentVersion } = useVersionedCache<NotionReflection[]>({
    cacheKey: 'reflections-list-data',
    contentType: 'reflections',
  })

  // 获取随记数据
  useEffect(() => {
    fetchReflections()
  }, [isCacheValid, cachedData, isCheckingVersion])

  const fetchReflections = async () => {
    try {
      // ✅ 如果有有效缓存，直接使用
      if (isCacheValid && cachedData) {
        setReflections(cachedData)
        
        // 提取所有标签
        const allTags = new Set<string>()
        cachedData.forEach((reflection: NotionReflection) => {
          reflection.tags.forEach(tag => allTags.add(tag))
        })
        setTags(['全部', ...Array.from(allTags)])
        setLoading(false)
        return
      }

      if (isCheckingVersion) return

      setLoading(true)
      // 🔄 使用版本号绕过HTTP缓存
      const versionParam = currentVersion ? `?v=${currentVersion}` : ''
      const response = await fetch(`/api/reflections${versionParam}`)
      if (!response.ok) {
        throw new Error('Failed to fetch reflections')
      }
      const data = await response.json()
      setReflections(data)
      
      // 💾 保存到缓存
      await saveToCache(data)
      
      // 提取所有标签
      const allTags = new Set<string>()
      data.forEach((reflection: NotionReflection) => {
        reflection.tags.forEach(tag => allTags.add(tag))
      })
      setTags(['全部', ...Array.from(allTags)])
    } catch (err) {
      setError('获取文章列表失败，请稍后重试')
      // 🔄 如果API失败，尝试使用缓存数据
      if (cachedData) {
        setReflections(cachedData)
      }
    } finally {
      setLoading(false)
    }
  }

  // 过滤文章
  const filteredReflections = selectedTag === '全部' 
    ? reflections 
    : reflections.filter(reflection => reflection.tags.includes(selectedTag))

  if (loading) {
    return (
      <Layout>
        <div className="container-custom py-16">
          <div className="text-center">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-4 text-gray-600">正在加载文章...</p>
          </div>
        </div>
      </Layout>
    )
  }

  if (error) {
    return (
      <Layout>
        <div className="container-custom py-16">
          <div className="text-center">
            <p className="text-red-600 text-lg">{error}</p>
            <button 
              onClick={fetchReflections}
              className="mt-4 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              重新加载
            </button>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
        {/* 标签过滤器 */}
        {tags.length > 1 && (
          <motion.section
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="pt-16 mb-16 px-4 sm:px-6 lg:px-8 lg:pr-24 max-w-7xl mx-auto"
          >
            <div className="max-w-4xl mx-auto">
              <div className="flex flex-wrap gap-3 justify-center">
                {tags.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => setSelectedTag(tag)}
                    className={`px-4 py-2 rounded-full text-sm font-light transition-all duration-300 ${
                      selectedTag === tag
                        ? 'bg-black text-white shadow-lg transform scale-105'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-md'
                    }`}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          </motion.section>
        )}

        {/* 特色文章 */}
        {false && (
          <motion.section
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="container-custom mb-16"
          >
            <div className="max-w-4xl mx-auto">
              <h2 className="font-serif text-2xl font-medium text-gray-900 mb-8">
                特色文章
              </h2>
              <div className="grid gap-8">
                {filteredReflections
                  .slice(0, 0)
                  .map((reflection, index) => (
                    <motion.article
                      key={reflection.id}
                      initial={{ y: 30, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ duration: 0.6, delay: 0.1 * index }}
                      className="group"
                    >
                      <Link href={`/reflections/${reflection.slug}`}>
                        <div className="border border-gray-200 rounded-2xl p-8 hover:shadow-xl hover:-translate-y-1 transition-all duration-500 bg-gradient-to-br from-white to-gray-50 group-hover:border-gray-300">
                          <div className="flex flex-wrap gap-2 mb-4">
                            {reflection.tags.map(tag => (
                              <span key={tag} className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded-full">
                                {tag}
                              </span>
                            ))}
                          </div>
                          <h3 className="font-serif text-2xl font-medium text-gray-900 group-hover:text-black mb-4 transition-colors duration-300">
                            {reflection.title}
                          </h3>
                          <div className="flex items-center justify-between text-sm text-gray-500">
                            <div className="flex items-center">
                              <Calendar size={14} className="mr-1" />
                              更新于 {new Date(reflection.updatedAt).toLocaleDateString('zh-CN')}
                            </div>
                            <div className="flex items-center">
                              <Eye size={14} className="mr-1" />
                              {reflection.views}
                            </div>
                          </div>
                        </div>
                      </Link>
                    </motion.article>
                  ))}
              </div>
            </div>
          </motion.section>
        )}

        {/* 所有文章 */}
        <motion.section
          initial={{ y: 30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          className={`mb-16 px-4 sm:px-6 lg:px-8 lg:pr-24 max-w-7xl mx-auto ${tags.length <= 1 ? 'pt-16' : ''}`}
        >
          <div className="max-w-4xl mx-auto">
            
            {filteredReflections.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-gray-500 text-lg">
                  {reflections.length === 0 ? '还没有发布文章，快去 Notion 中创建第一篇吧！' : '暂无相关文章'}
                </p>
                {reflections.length === 0 && (
                  <div className="mt-8 p-6 bg-blue-50 rounded-lg border border-blue-200">
                    <h3 className="font-medium text-blue-900 mb-2">📝 如何添加文章？</h3>
                    <div className="text-blue-800 text-sm space-y-1">
                      <p>1. 打开您的 Notion 工作区</p>
                      <p>2. 在"随记文章"数据库中添加新页面</p>
                      <p>3. 填写标题、摘要、正文等信息</p>
                      <p>4. 将状态设为"已发布"</p>
                      <p>5. 刷新网站即可看到新文章！</p>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                {filteredReflections.map((reflection, index) => (
                  <motion.article
                    key={reflection.id}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ duration: 0.5, delay: 0.1 * index }}
                    className="group"
                  >
                    <div className="border-b border-gray-200 pb-6 hover:border-gray-300 transition-colors duration-300">
                      <div className="flex flex-wrap gap-2 mb-3">
                        {reflection.tags.map(tag => (
                          <span key={tag} className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full">
                            {tag}
                          </span>
                        ))}
                      </div>
                      <Link href={`/reflections/${reflection.slug}`}>
                        <h3 className="font-serif text-xl font-medium text-gray-900 group-hover:text-black mb-3 transition-colors duration-300">
                          {reflection.title}
                        </h3>
                        <div className="flex items-center justify-between text-sm text-gray-500">
                          <div className="flex items-center">
                            <Calendar size={14} className="mr-1" />
                            更新于 {new Date(reflection.updatedAt).toLocaleDateString('zh-CN')}
                          </div>
                          <div className="flex items-center">
                            <Eye size={14} className="mr-1" />
                            {reflection.views}
                          </div>
                        </div>
                      </Link>
                    </div>
                  </motion.article>
                ))}
              </div>
            )}
          </div>
        </motion.section>
    </Layout>
  )
}