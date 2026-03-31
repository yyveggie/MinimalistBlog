'use client'

import { useState, useRef, useEffect, forwardRef, useImperativeHandle } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { getMobileConcurrentCount, getMobileRootMargin } from '@/lib/deviceUtils'
import { getOptimizedImageUrl } from '@/lib/clientImageCache'

// 全局并发控制器（简化版 - 可靠优先）
class ImageLoadingManager {
  private loadingCount = 0
  private maxConcurrent = 30 // 🚀 从16提高到30，支持大量图片页面
  private queue: Array<{ fn: () => void; priority: number }> = []

  canLoad(): boolean {
    return this.loadingCount < this.maxConcurrent
  }

  startLoading(): void {
    this.loadingCount++
  }

  finishLoading(): void {
    this.loadingCount--
    this.processQueue()
  }

  addToQueue(loadFn: () => void, priority: 'high' | 'normal' | 'low' = 'normal'): void {
    // 转换优先级为数字（数字越大优先级越高）
    const priorityValue = priority === 'high' ? 3 : priority === 'normal' ? 2 : 1
    this.queue.push({ fn: loadFn, priority: priorityValue })
    
    // 按优先级排序（高优先级在前）
    this.queue.sort((a, b) => b.priority - a.priority)
    
    this.processQueue()
  }

  private processQueue(): void {
    while (this.canLoad() && this.queue.length > 0) {
      const item = this.queue.shift()
      if (item) {
        item.fn()
      }
    }
  }

  // 🔍 性能调试方法
  getStats(): { loading: number; queued: number } {
    return {
      loading: this.loadingCount,
      queued: this.queue.length
    }
  }
}

const imageManager = new ImageLoadingManager()

// 🚀 全局图片加载状态管理器（解决页面切换后重新加载的问题）
class GlobalImageStateManager {
  private loadedImages = new Set<string>() // 已成功加载的图片URL
  private failedImages = new Set<string>() // 加载失败的图片URL
  private maxSize = 500 // 最多记录500张图片

  // 检查图片是否已加载过
  isLoaded(url: string): boolean {
    return this.loadedImages.has(url)
  }

  // 检查图片是否加载失败过
  isFailed(url: string): boolean {
    return this.failedImages.has(url)
  }

  // 标记图片为已加载
  markAsLoaded(url: string): void {
    this.loadedImages.add(url)
    this.failedImages.delete(url) // 从失败列表移除
    
    // 限制大小
    if (this.loadedImages.size > this.maxSize) {
      const firstItem = this.loadedImages.values().next().value
      if (firstItem) {
        this.loadedImages.delete(firstItem)
      }
    }
  }

  // 标记图片为加载失败
  markAsFailed(url: string): void {
    this.failedImages.add(url)
    this.loadedImages.delete(url) // 从成功列表移除
    
    // 限制大小
    if (this.failedImages.size > this.maxSize) {
      const firstItem = this.failedImages.values().next().value
      if (firstItem) {
        this.failedImages.delete(firstItem)
      }
    }
  }

  // 清除记录
  clear(): void {
    this.loadedImages.clear()
    this.failedImages.clear()
  }

  // 获取统计信息
  getStats() {
    return {
      loadedCount: this.loadedImages.size,
      failedCount: this.failedImages.size
    }
  }
}

const globalImageState = new GlobalImageStateManager()

interface OptimizedImageProps {
  src: string | null
  alt: string
  className?: string
  fallback?: React.ReactNode
  placeholder?: React.ReactNode
  onLoad?: () => void
  onError?: () => void
  priority?: 'high' | 'normal' | 'low'
  lazy?: boolean
  aspectRatio?: string
  objectFit?: 'cover' | 'contain' | 'fill' | 'none' | 'scale-down'
  retryCount?: number
  onRetry?: (retryAttempt: number) => Promise<string | null>
  showLoadingProgress?: boolean
  sizes?: string
  style?: React.CSSProperties
}

export interface OptimizedImageRef {
  reload: () => void
  getLoadState: () => 'idle' | 'loading' | 'loaded' | 'error'
}

/**
 * 🚀 全站通用优化图片组件
 * 
 * 特性：
 * - 🔄 懒加载 (Intersection Observer)
 * - 🚦 并发控制 (最大6个同时加载)
 * - 🎭 占位符和渐进加载
 * - 🛠️ 智能错误处理和重试
 * - ⚡ 优先级控制
 * - 📏 响应式尺寸
 * - 🎨 流畅动画效果
 */
