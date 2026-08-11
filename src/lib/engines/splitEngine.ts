import type { ImageProcessor, ProcessResult, SplitOptions } from './types'

/**
 * 智能切图引擎 (Web Canvas 版)
 */
export const splitEngine: ImageProcessor<SplitOptions> = async (file, options) => {
  // 1. 基础预检
  if (!file || file.size === 0) {
    throw new Error('无效的图片文件')
  }

  return new Promise<ProcessResult>((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)

    img.onload = async () => {
      URL.revokeObjectURL(url)

      // 2. 尺寸合法性检查
      if (img.width === 0 || img.height === 0) {
        reject(new Error('图片尺寸无效'))
        return
      }

      const results: Blob[] = []
      const {
        rows,
        cols,
        mode,
        customLines,
        centerMode = 'none',
        shave = 0,
        format = file.type,
        quality = 0.9,
        onProgress
      } = options

      // 计算切分边界 (保持原逻辑)
      let boundariesX: number[] = []
      let boundariesY: number[] = []

      if (mode === 'custom' && customLines) {
        boundariesX = [0, ...customLines.x.sort((a, b) => a - b), img.width]
        boundariesY = [0, ...customLines.y.sort((a, b) => a - b), img.height]
      } else {
        const tileW = img.width / cols
        const tileH = img.height / rows
        for (let i = 0; i <= cols; i++) boundariesX.push(i * tileW)
        for (let i = 0; i <= rows; i++) boundariesY.push(i * tileH)
      }

      const actualRows = boundariesY.length - 1
      const actualCols = boundariesX.length - 1
      const totalTiles = actualRows * actualCols

      if (totalTiles <= 0) {
        reject(new Error('切分参数导致无有效切片生成'))
        return
      }

      let processedCount = 0

      try {
        for (let r = 0; r < actualRows; r++) {
          for (let c = 0; c < actualCols; c++) {
            if (options.signal?.aborted) {
              throw new Error('AbortError')
            }

            processedCount++
            if (processedCount % 10 === 0) {
              await new Promise((res) => setTimeout(res, 0))
            }

            onProgress?.(processedCount / totalTiles)

            const canvas = document.createElement('canvas')
            const ctx = canvas.getContext('2d', { willReadFrequently: centerMode !== 'none' })
            if (!ctx) {
              throw new Error('无法初始化 Canvas 绘图上下文')
            }

            const startX = boundariesX[c]!
            const startY = boundariesY[r]!
            const endX = boundariesX[c + 1]!
            const endY = boundariesY[r + 1]!

            const sourceX = startX + shave
            const sourceY = startY + shave
            const sourceW = endX - startX - shave * 2
            const sourceH = endY - startY - shave * 2

            // P1-2：零宽/零高切片不再静默跳过，直接报错给出可显示信息，避免 resolve 出缺失/空切片
            if (sourceW <= 0 || sourceH <= 0) {
              throw new Error('切分参数导致切片尺寸为零，请减小裁剪边距或调整分割线位置')
            }

            if (centerMode !== 'none') {
              const tempCanvas = document.createElement('canvas')
              tempCanvas.width = sourceW
              tempCanvas.height = sourceH
              const tempCtx = tempCanvas.getContext('2d', { willReadFrequently: true })
              if (tempCtx) {
                tempCtx.drawImage(img, sourceX, sourceY, sourceW, sourceH, 0, 0, sourceW, sourceH)
                const bgPixel = tempCtx.getImageData(0, 0, 1, 1).data
                const bounds = getContentBounds(tempCtx, bgPixel)

                if (bounds && bgPixel) {
                  let finalW = sourceW
                  let finalH = sourceH
                  if (centerMode === 'square') {
                    finalW = finalH = Math.max(sourceW, sourceH)
                  }
                  canvas.width = finalW
                  canvas.height = finalH
                  ctx.fillStyle = `rgba(${bgPixel[0]}, ${bgPixel[1]}, ${bgPixel[2]}, ${bgPixel[3]! / 255})`
                  ctx.fillRect(0, 0, finalW, finalH)
                  const destX = (finalW - bounds.width) / 2
                  const destY = (finalH - bounds.height) / 2
                  ctx.drawImage(
                    tempCanvas,
                    bounds.x,
                    bounds.y,
                    bounds.width,
                    bounds.height,
                    destX,
                    destY,
                    bounds.width,
                    bounds.height
                  )
                } else {
                  canvas.width = sourceW
                  canvas.height = sourceH
                  ctx.drawImage(img, sourceX, sourceY, sourceW, sourceH, 0, 0, sourceW, sourceH)
                }
                tempCanvas.width = tempCanvas.height = 0
              }
            } else {
              canvas.width = sourceW
              canvas.height = sourceH
              ctx.drawImage(img, sourceX, sourceY, sourceW, sourceH, 0, 0, sourceW, sourceH)
            }

            const blob = await new Promise<Blob | null>((res) => {
              try {
                canvas.toBlob((b) => res(b), format, quality)
              } catch (e) {
                console.error('Blob generation failed:', e)
                res(null)
              }
            })

            if (!blob) {
              // 不再静默吞错：切片编码失败视为整体失败，给出可显示错误
              throw new Error('切片编码失败，请检查图片尺寸或导出格式设置')
            }
            results.push(blob)
            canvas.width = canvas.height = 0
          }
        }
        resolve({
          blobs: results,
          size: results.reduce((acc, b) => acc + b.size, 0)
        })
      } catch (err) {
        reject(err instanceof Error ? err : new Error('渲染切片时发生未知错误'))
      }
    }

    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('图片资源加载失败，请检查文件格式是否正确'))
    }
    img.src = url
  })
}

