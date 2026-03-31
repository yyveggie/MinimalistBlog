import { Client } from '@notionhq/client'

// 初始化 Notion 客户端
export const notion = new Client({
  auth: process.env.NOTION_TOKEN,
})

/**
 * 带重试机制的 Notion API 调用包装器
 */
async function withRetry<T>(operation: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await operation()
    } catch (error: any) {
      const isNetworkError = error.code === 'ECONNRESET' ||
        error.code === 'ENOTFOUND' ||
        error.message?.includes('fetch failed') ||
        error.message?.includes('network')

      if (isNetworkError && i < maxRetries - 1) {
        // 网络错误且还有重试次数，等待后重试
        const delay = Math.pow(2, i) * 1000 // 指数退避：1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, delay))
        continue
      }

      // 非网络错误或重试次数用完，抛出错误
      throw error
    }
  }
  throw new Error('Max retries reached')
}

/**
 * 从Notion块中提取文本内容（用于生成摘要）
 */
function extractTextFromBlock(block: any): string {
  try {
    switch (block.type) {
      case 'paragraph':
        return block.paragraph?.rich_text?.map((rt: any) => rt.plain_text).join('') || ''
      case 'heading_1':
        return block.heading_1?.rich_text?.map((rt: any) => rt.plain_text).join('') || ''
      case 'heading_2':
        return block.heading_2?.rich_text?.map((rt: any) => rt.plain_text).join('') || ''
      case 'heading_3':
        return block.heading_3?.rich_text?.map((rt: any) => rt.plain_text).join('') || ''
      case 'bulleted_list_item':
        return block.bulleted_list_item?.rich_text?.map((rt: any) => rt.plain_text).join('') || ''
      case 'numbered_list_item':
        return block.numbered_list_item?.rich_text?.map((rt: any) => rt.plain_text).join('') || ''
      case 'quote':
        return block.quote?.rich_text?.map((rt: any) => rt.plain_text).join('') || ''
      case 'callout':
        return block.callout?.rich_text?.map((rt: any) => rt.plain_text).join('') || ''
      case 'toggle':
        return block.toggle?.rich_text?.map((rt: any) => rt.plain_text).join('') || ''
      default:
        return ''
    }
  } catch (error) {
    return ''
  }
}

// 数据库 ID 配置
export const databases = {
  reflections: process.env.NOTION_REFLECTIONS_DB_ID!,
  projects: process.env.NOTION_PROJECTS_DB_ID!,
  pageConfig: process.env.NOTION_PAGE_CONFIG_DB_ID!, // 页面配置数据库
}

// 页面配置类型定义
export interface PageConfig {
  pageName: string // 页面名称（reflections, projects, photo）
  motto?: string // 页面签名/座右铭（可选）
}

// 类型定义
export interface NotionReflection {
  id: string
  title: string
  slug: string
  tags: string[]
  status: string
  updatedAt: string // 更新时间
  views: number // 阅读量
}

export interface NotionReflectionDetail extends NotionReflection {
  content: any[] // Notion blocks
}

