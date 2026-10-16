/**
 * 拼接布局 —— 纯几何,无 DOM 解码、无导出策略。
 *
 * 预览（CombineView）与导出（combineEngine）共用同一份布局实现:
 * 以前两者是两行行手写、靠共享排序勉强同步的复制代码,预览与导出游
 * 结果可能静默分叉;现在几何只在这一个文件里算一次。
 *
 * 职责切分:
 * - computeLayout：给一组 {width,height} 和配置,算出画布尺寸与每格绘制区
 *   （含网格 Cover 模式的溢出裁剪区）；不含画布上限缩小（导出专属）与
 *   预览降采样（预览专属）,两者都在各自调用方处理。
 * - paintCombine：按布局把背景与格子画上 ctx（透明清除/非透明填充、网格
 *   裁剪、圆角）。调用方先自己设好 ctx 变换（导出为上限缩小、预览为降采样）。
 */

export interface CombineInput {
  width: number
  height: number
}

export interface CombineLayoutOptions {
  direction: 'vertical' | 'horizontal' | 'grid'
  // 智能模式选项：'original' (原始对齐), 'smart' (轴向缩放齐平)
  layoutMode?: 'original' | 'smart'
  alignment: 'start' | 'center' | 'end'
  spacing: number
  columns?: number
  padding?: number
}

export interface CombineRect {
  x: number
  y: number
  w: number
  h: number
}

/** 单格绘制区；grid+smart 时带溢出裁剪区,否则无 clip */
export interface CombineCell extends CombineRect {
  clip?: CombineRect
}

export interface CombineLayout {
  /** 原始画布尺寸（含两侧 padding）,未做任何上限/预览缩放 */
  width: number
  height: number
  cells: CombineCell[]
}

/** drawImage 接受的源；从签名推导，避免依赖不在 eslint 全局表里的 DOM 类型名 */
type DrawSource = Parameters<CanvasRenderingContext2D['drawImage']>[0]

export function computeLayout(
  images: CombineInput[],
  options: CombineLayoutOptions
): CombineLayout {
  const padding = options.padding || 0
  const layoutMode = options.layoutMode || 'smart'
  const spacing = options.spacing

  const maxWidth = Math.max(...images.map((img) => img.width))
  const maxHeight = Math.max(...images.map((img) => img.height))

  let totalWidth = 0
  let totalHeight = 0
  let cols = 1
  let rows = 1

  const cells: CombineCell[] = []

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

      cells.push({ x: drawX, y: currentY, w: drawW, h: drawH })
      currentY += drawH + spacing
    })
    totalWidth = maxWidth
    totalHeight = currentY - spacing - padding
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

      cells.push({ x: currentX, y: drawY, w: drawW, h: drawH })
      currentX += drawW + spacing
    })
    totalWidth = currentX - spacing - padding
    totalHeight = maxHeight
  } else {
    // 网格模式
    cols =
      options.columns && options.columns > 0 ? options.columns : Math.ceil(Math.sqrt(images.length))
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

      const cell: CombineCell = {
        x: padding + c * (cellW + spacing) + offsetX,
        y: padding + r * (cellH + spacing) + offsetY,
        w: drawW,
        h: drawH
      }
      // Cover 模式溢出部分需按单元格边界裁剪
      if (layoutMode === 'smart') {
        cell.clip = {
          x: padding + c * (cellW + spacing),
          y: padding + r * (cellH + spacing),
          w: cellW,
          h: cellH
        }
      }
      cells.push(cell)
    })

    totalWidth = cols * cellW + (cols - 1) * spacing
    totalHeight = rows * cellH + (rows - 1) * spacing
  }

  return {
    width: totalWidth + padding * 2,
    height: totalHeight + padding * 2,
    cells
  }
}

export function paintCombine(
  ctx: CanvasRenderingContext2D,
  sources: DrawSource[],
  layout: CombineLayout,
  style: { backgroundColor: string; borderRadius: number }
): void {
  // 背景铺满整个画布（canvas 尺寸 ≥ layout 尺寸,舍入只会更小）
  const bgW = Math.ceil(layout.width)
  const bgH = Math.ceil(layout.height)
  if (style.backgroundColor === 'transparent') {
    ctx.clearRect(0, 0, bgW, bgH)
  } else {
    ctx.fillStyle = style.backgroundColor
    ctx.fillRect(0, 0, bgW, bgH)
  }

  layout.cells.forEach((cell, i) => {
    const src = sources[i]
    if (!src) return

    ctx.save()

    // Cover 模式溢出裁剪
    if (cell.clip) {
      ctx.beginPath()
      ctx.rect(cell.clip.x, cell.clip.y, cell.clip.w, cell.clip.h)
      ctx.clip()
    }

    // 圆角
    if (style.borderRadius > 0) {
      ctx.beginPath()
      if (ctx.roundRect) ctx.roundRect(cell.x, cell.y, cell.w, cell.h, style.borderRadius)
      else ctx.rect(cell.x, cell.y, cell.w, cell.h)
      ctx.clip()
    }

    ctx.drawImage(src, cell.x, cell.y, cell.w, cell.h)
    ctx.restore()
  })
}
