'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion } from 'framer-motion'
import { Menu } from 'lucide-react'

/**
 * 顶部导航栏组件 - 移动端只显示汉堡菜单
 * 桌面端显示完整导航
 */
interface HeaderProps {
  onMobileMenuOpen?: () => void
}

export default function Header({ onMobileMenuOpen }: HeaderProps) {
  const pathname = usePathname()

  // 导航菜单数据
  const navigationItems = [
    { name: '首页', href: '/', label: '首页' },
    { name: '关于', href: '/about', label: '关于我' },
    { name: '项目', href: '/projects', label: '项目展示' },
    { name: '随记', href: '/reflections', label: '个人随记' },
    { name: '电影&音乐', href: '/music-movie', label: '音乐电影' },
    { name: '相片', href: '/photo', label: '摄影作品' },
    { name: '联系', href: '/contact', label: '联系方式' }
  ]

  /**
   * 检查当前路径是否为活跃状态
   */
  const isActivePath = (href: string) => {
    if (href === '/') {
      return pathname === href
    }
    return pathname.startsWith(href)
  }

  // 移动端：首页不显示汉堡菜单，其他页面显示汉堡菜单
  const shouldShowMobileHeader = pathname !== '/'

  return (
    <>
      {/* 移动端汉堡菜单按钮 - 只在非首页显示 */}
      {shouldShowMobileHeader && (
        <motion.button
          initial={{ opacity: 0, scale: 0 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.4 }}
          className="fixed top-4 left-4 z-50 p-3 bg-white border border-gray-200 rounded-lg shadow-lg lg:hidden"
          onClick={onMobileMenuOpen}
          aria-label="打开菜单"
        >
          <Menu size={20} className="text-gray-600" />
        </motion.button>
      )}

      {/* 桌面端Header - 始终显示 */}
      <motion.header 
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="hidden lg:block fixed top-0 left-24 right-0 h-16 z-40"
      >
        <div className="container-custom h-full">
          <div className="flex items-center justify-between h-full">
            {/* 桌面端导航 */}
            <nav className="flex items-center space-x-8" aria-label="主导航">
              {navigationItems.map((item, index) => {
                const isActive = isActivePath(item.href)
                return (
                  <motion.div
                    key={item.href}
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: index * 0.1 }}
                  >
                    <Link 
                      href={item.href}
                      className={`nav-link ${isActive ? 'active' : ''}`}
                      aria-label={item.label}
                    >
                      {item.name}
                    </Link>
                  </motion.div>
                )
              })}
            </nav>
          </div>
        </div>
      </motion.header>
    </>
  )
}
