import type { MultiImageProcessor } from './types'
import { MAX_COMBINE_CANVAS_AREA, MAX_COMBINE_CANVAS_SIDE } from '../limits'
import { throwIfAborted } from './abort'
import { computeLayout, paintCombine, type CombineLayoutOptions } from '../combineLayout'

export interface CombineOptions extends CombineLayoutOptions {
  backgroundColor: string
  borderRadius?: number
  format?: string
  quality?: number
}

export const combineEngine: MultiImageProcessor<CombineOptions> = async (files, options) => {
  if (files.length === 0) throw new Error('未选择任何图片进行拼接')

  const borderRadius = options.borderRadius || 0
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

    // P2-2：中止检查 —— 加载完成后、布局计算前响应一次
    throwIfAborted(options.signal)

    // 1. 布局几何：与预览走同一个 computeLayout 实现（预览/导出结果一致）
    const layout = computeLayout(
      images.map((img) => ({ width: img.width, height: img.height })),
      options
    )

    // 2. 校验画布尺寸上限并创建画布
    // Chrome 画布上限：单边 32767、总面积约 2^28（268M）像素；
    // 超限时按比例缩小输出，避免创建超大画布导致崩溃或静默失败（P0-2）
    const rawW = layout.width
    const rawH = layout.height
    const MAX_CANVAS_SIDE = MAX_COMBINE_CANVAS_SIDE
    const MAX_CANVAS_AREA = MAX_COMBINE_CANVAS_AREA
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

    // 超限缩小：ctx.scale 让 paintCombine 在同一缩放空间内绘制
    if (scale < 1) ctx.scale(scale, scale)

    // 3. 背景 + 格子绘制（透明清除/非透明填充、网格裁剪、圆角都在模块内）
    paintCombine(ctx, images, layout, {
      backgroundColor: options.backgroundColor,
      borderRadius
    })

    const outputFormat = (options.format === 'original' ? undefined : options.format) || 'image/png'
    const outputQuality = options.quality ?? 0.9

    // P2-2：编码前再检查一次，避免中止后仍产出大 Blob
    throwIfAborted(options.signal)

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
