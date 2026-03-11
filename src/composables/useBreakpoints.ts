import { useBreakpoints as useVueUseBreakpoints, breakpointsTailwind } from '@vueuse/core'

/**
 * 统一的设备断点判断 Hook
 * 基于 Tailwind 标准断点:
 * Mobile: < 768px (小于 md)
 * Tablet: 768px - 1280px (md 到 xl 之间)
 * PC: >= 1280px (大于等于 xl)
 */
export const useBreakpoints = () => {
  const breakpoints = useVueUseBreakpoints(breakpointsTailwind)

  // 1. 基础设备类型 (互斥判断)
  const isMobile = breakpoints.smaller('md')
  const isTablet = breakpoints.between('md', 'xl')
  const isPC = breakpoints.greaterOrEqual('xl')

  // 2. 常用组合判断 (语义化)
  const isMobileOrTablet = breakpoints.smaller('xl')
  const isTabletOrPC = breakpoints.greaterOrEqual('md')

  // 3. 兼容旧逻辑的别名
  const isSmallerThanMd = isMobile
  const isMdOrGreater = isTabletOrPC

  return {
    // 核心设备类型
    isMobile,
    isTablet,
    isPC,

    // 组合类型
    isMobileOrTablet,
    isTabletOrPC,

    // 兼容别名
    isSmallerThanMd,
    isMdOrGreater,

    // 原始断点对象 (备用)
    breakpoints
  }
}