function getContentBounds(ctx: CanvasRenderingContext2D, bgPixel: Uint8ClampedArray) {
  const { width, height } = ctx.canvas
  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data
  const threshold = 30

  // 分级扫描步长
  const step = width * height > 1000000 ? 4 : 1

  let minY = -1,
    maxY = -1,
    minX = -1,
    maxX = -1

  const isDifferent = (x: number, y: number) => {
    const i = (y * width + x) * 4
    return (
      Math.abs((data[i] ?? 0) - (bgPixel[0] ?? 0)) > threshold ||
      Math.abs((data[i + 1] ?? 0) - (bgPixel[1] ?? 0)) > threshold ||
      Math.abs((data[i + 2] ?? 0) - (bgPixel[2] ?? 0)) > threshold
    )
  }

  // 1. 从上往下找 minY
  for (let y = 0; y < height; y += step) {
    for (let x = 0; x < width; x += step) {
      if (isDifferent(x, y)) {
        minY = y
        break
      }
    }
    if (minY !== -1) break
  }
  if (minY === -1) return null // 全是背景

  // 2. 从下往上找 maxY
  for (let y = height - 1; y >= minY; y -= step) {
    for (let x = 0; x < width; x += step) {
      if (isDifferent(x, y)) {
        maxY = y
        break
      }
    }
    if (maxY !== -1) break
  }

  // 3. 从左往右找 minX (仅在 minY 到 maxY 范围内)
  for (let x = 0; x < width; x += step) {
    for (let y = minY; y <= maxY; y += step) {
      if (isDifferent(x, y)) {
        minX = x
        break
      }
    }
    if (minX !== -1) break
  }

  // 4. 从右往左找 maxX
  for (let x = width - 1; x >= minX; x -= step) {
    for (let y = minY; y <= maxY; y += step) {
      if (isDifferent(x, y)) {
        maxX = x
        break
      }
    }
    if (maxX !== -1) break
  }

  // 边缘微调 (针对 step > 1)
  if (step > 1) {
    minY = Math.max(0, minY - step)
    maxY = Math.min(height - 1, maxY + step)
    minX = Math.max(0, minX - step)
    maxX = Math.min(width - 1, maxX + step)
  }

  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 }
}
