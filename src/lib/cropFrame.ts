/**
 * 裁剪坐标帧变换。
 *
 * 交互层（选区、CropBox 拖拽）用的是**未旋转的局部百分比**坐标，
 * 而 cropEngine 的裁剪坐标定义在**旋转/翻转后画布帧**（workCanvas，
 * 尺寸 rotatedWidth × rotatedHeight）。两者相差一次 90° 旋转（含镜像），
 * 不换算时旋转后输出区域与选区错位、比例锁定失效。
 *
 * 推导：引擎变换 p' = T(rotW/2, rotH/2) · R(θ) · S(sx, sy) · (p − (W/2, H/2))，
 * 对 90° 倍数每个输出轴只依赖一个输入轴，轴对齐框的映射可逐轴闭式求解。
 * 以旋转 90°（无翻转）为例：X = H − oy、Y = ox，故局部框 (px,py,pw,ph)
 * → 旋转帧 (H − py − ph, px, ph, pw)；180°：镜像 (W − px − pw, H − py − ph, pw, ph)；
 * 270°：(py, W − px − pw, ph, pw)。flipH/flipV（sx/sy ∈ {±1}）参与各轴符号。
 *
 * 原先这些函数内联在 CropView.vue 里（约 150 行），因被 <script setup> 语法
 * 锁住而完全不可测；坐标变换是最容易出 1px 错误的地方，抽出后可表驱动验证。
 */

export interface RotRect {
  x: number
  y: number
  w: number
  h: number
}

/** 局部百分比框 → 旋转帧像素框 */
export function toRotatedFrame(
  crop: RotRect,
  W: number,
  H: number,
  rotation: number,
  flipH: boolean,
  flipV: boolean
): RotRect {
  const rot = ((rotation % 360) + 360) % 360
  const sx = flipH ? -1 : 1
  const sy = flipV ? -1 : 1
  const px = (crop.x / 100) * W
  const py = (crop.y / 100) * H
  const pw = (crop.w / 100) * W
  const ph = (crop.h / 100) * H

  switch (rot) {
    case 90:
      return {
        x: sy === 1 ? H - py - ph : py,
        y: sx === 1 ? px : W - px - pw,
        w: ph,
        h: pw
      }
    case 180:
      return {
        x: sx === 1 ? W - px - pw : px,
        y: sy === 1 ? H - py - ph : py,
        w: pw,
        h: ph
      }
    case 270:
      return {
        x: sy === 1 ? py : H - py - ph,
        y: sx === 1 ? W - px - pw : px,
        w: ph,
        h: pw
      }
    default:
      return {
        x: sx === 1 ? px : W - px - pw,
        y: sy === 1 ? py : H - py - ph,
        w: pw,
        h: ph
      }
  }
}

/** 反向：旋转帧像素矩形 → 未旋转局部帧百分比（供数字输入回写 internalCrop） */
export function fromRotatedFrame(
  rect: RotRect,
  W: number,
  H: number,
  rotation: number,
  flipH: boolean,
  flipV: boolean
): RotRect {
  const rot = ((rotation % 360) + 360) % 360
  const sx = flipH ? -1 : 1
  const sy = flipV ? -1 : 1
  const { x: X, y: Y, w: cw, h: ch } = rect

  let px: number, py: number, pw: number, ph: number
  switch (rot) {
    case 90:
      px = sx === 1 ? Y : W - Y - ch
      pw = ch
      py = sy === 1 ? H - X - cw : X
      ph = cw
      break
    case 180:
      px = sx === 1 ? W - X - cw : X
      pw = cw
      py = sy === 1 ? H - Y - ch : Y
      ph = ch
      break
    case 270:
      px = sx === 1 ? W - Y - ch : Y
      pw = ch
      py = sy === 1 ? X : H - X - cw
      ph = cw
      break
    default:
      px = sx === 1 ? X : W - X - cw
      pw = cw
      py = sy === 1 ? Y : H - Y - ch
      ph = ch
  }
  return {
    x: (px / W) * 100,
    y: (py / H) * 100,
    w: (pw / W) * 100,
    h: (ph / H) * 100
  }
}

/**
 * 旋转后画布尺寸（引擎 workCanvas）：90°/270° 时宽高互换。
 * 负旋转（-90）与 450° 都应视作 90°，故先归一到 [0,360)。
 */
export function rotatedDims(
  width: number | undefined,
  height: number | undefined,
  rotation: number
): { w: number; h: number } {
  if (!width || !height) return { w: 0, h: 0 }
  const rot = ((rotation % 360) + 360) % 360
  return rot % 180 !== 0 ? { w: height, h: width } : { w: width, h: height }
}

/** 局部百分比框 → 旋转帧像素框（四边取整，与引擎端 round 规则一致） */
export function toPixelCoords(
  crop: RotRect,
  W: number,
  H: number,
  rotation: number,
  flipH: boolean,
  flipV: boolean
): RotRect {
  const r = toRotatedFrame(crop, W, H, rotation, flipH, flipV)
  return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h) }
}

/**
 * 数字输入写回局部百分比时的护栏，防止非法值透传给引擎
 * （范围与 CropBox 拖拽允许范围一致）。
 */
export function clampCropPercent(p: RotRect): RotRect {
  return {
    x: Number(Math.max(-50, Math.min(150, p.x)).toFixed(4)),
    y: Number(Math.max(-50, Math.min(150, p.y)).toFixed(4)),
    w: Number(Math.max(0.5, Math.min(200, p.w)).toFixed(4)),
    h: Number(Math.max(0.5, Math.min(200, p.h)).toFixed(4))
  }
}

/**
 * 裁剪矩形是否落在旋转画布内（越界时描边并禁用 CTA）。
 * 尺寸未知时视为合法——此时还没选定图片，不该拦。
 */
export function isCropBoundsValid(coords: RotRect, canvasW: number, canvasH: number): boolean {
  if (!canvasW || !canvasH) return true
  return (
    coords.x >= 0 &&
    coords.y >= 0 &&
    coords.w >= 1 &&
    coords.h >= 1 &&
    coords.x + coords.w <= canvasW &&
    coords.y + coords.h <= canvasH
  )
}
