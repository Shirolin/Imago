import { describe, it, expect } from 'vitest'
import { ellipsisFileName, splitFileName } from './fileNameDisplay'

describe('splitFileName', () => {
  it('splits stem and extension', () => {
    expect(splitFileName('photo.png')).toEqual({ stem: 'photo', ext: '.png' })
    expect(splitFileName('Dustb 主题图.png')).toEqual({ stem: 'Dustb 主题图', ext: '.png' })
  })

  it('returns full name as stem when no extension', () => {
    expect(splitFileName('README')).toEqual({ stem: 'README', ext: '' })
    expect(splitFileName('.hidden')).toEqual({ stem: '.hidden', ext: '' })
  })
})

describe('ellipsisFileName', () => {
  it('leaves short names intact', () => {
    expect(ellipsisFileName('photo.png', 20)).toBe('photo.png')
    expect(ellipsisFileName('a.jpg', 16)).toBe('a.jpg')
  })

  it('keeps .png and ellipsizes the stem middle', () => {
    const result = ellipsisFileName('summer-vacation-album.png', 16)
    expect(result.endsWith('.png')).toBe(true)
    expect(result).toContain('…')
    expect(result).not.toBe('summer-vacation-album.png')
    expect(Array.from(result).length).toBeLessThanOrEqual(16)
  })

  it('counts CJK as single characters', () => {
    const result = ellipsisFileName('这是一份非常长的中文风景照片.png', 12)
    expect(result.endsWith('.png')).toBe(true)
    expect(result).toContain('…')
    expect(Array.from(result).length).toBeLessThanOrEqual(12)
  })

  it('middle-ellipsizes names with no extension', () => {
    const result = ellipsisFileName('vacation-album-scan', 12)
    expect(result).toContain('…')
    expect(result.includes('.')).toBe(false)
    expect(Array.from(result).length).toBeLessThanOrEqual(12)
  })

  it('keeps .png even when max is tight', () => {
    const result = ellipsisFileName('photo.png', 5)
    expect(result.endsWith('.png')).toBe(true)
    expect(result).toContain('…')
  })
})
