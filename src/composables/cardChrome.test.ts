import { describe, it, expect } from 'vitest'
import { cardActionChrome, persistIdleCheck } from './cardChrome'

describe('cardActionChrome', () => {
  it('compact → minimal (corner chips only)', () => {
    expect(cardActionChrome({ large: false, overlay: false })).toBe('minimal')
    expect(cardActionChrome({ large: false, overlay: true })).toBe('minimal')
  })

  it('large + overlay → hud', () => {
    expect(cardActionChrome({ large: true, overlay: true })).toBe('hud')
  })

  it('large + desktop → bar', () => {
    expect(cardActionChrome({ large: true, overlay: false })).toBe('bar')
  })
})

describe('persistIdleCheck', () => {
  it('selected always persists', () => {
    expect(persistIdleCheck({ overlay: true, selected: true })).toBe(true)
    expect(persistIdleCheck({ overlay: false, selected: true })).toBe(true)
  })

  it('unselected overlay does not persist', () => {
    expect(persistIdleCheck({ overlay: true, selected: false })).toBe(false)
  })

  it('unselected desktop persists for hover', () => {
    expect(persistIdleCheck({ overlay: false, selected: false })).toBe(true)
  })
})
