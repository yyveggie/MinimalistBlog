/**
 * 设备检测工具函数
 * 用于优化移动端图片加载性能
 */

/**
 * 检测是否为移动设备
 */
export const isMobileDevice = (): boolean => {
  if (typeof window === 'undefined') return false
  
  // 屏幕宽度检测
  const isSmallScreen = window.innerWidth <= 768
  
  // User Agent 检测
  const isMobileUA = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
  
  // 触摸设备检测
  const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0
  
  return isSmallScreen || isMobileUA || isTouchDevice
}

/**
 * 获取移动端优化的并发数量
 */
export const getMobileConcurrentCount = (): number => {
  return isMobileDevice() ? 20 : 30  // 🚀 提升并发数：移动端20，桌面端30
}

/**
 * 获取移动端优化的高优先级图片数量
 */
export const getMobileHighPriorityCount = (): number => {
  return isMobileDevice() ? 10 : 15  // 🚀 进一步增加高优先级数量
}

/**
 * 获取移动端优化的懒加载距离
 */
export const getMobileRootMargin = (): string => {
  // 增加预加载距离，让更多图片提前开始加载
  return isMobileDevice() ? '500px' : '800px'
}

/**
 * 获取移动端优化的图片优先级
 */
export const getMobileImagePriority = (index: number): 'high' | 'normal' | 'low' => {
  const highPriorityCount = getMobileHighPriorityCount()
  return index < highPriorityCount ? 'high' : 'normal'
}
