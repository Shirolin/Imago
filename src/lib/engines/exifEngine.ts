import exifr from 'exifr'
import type { ImageProcessor } from './types'

export interface ExifData {
  make?: string
  model?: string
  software?: string
  dateTime?: string
  exposureTime?: string
  fNumber?: string
  iso?: number
  focalLength?: string
  latitude?: number
  longitude?: number
  metaCount: number
  all?: Record<string, string | number | boolean>
}

export const readExif = async (file: File): Promise<ExifData | null> => {
  try {
    const rawData = (await exifr.parse(file, {
      tiff: true,
      exif: true,
      gps: true,
      jfif: true,
      iptc: true,
      xmp: true
    })) as Record<string, unknown> // 使用 Record 承接库返回的复杂对象

    if (!rawData) return { metaCount: 0 }

    // 过滤并存储基础类型用于全量展示
    const filteredRaw: Record<string, string | number | boolean> = {}
    Object.entries(rawData).forEach(([key, value]) => {
      if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
        filteredRaw[key] = value
      } else if (value instanceof Date) {
        filteredRaw[key] = value.toLocaleString()
      }
    })

    const metaCount = Object.keys(rawData).length

    return {
      make: typeof rawData.Make === 'string' ? rawData.Make : undefined,
      model: typeof rawData.Model === 'string' ? rawData.Model : undefined,
      software: typeof rawData.Software === 'string' ? rawData.Software : undefined,
      dateTime: rawData.DateTimeOriginal?.toLocaleString() || rawData.CreateDate?.toLocaleString(),
      exposureTime:
        typeof rawData.ExposureTime === 'number'
          ? `1/${Math.round(1 / rawData.ExposureTime)}s`
          : undefined,
      fNumber: typeof rawData.FNumber === 'number' ? `f/${rawData.FNumber}` : undefined,
      iso: typeof rawData.ISO === 'number' ? rawData.ISO : undefined,
      focalLength: typeof rawData.FocalLength === 'number' ? `${rawData.FocalLength}mm` : undefined,
      latitude: typeof rawData.latitude === 'number' ? rawData.latitude : undefined,
      longitude: typeof rawData.longitude === 'number' ? rawData.longitude : undefined,
      metaCount,
      all: filteredRaw
    }
  } catch (error) {
    console.error('Failed to read EXIF:', error)
    return null
  }
}

/**
 * 清除 EXIF 信息的引擎
 * 原理：通过 Canvas 重新绘制图片，Canvas 不会保留原始图片的元数据。
 */
export const clearExifEngine: ImageProcessor<unknown> = async (file, _options) => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')

      if (!ctx) {
        reject(new Error('Failed to get canvas context'))
        return
      }

      ctx.drawImage(img, 0, 0)

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve({
              blob,
              size: blob.size,
              width: canvas.width,
              height: canvas.height
            })
          } else {
            reject(new Error('Canvas toBlob failed'))
          }
        },
        file.type,
        0.95 // 保持高质量
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }

    img.src = url
  })
}
