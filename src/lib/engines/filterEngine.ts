import type { ImageProcessor, ProcessResult } from './types'

export interface FilterOptions {
  brightness: number
  contrast: number
  saturation: number
  blur: number
  grayscale: number
  sepia: number
}

export const filterEngine: ImageProcessor<FilterOptions> = async (file, options) => {
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

      ctx.filter = `brightness(${options.brightness}%) contrast(${options.contrast}%) saturate(${options.saturation}%) blur(${options.blur}px) grayscale(${options.grayscale}%) sepia(${options.sepia}%)`
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
        0.95
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
