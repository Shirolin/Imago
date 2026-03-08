import type { ImageProcessor, ProcessResult } from './types'

export interface SplitOptions {
  mode: 'grid' | 'tiles'
  rows?: number
  cols?: number
  tileWidth?: number
  tileHeight?: number
}

export const splitEngine: ImageProcessor<SplitOptions> = async (file, options) => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = async () => {
      URL.revokeObjectURL(url)

      const splitParams: Array<{ x: number; y: number; w: number; h: number }> = []

      if (options.mode === 'grid') {
        const rows = options.rows || 1
        const cols = options.cols || 1
        const w = img.width / cols
        const h = img.height / rows

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            splitParams.push({ x: c * w, y: r * h, w, h })
          }
        }
      } else {
        const tw = options.tileWidth || img.width
        const th = options.tileHeight || img.height
        const cols = Math.ceil(img.width / tw)
        const rows = Math.ceil(img.height / th)

        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            splitParams.push({
              x: c * tw,
              y: r * th,
              w: Math.min(tw, img.width - c * tw),
              h: Math.min(th, img.height - r * th)
            })
          }
        }
      }

      const blobs: Blob[] = []
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      if (!ctx) throw new Error('Failed to get canvas context')

      for (const p of splitParams) {
        canvas.width = p.w
        canvas.height = p.h
        ctx.clearRect(0, 0, canvas.width, canvas.height)
        ctx.drawImage(img, p.x, p.y, p.w, p.h, 0, 0, p.w, p.h)

        const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, file.type))
        if (blob) blobs.push(blob)
      }

      resolve({
        blobs,
        size: blobs.reduce((sum, b) => sum + b.size, 0),
        width: img.width,
        height: img.height
      })
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Failed to load image'))
    }

    img.src = url
  })
}
