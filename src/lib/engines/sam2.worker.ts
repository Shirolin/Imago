import { Sam2Model, AutoProcessor, RawImage, env, Tensor } from '@huggingface/transformers'
import { refineMaskWithGuide } from './guidedMaskRefine'

// 配置环境
env.allowLocalModels = false
if (env.backends?.onnx?.wasm) {
  env.backends.onnx.wasm.proxy = true
}

let model: Sam2Model | null = null
let processor: any = null // eslint-disable-line @typescript-eslint/no-explicit-any
let imageEmbeddings: Record<string, Tensor> | null = null
let lastProcessorInputs: any = null // eslint-disable-line @typescript-eslint/no-explicit-any
// 上一次 decode 输出的低分辨率 logit 空间遮罩，用于增量修正 (mask feedback loop)
let prevMaskLogits: Tensor | null = null
// 本次 decode 的三个候选低分辨率 logits，供用户切换后继续点选
let candidateLogits: Float32Array[] = []
let candidateSize = { height: 0, width: 0 }
// 引导图：原图缩到 ≤1024，供遮罩边缘精修使用
let guideImage: { data: Uint8ClampedArray; width: number; height: number } | null = null
let originalImageSize = { width: 0, height: 0 }

const GUIDE_MAX_DIMENSION = 1024

/** 原图等比缩到 ≤1024 后的尺寸；遮罩与引导图共用，保证两者逐像素对齐 */
function targetMaskSize(width: number, height: number) {
  const scale = Math.min(1, GUIDE_MAX_DIMENSION / Math.max(width, height))
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  }
}

const MODEL_ID = 'onnx-community/sam2.1-hiera-tiny-ONNX'

async function loadModel() {
  if (model && processor) return

  // 检查 WebGPU 支持
  let device: 'webgpu' | 'wasm' = 'webgpu'
  // @ts-expect-error - navigator.gpu might not be in standard worker types
  if (!self.navigator.gpu) {
    device = 'wasm'
  }

  self.postMessage({ type: 'status', message: `正在加载 SAM2 模型 (${device})...` })

  processor = await AutoProcessor.from_pretrained(MODEL_ID)

  // WASM 下优先 int8（视觉编码器 50MB，fp32 为 128MB）；不可用时回退 fp32
  const dtype = device === 'webgpu' ? 'fp16' : 'int8'
  try {
    model = (await Sam2Model.from_pretrained(MODEL_ID, {
      device,
      dtype
    })) as Sam2Model
  } catch (error) {
    if (device === 'webgpu') throw error
    self.postMessage({ type: 'status', message: 'int8 权重不可用，回退 fp32...' })
    model = (await Sam2Model.from_pretrained(MODEL_ID, {
      device,
      dtype: 'fp32'
    })) as Sam2Model
  }

  self.postMessage({ type: 'ready' })
}

async function buildGuideImage(imageBlob: Blob) {
  const bitmap = await createImageBitmap(imageBlob)
  const { width, height } = targetMaskSize(bitmap.width, bitmap.height)
  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    bitmap.close()
    guideImage = null
    return
  }
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(bitmap, 0, 0, width, height)
  const data = ctx.getImageData(0, 0, width, height).data
  bitmap.close()
  guideImage = { data, width, height }
}

async function encode(imageBlob: Blob) {
  if (!model || !processor) await loadModel()
  if (!model || !processor) throw new Error('模型未加载成功')

  const image = await RawImage.fromBlob(imageBlob)
  originalImageSize = { width: image.width, height: image.height }

  self.postMessage({ type: 'status', message: '正在提取图像特征 (Encoder)...' })

  lastProcessorInputs = await processor(image)
  imageEmbeddings = await model.get_image_embeddings(lastProcessorInputs)
  await buildGuideImage(imageBlob)

  // 新图像编码时清除历史 logit 遮罩与候选
  prevMaskLogits = null
  candidateLogits = []

  self.postMessage({ type: 'encoded' })
}