// 项目类型定义
export interface NotionProject {
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

export interface NotionProjectDetail extends NotionProject {
  content: any[] // Notion blocks
}

/**
 * 获取所有已发布的随记文章
 */
export async function getReflections(): Promise<NotionReflection[]> {
  try {
    // 先不使用过滤器，获取所有数据，然后在代码中过滤
    // 这样可以避免字段类型不匹配的问题
    const response = await withRetry(() =>
      notion.databases.query({
        database_id: databases.reflections,
      })
    )

    return response.results
      .map((page: any) => {
        const properties = page.properties

        // 获取状态值，支持多种字段类型
        let status = '草稿'
        if (properties['状态']) {
          if (properties['状态'].select?.name) {
            status = properties['状态'].select.name
          } else if (properties['状态'].status?.name) {
            status = properties['状态'].status.name
          } else if (properties['状态'].rich_text?.[0]?.plain_text) {
            status = properties['状态'].rich_text[0].plain_text
          }
        }

        // 智能获取标题字段 - 支持多种字段名和数据结构
        let title = '无标题'

        // 尝试不同的字段名（包括可能的字段名）
        const titleFields = ['标题', 'Title', 'title', 'Name', 'name', '名称']
        for (const fieldName of titleFields) {
          if (properties[fieldName]) {
            // 尝试不同的数据结构路径
            if (properties[fieldName].title?.[0]?.plain_text) {
              title = properties[fieldName].title[0].plain_text
              break
            } else if (properties[fieldName].rich_text?.[0]?.plain_text) {
              title = properties[fieldName].rich_text[0].plain_text
              break
            } else if (properties[fieldName].name) {
              title = properties[fieldName].name
              break
            }
          }
        }

        return {
          id: page.id,
          title: title,
          slug: page.id, // 使用 Notion page ID 作为 slug
          tags: properties['标签']?.multi_select?.map((tag: any) => tag.name) || [],
          status: status,
          updatedAt: (page as any).last_edited_time || new Date().toISOString(),
          views: properties['阅读量']?.number || 0
        }
      })
      .filter((reflection: any) =>
        // 在代码中过滤已发布的文章
        reflection.status === '已发布' ||
        reflection.status === 'Published' ||
        reflection.status === 'published'
      )
  } catch (error) {
    return []
  }
}

/**
 * 根据 ID 获取单篇随记详情
 */
export async function getReflectionById(pageId: string): Promise<NotionReflectionDetail | null> {
  try {
    // 获取页面基本信息
    const page = await withRetry(() => notion.pages.retrieve({ page_id: pageId }))
    const properties = (page as any).properties

    // 获取页面内容块
    const blocks = await withRetry(() => notion.blocks.children.list({
      block_id: pageId,
      page_size: 100
    }))

    const reflection: NotionReflectionDetail = {
      id: page.id,
      title: properties['标题']?.title?.[0]?.plain_text || '无标题',
      slug: page.id,
      tags: properties['标签']?.multi_select?.map((tag: any) => tag.name) || [],
      status: properties['状态']?.select?.name || '草稿',
      content: blocks.results,
      updatedAt: (page as any).last_edited_time || new Date().toISOString(),
      views: properties['阅读量']?.number || 0
    }

    return reflection
  } catch (error) {
    return null
  }
}

/**
 * 将 Notion 块转换为 HTML
 */
export function renderNotionBlock(block: any): string {
  switch (block.type) {
    case 'paragraph':
      const text = block.paragraph.rich_text
        .map((t: any) => {
          let content = t.plain_text
          if (t.annotations.bold) content = `<strong>${content}</strong>`
          if (t.annotations.italic) content = `<em>${content}</em>`
          if (t.annotations.code) content = `<code>${content}</code>`
          if (t.href) content = `<a href="${t.href}" target="_blank">${content}</a>`
          return content
        })
        .join('')
      return `<p>${text}</p>`

    case 'heading_1':
      const h1Text = block.heading_1.rich_text.map((t: any) => t.plain_text).join('')
      return `<h1>${h1Text}</h1>`

    case 'heading_2':
      const h2Text = block.heading_2.rich_text.map((t: any) => t.plain_text).join('')
      return `<h2>${h2Text}</h2>`

    case 'heading_3':
      const h3Text = block.heading_3.rich_text.map((t: any) => t.plain_text).join('')
      return `<h3>${h3Text}</h3>`

    case 'bulleted_list_item':
      const listText = block.bulleted_list_item.rich_text
        .map((t: any) => {
          let content = t.plain_text
          if (t.annotations.bold) content = `<strong>${content}</strong>`
          if (t.annotations.italic) content = `<em>${content}</em>`
          if (t.annotations.code) content = `<code>${content}</code>`
          if (t.href) content = `<a href="${t.href}" target="_blank">${content}</a>`
          return content
        })
        .join('')
      return `<li>${listText}</li>`

    case 'numbered_list_item':
      const numberedText = block.numbered_list_item.rich_text
        .map((t: any) => {
          let content = t.plain_text
          if (t.annotations.bold) content = `<strong>${content}</strong>`
          if (t.annotations.italic) content = `<em>${content}</em>`
          if (t.annotations.code) content = `<code>${content}</code>`
          if (t.href) content = `<a href="${t.href}" target="_blank">${content}</a>`
          return content
        })
        .join('')
      return `<li>${numberedText}</li>`

    case 'code':
      const codeText = block.code.rich_text.map((t: any) => t.plain_text).join('')
      const language = block.code.language || 'text'
      return `<pre><code class="language-${language}">${codeText}</code></pre>`

    case 'image':
      const imageUrl = block.image.type === 'external'
        ? block.image.external.url
        : block.image.file.url
      const caption = block.image.caption?.map((t: any) => t.plain_text).join('') || ''

      // 🔧 支持 Notion 图片宽度设置
      // Notion API 可能不直接提供宽度，但我们可以使用合理的默认值
      // 如果需要精确控制，可以在 Notion 中使用 caption 来指定宽度（如 "width:800px"）
      let imageStyle = ''
      let imageCaption = caption

      // 尝试从 caption 中提取宽度设置（格式：width:XXXpx）
      const widthMatch = caption.match(/width:(\d+)(%|px)?/i)
      if (widthMatch) {
        const width = widthMatch[1]
        const unit = widthMatch[2] || 'px'
        imageStyle = `max-width: ${width}${unit};`
        // 从 caption 中移除宽度设置
        imageCaption = caption.replace(/width:\d+(%|px)?/gi, '').trim()
      }

      const imgTag = `<img src="${imageUrl}" alt="${imageCaption}" style="${imageStyle}" />`

      // 如果有 caption，用 figure 包裹
      if (imageCaption) {
        return `<figure style="text-align: center; margin: 2rem 0;">
          ${imgTag}
          <figcaption style="margin-top: 0.5rem; font-size: 0.875rem; color: #6b7280; font-style: italic;">${imageCaption}</figcaption>
        </figure>`
      }

      return imgTag

    case 'embed':
      const embedUrl = block.embed.url
      // 简单显示链接，不嵌入播放器
      return `<div class="embed-container">
        <a href="${embedUrl}" target="_blank" rel="noopener noreferrer" class="embed-link">
          🔗 ${embedUrl}
        </a>
      </div>`

    case 'quote':
      const quoteText = block.quote.rich_text.map((t: any) => t.plain_text).join('')
      return `<blockquote>${quoteText}</blockquote>`

    case 'table_of_contents':
      // Notion 原生目录块
      // 使用特殊标记，前端会自动生成目录
      return `<div class="notion-toc" data-toc="true"></div>`

    case 'video':
      return renderVideoEmbed(block.video)

    case 'embed':
      return renderEmbedContent(block.embed)

    default:
      return ''
  }
}

/**
 * 渲染视频嵌入
 */
function renderVideoEmbed(video: any): string {
  const videoUrl = video.type === 'external' ? video.external.url : video.file?.url
  if (!videoUrl) return ''

  // B站视频处理
  if (videoUrl.includes('bilibili.com') || videoUrl.includes('b23.tv')) {
    return renderBilibiliVideo(videoUrl)
  }

  // YouTube视频处理
  if (videoUrl.includes('youtube.com') || videoUrl.includes('youtu.be')) {
    return renderYouTubeVideo(videoUrl)
  }

  // 默认HTML5视频播放器
  return `<div class="video-container" style="margin: 20px 0; text-align: center;">
    <video controls style="width: 100%; max-width: 800px; height: auto; border-radius: 8px;">
      <source src="${videoUrl}" type="video/mp4">
      您的浏览器不支持视频播放。
    </video>
  </div>`
}

/**
 * 渲染嵌入内容
 */
function renderEmbedContent(embed: any): string {
  const embedUrl = embed.url
  if (!embedUrl) return ''

  // 视频链接处理
  if (embedUrl.includes('bilibili.com') || embedUrl.includes('b23.tv')) {
    return renderBilibiliVideo(embedUrl)
  }

  if (embedUrl.includes('youtube.com') || embedUrl.includes('youtu.be')) {
    return renderYouTubeVideo(embedUrl)
  }

  // 默认iframe嵌入
  return `<div class="embed-container" style="margin: 20px 0;">
    <iframe src="${embedUrl}" 
            style="width: 100%; height: 400px; border: none; border-radius: 8px;" 
            allowfullscreen="true"
            loading="lazy">
    </iframe>
  </div>`
}

/**
 * B站视频嵌入
 */
function renderBilibiliVideo(url: string): string {
  try {
    let bvid = ''
    let aid = ''

    // 提取BV号或AV号
    const bvMatch = url.match(/(?:BV|bv)([a-zA-Z0-9]+)/)
    const avMatch = url.match(/(?:av|AV)(\d+)/)

    if (bvMatch) {
      bvid = 'BV' + bvMatch[1]
    } else if (avMatch) {
      aid = avMatch[1]
    } else {
      // 如果无法提取，返回链接
      return `<p><a href="${url}" target="_blank" rel="noopener noreferrer">观看B站视频: ${url}</a></p>`
    }

    const embedUrl = bvid
      ? `//player.bilibili.com/player.html?bvid=${bvid}&page=1&high_quality=1&danmaku=0`
      : `//player.bilibili.com/player.html?aid=${aid}&page=1&high_quality=1&danmaku=0`

    return `<div class="video-embed-container" style="position: relative; width: 100%; height: 0; padding-bottom: 56.25%; margin: 20px 0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
      <iframe src="${embedUrl}" 
              style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none;" 
              allowfullscreen="true"
              loading="lazy">
      </iframe>
    </div>`
  } catch (error) {
    return `<p><a href="${url}" target="_blank" rel="noopener noreferrer">观看B站视频: ${url}</a></p>`
  }
}

/**
 * YouTube视频嵌入
 */
function renderYouTubeVideo(url: string): string {
  try {
    let videoId = ''

    // 提取YouTube视频ID
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/)
    if (match) {
      videoId = match[1]
    } else {
      return `<p><a href="${url}" target="_blank" rel="noopener noreferrer">观看YouTube视频: ${url}</a></p>`
    }

    const embedUrl = `https://www.youtube.com/embed/${videoId}?rel=0&showinfo=0`

    return `<div class="video-embed-container" style="position: relative; width: 100%; height: 0; padding-bottom: 56.25%; margin: 20px 0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
      <iframe src="${embedUrl}" 
              style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: none;" 
              allowfullscreen="true"
              loading="lazy">
      </iframe>
    </div>`
  } catch (error) {
    return `<p><a href="${url}" target="_blank" rel="noopener noreferrer">观看YouTube视频: ${url}</a></p>`
  }
}



