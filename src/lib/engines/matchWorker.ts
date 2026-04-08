/**
 * Match Background Removal Worker
 * Performs heavy pixel-by-pixel CIELAB color distance calculation off the main thread.
 */

function rgbToLab(r: number, g: number, b: number) {
  // 1. 归一化并进行 Gamma 校正
  const nr = r / 255 > 0.04045 ? Math.pow((r / 255 + 0.055) / 1.055, 2.4) : r / 255 / 12.92
  const ng = g / 255 > 0.04045 ? Math.pow((g / 255 + 0.055) / 1.055, 2.4) : g / 255 / 12.92
  const nb = b / 255 > 0.04045 ? Math.pow((b / 255 + 0.055) / 1.055, 2.4) : b / 255 / 12.92

  // 2. RGB -> XYZ (使用 D65 照明体)
  const x = nr * 0.4124 + ng * 0.3576 + nb * 0.1805
  const y = nr * 0.2126 + ng * 0.7152 + nb * 0.0722
  const z = nr * 0.0193 + ng * 0.1192 + nb * 0.9505

  // 3. XYZ -> Lab
  const f = (t: number) => (t > 0.008856 ? Math.pow(t, 1 / 3) : 7.787 * t + 16 / 116)
  const l = 116 * f(y) - 16
  const a = 500 * (f(x) - f(y))
  const b_lab = 200 * (f(y) - f(z))

  return { l, a, b: b_lab }
}

self.onmessage = (e: MessageEvent) => {
  const { pixels, targetColor, tolerance, feather } = e.data
  const data = new Uint8ClampedArray(pixels)

  const targetLab = rgbToLab(targetColor.r, targetColor.g, targetColor.b)
  const MAX_PERCEPTUAL_DIST = 150
  const threshold = tolerance * MAX_PERCEPTUAL_DIST
  const featherRange = feather * MAX_PERCEPTUAL_DIST

  const totalPixels = data.length / 4
  const progressStep = Math.max(1, Math.floor(totalPixels / 20)) // 每 5% 汇报一次

  for (let i = 0; i < data.length; i += 4) {
    // 进度汇报
    const pixelIndex = i / 4
    if (pixelIndex % progressStep === 0) {
      self.postMessage({ type: 'progress', progress: pixelIndex / totalPixels })
    }

    const r = data[i]!
    const g = data[i + 1]!
    const b = data[i + 2]!

    // 1. 严格等值优化：如果是 0 容差且颜色完全一致，直接抠除，避开浮点数误差
    if (tolerance === 0 && r === targetColor.r && g === targetColor.g && b === targetColor.b) {
      data[i + 3] = 0
      continue
    }

    const currentLab = rgbToLab(r, g, b)

    const dist = Math.sqrt(
      Math.pow(currentLab.l - targetLab.l, 2) +
        Math.pow(currentLab.a - targetLab.a, 2) +
        Math.pow(currentLab.b - targetLab.b, 2)
    )

    // 2. 增强的平滑切割逻辑 (Antialiasing)
    // threshold: 容差
    // softness: 由 feather 决定的过渡带宽度
    const softness = Math.max(0.5, featherRange) // 即使 feather 为 0 也保持极微小的平滑以抗锯齿

    if (dist < threshold) {
      data[i + 3] = 0
    } else if (dist < threshold + softness) {
      // 在过渡带内，利用三次插值（Smoothstep）产生更自然的边缘
      const t = (dist - threshold) / softness
      const alpha = t * t * (3 - 2 * t) // Smoothstep 公式
      data[i + 3] = Math.round(data[i + 3]! * alpha)
    }
  }

  // 使用 Transferable Objects 传输 buffer，避免内存复制
  // @ts-expect-error - 适配 DedicatedWorkerGlobalScope.postMessage 签名
  self.postMessage({ type: 'done', pixels: data.buffer }, [data.buffer])
}
