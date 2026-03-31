'use client'

import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'

/**
 * 侧边栏布局 Hook
 * 根据路径决定主内容的边距，支持响应式设计
 */
export function useSidebarLayout() {
  const pathname = usePathname()
  const [isClient, setIsClient] = useState(false)
  
  useEffect(() => {
    setIsClient(true)
  }, [])
  
  // 避免hydration错误：在客户端渲染前使用默认值
  if (!isClient) {
    return {
      shouldShowSidebarOnMobile: false,
      mainContentClass: 'ml-0 lg:ml-24 pt-16'
    }
  }
  
  // 移动端只在首页显示侧边栏
  const shouldShowSidebarOnMobile = pathname === '/'
  
  // 主内容区域的类名 - 使用CSS媒体查询而不是JavaScript
  // 桌面端(lg+)：总是有左边距 (lg:ml-24)
  // 移动端：只有首页有左边距 (首页 ml-20，其他页面 ml-0)
  const mainContentClass = shouldShowSidebarOnMobile 
    ? 'ml-20 lg:ml-24 pt-16' 
    : 'ml-0 lg:ml-24 pt-16'
  
  return {
    shouldShowSidebarOnMobile,
    mainContentClass
  }
}