/**
 * 将 Notion 内容块数组转换为 HTML
 * 🔧 增强：自动包裹连续的列表项在 <ul> 或 <ol> 标签中
 * 🚀 支持预渲染的静态 HTML（来自 content/ 目录）
 */
export function renderNotionContent(blocks: any[]): string {
  // 🚀 检查是否是预渲染的静态 HTML（来自静态文件）
  if (blocks.length === 1 && blocks[0].type === 'prerendered_html') {
    return blocks[0].html
  }

  const result: string[] = []
  let currentListType: 'bulleted' | 'numbered' | null = null
  let currentListItems: string[] = []

  const flushList = () => {
    if (currentListItems.length > 0) {
      if (currentListType === 'bulleted') {
        result.push(`<ul>${currentListItems.join('')}</ul>`)
      } else if (currentListType === 'numbered') {
        result.push(`<ol>${currentListItems.join('')}</ol>`)
      }
      currentListItems = []
      currentListType = null
    }
  }

  blocks.forEach(block => {
    if (block.type === 'bulleted_list_item') {
      if (currentListType !== 'bulleted') {
        flushList()
        currentListType = 'bulleted'
      }
      currentListItems.push(renderNotionBlock(block))
    } else if (block.type === 'numbered_list_item') {
      if (currentListType !== 'numbered') {
        flushList()
        currentListType = 'numbered'
      }
      currentListItems.push(renderNotionBlock(block))
    } else {
      flushList()
      result.push(renderNotionBlock(block))
    }
  })

  flushList() // 处理最后的列表

  return result.join('\n')
}

