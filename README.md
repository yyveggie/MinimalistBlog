# MinimalistBlog

基于 Next.js 14 和 Notion API 构建的极简个人作品集网站模板，部署于 Vercel。

[![Next.js](https://img.shields.io/badge/Next.js-14.0-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.2-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3.3-38bdf8?logo=tailwindcss)](https://tailwindcss.com/)
[![Vercel](https://img.shields.io/badge/Deployed%20on-Vercel-black?logo=vercel)](https://vercel.com/)

---

## 特性

- **Notion 作为 CMS** — 在 Notion 中编辑内容，网站自动同步展示
- **三层缓存** — 客户端 localStorage + 服务端内存 + 腾讯云 COS，保证速度与实时性
- **响应式布局** — 桌面端固定侧栏 + 移动端折叠菜单，适配全终端
- **Framer Motion 动画** — 页面过渡和元素动画
- **腾讯云 COS 图片托管** — Notion 图片自动转存 COS，避免链接过期
- **B 站 / YouTube 视频嵌入** — 音乐和电影页面支持视频播放
- **SEO 优化** — OpenGraph、Twitter Card、结构化元数据
- **Vercel Analytics** — 内置访问分析

---

## 页面与功能

| 页面 | 路由 | 数据来源 | 说明 |
|------|------|----------|------|
| 首页 | `/` | Notion (homepage 数据库) | Hero 大图 + 个人介绍，支持在 Notion 中配置标题、副标题、图片位置/缩放 |
| 关于 | `/about` | 硬编码 | 个人简介、Philosophy、联系方式 |
| 项目 | `/projects` | Notion (projects 数据库) | 作品展示，支持技术栈标签、特色项目高亮、演示链接 |
| 随记 | `/reflections` | Notion (reflections 数据库) | 博客系统，支持标签分类、阅读量统计、Notion 富文本渲染 |
| 相片 | `/photo` | 静态数据 + COS | 摄影画廊，记录相机/镜头/地点/故事，支持多图浏览 |
| 音乐&电影 | `/music-movie` | 静态数据 | 个人收藏，支持 B 站/YouTube 视频嵌入 |
| 联系 | `/contact` | 硬编码 | 联系方式 |
| 同步 | `/sync` | — | 管理后台（需认证） |

---

## 快速开始

### 前置要求

- Node.js 18+
- npm
- Notion 账号（用于内容管理）
- 腾讯云账号（用于图片存储，可选）

### 1. 安装依赖

```bash
git clone <your-repo-url>
cd mypage
npm install
```

### 2. 配置环境变量

在项目根目录创建 `.env.local`：

```env
# ===== Notion 配置 =====
NOTION_TOKEN=secret_xxxxx                  # Notion Integration Token
NOTION_HOMEPAGE_DB_ID=xxxxx                # 首页配置数据库 ID
NOTION_REFLECTIONS_DB_ID=xxxxx             # 随记数据库 ID
NOTION_PROJECTS_DB_ID=xxxxx                # 项目数据库 ID
NOTION_PHOTOS_DB_ID=xxxxx                  # 照片数据库 ID（如使用 Notion 管理照片）
NOTION_MUSIC_DB_ID=xxxxx                   # 音乐数据库 ID
NOTION_MOVIES_DB_ID=xxxxx                  # 电影数据库 ID
NOTION_PAGE_CONFIG_DB_ID=xxxxx             # 页面配置数据库 ID（座右铭等）

# ===== 腾讯云 COS 配置（可选） =====
TENCENT_SECRET_ID=xxxxx                    # 腾讯云 SecretId
TENCENT_SECRET_KEY=xxxxx                   # 腾讯云 SecretKey
TENCENT_BUCKET=mypage-images-xxxxx         # COS 存储桶名（默认 mypage-images-1313131901）
TENCENT_REGION=ap-shanghai                 # COS 地域（默认 ap-shanghai）

# ===== 网站配置 =====
NEXT_PUBLIC_SITE_URL=http://localhost:3000  # 站点 URL（生产环境改为实际域名）

# ===== 管理认证（可选） =====
ADMIN_PASSWORD=xxxxx                       # 管理页面密码
ADMIN_TOKEN=xxxxx                          # API 访问令牌
```

> **Notion 配置教程** 👉 [docs/NOTION_SETUP_GUIDE.md](./docs/NOTION_SETUP_GUIDE.md)  
> 包含 Integration 创建、数据库结构设计、字段配置等详细说明。

### 3. 启动开发

```bash
npm run dev
```

浏览器打开 http://localhost:3000

---

## 部署到 Vercel

### 步骤

1. 将代码推送到 GitHub 仓库
2. 登录 [Vercel](https://vercel.com)，点击 **New Project** → 导入该仓库
3. 在 **Environment Variables** 中添加 `.env.local` 中的所有变量
   - 生产环境 `NEXT_PUBLIC_SITE_URL` 改为实际域名，如 `https://overflowing.live`
4. 点击 **Deploy**

### 部署配置说明

项目通过 `vercel.json` 预配置了以下选项：

| 配置项 | 值 | 说明 |
|--------|-----|------|
| `regions` | `hnd1` (东京) | 服务器区域，选择离目标用户最近的节点 |
| `functions.maxDuration` | `60` 秒 | API 路由最大执行时间 |
| `NODE_OPTIONS` | `--max-old-space-size=4096` | 构建时内存限制 4GB |

### 自定义域名

1. Vercel 控制台 → 项目 → **Settings** → **Domains**
2. 添加域名并按提示配置 DNS（CNAME 记录指向 `cname.vercel-dns.com`）
3. 更新 Vercel 环境变量中的 `NEXT_PUBLIC_SITE_URL`

---

## 可用命令

### 开发与构建

```bash
npm run dev                # 启动开发服务器
npm run build              # 构建生产版本（跳过 lint）
npm start                  # 启动生产服务器
npm run type-check         # TypeScript 类型检查
npm run lint               # ESLint 检查
```

### 缓存管理

```bash
npm run cache:stats        # 查看服务端缓存统计信息
npm run cache:clear        # 清除所有缓存
npm run cache:clear:text   # 仅清除文本缓存
npm run cache:clear:images # 仅清除图片缓存
npm run cache:clear:image-cache  # 清除图片 URL 映射缓存
npm run cache:clear:photo  # 清除照片相关缓存
npm run cache:warmup       # 预热缓存（提前拉取常用数据）
```

### 图片与 COS

```bash
npm run images:preload       # 预加载随记文章中的图片到 COS（本地）
npm run images:preload:prod  # 预加载图片（生产环境 URL）
npm run sync-images          # 同步 public/images 到 COS
npm run sync-images:force    # 强制全量同步
npm run cos:info             # 查看本地 COS 存储桶信息
npm run cos:info:prod        # 查看生产环境 COS 信息
npm run cos:cache            # 测试 COS 缓存连通
```

### 生产环境缓存操作（HTTP API）

```bash
# 清除缓存
curl https://your-domain.com/api/cache/clear

# 查看缓存统计
curl https://your-domain.com/api/cache/stats

# 预热缓存
curl https://your-domain.com/api/cache/warmup
```

---

## 许可证

[MIT License](./LICENSE)