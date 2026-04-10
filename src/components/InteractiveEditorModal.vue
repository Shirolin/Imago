<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import AppModal from './common/AppModal.vue'
import AppButton from './common/AppButton.vue'
import { MinusCircle, PlusCircle, RotateCcw, Check, Loader2 } from 'lucide-vue-next'

const props = defineProps<{
  show: boolean
  imageItem: { id: string; file: File; url: string }
}>()

const emit = defineEmits(['close', 'apply'])

// 状态管理
const isLoading = ref(true)
const statusMessage = ref('连接计算引擎...')
const isEncoding = ref(false)
const points = ref<{ x: number; y: number; label: number }[]>([])
const maskUrl = ref<string | null>(null)
const imageRef = ref<HTMLImageElement | null>(null)

// Worker 引用
let worker: Worker | null = null

// 初始化 Worker
const initWorker = () => {
  import('../lib/engines/sam2.worker?worker').then((WorkerModule) => {
    worker = new WorkerModule.default()
    
    // 主动触发模型加载
    worker.postMessage({ type: 'load' })

    worker!.onmessage = (e) => {
      const { type, message, maskUrl: newMaskUrl } = e.data

      switch (type) {
        case 'status':
          statusMessage.value = message
          break
        case 'ready':
          isLoading.value = false
          startEncoding()
          break
        case 'encoded':
          isEncoding.value = false
          statusMessage.value = '就绪：请点击画面进行标注'
          break
        case 'mask':
          if (maskUrl.value) URL.revokeObjectURL(maskUrl.value)
          maskUrl.value = newMaskUrl
          break
        case 'error':
          console.error('[SAM2 Editor] Error:', message)
          statusMessage.value = `错误: ${message}`
          break
      }
    }
  })
}

const startEncoding = () => {
  if (!props.imageItem.file) return
  isEncoding.value = true
  worker?.postMessage({
    type: 'encode',
    data: { blob: props.imageItem.file }
  })
}

// 交互逻辑：精确计算相对于图片像素的归一化坐标
const handleCanvasClick = (e: MouseEvent) => {
  if (isLoading.value || isEncoding.value || !imageRef.value) return

  const img = imageRef.value
  const rect = img.getBoundingClientRect()
  
  // 计算图片在 object-contain 下的实际显示尺寸和偏移
  const imgRatio = img.naturalWidth / img.naturalHeight
  const containerRatio = rect.width / rect.height
  
  let displayWidth, displayHeight, offsetX, offsetY
  
  if (imgRatio > containerRatio) {
    // 宽度撑满，高度有黑边 (Letterbox)
    displayWidth = rect.width
    displayHeight = rect.width / imgRatio
    offsetX = 0
    offsetY = (rect.height - displayHeight) / 2
  } else {
    // 高度撑满，宽度有黑边 (Pillarbox)
    displayHeight = rect.height
    displayWidth = rect.height * imgRatio
    offsetX = (rect.width - displayWidth) / 2
    offsetY = 0
  }

  // 计算相对于图像有效区域的坐标
  const x = (e.clientX - rect.left - offsetX) / displayWidth
  const y = (e.clientY - rect.top - offsetY) / displayHeight

  // 边界检查：确保点击在图片内
  if (x < 0 || x > 1 || y < 0 || y > 1) return

  // 左键正向(1)，右键负向(0)
  const label = e.button === 2 ? 0 : 1

  points.value.push({ x, y, label })
  triggerDecode()
}

const triggerDecode = () => {
  const pts = points.value.map((p) => [p.x, p.y])
  const lbls = points.value.map((p) => p.label)

  worker?.postMessage({
    type: 'decode',
    data: { points: pts, labels: lbls }
  })
}

const resetPoints = () => {
  points.value = []
  if (maskUrl.value) URL.revokeObjectURL(maskUrl.value)
  maskUrl.value = null
}

const handleApply = async () => {
  if (!maskUrl.value) return
  const res = await fetch(maskUrl.value)
  const blob = await res.blob()
  emit('apply', blob)
}

onMounted(() => {
  if (props.show) initWorker()
})

onUnmounted(() => {
  if (maskUrl.value) URL.revokeObjectURL(maskUrl.value)
  worker?.terminate()
})

watch(
  () => props.show,
  (newVal) => {
    if (newVal && !worker) initWorker()
  }
)
</script>

