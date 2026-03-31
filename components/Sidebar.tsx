'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

/**
 * 侧边栏导航组件 - 移动端支持展开/收缩
 * 包含艺术家信息和导航菜单
 */
interface SidebarProps {
  isOpen?: boolean
  onClose?: () => void
}

export default function Sidebar({ isOpen = false, onClose }: SidebarProps) {
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

  const handleLinkClick = () => {
    if (onClose) onClose()
  }

  return (
    <>
      {/* 移动端遮罩层 */}
      <AnimatePresence>
        {isOpen && pathname !== '/' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
            onClick={onClose}
          />
        )}
      </AnimatePresence>

      {/* 桌面端侧边栏 - 始终显示，绝对固定位置 */}
      <aside className="hidden lg:flex fixed left-0 top-0 h-screen w-24 bg-white flex-col z-50">
        {/* 艺术家姓名 - 桌面端竖排，固定位置 */}
        <div className="absolute top-24 left-0 right-0 flex flex-col items-center">
          <Link 
            href="/"
            className="group"
            aria-label="返回首页"
          >
            <h1 className="font-serif text-lg font-light text-gray-900 group-hover:text-black transition-colors duration-300 tracking-wider">
              <span className="block transform rotate-180" style={{ writingMode: 'vertical-rl' }}>
                OverFlowing
              </span>
            </h1>
          </Link>
        </div>

      </aside>

      {/* 移动端侧边栏 - 首页显示，其他页面通过isOpen控制 */}
      <motion.aside 
        initial={false}
        animate={{ 
          x: (pathname === '/' || isOpen) ? 0 : -80
        }}
        transition={{ duration: 0.3, ease: 'easeInOut' }}
        className={`lg:hidden fixed left-0 top-0 h-screen w-20 bg-white flex flex-col py-8 z-50 ${
          (pathname === '/' || isOpen) ? 'block' : 'hidden'
        }`}
      >
        {/* 移动端关闭按钮 */}
        {isOpen && pathname !== '/' && (
          <button
            onClick={onClose}
            className="absolute top-2 right-2 p-1 text-gray-600 hover:text-black transition-colors"
            aria-label="关闭菜单"
          >
            <X size={16} />
          </button>
        )}

        {/* 艺术家姓名 - 移动端竖排 */}
        <div className="flex flex-col items-center mb-6 mt-4">
          <Link 
            href="/"
            className="group"
            aria-label="返回首页"
            onClick={handleLinkClick}
          >
            <h1 className="font-serif text-sm font-light text-gray-900 group-hover:text-black transition-colors duration-300 tracking-wider">
              <span className="block" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
                OverFlowing
              </span>
            </h1>
          </Link>
        </div>

        {/* 移动端导航菜单 - 字符竖排 */}
        <nav className="flex-1">
          <ul className="space-y-2 px-2 flex flex-col items-center">
            {navigationItems.map((item) => {
              const isActive = pathname === item.href || 
                (item.href !== '/' && pathname.startsWith(item.href))
              
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    onClick={handleLinkClick}
                    className={`block py-1 px-1 text-xs transition-colors duration-300 ${
                      isActive
                        ? 'bg-gray-100 text-black font-medium'
                        : 'text-gray-700 hover:bg-gray-50 hover:text-black'
                    }`}
                    aria-label={item.label}
                  >
                    <span className="block" style={{ writingMode: 'vertical-rl', textOrientation: 'mixed' }}>
                      {item.name}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
      </motion.aside>
    </>
  )
}
