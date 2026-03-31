import { NextRequest, NextResponse } from 'next/server'
import { COSImageManager } from '@/lib/cos'

// 🔧 强制动态渲染，避免构建时超时
export const dynamic = 'force-dynamic'

/**
 * 🚀 图片代理API - 腾讯云COS永久缓存
 * 路径格式: /api/images/notion/{type}/{id}
 * 
 * 工作流程：
 * 1. 从Notion获取原始图片URL
 * 2. 检查COS是否已缓存该图片
 * 3. 如未缓存，下载图片并上传到COS
 * 4. 返回COS的永久URL（不会过期）
 * 
 * 支持 GET 和 POST 方法：
 * - GET: ?original=<encoded_url> (可能因 URL 太长被截断)
 * - POST: body { notionUrl: "<url>" } (推荐，避免截断)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  // 🔧 POST 方法：从请求体获取 Notion URL
  return handleImageRequest(request, params, 'POST')
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  // 🔧 GET 方法：从查询参数获取 Notion URL
  return handleImageRequest(request, params, 'GET')
}

async function handleImageRequest(
  request: NextRequest,
  params: Promise<{ path: string[] }>,
  method: 'GET' | 'POST'
) {
  try {
    const resolvedParams = await params
    const path = resolvedParams.path
    
    if (!path || path.length < 2) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 400 })
    }

    const [source, type, rawId] = path
    const id = rawId // 保持原始ID，不要移除索引
    
    if (source !== 'notion') {
      return NextResponse.json({ error: 'Unsupported source' }, { status: 400 })
    }

    console.log(`🖼️ 处理图片请求: ${type}/${id}`)

    // 🚀 第1步：优先检查COS缓存（性能优化：跳过Notion API调用）
    const { COSImageManager: COSManager } = await import('@/lib/cos')
    const cache = COSManager.getCacheData()
    const cacheKey = `${type}:${id}`
    const cachedEntry = cache?.[cacheKey]
    
    console.log(`🔍 缓存检查: ${cacheKey}`, {
      hasCacheData: !!cache,
      hasCacheEntry: !!cachedEntry,
      cosUrl: cachedEntry?.cosUrl || 'N/A'
    })

    // ✅ 缓存命中，直接返回COS URL（秒开）
    if (cachedEntry?.cosUrl) {
      console.log(`⚡ 缓存命中，直接返回COS URL: ${type}/${id}`)
      const response = NextResponse.redirect(cachedEntry.cosUrl, 302)
      
      const url = new URL(request.url)
      const hasVersionParam = url.searchParams.has('v') || url.searchParams.has('version')
      
      if (hasVersionParam) {
        response.headers.set('Cache-Control', 'public, max-age=3600, stale-while-revalidate=86400')
      } else {
        response.headers.set('Cache-Control', 'public, max-age=31536000, immutable')
      }
      
      response.headers.set('Access-Control-Allow-Origin', '*')
      response.headers.set('X-Cache-Source', 'tencent-cos-cache-fast')
      
      return response
    }

    // 📭 缓存未命中，先尝试直接从COS查找（避免重复处理）
    console.log(`📭 缓存未命中，尝试从COS查找: ${type}/${id}`)
    
    try {
      const { default: COS } = await import('cos-nodejs-sdk-v5')
      const cos = new COS({
        SecretId: process.env.TENCENT_SECRET_ID || '',
        SecretKey: process.env.TENCENT_SECRET_KEY || '',
      })
      
      const listResult = await cos.getBucket({
        Bucket: process.env.TENCENT_BUCKET || 'mypage-images-1313131901',
        Region: process.env.TENCENT_REGION || 'ap-shanghai',
        Prefix: `images/${type}/${id}-`,
        MaxKeys: 10
      })
      
      if (listResult.Contents && listResult.Contents.length > 0) {
        const existingKey = listResult.Contents[0].Key
        const cosUrl = `https://${process.env.TENCENT_BUCKET || 'mypage-images-1313131901'}.cos.${process.env.TENCENT_REGION || 'ap-shanghai'}.myqcloud.com/${existingKey}`
        console.log(`✅ COS存储桶找到图片，直接返回: ${existingKey}`)
        
        // 🔧 关键修复：将COS URL写入缓存，避免下次重复查询
        try {
          // 获取或创建一个临时的Notion URL（用于缓存键）
          const tempNotionUrl = `cached-from-cos-${Date.now()}`
          COSManager.updateCacheEntry(type, id, cosUrl, tempNotionUrl)
          console.log(`💾 已更新缓存: ${type}:${id} -> ${cosUrl}`)
        } catch (cacheUpdateError) {
          console.warn('⚠️ 更新缓存失败（不影响图片返回）:', cacheUpdateError)
        }
        
        // 返回302重定向到COS URL
        const response = NextResponse.redirect(cosUrl, 302)
        response.headers.set('Cache-Control', 'public, max-age=31536000, immutable')
        response.headers.set('Access-Control-Allow-Origin', '*')
        response.headers.set('X-Cache-Source', 'tencent-cos-bucket-lookup')
        
        return response
      }
      
      console.log(`📭 COS存储桶未找到，需要获取Notion图片`)
    } catch (cosError) {
      console.warn(`⚠️ COS查找失败:`, cosError)
    }
    
    // 🔧 COS未找到，获取Notion图片URL
    console.log(`📡 获取Notion URL: ${type}/${id}`)
    
    // 🔧 特殊处理：*-inline 类型从 POST 请求体或 GET 查询参数获取原始 URL
    let notionImageUrl: string | null = null
    const inlineTypes = ['reflection-inline', 'movie-inline', 'music-inline', 'project-inline']
    
    if (inlineTypes.includes(type)) {
      // 🚀 优先从 POST 请求体获取（避免 URL 长度限制）
      if (method === 'POST') {
        try {
          const body = await request.json()
          notionImageUrl = body.notionUrl
          console.log(`📬 ${type} POST 请求获取 URL:`, {
            id,
            urlLength: notionImageUrl?.length || 0,
            urlPreview: notionImageUrl ? notionImageUrl.substring(0, 100) + '...' : 'N/A'
          })
        } catch (jsonError) {
          console.error(`❌ 解析 POST 请求体失败:`, jsonError)
        }
      }
      
      // 🔄 如果 POST 没有获取到，尝试从 GET 查询参数获取
      if (!notionImageUrl && method === 'GET') {
        const url = new URL(request.url)
        notionImageUrl = url.searchParams.get('original')
        
        // 🔧 URL解码（防止双重编码问题）
        if (notionImageUrl) {
          try {
            notionImageUrl = decodeURIComponent(notionImageUrl)
          } catch (decodeError) {
            console.warn('URL解码失败，使用原始值:', decodeError)
          }
          
          console.log(`🖼️ ${type} GET 请求获取 URL:`, {
            id,
            originalLength: notionImageUrl.length,
            urlPreview: notionImageUrl.substring(0, 100) + '...'
          })
        }
      }
      
      if (!notionImageUrl) {
        console.error(`❌ ${type}缺少 URL 参数: ${request.url}`)
        return NextResponse.json({ 
          error: 'Missing Notion URL',
          hint: method === 'POST' 
            ? `${type} type requires POST body with { notionUrl: "<url>" }`
            : `${type} type requires ?original=<url> parameter`
        }, { status: 400 })
      }
    } else {
      notionImageUrl = await fetchImageUrlFromNotion(type, rawId)
    }
    
    if (!notionImageUrl) {
      console.error(`❌ 未找到图片URL: ${type}/${id}`)
      return NextResponse.json({ 
        error: 'Image not found',
        type,
        id: rawId
      }, { status: 404 })
    }

    // 📥 第2步：COS也没有，尝试代理Notion图片
    console.log(`📥 COS未找到，代理Notion图片: ${type}/${id}`)
    
    try {
      // 📥 COS未找到，尝试代理Notion图片流
      console.log(`📥 代理Notion图片: ${notionImageUrl.substring(0, 100)}`)
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 30000) // 30秒超时
      
      try {
        const imageResponse = await fetch(notionImageUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
            'Referer': 'https://www.notion.so/',
          },
          signal: controller.signal,
        })

        clearTimeout(timeout)

        if (!imageResponse.ok) {
          console.error(`❌ Notion图片获取失败: ${imageResponse.status} ${imageResponse.statusText}`)
          
          // 🔧 如果是 inline 类型且返回 403/410，说明 URL 已过期
          if (inlineTypes.includes(type) && (imageResponse.status === 403 || imageResponse.status === 410 || imageResponse.status === 404)) {
            console.warn(`⏰ Notion URL已过期，请前端重新获取内容`)
            return NextResponse.json({
              error: 'Notion URL expired',
              message: 'Please refresh the page to get new image URLs',
              status: 410
            }, { status: 410 })
          }
          
          throw new Error(`Failed to fetch image: ${imageResponse.status} ${imageResponse.statusText}`)
        }

      // 🖼️ 返回图片内容
      const imageBuffer = await imageResponse.arrayBuffer()
      
      // 🔧 智能检测Content-Type（不信任Notion返回的类型）
      let contentType = 'image/jpeg'; // 默认
      const notionContentType = imageResponse.headers.get('Content-Type') || '';
      
      // 检测实际文件类型（通过文件头）
      const uint8Array = new Uint8Array(imageBuffer);
      
      if (uint8Array.length > 4) {
        // PNG: 89 50 4E 47
        if (uint8Array[0] === 0x89 && uint8Array[1] === 0x50 && uint8Array[2] === 0x4E && uint8Array[3] === 0x47) {
          contentType = 'image/png';
        }
        // JPEG: FF D8 FF
        else if (uint8Array[0] === 0xFF && uint8Array[1] === 0xD8 && uint8Array[2] === 0xFF) {
          contentType = 'image/jpeg';
        }
        // WebP: RIFF ... WEBP
        else if (uint8Array[0] === 0x52 && uint8Array[1] === 0x49 && uint8Array[2] === 0x46 && uint8Array[3] === 0x46) {
          contentType = 'image/webp';
        }
        // GIF: 47 49 46
        else if (uint8Array[0] === 0x47 && uint8Array[1] === 0x49 && uint8Array[2] === 0x46) {
          contentType = 'image/gif';
        }
        // 如果检测失败，使用Notion的Content-Type（但排除heic）
        else if (notionContentType && !notionContentType.includes('heic') && !notionContentType.includes('heif')) {
          contentType = notionContentType;
        }
      }
      
      console.log(`📎 Content-Type: ${contentType} (Notion返回: ${notionContentType})`);
      
      const response = new NextResponse(imageBuffer, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
          'Access-Control-Allow-Origin': '*',
          'X-Cache-Source': 'notion-proxied',
          'X-Original-Content-Type': notionContentType,
        },
      })
      
        return response
      } catch (fetchError) {
        clearTimeout(timeout)
        throw fetchError
      }
    } catch (proxyError) {
      const errorMessage = proxyError instanceof Error ? proxyError.message : 'Unknown error'
      console.error(`❌ 代理图片失败: ${type}/${id}`, {
        error: errorMessage,
        notionUrl: notionImageUrl?.substring(0, 100),
        stack: proxyError instanceof Error ? proxyError.stack : undefined
      })
      
      // 🚀 关键改进：代理失败时，尝试从COS查找已存在的图片（终极fallback）
      console.log(`🔍 代理失败，尝试从COS查找已存在的图片: ${type}/${id}`)
      try {
        const { default: COS } = await import('cos-nodejs-sdk-v5')
        const cos = new COS({
          SecretId: process.env.TENCENT_SECRET_ID || '',
          SecretKey: process.env.TENCENT_SECRET_KEY || '',
        })
        
        const listResult = await cos.getBucket({
          Bucket: process.env.TENCENT_BUCKET || 'mypage-images-1313131901',
          Region: process.env.TENCENT_REGION || 'ap-shanghai',
          Prefix: `images/${type}/${id}-`,
          MaxKeys: 10
        })
        
        if (listResult.Contents && listResult.Contents.length > 0) {
          const existingKey = listResult.Contents[0].Key
          const cosUrl = `https://${process.env.TENCENT_BUCKET || 'mypage-images-1313131901'}.cos.${process.env.TENCENT_REGION || 'ap-shanghai'}.myqcloud.com/${existingKey}`
          console.log(`✅ 找到已存在的图片作为fallback: ${existingKey}`)
          
          // 更新缓存
          try {
            COSManager.updateCacheEntry(type, id, cosUrl, notionImageUrl || 'fallback')
          } catch (e) {
            console.warn('更新缓存失败（不影响图片返回）:', e)
          }
          
          // 返回302重定向到COS URL
          const response = NextResponse.redirect(cosUrl, 302)
          response.headers.set('Cache-Control', 'public, max-age=31536000, immutable')
          response.headers.set('Access-Control-Allow-Origin', '*')
          response.headers.set('X-Cache-Source', 'tencent-cos-fallback')
          
          return response
        }
      } catch (fallbackError) {
        console.warn(`⚠️ Fallback查找也失败:`, fallbackError)
      }
      
      // 🔧 如果是 inline 类型且是网络错误（URL 可能已过期）
      if (inlineTypes.includes(type) && (errorMessage.includes('fetch failed') || errorMessage.includes('timeout') || errorMessage.includes('403') || errorMessage.includes('410'))) {
        console.warn(`⏰ ${type} URL可能已过期: ${errorMessage}`)
        return NextResponse.json({
          error: 'Notion URL expired or network error',
          message: '图片URL已过期，请刷新页面获取新URL',
          type,
          id: rawId,
          status: 410
        }, { status: 410 })
      }
      
      // 🔧 返回更详细的错误信息
      return NextResponse.json({ 
        error: 'Failed to proxy image',
        message: errorMessage,
        type,
        id: rawId,
        hint: '图片获取失败，请稍后重试或刷新页面'
      }, { status: 500 })
    }
    
  } catch (error) {
    console.error('🔥 图片代理错误:', error)
    console.error('🔍 错误详情:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      requestPath: request.url,
      environment: process.env.VERCEL ? 'vercel' : 'local',
      cosConfig: {
        hasSecretId: !!process.env.TENCENT_SECRET_ID,
        hasSecretKey: !!process.env.TENCENT_SECRET_KEY,
        bucket: process.env.TENCENT_BUCKET,
        region: process.env.TENCENT_REGION
      }
    })
    
    return NextResponse.json({ 
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
      debug: process.env.NODE_ENV === 'development' ? {
        stack: error instanceof Error ? error.stack : undefined,
        environment: process.env.VERCEL ? 'vercel' : 'local'
      } : undefined
    }, { status: 500 })
  }
}

/**
 * 🚀 从Notion API获取图片URL（懒加载，只在缓存未命中时调用）
 */
