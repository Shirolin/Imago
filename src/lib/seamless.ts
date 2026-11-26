/**
 * 四方连续（无缝平铺）的接版几何与接缝羽化。
 *
 * 预览与导出共用这里的纯函数：错位量、单元内绘制矩形、羽化带都只算一次，
 * 画布层只负责按结果绘制，避免「预览好看、导出接不上」。
 */

export const TILE_MODES = [
  'straight',
  'halfDrop',
  'brick',
  'horizontal',
  'vertical',
  'mirror'
] as const

export type TileMode = (typeof TILE_MODES)[number]

/**
 * 输入形态。满版连续图要「折返」把原图接缝搬到单元中心；
 * 单元图形（透明 motif）只要单次绘制即天然无缝，折返反而会把版式移位半格。
 */
export const SEAMLESS_SOURCES = ['fullBleed', 'motif'] as const

export type SeamlessSource = (typeof SEAMLESS_SOURCES)[number]

export function normalizeSource(raw: string | undefined): SeamlessSource {
  return (SEAMLESS_SOURCES as readonly string[]).includes(raw ?? '')
    ? (raw as SeamlessSource)
    : 'fullBleed'
}

/** 单元单边上限。超过这个尺寸，逐像素羽化的内存与耗时都不适合主线程 */
export const MAX_SEAMLESS_SIDE = 8192
/** 平铺大图单边上限（Chrome 画布上限 32767，留出余量） */
export const MAX_SEAMLESS_SHEET_SIDE = 16384
/** Chrome 画布面积上限 2^28；留一点余量给实现差异 */
export const MAX_SEAMLESS_SHEET_AREA = 268_435_456

export function sheetExceedsCanvasLimit(layout: SheetLayout): boolean {
  return (
    layout.width > MAX_SEAMLESS_SHEET_SIDE ||
    layout.height > MAX_SEAMLESS_SHEET_SIDE ||
    layout.width * layout.height > MAX_SEAMLESS_SHEET_AREA
  )
}

export interface SheetCell {
  x: number
  y: number
  flipX: boolean
  flipY: boolean
}

export interface SheetLayout {
  width: number
  height: number
  cols: number
  rows: number
  cells: SheetCell[]
}

export interface UnitGeometry {
  /** 源图在单元内的绘制矩形（未旋转时的外接框） */
  drawX: number
  drawY: number
  drawW: number
  drawH: number
  /** 绕绘制矩形中心旋转的角度（度）。0 表示不旋转 */
  rotate: number
  /** 偏移折返后，原始接缝所在的位置（单元中心） */
  seamX: number
  seamY: number
  /** 羽化半径 */
  bandX: number
  bandY: number
}

export interface ContentBounds {
  x: number
  y: number
  w: number
  h: number
}

export interface UnitGeometryOptions {
  /** 内衬：满版图表示接缝间距，单元图形表示四周留白 */
  gap?: number
  feather?: number
  /** 旋转角度（度）。满版图旋转后按 cover 裁切，单元图形按 contain 缩放 */
  rotate?: number
  /** true 时铺满内衬框（会裁切溢出的部分），false 时完整装入 */
  cover?: boolean
  /**
   * 源图可见内容的外接框（源图像素坐标）。旋转时按它装框，透明边距
   * 不会把图形挤小；不传时退回整张源图。
   */
  content?: ContentBounds
}

export function clampInt(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min
  return Math.max(min, Math.min(max, Math.round(value)))
}

export function normalizeTileMode(raw: string | undefined): TileMode {
  return (TILE_MODES as readonly string[]).includes(raw ?? '') ? (raw as TileMode) : 'straight'
}

export function normalizeCount(raw: number | undefined, min = 1, max = 8): number {
  return clampInt(raw ?? min, min, max)
}

/**
 * 平铺布局。行列数按接版方式收敛（二方连续只沿一个方向铺），
 * 返回的 width/height 恒为 单元尺寸 × 行列数。
 *
 * 1/2 跳接与砖块会沿错位方向溢出半个单元，这里补一格回绕单元盖住空出的
 * 半边；绘制顺序不影响结果，因为所有单元都是同一张无缝图。
 */
