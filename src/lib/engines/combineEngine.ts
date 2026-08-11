import type { MultiImageProcessor } from './types'

export interface CombineOptions {
  direction: 'vertical' | 'horizontal' | 'grid'
  spacing: number
  backgroundColor: string
  // 智能模式选项：'original' (原始对齐), 'smart' (轴向缩放齐平)
  layoutMode?: 'original' | 'smart'
  alignment: 'start' | 'center' | 'end'
  columns?: number
  padding?: number
  borderRadius?: number
  format?: string
  quality?: number
}

export const combineEngine: MultiImageProcessor<CombineOptions> = async (files, options) => {
  if (files.length === 0) throw new Error('未选择任何图片进行拼接')

  const padding = options.padding || 0
  const borderRadius = options.borderRadius || 0
  const layoutMode = options.layoutMode || 'smart'
  const objectUrls: string[] = []

  try {
    const images = await Promise.all(
      files.map((file) => {
        return new Promise<HTMLImageElement>((resolve, reject) => {
          const url = URL.createObjectURL(file)
          objectUrls.push(url)
          const img = new Image()
          img.onload = () => resolve(img)
          img.onerror = () => reject(new Error(`图片加载失败: ${file.name}`))
          img.src = url
        })
      })
    )

    // 1. 计算布局参数
    const maxWidth = Math.max(...images.map((img) => img.width))
    const maxHeight = Math.max(...images.map((img) => img.height))

    let totalWidth = 0
    let totalHeight = 0
    let cols = 1
    let rows = 1

    // 存储每张图的绘制信息 { x, y, w, h }
    const drawInfos: { x: number; y: number; w: number; h: number }[] = []

    if (options.direction === 'vertical') {
      let currentY = padding
      images.forEach((img) => {
        let drawW = img.width
        let drawH = img.height
        let drawX = padding

        if (layoutMode === 'smart') {
          // 纵向智能：宽度放大到 maxWidth，高度等比
          drawW = maxWidth
          drawH = img.height * (maxWidth / img.width)
        } else {
          // 原始模式下的水平对齐
          if (options.alignment === 'center') drawX = padding + (maxWidth - img.width) / 2
          else if (options.alignment === 'end') drawX = padding + maxWidth - img.width
        }

        drawInfos.push({ x: drawX, y: currentY, w: drawW, h: drawH })
        currentY += drawH + options.spacing
      })
      totalWidth = maxWidth
      totalHeight = currentY - options.spacing - padding
    } else if (options.direction === 'horizontal') {
      let currentX = padding
      images.forEach((img) => {
        let drawW = img.width
        let drawH = img.height
        let drawY = padding

        if (layoutMode === 'smart') {
          // 横向智能：高度放大到 maxHeight，宽度等比
          drawH = maxHeight
          drawW = img.width * (maxHeight / img.height)
        } else {
          // 原始模式下的垂直对齐
          if (options.alignment === 'center') drawY = padding + (maxHeight - img.height) / 2
          else if (options.alignment === 'end') drawY = padding + maxHeight - img.height
        }

        drawInfos.push({ x: currentX, y: drawY, w: drawW, h: drawH })
        currentX += drawW + options.spacing
      })
      totalWidth = currentX - options.spacing - padding
      totalHeight = maxHeight
    } else {
      // 网格模式
      cols =
        options.columns && options.columns > 0
          ? options.columns
          : Math.ceil(Math.sqrt(images.length))
      rows = Math.ceil(images.length / cols)

      const cellW = maxWidth
      const cellH = maxHeight

      images.forEach((img, i) => {
        const r = Math.floor(i / cols)
        const c = i % cols

        let drawW = img.width
        let drawH = img.height
        let offsetX = 0
        let offsetY = 0

        if (layoutMode === 'smart') {
          // 网格智能：Cover 填充单元格
          const ratio = Math.max(cellW / img.width, cellH / img.height)
          drawW = img.width * ratio
          drawH = img.height * ratio
          offsetX = (cellW - drawW) / 2
          offsetY = (cellH - drawH) / 2
        } else {
          // 原始模式：单元格内对齐
          if (options.alignment === 'center') {
            offsetX = (cellW - img.width) / 2
            offsetY = (cellH - img.height) / 2
          } else if (options.alignment === 'end') {
            offsetX = cellW - img.width
            offsetY = cellH - img.height
          }
        }

        const x = padding + c * (cellW + options.spacing) + offsetX
        const y = padding + r * (cellH + options.spacing) + offsetY
        drawInfos.push({ x, y, w: drawW, h: drawH })
      })

      totalWidth = cols * cellW + (cols - 1) * options.spacing
      totalHeight = rows * cellH + (rows - 1) * options.spacing
    }

    // 2. 校验画布尺寸上限并创建画布
    // Chrome 画布上限：单边 32767、总面积约 2^28（268M）像素；
    // 超限时按比例缩小输出，避免创建超大画布导致崩溃或静默失败（P0-2）
    const rawW = totalWidth + padding * 2
    const rawH = totalHeight + padding * 2
    const MAX_CANVAS_SIDE = 32767
    const MAX_CANVAS_AREA = 268_435_456
    const exceedsLimit =
      rawW > MAX_CANVAS_SIDE || rawH > MAX_CANVAS_SIDE || rawW * rawH > MAX_CANVAS_AREA
    const scale = exceedsLimit
      ? Math.min(
          MAX_CANVAS_SIDE / rawW,
          MAX_CANVAS_SIDE / rawH,
          Math.sqrt(MAX_CANVAS_AREA / (rawW * rawH))
        )
      : 1

    // floor 保证取整后面积/单边严格不超过上限（round 在边界可能超 2^28 面积）
    const finalWidth = Math.max(1, Math.floor(rawW * scale))
    const finalHeight = Math.max(1, Math.floor(rawH * scale))

    const canvas = document.createElement('canvas')
    canvas.width = finalWidth
    canvas.height = finalHeight
    const ctx = canvas.getContext('2d', { alpha: true })
    if (!ctx) throw new Error('无法初始化 Canvas 绘图上下文')

    // 超限缩小：ctx.scale 让后续所有坐标/裁剪/圆角在同一缩放空间内绘制
    if (scale < 1) ctx.scale(scale, scale)

    if (options.backgroundColor === 'transparent') {
      ctx.clearRect(0, 0, Math.ceil(canvas.width / scale), Math.ceil(canvas.height / scale))
    } else {
      ctx.fillStyle = options.backgroundColor
      ctx.fillRect(0, 0, Math.ceil(canvas.width / scale), Math.ceil(canvas.height / scale))
    }

    images.forEach((img, i) => {
      const info = drawInfos[i]!
      const { x, y, w, h } = info

      ctx.save()

      // 处理网格 Cover 模式下的溢出裁剪
      if (options.direction === 'grid' && layoutMode === 'smart') {
        const r = Math.floor(i / cols)
        const c = i % cols
        ctx.beginPath()
        ctx.rect(
          padding + c * (maxWidth + options.spacing),
          padding + r * (maxHeight + options.spacing),
          maxWidth,
          maxHeight
        )
        ctx.clip()
      }

      // 圆角逻辑
      if (borderRadius > 0) {
        ctx.beginPath()
        if (ctx.roundRect) ctx.roundRect(x, y, w, h, borderRadius)
        else ctx.rect(x, y, w, h)
        ctx.clip()
      }

      ctx.drawImage(img, x, y, w, h)
      ctx.restore()
    })

    const outputFormat = (options.format === 'original' ? undefined : options.format) || 'image/png'
    const outputQuality = options.quality ?? 0.9

    // toBlob 前验证画布有效尺寸（缩小取整后仍可能归零，须拦截而非静默失败）
    if (canvas.width <= 0 || canvas.height <= 0) throw new Error('拼接结果尺寸无效，无法导出')

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), outputFormat, outputQuality)
    })

    if (!blob) throw new Error('生成图片数据(Blob)失败')

    return {
      blob,
      size: blob.size,
      width: canvas.width,
      height: canvas.height,
      format: outputFormat
    }
  } finally {
    objectUrls.forEach((url) => {
      try {
        URL.revokeObjectURL(url)
      } catch {
        /* ignore */
      }
    })
  }
}
