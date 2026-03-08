import type { ImageProcessor, ProcessResult } from './types'

export interface ResizeOptions {
  mode: 'pixels' | 'percentage'
  width?: number
  height?: number
  percentage?: number
  maintainAspectRatio?: boolean
}

export const resizeEngine: ImageProcessor<ResizeOptions> = async (file, options) => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(url)

      let targetWidth = img.width
      let targetHeight = img.height

      if (options.mode === 'percentage') {
        const factor = (options.percentage ?? 100) / 100
        targetWidth = img.width * factor
        targetHeight = img.height * factor
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
            // Adjust based on which constraint is more restrictive
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

      const ctx = canvas.getContext('2d')
      if (!ctx) {
        reject(new Error('Failed to get canvas context'))
        return
      }

      // 使用双三次插值 (High quality)
      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

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
        0.95 // Default high quality
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
