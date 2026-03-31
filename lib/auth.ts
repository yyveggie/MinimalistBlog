/**
 * 🔐 简单认证系统
 * 保护管理页面和敏感API
 */

// 从环境变量获取管理密码
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'mypage2024'
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || 'sync-token-2024'

/**
 * 检查密码是否正确
 */
export function validatePassword(password: string): boolean {
  return password === ADMIN_PASSWORD
}

/**
 * 检查访问令牌是否正确
 * 支持两种token：ADMIN_TOKEN 和 ADMIN_PASSWORD
 */
export function validateToken(token: string): boolean {
  return token === ADMIN_TOKEN || token === ADMIN_PASSWORD
}

/**
 * 从请求中提取认证信息
 */
export function extractAuthFromRequest(request: Request): {
  password?: string
  token?: string
} {
  const url = new URL(request.url)
  const authHeader = request.headers.get('authorization')
  
  return {
    password: url.searchParams.get('pwd') || undefined,
    token: url.searchParams.get('token') || 
           (authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined)
  }
}

/**
 * 检查请求是否有效认证
 */
export function isAuthenticated(request: Request): boolean {
  const { password, token } = extractAuthFromRequest(request)
  
  if (password && validatePassword(password)) {
    return true
  }
  
  if (token && validateToken(token)) {
    return true
  }
  
  return false
}

/**
 * 生成认证失败的响应
 */
export function createUnauthorizedResponse() {
  return new Response(
    JSON.stringify({
      error: 'Unauthorized',
      message: '需要认证才能访问此资源',
      hint: '请提供正确的密码或访问令牌'
    }),
    {
      status: 401,
      headers: {
        'Content-Type': 'application/json',
        'WWW-Authenticate': 'Bearer realm="Admin Area"'
      }
    }
  )
}