/**
 * 更新文章阅读量
 */
export async function incrementViews(pageId: string): Promise<void> {
  try {
    // 先获取当前阅读量
    const page = await notion.pages.retrieve({ page_id: pageId })
    const currentViews = (page as any).properties['阅读量']?.number || 0

    // 更新阅读量
    await notion.pages.update({
      page_id: pageId,
      properties: {
        '阅读量': {
          number: currentViews + 1,
        },
      },
    })
  } catch (error) {
  }
}

// ==================== 音乐管理 ====================

export interface NotionMusic {
  id: string
  title: string
  artist: string
  genre: string
  linkUrl: string
  coverUrl: string | null
  type: 'music'
  status: string
  contentSummary?: string // Notion正文摘要
  updatedAt: string // 更新时间
}

/**
 * 根据 ID 获取单个音乐详情
 */
export async function getMusicById(pageId: string): Promise<NotionMusicDetail | null> {
  try {
    // 获取页面基本信息
    const page = await withRetry(() => notion.pages.retrieve({ page_id: pageId }))
    const properties = (page as any).properties

    // 获取页面内容块
    const blocks = await withRetry(() => notion.blocks.children.list({
      block_id: pageId,
      page_size: 100
    }))

    // 获取状态值
    let status = '草稿'
    if (properties['状态']) {
      if (properties['状态'].select?.name) {
        status = properties['状态'].select.name
      } else if (properties['状态'].status?.name) {
        status = properties['状态'].status.name
      } else if (properties['状态'].rich_text?.[0]?.plain_text) {
        status = properties['状态'].rich_text[0].plain_text
      }
    }

    // 获取封面图片
    const coverFiles = properties['封面']?.files || []
    const coverUrl = coverFiles.length > 0 ? coverFiles[0].file?.url || coverFiles[0].external?.url : null

    const music: NotionMusicDetail = {
      id: page.id,
      title: properties['歌曲名称']?.title?.[0]?.plain_text || '未知歌曲',
      artist: properties['艺术家']?.rich_text?.[0]?.plain_text || '未知艺术家',
      genre: properties['流派']?.select?.name || '未分类',
      linkUrl: properties['链接']?.url || '#',
      coverUrl: coverUrl,
      type: 'music' as const,
      status: status,
      content: blocks.results,
      updatedAt: (page as any).last_edited_time || new Date().toISOString()
    }

    return music
  } catch (error) {
    return null
  }
}

export interface NotionMusicDetail extends NotionMusic {
  content: any[] // Notion页面内容块
}

/**
 * 根据 ID 获取单个电影详情
 */