<template>
  <AppModal
    :show="show"
    pane-only
    title="高级交互编辑器 (SAM2)"
    @close="emit('close')"
  >
    <div class="flex flex-col h-full bg-[#080808] select-none">
      <!-- 顶部工具栏 -->
      <div
        class="h-14 border-b border-white/5 flex items-center justify-between px-4 bg-black/40 backdrop-blur-2xl z-20"
      >
        <div class="flex items-center gap-4">
          <div
            class="flex items-center gap-2.5 px-3 py-1.5 bg-white/5 rounded-full border border-white/10"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-primary animate-pulse shadow-[0_0_8px_rgba(var(--primary-rgb),0.8)]"></span>
            <span class="text-[11px] font-bold text-white/70 uppercase tracking-wider">{{ statusMessage }}</span>
          </div>

          <div class="h-4 w-px bg-white/10"></div>

          <div class="flex gap-2">
            <button
              class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all border border-transparent"
              :class="
                points.length > 0
                  ? 'bg-white/10 text-white hover:bg-white/20 border-white/10'
                  : 'text-white/20 cursor-not-allowed'
              "
              @click="resetPoints"
            >
              <RotateCcw :size="14" />
              清空锚点
            </button>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <AppButton variant="ghost" class="text-white/60 hover:text-white" @click="emit('close')">取消</AppButton>
          <AppButton variant="primary" :disabled="!maskUrl" @click="handleApply">
            <Check :size="16" class="mr-2" />
            应用遮罩
          </AppButton>
        </div>
      </div>

      <!-- 主编辑区 -->
      <div class="flex-1 overflow-hidden relative group" @contextmenu.prevent>
        <!-- 加载遮罩 -->
        <div
          v-if="isLoading || isEncoding"
          class="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/90 backdrop-blur-md transition-all duration-500"
        >
          <div class="relative mb-8">
            <Loader2 class="animate-spin text-primary" :size="48" />
            <div class="absolute inset-0 blur-3xl bg-primary/30 animate-pulse"></div>
          </div>
          <div class="text-xl font-black text-white tracking-widest uppercase mb-2">{{ statusMessage }}</div>
          <div class="flex items-center gap-2 text-white/30 text-[10px] font-bold uppercase tracking-[0.2em]">
            <template v-if="isLoading">
              <span>Initializing WebGPU Environment</span>
            </template>
            <template v-else-if="isEncoding">
              <span>Extracting semantic features</span>
            </template>
          </div>
        </div>

        <!-- 核心视口渲染层 (Viewport) -->
        <div class="absolute inset-0 flex items-center justify-center p-4">
          <!-- 核心交互容器：严格遵循图片自然比例，杜绝溢出截断 -->
          <div 
            class="relative max-w-full max-h-full cursor-crosshair shadow-[0_0_100px_rgba(0,0,0,0.6)]"
            @mousedown="handleCanvasClick"
          >
            <!-- 原图：使用布局约束而非固定比例 -->
            <img
              ref="imageRef"
              :src="imageItem.url"
              class="max-w-full max-h-full block select-none pointer-events-none rounded-lg"
              alt="Base image"
              @load="isLoading = false"
            />

            <!-- 遮罩预览层 (Blue Tint) -->
            <img
              v-if="maskUrl"
              :src="maskUrl"
              class="absolute inset-0 w-full h-full object-contain pointer-events-none mix-blend-screen opacity-75"
              style="
                filter: invert(33%) sepia(90%) saturate(1478%) hue-rotate(185deg) brightness(96%)
                  contrast(101%);
              "
            />

            <!-- 锚点层 -->
            <div
              v-for="(p, i) in points"
              :key="i"
              class="absolute w-5 h-5 -ml-2.5 -mt-2.5 rounded-full border-2 border-white shadow-xl flex items-center justify-center pointer-events-none z-10 transition-transform hover:scale-110"
              :class="p.label === 1 ? 'bg-emerald-500' : 'bg-rose-500'"
              :style="{ left: p.x * 100 + '%', top: p.y * 100 + '%' }"
            >
              <PlusCircle v-if="p.label === 1" :size="12" class="text-white" />
              <MinusCircle v-else :size="12" class="text-white" />
            </div>
          </div>
        </div>

        <!-- 悬浮操作指引：下沉显示，减小体积以防遮挡像素 -->
        <div
          class="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-4 px-5 py-2 bg-black/40 backdrop-blur-md rounded-full border border-white/5 text-[9px] font-bold text-white/40 pointer-events-none transition-all duration-500 group-hover:translate-y-0 translate-y-8 opacity-0 group-hover:opacity-100 uppercase tracking-widest italic"
        >
          <div class="flex items-center gap-2">
            <span class="text-emerald-400">L-Click</span>
            <span class="text-white/10">|</span>
            <span>Add</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-rose-400">R-Click</span>
            <span class="text-white/10">|</span>
            <span>Exclude</span>
          </div>
        </div>
      </div>
    </div>
  </AppModal>
</template>
