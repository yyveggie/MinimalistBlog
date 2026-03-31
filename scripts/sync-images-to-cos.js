/**
 * 自动同步图片到腾讯云COS
 * 
 * 功能：
 * 1. 增量上传 - 只上传新图片，跳过已存在的
 * 2. 生成代码片段 - 输出可复制的 TypeScript 代码
 * 3. 智能识别目录结构
 * 
 * 使用方法：
 * npm run sync-images
 * npm run sync-images -- --force  # 强制重新上传所有图片
 */

require('dotenv').config({ path: '.env.local' })

const COS = require('cos-nodejs-sdk-v5')
const fs = require('fs')
const path = require('path')
const crypto = require('crypto')

// COS配置
const cos = new COS({
    SecretId: process.env.TENCENT_SECRET_ID,
    SecretKey: process.env.TENCENT_SECRET_KEY,
})

const Bucket = process.env.TENCENT_BUCKET || 'mypage-images-1313131901'
const Region = process.env.TENCENT_REGION || 'ap-shanghai'
const COS_BASE = `https://${Bucket}.cos.${Region}.myqcloud.com`

// 缓存文件路径 - 记录已上传的文件
const CACHE_FILE = path.join(process.cwd(), '.cos-upload-cache.json')

// 要同步的目录
const SYNC_DIRS = [
    { local: 'public/images/photos', cos: 'images/photos', type: 'photos' },
    { local: 'public/images/music', cos: 'images/music', type: 'music' },
    { local: 'public/images/movies', cos: 'images/movies', type: 'movies' },
    { local: 'public/images/projects', cos: 'images/projects', type: 'projects' },
]

// 读取缓存
function loadCache() {
    try {
        if (fs.existsSync(CACHE_FILE)) {
            return JSON.parse(fs.readFileSync(CACHE_FILE, 'utf-8'))
        }
    } catch (e) {
        console.log('⚠️ 缓存文件损坏，将重新上传所有文件')
    }
    return { uploaded: {} }
}

// 保存缓存
function saveCache(cache) {
    fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2))
}

// 计算文件 MD5
function getFileMD5(filePath) {
    const content = fs.readFileSync(filePath)
    return crypto.createHash('md5').update(content).digest('hex')
}

// 获取目录下所有图片
function getImages(dir, baseDir = '') {
    const results = []

    if (!fs.existsSync(dir)) {
        return results
    }

    const items = fs.readdirSync(dir)

    for (const item of items) {
        const fullPath = path.join(dir, item)
        const stat = fs.statSync(fullPath)

        if (stat.isDirectory()) {
            results.push(...getImages(fullPath, baseDir || dir))
        } else if (/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(item)) {
            const relativePath = path.relative(baseDir || dir, fullPath).replace(/\\/g, '/')
            results.push({
                localPath: fullPath,
                relativePath,
                filename: item,
                md5: getFileMD5(fullPath),
            })
        }
    }

    return results
}

// 上传单个文件
async function uploadFile(localPath, cosKey) {
    return new Promise((resolve, reject) => {
        cos.uploadFile({
            Bucket,
            Region,
            Key: cosKey,
            FilePath: localPath,
        }, (err, data) => {
            if (err) reject(err)
            else resolve(data)
        })
    })
}

// 主函数
async function main() {
    const forceUpload = process.argv.includes('--force')
    const cache = forceUpload ? { uploaded: {} } : loadCache()

    console.log('🚀 开始同步图片到腾讯云COS...\n')
    console.log(`📦 存储桶: ${Bucket}`)
    console.log(`🌍 地域: ${Region}`)
    console.log(`🔗 基础URL: ${COS_BASE}`)
    if (forceUpload) console.log('⚠️ 强制模式：将重新上传所有图片')
    console.log('')

    const newImages = []
    const skippedImages = []
    const failedImages = []

    for (const syncDir of SYNC_DIRS) {
        const images = getImages(syncDir.local)

        console.log(`📁 ${syncDir.local}: ${images.length} 个文件`)

        for (const image of images) {
            const cosKey = `${syncDir.cos}/${image.relativePath}`
            const cacheKey = `${cosKey}:${image.md5}`

            // 检查是否已上传
            if (cache.uploaded[cosKey] === image.md5) {
                skippedImages.push({ ...image, cosKey, type: syncDir.type })
                continue
            }

            try {
                await uploadFile(image.localPath, cosKey)
                cache.uploaded[cosKey] = image.md5
                newImages.push({ ...image, cosKey, type: syncDir.type })
                console.log(`  ✅ ${image.relativePath}`)
            } catch (error) {
                failedImages.push({ ...image, cosKey, error: error.message })
                console.log(`  ❌ ${image.relativePath} - ${error.message}`)
            }
        }
    }

    // 保存缓存
    saveCache(cache)

    // 输出统计
    console.log('\n' + '='.repeat(60))
    console.log('📊 同步完成!')
    console.log(`  ✅ 新上传: ${newImages.length}`)
    console.log(`  ⏭️ 已跳过: ${skippedImages.length}`)
    console.log(`  ❌ 失败: ${failedImages.length}`)

    // 如果有新上传的图片，生成代码片段
    if (newImages.length > 0) {
        console.log('\n' + '='.repeat(60))
        console.log('📝 新上传的图片URL（可复制使用）:\n')

        // 按类型分组
        const byType = {}
        for (const img of newImages) {
            if (!byType[img.type]) byType[img.type] = []
            byType[img.type].push(img)
        }

        for (const [type, images] of Object.entries(byType)) {
            console.log(`【${type}】`)
            for (const img of images) {
                const url = `${COS_BASE}/${img.cosKey}`
                console.log(`  '${url}',`)
            }
            console.log('')
        }

        // 生成 TypeScript 代码示例
        console.log('='.repeat(60))
        console.log('💻 TypeScript 代码片段:\n')
        console.log('// 添加到 content 文件中使用:')
        console.log(`const COS_BASE = '${COS_BASE}'`)
        console.log('')
        for (const img of newImages.slice(0, 5)) {
            console.log(`// ${img.filename}`)
            console.log(`\`\${COS_BASE}/${img.cosKey}\``)
        }
        if (newImages.length > 5) {
            console.log(`// ... 还有 ${newImages.length - 5} 个`)
        }
    }

    console.log('\n✨ 完成!')
}

main().catch(console.error)