export async function getMovieById(pageId: string): Promise<NotionMovieDetail | null> {
  try {
    // 获取页面基本信息
    const page = await withRetry(() => notion.pages.retrieve({ page_id: pageId }))
    const properties = (page as any).properties

    // 获取页面内容块
    const blocks = await withRetry(() => notion.blocks.children.list({
      block_id: pageId,
      page_size: 100
    }))

    // 获取状态值
    let status = '草稿'
    if (properties['状态']) {
      if (properties['状态'].select?.name) {
        status = properties['状态'].select.name
      } else if (properties['状态'].status?.name) {
        status = properties['状态'].status.name
      } else if (properties['状态'].rich_text?.[0]?.plain_text) {
        status = properties['状态'].rich_text[0].plain_text
      }
    }

    // 获取海报图片
    const posterFiles = properties['海报']?.files || []
    const posterUrl = posterFiles.length > 0 ? posterFiles[0].file?.url || posterFiles[0].external?.url : null

    const movie: NotionMovieDetail = {
      id: page.id,
      title: properties['电影名称']?.title?.[0]?.plain_text || '未知电影',
      genre: properties['类型']?.select?.name || '未分类',
      director: properties['导演']?.rich_text?.[0]?.plain_text || '',
      posterUrl: posterUrl,
      doubanUrl: properties['豆瓣链接']?.url || '#',
      type: 'movie' as const,
      status: status,
      content: blocks.results,
      updatedAt: (page as any).last_edited_time || new Date().toISOString()
    }

    return movie
  } catch (error) {
    return null
  }
}

export interface NotionMovieDetail extends NotionMovie {
  content: any[] // Notion页面内容块
}

export async function getMusicFromNotion(): Promise<NotionMusic[]> {
  try {
    const databaseId = process.env.NOTION_MUSIC_DB_ID
    if (!databaseId) {
      return []
    }

    const response = await notion.databases.query({
      database_id: databaseId,
      sorts: [
        {
          timestamp: 'last_edited_time', // 按最后编辑时间排序
          direction: 'descending'         // 降序：最新的在最前面
        }
      ]
    })

    const musicItems = await Promise.all(
      response.results.map(async (page: any) => {
        const properties = page.properties

        // 获取状态值，支持多种字段类型
        let status = '草稿'
        if (properties['状态']) {
          if (properties['状态'].select?.name) {
            status = properties['状态'].select.name
          } else if (properties['状态'].status?.name) {
            status = properties['状态'].status.name
          } else if (properties['状态'].rich_text?.[0]?.plain_text) {
            status = properties['状态'].rich_text[0].plain_text
          }
        }

        // 获取封面图片
        const coverFiles = properties['封面']?.files || []
        const coverUrl = coverFiles.length > 0 ? coverFiles[0].file?.url || coverFiles[0].external?.url : null

        // 🚀 性能优化：移除列表页摘要生成，直接使用 Notion 描述字段
        // 原来每个条目都要额外调用 API 获取正文，导致性能瓶颈
        const contentSummary = properties['简介']?.rich_text?.[0]?.plain_text ||
          properties['描述']?.rich_text?.[0]?.plain_text ||
          ''

        return {
          id: page.id,
          title: properties['歌曲名称']?.title?.[0]?.plain_text || '未知歌曲',
          artist: properties['艺术家']?.rich_text?.[0]?.plain_text || '未知艺术家',
          genre: properties['流派']?.select?.name || '未分类',
          linkUrl: properties['链接']?.url || '#',
          coverUrl: coverUrl,
          type: 'music' as const,
          status: status,
          contentSummary: contentSummary,
          updatedAt: (page as any).last_edited_time || new Date().toISOString()
        }
      })
    )

    return musicItems.filter((music: any) =>
      music.status === '已发布' ||
      music.status === 'Published' ||
      music.status === 'published'
    )
  } catch (error) {
    return []
  }
}

// ==================== 电影管理 ====================

export interface NotionMovie {
  id: string
  title: string
  genre: string
  director?: string // 导演
  posterUrl: string | null
  doubanUrl: string
  type: 'movie'
  status: string
  contentSummary?: string // Notion正文摘要
  updatedAt: string // 更新时间
}

export async function getMoviesFromNotion(): Promise<NotionMovie[]> {
  try {
    const databaseId = process.env.NOTION_MOVIES_DB_ID
    if (!databaseId) {
      return []
    }

    const response = await notion.databases.query({
      database_id: databaseId,
      sorts: [
        {
          timestamp: 'last_edited_time', // 按最后编辑时间排序
          direction: 'descending'         // 降序：最新的在最前面
        }
      ]
    })

    const movieItems = await Promise.all(
      response.results.map(async (page: any) => {
        const properties = page.properties

        // 获取状态值，支持多种字段类型
        let status = '草稿'
        if (properties['状态']) {
          if (properties['状态'].select?.name) {
            status = properties['状态'].select.name
          } else if (properties['状态'].status?.name) {
            status = properties['状态'].status.name
          } else if (properties['状态'].rich_text?.[0]?.plain_text) {
            status = properties['状态'].rich_text[0].plain_text
          }
        }

        // 🚀 性能优化：移除列表页摘要生成，直接使用 Notion 描述字段
        // 原来每个条目都要额外调用 API 获取正文，导致性能瓶颈
        const contentSummary = properties['简介']?.rich_text?.[0]?.plain_text ||
          properties['描述']?.rich_text?.[0]?.plain_text ||
          ''

        return {
          id: page.id,
          title: properties['电影名称']?.title?.[0]?.plain_text || '未知电影',
          genre: properties['类型']?.select?.name || '未分类',
          director: properties['导演']?.rich_text?.[0]?.plain_text || '',
          posterUrl: (() => {
            const posterFiles = properties['海报']?.files || []
            return posterFiles.length > 0 ? posterFiles[0].file?.url || posterFiles[0].external?.url : null
          })(),
          doubanUrl: properties['豆瓣链接']?.url || '#',
          type: 'movie' as const,
          status: status,
          contentSummary: contentSummary,
          updatedAt: (page as any).last_edited_time || new Date().toISOString()
        }
      })
    )

    return movieItems.filter((movie: any) =>
      movie.status === '已发布' ||
      movie.status === 'Published' ||
      movie.status === 'published'
    )
  } catch (error) {
    return []
  }
}

