import COS from 'cos-nodejs-sdk-v5'
import { createHash } from 'crypto'
import fs from 'fs'
import path from 'path'

// 🔧 环境变量验证
function validateCOSConfig() {
  const errors: string[] = []
  
  if (!process.env.TENCENT_SECRET_ID) {
    errors.push('TENCENT_SECRET_ID is required')
  }
  if (!process.env.TENCENT_SECRET_KEY) {
    errors.push('TENCENT_SECRET_KEY is required')
  }
  if (!process.env.TENCENT_BUCKET) {
    console.warn('⚠️ TENCENT_BUCKET not set, using default: mypage-images-1313131901')
  }
  if (!process.env.TENCENT_REGION) {
    console.warn('⚠️ TENCENT_REGION not set, using default: ap-shanghai')
  }
  
  if (errors.length > 0) {
    console.error('❌ COS配置错误:')
    errors.forEach(error => console.error(`  - ${error}`))
    console.error('请在.env.local中设置正确的腾讯云COS配置')
    return false
  }
  
  console.log('✅ COS配置验证通过')
  return true
}

// 验证配置（只在服务端运行）
const isValidConfig = typeof process !== 'undefined' ? validateCOSConfig() : true

// 腾讯云COS配置
const cosConfig = {
  SecretId: process.env.TENCENT_SECRET_ID || '',
  SecretKey: process.env.TENCENT_SECRET_KEY || '',
  Region: process.env.TENCENT_REGION || 'ap-shanghai',
}

const Bucket = process.env.TENCENT_BUCKET || 'mypage-images-1313131901'

// 只在配置有效时创建COS实例
const cos = isValidConfig ? new COS(cosConfig) : null

// 本地缓存文件路径 - Vercel兼容性改进
// 🔧 修复：Vercel环境优先从public读取静态缓存，写入到/tmp
export const CACHE_FILE_PATH = process.env.VERCEL 
  ? '/tmp/cos-cache.json' // Vercel环境写入临时目录
  : path.join(process.cwd(), 'public', 'cos-cache.json')

// Vercel环境下的静态缓存备份路径
export const STATIC_CACHE_PATH = path.join(process.cwd(), 'public', 'cos-cache.json')

interface CacheEntry {
  cosUrl: string
  notionUrl: string
  lastUpdated: string
}

interface CacheData {
  [key: string]: CacheEntry // key格式: type:id
}

/**
 * 🚀 腾讯云COS图片管理器
 * 实现智能缓存 + Notion更新检测 + COS永久存储
 */
export class COSImageManager {
  // 🚀 新增：内存缓存层（减少文件系统读写）
  private static memoryCache: CacheData | null = null
  private static memoryCacheTimestamp: number = 0
  private static readonly MEMORY_CACHE_TTL = 5 * 60 * 1000 // 5分钟内存缓存有效期
  
  // 🚀 新增：并发控制（防止重复上传）
  private static processingImages: Map<string, Promise<string>> = new Map()
  
  /**
   * 🗂️ 读取本地缓存文件（带内存缓存层）
   */
  private static readCache(): CacheData {
    const now = Date.now()
    
    // 🚀 优先使用内存缓存（5分钟内有效）
    if (this.memoryCache && (now - this.memoryCacheTimestamp) < this.MEMORY_CACHE_TTL) {
      console.log(`⚡ 使用内存缓存，条目数: ${Object.keys(this.memoryCache).length}`)
      return this.memoryCache
    }
    
    // 内存缓存失效，从文件读取并更新内存缓存
    const fileCache = this.readFileCache()
    this.memoryCache = fileCache
    this.memoryCacheTimestamp = now
    console.log(`📖 从文件读取并更新内存缓存，条目数: ${Object.keys(fileCache).length}`)
    
    return fileCache
  }

  /**
   * 📖 公共方法：读取COS缓存（供API使用）
   */
  public static getCacheData(): CacheData {
    return this.readCache()
  }

