import { describe, it, expect } from 'vitest'
import { classifyExifTag, classifyExifTags } from './exifTagRegistry'

describe('exifTagRegistry', () => {
  it('six JFIF keys only → privacyCount 0, technicalCount 6', () => {
    const keys = [
      'JFIFVersion',
      'ResolutionUnit',
      'XResolution',
      'YResolution',
      'ThumbnailWidth',
      'ThumbnailHeight'
    ]
    expect(classifyExifTags(keys)).toEqual({ privacyCount: 0, technicalCount: 6 })
  })

  it('Make + GPSLatitude + JFIFVersion → privacyCount 2', () => {
    expect(classifyExifTags(['Make', 'GPSLatitude', 'JFIFVersion'])).toEqual({
      privacyCount: 2,
      technicalCount: 1
    })
  })

  it('unknown key MakerNote → privacy', () => {
    expect(classifyExifTag('MakerNote')).toBe('privacy')
  })

  it('ISO + Orientation only → privacyCount 0', () => {
    expect(classifyExifTags(['ISO', 'Orientation'])).toEqual({
      privacyCount: 0,
      technicalCount: 2
    })
  })
})
