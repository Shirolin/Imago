import { describe, it, expect } from 'vitest'
import { headerChromeFromWidth, isCompactHeader } from './headerChrome'

describe('headerChromeFromWidth', () => {
  it('390 → compact', () => {
    expect(headerChromeFromWidth(390)).toBe('compact')
  })

  it('639 → compact', () => {
    expect(headerChromeFromWidth(639)).toBe('compact')
  })

  it('640 → dense', () => {
    expect(headerChromeFromWidth(640)).toBe('dense')
  })

  it('768 → dense', () => {
    expect(headerChromeFromWidth(768)).toBe('dense')
  })
})

describe('isCompactHeader', () => {
  it('matches compact band', () => {
    expect(isCompactHeader(390)).toBe(true)
    expect(isCompactHeader(640)).toBe(false)
  })
})
