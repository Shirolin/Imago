import { Sam2Model, AutoProcessor, RawImage, env, Tensor } from '@huggingface/transformers'

// 配置环境
env.allowLocalModels = false
if (env.backends?.onnx?.wasm) {
  env.backends.onnx.wasm.proxy = true
}

let model: Sam2Model | null = null
let processor: any = null
let imageEmbeddings: Record<string, Tensor> | null = null
let lastProcessorInputs: any = null

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
    device: device as any,
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

  self.postMessage({ type: 'encoded' })
}

async function decode(points: number[][], labels: number[]) {
  if (!model || !processor || !imageEmbeddings || !lastProcessorInputs) {
    throw new Error('请先执行 Encoder 编码')
  }

  // 1. 准备点坐标：将 [0, 1] 归一化坐标转换为对应 reshaped_input_size 的像素坐标
  const [origH, origW] = lastProcessorInputs.original_sizes[0]
  const [reshapedH, reshapedW] = lastProcessorInputs.reshaped_input_sizes[0]

  // 将归一化的 [0, 1] 映射到 reshaped 坐标系
  const scaledPoints = points.map((p) => [p[0]! * reshapedW, p[1]! * reshapedH])

  // 构造解码器输入
  const modelInputs = {
    ...imageEmbeddings,
    input_points: new Tensor('float32', scaledPoints.flat(), [1, 1, points.length, 2]),
    input_labels: new Tensor('int64', BigInt64Array.from(labels.map(BigInt)), [1, 1, labels.length])
  }

  // 执行解码
  const outputs = await model.forward(modelInputs)

  // 2. 后处理：将遮罩还原回原始尺寸和宽高比
  const postProcessedMasks = await processor.post_process_masks(
    outputs.pred_masks,
    lastProcessorInputs.original_sizes,
    lastProcessorInputs.reshaped_input_sizes
  )

  const maskTensor = postProcessedMasks[0][0][0] // [origH, origW]
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
    }
  } catch (error) {
    const err = error as Error
    self.postMessage({ type: 'error', message: err.message, requestId })
  }
}
