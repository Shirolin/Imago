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
// 上一次 decode 输出的 logit 空间遮罩，用于增量修正 (mask feedback loop)
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

  // 1. 准备点坐标：将 [0, 1] 归一化坐标转换为对应 reshaped_input_size 的像素坐标
  const [reshapedH, reshapedW] = lastProcessorInputs.reshaped_input_sizes[0]

  // 将归一化的 [0, 1] 映射到 reshaped 坐标系
  const scaledPoints = points.map((p) => [p[0]! * reshapedW, p[1]! * reshapedH])

  // 构造解码器输入
  const modelInputs: Record<string, Tensor> = {
    ...imageEmbeddings,
    input_points: new Tensor('float32', scaledPoints.flat(), [1, 1, points.length, 2]),
    input_labels: new Tensor('int64', BigInt64Array.from(labels.map(BigInt)), [1, 1, labels.length])
  }

  // 核心优化：Mask Logit Feedback Loop
  // 将上一次 decode 的 logit 空间遮罩作为本次输入的 mask_input
  // 模型会在已有结果上"增量修正"，而非每次从零重算，大幅减少内部空洞
  if (prevMaskLogits) {
    modelInputs.mask_input = prevMaskLogits
    modelInputs.has_mask_input = new Tensor('float32', [1], [1])
  } else {
    modelInputs.has_mask_input = new Tensor('float32', [0], [1])
  }

  // 执行解码
  const outputs = await model.forward(modelInputs)

  // 取置信度最高的遮罩索引 (防止多点交互时遮罩坍缩)
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

  // 存储本次 decode 的最优 logit 遮罩供下次迭代使用
  // pred_masks 形状: [1, num_masks, 256, 256]
  if (outputs.pred_masks && outputs.pred_masks.dims.length === 4) {
    const [b, , h, w] = outputs.pred_masks.dims
    const stride = h * w
    const start = bestIndex * stride
    const logitSlice = (outputs.pred_masks.data as Float32Array).slice(start, start + stride)
    prevMaskLogits = new Tensor('float32', logitSlice, [b, 1, h, w])
  }

  // 2. 后处理：将遮罩还原回原始尺寸和宽高比
  const postProcessedMasks = await processor.post_process_masks(
    outputs.pred_masks,
    lastProcessorInputs.original_sizes,
    lastProcessorInputs.reshaped_input_sizes
  )

  const maskTensor = postProcessedMasks[0][0][bestIndex] // [origH, origW]
  const dims = maskTensor.dims
  const maskW = dims[1]
  const maskH = dims[0]

  // 渲染到画布
  const canvas = new OffscreenCanvas(maskW, maskH)
  const ctx = canvas.getContext('2d')!
  const imageData = ctx.createImageData(maskW, maskH)

  const data = maskTensor.data as Uint8Array
  for (let i = 0; i < data.length; ++i) {
    const val = data[i]! > 0 ? 255 : 0
    const j = i * 4
    imageData.data[j] = 255 // R
    imageData.data[j + 1] = 255 // G
    imageData.data[j + 2] = 255 // B
    imageData.data[j + 3] = val // A
  }

  ctx.putImageData(imageData, 0, 0)
  const maskBlob = await canvas.convertToBlob()
  const maskUrl = URL.createObjectURL(maskBlob)

  self.postMessage({ type: 'mask', maskUrl })
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
        // 用户清空标注点时，同步清除历史 logit 遮罩
        prevMaskLogits = null
        break
    }
  } catch (error) {
    const err = error as Error
    self.postMessage({ type: 'error', message: err.message, requestId })
  }
}