  /**
   * 🗂️ 读取文件缓存（不含内存缓存逻辑）
   * 🔧 修复：优先从/tmp读取，不存在则从public读取静态缓存
   */
  private static readFileCache(): CacheData {
    try {
      // 🚀 Vercel环境优化：优先从静态文件读取，避免/tmp清空问题
      if (process.env.VERCEL) {
        // 第1优先级：尝试从/tmp读取（可能由之前的请求写入）
        if (fs.existsSync(CACHE_FILE_PATH)) {
          try {
            const data = fs.readFileSync(CACHE_FILE_PATH, 'utf-8')
            const cache = JSON.parse(data) || {}
            console.log(`📖 从/tmp读取缓存，条目数: ${Object.keys(cache).length}`)
            return cache
          } catch (tmpError) {
            console.warn('读取/tmp缓存失败，尝试静态缓存:', tmpError)
          }
        }
        
        // 第2优先级：从public静态文件读取（构建时的缓存快照）
        if (fs.existsSync(STATIC_CACHE_PATH)) {
          try {
            const data = fs.readFileSync(STATIC_CACHE_PATH, 'utf-8')
            const cache = JSON.parse(data) || {}
            console.log(`📖 从public读取静态缓存，条目数: ${Object.keys(cache).length}`)
            
            // 尝试将静态缓存复制到/tmp，供后续请求使用
            try {
              const dir = path.dirname(CACHE_FILE_PATH)
              if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true })
              }
              fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(cache, null, 2))
              console.log(`✅ 已将静态缓存复制到/tmp`)
            } catch (copyError) {
              console.warn('复制到/tmp失败（不影响读取）:', copyError)
            }
            
            return cache
          } catch (staticError) {
            console.warn('读取静态缓存失败:', staticError)
          }
        }
        
        console.warn('⚠️ Vercel环境：未找到任何缓存文件')
        return {}
      }
      
      // 本地开发环境：直接从public读取
      if (!fs.existsSync(CACHE_FILE_PATH)) {
        const dir = path.dirname(CACHE_FILE_PATH)
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true })
        }
        return {}
      }
      
      const data = fs.readFileSync(CACHE_FILE_PATH, 'utf-8')
      const cache = JSON.parse(data) || {}
      return cache
    } catch (error) {
      console.error('❌ 读取COS缓存文件失败:', error)
      return {}
    }
  }

  /**
   * 💾 写入本地缓存文件（同时更新内存缓存）
   */
  private static writeCache(cache: CacheData): void {
    // 🚀 关键优化：立即更新内存缓存（即使文件写入失败）
    this.memoryCache = cache
    this.memoryCacheTimestamp = Date.now()
    console.log(`💾 已更新内存缓存，条目数: ${Object.keys(cache).length}`)
    
    try {
      const dir = path.dirname(CACHE_FILE_PATH)
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true })
      }
      
      fs.writeFileSync(CACHE_FILE_PATH, JSON.stringify(cache, null, 2), 'utf-8')
      console.log(`💾 已写入文件缓存: ${CACHE_FILE_PATH}`)
    } catch (error) {
      // Vercel环境下文件系统只读，这是正常的，不需要警告
      if (process.env.VERCEL && (error as any)?.code === 'EROFS') {
        console.log('🔧 Vercel环境：仅使用内存缓存（文件系统只读）')
      } else {
        console.warn('⚠️ 写入COS缓存文件失败（已保存到内存）:', error)
      }
    }
  }

  /**
   * 🔍 获取缓存的COS URL（如果存在且未过期）
   * 🔧 修复：不再验证 Notion URL，因为 Notion URL 签名每次都不同
   * - COS URL 是永久的，只要存在就可以使用
   * - Notion URL 的签名参数会变化，但图片内容未必变化
   */
  private static getCachedUrl(type: string, id: string, currentNotionUrl?: string): string | null {
    const cache = this.readCache()
    const cacheKey = `${type}:${id}`
    const entry = cache[cacheKey]
    
    if (!entry) {
      console.log(`📭 无缓存: ${cacheKey}`)
      return null
    }
    
    // 🔧 关键修复：不再验证 Notion URL 是否变化
    // 原因：Notion URL 包含时间戳签名，每次获取都不同，但图片内容可能相同
    // 如果用户确实更新了图片，应该通过其他机制清除缓存（如手动清除或版本号）
    
    console.log(`✅ 缓存命中: ${cacheKey} -> ${entry.cosUrl}`)
    return entry.cosUrl
  }

  /**
   * 📝 更新缓存条目（私有方法）
   */
  private static updateCache(type: string, id: string, cosUrl: string, notionUrl: string): void {
    const cache = this.readCache()
    const cacheKey = `${type}:${id}`
    
    cache[cacheKey] = {
      cosUrl,
      notionUrl,
      lastUpdated: new Date().toISOString()
    }
    
    this.writeCache(cache)
    console.log(`💾 已更新缓存: ${cacheKey}`)
  }

  /**
   * 📝 更新缓存条目（公共方法，供API使用）
   */
  public static updateCacheEntry(type: string, id: string, cosUrl: string, notionUrl: string): void {
    this.updateCache(type, id, cosUrl, notionUrl)
  }

  /**
   * 生成图片在COS中的键名（使用稳定的URL标识）
   * 🔧 修复：移除URL中的时间戳和签名参数，使用稳定的URL核心部分
   */
  private static generateImageKey(type: string, id: string, originalUrl: string): string {
    // 从URL中提取文件扩展名
    const urlWithoutParams = originalUrl.split('?')[0]
    const extension = urlWithoutParams.split('.').pop()?.toLowerCase() || 'jpg'
    
    // 🔑 关键修复：使用URL的核心部分生成hash（去除签名参数）
    // Notion URL包含时间戳签名（X-Amz-Date, X-Amz-Signature等），每次都不同
    // 我们只需要pathname部分来确保稳定性
    let stableUrlPart: string
    try {
      const urlObj = new URL(originalUrl)
      // 使用origin + pathname作为稳定标识
      stableUrlPart = urlObj.origin + urlObj.pathname
    } catch {
      // URL解析失败，降级到去除查询参数
      stableUrlPart = urlWithoutParams
    }
    
    const urlHash = createHash('md5').update(stableUrlPart).digest('hex').substring(0, 8)
    
    // 键名格式：类型/ID-hash.扩展名
    // 例如：images/reflection-inline/abc123-a1b2c3d4.jpg
    return `images/${type}/${id}-${urlHash}.${extension}`
  }

  /**
   * 检查图片是否已存在于COS
   */
  private static async checkImageExists(key: string): Promise<boolean> {
    if (!cos) {
      throw new Error('COS未正确配置，请检查环境变量')
    }
    
    try {
      await cos.headObject({
        Bucket,
        Region: cosConfig.Region,
        Key: key,
      })
      return true
    } catch (error: any) {
      if (error.statusCode === 404) {
        return false
      }
      throw error
    }
  }

  /**
   * 从URL下载图片数据（带URL过期检测和重试）
   */
  private static async downloadImage(url: string): Promise<Buffer> {
    console.log(`📥 正在下载图片: ${url}`)
    
    // 🔍 检查URL是否是过期的Notion AWS S3 URL
    if (url.includes('amazonaws.com') && url.includes('X-Amz-Expires')) {
      const urlObj = new URL(url)
      const expires = urlObj.searchParams.get('X-Amz-Expires')
      const date = urlObj.searchParams.get('X-Amz-Date')
      
      if (expires && date) {
        const expiryTime = new Date(date).getTime() + parseInt(expires) * 1000
        const now = Date.now()
        
        if (now > expiryTime) {
          console.warn(`⚠️ Notion图片URL已过期: ${url.substring(0, 100)}...`)
          throw new Error('Notion图片URL已过期，需要重新获取')
        }
      }
    }
    
    // ⏱️ 下载超时控制（45秒，大图片需要更长时间）
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 45000)
    
    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
          'Referer': 'https://www.notion.so/',
        },
        signal: controller.signal,
      })
      
      if (!response.ok) {
        if (response.status === 403) {
          console.warn(`🔒 403 Forbidden - Notion图片URL可能已过期: ${url.substring(0, 100)}...`)
          throw new Error('Notion图片URL已过期或无权限访问，需要重新获取')
        }
        throw new Error(`下载图片失败: ${response.status} ${response.statusText}`)
      }
      
      const arrayBuffer = await response.arrayBuffer()
      return Buffer.from(arrayBuffer)
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('下载图片超时（45秒）')
      }
      throw error
    } finally {
      clearTimeout(timeout)
    }
  }

  /**
   * 上传图片到COS
   */
  private static async uploadImageToCOS(key: string, imageBuffer: Buffer, contentType: string): Promise<string> {
    if (!cos) {
      throw new Error('COS未正确配置，请检查环境变量')
    }
    
    console.log(`📤 正在上传图片到COS: ${key} (${(imageBuffer.length / 1024 / 1024).toFixed(2)}MB)`)
    
    // ⏱️ 上传超时控制（60秒，大图片上传需要更长时间）
    const uploadPromise = cos.putObject({
      Bucket,
      Region: cosConfig.Region,
      Key: key,
      Body: imageBuffer,
      ContentType: contentType,
      CacheControl: 'public, max-age=31536000', // 1年缓存
    })
    
    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => reject(new Error('上传COS超时（60秒）')), 60000)
    })
    
    await Promise.race([uploadPromise, timeoutPromise])
    
    // 生成公开访问URL
    const cosUrl = `https://${Bucket}.cos.${cosConfig.Region}.myqcloud.com/${key}`
    console.log(`✅ 图片上传成功: ${cosUrl}`)
    
    return cosUrl
  }

  /**
   * 根据URL判断Content-Type
   */
  private static getContentTypeFromUrl(url: string): string {
    const extension = url.split('?')[0].split('.').pop()?.toLowerCase()
    
    switch (extension) {
      case 'jpg':
      case 'jpeg':
        return 'image/jpeg'
      case 'png':
        return 'image/png'
      case 'gif':
        return 'image/gif'
      case 'webp':
        return 'image/webp'
      default:
        return 'image/jpeg'
    }
  }

  /**
   * 🚀 主方法：获取图片的COS永久URL
   * 智能缓存策略：本地缓存 + Notion更新检测 + COS存储
   * 
   * 🔑 关键改进：使用URL hash生成唯一COS键名
   * - 不同的Notion图片URL会生成不同的COS键名
   * - 更新图片时自动使用新键名，无需删除旧文件
   */
  static async getImageCOSUrl(
    type: string, 
    id: string, 
    notionImageUrlOrFetcher: string | (() => Promise<string | null>)
  ): Promise<string> {
    const cacheKey = `${type}:${id}`
    
    // 🚀 并发控制：检查是否正在处理同一个图片
    const existingProcess = this.processingImages.get(cacheKey)
    if (existingProcess) {
      console.log(`⏳ 图片正在处理中，等待结果: ${cacheKey}`)
      try {
        return await existingProcess
      } catch (error) {
        console.warn(`⚠️ 等待处理失败，重新尝试: ${cacheKey}`)
        // 如果等待失败，继续执行正常流程
      }
    }
    
    // 创建处理Promise并存储
    const processPromise = this._processImage(type, id, notionImageUrlOrFetcher, cacheKey)
    this.processingImages.set(cacheKey, processPromise)
    
    try {
      const result = await processPromise
      return result
    } finally {
      // 处理完成后移除（30秒后移除，防止短时间内重复请求）
      setTimeout(() => {
        this.processingImages.delete(cacheKey)
      }, 30000)
    }
  }
  
  /**
   * 🔧 内部方法：实际处理图片获取逻辑
   */
  private static async _processImage(
    type: string,
    id: string,
    notionImageUrlOrFetcher: string | (() => Promise<string | null>),
    cacheKey: string
  ): Promise<string> {
    try {
      // 🔍 第1步：先检查本地缓存文件
      const cache = this.readCache()
      const entry = cache[cacheKey]
      
      if (entry) {
        // 缓存命中，直接返回COS URL（不需要验证Notion URL）
        console.log(`✅ 缓存命中: ${cacheKey} -> ${entry.cosUrl}`)
        return entry.cosUrl
      }
      
      console.log(`📭 缓存未命中: ${cacheKey}，准备从Notion获取`)
      
      // 📡 第2步：缓存未命中，获取Notion图片URL（带超时保护）
      let notionImageUrl: string
      
      if (typeof notionImageUrlOrFetcher === 'string') {
        notionImageUrl = notionImageUrlOrFetcher
      } else {
        // 懒加载：只在必要时调用Notion API（30秒超时）
        console.log(`🔄 调用Notion API获取图片URL: ${type}/${id}`)
        
        const timeoutPromise = new Promise<never>((_, reject) => {
          setTimeout(() => reject(new Error(`Notion API超时: ${type}/${id}`)), 30000)
        })
        
        try {
          const fetchedUrl = await Promise.race([
            notionImageUrlOrFetcher(),
            timeoutPromise
          ])
          
          if (!fetchedUrl) {
            throw new Error(`Notion API未返回图片URL: ${type}/${id}`)
          }
          notionImageUrl = fetchedUrl
        } catch (error) {
          console.error(`❌ 获取Notion图片URL失败: ${type}/${id}`, error)
          throw error
        }
      }
      
      // 📦 第3步：生成COS键名（包含URL hash，确保唯一性）
      const imageKey = this.generateImageKey(type, id, notionImageUrl)
      
      // 🔍 第4步：检查COS是否已有该图片
      const exists = await this.checkImageExists(imageKey)
      
      if (exists) {
        // COS中已有图片，直接使用
        const cosUrl = `https://${Bucket}.cos.${cosConfig.Region}.myqcloud.com/${imageKey}`
        this.updateCache(type, id, cosUrl, notionImageUrl)
        console.log(`✅ COS已存在，更新缓存: ${type}/${id}`)
        return cosUrl
      }
      
      // 🔍 第4.5步：尝试查找COS中是否有相同ID前缀的图片（兼容旧hash算法）
      try {
        const listResult = await cos!.getBucket({
          Bucket,
          Region: cosConfig.Region,
          Prefix: `images/${type}/${id}-`,
          MaxKeys: 10
        })
        
        if (listResult.Contents && listResult.Contents.length > 0) {
          // 找到了匹配的图片，使用第一个
          const existingKey = listResult.Contents[0].Key
          const cosUrl = `https://${Bucket}.cos.${cosConfig.Region}.myqcloud.com/${existingKey}`
          this.updateCache(type, id, cosUrl, notionImageUrl)
          console.log(`✅ 找到已存在的图片（旧hash）: ${existingKey}`)
          return cosUrl
        }
      } catch (listError) {
        console.warn(`⚠️ 查找已存在图片失败:`, listError)
        // 继续执行上传流程
      }
      
      // 📥 第5步：图片不存在，下载并上传到COS
      console.log(`🔄 下载并上传图片到COS: ${type}/${id}`)
      
      try {
        // ⚡ 快速失败策略：整个流程最多120秒（下载45秒 + 上传60秒 + 缓冲15秒）
        const uploadWithTimeout = Promise.race([
          (async () => {
            const imageBuffer = await this.downloadImage(notionImageUrl)
            const contentType = this.getContentTypeFromUrl(notionImageUrl)
            return await this.uploadImageToCOS(imageKey, imageBuffer, contentType)
          })(),
          new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('图片处理总超时（120秒）')), 120000)
          })
        ])
        
        const cosUrl = await uploadWithTimeout
        
        // 💾 第6步：更新本地缓存
        this.updateCache(type, id, cosUrl, notionImageUrl)
        
        console.log(`🎉 图片上传成功: ${type}/${id} -> ${imageKey}`)
        return cosUrl
      } catch (downloadError) {
        if (downloadError instanceof Error && downloadError.message.includes('过期')) {
          // URL过期，清除缓存
          const cache = this.readCache()
          delete cache[cacheKey]
          this.writeCache(cache)
          console.log(`🗑️ 已删除过期缓存: ${cacheKey}`)
        }
        
        // 🔍 关键修复：下载失败时，再次尝试从COS查找已存在的图片
        console.warn(`⚠️ COS上传失败: ${type}/${id}`, downloadError)
        console.log(`🔍 尝试从COS查找已存在的图片...`)
        
        try {
          const listResult = await cos!.getBucket({
            Bucket,
            Region: cosConfig.Region,
            Prefix: `images/${type}/${id}-`,
            MaxKeys: 10
          })
          
          if (listResult.Contents && listResult.Contents.length > 0) {
            // 找到了已存在的图片
            const existingKey = listResult.Contents[0].Key
            const cosUrl = `https://${Bucket}.cos.${cosConfig.Region}.myqcloud.com/${existingKey}`
            
            // 即使Notion URL不同，也更新缓存（因为图片内容应该是一样的）
            this.updateCache(type, id, cosUrl, notionImageUrl)
            
            console.log(`✅ 下载失败但找到已存在的图片: ${existingKey}`)
            return cosUrl
          }
        } catch (fallbackError) {
          console.error(`❌ Fallback查找也失败:`, fallbackError)
        }
        
        // ⚡ 最后的fallback：返回Notion原始URL（可能已过期，但总比没有好）
        console.warn(`⚠️ 返回Notion原始URL作为最后fallback: ${type}/${id}`)
        return notionImageUrl
      }
      
    } catch (error) {
      console.error(`❌ COS处理失败 (${type}/${id}):`, error)
      
      // 失败时的fallback逻辑
      if (typeof notionImageUrlOrFetcher === 'string') {
        return notionImageUrlOrFetcher
      } else {
        try {
          const fallbackUrl = await notionImageUrlOrFetcher()
          return fallbackUrl || '/images/fallback.jpg'
        } catch (fallbackError) {
          console.error(`Fallback失败:`, fallbackError)
          return '/images/fallback.jpg'
        }
      }
    }
  }

  /**
   * 🗑️ 删除COS中的图片（可选）
   */
  static async deleteImage(type: string, id: string, originalUrl: string): Promise<boolean> {
    if (!cos) {
      throw new Error('COS未正确配置，请检查环境变量')
    }
    
    try {
      const imageKey = this.generateImageKey(type, id, originalUrl)
      
      await cos.deleteObject({
        Bucket,
        Region: cosConfig.Region,
        Key: imageKey,
      })
      
      console.log(`🗑️ 已删除COS图片: ${imageKey}`)
      return true
    } catch (error) {
      console.error(`❌ 删除COS图片失败:`, error)
      return false
    }
  }

  /**
   * 📊 获取缓存统计信息
   */
  static getCacheStats(): any {
    try {
      const cache = this.readCache()
      const entries = Object.entries(cache)
      
      const stats = {
        totalCached: entries.length,
        byType: {} as { [key: string]: number },
        oldestEntry: null as string | null,
        newestEntry: null as string | null,
        cacheSize: 0
      }
      
      // 按类型统计
      entries.forEach(([key, entry]) => {
        const type = key.split(':')[0]
        stats.byType[type] = (stats.byType[type] || 0) + 1
        
        // 找最旧和最新的条目
        if (!stats.oldestEntry || entry.lastUpdated < cache[stats.oldestEntry].lastUpdated) {
          stats.oldestEntry = key
        }
        if (!stats.newestEntry || entry.lastUpdated > cache[stats.newestEntry].lastUpdated) {
          stats.newestEntry = key
        }
      })
      
      // 计算缓存文件大小
      try {
        if (fs.existsSync(CACHE_FILE_PATH)) {
          const fileStats = fs.statSync(CACHE_FILE_PATH)
          stats.cacheSize = fileStats.size
        }
      } catch (error) {
        // 忽略错误
      }
      
      return stats
    } catch (error) {
      console.error('获取缓存统计失败:', error)
      return { totalCached: 0, byType: {}, cacheSize: 0 }
    }
  }

  /**
   * 📊 获取COS存储桶信息
   */
  static async getBucketInfo(): Promise<any> {
    if (!cos) {
      return {
        error: 'COS未正确配置，请检查环境变量',
        bucketName: Bucket,
        region: cosConfig.Region,
        isConfigValid: false
      }
    }
    
    try {
      const result = await cos.getBucket({
        Bucket,
        Region: cosConfig.Region,
        MaxKeys: 1000,
        Prefix: 'images/',
      })
      
      const cacheStats = this.getCacheStats()
      
      return {
        bucketName: Bucket,
        region: cosConfig.Region,
        imageCount: result.Contents?.length || 0,
        images: result.Contents?.map((item: any) => ({
          key: item.Key,
          size: item.Size,
          lastModified: item.LastModified,
        })) || [],
        cache: {
          ...cacheStats,
          cacheFilePath: CACHE_FILE_PATH.replace(process.cwd(), ''),
          cacheSizeFormatted: `${(cacheStats.cacheSize / 1024).toFixed(2)} KB`
        }
      }
    } catch (error) {
      console.error('❌ 获取COS信息失败:', error)
      return null
    }
  }
}

export default COSImageManager
