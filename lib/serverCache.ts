/**
 * 🚀 工业级服务端缓存系统
 * 
 * 特性：
 * - 内存缓存管理
 * - TTL 过期策略
 * - 缓存统计和监控
 * - 自动垃圾回收
 * - 缓存预热
 * - 并发安全
 */

interface CacheItem<T> {
  data: T
  expiresAt: number
  createdAt: number
  hitCount: number
  size?: number // 数据大小估算（字节）
}

interface CacheStats {
  hits: number
  misses: number
  evictions: number
  totalKeys: number
  totalSize: number
  hitRate: number
}

interface CacheConfig {
  maxSize: number        // 最大缓存项数量
  maxMemory: number     // 最大内存使用（字节）
  defaultTTL: number    // 默认TTL（毫秒）
  gcInterval: number    // 垃圾回收间隔（毫秒）
  enableStats: boolean  // 是否启用统计
}

class ServerCache {
  private cache = new Map<string, CacheItem<any>>()
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    totalKeys: 0,
    totalSize: 0,
    hitRate: 0
  }
  private config: CacheConfig
  private gcTimer?: NodeJS.Timeout

  constructor(config: Partial<CacheConfig> = {}) {
    this.config = {
      maxSize: 1000,          // 最多1000个缓存项
      maxMemory: 50 * 1024 * 1024, // 50MB
      defaultTTL: 5 * 60 * 1000,   // 5分钟
      gcInterval: 60 * 1000,       // 1分钟清理一次
      enableStats: true,
      ...config
    }

    // 启动垃圾回收
    this.startGarbageCollection()
  }

  /**
   * 获取缓存数据
   */
  async get<T>(
    key: string, 
    fetcher?: () => Promise<T>, 
    ttl?: number
  ): Promise<T | null> {
    const item = this.cache.get(key)
    
    // 缓存命中且未过期
    if (item && item.expiresAt > Date.now()) {
      item.hitCount++
      this.updateStats('hit')
      return item.data
    }

    // 缓存未命中
    this.updateStats('miss')

    // 如果有 fetcher，获取新数据并缓存
    if (fetcher) {
      try {
        const data = await fetcher()
        this.set(key, data, ttl)
        return data
      } catch (error) {
        throw error
      }
    }

    return null
  }

  /**
   * 设置缓存数据（带大数据检查）
   */
  set<T>(key: string, data: T, ttl?: number): void {
    try {
      const now = Date.now()
      const expiresAt = now + (ttl || this.config.defaultTTL)
      const size = this.estimateSize(data) // 这里可能抛出错误

      // 检查是否需要清理空间
      this.makeSpace(size)

      const item: CacheItem<T> = {
        data,
        expiresAt,
        createdAt: now,
        hitCount: 0,
        size
      }

      this.cache.set(key, item)
      this.updateCacheSize()
      
    } catch (error) {
      // 数据过大时，跳过缓存但不报错
      console.warn(`❌ 跳过缓存 "${key}": ${error instanceof Error ? error.message : '未知错误'}`)
    }
  }

  /**
   * 获取缓存项的年龄（毫秒）
   */
  getAge(key: string): number | null {
    const item = this.cache.get(key)
    if (!item) return null
    return Date.now() - item.createdAt
  }

  /**
   * 删除缓存项
   */
  delete(key: string): boolean {
    const existed = this.cache.delete(key)
    if (existed) {
      this.updateCacheSize()
    }
    return existed
  }

  /**
   * 批量删除（支持通配符）
   */
  deletePattern(pattern: string): number {
    const regex = new RegExp(pattern.replace(/\*/g, '.*'))
    let deleted = 0
    
    const keys = Array.from(this.cache.keys())
    for (const key of keys) {
      if (regex.test(key)) {
        this.cache.delete(key)
        deleted++
      }
    }
    
    if (deleted > 0) {
      this.updateCacheSize()
    }
    
    return deleted
  }

  /**
   * 清空所有缓存
   */
  clear(): void {
    this.cache.clear()
    this.resetStats()
  }

  /**
   * 缓存预热
   */
  async warmup(warmupFunctions: Array<{key: string, fetcher: () => Promise<any>, ttl?: number}>): Promise<void> {
    const promises = warmupFunctions.map(async ({key, fetcher, ttl}) => {
      try {
        await this.get(key, fetcher, ttl)
      } catch (error) {
        // 忽略预热错误
      }
    })

    await Promise.all(promises)
  }

  /**
   * 获取缓存统计
   */
  getStats(): CacheStats & {config: CacheConfig} {
    return {
      ...this.stats,
      totalKeys: this.cache.size,
      hitRate: this.stats.hits + this.stats.misses > 0 
        ? (this.stats.hits / (this.stats.hits + this.stats.misses)) * 100 
        : 0,
      config: this.config
    }
  }

  /**
   * 获取缓存健康状况
   */
  getHealth(): {
    status: 'healthy' | 'warning' | 'critical'
    memoryUsage: number
    memoryLimit: number
    itemCount: number
    itemLimit: number
    hitRate: number
    avgItemSize: number
  } {
    const stats = this.getStats()
    const memoryUsage = stats.totalSize
    const memoryLimit = this.config.maxMemory
    const memoryUsagePercent = (memoryUsage / memoryLimit) * 100
    const itemUsagePercent = (stats.totalKeys / this.config.maxSize) * 100
    
    let status: 'healthy' | 'warning' | 'critical' = 'healthy'
    
    if (memoryUsagePercent > 90 || itemUsagePercent > 90 || stats.hitRate < 50) {
      status = 'critical'
    } else if (memoryUsagePercent > 70 || itemUsagePercent > 70 || stats.hitRate < 70) {
      status = 'warning'
    }

    return {
      status,
      memoryUsage,
      memoryLimit,
      itemCount: stats.totalKeys,
      itemLimit: this.config.maxSize,
      hitRate: stats.hitRate,
      avgItemSize: stats.totalKeys > 0 ? stats.totalSize / stats.totalKeys : 0
    }
  }

  /**
   * 估算数据大小（限制大数据项）
   */
  private estimateSize(data: any): number {
    try {
      const jsonStr = JSON.stringify(data)
      const size = new Blob([jsonStr]).size
      
      // 🚨 检查大数据项：超过1.5MB的数据不缓存（Next.js限制2MB）
      if (size > 1.5 * 1024 * 1024) {
        console.warn(`⚠️ 数据过大 (${(size / 1024 / 1024).toFixed(2)}MB)，跳过缓存以避免Next.js错误`)
        throw new Error('数据过大，不适合缓存')
      }
      
      return size
    } catch {
      // 降级方案：基于字符串长度估算
      const str = typeof data === 'string' ? data : JSON.stringify(data)
      const estimatedSize = str.length * 2 // UTF-8 近似估算
      
      // 同样检查估算大小
      if (estimatedSize > 1.5 * 1024 * 1024) {
        console.warn(`⚠️ 估算数据过大 (${(estimatedSize / 1024 / 1024).toFixed(2)}MB)，跳过缓存`)
        throw new Error('数据过大，不适合缓存')
      }
      
      return estimatedSize
    }
  }

  /**
   * 确保有足够空间
   */
  private makeSpace(newItemSize: number): void {
    // 检查数量限制
    while (this.cache.size >= this.config.maxSize) {
      this.evictLRU()
    }

    // 检查内存限制
    while (this.stats.totalSize + newItemSize > this.config.maxMemory) {
      this.evictLRU()
    }
  }

  /**
   * LRU 淘汰策略
   */
  private evictLRU(): void {
    let oldestKey: string | null = null
    let oldestTime = Date.now()

    const entries = Array.from(this.cache.entries())
    for (const [key, item] of entries) {
      // 优先淘汰过期的项
      if (item.expiresAt <= Date.now()) {
        this.cache.delete(key)
        this.stats.evictions++
        return
      }
      
      // 找到最久未使用的项（基于创建时间和命中次数）
      const score = item.createdAt - (item.hitCount * 60000) // 命中次数转换为时间权重
      if (score < oldestTime) {
        oldestTime = score
        oldestKey = key
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey)
      this.stats.evictions++
    }
  }

  /**
   * 垃圾回收
   */
  private garbageCollect(): void {
    const before = this.cache.size
    const now = Date.now()
    
    const entries = Array.from(this.cache.entries())
    for (const [key, item] of entries) {
      if (item.expiresAt <= now) {
        this.cache.delete(key)
      }
    }
    
    const cleaned = before - this.cache.size
    if (cleaned > 0) {
      this.updateCacheSize()
    }
  }

  /**
   * 启动垃圾回收定时器
   */
  private startGarbageCollection(): void {
    this.gcTimer = setInterval(() => {
      this.garbageCollect()
    }, this.config.gcInterval)
  }

  /**
   * 停止垃圾回收
   */
  stopGarbageCollection(): void {
    if (this.gcTimer) {
      clearInterval(this.gcTimer)
      this.gcTimer = undefined
    }
  }

  /**
   * 更新统计信息
   */
  private updateStats(type: 'hit' | 'miss'): void {
    if (!this.config.enableStats) return
    
    if (type === 'hit') {
      this.stats.hits++
    } else {
      this.stats.misses++
    }
  }

  /**
   * 更新缓存大小统计
   */
  private updateCacheSize(): void {
    let totalSize = 0
    const values = Array.from(this.cache.values())
    for (const item of values) {
      totalSize += item.size || 0
    }
    this.stats.totalSize = totalSize
    this.stats.totalKeys = this.cache.size
  }

  /**
   * 重置统计信息
   */
  private resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      evictions: 0,
      totalKeys: 0,
      totalSize: 0,
      hitRate: 0
    }
  }
}

