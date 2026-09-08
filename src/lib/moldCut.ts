/** 模具切纯逻辑：无 DOM、无 store，可单测。 */

export const MOLD_PRESETS = [16, 32, 48, 64] as const
export const DEFAULT_MOLD_SIDE = 32
export const MAX_BASKET = 100
export const MIN_MOLD_SIDE = 1
/**
 * 模具边上限 2048：cropEngine 按最终尺寸建临时画布（宽×高×4B），
 * 2048² 约 16MB 安全，16384² 约 1GB 会直接打爆 canvas。
 */
export const MAX_MOLD_SIDE = 2048

export interface MoldRect {
  x: number
  y: number
  w: number
  h: number
}

/** 取整：与 cropEngine 同规则，起点 round、宽高按右端 round 差值 */
export function roundCoord(n: number): number {
  return Math.round(n)
}

export function normalizeMoldSize(w: number, h: number): { w: number; h: number } {
  const cw = Math.min(MAX_MOLD_SIDE, Math.max(MIN_MOLD_SIDE, Math.round(w)))
  const ch = Math.min(MAX_MOLD_SIDE, Math.max(MIN_MOLD_SIDE, Math.round(h)))
  return {
    w: Number.isFinite(cw) ? cw : DEFAULT_MOLD_SIDE,
    h: Number.isFinite(ch) ? ch : DEFAULT_MOLD_SIDE
  }
}

export function normalizeMold(rect: MoldRect): MoldRect {
  const size = normalizeMoldSize(rect.w, rect.h)
  return {
    x: Number.isFinite(rect.x) ? Math.round(rect.x) : 0,
    y: Number.isFinite(rect.y) ? Math.round(rect.y) : 0,
    ...size
  }
}

/** 是否出界（出界部分按设计补透明，JPEG 另见 needsOpaqueFill） */
export function isOutOfBounds(mold: MoldRect, imgW: number, imgH: number): boolean {
  return mold.x < 0 || mold.y < 0 || mold.x + mold.w > imgW || mold.y + mold.h > imgH
}

/**
 * 拖拽收容：允许出界，但至少留 8px 在图内，防止模具彻底丢出视野。
 * 纯 UI 护栏，不改变“允许出界补透明”的导出语义。
 */
export function containMold(mold: MoldRect, imgW: number, imgH: number): MoldRect {
  const margin = 8
  return {
    ...mold,
    x: Math.min(Math.max(mold.x, margin - mold.w), imgW - margin),
    y: Math.min(Math.max(mold.y, margin - mold.h), imgH - margin)
  }
}

/** 收集篮基名：{原名}_{x}_{y}_{w}x{h}，扩展名由导出时按 MIME 追加 */
export function buildStampBaseName(originalName: string, mold: MoldRect): string {
  const dot = originalName.lastIndexOf('.')
  const base = dot > 0 ? originalName.substring(0, dot) : originalName
  const m = normalizeMold(mold)
  return `${base}_${m.x}_${m.y}_${m.w}x${m.h}`
}

/** JPEG 无 Alpha 通道，出界透明边需填白底而非透明 */
export function needsOpaqueFill(format: string, sourceType: string): boolean {
  const target = format === 'original' ? sourceType : format
  return target === 'image/jpeg' || target === 'image/jpeg-li'
}

export function canAddToBasket(count: number): boolean {
  return count < MAX_BASKET
}

export type MoldHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

const isCorner = (h: MoldHandle): boolean => h.length === 2

/**
 * 手柄缩放：dx/dy 已是原图像素位移（调用方负责除以画布 scale）。
 * 允许出界（与 containMold 只管拖拽收容的分工一致），仅钳制 1..MAX。
 * 角手柄 + preserveRatio 时按变化主导轴等比换算。
 */
export function resizeMold(
  mold: MoldRect,
  handle: MoldHandle,
  dx: number,
  dy: number,
  preserveRatio = false
): MoldRect {
  let { x, y, w, h } = mold
  if (handle.includes('e')) w += dx
  if (handle.includes('s')) h += dy
  if (handle.includes('w')) {
    x += dx
    w -= dx
  }
  if (handle.includes('n')) {
    y += dy
    h -= dy
  }

  if (preserveRatio && isCorner(handle) && mold.w > 0 && mold.h > 0) {
    const r = mold.w / mold.h
    if (Math.abs(w - mold.w) / mold.w >= Math.abs(h - mold.h) / mold.h) {
      h = w / r
    } else {
      w = h * r
    }
    if (handle.includes('w')) x = mold.x + mold.w - w
    if (handle.includes('n')) y = mold.y + mold.h - h
  }

  const right = handle.includes('w') ? mold.x + mold.w : x + w
  const bottom = handle.includes('n') ? mold.y + mold.h : y + h
  const nw = Math.min(MAX_MOLD_SIDE, Math.max(MIN_MOLD_SIDE, Math.round(w)))
  const nh = Math.min(MAX_MOLD_SIDE, Math.max(MIN_MOLD_SIDE, Math.round(h)))
  return {
    x: handle.includes('w') ? Math.round(right - nw) : Math.round(x),
    y: handle.includes('n') ? Math.round(bottom - nh) : Math.round(y),
    w: nw,
    h: nh
  }
}

/** ZIP 同名去重：同坐标连盖会产生同名条目，JSZip 会静默覆盖 */
export function uniqueZipName(used: Set<string>, name: string): string {
  let candidate = name
  let i = 2
  while (used.has(candidate)) {
    const dot = name.lastIndexOf('.')
    candidate =
      dot !== -1 ? `${name.substring(0, dot)} (${i})${name.substring(dot)}` : `${name} (${i})`
    i++
  }
  used.add(candidate)
  return candidate
}
