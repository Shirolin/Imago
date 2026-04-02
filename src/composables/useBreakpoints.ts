import { useBreakpoints as useVueUseBreakpoints, breakpointsTailwind } from '@vueuse/core'

/**
 * Imago 响应式系统 2.0
 *
 * 档次定义:
 * 1. XS / Compact (Phone): < 640px (sm)
 *    策略: 侧边栏转底抽屉，单栏布局。
 *
 * 2. MD / Medium (Tablet/Foldable): 640px - 1024px (lg)
 *    策略: 侧边栏 Overlay 弹出模式，画布优先。
 *
 * 3. LG / Wide (Standard Desktop): 1024px - 1536px (2xl)
 *    策略: 侧边栏常驻，资源托盘固定。
 *
 * 4. XL / Ultra (Ultrawide): >= 1536px (2xl)
 *    策略: 容器限宽，留白艺术。
 */
export const useBreakpoints = () => {
  const breakpoints = useVueUseBreakpoints(breakpointsTailwind)

  // --- 核心语义断点 ---

  // XS: 紧凑模式 (手机)
  const isCompact = breakpoints.smaller('sm')

  // MD: 中等模式 (平板/折叠屏)
  const isMedium = breakpoints.between('sm', 'lg')

  // LG: 宽屏模式 (标准桌面)
  const isWide = breakpoints.between('lg', '2xl')

  // XL: 超宽屏模式 (iMac/大显示器)
  const isUltra = breakpoints.greaterOrEqual('2xl')

  // --- 语义化逻辑组合 ---

  // 是否为移动端体验 (XS + MD)
  const isMobileOrTablet = breakpoints.smaller('lg')

  // 是否为桌面端体验 (LG + XL)
  const isDesktop = breakpoints.greaterOrEqual('lg')

  // 是否可以常驻侧边栏
  const canStickySidebar = isDesktop

  // --- 兼容性别名 (针对旧逻辑) ---
  const isMobile = isCompact
  const isTablet = isMedium
  const isPC = isDesktop
  const isSmallerThanMd = breakpoints.smaller('md')
  const isMdOrGreater = breakpoints.greaterOrEqual('md')

  return {
    // 基础档次
    isCompact,
    isMedium,
    isWide,
    isUltra,

    // 逻辑组合
    isMobileOrTablet,
    isDesktop,
    canStickySidebar,

    // 兼容别名
    isMobile,
    isTablet,
    isPC,
    isSmallerThanMd,
    isMdOrGreater,

    // 原始对象
    breakpoints
  }
}
