export type ExifTagClass = 'privacy' | 'technical'

export interface ClassifiedExifTags {
  privacyCount: number
  technicalCount: number
}

export const TECHNICAL_EXIF_TAGS: ReadonlySet<string> = new Set([
  'JFIFVersion',
  'ResolutionUnit',
  'XResolution',
  'YResolution',
  'ThumbnailWidth',
  'ThumbnailHeight',
  'JFIFUnits',
  'ThumbnailOffset',
  'ThumbnailLength',
  'ImageWidth',
  'ImageHeight',
  'ExifImageWidth',
  'ExifImageHeight',
  'PixelXDimension',
  'PixelYDimension',
  'ColorSpace',
  'Orientation',
  'ExifVersion',
  'FlashpixVersion',
  'ComponentsConfiguration',
  'BitsPerSample',
  'Compression',
  'PhotometricInterpretation',
  'SamplesPerPixel',
  'PlanarConfiguration',
  'YCbCrPositioning',
  'YCbCrSubSampling',
  'YCbCrCoefficients',
  'InteropIndex',
  'InteropVersion',
  'EncodingProcess',
  'ColorTransform',
  'JPEGInterchangeFormat',
  'JPEGInterchangeFormatLength',
  'ExposureTime',
  'FNumber',
  'ExposureProgram',
  'ISO',
  'ISOSpeedRatings',
  'ShutterSpeedValue',
  'ApertureValue',
  'BrightnessValue',
  'ExposureBiasValue',
  'MaxApertureValue',
  'MeteringMode',
  'LightSource',
  'Flash',
  'FocalLength',
  'FocalLengthIn35mmFormat',
  'WhiteBalance',
  'ExposureMode',
  'SceneCaptureType',
  'Contrast',
  'Saturation',
  'Sharpness',
  'DigitalZoomRatio',
  'CustomRendered',
  'GainControl',
  'SensingMethod',
  'FileSource',
  'SceneType'
])

export function classifyExifTag(key: string): ExifTagClass {
  return TECHNICAL_EXIF_TAGS.has(key) ? 'technical' : 'privacy'
}

export function classifyExifTags(keys: string[]): ClassifiedExifTags {
  let privacyCount = 0
  let technicalCount = 0
  for (const key of keys) {
    if (classifyExifTag(key) === 'technical') {
      technicalCount++
    } else {
      privacyCount++
    }
  }
  return { privacyCount, technicalCount }
}