// 全局缓存实例
export const serverCache = new ServerCache({
  maxSize: 500,                 // 减少缓存项数量（从1000到500）
  maxMemory: 50 * 1024 * 1024,  // 减少内存使用（从100MB到50MB）
  defaultTTL: 5 * 60 * 1000,    // 5分钟
  gcInterval: 2 * 60 * 1000,    // 2分钟清理一次
  enableStats: true
})

// 缓存键常量
export const SERVER_CACHE_KEYS = {
  REFLECTIONS: 'reflections:all',
  REFLECTION_DETAIL: (id: string) => `reflection:detail:${id}`,
  MUSIC: 'music:all',
  MUSIC_DETAIL: (id: string) => `music:detail:${id}`,
  MOVIES: 'movies:all',
  MOVIE_DETAIL: (id: string) => `movie:detail:${id}`,
  PHOTOS: 'photos:all',
  PHOTOS_BY_CATEGORY: (category: string) => `photos:category:${category}`,
  PROJECTS: 'projects:all',
  PROJECT_DETAIL: (id: string) => `project:detail:${id}`,
  HOMEPAGE: 'homepage:settings'
} as const

// 缓存 TTL 配置 - 统一为1小时
export const SERVER_CACHE_TTL = {
  SHORT: 60 * 60 * 1000,      // 1小时 - 动态数据
  MEDIUM: 60 * 60 * 1000,     // 1小时 - 一般内容
  LONG: 60 * 60 * 1000,       // 1小时 - 较稳定的内容
  VERY_LONG: 60 * 60 * 1000   // 1小时 - 极少变化的数据
} as const