async function fetchImageUrlFromNotion(type: string, rawId: string): Promise<string | null> {
  try {
    console.log(`🔄 从Notion获取图片: ${type}/${rawId}`)
    
    // 超时控制：防止Notion API调用过慢（减少超时时间以避免Vercel部署超时）
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('Notion API timeout')), 8000) // 8秒超时
    })
    
    const apiCall = async (): Promise<string | null> => {
      switch (type) {
          
        case 'project': {
          // 🚀 优化：直接从Notion获取单个项目，而不是整个列表
          const { getProjectById } = await import('@/lib/notion')
          const projectDetail = await getProjectById(rawId)
          return projectDetail?.image || null
        }
          
        case 'photo': {
          // 🚀 优化：直接从Notion获取单张照片，而不是整个列表
          const { getPhotoById } = await import('@/lib/notion')
          
          // 解析索引（支持多张图片）
          const indexMatch = rawId.match(/(.+)__idx(\d+)$/)
          const actualId = indexMatch ? indexMatch[1] : rawId
          
          // 直接获取单张照片
          const photo = await getPhotoById(actualId)
          
          if (!photo) return null
          
          // 如果有索引，返回对应索引的图片
          if (indexMatch && photo.imageUrls) {
            const imageIndex = parseInt(indexMatch[2], 10)
            
            // 🔧 修复：严格检查索引是否有效，避免错误的 fallback
            if (imageIndex < photo.imageUrls.length) {
              const imageUrl = photo.imageUrls[imageIndex]
              if (imageUrl) {
                return imageUrl
              }
            }
            
            // 索引无效时返回 null，而不是 fallback 到第一张
            console.warn(`⚠️ 照片索引超出范围: ${actualId}, index=${imageIndex}, total=${photo.imageUrls.length}`)
            return null
          }
          
          // 🔑 修复：没有索引时，优先使用 imageUrls[0]（更可靠）
          // imageUrl 可能为 null，但 imageUrls[0] 是从最新的文件列表获取的
          return photo.imageUrls?.[0] || photo.imageUrl || null
        }
          
        case 'music': {
          // 🚀 优化：直接从Notion获取单个页面，而不是整个列表
          const { getMusicById } = await import('@/lib/notion')
          const musicDetail = await getMusicById(rawId)
          return musicDetail?.coverUrl || null
        }

        case 'movie': {
          // 🚀 优化：直接从Notion获取单个页面，而不是整个列表  
          const { getMovieById } = await import('@/lib/notion')
          const movieDetail = await getMovieById(rawId)
          return movieDetail?.posterUrl || null
        }
        
        default:
          return null
      }
    }
    
    // 使用Promise.race实现超时控制
    const result = await Promise.race([apiCall(), timeoutPromise])
    
    if (result) {
      console.log(`✅ 成功获取图片URL: ${type}/${rawId}`)
    } else {
      console.warn(`⚠️ 未找到图片: ${type}/${rawId}`)
    }
    
    return result
    
  } catch (error) {
    console.error(`❌ Notion API调用失败 (${type}/${rawId}):`, error)
    return null
  }
}
