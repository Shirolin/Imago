import { describe, it, expect } from 'vitest'
import { splitFileName } from './fileNameDisplay'

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
