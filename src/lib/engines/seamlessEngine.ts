import type { ImageProcessor } from './types'
import { throwIfAborted } from './abort'
import { withDpi } from '../imageDpi'
import {
  MAX_SEAMLESS_SIDE,
  clampInt,
  computeSheetLayout,
  computeUnitGeometry,
  edgeDiff,
  gradeSeam,
  hasTransparency,
  mirrorBlendSeams,
  normalizeSource,
  normalizeTileMode,
  opaqueBounds,
  seamScore,
  sheetExceedsCanvasLimit,
  snapToPowerOfTwo,
  type SeamGrade,
  type SeamlessSource,
  type SheetLayout,
  type TileMode,
  type UnitGeometry
} from '../seamless'

/** 平铺大图超出浏览器画布上限时抛出，视图据此换成可读提示 */
export const SEAMLESS_SHEET_TOO_LARGE = 'seamless-sheet-too-large'

export interface SeamlessOptions {
  width?: number
  height?: number
  /** 满版图=接缝间距；单元图形=四周留白 */
  gap?: number
  feather?: number
  /** 输入形态；motif 不做折返，保留原版式；auto 按透明通道自动判断（批量导出用） */
  source?: SeamlessSource | 'auto' | string
  /** 旋转角度（度） */
  rotate?: number
  mode?: TileMode | string
  cols?: number
  rows?: number
  /** 导出单元还是平铺大图，默认单元 */
  output?: 'unit' | 'sheet'
  format?: string
  quality?: number
  /** 写入文件头的 DPI（PNG pHYs / JPEG JFIF）；0 表示不写 */
  dpi?: number
  /** 单元宽高取最近的 2 的幂 */
  pow2?: boolean
}

export interface SeamReport {
  score: number
  grade: SeamGrade
  /** 平铺边界相邻像素平均差（0–255 通道尺度） */
  edgeDiff: number
}

export interface SeamlessUnit {
  canvas: HTMLCanvasElement
  seam: SeamReport
}

function loadImage(file: File): Promise<{ image: HTMLImageElement; dispose: () => void }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () =>
      resolve({
        image,
        dispose: () => URL.revokeObjectURL(url)
      })
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('图片加载失败'))
    }
    image.src = url
  })
}

function newCanvas(w: number, h: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  return canvas
}

function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d', { alpha: true })
  if (!ctx) throw new Error('无法初始化 Canvas 绘图上下文')
  return ctx
}

function drawSource(
  ctx: CanvasRenderingContext2D,
  source: HTMLImageElement,
  geometry: UnitGeometry
): void {
  if (geometry.rotate === 0) {
    ctx.drawImage(source, geometry.drawX, geometry.drawY, geometry.drawW, geometry.drawH)
    return
  }
  const cx = geometry.drawX + geometry.drawW / 2
  const cy = geometry.drawY + geometry.drawH / 2
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate((geometry.rotate * Math.PI) / 180)
  ctx.drawImage(source, -geometry.drawW / 2, -geometry.drawH / 2, geometry.drawW, geometry.drawH)
  ctx.restore()
}

function paintBackground(ctx: CanvasRenderingContext2D, w: number, h: number, opaque: boolean) {
  if (!opaque) return
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, w, h)
}

/**
 * 平铺边界的实际断开程度。折返/镜像两种模式下它都应该接近内部噪声；
 * 数值偏大说明接缝仍然可见（单元图形通常是源图边缘本身对不上）。
 */
function measureSeam(unit: HTMLCanvasElement): SeamReport {
  const w = unit.width
  const h = unit.height
  if (w < 2 || h < 2) {
    return { score: 100, grade: 'perfect', edgeDiff: 0 }
  }
  const ctx = context2d(unit)
  const edge = edgeDiff(ctx.getImageData(0, 0, w, h).data, w, h)
  const score = seamScore(edge)
  return { score, grade: gradeSeam(score), edgeDiff: edge }
}

/**
 * 生成一张无缝单元。
 *
 * 满版图：按几何绘制 → 偏移折返 → 接缝镜像羽化。折返把原始四周的接缝搬到
 * 单元中心，平铺时相邻单元的边缘天然连续；羽化只改写中心接缝附近的窄带。
 *
 * 单元图形：只绘制一次。图像已是一个完整单元，折返会把版式整体移位半格
 * （花落在拼缝上、边缘被切开），所以这条路径不做折返、不做羽化。
 */
