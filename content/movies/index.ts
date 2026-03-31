/**
 * 电影数据类型定义
 * 与原 NotionMovie 保持一致
 */
export interface StaticMovie {
    id: string
    title: string
    genre: string
    director: string
    posterUrl: string  // 本地图片路径，如 /images/movies/xxx.jpg
    doubanUrl: string
    type: 'movie'
    status: string
    contentSummary?: string
    updatedAt: string
}

export interface StaticMovieDetail extends StaticMovie {
    htmlContent: string  // 预渲染的 HTML 内容
}

// ==================== 电影数据 ====================
// 请将海报图放到 public/images/movies/ 目录下

export const exampleMovie: StaticMovieDetail = {
    id: 'example-movie',
    title: '示例电影',
    genre: '剧情',
    director: '示例导演',
    posterUrl: '/images/movies/example.jpg',
    doubanUrl: 'https://movie.douban.com',
    type: 'movie',
    status: '已发布',
    contentSummary: '这是一部示例电影',
    updatedAt: '2024-01-01',
    htmlContent: `
    <p>这是电影的详细介绍内容。</p>
  `
}

// ==================== 电影列表 ====================

export const allMovies: StaticMovie[] = [
    exampleMovie,
    // 在这里添加更多电影...
]

export const allMovieDetails: Record<string, StaticMovieDetail> = {
    'example-movie': exampleMovie,
    // 在这里添加更多电影详情...
}

/**
 * 获取电影列表
 */
export function getMovies(): StaticMovie[] {
    return allMovies.filter(m => m.status === '已发布')
}

/**
 * 根据 ID 获取电影详情
 */
export function getMovieById(id: string): StaticMovieDetail | null {
    return allMovieDetails[id] || null
}

/**
 * 获取所有类型
 */
export function getAllMovieGenres(): string[] {
    const genres = new Set(allMovies.map(m => m.genre))
    return ['全部', ...Array.from(genres)]
}
