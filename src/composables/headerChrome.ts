import { TAILWIND_SM } from './inspectorChrome'

export type HeaderChrome = 'compact' | 'dense'

/** Compact header below Tailwind sm (640px). Aligns with `sm:` utility breakpoint. */
export function headerChromeFromWidth(width: number): HeaderChrome {
  return width < TAILWIND_SM ? 'compact' : 'dense'
}

export function isCompactHeader(width: number): boolean {
  return headerChromeFromWidth(width) === 'compact'
}
