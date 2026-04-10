import { Sam2Model, AutoProcessor, RawImage, env, Tensor } from '@huggingface/transformers'

// 配置环境
env.allowLocalModels = false
if (env.backends?.onnx?.wasm) {
  env.backends.onnx.wasm.proxy = true
}

let model: Sam2Model | null = null
let processor: any = null
let imageEmbeddings: Record<string, Tensor> | null = null
let currentImageSize: { width: number; height: number } | null = null

const MODEL_ID = 'facebook/sam2-hiera-tiny'

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
  currentImageSize = { width: image.width, height: image.height }

  self.postMessage({ type: 'status', message: '正在提取图像特征 (Encoder)...' })

  const inputs = await processor(image)
  imageEmbeddings = await model.get_image_embeddings(inputs)

  self.postMessage({ type: 'encoded' })
}

async function decode(points: number[][], labels: number[]) {
  if (!model || !processor || !imageEmbeddings || !currentImageSize) {
    throw new Error('请先执行 Encoder 编码')
  }

  const { width, height } = currentImageSize

  // 缩放点到 1024x1024 (SAM2 内部坐标系)
  const scaledPoints = points.map((p) => [p[0] * 1024, p[1] * 1024])

  // 构造解码器输入
  const modelInputs = {
    ...imageEmbeddings,
    input_points: new Tensor('float32', scaledPoints.flat(), [1, points.length, 2]),
    input_labels: new Tensor('int64', BigInt64Array.from(labels.map(BigInt)), [1, labels.length])
  }

  // 执行解码
  const outputs = await model.forward(modelInputs)

  // 获取预测遮罩 [1, num_prompts, 3, 256, 256]
  const masks = outputs.pred_masks
  if (!masks) throw new Error('未能生成有效的遮罩输出')

  // 选择最高分的遮罩并转为图片
  const maskTensor = masks.slice([0, 0, 0]) // [256, 256]

  const canvas = new OffscreenCanvas(256, 256)
  const ctx = canvas.getContext('2d')!
  const imageData = ctx.createImageData(256, 256)

  const data = maskTensor.data as Float32Array
  for (let i = 0; i < data.length; ++i) {
    const val = data[i]! > 0 ? 255 : 0
    const j = i * 4
    imageData.data[j] = 255
    imageData.data[j + 1] = 255
    imageData.data[j + 2] = 255
    imageData.data[j + 3] = val
  }
  ctx.putImageData(imageData, 0, 0)

  const finalCanvas = new OffscreenCanvas(width, height)
  const finalCtx = finalCanvas.getContext('2d')!
  finalCtx.drawImage(canvas, 0, 0, width, height)

  const blob = await finalCanvas.convertToBlob({ type: 'image/png' })
  const reader = new FileReader()
  reader.onloadend = () => {
    self.postMessage({
      type: 'mask',
      maskUrl: reader.result as string
    })
  }
  reader.readAsDataURL(blob)
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
