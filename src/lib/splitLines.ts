/**
 * 分割线钳制与吸附。
 *
 * 交互层要在「每个切片至少 1px、线不重叠」的约束下拖动/插入分割线：
 * 位置必须钳制在 [相邻线+1, 相邻线-1] ∩ [1, max-1]。这组约束原先内联在
 * SplitView.vue（约 60 行），既无法单测，也因为同时读 selectedImage /
 * linesX / workspace.scale 而难以表驱动验证。
 *
 * 这里全部改为显式接收参数：调用方负责从 store 与画布状态取数，
 * 便于对边界情形（间隔 ≤1px、贴边、无邻线）穷举。
 */

/**
 * 把位置钳制在 [prev+1, next-1] ∩ [1, max-1]。
 * lo/hi 的嵌套 min/max 保证：相邻线间隙不足时退化为单点而非区间反转。
 */
export function clampWithin(pos: number, prev: number, next: number, max: number): number {
  const lo = Math.min(Math.max(prev + 1, 1), max - 1)
  const hi = Math.max(Math.min(next - 1, max - 1), lo)
  return Math.min(Math.max(pos, lo), hi)
}

/**
 * 拖拽中的线：以相邻线为界钳制。
 * lines 保持有序，index 处的邻线即 index-1 与 index+1（缺边时用 0 / max）。
 */
export function clampDraggedLine(
  pos: number,
  lines: readonly number[],
  index: number,
  max: number
): number {
  const prev = index > 0 ? lines[index - 1]! : 0
  const next = index < lines.length - 1 ? lines[index + 1]! : max
  return clampWithin(pos, prev, next, max)
}

/**
 * 新添加的线：按插入位置（lines 保持有序）以相邻线为界钳制。
 * 相邻线之间已无空隙（间隙 ≤1px）时返回 null，避免插入与既有线重合的重复线。
 */
export function clampNewLine(pos: number, lines: readonly number[], max: number): number | null {
  let k = 0
  while (k < lines.length && lines[k]! <= pos) k++
  const prev = k > 0 ? lines[k - 1]! : 0
  const next = k < lines.length ? lines[k]! : max
  const clamped = clampWithin(pos, prev, next, max)
  if (clamped >= next || clamped <= prev) return null
  return clamped
}

export interface SnapResult {
  pos: number
  snapped: boolean
}

/**
 * 吸附到 0 / max / max/2 三个基准位。
 * threshold 是屏幕像素换算到画布坐标后的距离（15 / scale），
 * 这样缩放时吸附范围在视觉上保持一致。
 */
export function snapLine(pos: number, max: number, threshold: number): SnapResult {
  if (pos < threshold) return { pos: 0, snapped: true }
  if (Math.abs(pos - max) < threshold) return { pos: max, snapped: true }
  if (Math.abs(pos - max / 2) < threshold) return { pos: max / 2, snapped: true }
  return { pos, snapped: false }
}

/** 均匀网格的分割线：n 等分时内部 n-1 条线的位置（不含 0 与 max） */
export function gridLines(count: number, max: number): number[] {
  const out: number[] = []
  for (let i = 1; i < count; i++) out.push((max / count) * i)
  return out
}
