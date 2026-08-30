import { computed } from 'vue'
import {
  useBreakpoints as useVueUseBreakpoints,
  breakpointsTailwind,
  useMediaQuery
} from '@vueuse/core'
import {
  inspectorChrome as resolveInspectorChrome,
  isOverlayChrome as checkOverlayChrome
} from './inspectorChrome'

/**
 * Width bands follow Tailwind. Inspector chrome does not.
 *
 * Phone chrome (bottom drawer) when the viewport is narrow or too short
 * for a side overlay. Tablet overlay only when there is both width and height.
 * Desktop sticky sidebar from lg, even on short laptop screens.
 *
 * Short = max-height 540px. Phone landscape sits under that. Tablets and
 * laptops do not.
 */
export const useBreakpoints = () => {
  const breakpoints = useVueUseBreakpoints(breakpointsTailwind)

  const isCompact = breakpoints.smaller('sm')
  const isMedium = breakpoints.between('sm', 'lg')
  const isWide = breakpoints.between('lg', '2xl')
  const isUltra = breakpoints.greaterOrEqual('2xl')
  const isMobileOrTablet = breakpoints.smaller('lg')
  const isDesktop = breakpoints.greaterOrEqual('lg')
  const canStickySidebar = isDesktop

  const isShortViewport = useMediaQuery('(max-height: 540px)')

  const inspectorChromeMode = computed(() =>
    resolveInspectorChrome({
      compact: isCompact.value,
      medium: isMedium.value,
      desktop: isDesktop.value,
      short: isShortViewport.value
    })
  )

  const isPhoneChrome = computed(() => inspectorChromeMode.value === 'phone')
  const isTabletChrome = computed(() => inspectorChromeMode.value === 'tablet')
  const isOverlayChrome = computed(() => checkOverlayChrome(inspectorChromeMode.value))

  const isMobile = isCompact
  const isTablet = isMedium
  const isPC = isDesktop
  const isSmallerThanMd = breakpoints.smaller('md')
  const isMdOrGreater = breakpoints.greaterOrEqual('md')

  return {
    isCompact,
    isMedium,
    isWide,
    isUltra,
    isMobileOrTablet,
    isDesktop,
    canStickySidebar,
    isShortViewport,
    inspectorChromeMode,
    isOverlayChrome,
    isPhoneChrome,
    isTabletChrome,
    isMobile,
    isTablet,
    isPC,
    isSmallerThanMd,
    isMdOrGreater,
    breakpoints
  }
}
