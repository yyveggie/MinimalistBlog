'use client'

import { useState } from 'react'
import Sidebar from './Sidebar'
import Header from './Header'
import { useSidebarLayout } from '@/hooks/useSidebarLayout'

interface LayoutProps {
  children: React.ReactNode
}

/**
 * 页面布局组件
 * 统一管理 Sidebar 和 Header 的状态和交互
 */
export default function Layout({ children }: LayoutProps) {
  const { mainContentClass } = useSidebarLayout()
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false)

  const handleMobileMenuOpen = () => {
    setIsMobileSidebarOpen(true)
  }

  const handleMobileMenuClose = () => {
    setIsMobileSidebarOpen(false)
  }

  return (
    <div className="min-h-screen bg-white">
      <Sidebar 
        isOpen={isMobileSidebarOpen} 
        onClose={handleMobileMenuClose} 
      />
      <Header onMobileMenuOpen={handleMobileMenuOpen} />
      
      <main className={mainContentClass}>
        {children}
      </main>
    </div>
  )
}
