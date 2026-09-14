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

interface MatchTargetColor {
  r: number
  g: number
  b: number
}

/**
 * 纯色提取像素管线（原地改写 data）：
 * 1. 用 CIELAB 感知距离定 alpha —— 阈值内全透，羽化带内按源 alpha 做 smoothstep 收缩；
 * 2. 去污染 —— 半透明像素按覆盖率 un-premultiply，把混入的 key 色从 RGB 里解回去；
 * 3. 去溢色 —— 贴近背景的保留像素，把 key 方向溢出的分量压回中性基线（另两通道均值）。
 * key 色为中性（白/灰幕，ksum≈0）时第 3 步自动 noop。
 */
export function processMatchPixels(
  data: Uint8ClampedArray,
  targetColor: MatchTargetColor,
  tolerance: number,
  feather: number,
  onProgress?: (progress: number) => void
): void {
  const tr = targetColor.r
  const tg = targetColor.g
  const tb = targetColor.b
  const targetLab = rgbToLabOptimized(tr, tg, tb)
  const MAX_PERCEPTUAL_DIST = 150
  const threshold = tolerance * MAX_PERCEPTUAL_DIST
  const softness = Math.max(0.5, feather * MAX_PERCEPTUAL_DIST)

  const totalPixels = data.length / 4
  const progressStep = Math.max(1, Math.floor(totalPixels / 20))

  // key 色特征方向(去溢色用): 各通道超出其均值的部分。白幕三通道均衡, ksum≈0 自动 noop。
  const tavg = (tr + tg + tb) / 3
  const kr = Math.max(0, tr - tavg)
  const kg = Math.max(0, tg - tavg)
  const kb = Math.max(0, tb - tavg)
  const ksum = kr + kg + kb
  // 去溢色作用半径(Lab 距离): 羽化带外再扩这么远; 主体色(如距 key ~99 的金色高光)在半径外不动
  const DESPILL_RANGE = 40

  for (let i = 0; i < data.length; i += 4) {
    const pixelIndex = i / 4
    if (onProgress && pixelIndex % progressStep === 0) {
      onProgress(pixelIndex / totalPixels)
    }

    let r = data[i]!
    let g = data[i + 1]!
    let b = data[i + 2]!

    const currentLab = rgbToLabOptimized(r, g, b)

    const dist = Math.sqrt(
      Math.pow(currentLab.l - targetLab.l, 2) +
        Math.pow(currentLab.a - targetLab.a, 2) +
        Math.pow(currentLab.b - targetLab.b, 2)
    )

    // 不透明度: 阈值内全透(背景), 羽化带内按源 alpha 做 smoothstep 收缩
    let alpha = data[i + 3]!
    if (dist < threshold) {
      data[i + 3] = 0
      continue
    }
    // 只有本管线判为部分透明的像素, RGB 才是 key 色与主体的混合, 才谈得上去污染
    let mixedWithKey = false
    if (dist < threshold + softness) {
      const t = (dist - threshold) / softness
      alpha = Math.round(alpha * (t * t * (3 - 2 * t)))
      data[i + 3] = alpha
      mixedWithKey = true
    }
    if (alpha === 0) continue

    // 去污染: 边缘过渡像素混着 key 色, 按覆盖率 un-premultiply 把 key 色解出去
    const a = alpha / 255
    if (mixedWithKey && a >= 0.02) {
      const ia = 1 - a
      r = Math.min(255, Math.max(0, (r - tr * ia) / a))
      g = Math.min(255, Math.max(0, (g - tg * ia) / a))
      b = Math.min(255, Math.max(0, (b - tb * ia) / a))
    }

    // 去溢色: 贴近背景的保留像素, 把 key 方向溢出的分量压回中性基线(另两通道均值), 越界不动
    if (ksum > 0 && dist < threshold + softness + DESPILL_RANGE) {
      const nr = (g + b) / 2
      const ng = (r + b) / 2
      const nb = (r + g) / 2
      const pr = Math.max(0, r - nr)
      const pg = Math.max(0, g - ng)
      const pb = Math.max(0, b - nb)
      const spillAlign = (pr * kr + pg * kg + pb * kb) / ksum
      if (spillAlign > 0) {
        r -= Math.min(pr, (spillAlign * kr) / ksum)
        g -= Math.min(pg, (spillAlign * kg) / ksum)
        b -= Math.min(pb, (spillAlign * kb) / ksum)
      }
    }

    data[i] = r
    data[i + 1] = g
    data[i + 2] = b
  }
}

self.onmessage = (e: MessageEvent) => {
  const { pixels, targetColor, tolerance, feather } = e.data
  const data = new Uint8ClampedArray(pixels)

  processMatchPixels(data, targetColor, tolerance, feather, (progress) => {
    self.postMessage({ type: 'progress', progress })
  })

  // @ts-expect-error - 适配 DedicatedWorkerGlobalScope.postMessage 签名
  self.postMessage({ type: 'done', pixels: data.buffer }, [data.buffer])
}