// 缓存预热函数
export async function warmupCache() {
  const { getMusicFromNotion, getMoviesFromNotion, getPhotosFromNotion, getReflections, getHomepageSettings } = await import('./notion')

  await serverCache.warmup([
    {
      key: 'homepage:settings',
      fetcher: () => getHomepageSettings(),
      ttl: SERVER_CACHE_TTL.LONG
    },
    {
      key: SERVER_CACHE_KEYS.REFLECTIONS,
      fetcher: () => getReflections(),
      ttl: SERVER_CACHE_TTL.MEDIUM
    },
    {
      key: SERVER_CACHE_KEYS.MUSIC,
      fetcher: () => getMusicFromNotion(),
      ttl: SERVER_CACHE_TTL.LONG
    },
    {
      key: SERVER_CACHE_KEYS.MOVIES,
      fetcher: () => getMoviesFromNotion(),
      ttl: SERVER_CACHE_TTL.LONG
    },
    {
      key: SERVER_CACHE_KEYS.PHOTOS,
      fetcher: () => getPhotosFromNotion(),
      ttl: SERVER_CACHE_TTL.MEDIUM
    }
  ])
}

// 清除相关缓存的工具函数
export function invalidateCache(type: 'reflections' | 'music' | 'movies' | 'photos' | 'projects' | 'homepage' | 'all') {
  switch (type) {
    case 'reflections':
      serverCache.deletePattern('reflection*') // 包含列表和详情
      break
    case 'music':
      serverCache.deletePattern('music*') // 包含列表和详情
      break
    case 'movies':
      serverCache.deletePattern('movie*') // 包含列表和详情
      break
    case 'photos':
      serverCache.deletePattern('photos*')
      break
    case 'projects':
      serverCache.deletePattern('project*') // 包含列表和详情
      break
    case 'homepage':
      serverCache.delete(SERVER_CACHE_KEYS.HOMEPAGE)
      break
    case 'all':
      serverCache.clear()
      break
  }
}

// 导出缓存健康检查
export function getCacheHealth() {
  return serverCache.getHealth()
}

// 导出缓存统计
export function getCacheStats() {
  return serverCache.getStats()
}

// 优雅关闭
export function shutdownCache() {
  serverCache.stopGarbageCollection()
}

// 进程退出时清理
if (typeof process !== 'undefined') {
  process.on('SIGTERM', shutdownCache)
  process.on('SIGINT', shutdownCache)
}