export function createSeamlessUnit(
  source: HTMLImageElement,
  geometry: UnitGeometry,
  unitW: number,
  unitH: number,
  opaque: boolean,
  kind: SeamlessSource = 'fullBleed'
): SeamlessUnit {
  const w = clampInt(unitW, 1, MAX_SEAMLESS_SIDE)
  const h = clampInt(unitH, 1, MAX_SEAMLESS_SIDE)

  const unit = newCanvas(w, h)
  const ctx = context2d(unit)
  paintBackground(ctx, w, h, opaque)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  drawSource(ctx, source, geometry)

  if (kind === 'motif') {
    return { canvas: unit, seam: measureSeam(unit) }
  }

  // 偏移折返：用快照自身铺四次，接缝落在 (seamX, seamY)
  const snapshot = newCanvas(w, h)
  const sctx = context2d(snapshot)
  sctx.drawImage(unit, 0, 0)

  const dx = geometry.seamX
  const dy = geometry.seamY
  ctx.clearRect(0, 0, w, h)
  paintBackground(ctx, w, h, opaque)
  ctx.drawImage(snapshot, dx, dy)
  ctx.drawImage(snapshot, dx - w, dy)
  ctx.drawImage(snapshot, dx, dy - h)
  ctx.drawImage(snapshot, dx - w, dy - h)

  if (geometry.bandX > 0 || geometry.bandY > 0) {
    const imageData = ctx.getImageData(0, 0, w, h)
    mirrorBlendSeams(
      imageData.data,
      w,
      h,
      geometry.seamX,
      geometry.seamY,
      Math.max(geometry.bandX, geometry.bandY)
    )
    ctx.putImageData(imageData, 0, 0)
  }

  return { canvas: unit, seam: measureSeam(unit) }
}

/** 按布局把无缝单元铺成平铺大图。翻转只用于镜像平铺 */
export function drawSeamlessSheet(
  ctx: CanvasRenderingContext2D,
  unit: HTMLCanvasElement,
  layout: SheetLayout
): void {
  const unitW = unit.width
  const unitH = unit.height
  if (unitW <= 0 || unitH <= 0) return

  for (const cell of layout.cells) {
    ctx.save()
    ctx.translate(cell.x + (cell.flipX ? unitW : 0), cell.y + (cell.flipY ? unitH : 0))
    ctx.scale(cell.flipX ? -1 : 1, cell.flipY ? -1 : 1)
    ctx.drawImage(unit, 0, 0)
    ctx.restore()
  }
}

function assertSheetFits(layout: SheetLayout): void {
  if (sheetExceedsCanvasLimit(layout)) {
    throw new Error(SEAMLESS_SHEET_TOO_LARGE)
  }
}

function canvasToBlob(canvas: HTMLCanvasElement, format: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob)
        else reject(new Error('生成图片数据(Blob)失败'))
      },
      format,
      quality
    )
  })
}

export const seamlessEngine: ImageProcessor<SeamlessOptions> = async (file, options) => {
  const { image, dispose } = await loadImage(file)

  try {
    throwIfAborted(options.signal)
    options.onProgress?.(0.15)

    const rawW = options.width ?? image.naturalWidth
    const rawH = options.height ?? image.naturalHeight
    const unitW = clampInt(options.pow2 ? snapToPowerOfTwo(rawW) : rawW, 1, MAX_SEAMLESS_SIDE)
    const unitH = clampInt(options.pow2 ? snapToPowerOfTwo(rawH) : rawH, 1, MAX_SEAMLESS_SIDE)
    const kind: SeamlessSource =
      options.source === 'auto'
        ? hasTransparency(image)
          ? 'motif'
          : 'fullBleed'
        : normalizeSource(options.source)
    const rotate = options.rotate ?? 0
    const geometry = computeUnitGeometry(image.naturalWidth, image.naturalHeight, unitW, unitH, {
      gap: options.gap ?? 0,
      feather: kind === 'motif' ? 0 : (options.feather ?? 0),
      rotate,
      // 满版图必须铺满单元：contain 会在边长比例变化时留下透明条带，平铺即露出
      cover: kind === 'fullBleed',
      content: kind === 'motif' && rotate !== 0 ? opaqueBounds(image) : undefined
    })

    const format = options.format && options.format !== 'original' ? options.format : 'image/png'
    const quality = options.quality ?? 0.92
    const { canvas: unit } = createSeamlessUnit(
      image,
      geometry,
      unitW,
      unitH,
      format === 'image/jpeg',
      kind
    )
    throwIfAborted(options.signal)
    options.onProgress?.(0.6)

    let outputCanvas = unit

    if (options.output === 'sheet') {
      const layout = computeSheetLayout(
        unitW,
        unitH,
        options.cols ?? 3,
        options.rows ?? 3,
        normalizeTileMode(options.mode)
      )
      assertSheetFits(layout)

      const sheet = newCanvas(layout.width, layout.height)
      const ctx = context2d(sheet)
      paintBackground(ctx, layout.width, layout.height, format === 'image/jpeg')
      drawSeamlessSheet(ctx, unit, layout)
      outputCanvas = sheet
    }

    throwIfAborted(options.signal)
    options.onProgress?.(0.85)

    let blob = await canvasToBlob(outputCanvas, format, quality)
    if (options.dpi && options.dpi > 0) {
      blob = await withDpi(blob, options.dpi, format)
    }
    options.onProgress?.(1)

    return {
      blob,
      size: blob.size,
      width: outputCanvas.width,
      height: outputCanvas.height,
      format
    }
  } finally {
    dispose()
  }
}
