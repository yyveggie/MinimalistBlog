/**
 * 🖼️ 客户端图片缓存系统
 * 结合服务端COS缓存，实现最大化效率
 * 
 * 策略：
 * 1. 客户端localStorage缓存COS URL（24小时）
 * 2. 命中率高，减少服务端请求
 * 3. 自动清理过期缓存
 */

interface ImageCacheEntry {
  url: string
  timestamp: number
  source: 'cos' | 'fallback'
}

interface ImageCacheConfig {
  maxEntries: number
  defaultTTL: number // 毫秒
  storageKey: string
  version: string // 🔑 缓存版本号
}

class ClientImageCache {
  private config: ImageCacheConfig = {
    maxEntries: 500, // 🚀 从1000减少到500，避免localStorage溢出
    defaultTTL: 24 * 60 * 60 * 1000, // 24小时
    storageKey: 'mypage-image-cache',
    version: 'v4' // 🔑 v4: 容量优化 + 自动清理
  }

  constructor() {
    // 🚀 自动清除旧版本缓存
    this.checkAndClearOldCache()
  }

  /**
   * 🔄 检查并清除旧版本缓存
   */
  private checkAndClearOldCache(): void {
    if (typeof window === 'undefined') return

    try {
      const versionKey = `${this.config.storageKey}-version`
      const storedVersion = localStorage.getItem(versionKey)

      if (storedVersion !== this.config.version) {
        console.log(`🔄 检测到缓存版本更新: ${storedVersion} -> ${this.config.version}`)
        this.clearCache()
        localStorage.setItem(versionKey, this.config.version)
        console.log('✅ 已自动清除旧版本图片缓存')
      }
    } catch (error) {
      console.warn('检查缓存版本失败:', error)
    }
  }

  /**
   * 🔍 获取缓存的图片URL
   */
  getCachedImageUrl(type: string, id: string): string | null {
    if (typeof window === 'undefined') return null

    try {
      const cache = this.getCache()
      const key = `${type}:${id}`
      const entry = cache[key]

      if (!entry) {
        return null
      }

      // 检查是否过期
      if (Date.now() - entry.timestamp > this.config.defaultTTL) {
        this.removeFromCache(key)
        return null
      }

      console.log(`🖼️ 客户端图片缓存命中: ${key}`)
      return entry.url
    } catch (error) {
      console.warn('读取图片缓存失败:', error)
      return null
    }
  }

  /**
   * 💾 缓存图片URL（带容量检查）
   */
  cacheImageUrl(type: string, id: string, url: string, source: 'cos' | 'fallback' = 'cos'): void {
    if (typeof window === 'undefined') return

    try {
      // 🚀 先检查localStorage容量
      if (!this.checkStorageCapacity()) {
        console.warn('⚠️ localStorage容量不足，跳过缓存')
        return
      }
      
      const cache = this.getCache()
      const key = `${type}:${id}`

      // 添加新条目
      cache[key] = {
        url,
        timestamp: Date.now(),
        source
      }

      // 清理过期条目
      this.cleanupExpired(cache)

      // 限制缓存大小
      this.limitCacheSize(cache)

      // 保存到localStorage（带错误处理）
      try {
        localStorage.setItem(this.config.storageKey, JSON.stringify(cache))
        console.log(`🖼️ 图片URL已缓存: ${key} -> ${source}`)
      } catch (storageError) {
        // localStorage写入失败（可能容量满了）
        console.warn('⚠️ localStorage写入失败，清理缓存后重试')
        this.clearOldestEntries(50) // 清理50个最旧条目
        
        // 重试一次
        try {
          localStorage.setItem(this.config.storageKey, JSON.stringify(cache))
          console.log(`✅ 清理后缓存成功: ${key}`)
        } catch (retryError) {
          console.error('❌ localStorage写入彻底失败:', retryError)
        }
      }
    } catch (error) {
      console.warn('缓存图片URL失败:', error)
    }
  }
  
  /**
   * 🔍 检查localStorage容量
   */
  private checkStorageCapacity(): boolean {
    if (typeof window === 'undefined') return false
    
    try {
      const testKey = '__storage_capacity_test__'
      const testValue = 'x'.repeat(1024 * 50) // 50KB测试
      localStorage.setItem(testKey, testValue)
      localStorage.removeItem(testKey)
      return true
    } catch (e) {
      // localStorage已满或接近容量限制
      console.warn('⚠️ localStorage容量检查失败，可能已满')
      return false
    }
  }
  
  /**
   * 🗑️ 清理最旧的N个条目
   */
  private clearOldestEntries(count: number): void {
    if (typeof window === 'undefined') return
    
    try {
      const cache = this.getCache()
      const entries = Object.entries(cache)
      
      if (entries.length === 0) return
      
      // 按时间排序，删除最旧的条目
      entries.sort(([, a], [, b]) => a.timestamp - b.timestamp)
      
      const toRemove = Math.min(count, entries.length)
      for (let i = 0; i < toRemove; i++) {
        delete cache[entries[i][0]]
      }
      
      // 保存
      localStorage.setItem(this.config.storageKey, JSON.stringify(cache))
      console.log(`🧹 已清理 ${toRemove} 个最旧的缓存条目`)
    } catch (error) {
      console.warn('清理缓存条目失败:', error)
    }
  }

