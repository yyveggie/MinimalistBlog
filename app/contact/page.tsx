'use client'

import { motion } from 'framer-motion'
import { Mail, MapPin, Phone } from 'lucide-react'
import Layout from '@/components/Layout'

/**
 * 联系页面组件
 * 提供联系表单和联系信息
 */
export default function ContactPage() {
  return (
    <Layout>
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="container-custom py-16"
        >
          <div className="max-w-4xl mx-auto text-center space-y-8 font-light">
            <p className="text-lg text-gray-600">
              无论您是对合作感兴趣、想要讨论项目，还是只想打个招呼
            </p>

            <div className="text-sm font-light text-gray-1000">
              <div className="flex items-center justify-center space-x-3">
                <Mail size={18} className="text-gray-500" />
                <span>邮箱：yyveggie@gmail.com</span>
              </div>
              <div className="flex items-center justify-center space-x-3 mt-2">
                <MapPin size={18} className="text-gray-500" />
                <span>所在地：上海，杭州</span>
              </div>
              <div className="flex items-center justify-center space-x-3 mt-2">
                <Phone size={18} className="text-gray-500" />
                <span>工作方式：支持远程工作</span>
              </div>
            </div>
          </div>
        </motion.section>
    </Layout>
  )
}