export function computeSheetLayout(
  unitW: number,
  unitH: number,
  cols: number,
  rows: number,
  mode: TileMode
): SheetLayout {
  const w = clampInt(unitW, 1, MAX_SEAMLESS_SIDE)
  const h = clampInt(unitH, 1, MAX_SEAMLESS_SIDE)
  let c = normalizeCount(cols)
  let r = normalizeCount(rows)
  const tile = normalizeTileMode(mode)

  if (tile === 'horizontal') r = 1
  if (tile === 'vertical') c = 1

  const halfW = Math.floor(w / 2)
  const halfH = Math.floor(h / 2)
  const cells: SheetCell[] = []

  for (let j = 0; j < r; j++) {
    for (let i = 0; i < c; i++) {
      let x = i * w
      let y = j * h
      let flipX = false
      let flipY = false

      if (tile === 'halfDrop' && i % 2 === 1) y += halfH
      if (tile === 'brick' && j % 2 === 1) x += halfW
      if (tile === 'mirror') {
        flipX = i % 2 === 1
        flipY = j % 2 === 1
      }

      cells.push({ x, y, flipX, flipY })
    }
  }

  // 半跳接：奇数列表整体下移半格，顶部空出的半格由回绕单元补齐
  if (tile === 'halfDrop') {
    for (let i = 1; i < c; i += 2) {
      cells.push({ x: i * w, y: halfH - h, flipX: false, flipY: false })
    }
  }

  // 砖块：奇数行整体右移半格，左侧空出的半格同理
  if (tile === 'brick') {
    for (let j = 1; j < r; j += 2) {
      cells.push({ x: halfW - w, y: j * h, flipX: false, flipY: false })
    }
  }

  return { width: c * w, height: r * h, cols: c, rows: r, cells }
}

/**
 * 单元内的绘制矩形：间距作为内衬，源图缩放进剩余区域后居中。
 *
 * contain（默认）保证完整装入，旋转也不会溢出单元；cover 用于满版图旋转后
 * 铺满内衬框（裁掉四角），否则旋转会在角上留下透明洞。
 */
export function computeUnitGeometry(
  sourceW: number,
  sourceH: number,
  unitW: number,
  unitH: number,
  options: UnitGeometryOptions = {}
): UnitGeometry {
  const w = clampInt(unitW, 1, MAX_SEAMLESS_SIDE)
  const h = clampInt(unitH, 1, MAX_SEAMLESS_SIDE)
  const srcW = Math.max(1, Math.round(sourceW || 1))
  const srcH = Math.max(1, Math.round(sourceH || 1))
  const g = clampInt(options.gap ?? 0, 0, Math.floor(Math.min(w, h) / 4))
  const boxW = Math.max(1, w - g * 2)
  const boxH = Math.max(1, h - g * 2)
  const rotate = normalizeAngle(options.rotate ?? 0)
  const content = options.content
  // 只有含边距的透明图形需要「按内容装框」；铺满时内容本就等于整张图
  const fitContent = !options.cover && rotate !== 0 && !!content && content.w > 0 && content.h > 0

  const fitW0 = fitContent ? content.w : srcW
  const fitH0 = fitContent ? content.h : srcH
  const rad = (rotate * Math.PI) / 180
  const cos = Math.abs(Math.cos(rad))
  const sin = Math.abs(Math.sin(rad))
  const boundW = Math.max(1e-6, fitW0 * cos + fitH0 * sin)
  const boundH = Math.max(1e-6, fitW0 * sin + fitH0 * cos)

  const fitW = boxW / boundW
  const fitH = boxH / boundH
  const scale = options.cover ? Math.max(fitW, fitH) : Math.min(fitW, fitH)
  const drawW = Math.max(1, Math.round(srcW * scale))
  const drawH = Math.max(1, Math.round(srcH * scale))
  let drawX: number
  let drawY: number
  if (fitContent) {
    drawX = g + Math.round(boxW / 2 - (content.x + content.w / 2) * scale)
    drawY = g + Math.round(boxH / 2 - (content.y + content.h / 2) * scale)
  } else {
    drawX = g + Math.round((boxW - drawW) / 2)
    drawY = g + Math.round((boxH - drawH) / 2)
  }

  const seamX = Math.floor(w / 2)
  const seamY = Math.floor(h / 2)
  // 羽化带不得越过接缝到另一侧，否则镜像采样会互相覆盖
  const maxBand = Math.max(0, Math.min(seamX - 1, w - seamX - 1, seamY - 1, h - seamY - 1))
  const band = clampInt(options.feather ?? 0, 0, maxBand)

  return { drawX, drawY, drawW, drawH, rotate, seamX, seamY, bandX: band, bandY: band }
}