  /**
   * 🚀 智能获取图片URL
   * 优先使用客户端缓存，未命中则请求服务端
   */
  async getImageUrl(type: string, id: string): Promise<string | null> {
    // 🔍 第1步：检查客户端缓存
    const cachedUrl = this.getCachedImageUrl(type, id)
    if (cachedUrl) {
      return cachedUrl
    }

    // 📡 第2步：请求服务端（COS缓存）
    try {
      console.log(`📡 请求服务端图片: ${type}/${id}`)
      const response = await fetch(`/api/images/notion/${type}/${id}`, {
        method: 'GET',
        headers: {
          'Accept': 'image/*,*/*'
        }
      })

      if (response.ok) {
        // 服务端返回重定向，获取最终URL
        const finalUrl = response.url
        
        // 💾 缓存到客户端
        this.cacheImageUrl(type, id, finalUrl, 'cos')
        
        return finalUrl
      } else {
        throw new Error(`HTTP ${response.status}`)
      }
    } catch (error) {
      console.error(`获取图片失败 ${type}/${id}:`, error)
      return null
    }
  }

  /**
   * 🗑️ 清除所有图片缓存
   */
  clearCache(): void {
    if (typeof window === 'undefined') return
    
    try {
      localStorage.removeItem(this.config.storageKey)
      console.log('🗑️ 客户端图片缓存已清除')
    } catch (error) {
      console.warn('清除图片缓存失败:', error)
    }
  }

  /**
   * 📊 获取缓存统计
   */
  getCacheStats(): {
    totalEntries: number
    cacheSize: string
    oldestEntry: string | null
    newestEntry: string | null
    sourceDistribution: { cos: number, fallback: number }
  } {
    if (typeof window === 'undefined') {
      return { totalEntries: 0, cacheSize: '0 KB', oldestEntry: null, newestEntry: null, sourceDistribution: { cos: 0, fallback: 0 } }
    }

    try {
      const cache = this.getCache()
      const entries = Object.entries(cache)
      
      let oldest: { key: string, timestamp: number } | null = null
      let newest: { key: string, timestamp: number } | null = null
      const sourceCount: Record<'cos' | 'fallback', number> = { cos: 0, fallback: 0 }

      entries.forEach(([key, entry]: [string, ImageCacheEntry]) => {
        // 统计来源
        sourceCount[entry.source]++

        // 找最新最旧
        if (!oldest || entry.timestamp < oldest.timestamp) {
          oldest = { key, timestamp: entry.timestamp }
        }
        if (!newest || entry.timestamp > newest.timestamp) {
          newest = { key, timestamp: entry.timestamp }
        }
      })

      // 计算缓存大小
      const cacheStr = localStorage.getItem(this.config.storageKey) || '{}'
      const sizeBytes = new Blob([cacheStr]).size
      const sizeKB = (sizeBytes / 1024).toFixed(2)

      return {
        totalEntries: entries.length,
        cacheSize: `${sizeKB} KB`,
        oldestEntry: oldest ? `${(oldest as { key: string, timestamp: number }).key} (${new Date((oldest as { key: string, timestamp: number }).timestamp).toLocaleString()})` : null,
        newestEntry: newest ? `${(newest as { key: string, timestamp: number }).key} (${new Date((newest as { key: string, timestamp: number }).timestamp).toLocaleString()})` : null,
        sourceDistribution: sourceCount
      }
    } catch (error) {
      console.warn('获取缓存统计失败:', error)
      return { totalEntries: 0, cacheSize: '0 KB', oldestEntry: null, newestEntry: null, sourceDistribution: { cos: 0, fallback: 0 } }
    }
  }

  /**
   * 📁 获取缓存数据
   */
  private getCache(): Record<string, ImageCacheEntry> {
    try {
      const data = localStorage.getItem(this.config.storageKey)
      return data ? JSON.parse(data) : {}
    } catch (error) {
      console.warn('解析图片缓存数据失败:', error)
      return {}
    }
  }

  /**
   * 🗑️ 从缓存中移除条目
   */
  private removeFromCache(key: string): void {
    try {
      const cache = this.getCache()
      delete cache[key]
      localStorage.setItem(this.config.storageKey, JSON.stringify(cache))
    } catch (error) {
      console.warn('移除缓存条目失败:', error)
    }
  }

  /**
   * 🧹 清理过期条目
   */
  private cleanupExpired(cache: Record<string, ImageCacheEntry>): void {
    const now = Date.now()
    const keysToRemove: string[] = []

    Object.entries(cache).forEach(([key, entry]) => {
      if (now - entry.timestamp > this.config.defaultTTL) {
        keysToRemove.push(key)
      }
    })

    keysToRemove.forEach(key => delete cache[key])
    
    if (keysToRemove.length > 0) {
      console.log(`🧹 清理了 ${keysToRemove.length} 个过期图片缓存`)
    }
  }

  /**
   * 📏 限制缓存大小
   */
  private limitCacheSize(cache: Record<string, ImageCacheEntry>): void {
    const entries = Object.entries(cache)
    
    if (entries.length <= this.config.maxEntries) {
      return
    }

    // 按时间排序，删除最旧的条目
    entries.sort(([, a], [, b]) => a.timestamp - b.timestamp)
    
    const toRemove = entries.length - this.config.maxEntries
    for (let i = 0; i < toRemove; i++) {
      delete cache[entries[i][0]]
    }
    
    console.log(`📏 删除了 ${toRemove} 个最旧的图片缓存条目`)
  }
}

// 全局实例
export const clientImageCache = new ClientImageCache()

/**
 * 🚀 便捷函数：获取图片URL（推荐使用）
 */
export async function getOptimizedImageUrl(type: string, id: string): Promise<string | null> {
  return clientImageCache.getImageUrl(type, id)
}

/**
 * 🗑️ 便捷函数：清除图片缓存
 */
export function clearImageCache(): void {
  clientImageCache.clearCache()
}

/**
 * 📊 便捷函数：获取缓存统计
 */
export function getImageCacheStats() {
  return clientImageCache.getCacheStats()
}
