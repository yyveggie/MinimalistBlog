'use client'

import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'
import Layout from '@/components/Layout'
import useVersionedCache from '@/hooks/useVersionedCache'

interface HomepageData {
  id: string
  heroTitle: string
  heroSubtitle: string
  heroImagePosition: string
  heroImageScale: string
  heroImageSize: string
  aboutTitle: string
  aboutContent: string[]
  isActive: boolean
}

/**
 * 首页组件
 * 展示个人主要形象和介绍，支持从Notion动态获取内容
 */
export default function HomePage() {
  const [homepageData, setHomepageData] = useState<HomepageData>({
    id: 'default',
    heroTitle: 'OverFlowing',
    heroSubtitle: '',
    heroImagePosition: '居中',
    heroImageScale: '适合',
    heroImageSize: 'small',
    aboutTitle: 'About',
    aboutContent: [],
    isActive: true
  })
  const [loading, setLoading] = useState(true)

  // 🔄 使用版本化缓存
  const { cachedData, isCacheValid, isCheckingVersion, saveToCache, currentVersion } = useVersionedCache<HomepageData>({
    cacheKey: 'homepage-data',
    contentType: 'homepage',
    cacheExpiry: 30 * 60 * 1000 // 30分钟缓存
  })

  useEffect(() => {
    const fetchHomepageData = async () => {
      try {
        // ✅ 如果有有效缓存，直接使用
        if (isCacheValid && cachedData) {
          setHomepageData(cachedData)
          setLoading(false)
          return
        }

        // 📡 从API获取新数据，使用版本号绕过HTTP缓存
        const versionParam = currentVersion ? `v=${currentVersion}` : `t=${Date.now()}`
        const response = await fetch(`/api/homepage?${versionParam}`, {
          headers: {
            'Cache-Control': 'no-cache'
          }
        })
        
        if (response.ok) {
          const data = await response.json()
          setHomepageData(data)
          
          // 💾 保存到版本化缓存
          await saveToCache(data)
        }
      } catch (error) {
        console.error('获取首页数据失败:', error)
        
        // 🔄 如果API失败，尝试使用缓存数据（即使过期）
        if (cachedData) {
          setHomepageData(cachedData)
        }
      } finally {
        setLoading(false)
      }
    }

    // 等待版本检查完成后再获取数据
    if (!isCheckingVersion) {
      fetchHomepageData()
    }
  }, [isCacheValid, cachedData, isCheckingVersion])



  // 获取图片位置样式
  const getImagePositionStyle = (position: string) => {
    switch (position) {
      case 'top': return 'object-top'
      case 'bottom': return 'object-bottom'
      default: return 'object-center'
    }
  }

  // 获取图片缩放样式
  const getImageScaleStyle = (scale: string): 'cover' | 'contain' | 'fill' => {
    switch (scale) {
      case 'contain': return 'contain'
      case 'fill': return 'fill'
      default: return 'cover'
    }
  }

  // 获取图片容器大小样式
  const getImageSizeStyle = (size: string = 'medium') => {
    switch (size) {
      case 'small': return 'max-w-xs' // 最大320px
      case 'medium': return 'max-w-sm' // 最大384px  
      case 'large': return 'max-w-md' // 最大448px
      case 'xlarge': return 'max-w-lg' // 最大512px
      default: return 'max-w-sm'
    }
  }
  return (
    <Layout>
        {/* 英雄区域 */}
        <section className="relative min-h-screen flex items-center justify-center py-20 px-4 md:px-8 lg:px-16">
          <div className="max-w-6xl mx-auto w-full">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              {/* 文字内容区域 */}
              <div className="order-2 lg:order-1">
                <motion.div
                  initial={{ y: 50, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                >
                  <h1 className="font-serif text-4xl md:text-5xl lg:text-6xl font-light mb-6 text-gray-900 leading-tight">
                    {homepageData?.heroTitle || 'OverFlowing'}
                  </h1>
                  <p className="font-sans text-lg md:text-xl lg:text-2xl font-light text-gray-600 leading-relaxed">
                    {homepageData?.heroSubtitle || 'Developer & Adventurer'}
                  </p>
                </motion.div>
              </div>

              {/* 图片区域 */}
              <div className="order-1 lg:order-2 flex justify-center lg:justify-end">
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 1.2, ease: 'easeOut' }}
                  className={`relative ${getImageSizeStyle(homepageData?.heroImageSize)}`}
                >
                  <div className="relative aspect-[4/5] rounded-lg overflow-hidden shadow-2xl">
                    <img
                      src="/images/homepage/hero.jpg"
                      alt="Homepage Hero Image"
                      className={`w-full h-full rounded-lg object-${getImageScaleStyle(homepageData?.heroImageScale)} ${getImagePositionStyle(homepageData?.heroImagePosition)}`}
                    />
                    {/* 图片叠加效果 */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/20 via-transparent to-transparent" />
                  </div>
                </motion.div>
              </div>
            </div>
          </div>

          {/* 滚动指示器 */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 1.5 }}
            className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-10"
          >
            <div className="w-px h-16 bg-gray-400 relative">
              <motion.div
                animate={{ y: [0, 20, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                className="w-1 h-1 bg-gray-600 rounded-full absolute top-0 left-1/2 transform -translate-x-1/2"
              />
            </div>
          </motion.div>
        </section>

        {/* 介绍区域 */}
        <section className="py-20 px-4 md:px-8 lg:px-16">
          <div className="max-w-4xl mx-auto">
            <motion.div
              initial={{ y: 50, opacity: 0 }}
              whileInView={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
              className="grid md:grid-cols-2 gap-12 items-center"
            >
              {/* 文字内容 */}
              <div>
                <div className="space-y-4 text-gray-700 leading-relaxed">
                  {homepageData?.aboutContent && homepageData?.aboutContent.length > 0 ? (
                    homepageData?.aboutContent.map((paragraph, index) => (
                      <p key={index} className={index === 0 ? "text-lg" : ""}>
                        {paragraph}
                      </p>
                    ))
                  ) :
                  <>
                  </>
                  }
                </div>
              </div>

              {/* 关于区域图片 */}
              <div className="relative">
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }}
                  whileInView={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.8, delay: 0.2 }}
                  viewport={{ once: true }}
                  className="aspect-square rounded-lg shadow-lg overflow-hidden relative"
                >
                  <img
                    src="/images/homepage/about.jpg"
                    alt="About Image"
                    className="w-full h-full rounded-lg object-cover"
                  />
                </motion.div>
              </div>
            </motion.div>
          </div>
        </section>

        {/* 版权信息 */}
        <footer className="py-12 px-4">
          <div className="max-w-4xl mx-auto text-center">
            <p className="text-xs text-gray-400">
              © 2025 overflowing.live, All Rights Reserved.
            </p>
          </div>
        </footer>
    </Layout>
  )
}
