import { describe, it, expect } from 'vitest'
import {
  inspectorChromeFromViewport,
  inspectorIsCollapsed,
  isOverlayChrome
} from './inspectorChrome'

describe('inspectorChromeFromViewport', () => {
  it('375×812 → phone', () => {
    expect(inspectorChromeFromViewport(375, 812)).toBe('phone')
  })

  it('768×1024 → tablet', () => {
    expect(inspectorChromeFromViewport(768, 1024)).toBe('tablet')
  })

  it('1024×768 → desktop', () => {
    expect(inspectorChromeFromViewport(1024, 768)).toBe('desktop')
  })

  it('812×375 (wide sm, short, not lg) → phone', () => {
    expect(inspectorChromeFromViewport(812, 375)).toBe('phone')
  })

  it('1200×400 (short laptop) → desktop', () => {
    expect(inspectorChromeFromViewport(1200, 400)).toBe('desktop')
  })
})

describe('isOverlayChrome', () => {
  it('phone and tablet are overlay', () => {
    expect(isOverlayChrome('phone')).toBe(true)
    expect(isOverlayChrome('tablet')).toBe(true)
  })

  it('desktop is not overlay', () => {
    expect(isOverlayChrome('desktop')).toBe(false)
  })
})

describe('inspectorIsCollapsed', () => {
  it('overlay + store expanded → still collapsed (session peek)', () => {
    expect(
      inspectorIsCollapsed({
        chrome: 'phone',
        overlayCollapsed: true,
        storeCollapsed: false
      })
    ).toBe(true)

    expect(
      inspectorIsCollapsed({
        chrome: 'tablet',
        overlayCollapsed: true,
        storeCollapsed: false
      })
    ).toBe(true)
  })

  it('overlay expanded → not collapsed', () => {
    expect(
      inspectorIsCollapsed({
        chrome: 'phone',
        overlayCollapsed: false,
        storeCollapsed: false
      })
    ).toBe(false)

    expect(
      inspectorIsCollapsed({
        chrome: 'tablet',
        overlayCollapsed: false,
        storeCollapsed: false
      })
    ).toBe(false)
  })

  it('desktop + store expanded → not collapsed', () => {
    expect(
      inspectorIsCollapsed({
        chrome: 'desktop',
        overlayCollapsed: true,
        storeCollapsed: false
      })
    ).toBe(false)
  })

  it('desktop + store collapsed → collapsed', () => {
    expect(
      inspectorIsCollapsed({
        chrome: 'desktop',
        overlayCollapsed: false,
        storeCollapsed: true
      })
    ).toBe(true)
  })
})
