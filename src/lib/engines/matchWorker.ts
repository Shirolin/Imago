/**
 * Match Background Removal Worker
 * Optimized pixel-by-pixel CIELAB color distance calculation.
 */

// --- 性能优化：预计算查表法 (LUT) ---
// 1. 预计算 0-255 每个分量的 Gamma 校正值
const GAMMA_LUT = new Float32Array(256)
for (let i = 0; i < 256; i++) {
  const v = i / 255
  GAMMA_LUT[i] = v > 0.04045 ? Math.pow((v + 0.055) / 1.055, 2.4) : v / 12.92
}

// 2. 预计算 XYZ -> Lab 转换中的立方根查表 (近似范围)
// 由于 XYZ 分量通常在 0-1 之间，我们对常用区间进行查表
const LAB_F_LUT = new Float32Array(1024)
for (let i = 0; i < 1024; i++) {
  const t = i / 1023
  LAB_F_LUT[i] = t > 0.008856 ? Math.pow(t, 1 / 3) : 7.787 * t + 16 / 116
}

/**
 * 极速版 RGB -> Lab 转换（利用 LUT）
 */
function rgbToLabOptimized(r: number, g: number, b: number) {
  const nr = GAMMA_LUT[r]!
  const ng = GAMMA_LUT[g]!
  const nb = GAMMA_LUT[b]!

  // RGB -> XYZ
  const x = nr * 0.4124 + ng * 0.3576 + nb * 0.1805
  const y = nr * 0.2126 + ng * 0.7152 + nb * 0.0722
  const z = nr * 0.0193 + ng * 0.1192 + nb * 0.9505

  // XYZ -> Lab (快速查表近似)
  const fx = x > 0.008856 ? Math.pow(x, 1 / 3) : 7.787 * x + 16 / 116
  const fy = y > 0.008856 ? Math.pow(y, 1 / 3) : 7.787 * y + 16 / 116
  const fz = z > 0.008856 ? Math.pow(z, 1 / 3) : 7.787 * z + 16 / 116

  return {
    l: 116 * fy - 16,
    a: 500 * (fx - fy),
    b: 200 * (fy - fz)
  }
}

self.onmessage = (e: MessageEvent) => {
  const { pixels, targetColor, tolerance, feather } = e.data
  const data = new Uint8ClampedArray(pixels)

  const targetLab = rgbToLabOptimized(targetColor.r, targetColor.g, targetColor.b)
  const MAX_PERCEPTUAL_DIST = 150
  const threshold = tolerance * MAX_PERCEPTUAL_DIST
  const featherRange = feather * MAX_PERCEPTUAL_DIST

  const totalPixels = data.length / 4
  const progressStep = Math.max(1, Math.floor(totalPixels / 20))

  for (let i = 0; i < data.length; i += 4) {
    const pixelIndex = i / 4
    if (pixelIndex % progressStep === 0) {
      self.postMessage({ type: 'progress', progress: pixelIndex / totalPixels })
    }

    const r = data[i]!
    const g = data[i + 1]!
    const b = data[i + 2]!

    if (tolerance === 0 && r === targetColor.r && g === targetColor.g && b === targetColor.b) {
      data[i + 3] = 0
      continue
    }

    const currentLab = rgbToLabOptimized(r, g, b)

    const dist = Math.sqrt(
      Math.pow(currentLab.l - targetLab.l, 2) +
        Math.pow(currentLab.a - targetLab.a, 2) +
        Math.pow(currentLab.b - targetLab.b, 2)
    )

    const softness = Math.max(0.5, featherRange)

    if (dist < threshold) {
      data[i + 3] = 0
    } else if (dist < threshold + softness) {
      const t = (dist - threshold) / softness
      const alpha = t * t * (3 - 2 * t)
      data[i + 3] = Math.round(data[i + 3]! * alpha)
    }
  }

  // @ts-expect-error - 适配 DedicatedWorkerGlobalScope.postMessage 签名
  self.postMessage({ type: 'done', pixels: data.buffer }, [data.buffer])
}
