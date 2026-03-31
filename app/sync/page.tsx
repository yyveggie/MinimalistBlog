'use client'

import { useState, useEffect } from 'react'
import Layout from '@/components/Layout'
import { motion } from 'framer-motion'
import { clearImageCache } from '@/lib/clientImageCache'

export default function SyncPage() {
  const [password, setPassword] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [syncResult, setSyncResult] = useState<any>(null)
  const [loading, setLoading] = useState(false)

  // 检查认证状态
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const authToken = localStorage.getItem('sync-auth-token')
      if (authToken) {
        setIsAuthenticated(true)
      }
    }
  }, [])

  const handleAuth = async () => {
    try {
      const response = await fetch('/api/cache/stats', {
        headers: {
          'Authorization': `Bearer ${password}`
        }
      })
      
      if (response.ok) {
        setIsAuthenticated(true)
        if (typeof window !== 'undefined') {
          localStorage.setItem('sync-auth-token', password)
        }
      } else {
        alert('密码错误')
      }
    } catch (error) {
      alert('认证失败')
    }
  }

  const handleSync = async (type: string) => {
    setLoading(true)
    try {
      const authToken = typeof window !== 'undefined' ? localStorage.getItem('sync-auth-token') : password
      
      // 🔥 步骤1：清除服务端缓存
      const clearResponse = await fetch('/api/cache/clear', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`
        },
        body: JSON.stringify({ type })
      })
      
      const clearResult = await clearResponse.json()
      
      // ✅ clear API 已经自动调用了 /api/version，不需要重复调用
      // 版本信息已包含在 clearResult 中
      
      setSyncResult(clearResult)
      
      if (clearResult.success) {
        // 🔧 同时清除客户端localStorage缓存
        if (typeof window !== 'undefined') {
          const clearClientCache = (cacheType: string) => {
            const keys = Object.keys(localStorage)
            keys.forEach(key => {
              if (key.includes(`${cacheType}-`) || key === `${cacheType}-list-data`) {
                localStorage.removeItem(key)
                localStorage.removeItem(`${key}-timestamp`)
              }
            })
          }

          switch (type) {
            case 'music':
              clearClientCache('music')
              clearImageCache() // 🖼️ 清除客户端图片缓存
              break
            case 'movies':
              clearClientCache('movie')
              clearImageCache() // 🖼️ 清除客户端图片缓存
              break
            case 'reflections':
              clearClientCache('reflections')
              clearClientCache('reflection')
              clearImageCache() // 🖼️ 清除客户端图片缓存（反思文章有内联图片！）
              break
            case 'projects':
              clearClientCache('projects')
              clearClientCache('project')
              clearImageCache() // 🖼️ 清除客户端图片缓存
              break
            case 'photos':
              clearClientCache('photos')
              clearClientCache('photo')
              clearImageCache() // 🖼️ 清除客户端图片缓存
              break
            case 'homepage':
              clearClientCache('homepage')
              break
            case 'images':
              clearImageCache() // 🖼️ 清除客户端图片缓存
              break
            case 'text':
            case 'all':
              // 只有明确选择"全部"时才清除所有缓存
              const allKeys = Object.keys(localStorage)
              allKeys.forEach(key => {
                if (key.includes('-data') || key.includes('-timestamp') || key.includes('-version') ||
                    key.includes('music') || key.includes('movie') || 
                    key.includes('reflection') || key.includes('project') || 
                    key.includes('photo') || key.includes('homepage')) {
                  localStorage.removeItem(key)
                }
              })
              clearImageCache() // 🖼️ 清除客户端图片缓存
              break
          }
        }
        
        alert(`✅ ${type} 缓存已完全刷新！\n\n✓ 服务端缓存已清除\n✓ 版本号已更新\n✓ 客户端缓存已清除\n\n用户下次访问时将看到最新内容！`)
      }
    } catch (error) {
      alert('同步失败')
    } finally {
      setLoading(false)
    }
  }

  const handleWarmup = async () => {
    setLoading(true)
    try {
      const authToken = typeof window !== 'undefined' ? localStorage.getItem('sync-auth-token') : password
      
      const response = await fetch('/api/cache/warmup', {
        headers: {
          'Authorization': `Bearer ${authToken}`
        }
      })
      
      const result = await response.json()
      setSyncResult(result)
      
      if (result.success) {
        alert('缓存预热完成')
      }
    } catch (error) {
      alert('预热失败')
    } finally {
      setLoading(false)
    }
  }

  if (!isAuthenticated) {
    return (
      <Layout>
        <div className="container-custom py-20">
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="max-w-md mx-auto"
          >
            <h1 className="text-2xl font-light text-gray-900 mb-8">缓存同步管理</h1>
            <div className="space-y-4">
              <input
                type="password"
                placeholder="请输入管理密码"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full p-3 border-b border-gray-200 bg-transparent focus:border-gray-900 focus:outline-none transition-colors"
                onKeyPress={(e) => e.key === 'Enter' && handleAuth()}
              />
              <button
                onClick={handleAuth}
                className="w-full bg-gray-900 text-white p-3 hover:bg-gray-800 transition-colors font-light"
              >
                登录
              </button>
            </div>
          </motion.div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="container-custom py-20">
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          className="max-w-2xl mx-auto"
        >
          <div className="mb-16">
            <h1 className="text-2xl font-light text-gray-900 mb-4">缓存同步管理</h1>
            <p className="text-gray-600 font-light">清除缓存后，新内容将在下次访问时从Notion重新加载</p>
          </div>

          {/* 内容同步 */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
            className="mb-12"
          >
            <h2 className="text-lg font-light text-gray-900 mb-6">内容缓存刷新</h2>
            <div className="space-y-3">
              <button
                onClick={() => handleSync('reflections')}
                disabled={loading}
                className="w-full p-4 bg-gray-900 text-white hover:bg-gray-800 transition-colors font-light disabled:opacity-50"
              >
                📝 刷新反思文章缓存
              </button>
              <button
                onClick={() => handleSync('photos')}
                disabled={loading}
                className="w-full p-4 bg-gray-900 text-white hover:bg-gray-800 transition-colors font-light disabled:opacity-50"
              >
                📸 刷新照片缓存
              </button>
              <button
                onClick={() => handleSync('projects')}
                disabled={loading}
                className="w-full p-4 bg-gray-900 text-white hover:bg-gray-800 transition-colors font-light disabled:opacity-50"
              >
                🚀 刷新项目缓存
              </button>
              <button
                onClick={() => handleSync('music')}
                disabled={loading}
                className="w-full p-4 bg-gray-900 text-white hover:bg-gray-800 transition-colors font-light disabled:opacity-50"
              >
                🎵 刷新音乐缓存
              </button>
              <button
                onClick={() => handleSync('movies')}
                disabled={loading}
                className="w-full p-4 bg-gray-900 text-white hover:bg-gray-800 transition-colors font-light disabled:opacity-50"
              >
                🎬 刷新电影缓存
              </button>
              <button
                onClick={() => handleSync('homepage')}
                disabled={loading}
                className="w-full p-4 bg-gray-900 text-white hover:bg-gray-800 transition-colors font-light disabled:opacity-50"
              >
                🏠 刷新首页缓存
              </button>
            </div>
          </motion.div>

          {/* 系统操作 */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="mb-12"
          >
            <h2 className="text-lg font-light text-gray-900 mb-6">系统操作</h2>
            <div className="space-y-3">
              <button
                onClick={() => handleSync('all')}
                disabled={loading}
                className="w-full p-4 border border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white transition-colors font-light disabled:opacity-50"
              >
                清除所有缓存
              </button>
              <button
                onClick={() => handleSync('images')}
                disabled={loading}
                className="w-full p-4 border border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white transition-colors font-light disabled:opacity-50"
              >
                清除图片缓存
              </button>
              <button
                onClick={handleWarmup}
                disabled={loading}
                className="w-full p-4 border border-gray-900 text-gray-900 hover:bg-gray-900 hover:text-white transition-colors font-light disabled:opacity-50"
              >
                预热缓存
              </button>
            </div>
          </motion.div>

          {/* 结果显示 */}
          {syncResult && (
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="mb-12"
            >
              <h3 className="text-lg font-light text-gray-900 mb-4">操作结果</h3>
              <div className="bg-gray-50 p-4 font-mono text-sm text-gray-600">
                {JSON.stringify(syncResult, null, 2)}
              </div>
            </motion.div>
          )}

          {/* 使用说明 */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="border-t border-gray-200 pt-8"
          >
            <h3 className="text-lg font-light text-gray-900 mb-4">使用说明</h3>
            <div className="space-y-3 text-sm text-gray-600 font-light leading-relaxed">
              <p><strong>内容缓存刷新：</strong>在 Notion 更新内容后，点击对应按钮刷新缓存。用户下次访问时将看到最新内容</p>
              <p><strong>工作原理：</strong>清除服务端缓存 + 更新版本号 + 清除客户端缓存</p>
              <p><strong>清除所有缓存：</strong>清除所有文本和图片缓存，重新开始</p>
              <p><strong>清除图片缓存：</strong>仅清除图片URL缓存，图片内容会重新处理</p>
              <p><strong>预热缓存：</strong>立即从Notion加载所有内容到缓存中</p>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </Layout>
  )
}
