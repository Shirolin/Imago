export type CardActionChrome = 'hud' | 'bar'

export interface CardActionChromeInput {
  large: boolean
  overlay: boolean
}

export function cardActionChrome(input: CardActionChromeInput): CardActionChrome {
  return input.large && !input.overlay ? 'bar' : 'hud'
}
