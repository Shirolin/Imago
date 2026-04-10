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

// Worker 引用
let worker: Worker | null = null

// 初始化 Worker
const initWorker = () => {
  import('../lib/engines/sam2.worker?worker').then((WorkerModule) => {
    worker = new WorkerModule.default()

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
  isEncoding.value = true
  worker?.postMessage({
    type: 'encode',
    data: { blob: props.imageItem.file }
  })
}

// 交互逻辑
const handleCanvasClick = (e: MouseEvent) => {
  if (isLoading.value || isEncoding.value) return

  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()
  const x = (e.clientX - rect.left) / rect.width
  const y = (e.clientY - rect.top) / rect.height

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
  maskUrl.value = null
}

const handleApply = async () => {
  if (!maskUrl.value) return

  // 将 DataURL 转回 Blob
  const res = await fetch(maskUrl.value)
  const blob = await res.blob()
  emit('apply', blob)
}

onMounted(() => {
  if (props.show) initWorker()
})

onUnmounted(() => {
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
    title="高级交互编辑器 (SAM2)"
    max-width="6xl"
    full-screen
    @close="emit('close')"
  >
    <div class="flex flex-col h-full bg-[#0a0a0a]">
      <!-- 顶部工具栏 -->
      <div
        class="h-14 border-b border-white/5 flex items-center justify-between px-4 bg-white/5 backdrop-blur-xl"
      >
        <div class="flex items-center gap-4">
          <div
            class="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg border border-white/10"
          >
            <span class="w-2 h-2 rounded-full bg-primary animate-pulse"></span>
            <span class="text-xs font-medium text-white/80">{{ statusMessage }}</span>
          </div>

          <div class="h-6 w-px bg-white/10"></div>

          <div class="flex gap-2">
            <button
              class="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              :class="
                points.length > 0
                  ? 'bg-primary text-white'
                  : 'bg-white/5 text-white/40 cursor-not-allowed'
              "
              @click="resetPoints"
            >
              <RotateCcw :size="14" />
              清空锚点
            </button>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <AppButton variant="ghost" @click="emit('close')">取消</AppButton>
          <AppButton variant="primary" :disabled="!maskUrl" @click="handleApply">
            <Check :size="16" class="mr-2" />
            应用遮罩
          </AppButton>
        </div>
      </div>

      <!-- 主编辑区 -->
      <div class="flex-1 overflow-hidden relative group cursor-crosshair" @contextmenu.prevent>
        <!-- 加载遮罩 -->
        <div
          v-if="isLoading || isEncoding"
          class="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/80 backdrop-blur-xl transition-all duration-500"
        >
          <div class="relative mb-8">
            <Loader2 class="animate-spin text-primary" :size="48" />
            <div class="absolute inset-0 blur-2xl bg-primary/20 animate-pulse"></div>
          </div>
          <div class="text-xl font-bold text-white tracking-tight mb-2">{{ statusMessage }}</div>
          <div class="flex items-center gap-2 text-white/40 text-sm font-medium">
            <template v-if="isLoading">
              <span>正在建立 WebGPU 环境...</span>
            </template>
            <template v-else-if="isEncoding">
              <span>正在提取图像语义特征，请稍候</span>
            </template>
          </div>
        </div>

        <!-- 画布层 -->
        <div class="w-full h-full flex items-center justify-center p-8 select-none">
          <div class="relative max-w-full max-h-full shadow-2xl overflow-hidden rounded-lg">
            <!-- 原图 -->
            <img
              :src="imageItem.url"
              class="max-w-full max-h-full block pointer-events-none"
              alt="Base image"
            />

            <!-- 遮罩预览层 (Blue Tint) -->
            <img
              v-if="maskUrl"
              :src="maskUrl"
              class="absolute inset-0 w-full h-full object-contain pointer-events-none mix-blend-screen opacity-60"
              style="
                filter: invert(33%) sepia(90%) saturate(1478%) hue-rotate(185deg) brightness(96%)
                  contrast(101%);
              "
            />

            <!-- 锚点层 -->
            <div class="absolute inset-0" @mousedown="handleCanvasClick">
              <div
                v-for="(p, i) in points"
                :key="i"
                class="absolute w-4 h-4 -ml-2 -mt-2 rounded-full border-2 border-white shadow-lg flex items-center justify-center pointer-events-none"
                :class="p.label === 1 ? 'bg-green-500' : 'bg-red-500'"
                :style="{ left: p.x * 100 + '%', top: p.y * 100 + '%' }"
              >
                <PlusCircle v-if="p.label === 1" :size="10" class="text-white" />
                <MinusCircle v-else :size="10" class="text-white" />
              </div>
            </div>
          </div>
        </div>

        <!-- 浮动提示 -->
        <div
          class="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-4 px-6 py-3 bg-black/80 backdrop-blur-md rounded-2xl border border-white/10 text-xs text-white/60 pointer-events-none transition-all group-hover:translate-y-0 translate-y-4 opacity-0 group-hover:opacity-100"
        >
          <div class="flex items-center gap-2">
            <kbd class="px-1.5 py-0.5 bg-white/10 rounded border border-white/20 text-white"
              >左键</kbd
            >
            <span>添加区域</span>
          </div>
          <div class="flex items-center gap-2">
            <kbd class="px-1.5 py-0.5 bg-white/10 rounded border border-white/20 text-white"
              >右键</kbd
            >
            <span>排除区域</span>
          </div>
        </div>
      </div>
    </div>
  </AppModal>
</template>