/** 角度归一到 [0, 360)；非有限值视为 0 */
export function normalizeAngle(value: number): number {
  if (!Number.isFinite(value)) return 0
  const a = value % 360
  return a < 0 ? a + 360 : a
}

/** 存在半透明/全透明像素即视为单元图形（折返会破坏版式） */
export function hasTransparency(image: HTMLImageElement): boolean {
  if (!image.naturalWidth || !image.naturalHeight) return false
  const probe = document.createElement('canvas')
  probe.width = 48
  probe.height = 48
  const ctx = probe.getContext('2d', { alpha: true })
  if (!ctx) return false
  ctx.drawImage(image, 0, 0, 48, 48)
  const data = ctx.getImageData(0, 0, 48, 48).data
  for (let i = 3; i < data.length; i += 4) {
    if (data[i]! < 250) return true
  }
  return false
}

/** 可见内容（alpha ≥ 阈值）的外接框，按源图像素坐标返回；全透明时退回整张图 */
export function opaqueBounds(image: HTMLImageElement, threshold = 8): ContentBounds {
  const sw = image.naturalWidth
  const sh = image.naturalHeight
  const full: ContentBounds = { x: 0, y: 0, w: sw, h: sh }
  if (!sw || !sh) return full
  const probe = Math.min(256, Math.max(sw, sh))
  const scale = probe / Math.max(sw, sh)
  const pw = Math.max(1, Math.round(sw * scale))
  const ph = Math.max(1, Math.round(sh * scale))
  const canvas = document.createElement('canvas')
  canvas.width = pw
  canvas.height = ph
  const ctx = canvas.getContext('2d', { alpha: true })
  if (!ctx) return full
  ctx.drawImage(image, 0, 0, pw, ph)
  const data = ctx.getImageData(0, 0, pw, ph).data
  let minX = pw
  let minY = ph
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < ph; y++) {
    for (let x = 0; x < pw; x++) {
      if (data[(y * pw + x) * 4 + 3]! < threshold) continue
      if (x < minX) minX = x
      if (x > maxX) maxX = x
      if (y < minY) minY = y
      if (y > maxY) maxY = y
    }
  }
  if (maxX < 0) return full
  const sx = sw / pw
  const sy = sh / ph
  return {
    x: Math.floor(minX * sx),
    y: Math.floor(minY * sy),
    w: Math.max(1, Math.ceil((maxX - minX + 1) * sx)),
    h: Math.max(1, Math.ceil((maxY - minY + 1) * sy))
  }
}

/** 取最近的 2 的幂（纹理/游戏管线常要求），并收敛到 [min, max] */
export function snapToPowerOfTwo(value: number, min = 64, max = MAX_SEAMLESS_SIDE): number {
  const v = Math.max(min, Math.min(max, Math.round(value || min)))
  const lower = 2 ** Math.floor(Math.log2(v))
  const upper = 2 ** Math.ceil(Math.log2(v))
  const snapped = v - lower <= upper - v ? lower : upper
  return Math.max(min, Math.min(max, snapped))
}

/** 平铺边界（左右、上下）相邻像素的平均绝对差，单位与像素通道值一致 */
export function edgeDiff(data: Uint8ClampedArray, width: number, height: number): number {
  const w = clampInt(width, 1, MAX_SEAMLESS_SIDE)
  const h = clampInt(height, 1, MAX_SEAMLESS_SIDE)
  if (w < 2 || h < 2) return 0
  let sum = 0
  let n = 0
  for (let y = 0; y < h; y++) {
    const left = y * w * 4
    const right = (y * w + w - 1) * 4
    for (let c = 0; c < 4; c++) sum += Math.abs(data[left + c]! - data[right + c]!)
    n += 4
  }
  for (let x = 0; x < w; x++) {
    const top = x * 4
    const bottom = ((h - 1) * w + x) * 4
    for (let c = 0; c < 4; c++) sum += Math.abs(data[top + c]! - data[bottom + c]!)
    n += 4
  }
  return sum / n
}

