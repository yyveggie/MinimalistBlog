'use client'

import { useEffect, useState, useRef } from 'react'

interface NotionContentProps {
  htmlContent: string
  className?: string
  articleId?: string // 🔑 文章唯一标识，用于生成图片ID
  contentType?: 'reflection' | 'movie' | 'music' | 'project' // 🔑 内容类型，用于区分缓存（修复跨类型缓存冲突）
}

// 🚀 全局 blob URL 缓存（避免重复创建）
const blobUrlCache = new Map<string, string>()

/**
 * 增强版 Notion 内容组件
 * - 客户端渲染避免水合错误
 * - 自动优化 HTML 中的 <img> 标签
 * - 支持智能重试、懒加载和渐进动画
 * - 美观的错误处理和占位符
 */
export default function NotionContent({ htmlContent, className = '', articleId, contentType = 'reflection' }: NotionContentProps) {
  const [isClient, setIsClient] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const processedRef = useRef(false) // 🔧 防止重复处理图片

  useEffect(() => {
    setIsClient(true)
  }, [])

  // 🔄 重置处理标记当内容变化时
  useEffect(() => {
    processedRef.current = false
  }, [htmlContent, articleId])

  // 🔧 生成目录（Table of Contents）
  useEffect(() => {
    if (!isClient || !containerRef.current) return
    
    const container = containerRef.current
    const tocPlaceholder = container.querySelector('.notion-toc[data-toc="true"]') as HTMLElement | null
    
    if (tocPlaceholder) {
      // 1. 收集所有标题
      const headings = container.querySelectorAll('h1, h2, h3')
      
      if (headings.length > 0) {
        // 2. 为标题添加 id
        const tocItems: { level: number; text: string; id: string }[] = []
        
        headings.forEach((heading, index) => {
          const text = heading.textContent || ''
          const id = `heading-${index}-${text.toLowerCase().replace(/[^\w\u4e00-\u9fa5]+/g, '-')}`
          heading.id = id
          
          const level = parseInt(heading.tagName[1]) // h1 -> 1, h2 -> 2
          tocItems.push({ level, text, id })
        })
        
        // 3. 生成目录 HTML
        const tocHtml = `
          <nav class="notion-toc-nav" style="
            padding: 1.5rem 0;
            margin: 2rem 0;
          ">
            <div style="
              display: flex;
              align-items: center;
              margin-bottom: 1rem;
              padding-bottom: 0.75rem;
            ">
              <svg style="width: 18px; height: 18px; margin-right: 0.5rem; color: #9ca3af;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h7" />
              </svg>
              <h4 style="
                margin: 0;
                font-size: 0.875rem;
                font-weight: 500;
                color: #6b7280;
                font-family: var(--font-inter, sans-serif);
              ">目录</h4>
            </div>
            <ul style="
              list-style: none;
              padding: 0;
              margin: 0;
            ">
              ${tocItems.map(item => `
                <li style="
                  margin-left: ${(item.level - 1) * 1.5}rem;
                  margin-bottom: 0.5rem;
                ">
                  <a href="#${item.id}" style="
                    color: #6b7280;
                    text-decoration: none;
                    font-size: ${item.level === 1 ? '0.875rem' : '0.8125rem'};
                    font-weight: ${item.level === 1 ? '500' : '400'};
                    display: block;
                    padding: 0.25rem 0;
                    transition: all 0.2s ease;
                  " 
                  onmouseover="this.style.color='#374151';"
                  onmouseout="this.style.color='#6b7280';"
                  onclick="event.preventDefault(); document.getElementById('${item.id}').scrollIntoView({behavior: 'smooth', block: 'start'}); window.history.pushState(null, '', '#${item.id}');">
                    ${item.text}
                  </a>
                </li>
              `).join('')}
            </ul>
          </nav>
        `
        
        tocPlaceholder.innerHTML = tocHtml
      } else {
        // 没有标题，隐藏目录
        tocPlaceholder.style.display = 'none'
      }
    }
  }, [isClient, htmlContent])

  // 客户端图片优化处理
  useEffect(() => {
    if (!isClient || !containerRef.current || processedRef.current) return
    
    processedRef.current = true // 🔧 标记为已处理，防止重复执行

    const container = containerRef.current
    const images = container.querySelectorAll('img')

    // 🔑 只处理 Notion 图片，并维护独立的索引计数
    let notionImageIndex = 0
    
    images.forEach(async (img, index) => {
      // 创建 OptimizedImage 的容器
      const wrapper = document.createElement('div')
      wrapper.className = 'optimized-image-wrapper'
      wrapper.style.cssText = `
        display: inline-block;
        width: 100%;
        max-width: ${img.style.maxWidth || '100%'};
        border: 0 !important;
        outline: none !important;
        box-sizing: border-box !important;
      `
      
      // 获取原始属性
      let src = img.src
      const alt = img.alt || '图片'
      
      // 🔧 修复：检查是否是 Notion 图片，使用智能缓存
      if (src.includes('notion.so') || src.includes('s3.us-west') || src.includes('amazonaws.com')) {
        // 🔑 使用完整 URL 的 hash 作为唯一 ID，防止缓存冲突
        const originalSrc = src
        
        // 🔑 生成稳定的图片ID（移除URL中的时间戳和签名参数）
        // 关键：使用URL的核心部分（路径+文件名），忽略查询参数中的签名
        let stableUrl: string
        try {
          const urlObj = new URL(originalSrc)
          // 只使用pathname作为稳定标识（去除签名参数）
          stableUrl = urlObj.origin + urlObj.pathname
        } catch {
          // URL解析失败，使用原始URL
          stableUrl = originalSrc.split('?')[0] // 至少去掉查询参数
        }
        
        // 使用稳定URL生成hash
        let urlHash: string
        try {
          urlHash = btoa(encodeURIComponent(stableUrl)).replace(/[^a-zA-Z0-9]/g, '').substring(0, 16)
        } catch (hashError) {
          // 降级方案：使用简单hash
          urlHash = stableUrl.split('').reduce((hash, char) => {
            return ((hash << 5) - hash) + char.charCodeAt(0)
          }, 0).toString(36).substring(0, 16)
          console.warn('URL hash生成失败，使用降级方案:', hashError)
        }
        
        // 🔧 关键修复：必须包含 articleId 避免不同文章的图片缓存冲突！
        // 使用 articleId 的前8位 + urlHash + 索引，确保唯一性
        const articlePrefix = articleId ? articleId.replace(/-/g, '').substring(0, 8) : 'default'
        const imageId = `${articlePrefix}-${urlHash}-${notionImageIndex}`
        
        console.log(`🔑 生成图片ID:`, {
          index: notionImageIndex,
          imageId,
          stableUrl: stableUrl.substring(0, 80) + '...'
        })
        
        // 🔧 递增 Notion 图片索引
        notionImageIndex++
        
        try {
          // 🚀 优先使用 localStorage 缓存的 COS URL
          // 🔑 关键修复：根据内容类型使用不同的缓存键
          const imageType = `${contentType}-inline`
          const { clientImageCache } = await import('@/lib/clientImageCache')
          const cachedUrl = clientImageCache.getCachedImageUrl(imageType, imageId)
          
          if (cachedUrl) {
            // ✅ 使用缓存的 COS URL（秒开）
            src = cachedUrl
            console.log(`⚡ ${contentType}图片缓存命中: ${imageId}`)
          } else {
            // 🔍 检查 blob URL 缓存
            const cachedBlobUrl = blobUrlCache.get(imageId)
            if (cachedBlobUrl) {
              // ✅ 使用已缓存的 blob URL
              src = cachedBlobUrl
              console.log(`⚡ ${contentType}图片 blob 缓存命中: ${imageId}`)
            } else {
              // 📡 缓存未命中：使用 POST 请求获取图片
              // 🔧 修复：避免 GET 查询参数太长导致URL被截断
              console.log(`📭 ${contentType}图片缓存未命中，准备 POST 请求:`, {
                imageId,
                originalLength: originalSrc.length
              })
              
              // 使用 POST 请求获取图片，然后创建 blob URL
              try {
                const response = await fetch(`/api/images/notion/${imageType}/${imageId}`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({ notionUrl: originalSrc })
                })
                
                if (response.ok) {
                  const blob = await response.blob()
                  src = URL.createObjectURL(blob)
                  // 🚀 缓存 blob URL，避免重复创建
                  blobUrlCache.set(imageId, src)
                  console.log(`✅ ${contentType}图片通过 POST 获取成功并缓存: ${imageId}`)
                } else {
                  console.error(`❌ POST 请求失败，回退到 GET:`, await response.text())
                  // 降级方案：使用 GET 查询参数
                  const encodedOriginal = encodeURIComponent(originalSrc)
                  src = `/api/images/notion/${imageType}/${imageId}?original=${encodedOriginal}`
                }
              } catch (fetchError) {
                console.error('POST 请求出错，回退到 GET:', fetchError)
                // 降级方案：使用 GET 查询参数
                const encodedOriginal = encodeURIComponent(originalSrc)
                src = `/api/images/notion/${imageType}/${imageId}?original=${encodedOriginal}`
              }
            }
          }
        } catch (error) {
          console.error('❌ 获取图片缓存失败:', error)
          // 降级：使用 GET 查询参数（可能被截断）
          console.warn('⚠️ 降级到 GET 查询参数（可能因 URL 太长被截断）')
          const imageType = `${contentType}-inline`
          const encodedOriginal = encodeURIComponent(originalSrc)
          src = `/api/images/notion/${imageType}/${imageId}?original=${encodedOriginal}`
        }
      }
      
      // 替换原始 img
      img.parentNode?.replaceChild(wrapper, img)
      
      // 动态创建 React 组件需要通过这种方式
      const imageContainer = document.createElement('div')
      imageContainer.className = 'notion-image-container'
      imageContainer.style.cssText = `
        border: 0 !important;
        outline: none !important;
        box-sizing: border-box !important;
      `
      wrapper.appendChild(imageContainer)
      
      // 创建优化的图片元素
      const optimizedImg = document.createElement('img')
      optimizedImg.alt = alt
      optimizedImg.className = 'notion-optimized-image'
      optimizedImg.style.cssText = `
        width: 100%;
        height: auto;
        margin: 2rem auto;
        display: block;
        max-width: 100%;
        transition: opacity 0.3s ease-in-out;
        border: 0 !important;
        outline: none !important;
        border-radius: 0.5rem;
        box-sizing: border-box !important;
      `
      
      // 🔑 关键：保存原始 URL，避免闭包问题
      optimizedImg.dataset.originalSrc = src
      
      // 添加加载状态
      optimizedImg.style.opacity = '0'
      
      // 加载完成处理
      optimizedImg.onload = () => {
        console.log(`✅ 反思图片加载成功: ${optimizedImg.src}`)
        optimizedImg.style.opacity = '1'
        
        // 🧹 清除加载提示（如果存在）
        const loadingHint = imageContainer.querySelector('.image-loading-hint')
        if (loadingHint) {
          loadingHint.remove()
        }
      }
      
      // 🔧 增强的错误处理 - 详细日志 + 多次重试 + 智能降级
      optimizedImg.onerror = () => {
        const currentAttempt = parseInt(optimizedImg.dataset.retryAttempt || '0', 10)
        const originalUrl = optimizedImg.dataset.originalSrc || src
        
        console.error(`❌ 反思图片加载失败 (尝试 ${currentAttempt + 1}/5):`, {
          url: optimizedImg.src,
          originalUrl: originalUrl.substring(0, 100),
          attempt: currentAttempt + 1
        })
        
        // 🚀 增加重试次数到5次，延长等待时间
        if (currentAttempt < 4) {
          // 继续重试
          optimizedImg.dataset.retryAttempt = String(currentAttempt + 1)
          const separator = originalUrl.includes('?') ? '&' : '?'
          const retryUrl = `${originalUrl}${separator}retry=${currentAttempt + 1}&t=${Date.now()}`
          
          // 🔑 根据重试次数调整延迟：第一次等待更长时间（可能在处理中）
          const delays = [5000, 3000, 2000, 1000] // 5s, 3s, 2s, 1s
          const delay = delays[currentAttempt] || 1000
          
          console.log(`🔄 重试反思图片 (${currentAttempt + 1}/5)，等待${delay/1000}秒:`, retryUrl.substring(0, 150))
          
          // 🎨 显示加载中提示
          if (currentAttempt === 0) {
            const loadingHint = document.createElement('div')
            loadingHint.className = 'image-loading-hint'
            loadingHint.style.cssText = `
              text-align: center;
              padding: 1rem;
              color: #6b7280;
              font-size: 0.875rem;
              margin: 1rem 0;
            `
            loadingHint.innerHTML = `
              <div style="display: inline-block;">
                <svg style="width: 24px; height: 24px; margin: 0 auto; animation: spin 1s linear infinite;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <div style="margin-top: 0.5rem;">图片处理中，请稍候...</div>
              </div>
              <style>
                @keyframes spin {
                  from { transform: rotate(0deg); }
                  to { transform: rotate(360deg); }
                }
              </style>
            `
            imageContainer.insertBefore(loadingHint, optimizedImg)
            optimizedImg.dataset.loadingHintId = 'added'
          }
          
          setTimeout(() => {
            // 移除加载提示
            const loadingHint = imageContainer.querySelector('.image-loading-hint')
            if (loadingHint) {
              loadingHint.remove()
            }
            optimizedImg.src = retryUrl
          }, delay)
        } else {
          // 所有重试都失败，显示错误占位符
          console.error(`💀 反思图片彻底失败:`, {
            url: optimizedImg.src,
            originalUrl: originalUrl.substring(0, 100),
            totalAttempts: currentAttempt + 1
          })
          optimizedImg.style.display = 'none'
          const placeholder = document.createElement('div')
          placeholder.className = 'image-error-placeholder'
          placeholder.style.cssText = `
            background: linear-gradient(45deg, #fee2e2, #fecaca);
            border: 2px dashed #ef4444;
            border-radius: 8px;
            padding: 2rem;
            text-align: center;
            color: #dc2626;
            margin: 2rem auto;
            max-width: 500px;
          `
          placeholder.innerHTML = `
            <svg style="width: 48px; height: 48px; margin: 0 auto 1rem; color: #ef4444;" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div style="font-weight: 600; margin-bottom: 0.5rem;">图片加载失败</div>
            <div style="font-size: 0.875rem; color: #991b1b; margin-bottom: 0.5rem;">已重试 5 次，请检查网络或刷新页面</div>
            <div style="font-size: 0.75rem; color: #991b1b; font-family: monospace; word-break: break-all; margin-bottom: 1rem; padding: 0.5rem; background: rgba(255,255,255,0.5); border-radius: 4px;">
              URL: ${optimizedImg.src.substring(0, 80)}...
            </div>
            <button 
              onclick="location.reload()" 
              style="margin-top: 0.5rem; padding: 0.5rem 1rem; background: #ef4444; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 0.875rem;"
            >
              刷新页面
            </button>
          `
          imageContainer.appendChild(placeholder)
        }
      }
      
      // 🚀 设置 src，开始加载
      console.log(`📸 开始加载反思图片: ${src}`)
      optimizedImg.src = src
      
      // 添加懒加载
      if (index > 2) { // 前3张图片立即加载
        optimizedImg.loading = 'lazy'
      }
      
      imageContainer.appendChild(optimizedImg)
    })
  }, [isClient, htmlContent])

  // 服务端渲染时显示加载占位符
  if (!isClient) {
    return (
      <div className={`${className} animate-pulse`}>
        <div className="h-4 bg-gray-200 rounded mb-4"></div>
        <div className="h-4 bg-gray-200 rounded mb-4 w-3/4"></div>
        <div className="h-4 bg-gray-200 rounded mb-4 w-1/2"></div>
      </div>
    )
  }

  // 客户端渲染时显示实际内容
  return (
    <div 
      ref={containerRef}
      className={className}
      dangerouslySetInnerHTML={{ __html: htmlContent }}
    />
  )
}
