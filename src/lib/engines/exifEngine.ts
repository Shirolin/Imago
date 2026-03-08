import exifr from 'exifr'
import type { ImageProcessor, ProcessResult } from './types'

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
}

export const readExif = async (file: File): Promise<ExifData | null> => {
  try {
    const rawData = await exifr.parse(file, {
      tiff: true,
      exif: true,
      gps: true,
      jfif: true
    })

    if (!rawData) return { metaCount: 0 }

    const metaCount = Object.keys(rawData).length

    return {
      make: rawData.Make,
      model: rawData.Model,
      software: rawData.Software,
      dateTime: rawData.DateTimeOriginal?.toLocaleString() || rawData.CreateDate?.toLocaleString(),
      exposureTime: rawData.ExposureTime ? `1/${Math.round(1 / rawData.ExposureTime)}s` : undefined,
      fNumber: rawData.FNumber ? `f/${rawData.FNumber}` : undefined,
      iso: rawData.ISO,
      focalLength: rawData.FocalLength ? `${rawData.FocalLength}mm` : undefined,
      latitude: rawData.latitude,
      longitude: rawData.longitude,
      metaCount
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
export const clearExifEngine: ImageProcessor<any> = async (file) => {
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
