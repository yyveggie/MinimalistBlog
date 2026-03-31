'use client'

import { motion } from 'framer-motion'
import { Camera, MapPin } from 'lucide-react'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Layout from '@/components/Layout'

interface StaticPhoto {
  id: string
  title: string
  location: string
  date: string
  category: string
  camera: string
  lens: string
  description: string
  story: string
  imageUrl: string
  imageUrls: string[]
  status: string
}

/**
 * 摄影作品页面组件
 * 从本地静态文件获取数据
 */
export default function PhotoPage() {
  const [selectedCategory, setSelectedCategory] = useState('全部')
  const [photos, setPhotos] = useState<StaticPhoto[]>([])
  const [categories, setCategories] = useState<string[]>(['全部'])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchPhotos()
  }, [])

  const fetchPhotos = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/photos?t=${Date.now()}`)

      if (response.ok) {
        const photosData = await response.json()
        setPhotos(photosData)

        const allCategories = new Set<string>()
        photosData.forEach((photo: StaticPhoto) => {
          allCategories.add(photo.category)
        })
        setCategories(['全部', ...Array.from(allCategories)])
      }
    } catch (error) {
      console.error('获取照片数据失败:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredPhotos = selectedCategory === '全部'
    ? photos
    : photos.filter(photo => photo.category === selectedCategory)

  if (loading) {
    return (
      <Layout>
        <div className="container-custom py-20">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
              <p className="text-gray-600">正在加载照片数据...</p>
            </div>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      {/* 筛选器区域 */}
      <div className="py-16 px-4 sm:px-6 lg:px-8 lg:pr-24 max-w-7xl mx-auto">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.6 }}
          className="mb-16"
        >
          <div className="max-w-4xl mx-auto">
            <div className="flex justify-center">
              <div className="flex flex-wrap gap-2 justify-center">
                {categories.map((category) => (
                  <button
                    key={category}
                    onClick={() => setSelectedCategory(category)}
                    className={`px-4 py-2 rounded-full text-sm font-light transition-all duration-300 ${selectedCategory === category
                        ? 'bg-black text-white shadow-lg transform scale-105'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:shadow-md'
                      }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {/* 照片网格 */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        whileInView={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.8 }}
        viewport={{ once: true, amount: 0.3 }}
        className="pr-0 lg:pr-24"
      >
        <div className="mb-8">
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-0">
            {filteredPhotos.map((photo, index) => (
              <Link href={`/photo/${photo.id}`} key={photo.id}>
                <motion.div
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  transition={{ duration: 0.4, delay: index * 0.02 }}
                  viewport={{ once: true }}
                  className="group relative aspect-square overflow-hidden cursor-pointer"
                >
                  {/* 照片 - 使用简单的 img 标签 */}
                  <img
                    src={photo.imageUrl}
                    alt={photo.title}
                    className="w-full h-full object-cover"
                    loading={index >= 8 ? 'lazy' : 'eager'}
                  />

                  {/* 悬停遮罩和信息 */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                  {/* 底部标题信息 - 始终可见 */}
                  <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/60 to-transparent">
                    <h3 className="text-white font-medium text-sm mb-1 line-clamp-1 drop-shadow-lg">
                      {photo.title}
                    </h3>
                    <div className="flex items-center text-white/90 text-xs drop-shadow-lg">
                      <MapPin size={10} className="mr-1" />
                      <span className="line-clamp-1">{photo.location}</span>
                    </div>
                  </div>

                  {/* 顶部分类标签 */}
                  <div className="absolute top-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                    <span className="bg-white/95 text-gray-800 text-xs px-2 py-1 rounded-full shadow-lg">
                      {photo.category}
                    </span>
                  </div>
                </motion.div>
              </Link>
            ))}
          </div>
        </div>
      </motion.div>

      {/* 底部空间 */}
      <div className="h-20"></div>
    </Layout>
  )
}
