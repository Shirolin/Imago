import type { MultiImageProcessor } from './types'

export interface CombineOptions {
  direction: 'vertical' | 'horizontal' | 'grid'
  spacing: number
  backgroundColor: string
  alignment: 'start' | 'center' | 'end'
  columns?: number
  padding?: number
  borderRadius?: number
  format?: string
  quality?: number
}

export const combineEngine: MultiImageProcessor<CombineOptions> = async (files, options) => {
  if (files.length === 0) throw new Error('No files to combine')

  const padding = options.padding || 0
  const borderRadius = options.borderRadius || 0

  const images = await Promise.all(
    files.map((file) => {
      return new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = () => reject(new Error(`Failed to load image: ${file.name}`))
        img.src = URL.createObjectURL(file)
      })
    })
  )

  let totalWidth = 0
  let totalHeight = 0

  const maxWidth = Math.max(...images.map((img) => img.width))
  const maxHeight = Math.max(...images.map((img) => img.height))

  let cols = 1
  let rows = 1

  if (options.direction === 'vertical') {
    totalWidth = maxWidth
    totalHeight =
      images.reduce((sum, img) => sum + img.height, 0) + (images.length - 1) * options.spacing
  } else if (options.direction === 'horizontal') {
    totalWidth =
      images.reduce((sum, img) => sum + img.width, 0) + (images.length - 1) * options.spacing
    totalHeight = maxHeight
  } else {
    cols =
      options.columns && options.columns > 0 ? options.columns : Math.ceil(Math.sqrt(images.length))
    rows = Math.ceil(images.length / cols)
    totalWidth = maxWidth * cols + (cols - 1) * options.spacing
    totalHeight = maxHeight * rows + (rows - 1) * options.spacing
  }

  const canvas = document.createElement('canvas')
  canvas.width = totalWidth + padding * 2
  canvas.height = totalHeight + padding * 2
  const ctx = canvas.getContext('2d', { alpha: true })
  if (!ctx) throw new Error('Failed to get canvas context')

  // Clear/Fill background
  if (options.backgroundColor === 'transparent') {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
  } else {
    ctx.fillStyle = options.backgroundColor
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  let currentX = padding
  let currentY = padding

  const drawImageWithRadius = (
    img: HTMLImageElement,
    x: number,
    y: number,
    w: number,
    h: number
  ) => {
    ctx.save()
    if (borderRadius > 0) {
      ctx.beginPath()
      if (ctx.roundRect) {
        ctx.roundRect(x, y, w, h, borderRadius)
      } else {
        // Fallback for older browsers
        ctx.rect(x, y, w, h)
      }
      ctx.clip()
    }
    ctx.drawImage(img, x, y, w, h)
    ctx.restore()
  }

  if (options.direction === 'vertical') {
    images.forEach((img) => {
      let x = padding
      if (options.alignment === 'center') x = padding + (maxWidth - img.width) / 2
      else if (options.alignment === 'end') x = padding + totalWidth - img.width

      drawImageWithRadius(img, x, currentY, img.width, img.height)
      currentY += img.height + options.spacing
    })
  } else if (options.direction === 'horizontal') {
    images.forEach((img) => {
      let y = padding
      if (options.alignment === 'center') y = padding + (maxHeight - img.height) / 2
      else if (options.alignment === 'end') y = padding + totalHeight - img.height

      drawImageWithRadius(img, currentX, y, img.width, img.height)
      currentX += img.width + options.spacing
    })
  } else {
    images.forEach((img, i) => {
      const r = Math.floor(i / cols)
      const c = i % cols

      let offsetX = padding
      let offsetY = padding

      if (options.alignment === 'center') {
        offsetX = padding + (maxWidth - img.width) / 2
        offsetY = padding + (maxHeight - img.height) / 2
      } else if (options.alignment === 'end') {
        offsetX = padding + maxWidth - img.width
        offsetY = padding + maxHeight - img.height
      }

      const x = c * (maxWidth + options.spacing) + offsetX
      const y = r * (maxHeight + options.spacing) + offsetY
      drawImageWithRadius(img, x, y, img.width, img.height)
    })
  }

  // Cleanup object URLs
  images.forEach((img) => URL.revokeObjectURL(img.src))

  const outputFormat = (options.format === 'original' ? undefined : options.format) || 'image/png'
  const outputQuality = options.quality ?? 0.9

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve({
            blob,
            size: blob.size,
            width: canvas.width,
            height: canvas.height,
            format: outputFormat
          })
        } else {
          reject(new Error('Canvas toBlob failed'))
        }
      },
      outputFormat,
      outputQuality
    )
  })
}
