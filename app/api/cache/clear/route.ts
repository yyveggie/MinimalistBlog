import { NextResponse } from 'next/server'
import { invalidateCache } from '@/lib/serverCache'
import { isAuthenticated, createUnauthorizedResponse } from '@/lib/auth'
import { CACHE_FILE_PATH } from '@/lib/cos'
import fs from 'fs'
import path from 'path'

// 🔧 强制动态渲染
export const dynamic = 'force-dynamic'

export async function POST(request: Request) {
  // 🔐 认证检查
  if (!isAuthenticated(request)) {
    return createUnauthorizedResponse()
  }

  try {
    const { type } = await request.json()
    
    // 验证清理类型
    const validTypes = ['reflections', 'music', 'movies', 'photos', 'projects', 'homepage', 'text', 'images', 'all']
    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid cache type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    let cleared = {
      textCache: 0,
      imageCache: false,
      message: ''
    }

    // 清理文本缓存
    if (type === 'text' || type === 'all') {
      invalidateCache('all')
      cleared.textCache = 1
      cleared.message += '文本缓存已清除；'
    } else if (['reflections', 'music', 'movies', 'photos', 'projects', 'homepage'].includes(type)) {
      invalidateCache(type as any)
      cleared.textCache = 1
      cleared.message += `${type}缓存已清除；`
    }
    
    // 清理图片缓存（COS URL缓存）
    // 🔑 关键修复：所有带图片的内容类型都要清除图片缓存！
    const shouldClearImageCache = ['images', 'all', 'music', 'movies', 'photos', 'projects', 'reflections'].includes(type)
    
    if (shouldClearImageCache) {
      try {
        // 🔧 使用正确的缓存文件路径（根据环境自动选择）
        console.log(`🗑️ 准备清除图片缓存: ${CACHE_FILE_PATH}`)
        
        // 清除主缓存文件
        if (fs.existsSync(CACHE_FILE_PATH)) {
          fs.unlinkSync(CACHE_FILE_PATH)
          cleared.imageCache = true
          cleared.message += `图片URL缓存已清除 (${CACHE_FILE_PATH})；`
          console.log(`✅ 已删除: ${CACHE_FILE_PATH}`)
        } else {
          cleared.message += `图片URL缓存文件不存在 (${CACHE_FILE_PATH})；`
          console.log(`⚠️ 文件不存在: ${CACHE_FILE_PATH}`)
        }
        
        // 🧹 额外清理：同时尝试删除其他可能的位置（确保彻底清除）
        const fallbackPaths = [
          path.join(process.cwd(), 'public', 'cos-cache.json'),
          '/tmp/cos-cache.json'
        ].filter(p => p !== CACHE_FILE_PATH) // 排除已处理的主路径
        
        for (const fallbackPath of fallbackPaths) {
          try {
            if (fs.existsSync(fallbackPath)) {
              fs.unlinkSync(fallbackPath)
              console.log(`✅ 额外清除: ${fallbackPath}`)
            }
          } catch (err) {
            console.warn(`⚠️ 无法删除: ${fallbackPath}`, err)
          }
        }
        
      } catch (error) {
        console.error('清理图片缓存失败:', error)
        cleared.message += '图片URL缓存清除失败；'
      }
    }

    // 🔄 更新对应类型的版本号，强制特定客户端缓存失效
    let versionUpdated = false
    try {
      // 动态获取当前请求的域名，确保生产环境正确
      const requestUrl = new URL(request.url)
      const baseUrl = `${requestUrl.protocol}//${requestUrl.host}`
      
      // 根据清除类型确定要更新的版本类型
      let versionType = type
      if (type === 'text') {
        versionType = 'all' // text类型清除所有文本内容
      } else if (type === 'images') {
        // 图片缓存清除不需要更新版本号（因为是COS URL缓存）
        return NextResponse.json({
          success: true,
          type,
          cleared,
          versionUpdated: false,
          message: cleared.message || '未执行任何清理操作',
          timestamp: new Date().toISOString()
        })
      }
      
      const versionResponse = await fetch(`${baseUrl}/api/version`, {
        method: 'POST',
        headers: {
          'Authorization': request.headers.get('Authorization') || '',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ type: versionType })
      })
      
      if (versionResponse.ok) {
        const versionResult = await versionResponse.json()
        versionUpdated = true
        cleared.message += ` ${versionResult.message}；`
      }
    } catch (error) {
      console.warn('更新版本号失败:', error)
      cleared.message += ' 版本更新失败，其他用户可能需要30分钟后才能看到新内容；'
    }

    return NextResponse.json({
      success: true,
      type,
      cleared,
      versionUpdated,
      message: cleared.message || '未执行任何清理操作',
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to clear cache',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

// 支持DELETE方法清除所有缓存
export async function DELETE(request: Request) {
  // 🔐 认证检查
  if (!isAuthenticated(request)) {
    return createUnauthorizedResponse()
  }

  try {
    // 清除所有文本缓存
    invalidateCache('all')
    
    // 清除图片URL缓存
    let imageCleared = false
    
    try {
      // 🔧 使用正确的缓存文件路径
      if (fs.existsSync(CACHE_FILE_PATH)) {
        fs.unlinkSync(CACHE_FILE_PATH)
        imageCleared = true
        console.log(`✅ 已删除主缓存: ${CACHE_FILE_PATH}`)
      }
      
      // 🧹 清除所有可能的位置
      const fallbackPaths = [
        path.join(process.cwd(), 'public', 'cos-cache.json'),
        '/tmp/cos-cache.json'
      ].filter(p => p !== CACHE_FILE_PATH)
      
      for (const fallbackPath of fallbackPaths) {
        try {
          if (fs.existsSync(fallbackPath)) {
            fs.unlinkSync(fallbackPath)
            console.log(`✅ 额外清除: ${fallbackPath}`)
          }
        } catch (err) {
          console.warn(`⚠️ 无法删除: ${fallbackPath}`, err)
        }
      }
    } catch (error) {
      console.warn('清理图片缓存失败:', error)
    }

    return NextResponse.json({
      success: true,
      message: `所有缓存已清除 - 文本缓存: ✅ 图片缓存: ${imageCleared ? '✅' : '❌'}`,
      cleared: {
        textCache: true,
        imageCache: imageCleared
      },
      timestamp: new Date().toISOString()
    })

  } catch (error) {
    return NextResponse.json(
      { 
        error: 'Failed to clear all caches',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