// ==================== 照片管理 ====================

export interface NotionPhoto {
  id: string
  title: string
  location: string
  date: string
  category: string
  camera: string
  lens: string
  description: string
  story: string
  imageUrl: string | null
  imageUrls: string[] // 支持多张照片
  status: string
}

export async function getPhotosFromNotion(): Promise<NotionPhoto[]> {
  try {
    const databaseId = process.env.NOTION_PHOTOS_DB_ID
    if (!databaseId) {
      return []
    }

    const response = await notion.databases.query({
      database_id: databaseId,
      sorts: [
        {
          timestamp: 'created_time',
          direction: 'descending',
        },
      ],
    })

    return response.results
      .map((page: any) => {
        const properties = page.properties
        const files = properties['照片']?.files || []
        const imageUrl = files.length > 0 ? files[0].file?.url || files[0].external?.url : null
        const imageUrls = files.map((file: any) => file.file?.url || file.external?.url).filter(Boolean)

        // 获取状态值，支持多种字段类型
        let status = '草稿'
        if (properties['状态']) {
          if (properties['状态'].select?.name) {
            status = properties['状态'].select.name
          } else if (properties['状态'].status?.name) {
            status = properties['状态'].status.name
          } else if (properties['状态'].rich_text?.[0]?.plain_text) {
            status = properties['状态'].rich_text[0].plain_text
          }
        }

        return {
          id: page.id,
          title: properties['标题']?.title?.[0]?.plain_text || '无标题',
          location: properties['拍摄地点']?.rich_text?.[0]?.plain_text || '未知地点',
          date: properties['拍摄日期']?.date?.start || new Date().toISOString(),
          category: properties['分类']?.select?.name || '其他',
          camera: properties['相机型号']?.rich_text?.[0]?.plain_text || '未知相机',
          lens: properties['镜头']?.rich_text?.[0]?.plain_text || '未知镜头',
          description: properties['描述']?.rich_text?.[0]?.plain_text || '无描述',
          story: properties['背后故事']?.rich_text?.[0]?.plain_text || '无故事',
          imageUrl: imageUrl,
          imageUrls: imageUrls,
          status: status
        }
      })
      .filter((photo: any) =>
        photo.status === '已发布' ||
        photo.status === 'Published' ||
        photo.status === 'published'
      )
  } catch (error) {
    return []
  }
}

/**
 * 根据 ID 获取单张照片详情
 * 🚀 性能优化：直接获取单个页面，而不是查询整个列表
 */
export async function getPhotoById(pageId: string): Promise<NotionPhoto | null> {
  try {
    // 获取页面基本信息
    const page = await withRetry(() => notion.pages.retrieve({ page_id: pageId }))
    const properties = (page as any).properties

    // 获取照片文件
    const files = properties['照片']?.files || []
    const imageUrl = files.length > 0 ? files[0].file?.url || files[0].external?.url : null
    const imageUrls = files.map((file: any) => file.file?.url || file.external?.url).filter(Boolean)

    // 获取状态值，支持多种字段类型
    let status = '草稿'
    if (properties['状态']) {
      if (properties['状态'].select?.name) {
        status = properties['状态'].select.name
      } else if (properties['状态'].status?.name) {
        status = properties['状态'].status.name
      } else if (properties['状态'].rich_text?.[0]?.plain_text) {
        status = properties['状态'].rich_text[0].plain_text
      }
    }

    const photo: NotionPhoto = {
      id: page.id,
      title: properties['标题']?.title?.[0]?.plain_text || '无标题',
      location: properties['拍摄地点']?.rich_text?.[0]?.plain_text || '未知地点',
      date: properties['拍摄日期']?.date?.start || new Date().toISOString(),
      category: properties['分类']?.select?.name || '其他',
      camera: properties['相机型号']?.rich_text?.[0]?.plain_text || '未知相机',
      lens: properties['镜头']?.rich_text?.[0]?.plain_text || '未知镜头',
      description: properties['描述']?.rich_text?.[0]?.plain_text || '无描述',
      story: properties['背后故事']?.rich_text?.[0]?.plain_text || '无故事',
      imageUrl: imageUrl,
      imageUrls: imageUrls,
      status: status
    }

    return photo
  } catch (error) {
    console.error(`获取照片失败 (${pageId}):`, error)
    return null
  }
}

