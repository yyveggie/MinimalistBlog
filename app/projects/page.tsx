'use client'

import { motion } from 'framer-motion'
import { ExternalLink, Calendar, Code2, Tag } from 'lucide-react'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Layout from '@/components/Layout'

interface StaticProject {
  id: string
  title: string
  description: string
  category: string
  technologies: string[]
  demo?: string
  image?: string
  featured: boolean
  status: string
  startDate: string
  endDate?: string
  slug: string
}

/**
 * 项目展示页面组件
 * 从本地静态文件获取数据，无需复杂缓存
 */
export default function ProjectsPage() {
  const [selectedCategory, setSelectedCategory] = useState('全部')
  const [projects, setProjects] = useState<StaticProject[]>([])
  const [categories, setCategories] = useState<string[]>(['全部'])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchProjects()
  }, [])

  const fetchProjects = async () => {
    try {
      setLoading(true)
      // 静态内容，添加时间戳强制刷新（开发时）
      const response = await fetch(`/api/projects?t=${Date.now()}`)
      if (!response.ok) {
        throw new Error('Failed to fetch projects')
      }
      const data = await response.json()
      setProjects(data)

      const allCategories = new Set<string>()
      data.forEach((project: StaticProject) => {
        allCategories.add(project.category)
      })
      setCategories(['全部', ...Array.from(allCategories)])
    } catch (err) {
      setError('获取项目列表失败，请稍后重试')
    } finally {
      setLoading(false)
    }
  }

  const filteredProjects = selectedCategory === '全部'
    ? projects
    : projects.filter(project => project.category === selectedCategory)

  if (loading) {
    return (
      <Layout>
        <div className="container-custom py-20">
          <div className="text-center">
            <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-gray-900 mx-auto"></div>
            <p className="mt-4 text-gray-600">正在加载项目列表...</p>
          </div>
        </div>
      </Layout>
    )
  }

  if (error) {
    return (
      <Layout>
        <div className="container-custom py-20">
          <div className="text-center">
            <p className="text-red-600 text-lg">{error}</p>
            <button
              onClick={fetchProjects}
              className="mt-6 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700"
            >
              重新加载
            </button>
          </div>
        </div>
      </Layout>
    )
  }

  return (
    <Layout>
      <div className="py-16 px-4 sm:px-6 lg:px-8 lg:pr-24 max-w-7xl mx-auto">
        {/* 分类过滤 */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="max-w-4xl mx-auto mb-16 flex flex-wrap justify-center gap-3"
        >
          {categories.map(category => (
            <button
              key={category}
              onClick={() => setSelectedCategory(category)}
              className={`px-4 py-2 rounded-full text-sm font-light transition-colors duration-300 ${selectedCategory === category
                ? 'bg-gray-900 text-white shadow-md'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
            >
              {category}
            </button>
          ))}
        </motion.div>


        {/* 所有项目列表 */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          whileInView={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true, amount: 0.3 }}
          className="max-w-6xl mx-auto"
        >
          {filteredProjects.length === 0 ? (
            <p className="text-center text-gray-600">暂无项目。</p>
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredProjects.map((project, index) => (
                <motion.article
                  key={project.id}
                  initial={{ y: 30, opacity: 0 }}
                  animate={{ y: 0, opacity: 1 }}
                  transition={{ duration: 0.6, delay: 0.05 * index }}
                  className="group"
                >
                  <Link href={`/projects/${project.id}`}>
                    <div className="border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg hover:-translate-y-1 transition-all duration-300 bg-white group-hover:border-gray-300">
                      {/* 项目图片 */}
                      <div className="aspect-video relative overflow-hidden">
                        <img
                          src={project.image || '/images/fallback.jpg'}
                          alt={project.title}
                          className="w-full h-full object-cover"
                          loading={index >= 4 ? 'lazy' : 'eager'}
                        />
                      </div>

                      <div className="p-6">
                        <div className="flex flex-wrap gap-2 mb-3">
                          <span className="bg-gray-100 text-gray-700 text-xs px-2 py-1 rounded-full">
                            {project.category}
                          </span>
                        </div>
                        <h3 className="font-serif text-lg font-medium text-gray-900 group-hover:text-black mb-3 transition-colors duration-300">
                          {project.title}
                        </h3>
                        <p className="text-gray-600 text-sm mb-4 leading-relaxed line-clamp-2">
                          {project.description}
                        </p>

                        <div className="flex items-center justify-between text-xs text-gray-500">
                          <div className="flex items-center">
                            <Calendar size={12} className="mr-1" />
                            {new Date(project.startDate).toLocaleDateString('zh-CN')}
                          </div>
                          <div className="flex items-center space-x-2">
                            {project.demo && (
                              <ExternalLink size={14} className="text-gray-400" />
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.article>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* 底部空间 */}
      <div className="h-20"></div>
    </Layout>
  )
}