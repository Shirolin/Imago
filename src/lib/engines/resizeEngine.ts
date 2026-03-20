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
    const processImage = async () => {
      let bitmap: ImageBitmap | null = null
      try {
        if (options.signal?.aborted) throw new Error('Task aborted')

        bitmap = await createImageBitmap(file)

        if (options.signal?.aborted) {
          throw new Error('Task aborted')
        }

        let targetWidth = bitmap.width
        let targetHeight = bitmap.height

        if (options.mode === 'percentage') {
          const factor = (options.percentage ?? 100) / 100
          targetWidth = Math.max(1, bitmap.width * factor)
          targetHeight = Math.max(1, bitmap.height * factor)
        } else {
          targetWidth = options.width ?? bitmap.width
          targetHeight = options.height ?? bitmap.height

          if (options.maintainAspectRatio) {
            const ratio = bitmap.width / bitmap.height
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

        targetWidth = Math.round(targetWidth)
        targetHeight = Math.round(targetHeight)

        let canvas: OffscreenCanvas | HTMLCanvasElement
        let ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null

        if (typeof OffscreenCanvas !== 'undefined') {
          canvas = new OffscreenCanvas(targetWidth, targetHeight)
          ctx = canvas.getContext('2d', {
            alpha: true,
            desynchronized: true
          }) as OffscreenCanvasRenderingContext2D | null
        } else {
          canvas = document.createElement('canvas')
          canvas.width = targetWidth
          canvas.height = targetHeight
          ctx = canvas.getContext('2d', {
            alpha: true,
            desynchronized: true
          }) as CanvasRenderingContext2D | null
        }

        if (!ctx) throw new Error('Failed to get canvas context')

        ctx.imageSmoothingEnabled = true
        ctx.imageSmoothingQuality = 'high'
        ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight)

        bitmap.close()
        bitmap = null

        const targetFormat = options.format || file.type
        const targetQuality = options.quality ?? 0.9

        let blob: Blob | null
        if (typeof OffscreenCanvas !== 'undefined' && canvas instanceof OffscreenCanvas) {
          blob = await (canvas as OffscreenCanvas).convertToBlob({
            type: targetFormat,
            quality: targetQuality
          })
        } else {
          blob = await new Promise<Blob | null>((res) =>
            (canvas as HTMLCanvasElement).toBlob(res, targetFormat, targetQuality)
          )
        }

        if (!blob) throw new Error('Canvas toBlob failed')

        let finalBlob = blob

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
          width: targetWidth,
          height: targetHeight
        })
      } catch (e) {
        if (bitmap) bitmap.close()
        reject(e)
      }
    }

    processImage()
  })
}
