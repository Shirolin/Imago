/**
 * AI 抠图偶尔会把「贴着主体的背景色区域」判成前景（典型：物体投在墙上的阴影带）。
 * 这里用一条保守的连通规则清理：只删除与透明区连通、且颜色接近背景调色板的像素。
 *
 * 调色板来自遮罩里已判为背景（alpha≈0）的原图像素，因此不依赖用户输入颜色。
 * 判定用 RGB 距离 + Lab 距离双阈值：RGB 负责区分深橙阴影与暗红墙面（Lab 上只差 17），
 * Lab 负责区分木色墙面与肤色（RGB 上只差 38）——任何一个维度单独用都会误删主体。
 * 半透明混合线只在紧挨着「本次清除的背景块」时清理，避免啃掉皮肤/物体抗锯齿边。
 */

export interface RgbaImage {
  data: Uint8ClampedArray
  width: number
  height: number
}

interface Rgb {
  r: number
  g: number
  b: number
}

type Lab = [number, number, number]

const toLinear = (value: number) => {
  const c = value / 255
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

const rgbToLab = (r: number, g: number, b: number): Lab => {
  const rl = toLinear(r)
  const gl = toLinear(g)
  const bl = toLinear(b)
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  const x = f((rl * 0.4124 + gl * 0.3576 + bl * 0.1805) / 0.95047)
  const y = f(rl * 0.2126 + gl * 0.7152 + bl * 0.0722)
  const z = f((rl * 0.0193 + gl * 0.1192 + bl * 0.9505) / 1.08883)
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)]
}