async function decode(points: number[][], labels: number[]) {
  if (!model || !processor || !imageEmbeddings || !lastProcessorInputs) {
    throw new Error('请先执行 Encoder 编码')
  }

  // 1. 坐标映射 (遵循 Plan 3.1)
  const reshapedSize =
    lastProcessorInputs.reshaped_input_sizes.data || lastProcessorInputs.reshaped_input_sizes[0]
  const reshapedH = reshapedSize[0]
  const reshapedW = reshapedSize[1]

  // 映射到 reshaped 空间并增加 0.5 像素偏移
  const scaledPoints = points.map((p) => [p[0]! * reshapedW + 0.5, p[1]! * reshapedH + 0.5])

  // 构造解码器输入 - 采用 Rank 4 [batch, 1, N, 2]
  const modelInputs: Record<string, Tensor> = {
    ...imageEmbeddings,
    input_points: new Tensor('float32', scaledPoints.flat(), [1, 1, points.length, 2]),
    input_labels: new Tensor('int64', BigInt64Array.from(labels.map(BigInt)), [
      1,
      1,
      labels.length
    ]),
    // 提供 mask_input 记忆
    mask_input:
      prevMaskLogits || new Tensor('float32', new Float32Array(256 * 256), [1, 1, 256, 256]),
    has_mask_input: new Tensor('float32', [prevMaskLogits ? 1 : 0], [1]),
    multimask_output: new Tensor('bool', [true], [1])
  }

  const outputs = await model.forward(modelInputs)

  // 选取最佳索引
  let bestIndex = 0
  if (outputs.iou_scores) {
    const scores = outputs.iou_scores.data
    let maxScore = -Infinity
    for (let i = 0; i < scores.length; ++i) {
      if (scores[i] > maxScore) {
        maxScore = scores[i]
        bestIndex = i
      }
    }
  }

  // 更新 Feedback 遮罩并缓存三个候选（低分辨率 logit 空间）
  candidateLogits = []
  if (outputs.pred_masks && outputs.pred_masks.dims.length === 4) {
    const dims = outputs.pred_masks.dims
    const h = dims[2]!
    const w = dims[3]!
    const stride = h * w
    const data = outputs.pred_masks.data as Float32Array
    const count = Math.max(1, Math.floor(data.length / stride))
    candidateSize = { height: h, width: w }
    for (let i = 0; i < count; i++) {
      candidateLogits.push(data.slice(i * stride, (i + 1) * stride))
    }
    selectCandidate(bestIndex)
  }

  // 2. 后处理与 Alpha 渲染。
  //    只还原到 ≤1024 的遮罩尺寸：原图尺寸的 3 份浮点遮罩在大图上会吃掉上百 MB，
  //    而最终遮罩本来就会缩到 1024 做边缘精修、再由界面缩放合成。
  //    binarize:false 保留 logits，后面的 Sigmoid 才有意义。
  const target = targetMaskSize(originalImageSize.width, originalImageSize.height)
  const postProcessedMasks = await processor.post_process_masks(
    outputs.pred_masks,
    [[target.height, target.width]],
    lastProcessorInputs.reshaped_input_sizes,
    { binarize: false }
  )

  const fullMaskBatch = postProcessedMasks[0]
  const dims = fullMaskBatch.dims
  const maskW = dims[dims.length - 1]!
  const maskH = dims[dims.length - 2]!
  const allLogits = fullMaskBatch.data as Float32Array
  const stride = maskH * maskW
  const count = Math.max(1, Math.min(3, Math.floor(allLogits.length / stride)))
  const scoreData = outputs.iou_scores?.data as Float32Array | undefined

  // 三个候选全部渲染并回传，由界面切换；低分辨率 feedback 只跟随用户的选择
  const masks: { url: string; score: number }[] = []
  for (let i = 0; i < count; i++) {
    const logits = allLogits.subarray(i * stride, (i + 1) * stride)
    masks.push({
      url: await renderMask(logits, maskW, maskH),
      score: scoreData?.[i] ?? 1
    })
  }

  self.postMessage({ type: 'mask', masks, selected: Math.min(bestIndex, count - 1) })
}

/** 用户切换候选时，后续点选基于该候选继续增量修正 */
function selectCandidate(index: number) {
  if (!candidateLogits.length) return
  const i = Math.min(Math.max(0, index), candidateLogits.length - 1)
  prevMaskLogits = new Tensor('float32', candidateLogits[i]!, [
    1,
    1,
    candidateSize.height,
    candidateSize.width
  ])
}

