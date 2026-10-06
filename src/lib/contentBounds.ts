/**
 * 内容边界探测。
 *
 * 裁剪框默认铺满整张图，但用户裁的往往是图内的某个物体。探测「非背景像素」
 * 的包围盒可以把选区自动收紧到内容上。
 *
 * 背景色的判定是「采样首末两行 → 各通道取中位数」。用中位数而非均值是为了
 * 对抗前景污染：若图片顶部本身有内容，均值会被拉偏，中位数仍然稳定。
 *
 * canvas 取样与降采样留在 CropBox（需要真实 HTMLImageElement）；这里是纯算法，
 * 输入 RGBA 字节、输出百分比包围盒，可直接构造数据测试。
 */

export interface Rgba {
  r: number
  g: number
  b: number
  a: number
}

export interface Bounds {
  /** 百分比坐标，与 cropFrame 的局部百分比框同坐标系 */
  x: number
  y: number
  w: number
  h: number
}

/** 背景判定阈值：alpha 差用 40，三个颜色通道的 L1 距离和也用 40 */
const COLOR_TOLERANCE = 40
/** 背景中位 alpha 低于此值时，图片按「透明背景」处理，只比 alpha */
const TRANSPARENT_BG_ALPHA = 64
const FG_ALPHA_THRESHOLD = 128

const median = (values: number[]): number => {
  values.sort((a, b) => a - b)
  return values[Math.floor(values.length / 2)] ?? 0
}

/**
 * 从上下两行采样背景色。
 * step 控制采样密度：短边按 ~40 个采样点取步长，避免大图遍历整行。
 */
export function sampleBackground(data: Uint8ClampedArray, w: number, h: number): Rgba {
  const rs: number[] = []
  const gs: number[] = []
  const bs: number[] = []
  const as: number[] = []
  const step = Math.max(1, Math.round(Math.min(w, h) / 40))
  for (let x = 0; x < w; x += step) {
    const top = x * 4
    const bottom = ((h - 1) * w + x) * 4
    for (const idx of [top, bottom]) {
      rs.push(data[idx]!)
      gs.push(data[idx + 1]!)
      bs.push(data[idx + 2]!)
      as.push(data[idx + 3]!)
    }
  }
  return { r: median(rs), g: median(gs), b: median(bs), a: median(as) }
}

/** 单像素是否属于背景。透明背景只比 alpha，否则比颜色 + alpha */
export function isBackground(pixel: Rgba, bg: Rgba): boolean {
  if (bg.a < TRANSPARENT_BG_ALPHA) return pixel.a < FG_ALPHA_THRESHOLD
  return (
    Math.abs(pixel.r - bg.r) + Math.abs(pixel.g - bg.g) + Math.abs(pixel.b - bg.b) <
      COLOR_TOLERANCE && Math.abs(pixel.a - bg.a) < COLOR_TOLERANCE
  )
}

/**
 * 扫描全部像素求非背景区域的包围盒（百分比）。
 * 整图都是背景时返回 null，调用方应保持原有选区不变。
 */
export function boundsOfNonBackground(
  data: Uint8ClampedArray,
  w: number,
  h: number,
  bg: Rgba = sampleBackground(data, w, h)
): Bounds | null {
  let minX = w
  let minY = h
  let maxX = 0
  let maxY = 0
  let found = false

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      if (!isBackground({ r: data[i]!, g: data[i + 1]!, b: data[i + 2]!, a: data[i + 3]! }, bg)) {
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
        found = true
      }
    }
  }

  if (!found) return null
  return {
    x: (minX / w) * 100,
    y: (minY / h) * 100,
    w: ((maxX - minX + 1) / w) * 100,
    h: ((maxY - minY + 1) / h) * 100
  }
}

/**
 * 降采样到长边不超过 maxSide（保持长宽比）。
 * 供 CropBox 在取像素前把大图缩到可控尺寸——16384² 的原图逐像素扫描会卡住主线程。
 */
export function downsampleSize(w: number, h: number, maxSide: number): { w: number; h: number } {
  if (w <= maxSide && h <= maxSide) return { w, h }
  if (w > h) return { w: maxSide, h: Math.round((h * maxSide) / w) }
  return { w: Math.round((w * maxSide) / h), h: maxSide }
}