// ==================== 主页设置管理 ====================

export interface NotionHomepage {
  id: string
  heroTitle: string
  heroSubtitle: string
  heroImagePosition: string // 'center' | 'top' | 'bottom'
  heroImageScale: string // 'cover' | 'contain' | 'fill'
  heroImageSize: string // 'small' | 'medium' | 'large' | 'xlarge'
  aboutTitle: string
  aboutContent: string[]
  isActive: boolean
}

export async function getHomepageSettings(): Promise<NotionHomepage | null> {
  try {
    const databaseId = process.env.NOTION_HOMEPAGE_DB_ID
    if (!databaseId) {
      return null
    }

    const response = await withRetry(() =>
      notion.databases.query({
        database_id: databaseId,
        sorts: [
          {
            property: '更新时间',
            direction: 'descending',
          },
        ],
      })
    )

    const pages = response.results
      .map((page: any) => {
        const properties = page.properties

        // 获取状态值
        let isActive = false
        if (properties['状态']) {
          if (properties['状态'].checkbox !== undefined) {
            isActive = properties['状态'].checkbox
          } else if (properties['状态'].select?.name === '启用') {
            isActive = true
          }
        }

        // 获取关于内容（多段文字）
        const aboutContent = []
        for (let i = 1; i <= 5; i++) {
          const paragraph = properties[`关于内容${i}`]?.rich_text?.[0]?.plain_text
          if (paragraph && paragraph.trim()) {
            aboutContent.push(paragraph.trim())
          }
        }

        return {
          id: page.id,
          heroTitle: properties['主页标题']?.rich_text?.[0]?.plain_text || 'OverFlowing',
          heroSubtitle: properties['主页副标题']?.rich_text?.[0]?.plain_text || 'Developer & Adventurer',
          heroImagePosition: properties['背景图位置']?.select?.name || 'center',
          heroImageScale: properties['背景图缩放']?.select?.name || 'cover',
          heroImageSize: properties['背景图大小']?.select?.name || 'small',
          aboutTitle: properties['关于标题']?.rich_text?.[0]?.plain_text || 'Welcome to My World',
          aboutContent,
          isActive
        }
      })

    // 仅返回启用的页面（恢复原行为）
    const activePage = pages.find((page: any) => page.isActive)
    return activePage || null
  } catch (error) {
    return null
  }
}

// ==================== 项目管理 ====================

/**
 * 获取所有已发布的项目
 */
export async function getProjects(): Promise<NotionProject[]> {
  try {
    const response = await notion.databases.query({
      database_id: databases.projects,
      sorts: [
        {
          property: '开始日期',
          direction: 'descending',
        },
      ],
    })

    return response.results
      .map((page: any) => {
        const properties = page.properties

        // 获取状态值
        let status = '草稿'
        const statusFields = ['状态', 'Status', 'status', '项目状态']
        for (const fieldName of statusFields) {
          if (properties[fieldName]) {
            if (properties[fieldName].select?.name) {
              status = properties[fieldName].select.name
              break
            } else if (properties[fieldName].status?.name) {
              status = properties[fieldName].status.name
              break
            } else if (properties[fieldName].rich_text?.[0]?.plain_text) {
              status = properties[fieldName].rich_text[0].plain_text
              break
            }
          }
        }

        // 智能获取标题字段
        let title = '无标题'
        const titleFields = ['标题', 'Title', 'title', 'Name', 'name', '名称', '项目名称']
        for (const fieldName of titleFields) {
          if (properties[fieldName]) {
            if (properties[fieldName].title?.[0]?.plain_text) {
              title = properties[fieldName].title[0].plain_text
              break
            } else if (properties[fieldName].rich_text?.[0]?.plain_text) {
              title = properties[fieldName].rich_text[0].plain_text
              break
            } else if (properties[fieldName].name) {
              title = properties[fieldName].name
              break
            }
          }
        }

        return {
          id: page.id,
          title: title,
          description: properties['描述']?.rich_text?.[0]?.plain_text || properties['Description']?.rich_text?.[0]?.plain_text || properties['项目描述']?.rich_text?.[0]?.plain_text || '',
          category: properties['分类']?.select?.name || properties['Category']?.select?.name || properties['项目分类']?.select?.name || 'Other',
          technologies: properties['技术栈']?.multi_select?.map((tech: any) => tech.name) || properties['Technologies']?.multi_select?.map((tech: any) => tech.name) || [],
          demo: properties['演示链接']?.url || properties['Demo']?.url || '',
          image: properties['封面图']?.files?.[0]?.file?.url || properties['Image']?.files?.[0]?.file?.url || properties['项目封面']?.files?.[0]?.file?.url || '',
          featured: properties['特色项目']?.checkbox || properties['Featured']?.checkbox || false,
          status: status,
          startDate: properties['开始日期']?.date?.start || properties['Start Date']?.date?.start || new Date().toISOString(),
          endDate: properties['结束日期']?.date?.start || properties['End Date']?.date?.start || properties['完成日期']?.date?.start || '',
          slug: page.id,
        }
      })
      .filter((project: any) =>
        project.status === '已发布' ||
        project.status === 'Published' ||
        project.status === 'published' ||
        project.status === '完成'
      )
  } catch (error) {
    return []
  }
}

