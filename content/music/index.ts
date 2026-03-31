/**
 * 音乐数据类型定义
 * 与原 NotionMusic 保持一致
 */
export interface StaticMusic {
    id: string
    title: string
    artist: string
    genre: string
    linkUrl: string
    coverUrl: string
    type: 'music'
    status: string
    contentSummary?: string
    updatedAt: string
}

export interface StaticMusicDetail extends StaticMusic {
    htmlContent: string
}

// COS 基础 URL
const COS_BASE = 'https://mypage-images-1313131901.cos.ap-shanghai.myqcloud.com'

// ==================== 音乐数据 ====================

/**
 * Dear Sunshine - 新古典主义
 */
export const dearSunshine: StaticMusicDetail = {
    id: 'dear-sunshine',
    title: 'Dear Sunshine',
    artist: '小濑村晶',
    genre: '新古典主义',
    linkUrl: 'https://music.163.com/song?id=2059965273&uct2=U2FsdGVkX1/Sk3r+orkR+Q3ONfdPYciI1hYLiuUHmD8=',
    coverUrl: `${COS_BASE}/images/music/dear-sunshine.png`,
    type: 'music',
    status: '已发布',
    contentSummary: '专辑: SEASONS',
    updatedAt: '2025-09-28',
    htmlContent: ``
}

// ==================== 音乐列表 ====================

export const allMusic: StaticMusic[] = [
    dearSunshine,
    // 在这里添加更多音乐...
]

export const allMusicDetails: Record<string, StaticMusicDetail> = {
    'dear-sunshine': dearSunshine,
    // 在这里添加更多音乐详情...
}

/**
 * 获取音乐列表
 */
export function getMusic(): StaticMusic[] {
    return allMusic.filter(m => m.status === '已发布')
}

/**
 * 根据 ID 获取音乐详情
 */
export function getMusicById(id: string): StaticMusicDetail | null {
    return allMusicDetails[id] || null
}

/**
 * 获取所有流派
 */
export function getAllMusicGenres(): string[] {
    const genres = new Set(allMusic.map(m => m.genre))
    return ['全部', ...Array.from(genres)]
}
