/**
 * 删除腾讯云COS上的HEIC文件
 * 
 * 使用方法：
 * 1. 确保 .env.local 中有 TENCENT_SECRET_ID 和 TENCENT_SECRET_KEY
 * 2. 运行: node delete-heic-from-cos.js
 */

require('dotenv').config({ path: '.env.local' });
const COS = require('cos-nodejs-sdk-v5');

const cos = new COS({
  SecretId: process.env.TENCENT_SECRET_ID,
  SecretKey: process.env.TENCENT_SECRET_KEY,
});

const Bucket = process.env.TENCENT_BUCKET || 'mypage-images-1313131901';
const Region = process.env.TENCENT_REGION || 'ap-shanghai';

async function listAllFiles() {
  return new Promise((resolve, reject) => {
    cos.getBucket({
      Bucket,
      Region,
      Prefix: 'images/',
      MaxKeys: 1000,
    }, (err, data) => {
      if (err) reject(err);
      else resolve(data.Contents || []);
    });
  });
}

async function deleteFile(key) {
  return new Promise((resolve, reject) => {
    cos.deleteObject({
      Bucket,
      Region,
      Key: key,
    }, (err, data) => {
      if (err) reject(err);
      else resolve(data);
    });
  });
}

async function main() {
  console.log('🔍 正在扫描COS上的HEIC文件...\n');
  
  try {
    const files = await listAllFiles();
    const heicFiles = files.filter(file => 
      file.Key.toLowerCase().endsWith('.heic') || 
      file.Key.toLowerCase().endsWith('.heif')
    );
    
    if (heicFiles.length === 0) {
      console.log('✅ 没有找到HEIC文件');
      return;
    }
    
    console.log(`📋 找到 ${heicFiles.length} 个HEIC文件：\n`);
    heicFiles.forEach((file, index) => {
      const sizeMB = (file.Size / 1024 / 1024).toFixed(2);
      console.log(`${index + 1}. ${file.Key} (${sizeMB} MB)`);
    });
    
    console.log('\n⚠️  是否删除这些文件？(y/n)');
    
    process.stdin.once('data', async (data) => {
      const answer = data.toString().trim().toLowerCase();
      
      if (answer === 'y' || answer === 'yes') {
        console.log('\n🗑️  开始删除...\n');
        
        let deleted = 0;
        let failed = 0;
        
        for (const file of heicFiles) {
          try {
            await deleteFile(file.Key);
            console.log(`✅ 已删除: ${file.Key}`);
            deleted++;
          } catch (error) {
            console.error(`❌ 删除失败: ${file.Key}`, error.message);
            failed++;
          }
        }
        
        console.log(`\n📊 总计:`);
        console.log(`   成功: ${deleted}`);
        console.log(`   失败: ${failed}`);
        console.log(`\n✅ 完成！`);
      } else {
        console.log('❌ 已取消删除');
      }
      
      process.exit(0);
    });
    
  } catch (error) {
    console.error('❌ 错误:', error.message);
    process.exit(1);
  }
}

main();
