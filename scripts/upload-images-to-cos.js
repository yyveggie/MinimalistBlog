/**
 * 批量上传本地图片到腾讯云COS
 * 
 * 使用方法：
 * node scripts/upload-images-to-cos.js
 */

// 加载环境变量
require('dotenv').config({ path: '.env.local' })

const COS = require('cos-nodejs-sdk-v5')
const fs = require('fs')
const path = require('path')

// COS配置
const cos = new COS({
    SecretId: process.env.TENCENT_SECRET_ID,
    SecretKey: process.env.TENCENT_SECRET_KEY,
})

const Bucket = process.env.TENCENT_BUCKET || 'mypage-images-1313131901'
const Region = process.env.TENCENT_REGION || 'ap-shanghai'

// 要上传的目录
const UPLOAD_DIRS = [
    'public/images/photos',
    'public/images/music',
    'public/images/movies',
    'public/images/projects',
]

// 获取所有图片文件
function getAllImages(dir, baseDir = '') {
    const results = []

    if (!fs.existsSync(dir)) {
        console.log(`⚠️ 目录不存在: ${dir}`)
        return results
    }

    const items = fs.readdirSync(dir)

    for (const item of items) {
        const fullPath = path.join(dir, item)
        const stat = fs.statSync(fullPath)

        if (stat.isDirectory()) {
            // 递归处理子目录
            results.push(...getAllImages(fullPath, baseDir || dir))
        } else if (/\.(jpg|jpeg|png|gif|webp|svg)$/i.test(item)) {
            // 图片文件
            const relativePath = path.relative(baseDir || dir, fullPath)
            results.push({
                localPath: fullPath,
                cosKey: `images/${path.relative('public/images', fullPath)}`.replace(/\\/g, '/'),
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
            if (err) {
                reject(err)
            } else {
                resolve(data)
            }
        })
    })
}

// 主函数
async function main() {
    console.log('🚀 开始上传图片到腾讯云COS...\n')
    console.log(`📦 存储桶: ${Bucket}`)
    console.log(`🌍 地域: ${Region}\n`)

    // 收集所有图片
    const allImages = []
    for (const dir of UPLOAD_DIRS) {
        const images = getAllImages(dir)
        allImages.push(...images)
        console.log(`📁 ${dir}: ${images.length} 个文件`)
    }

    console.log(`\n📊 共 ${allImages.length} 个图片文件\n`)

    if (allImages.length === 0) {
        console.log('❌ 没有找到图片文件')
        return
    }

    // 逐个上传
    let success = 0
    let failed = 0

    for (const image of allImages) {
        try {
            await uploadFile(image.localPath, image.cosKey)
            console.log(`✅ ${image.cosKey}`)
            success++
        } catch (error) {
            console.log(`❌ ${image.cosKey} - ${error.message}`)
            failed++
        }
    }

    console.log(`\n📊 上传完成: ${success} 成功, ${failed} 失败`)

    // 输出COS访问URL格式
    console.log('\n📋 COS访问URL格式:')
    console.log(`https://${Bucket}.cos.${Region}.myqcloud.com/images/photos/xxx.png`)

    // 生成URL映射
    console.log('\n📝 URL映射（可用于替换本地路径）:')
    for (const image of allImages.slice(0, 5)) {
        const localPath = image.localPath.replace('public', '')
        const cosUrl = `https://${Bucket}.cos.${Region}.myqcloud.com/${image.cosKey}`
        console.log(`  ${localPath} -> ${cosUrl}`)
    }
    if (allImages.length > 5) {
        console.log(`  ... 还有 ${allImages.length - 5} 个文件`)
    }
}

main().catch(console.error)
