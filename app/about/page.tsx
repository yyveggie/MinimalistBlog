'use client'

import { motion } from 'framer-motion'
import Layout from '@/components/Layout'

/**
 * 关于页面组件
 * 展示艺术家的详细生平和艺术理念
 */
export default function AboutPage() {
  return (
    <Layout>
        <div className="container-custom py-20">

          {/* 主要内容 */}
          <div className="grid lg:grid-cols-3 gap-12">
            {/* 传记部分 */}
            <motion.div
              initial={{ x: -30, opacity: 0 }}
              whileInView={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.8 }}
              viewport={{ once: true }}
              className="lg:col-span-2 space-y-8"
            >
              <section>
                <div className="text-sm font-light text-gray-1000 space-y-4">
                  <p>
                    一名学生，同时也是一位开发者。对于 AI 的发展充满激情，期待有一天人类与人造生命共生的一天。
                  </p>

                  <p>
                    爱冒险，只要想做，或许会慢，但一定会去尝试。
                    爱音乐，听小濑村晶的现代古典，听汉斯季默的交响乐，也听 k-pop 的流行乐。
                    爱电影，记录电影已超过1100部。
                  </p>

                  <p>
                    一身"反骨"，通常不会选择多数人的选择，因此在这个社会之中，都需要寻找与主流价值和做自己之间的平衡。
                  </p>

                  <p>
                  感叹时间过得是如此之快，想学的、想做的事太多太多，但似乎永远学不完、也做不完。不过无论如何，事情再多，时间再短，都需要慢慢来。
                  </p>
                </div>
              </section>

              <section>
                <h2 className="font-serif text-2xl font-light text-gray-900 mb-4">
                 Philosophy
                </h2>
                <div className="text-sm font-light text-gray-1000 space-y-4">
                  <p>
                  Life is too short to worry about stupid things. Do great works. Have fun. Fall in love, also be independent. In the midst of chaos, never stop being yourself. Study, think, create, grow, and regret nothing.
                  </p>
                </div>
              </section>
            </motion.div>

            {/* 侧边信息 */}
            <motion.div
              initial={{ x: 30, opacity: 0 }}
              whileInView={{ x: 0, opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              viewport={{ once: true }}
              className="space-y-8"
            >
              {/* 基本信息 */}
              <div>
                <h3 className="font-serif text-xl font-medium text-gray-900 mb-4">
                  基本信息
                </h3>
                <dl className="space-y-3">
                  <div>
                    <dt className="text-sm font-medium text-gray-800">所在地</dt>
                    <dd className="text-sm font-light text-gray-800">上海</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-800">专业方向</dt>
                    <dd className="text-sm font-light text-gray-800">AI 算法开发，UI/UX，Web</dd>
                  </div>
                  <div>
                    <dt className="text-sm font-medium text-gray-800">编程起始</dt>
                    <dd className="text-sm font-light text-gray-800">2022 - 至今</dd>
                  </div>
                </dl>
              </div>

            </motion.div>
          </div>
        </div>
    </Layout>
  )
}
