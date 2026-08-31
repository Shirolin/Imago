import { describe, it, expect } from 'vitest'
import { toDisplay, fromDisplay } from './sliderDisplay'

describe('toDisplay', () => {
  it('maps 0–1 quality to integer percent', () => {
    expect(toDisplay(0.8, 100, 0)).toBe(80)
    expect(toDisplay(0.75, 100, 0)).toBe(75)
    expect(toDisplay(1, 100, 0)).toBe(100)
    expect(toDisplay(0.1, 100, 0)).toBe(10)
  })

  it('identity scale keeps engine decimals', () => {
    expect(toDisplay(0.8, 1, 2)).toBe(0.8)
    expect(toDisplay(256, 1, 0)).toBe(256)
  })

  it('rounds float dirt at the display boundary', () => {
    expect(toDisplay(0.29, 100, 0)).toBe(29)
  })
})

describe('fromDisplay', () => {
  it('accepts percent text back to 0–1', () => {
    expect(fromDisplay('80', 100, 0.1, 1, 0.01)).toBeCloseTo(0.8)
    expect(fromDisplay('75', 100, 0.1, 1, 0.01)).toBeCloseTo(0.75)
  })

  it('clamps to engine min and max', () => {
    expect(fromDisplay('5', 100, 0.1, 1, 0.01)).toBeCloseTo(0.1)
    expect(fromDisplay('150', 100, 0.1, 1, 0.01)).toBeCloseTo(1)
  })

  it('snaps to engine step', () => {
    expect(fromDisplay('75.4', 100, 0.1, 1, 0.01)).toBeCloseTo(0.75)
  })

  it('identity scale leaves the typed number in engine units', () => {
    expect(fromDisplay('80', 1, 0, 100, 1)).toBe(80)
  })

  it('invalid text is NaN', () => {
    expect(Number.isNaN(fromDisplay('abc', 100, 0.1, 1, 0.01))).toBe(true)
    expect(Number.isNaN(fromDisplay('', 100, 0.1, 1, 0.01))).toBe(true)
  })
})
