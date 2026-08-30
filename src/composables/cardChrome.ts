export type CardActionChrome = 'hud' | 'bar'

export interface CardActionChromeInput {
  large: boolean
  overlay: boolean
}

/** Labeled bar only when the card is large and the inspector is a desktop sidebar. Overlay width cannot fit zh-CN compare copy. */
export function cardActionChrome(input: CardActionChromeInput): CardActionChrome {
  return input.large && !input.overlay ? 'bar' : 'hud'
}
