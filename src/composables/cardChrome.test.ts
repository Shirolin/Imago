import { describe, it, expect } from 'vitest'
import { cardActionChrome } from './cardChrome'

describe('cardActionChrome', () => {
  it('compact is always hud', () => {
    expect(cardActionChrome({ large: false, overlay: false })).toBe('hud')
    expect(cardActionChrome({ large: false, overlay: true })).toBe('hud')
  })

  it('large + overlay → hud', () => {
    expect(cardActionChrome({ large: true, overlay: true })).toBe('hud')
  })

  it('large + desktop → bar', () => {
    expect(cardActionChrome({ large: true, overlay: false })).toBe('bar')
  })
})
