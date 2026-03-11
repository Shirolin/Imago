import type { MultiImageProcessor } from './types'

export interface CombineOptions {
  direction: 'vertical' | 'horizontal' | 'grid'
  spacing: number
  backgroundColor: string
}

export const combineEngine: MultiImageProcessor<CombineOptions> = async (files, options) => {
  if (files.length === 0) throw new Error('No files to combine')

  const images = await Promise.all(
    files.map((file) => {
      return new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve(img)
        img.onerror = reject
        img.src = URL.createObjectURL(file)
      })
    })
  )

  let totalWidth = 0
  let totalHeight = 0

  if (options.direction === 'vertical') {
    totalWidth = Math.max(...images.map((img) => img.width))
    totalHeight =
      images.reduce((sum, img) => sum + img.height, 0) + (images.length - 1) * options.spacing
  } else if (options.direction === 'horizontal') {
    totalWidth =
      images.reduce((sum, img) => sum + img.width, 0) + (images.length - 1) * options.spacing
    totalHeight = Math.max(...images.map((img) => img.height))
  } else {
    // Grid mode: Simplified to a single row for now, or we can calculate a square grid
    const cols = Math.ceil(Math.sqrt(images.length))
    const rows = Math.ceil(images.length / cols)
    const cellWidth = Math.max(...images.map((img) => img.width))
    const cellHeight = Math.max(...images.map((img) => img.height))
    totalWidth = cellWidth * cols + (cols - 1) * options.spacing
    totalHeight = cellHeight * rows + (rows - 1) * options.spacing
  }

  const canvas = document.createElement('canvas')
  canvas.width = totalWidth
  canvas.height = totalHeight
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Failed to get canvas context')

  // Fill background
  ctx.fillStyle = options.backgroundColor
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  let currentX = 0
  let currentY = 0

  if (options.direction === 'vertical') {
    images.forEach((img) => {
      ctx.drawImage(img, (totalWidth - img.width) / 2, currentY)
      currentY += img.height + options.spacing
    })
  } else if (options.direction === 'horizontal') {
    images.forEach((img) => {
      ctx.drawImage(img, currentX, (totalHeight - img.height) / 2)
      currentX += img.width + options.spacing
    })
  } else {
    const cols = Math.ceil(Math.sqrt(images.length))
    const cellWidth = Math.max(...images.map((img) => img.width))
    const cellHeight = Math.max(...images.map((img) => img.height))
    images.forEach((img, i) => {
      const r = Math.floor(i / cols)
      const c = i % cols
      const x = c * (cellWidth + options.spacing) + (cellWidth - img.width) / 2
      const y = r * (cellHeight + options.spacing) + (cellHeight - img.height) / 2
      ctx.drawImage(img, x, y)
    })
  }

  // Cleanup object URLs
  images.forEach((img) => URL.revokeObjectURL(img.src))

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
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
    }, 'image/png') // Use PNG for combining to preserve quality
  })
}
