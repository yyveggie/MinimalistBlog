'use client'

import { useState, useEffect } from 'react'

interface VersionedCacheConfig {
  cacheKey: string
  contentType: 'music' | 'movies' | 'photos' | 'reflections' | 'projects' | 'homepage'
  cacheExpiry?: number // 毫秒，默认1小时
}

// 🚀 全局版本号缓存（30分钟内复用，平衡性能与实时性）
const VERSION_CACHE_TTL = 30 * 60 * 1000 // 30分钟
const versionCache: Record<string, {version: string, timestamp: number}> = {}

/**
 * 🔄 带版本控制的localStorage缓存Hook
 * 自动检查内容版本，版本不匹配时清除缓存
 */
export function useVersionedCache<T>({ cacheKey, contentType, cacheExpiry = 60 * 60 * 1000 }: VersionedCacheConfig) {
  const [cachedData, setCachedData] = useState<T | null>(null)
  const [isCacheValid, setIsCacheValid] = useState(false)
  const [isCheckingVersion, setIsCheckingVersion] = useState(true)
  const [currentVersion, setCurrentVersion] = useState<string | null>(null)

  useEffect(() => {
    const checkVersionAndCache = async () => {
      if (typeof window === 'undefined') {
        setIsCheckingVersion(false)
        return
      }

      try {
        // 🔄 获取特定类型的版本号（带客户端缓存）
        let latestVersion: string | null = null
        try {
          // 🚀 优化：先检查客户端版本缓存（5分钟内复用）
          const cached = versionCache[contentType]
          const now = Date.now()
          
          if (cached && (now - cached.timestamp) < VERSION_CACHE_TTL) {
            console.log(`⚡ 版本号缓存命中: ${contentType} = ${cached.version}`)
            latestVersion = cached.version
            setCurrentVersion(latestVersion)
          } else {
            // 缓存未命中，请求API
            const versionResponse = await fetch(`/api/version?type=${contentType}`)
            if (versionResponse.ok) {
              const versionData = await versionResponse.json()
              latestVersion = versionData.version
              setCurrentVersion(latestVersion)
              
              // 🚀 缓存版本号到内存（5分钟）- 只有非null时才缓存
              if (latestVersion) {
                versionCache[contentType] = {
                  version: latestVersion,
                  timestamp: now
                }
                console.log(`💾 版本号已缓存: ${contentType} = ${latestVersion}`)
              }
            }
          }
        } catch (error) {
          console.warn(`获取${contentType}版本号失败，使用时间验证:`, error)
        }

        // 📦 检查本地缓存
        const data = localStorage.getItem(cacheKey)
        const timestamp = localStorage.getItem(`${cacheKey}-timestamp`)
        const version = localStorage.getItem(`${cacheKey}-version`)

        const now = Date.now()
        const isTimeValid = !!(data && timestamp && (now - parseInt(timestamp)) < cacheExpiry)
        const isVersionValid = !latestVersion || (version === latestVersion)

        if (data && isTimeValid && isVersionValid) {
          // ✅ 缓存有效
          try {
            const parsedData = JSON.parse(data)
            setCachedData(parsedData)
            setIsCacheValid(true)
            console.log(`✅ 缓存命中: ${cacheKey}`)
          } catch (error) {
            console.warn('解析缓存数据失败:', error)
            clearCache()
          }
        } else {
          // ❌ 缓存无效，清除相关缓存
          if (data && (!isTimeValid || !isVersionValid)) {
            const reason = !isTimeValid ? '时间过期' : '版本不匹配'
            console.log(`🔄 ${reason}，清除缓存: ${cacheKey}`)
            clearCache()
          }
        }
      } catch (error) {
        console.warn('检查版本和缓存失败:', error)
      } finally {
        setIsCheckingVersion(false)
      }
    }

    checkVersionAndCache()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cacheKey, contentType]) // cacheExpiry 故意不加入依赖，避免重复检查

  /**
   * 💾 保存数据到缓存
   */
  const saveToCache = async (data: T) => {
    if (typeof window === 'undefined') return

    try {
      // 获取当前特定类型的版本号（带客户端缓存）
      let latestVersion: string | null = null
      try {
        // 🚀 先检查客户端版本缓存
        const cached = versionCache[contentType]
        const now = Date.now()
        
        if (cached && (now - cached.timestamp) < VERSION_CACHE_TTL) {
          latestVersion = cached.version
        } else {
          const versionResponse = await fetch(`/api/version?type=${contentType}`)
          if (versionResponse.ok) {
            const versionData = await versionResponse.json()
            latestVersion = versionData.version
            
            // 缓存版本号 - 只有非null时才缓存
            if (latestVersion) {
              versionCache[contentType] = {
                version: latestVersion,
                timestamp: now
              }
            }
          }
        }
      } catch (error) {
        console.warn(`获取${contentType}版本号失败:`, error)
      }

      const now = Date.now()
      localStorage.setItem(cacheKey, JSON.stringify(data))
      localStorage.setItem(`${cacheKey}-timestamp`, now.toString())
      
      if (latestVersion) {
        localStorage.setItem(`${cacheKey}-version`, latestVersion)
      }

      setCachedData(data)
      setIsCacheValid(true)
      console.log(`💾 数据已缓存: ${cacheKey}`)
    } catch (error) {
      console.warn('保存缓存失败:', error)
    }
  }

  /**
   * 🗑️ 清除缓存
   */
  const clearCache = () => {
    if (typeof window === 'undefined') return

    localStorage.removeItem(cacheKey)
    localStorage.removeItem(`${cacheKey}-timestamp`)
    localStorage.removeItem(`${cacheKey}-version`)
    
    setCachedData(null)
    setIsCacheValid(false)
  }

  return {
    cachedData,
    isCacheValid,
    isCheckingVersion,
    saveToCache,
    clearCache,
    currentVersion: currentVersion  // 暴露当前版本号用于API调用
  }
}

export default useVersionedCache