/** 把候选 logits 渲染成白底 RGBA 遮罩，并在未知带上做图像引导精修 */
async function renderMask(logits: Float32Array, width: number, height: number): Promise<string> {
  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d')!
  const imageData = ctx.createImageData(width, height)

  // A. 二值化用于填洞判定 (严格使用 0.0 作为前景阈值)
  const binaryAlpha = new Uint8Array(width * height)
  for (let i = 0; i < logits.length; ++i) {
    binaryAlpha[i] = logits[i]! > 0.0 ? 255 : 0
  }

  // B. 鲁棒填洞算法 (消除噪点)
  const filledBinary = fillHoles(binaryAlpha, width, height)

  // C. Sigmoid 渲染
  for (let i = 0; i < logits.length; ++i) {
    const j = i * 4
    const logit = logits[i]!

    // 只有 logit > 0 (模型认定的前景) 或填洞补全区域才显示透明度，否则强制 Alpha 为 0
    let finalAlpha = 0
    if (logit > 0.0) {
      // 前景：使用 Sigmoid 平滑 Alpha 实现抗锯齿
      const alpha = 1 / (1 + Math.exp(-logit))
      finalAlpha = Math.round(alpha * 255)
    } else if (filledBinary[i] === 255) {
      // 内部空洞：强制实心显示，解决“空洞小点”
      finalAlpha = 255
    }

    imageData.data[j] = 255
    imageData.data[j + 1] = 255
    imageData.data[j + 2] = 255
    imageData.data[j + 3] = finalAlpha
  }

  ctx.putImageData(imageData, 0, 0)
  const refined = await refineMaskCanvas(canvas)
  const maskBlob = await refined.convertToBlob()
  return URL.createObjectURL(maskBlob)
}

/**
 * 在 ≤1024 的引导图尺度上精修遮罩边缘：
 * SAM2 的软边来自低分辨率上采样，与真实纹理未必对齐；导向滤波只改未知带。
 */
async function refineMaskCanvas(canvas: OffscreenCanvas): Promise<OffscreenCanvas> {
  if (!guideImage) return canvas
  const scale = Math.min(1, GUIDE_MAX_DIMENSION / Math.max(canvas.width, canvas.height))
  const width = Math.max(1, Math.round(canvas.width * scale))
  const height = Math.max(1, Math.round(canvas.height * scale))
  // 与引导图尺寸不一致说明引导图来自别的图像，直接放弃精修
  if (width !== guideImage.width || height !== guideImage.height) return canvas

  const small = new OffscreenCanvas(width, height)
  const ctx = small.getContext('2d')
  if (!ctx) return canvas
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(canvas, 0, 0, width, height)

  const imageData = ctx.getImageData(0, 0, width, height)
  const alpha = new Uint8ClampedArray(width * height)
  for (let i = 0; i < alpha.length; i++) alpha[i] = imageData.data[i * 4 + 3]!
  const refined = refineMaskWithGuide(alpha, guideImage.data, width, height)
  for (let i = 0; i < alpha.length; i++) imageData.data[i * 4 + 3] = refined[i]!
  ctx.putImageData(imageData, 0, 0)
  return small
}

/**
 * 标准形态学填洞算法 (BFS)
 */
function fillHoles(alphaData: Uint8Array, width: number, height: number): Uint8Array {
  const n = width * height
  const visited = new Uint8Array(n)
  const queue: number[] = []

  // 从四边边界发起 BFS，寻找所有连通背景
  for (let x = 0; x < width; x++) {
    const borders = [x, (height - 1) * width + x]
    for (const b of borders) {
      if (alphaData[b] === 0 && !visited[b]) {
        visited[b] = 1
        queue.push(b)
      }
    }
  }
  for (let y = 1; y < height - 1; y++) {
    const borders = [y * width, y * width + (width - 1)]
    for (const b of borders) {
      if (alphaData[b] === 0 && !visited[b]) {
        visited[b] = 1
        queue.push(b)
      }
    }
  }

  let head = 0
  while (head < queue.length) {
    const idx = queue[head++]!
    const cx = idx % width,
      cy = Math.floor(idx / width)
    const neighbors = [idx - width, idx + width, idx - 1, idx + 1]
    const valid = [cy > 0, cy < height - 1, cx > 0, cx < width - 1]
    for (let i = 0; i < 4; i++) {
      if (valid[i] && !visited[neighbors[i]!] && alphaData[neighbors[i]!] === 0) {
        visited[neighbors[i]!] = 1
        queue.push(neighbors[i]!)
      }
    }
  }

  // 所有未被 BFS 触及且 alpha 为 0 的区域即为孤立空洞
  const result = new Uint8Array(alphaData)
  for (let i = 0; i < n; i++) {
    if (alphaData[i] === 0 && !visited[i]) {
      result[i] = 255
    }
  }
  return result
}

self.onmessage = async (event: MessageEvent) => {
  const { type, data, requestId } = event.data
  try {
    switch (type) {
      case 'load':
        await loadModel()
        break
      case 'encode':
        await encode(data.blob)
        break
      case 'decode':
        await decode(data.points, data.labels)
        break
      case 'select-mask':
        selectCandidate(data.index)
        break
      case 'reset':
        prevMaskLogits = null
        candidateLogits = []
        break
    }
  } catch (error) {
    console.error('[SAM2 Worker Error]', error)
    self.postMessage({ type: 'error', message: (error as Error).message, requestId })
  }
}