const deltaE = (a: Lab, b: Lab) =>
  Math.sqrt((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2 + (a[2] - b[2]) ** 2)

const BIN_BITS = 5 // 每通道 32 级
const TRANSPARENT_ALPHA = 8
const OPAQUE_ALPHA = 240
const WALL_MAX_DIST = 42
const WALL_MAX_DE = 14
const FRINGE_MAX_DE = 32
const FRINGE_MAX_DIST = 95
const MIN_PALETTE_SHARE = 0.0005
const OBJECT_MIN_SHARE = 0.005
const PALETTE_OBJECT_MIN_DIST = 45
const ERODE_RADIUS = 8

interface Bin {
  count: number
  r: number
  g: number
  b: number
}

const collectBins = (
  image: RgbaImage,
  alpha: Uint8ClampedArray,
  accept: (index: number) => boolean
) => {
  const { data } = image
  const bins = new Map<number, Bin>()
  let total = 0

  for (let i = 0; i < alpha.length; i++) {
    if (!accept(i)) continue
    total++
    const j = i * 4
    const r = data[j]!
    const g = data[j + 1]!
    const b = data[j + 2]!
    const key =
      ((r >> (8 - BIN_BITS)) << (BIN_BITS * 2)) |
      ((g >> (8 - BIN_BITS)) << BIN_BITS) |
      (b >> (8 - BIN_BITS))
    const entry = bins.get(key)
    if (entry) {
      entry.count++
      entry.r += r
      entry.g += g
      entry.b += b
    } else {
      bins.set(key, { count: 1, r, g, b })
    }
  }
  return { bins, total }
}

const toColors = (bins: Map<number, Bin>, minCount: number): Rgb[] => {
  const colors: Rgb[] = []
  for (const entry of bins.values()) {
    if (entry.count < minCount) continue
    colors.push({
      r: entry.r / entry.count,
      g: entry.g / entry.count,
      b: entry.b / entry.count
    })
  }
  return colors
}

/**
 * 从「遮罩已判为背景」的像素里统计背景色，按 32³ 色立方分桶后取桶内均值。
 * 出现次数过少的桶视为噪声丢弃。
 */
export function collectBackgroundPalette(
  image: RgbaImage,
  alpha: Uint8ClampedArray,
  minShare = MIN_PALETTE_SHARE
): Rgb[] {
  const { bins, total } = collectBins(image, alpha, (i) => alpha[i]! <= TRANSPARENT_ALPHA)
  return toColors(bins, Math.max(1, Math.round(total * minShare)))
}

/**
 * 前景的主色调，取样范围限定在「主体内部」：
 * 像素本身不透明，且四个方向 ERODE_RADIUS 外也不透明（近似腐蚀）。
 * 这样贴着背景的残留块（阴影条带）不会被算成主色调，否则它会把背景调色板里的
 * 同色条目一并否掉，清理能力直接失效。
 */
const collectDominantColors = (image: RgbaImage, alpha: Uint8ClampedArray): Rgb[] => {
  const { width, height } = image
  const opaque = (x: number, y: number) => alpha[y * width + x]! >= OPAQUE_ALPHA
  const isInterior = (i: number) => {
    const x = i % width
    const y = (i / width) | 0
    if (x < ERODE_RADIUS || y < ERODE_RADIUS) return false
    if (x >= width - ERODE_RADIUS || y >= height - ERODE_RADIUS) return false
    return (
      opaque(x, y) &&
      opaque(x - ERODE_RADIUS, y) &&
      opaque(x + ERODE_RADIUS, y) &&
      opaque(x, y - ERODE_RADIUS) &&
      opaque(x, y + ERODE_RADIUS)
    )
  }
  const { bins, total } = collectBins(image, alpha, isInterior)
  return toColors(bins, Math.max(1, Math.round(total * OBJECT_MIN_SHARE)))
}

/**
 * 返回清理后的 alpha 副本（不修改入参，便于遮罩缓存复用）。
 */
export function removeBackgroundResidue(
  alpha: Uint8ClampedArray,
  image: RgbaImage
): Uint8ClampedArray {
  const { width, height, data } = image
  const result = new Uint8ClampedArray(alpha)
  const dominant = collectDominantColors(image, alpha)
  const palette = collectBackgroundPalette(image, alpha).filter((entry) => {
    if (dominant.length === 0) return true
    return dominant.every(
      (color) =>
        Math.sqrt((entry.r - color.r) ** 2 + (entry.g - color.g) ** 2 + (entry.b - color.b) ** 2) >
        PALETTE_OBJECT_MIN_DIST
    )
  })
  if (palette.length === 0) return result

  const paletteLabs = palette.map((entry) => rgbToLab(entry.r, entry.g, entry.b))
  const labCache = new Map<number, Lab>()
  const labAt = (index: number): Lab => {
    const j = index * 4
    const key = (data[j]! << 16) | (data[j + 1]! << 8) | data[j + 2]!
    let lab = labCache.get(key)
    if (!lab) {
      lab = rgbToLab(data[j]!, data[j + 1]!, data[j + 2]!)
      labCache.set(key, lab)
    }
    return lab
  }

  const matches = (index: number, maxDist: number, maxDe?: number) => {
    const j = index * 4
    const limit = maxDist * maxDist
    let lab: Lab | undefined
    for (let i = 0; i < palette.length; i++) {
      const entry = palette[i]!
      const dr = data[j]! - entry.r
      const dg = data[j + 1]! - entry.g
      const db = data[j + 2]! - entry.b
      if (dr * dr + dg * dg + db * db > limit) continue
      // Lab 阈值用来区分「同色系但不同材质」的颜色，
      // 例如木色墙面 (189,138,92) 与肤色 (172,138,126)：RGB 只差 38，Lab 差 21。
      if (maxDe === undefined) return true
      // 取调色板里 Lab 最近的一条，而不是第一条命中 RGB 的：分桶均值有偏差，
      // 否则同一块颜色会因命中顺序不同而时清时不清。
      lab ??= labAt(index)
      if (deltaE(lab, paletteLabs[i]!) <= maxDe) return true
    }
    return false
  }

  const n = width * height
  const visited = new Uint8Array(n)
  const cleared = new Uint8Array(n)
  const queue = new Uint32Array(n)
  const clearedList: number[] = []
  let head = 0
  let tail = 0

  for (let i = 0; i < n; i++) {
    if (alpha[i]! <= TRANSPARENT_ALPHA) {
      visited[i] = 1
      queue[tail++] = i
    }
  }

  const isCleared = (idx: number) => result[idx]! <= TRANSPARENT_ALPHA || cleared[idx] === 1

  const neighborsOf = (idx: number) => {
    const x = idx % width
    const y = (idx / width) | 0
    return [
      [idx - width, y > 0],
      [idx + width, y < height - 1],
      [idx - 1, x > 0],
      [idx + 1, x < width - 1]
    ] as const
  }

  // 第一遍：严格颜色阈值，从透明区向内蔓延
  while (head < tail) {
    const idx = queue[head++]!
    for (const [nb, ok] of neighborsOf(idx)) {
      if (!ok || visited[nb]) continue
      const a = result[nb]!
      if (a <= TRANSPARENT_ALPHA) {
        visited[nb] = 1
        queue[tail++] = nb
        continue
      }
      // 半透明混合线放宽 Lab 阈值，让背景块被「灰化边缘」围住时仍能被找到；
      // 只放宽 Lab 不放宽 RGB，且不透明像素仍用严格阈值，主体不会被连带。
      const maxDe = a >= OPAQUE_ALPHA ? WALL_MAX_DE : FRINGE_MAX_DE
      if (!matches(nb, WALL_MAX_DIST, maxDe)) continue
      result[nb] = 0
      cleared[nb] = 1
      clearedList.push(nb)
      visited[nb] = 1
      queue[tail++] = nb
    }
  }

  // 第二遍：只处理「刚被清除的背景块」边缘的半透明混合线。
  // 已存在的透明区旁边（如皮肤、浅色物体的抗锯齿边）不碰，避免把主体边缘啃掉。
  for (let i = 0; i < clearedList.length; i++) {
    for (const [nb, ok] of neighborsOf(clearedList[i]!)) {
      if (!ok || cleared[nb]) continue
      const a = result[nb]!
      if (a <= TRANSPARENT_ALPHA || a >= OPAQUE_ALPHA) continue
      if (!matches(nb, FRINGE_MAX_DIST)) continue
      result[nb] = 0
      cleared[nb] = 1
      clearedList.push(nb)
    }
  }

  // 第三遍：被两侧已清除背景夹住的 1px 细线。
  // 模型常把残留块的边界压成一条不透明暗线（实测 Lab 差约 18），放不进严格阈值；
  // 但它两侧都已是背景，且只有一像素宽，用放宽的 Lab 阈值也不会啃到主体。
  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x
      if (cleared[idx]) continue
      const a = result[idx]!
      if (a <= TRANSPARENT_ALPHA) continue
      const sandwiched =
        (isCleared(idx - 1) && isCleared(idx + 1)) ||
        (isCleared(idx - width) && isCleared(idx + width))
      if (!sandwiched) continue
      if (!matches(idx, WALL_MAX_DIST, FRINGE_MAX_DE)) continue
      result[idx] = 0
      cleared[idx] = 1
      clearedList.push(idx)
    }
  }

  return result
}
