import { NextResponse } from 'next/server'
import { warmupCache } from '@/lib/serverCache'
import { COSImageManager } from '@/lib/cos'
import { isAuthenticated, createUnauthorizedResponse } from '@/lib/auth'

// 🔧 强制动态渲染
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  // 🔐 认证检查
  if (!isAuthenticated(request)) {
    return createUnauthorizedResponse()
  }

  try {
    const startTime = Date.now()
    
    // 文本缓存预热
    console.log('🔄 开始预热文本缓存...')
    await warmupCache()
    
    // 图片缓存预热（通过获取所有类型的示例图片）
    console.log('🔄 开始预热图片缓存...')
    const imageWarmupResults = await warmupImageCache()
    
    const duration = Date.now() - startTime

    return NextResponse.json({
      success: true,
      message: '缓存预热完成',
      results: {
        textCache: '已预热文本缓存',
        imageCache: imageWarmupResults
      },
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Cache warmup failed',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

/**
 * 🚀 图片缓存预热（优化版：并发 + 超时控制）
 */
async function warmupImageCache() {
  try {
    // 获取所有数据来触发图片URL获取
    const { getMusicFromNotion, getMoviesFromNotion, getPhotosFromNotion, getProjects, getReflections, getReflectionById } = await import('@/lib/notion')
    
    const results = {
      music: 0,
      movies: 0,
      photos: 0,
      projects: 0,
      reflections: 0,
      skipped: 0,
      errors: [] as string[]
    }

    const startTime = Date.now()
    const MAX_DURATION = 50000 // 50秒，留10秒缓冲
    
    // 🔧 预热单个图片的辅助函数（带超时检查）
    const warmupImage = async (type: string, id: string, url: string): Promise<boolean> => {
      if (Date.now() - startTime > MAX_DURATION) {
        results.skipped++
        return false // 超时，跳过
      }
      
      try {
        await Promise.race([
          COSImageManager.getImageCOSUrl(type, id, url),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Single image timeout')), 10000) // 单张图片10秒超时
          )
        ])
        return true
      } catch (error) {
        // 单张失败不影响整体
        return false
      }
    }

    // 预热音乐封面（并发处理）
    try {
      const music = await getMusicFromNotion()
      const musicTasks = music.slice(0, 20).map(item => // 🔧 限制前20个
        item.coverUrl ? warmupImage('music', item.id, item.coverUrl) : Promise.resolve(false)
      )
      const musicResults = await Promise.all(musicTasks)
      results.music = musicResults.filter(r => r).length
    } catch (error) {
      results.errors.push(`Music: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    // 检查超时
    if (Date.now() - startTime > MAX_DURATION) {
      return { ...results, message: '部分预热完成（超时限制）' }
    }

    // 预热电影海报（并发处理）
    try {
      const movies = await getMoviesFromNotion()
      const movieTasks = movies.slice(0, 20).map(item => // 🔧 限制前20个
        item.posterUrl ? warmupImage('movie', item.id, item.posterUrl) : Promise.resolve(false)
      )
      const movieResults = await Promise.all(movieTasks)
      results.movies = movieResults.filter(r => r).length
    } catch (error) {
      results.errors.push(`Movies: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    // 检查超时
    if (Date.now() - startTime > MAX_DURATION) {
      return { ...results, message: '部分预热完成（超时限制）' }
    }

    // 预热照片（只预热第一张，详情页访问时再加载其他）
    try {
      const photos = await getPhotosFromNotion()
      const photoTasks = photos.slice(0, 30).map(item => { // 🔧 限制前30个
        const url = item.imageUrls?.[0] || item.imageUrl
        return url ? warmupImage('photo', item.id, url) : Promise.resolve(false)
      })
      const photoResults = await Promise.all(photoTasks)
      results.photos = photoResults.filter(r => r).length
    } catch (error) {
      results.errors.push(`Photos: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    // 检查超时
    if (Date.now() - startTime > MAX_DURATION) {
      return { ...results, message: '部分预热完成（超时限制）' }
    }

    // 预热项目图片（并发处理）
    try {
      const projects = await getProjects()
      const projectTasks = projects.slice(0, 20).map(item => // 🔧 限制前20个
        item.image ? warmupImage('project', item.id, item.image) : Promise.resolve(false)
      )
      const projectResults = await Promise.all(projectTasks)
      results.projects = projectResults.filter(r => r).length
    } catch (error) {
      results.errors.push(`Projects: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    // 检查超时
    if (Date.now() - startTime > MAX_DURATION) {
      return { ...results, message: '部分预热完成（超时限制）' }
    }

    // 🔥 预热反思文章的图片（关键！）
    try {
      const reflections = await getReflections()
      let reflectionImageCount = 0
      
      // 🔧 只预热前10篇文章的图片
      for (const reflection of reflections.slice(0, 10)) {
        if (Date.now() - startTime > MAX_DURATION) break
        
        try {
          // 获取文章详情（包含图片）
          const detail = await getReflectionById(reflection.id)
          if (!detail || !detail.content) continue
          
          // 从 Notion blocks 中提取图片
          const imageBlocks = detail.content.filter((block: any) => 
            block.type === 'image' && (block.image?.file?.url || block.image?.external?.url)
          )
          
          // 预热每张图片
          for (let imgIndex = 0; imgIndex < Math.min(imageBlocks.length, 5); imgIndex++) {
            if (Date.now() - startTime > MAX_DURATION) break
            
            const imageBlock = imageBlocks[imgIndex]
            const imageUrl = imageBlock.image?.file?.url || imageBlock.image?.external?.url
            if (imageUrl) {
              // 🔑 生成 imageId（与 NotionContent.tsx 完全一致）
              // 🔧 关键修复：必须包含 articleId 避免不同文章的图片缓存冲突
              const stableUrl = imageUrl.split('?')[0]
              const urlHash = Buffer.from(encodeURIComponent(stableUrl)).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 16)
              const articlePrefix = reflection.id.replace(/-/g, '').substring(0, 8)
              const imageId = `${articlePrefix}-${urlHash}-${imgIndex}`
              
              const success = await warmupImage('reflection-inline', imageId, imageUrl)
              if (success) reflectionImageCount++
            }
          }
        } catch (error) {
          // 单篇文章失败不影响整体
        }
      }
      
      results.reflections = reflectionImageCount
    } catch (error) {
      results.errors.push(`Reflections: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    return results
  } catch (error) {
    throw new Error(`图片预热失败: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}

// 支持GET方法
export async function GET(request: Request) {
  return POST(request)
}
