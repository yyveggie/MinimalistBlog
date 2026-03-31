/**
 * 项目数据类型定义
 * 与原 NotionProject/NotionProjectDetail 保持一致
 */
export interface StaticProject {
  id: string
  title: string
  description: string
  category: string
  demo?: string
  image: string
  featured: boolean
  status: string
  startDate: string
  endDate?: string
  slug: string
}

export interface StaticProjectDetail extends StaticProject {
  htmlContent: string  // 预渲染的 HTML 内容
}

// COS 基础 URL
const COS_BASE = 'https://mypage-images-1313131901.cos.ap-shanghai.myqcloud.com'

// ==================== 项目数据 ====================

export const personalBlog: StaticProjectDetail = {
  id: 'personal-blog',
  title: '个人博客',
  description: '个人作品展示网站，支持动态内容管理、多媒体展示和响应式设计。通过 Notion 作为 CMS，实现了内容与代码的分离，让非技术用户也能轻松管理网站内容。',
  category: 'Full Stack',
  demo: 'https://overflowing.live',
  image: `${COS_BASE}/images/projects/personal-blog.png`,
  featured: true,
  status: '已发布',
  startDate: '2025-09-25',
  slug: 'personal-blog',
  htmlContent: `

    <p>很小的时候我就想拥有一个自己的博客网站，自己的硬盘里写过的各类文章有几百篇，但始终只是给自己记录。大学之后会敲代码就尝试过很多方法，大概前前后后应该有创建过七八个，但是由于很多原因都受制于其他人的技术，所以一直没有持续下去。</p>
    
    <p>然而终于到了现在，感谢借助于人工智能技术的发展，我虽然不会前后端，但懂点算法，也能创建这样的博客，感叹技术的发展，缩短了人类的学习时间。</p>
    
    <p>我喜欢创造，也喜欢分享，这是我分享的起点。</p>
    
  `
}

export const synSpirit: StaticProjectDetail = {
  id: 'synspirit',
  title: 'SynSpirit 资讯社区',
  description: 'SynSpirit 是一个尝试用AI来全站设计并运行的知识共享平台。集成了文章发布、问答系统、AI聊天助手、动态分享等功能。平台为知识工作者提供高质量的思考和交流环境，支持多种AI模型进行智能对话，具备完整的用户管理、内容管理和社交互动功能。',
  category: 'Full Stack',
  demo: 'https://synspirit.com',
  image: `${COS_BASE}/images/projects/synspirit.png`,
  featured: true,
  status: '已发布',
  startDate: '2025-08-26',
  slug: 'synspirit',
  htmlContent: `
    <p>SynSpirit 是一个尝试用AI来全站设计并运行的知识共享平台。</p>
  `
}

export const uniNoteBook: StaticProjectDetail = {
  id: 'uninotebook',
  title: 'UniNoteBook',
  description: 'UniNoteBook 是我做的第一个功能性产品，它面向于教育行业，让学习从厚重变为更加轻便。',
  category: 'Full Stack',
  demo: 'https://uninotebook.com',
  image: `${COS_BASE}/images/projects/uninotebook.png`,
  featured: true,
  status: '已发布',
  startDate: '2025-01-01',
  slug: 'uninotebook',
  htmlContent: `
    <p>这算是我尝试的第一个功能产品，主要是面向教育领域，根据上传的文档进行事实性问答，但是很多功能还处于初级阶段，不过个人感觉问答已经能达到不错的程度了，只是服务器限制，可能会有点慢，等之后有反响之后再加大配置。目前所有功能都是免费的，应该会长久保持免费状态。</p>
  `
}

// ==================== 项目列表 ====================

/**
 * 所有项目的列表（仅元数据，用于列表页）
 */
export const allProjects: StaticProject[] = [
  personalBlog,
  synSpirit,
  uniNoteBook,
  // 在这里添加更多项目...
]

/**
 * 所有项目的详情（包含 HTML 内容）
 */
export const allProjectDetails: Record<string, StaticProjectDetail> = {
  'personal-blog': personalBlog,
  'synspirit': synSpirit,
  'uninotebook': uniNoteBook,
  // 在这里添加更多项目详情...
}

/**
 * 获取项目列表
 */
export function getProjects(): StaticProject[] {
  return allProjects.filter(p => p.status === '已发布')
}

/**
 * 根据 ID 获取项目详情
 */
export function getProjectById(id: string): StaticProjectDetail | null {
  return allProjectDetails[id] || null
}

/**
 * 获取所有分类
 */
export function getAllCategories(): string[] {
  const categories = new Set(allProjects.map(p => p.category))
  return ['全部', ...Array.from(categories)]
}
