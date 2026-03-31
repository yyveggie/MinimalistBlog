/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'cdn.sanity.io'
      },
      {
        protocol: 'https',
        hostname: 'www.notion.so'
      },
      {
        protocol: 'https',
        hostname: 's3.us-west-2.amazonaws.com'
      },
      {
        protocol: 'https',
        hostname: 'prod-files-secure.s3.us-west-2.amazonaws.com'
      },
      {
        protocol: 'https',
        hostname: '*.cos.*.myqcloud.com'
      },
      {
        protocol: 'https', 
        hostname: 'mypage-images-1313131901.cos.ap-shanghai.myqcloud.com'
      }
    ],
    dangerouslyAllowSVG: true
  },
  
  experimental: {
    // 暂时禁用包优化以避免构建超时
    // optimizePackageImports: ['lucide-react']
  },
  
  // 编译器配置
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production'
  }
}

module.exports = nextConfig
