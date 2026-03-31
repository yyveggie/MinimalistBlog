import type { Metadata } from 'next'
import { Analytics } from '@vercel/analytics/react'
import './globals.css'

// 使用CSS变量定义字体，避免Google Fonts网络问题
const fontVariables: React.CSSProperties = {
  '--font-playfair': 'Playfair Display, Georgia, Times New Roman, serif',
  '--font-inter': 'Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif'
} as React.CSSProperties

// 网站元数据配置
export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'),
  title: 'OverFlowing - Developer & Adventurer',
  description: 'Personal website of a passionate developer and lifelong learner exploring technology and creativity.',
  keywords: ['developer', 'AI', 'web development', 'programming', 'technology'],
  authors: [{ name: 'OverFlowing' }],
  openGraph: {
    title: 'OverFlowing - Developer & Adventurer',
    description: 'Personal website of a passionate developer and lifelong learner exploring technology and creativity.',
    type: 'website',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'OverFlowing - Developer & Adventurer',
    description: 'Personal website of a passionate developer and lifelong learner exploring technology and creativity.',
  },
  robots: {
    index: true,
    follow: true,
  },
}

interface RootLayoutProps {
  children: React.ReactNode
}

/**
 * 根布局组件
 * 提供全站的基础结构、字体配置和元数据
 */
export default function RootLayout({ children }: RootLayoutProps) {
  return (
    <html lang="en" style={fontVariables}>
      <head>
        {/* Favicon */}
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        {/* Google Fonts - 使用CDN加载，避免构建时网络问题 */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link 
          href="https://fonts.googleapis.com/css2?family=Playfair+Display:wght@300;400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap" 
          rel="stylesheet"
        />
      </head>
      <body className="font-sans antialiased">
        {/* 页面主要内容 */}
        <main className="min-h-screen">
          {children}
        </main>
        <Analytics />
      </body>
    </html>
  )
}