/**
 * 根据 ID 获取单个项目详情
 */
export async function getProjectById(pageId: string): Promise<NotionProjectDetail | null> {
  try {
    const page = await notion.pages.retrieve({ page_id: pageId })
    const properties = (page as any).properties

    const blocks = await notion.blocks.children.list({
      block_id: pageId,
      page_size: 100
    })

    // 智能获取标题字段
    let title = '无标题'
    const titleFields = ['标题', 'Title', 'title', 'Name', 'name', '名称', '项目名称']
    for (const fieldName of titleFields) {
      if (properties[fieldName]) {
        if (properties[fieldName].title?.[0]?.plain_text) {
          title = properties[fieldName].title[0].plain_text
          break
        } else if (properties[fieldName].rich_text?.[0]?.plain_text) {
          title = properties[fieldName].rich_text[0].plain_text
          break
        } else if (properties[fieldName].name) {
          title = properties[fieldName].name
          break
        }
      }
    }

    // 获取状态值（与getProjects保持一致）
    let status = '草稿'
    const statusFields = ['状态', 'Status', 'status', '项目状态']
    for (const fieldName of statusFields) {
      if (properties[fieldName]) {
        if (properties[fieldName].select?.name) {
          status = properties[fieldName].select.name
          break
        } else if (properties[fieldName].status?.name) {
          status = properties[fieldName].status.name
          break
        } else if (properties[fieldName].rich_text?.[0]?.plain_text) {
          status = properties[fieldName].rich_text[0].plain_text
          break
        }
      }
    }

    const project: NotionProjectDetail = {
      id: page.id,
      title: title,
      description: properties['描述']?.rich_text?.[0]?.plain_text || properties['Description']?.rich_text?.[0]?.plain_text || properties['项目描述']?.rich_text?.[0]?.plain_text || '',
      category: properties['分类']?.select?.name || properties['Category']?.select?.name || properties['项目分类']?.select?.name || 'Other',
      technologies: properties['技术栈']?.multi_select?.map((tech: any) => tech.name) || properties['Technologies']?.multi_select?.map((tech: any) => tech.name) || [],
      demo: properties['演示链接']?.url || properties['Demo']?.url || '',
      image: properties['封面图']?.files?.[0]?.file?.url || properties['Image']?.files?.[0]?.file?.url || properties['项目封面']?.files?.[0]?.file?.url || '',
      featured: properties['特色项目']?.checkbox || properties['Featured']?.checkbox || false,
      status: status,
      startDate: properties['开始日期']?.date?.start || properties['Start Date']?.date?.start || new Date().toISOString(),
      endDate: properties['结束日期']?.date?.start || properties['End Date']?.date?.start || properties['完成日期']?.date?.start || '',
      slug: page.id,
      content: blocks.results
    }

    return project
  } catch (error) {
    return null
  }
}

/**
 * 从 Notion 获取页面配置（包括签名）
 * @param pageName 页面名称（reflections, projects, photo 等）
 * @returns 页面配置对象，如果未找到或未设置则返回 null
 */
export async function getPageConfig(pageName: string): Promise<PageConfig | null> {
  try {
    // 如果没有配置数据库 ID，返回 null
    if (!databases.pageConfig) {
      console.warn('⚠️ NOTION_PAGE_CONFIG_DB_ID 未配置')
      return null
    }

    const response = await withRetry(() =>
      notion.databases.query({
        database_id: databases.pageConfig,
        filter: {
          property: '页面名称',
          rich_text: {
            equals: pageName
          }
        }
      })
    )

    if (response.results.length === 0) {
      return null
    }

    const page: any = response.results[0]
    const properties = page.properties

    // 获取签名（如果没有或为空则返回 undefined）
    const motto = properties['签名']?.rich_text?.[0]?.plain_text ||
      properties['Motto']?.rich_text?.[0]?.plain_text ||
      undefined

    return {
      pageName,
      motto
    }
  } catch (error) {
    console.error(`❌ 获取页面配置失败 (${pageName}):`, error)
    return null
  }
}
