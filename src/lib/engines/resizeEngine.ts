import type { ImageProcessor } from './types'
import { injectMetadata } from '../utils/metadata'

export interface ResizeOptions {
  mode: 'pixels' | 'percentage'
  width?: number
  height?: number
  percentage?: number
  maintainAspectRatio?: boolean
  quality?: number
  format?: string
  preserveExif?: boolean
}

export const resizeEngine: ImageProcessor<ResizeOptions> = async (file, options) => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = async () => {
      URL.revokeObjectURL(url)

      let targetWidth = img.width
      let targetHeight = img.height

      if (options.mode === 'percentage') {
        const factor = (options.percentage ?? 100) / 100
        targetWidth = Math.max(1, img.width * factor)
        targetHeight = Math.max(1, img.height * factor)
      } else {
        targetWidth = options.width ?? img.width
        targetHeight = options.height ?? img.height

        if (options.maintainAspectRatio) {
          const ratio = img.width / img.height
          if (options.width && !options.height) {
            targetHeight = targetWidth / ratio
          } else if (options.height && !options.width) {
            targetWidth = targetHeight * ratio
          } else if (options.width && options.height) {
            const targetRatio = targetWidth / targetHeight
            if (targetRatio > ratio) {
              targetWidth = targetHeight * ratio
            } else {
              targetHeight = targetWidth / ratio
            }
          }
        }
      }

      const canvas = document.createElement('canvas')
      canvas.width = Math.round(targetWidth)
      canvas.height = Math.round(targetHeight)

      const ctx = canvas.getContext('2d', { alpha: true, desynchronized: true })
      if (!ctx) {
        reject(new Error('Failed to get canvas context'))
        return
      }

      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

      const targetFormat = options.format || file.type
      const targetQuality = options.quality ?? 0.9

      canvas.toBlob(
        async (blob) => {
          if (!blob) {
            reject(new Error('Canvas toBlob failed'))
            return
          }

          let finalBlob = blob

          // 元数据保留逻辑 (仅针对 JPEG)
          if (options.preserveExif && file.type === 'image/jpeg' && targetFormat === 'image/jpeg') {
            try {
              const processedBuffer = await blob.arrayBuffer()
              const mergedBuffer = await injectMetadata(file, processedBuffer, 'image/jpeg')
              finalBlob = new Blob([mergedBuffer], { type: 'image/jpeg' })
            } catch (e) {
              console.warn('Metadata injection failed during resize:', e)
            }
          }

          resolve({
            blob: finalBlob,
            size: finalBlob.size,
            width: canvas.width,
            height: canvas.height
          })
        },
        targetFormat,
        targetQuality
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }

    if (options.signal) {
      options.signal.addEventListener('abort', () => {
        img.src = ''
        reject(new Error('Task aborted'))
      })
    }

    img.src = url
  })
}
