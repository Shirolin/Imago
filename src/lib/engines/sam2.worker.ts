import { Sam2Model, AutoProcessor, RawImage, env, Tensor } from '@huggingface/transformers'

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

const MODEL_ID = 'onnx-community/sam2-hiera-tiny-ONNX'

async function loadModel() {
  if (model && processor) return

  // 检查 WebGPU 支持
  let device = 'webgpu'
  // @ts-expect-error - navigator.gpu might not be in standard worker types
  if (!self.navigator.gpu) {
    device = 'wasm'
  }

  self.postMessage({ type: 'status', message: `正在加载 SAM2 模型 (${device})...` })

  processor = await AutoProcessor.from_pretrained(MODEL_ID)
  model = (await Sam2Model.from_pretrained(MODEL_ID, {
    device: device as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    dtype: device === 'webgpu' ? 'fp16' : 'fp32'
  })) as Sam2Model

  self.postMessage({ type: 'ready' })
}

async function encode(imageBlob: Blob) {
  if (!model || !processor) await loadModel()
  if (!model || !processor) throw new Error('模型未加载成功')

  const image = await RawImage.fromBlob(imageBlob)

  self.postMessage({ type: 'status', message: '正在提取图像特征 (Encoder)...' })

  lastProcessorInputs = await processor(image)
  imageEmbeddings = await model.get_image_embeddings(lastProcessorInputs)

  // 新图像编码时清除历史 logit 遮罩
  prevMaskLogits = null

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

  // 更新 Feedback 遮罩 (256x256)
  if (outputs.pred_masks && outputs.pred_masks.dims.length === 4) {
    const dims = outputs.pred_masks.dims
    const h = dims[2]!
    const w = dims[3]!
    const stride = h * w
    const start = bestIndex * stride
    const logitSlice = (outputs.pred_masks.data as Float32Array).slice(start, start + stride)
    prevMaskLogits = new Tensor('float32', logitSlice, [1, 1, h, w])
  }

  // 2. 后处理与 Alpha 渲染 (遵循 Plan 3.2)
  const postProcessedMasks = await processor.post_process_masks(
    outputs.pred_masks,
    lastProcessorInputs.original_sizes,
    lastProcessorInputs.reshaped_input_sizes
  )

  const fullMaskBatch = postProcessedMasks[0]
  const dims = fullMaskBatch.dims
  const maskW = dims[dims.length - 1]
  const maskH = dims[dims.length - 2]
  const allLogits = fullMaskBatch.data as Float32Array
  const stride = maskH * maskW
  const bestLogits = allLogits.slice(bestIndex * stride, (bestIndex + 1) * stride)

  const canvas = new OffscreenCanvas(maskW, maskH)
  const ctx = canvas.getContext('2d')!
  const imageData = ctx.createImageData(maskW, maskH)

  // A. 二值化用于填洞判定 (严格使用 0.0 作为前景阈值)
  const binaryAlpha = new Uint8Array(maskW * maskH)
  for (let i = 0; i < bestLogits.length; ++i) {
    binaryAlpha[i] = bestLogits[i]! > 0.0 ? 255 : 0
  }

  // B. 鲁棒填洞算法 (消除噪点)
  const filledBinary = fillHoles(binaryAlpha, maskW, maskH)

  // C. Sigmoid 渲染
  for (let i = 0; i < bestLogits.length; ++i) {
    const j = i * 4
    const logit = bestLogits[i]!

    // ⚠️ 核心修复：彻底解决背景蓝色遮罩问题
    // 只有 logit > 0 (模型认定的前景) 或填洞补全区域才显示透明度
    // 否则强制 Alpha 为 0。
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
  const maskBlob = await canvas.convertToBlob()
  const maskUrl = URL.createObjectURL(maskBlob)

  self.postMessage({ type: 'mask', maskUrl })
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
      case 'reset':
        prevMaskLogits = null
        break
    }
  } catch (error) {
    console.error('[SAM2 Worker Error]', error)
    self.postMessage({ type: 'error', message: (error as Error).message, requestId })
  }
}