const OptimizedImage = forwardRef<OptimizedImageRef, OptimizedImageProps>(
  ({
    src,
    alt,
    className = '',
    fallback,
    placeholder,
    onLoad,
    onError,
    priority = 'normal',
    lazy = true,
    aspectRatio,
    objectFit = 'cover',
    retryCount = 2,
    onRetry,
    showLoadingProgress = true,
    sizes,
    style,
    ...props
  }, ref) => {
    const [loadState, setLoadState] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle')
    const [currentSrc, setCurrentSrc] = useState<string | null>(src)
    const [retryAttempt, setRetryAttempt] = useState(0)
    const [loadProgress, setLoadProgress] = useState(0)
    // 🔑 关键修复：高优先级图片忽略懒加载，立即设置为可见
    const [isIntersecting, setIsIntersecting] = useState(!lazy || priority === 'high')
    
    const imgRef = useRef<HTMLImageElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const intersectionObserverRef = useRef<IntersectionObserver | null>(null)

    // 暴露给父组件的方法
    useImperativeHandle(ref, () => ({
      reload: () => {
        setRetryAttempt(0)
        setLoadState('idle')
        loadImage()
      },
      getLoadState: () => loadState
    }))

    // 懒加载 - Intersection Observer
    useEffect(() => {
      // 🔑 高优先级图片跳过懒加载
      if (!lazy || priority === 'high' || !containerRef.current) return

      const observerOptions = {
        root: null,
        rootMargin: getMobileRootMargin(), // 移动端使用更大的margin
        threshold: 0.1
      }

      intersectionObserverRef.current = new IntersectionObserver(
        (entries) => {
          const [entry] = entries
          if (entry.isIntersecting) {
            setIsIntersecting(true)
            intersectionObserverRef.current?.disconnect()
          }
        },
        observerOptions
      )

      intersectionObserverRef.current.observe(containerRef.current)

      return () => {
        intersectionObserverRef.current?.disconnect()
      }
    }, [lazy, priority])

    // 图片加载函数
    const loadImage = () => {
      if (!currentSrc || loadState === 'loading') return

      const loadFn = () => {
        setLoadState('loading')
        setLoadProgress(0)
        imageManager.startLoading()

        const img = new Image()
        
        // 🔧 关键修复：lazy={false}时，所有图片都eager加载
        if (lazy) {
          // 如果开启懒加载，按优先级设置
          if (priority === 'high') {
            img.fetchPriority = 'high'
            img.loading = 'eager'
          } else {
            img.loading = 'lazy'
          }
        } else {
          // 🚀 如果禁用懒加载，全部eager加载
          img.loading = 'eager'
          if (priority === 'high') {
            img.fetchPriority = 'high'
            img.decoding = 'sync'
          }
        }
        
        // 响应式尺寸
        if (sizes) {
          img.sizes = sizes
        }

        // 模拟加载进度 (现代浏览器暂不支持真实进度)
        let progressTimer: NodeJS.Timeout
        if (showLoadingProgress) {
          progressTimer = setInterval(() => {
            setLoadProgress(prev => Math.min(prev + Math.random() * 15, 90))
          }, 100)
        }

        img.onload = () => {
          if (progressTimer) clearInterval(progressTimer)
          setLoadProgress(100)
          
          setTimeout(() => {
            setLoadState('loaded')
            globalImageState.markAsLoaded(currentSrc) // 🚀 标记为已加载，下次直接使用
            imageManager.finishLoading()  // 触发队列中的下一张图片
            onLoad?.()
          }, 150) // 稍微延迟以显示完整动画
        }

        img.onerror = async () => {
          if (progressTimer) clearInterval(progressTimer)
          imageManager.finishLoading()  // 🔧 失败也要释放，让队列继续
          
          if (retryAttempt < retryCount) {
            setRetryAttempt(prev => prev + 1)
            
            // 如果有自定义重试逻辑
            if (onRetry) {
              try {
                const newSrc = await onRetry(retryAttempt + 1)
                if (newSrc && newSrc !== currentSrc) {
                  setCurrentSrc(newSrc)
                  return
                }
              } catch (error) {
                console.warn('Custom retry failed:', error)
              }
            }
            
            // 默认重试逻辑 - 添加时间戳避免缓存
            const retryDelay = Math.pow(2, retryAttempt) * 1000 // 指数退避
            setTimeout(() => {
              const retryUrl = currentSrc.includes('?') 
                ? `${currentSrc}&retry=${retryAttempt + 1}&t=${Date.now()}`
                : `${currentSrc}?retry=${retryAttempt + 1}&t=${Date.now()}`
              setCurrentSrc(retryUrl)
            }, retryDelay)
          } else {
            setLoadState('error')
            globalImageState.markAsFailed(currentSrc) // 🚀 标记为加载失败
            onError?.()
          }
        }

        img.src = currentSrc
      }

      // 如果有空位，直接加载；否则进入队列
      if (imageManager.canLoad()) {
        loadFn()
      } else {
        imageManager.addToQueue(loadFn, priority)
      }
    }

    // 开始加载图片
    useEffect(() => {
      // 🔍 如果已经是loaded状态，不需要再加载
      if (loadState === 'loaded' || loadState === 'loading') {
        return
      }
      
      if (isIntersecting && currentSrc && loadState === 'idle') {
        loadImage()
      }
    }, [isIntersecting, currentSrc, loadState])

    // 🚀 智能图片URL处理
    useEffect(() => {
      const handleSrcChange = async () => {
        if (!src) {
          setCurrentSrc(null)
          setLoadState('idle')
          return
        }

        // 重置状态
        setLoadState('idle')
        setRetryAttempt(0)
        setLoadProgress(0)

        // 🔍 检测是否是Notion图片API路径
        const notionImagePattern = /^\/api\/images\/notion\/([^\/]+)\/(.+)$/
        const match = src.match(notionImagePattern)

        if (match) {
          // 🚀 性能优化：优先使用原始 API URL，让浏览器 HTTP 缓存工作
          try {
            const [, type, id] = match
            // 确保ID中没有查询参数
            const cleanId = id.split('?')[0]
            
            // 🔑 关键优化：只检查 localStorage 缓存，不自动发起网络请求
            const { clientImageCache } = await import('@/lib/clientImageCache')
            const cachedUrl = clientImageCache.getCachedImageUrl(type, cleanId)
            
            if (cachedUrl) {
              // ✅ 使用缓存的 COS URL（已验证过的，直接用）
              setCurrentSrc(cachedUrl)
              if (globalImageState.isLoaded(cachedUrl)) {
                setLoadState('loaded')
                setLoadProgress(100)
              }
            } else {
              // 📡 缓存未命中：直接使用原始 API URL，让浏览器处理
              // 不调用 getOptimizedImageUrl，避免额外的网络请求延迟
              setCurrentSrc(src)
            }
          } catch (error) {
            console.warn('检查图片缓存失败，使用原始URL:', error)
            setCurrentSrc(src)
          }
        } else {
          // 普通图片
          setCurrentSrc(src)
          // 检查是否已加载
          if (globalImageState.isLoaded(src)) {
            setLoadState('loaded')
            setLoadProgress(100)
          }
        }
      }

      handleSrcChange()
    }, [src])

    // 🔧 检测是否为自适应模式（无固定高度）
    const isAutoHeight = aspectRatio === 'auto' && style?.height === 'auto'

    // 容器样式
    const containerStyle: React.CSSProperties = {
      aspectRatio: aspectRatio || 'auto',
      position: isAutoHeight ? 'relative' : 'relative', // 始终relative
      overflow: 'hidden',
      ...style, // 🔧 将自定义样式放在最后，允许覆盖默认样式
    }

    // 图片样式
    const imageStyle: React.CSSProperties = {
      width: '100%',
      height: isAutoHeight ? 'auto' : '100%', // 🔧 自适应模式下高度为auto
      objectFit: objectFit,
      transition: 'opacity 0.3s ease-in-out',
      display: 'block' // 防止图片底部留白
    }

    // 默认占位符
    const defaultPlaceholder = (
      <div className="absolute inset-0 bg-gradient-to-br from-gray-100 to-gray-200 flex items-center justify-center">
        <div className="text-gray-400 text-center">
          <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <div className="text-xs">图片加载中...</div>
        </div>
      </div>
    )

    // 默认错误显示
    const defaultFallback = (
      <div className="absolute inset-0 bg-gradient-to-br from-gray-200 to-gray-300 flex items-center justify-center">
        <div className="text-gray-500 text-center">
          <svg className="w-8 h-8 mx-auto mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <div className="text-xs">图片加载失败</div>
        </div>
      </div>
    )

    return (
      <div 
        ref={containerRef}
        className={`relative ${className}`}
        style={containerStyle}
        {...props}
      >
        <AnimatePresence mode="wait">
          {!currentSrc ? (
            // 没有图片源
            <motion.div
              key="no-src"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0"
            >
              {placeholder || defaultPlaceholder}
            </motion.div>
          ) : loadState === 'loaded' ? (
            // 🔧 加载成功 - 优先检查成功状态
            <motion.img
              key="loaded"
              ref={imgRef}
              src={currentSrc}
              alt={alt}
              style={imageStyle}
              initial={{ opacity: 0, scale: 1.05 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ 
                duration: 0.6,
                ease: [0.4, 0, 0.2, 1]
              }}
              className={isAutoHeight ? '' : 'absolute inset-0'}
            />
          ) : loadState === 'error' ? (
            // 🔧 确认失败 - 只有error状态才显示错误
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0"
            >
              {fallback || defaultFallback}
            </motion.div>
          ) : (
            // 🔧 加载中或idle状态 - 显示占位符
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0"
            >
              {placeholder || defaultPlaceholder}
              
              {/* 加载进度条 */}
              {showLoadingProgress && loadState === 'loading' && (
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-200">
                  <motion.div
                    className="h-full bg-blue-500"
                    initial={{ width: '0%' }}
                    animate={{ width: `${loadProgress}%` }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* 重试按钮 */}
        {loadState === 'error' && retryAttempt < retryCount && (
          <motion.button
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => {
              setLoadState('idle')
              loadImage()
            }}
            className="absolute bottom-2 right-2 px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
          >
            重试
          </motion.button>
        )}
      </div>
    )
  }
)

OptimizedImage.displayName = 'OptimizedImage'

// 导出全局状态管理器供调试使用
export { globalImageState, imageManager }

export default OptimizedImage
