/**
 * 照片数据类型定义
 * 与原 NotionPhoto 保持一致
 */
export interface StaticPhoto {
    id: string
    title: string
    location: string
    date: string
    category: string
    camera: string
    lens: string
    description: string
    story: string
    imageUrl: string  // 封面图（第一张）
    imageUrls: string[] // 支持多张照片
    status: string
}

// COS 基础 URL
const COS_BASE = 'https://mypage-images-1313131901.cos.ap-shanghai.myqcloud.com'

// ==================== 照片数据 ====================

/**
 * 猫的睡姿 - 宠物摄影
 */
export const catSleepPhoto: StaticPhoto = {
    id: 'cat-sleep',
    title: '猫的睡姿',
    location: '诸暨',
    date: '2025-07-01',
    category: '宠物',
    camera: 'iPhone 14 Pro',
    lens: '',
    description: '暑假的时候，偶尔撞见我家猫的各种睡姿',
    story: '暑假的时候，偶尔撞见我家猫的各种睡姿',
    imageUrl: `${COS_BASE}/images/photos/cat-sleep-1.png`,
    imageUrls: [
        `${COS_BASE}/images/photos/cat-sleep-1.png`,
        `${COS_BASE}/images/photos/cat-sleep-2.png`,
        `${COS_BASE}/images/photos/cat-sleep-3.png`,
        `${COS_BASE}/images/photos/cat-sleep-4.png`,
        `${COS_BASE}/images/photos/cat-sleep-5.png`,
        `${COS_BASE}/images/photos/cat-sleep-6.png`,
        `${COS_BASE}/images/photos/cat-sleep-7.png`,
        `${COS_BASE}/images/photos/cat-sleep-8.png`,
        `${COS_BASE}/images/photos/cat-sleep-9.png`,
    ],
    status: '已发布'
}

/**
 * 世界行一：美国纽约｜波士顿 - 城市摄影
 */
export const worldUsaPhoto: StaticPhoto = {
    id: 'world-usa',
    title: '世界行一：美国纽约｜波士顿',
    location: '纽约，波士顿',
    date: '2019-07-20',
    category: '城市',
    camera: 'Samsung S8',
    lens: '',
    description: '在2019年夏天，我来参加麻省理工学院的访学项目',
    story: '在2019年夏天，我来参加麻省理工学院的访学项目，来到了我从小梦寐以求的地方——纽约和波士顿，因为这里是全球最科幻、学术最集中的地方。',
    imageUrl: `${COS_BASE}/images/photos/world_usa/usa-1.png`,
    imageUrls: [
        `${COS_BASE}/images/photos/world_usa/usa-1.png`,
        `${COS_BASE}/images/photos/world_usa/usa-2.png`,
        `${COS_BASE}/images/photos/world_usa/usa-3.png`,
        `${COS_BASE}/images/photos/world_usa/usa-4.png`,
        `${COS_BASE}/images/photos/world_usa/usa-5.png`,
    ],
    status: '已发布'
}

/**
 * 世界行二：日本东京 - 城市摄影
 */
export const worldJapanPhoto: StaticPhoto = {
    id: 'world-japan',
    title: '世界行二：日本东京',
    location: '东京',
    date: '2024-01-02',
    category: '城市',
    camera: 'iPhone 14 Pro',
    lens: '',
    description: '在2024年初，我一个人来到了东京',
    story: '在2024年初，我一个人来到了东京，只因我喜欢那些精美的动画电影，以及想看看日本的城市和生活。',
    imageUrl: `${COS_BASE}/images/photos/world_japan/japan-1.png`,
    imageUrls: [
        `${COS_BASE}/images/photos/world_japan/japan-1.png`,
        `${COS_BASE}/images/photos/world_japan/japan-2.png`,
        `${COS_BASE}/images/photos/world_japan/japan-3.png`,
        `${COS_BASE}/images/photos/world_japan/japan-4.png`,
        `${COS_BASE}/images/photos/world_japan/japan-5.png`,
    ],
    status: '已发布'
}

// ==================== 照片列表 ====================

/**
 * 所有照片的列表（按时间倒序：最新的在前面）
 */
export const allPhotos: StaticPhoto[] = [
    worldJapanPhoto,   // 2024年 - 最新
    worldUsaPhoto,     // 2019年
    catSleepPhoto,     // 宠物 - 最后
    // 在这里添加更多照片项目...
]

/**
 * 照片详情映射（用于详情页）
 */
export const allPhotoDetails: Record<string, StaticPhoto> = {
    'cat-sleep': catSleepPhoto,
    'world-usa': worldUsaPhoto,
    'world-japan': worldJapanPhoto,
    // 在这里添加更多照片详情...
}

/**
 * 获取照片列表
 */
export function getPhotos(): StaticPhoto[] {
    return allPhotos.filter(p => p.status === '已发布')
}

/**
 * 根据 ID 获取照片详情
 */
export function getPhotoById(id: string): StaticPhoto | null {
    return allPhotoDetails[id] || null
}

/**
 * 获取所有分类
 */
export function getAllPhotoCategories(): string[] {
    const categories = new Set(allPhotos.map(p => p.category))
    return ['全部', ...Array.from(categories)]
}
