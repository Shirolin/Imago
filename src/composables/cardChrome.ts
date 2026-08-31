export type CardActionChrome = 'minimal' | 'hud' | 'bar'

export interface CardActionChromeInput {
  large: boolean
  overlay: boolean
}

/** Compact grid: corner chips only. Large overlay: bottom HUD. Large desktop: action bar. */
export function cardActionChrome(input: CardActionChromeInput): CardActionChrome {
  if (!input.large) return 'minimal'
  if (input.overlay) return 'hud'
  return 'bar'
}

export interface PersistIdleCheckInput {
  overlay: boolean
  selected: boolean
}

export function persistIdleCheck(input: PersistIdleCheckInput): boolean {
  return input.selected || !input.overlay
}