export type SeamGrade = 'perfect' | 'good' | 'fair' | 'poor'

/**
 * 边界差达到这个值就视为明显接缝：未折返的硬接缝通常在 20–40，
 * 处理好之后只剩几个通道级噪声。
 */
export const SEAM_VISIBLE_DIFF = 40

/** 接缝可见度换算成 0–100 分（100 = 边界与内部噪声无异） */
export function seamScore(edge: number): number {
  if (!Number.isFinite(edge)) return 0
  const ratio = 1 - edge / SEAM_VISIBLE_DIFF
  return Math.round(100 * Math.max(0, Math.min(1, ratio)))
}

export function gradeSeam(score: number): SeamGrade {
  if (score >= 95) return 'perfect'
  if (score >= 80) return 'good'
  if (score >= 60) return 'fair'
  return 'poor'
}

function blendPremultiplied(
  from: Uint8ClampedArray,
  to: Uint8ClampedArray,
  i1: number,
  i2: number,
  weight: number
): void {
  const o1 = i1 * 4
  const o2 = i2 * 4
  const a1 = from[o1 + 3]!
  const a2 = from[o2 + 3]!
  const w1 = 1 - weight
  const outA = a1 * w1 + a2 * weight
  if (outA <= 0) {
    to[o1] = 0
    to[o1 + 1] = 0
    to[o1 + 2] = 0
    to[o1 + 3] = 0
    return
  }
  // 直通道数据要按预乘空间混合，否则透明区会把 RGB 拉黑（半透明脏边）
  for (let ch = 0; ch < 3; ch++) {
    to[o1 + ch] = (from[o1 + ch]! * a1 * w1 + from[o2 + ch]! * a2 * weight) / outA
  }
  to[o1 + 3] = outA
}

/**
 * 在接缝两侧做镜像交叉淡化。
 *
 * 偏移折返把原始接缝搬到单元中心；两侧内容在这里互为镜像采样，
 * 距接缝越近权重越大，接缝处两侧都收敛到同一组混合值，从而消除硬边。
 * 只改写接缝附近的窄带，远处像素保持不变。
 */
export function mirrorBlendSeams(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  seamX: number,
  seamY: number,
  band: number
): void {
  const w = clampInt(width, 1, MAX_SEAMLESS_SIDE)
  const h = clampInt(height, 1, MAX_SEAMLESS_SIDE)
  if (w < 3 || h < 3) return
  const sx = clampInt(seamX, 1, w - 1)
  const sy = clampInt(seamY, 1, h - 1)
  const b = clampInt(band, 0, Math.max(0, Math.min(sx - 1, w - sx - 1, sy - 1, h - sy - 1)))
  if (b <= 0) return

  // 水平 pass 读快照、写原缓冲；垂直 pass 读水平结果，避免两轴互相吃掉
  const base = new Uint8ClampedArray(data)

  for (let y = 0; y < h; y++) {
    for (let d = -b; d <= b; d++) {
      const x = sx + d
      const mx = 2 * sx - 1 - x
      if (x < 0 || x >= w || mx < 0 || mx >= w) continue
      // d=0 与 d=-1 是接缝两侧的同一对像素，权重必须相同才能收敛到同一值
      const weight = 0.5 * (1 - (Math.max(1, Math.abs(d)) - 1) / b)
      blendPremultiplied(base, data, y * w + x, y * w + mx, weight)
    }
  }

  const mid = new Uint8ClampedArray(data)

  for (let x = 0; x < w; x++) {
    for (let d = -b; d <= b; d++) {
      const y = sy + d
      const my = 2 * sy - 1 - y
      if (y < 0 || y >= h || my < 0 || my >= h) continue
      const weight = 0.5 * (1 - (Math.max(1, Math.abs(d)) - 1) / b)
      blendPremultiplied(mid, data, y * w + x, my * w + x, weight)
    }
  }
}
