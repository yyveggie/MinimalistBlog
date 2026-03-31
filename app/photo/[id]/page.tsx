'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Camera, MapPin, Calendar, Settings, Image as ImageIcon, X } from 'lucide-react'
import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
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
 * 照片详情页面组件
 * 从本地静态文件获取数据
 */
export default function PhotoDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter()
  const [photo, setPhoto] = useState<StaticPhoto | null>(null)
  const [loading, setLoading] = useState(true)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const [photoId, setPhotoId] = useState<string>('')
  const [isLightboxOpen, setIsLightboxOpen] = useState(false)

  useEffect(() => {
    const getParams = async () => {
      const resolvedParams = await params
      setPhotoId(resolvedParams.id)
    }
    getParams()
  }, [params])

  useEffect(() => {
    if (!photoId) return

    const fetchPhoto = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/photos/${photoId}?t=${Date.now()}`)

        if (response.ok) {
          const photoData = await response.json()
          setPhoto(photoData)
        } else {
          setPhoto(null)
        }
      } catch (error) {
        console.error('获取照片详情失败:', error)
        setPhoto(null)
      } finally {
        setLoading(false)
      }
    }

    fetchPhoto()
  }, [photoId])

  // 关闭灯箱时按 ESC
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsLightboxOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  if (loading) {
    return (
      <Layout>
        <div className="container-custom py-20">
          <div className="flex items-center justify-center min-h-[400px]">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900 mx-auto mb-4"></div>
              <p className="text-gray-600">正在加载照片详情...</p>
            </div>
          </div>
        </div>
      </Layout>
    )
  }

  if (!photo) {
    return (
      <Layout>
        <div className="container-custom py-20">
          <div className="text-center">
            <p className="text-gray-600 mb-8">找不到您要查看的照片</p>
            <button
              onClick={() => router.back()}
              className="bg-black text-white px-6 py-3 rounded-lg hover:bg-gray-800 transition-colors duration-300"
            >
              返回
            </button>
          </div>
        </div>
      </Layout>
    )
  }

  const currentImage = photo.imageUrls && photo.imageUrls.length > 1
    ? photo.imageUrls[currentImageIndex]
    : photo.imageUrl

  return (
    <Layout>
      <div className="container-custom py-8 lg:py-12">
        {/* 返回按钮 */}
        <motion.button
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6 }}
          onClick={() => router.back()}
          className="flex items-center text-gray-600 hover:text-gray-900 transition-colors duration-300 mb-8"
        >
          <ArrowLeft size={20} className="mr-2" />
          返回相片列表
        </motion.button>

        <div className="grid lg:grid-cols-3 gap-6 lg:gap-12">
          {/* 照片展示区域 */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="lg:col-span-2"
          >
            {/* 主图片 - 正方形比例，点击放大 */}
            <div
              className="mx-auto rounded-xl overflow-hidden shadow-lg mb-6 cursor-zoom-in bg-gray-100"
              style={{ width: '100%', maxWidth: '500px', aspectRatio: '1 / 1' }}
              onClick={() => setIsLightboxOpen(true)}
            >
              <img
                src={currentImage}
                alt={photo.title}
                className="w-full h-full object-cover"
              />
            </div>

            {/* 多张照片预览 */}
            {photo.imageUrls && photo.imageUrls.length > 1 && (
              <div className="flex items-center gap-3 mb-6">
                <ImageIcon size={16} className="text-gray-500" />
                <div className="flex gap-2 overflow-x-auto">
                  {photo.imageUrls.map((imageUrl, index) => (
                    <button
                      key={index}
                      onClick={() => setCurrentImageIndex(index)}
                      className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-all duration-300 ${currentImageIndex === index
                        ? 'border-black'
                        : 'border-gray-200 hover:border-gray-400'
                        }`}
                    >
                      <img
                        src={imageUrl}
                        alt={`${photo.title} ${index + 1}`}
                        className="w-full h-full object-cover"
                      />
                    </button>
                  ))}
                </div>
                <span className="text-sm text-gray-500 ml-2">
                  {currentImageIndex + 1} / {photo.imageUrls.length}
                </span>
              </div>
            )}
          </motion.div>

          {/* 照片信息 */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="lg:col-span-1"
          >
            {/* 标题 */}
            <h1 className="font-serif text-3xl font-light text-gray-900 mb-6">
              {photo.title}
            </h1>

            {/* 基本信息 */}
            <div className="bg-gray-50 rounded-xl p-6 mb-6">
              <div className="space-y-4">
                <div className="flex items-center">
                  <MapPin size={16} className="text-gray-500 mr-3" />
                  <span className="text-gray-700">{photo.location}</span>
                </div>
                <div className="flex items-center">
                  <Calendar size={16} className="text-gray-500 mr-3" />
                  <span className="text-gray-700">
                    {new Date(photo.date).toLocaleDateString('zh-CN', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </span>
                </div>
                {photo.camera && (
                  <div className="flex items-center">
                    <Camera size={16} className="text-gray-500 mr-3" />
                    <span className="text-gray-700">{photo.camera}</span>
                  </div>
                )}
                {photo.lens && (
                  <div className="flex items-center">
                    <Settings size={16} className="text-gray-500 mr-3" />
                    <span className="text-gray-700">{photo.lens}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-gray-200">
                  <span className="bg-gray-200 text-gray-700 px-3 py-1 rounded-full text-sm">
                    {photo.category}
                  </span>
                </div>
              </div>
            </div>

            {/* 背后故事 */}
            {photo.story && (
              <div>
                <h3 className="font-medium text-gray-900 mb-3">背后故事</h3>
                <p className="text-gray-700 leading-relaxed whitespace-pre-wrap">
                  {photo.story}
                </p>
              </div>
            )}
          </motion.div>
        </div>
      </div>

      {/* 图片放大灯箱 */}
      <AnimatePresence>
        {isLightboxOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center"
            onClick={() => setIsLightboxOpen(false)}
          >
            {/* 关闭按钮 */}
            <button
              className="absolute top-4 right-4 text-white/80 hover:text-white p-2 rounded-full bg-black/50 hover:bg-black/70 transition-colors"
              onClick={() => setIsLightboxOpen(false)}
            >
              <X size={24} />
            </button>

            {/* 放大的图片 */}
            <motion.img
              initial={{ scale: 0.9 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.9 }}
              src={currentImage}
              alt={photo.title}
              className="max-w-[90vw] max-h-[90vh] object-contain"
              onClick={(e) => e.stopPropagation()}
            />

            {/* 图片计数 */}
            {photo.imageUrls && photo.imageUrls.length > 1 && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/80 text-sm bg-black/50 px-3 py-1 rounded-full">
                {currentImageIndex + 1} / {photo.imageUrls.length}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </Layout>
  )
}
