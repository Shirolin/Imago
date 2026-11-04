/**
 * 图像引导的遮罩边缘精修（guided filter）。
 *
 * SAM2 输出的是 logits 上采样后的软边，边缘位置跟原图纹理未必对齐。
 * 这里用原图亮度做引导，在 alpha 的未知带（0.02–0.98）内重算 alpha，
 * 让过渡带贴向原图的真实边缘；完全透明/不透明的像素保持原值。
 *
 * 只处理未知带是刻意的：整图重算会把实心前景的 alpha 拉离 1。
 */

const clamp01 = (value: number) => (value < 0 ? 0 : value > 1 ? 1 : value)

/** 可分离盒式均值，边缘按实际窗口像素数取平均（不补零） */
function boxMean(src: Float32Array, width: number, height: number, radius: number): Float32Array {
  const tmp = new Float32Array(src.length)
  const out = new Float32Array(src.length)
  const windows: number[] = []
  for (let x = 0; x < width; x++) {
    windows[x] = Math.min(width - 1, x + radius) - Math.max(0, x - radius) + 1
  }

  for (let y = 0; y < height; y++) {
    const row = y * width
    let sum = 0
    for (let x = 0; x <= Math.min(radius, width - 1); x++) sum += src[row + x]!
    for (let x = 0; x < width; x++) {
      if (x + radius < width) sum += src[row + x + radius]!
      if (x - radius - 1 >= 0) sum -= src[row + x - radius - 1]!
      tmp[row + x] = sum / windows[x]!
    }
  }

  for (let x = 0; x < width; x++) {
    let sum = 0
    for (let y = 0; y <= Math.min(radius, height - 1); y++) sum += tmp[y * width + x]!
    for (let y = 0; y < height; y++) {
      if (y + radius < height) sum += tmp[(y + radius) * width + x]!
      if (y - radius - 1 >= 0) sum -= tmp[(y - radius - 1) * width + x]!
      const lo = Math.max(0, y - radius)
      const hi = Math.min(height - 1, y + radius)
      out[y * width + x] = sum / (hi - lo + 1)
    }
  }
  return out
}

/**
 * @param alpha 遮罩 alpha（0–255），长度 = width * height
 * @param image 引导图 RGBA（通常是缩小到 ≤1024 的原图），尺寸与 alpha 相同
 * @param radius 引导窗口半径（像素）
 * @param eps 正则化强度，越大越接近原 alpha
 */
export function refineMaskWithGuide(
  alpha: Uint8ClampedArray,
  image: Uint8ClampedArray,
  width: number,
  height: number,
  radius = 2,
  eps = 1e-3
): Uint8ClampedArray {
  const n = width * height
  const guide = new Float32Array(n)
  const p = new Float32Array(n)
  const guideSq = new Float32Array(n)
  const guideP = new Float32Array(n)

  for (let i = 0; i < n; i++) {
    const j = i * 4
    const luma = (0.299 * image[j]! + 0.587 * image[j + 1]! + 0.114 * image[j + 2]!) / 255
    const a = alpha[i]! / 255
    guide[i] = luma
    p[i] = a
    guideSq[i] = luma * luma
    guideP[i] = luma * a
  }

  const meanI = boxMean(guide, width, height, radius)
  const meanP = boxMean(p, width, height, radius)
  const meanII = boxMean(guideSq, width, height, radius)
  const meanIP = boxMean(guideP, width, height, radius)

  const a = new Float32Array(n)
  const b = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const varI = meanII[i]! - meanI[i]! * meanI[i]!
    const covIP = meanIP[i]! - meanI[i]! * meanP[i]!
    const ai = covIP / (varI + eps)
    a[i] = ai
    b[i] = meanP[i]! - ai * meanI[i]!
  }

  const meanA = boxMean(a, width, height, radius)
  const meanB = boxMean(b, width, height, radius)

  const out = new Uint8ClampedArray(n)
  for (let i = 0; i < n; i++) {
    const t = p[i]!
    // 未知带外保持原值，避免实心前景/纯背景被引导图拉偏
    const refined = t > 0.02 && t < 0.98 ? clamp01(meanA[i]! * guide[i]! + meanB[i]!) : t
    out[i] = Math.round(refined * 255)
  }
  return out
}
