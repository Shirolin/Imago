export type InspectorChrome = 'phone' | 'tablet' | 'desktop'

export const TAILWIND_SM = 640
export const TAILWIND_LG = 1024
export const SHORT_VIEWPORT_MAX = 540

export interface InspectorChromeInput {
  compact: boolean
  medium: boolean
  desktop: boolean
  short: boolean
}

/**
 * Phone chrome (bottom drawer) when narrow or too short for a side overlay.
 * Tablet overlay when there is both width and height. Desktop sticky sidebar from lg,
 * even on short laptop screens.
 */
export function inspectorChrome(input: InspectorChromeInput): InspectorChrome {
  if (input.desktop) return 'desktop'
  if ((input.compact || input.short) && !input.desktop) return 'phone'
  if (input.medium && !input.short) return 'tablet'
  return 'phone'
}

export function inspectorChromeFromViewport(width: number, height: number): InspectorChrome {
  const compact = width < TAILWIND_SM
  const desktop = width >= TAILWIND_LG
  const medium = width >= TAILWIND_SM && width < TAILWIND_LG
  const short = height <= SHORT_VIEWPORT_MAX
  return inspectorChrome({ compact, medium, desktop, short })
}

export function isOverlayChrome(chrome: InspectorChrome): boolean {
  return chrome === 'phone' || chrome === 'tablet'
}

export interface InspectorCollapsedInput {
  chrome: InspectorChrome
  overlayCollapsed: boolean
  storeCollapsed: boolean
}

export function inspectorIsCollapsed(input: InspectorCollapsedInput): boolean {
  if (input.chrome === 'desktop') return input.storeCollapsed
  return input.overlayCollapsed
}

export function shouldExpandOverlayOnImport(
  prevCount: number,
  nextCount: number,
  overlay: boolean
): boolean {
  return overlay && prevCount === 0 && nextCount > 0
}
