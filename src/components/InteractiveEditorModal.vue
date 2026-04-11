<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useResizeObserver, useEventListener } from '@vueuse/core'
import AppModal from './common/AppModal.vue'
import AppButton from './common/AppButton.vue'
import { MinusCircle, PlusCircle, RotateCcw, Check, Loader2, Undo2, Redo2 } from 'lucide-vue-next'

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
const viewportRef = ref<HTMLElement | null>(null)

// 历史记录栈用于撤销/重做
type Point = { x: number; y: number; label: number }
const historyPast = ref<Point[][]>([])
const historyFuture = ref<Point[][]>([])

// 实时计算图片的物理显示矩形 (Display Rect)
const displayRect = ref({ width: 0, height: 0, left: 0, top: 0 })

const updateDisplayRect = () => {
  if (!imageRef.value || !viewportRef.value) return

  const img = imageRef.value
  const viewport = viewportRef.value
  const vw = viewport.clientWidth
  const vh = viewport.clientHeight
  const nw = img.naturalWidth
  const nh = img.naturalHeight

  if (!nw || !nh) return

  const imageAspect = nw / nh
  const viewportAspect = vw / vh

  let dw, dh

  if (viewportAspect > imageAspect) {
    dh = vh
    dw = vh * imageAspect
  } else {
    dw = vw
    dh = vw / imageAspect
  }

  displayRect.value = {
    width: dw,
    height: dh,
    left: (vw - dw) / 2,
    top: (vh - dh) / 2
  }
}

// 监听尺寸变化
useResizeObserver(viewportRef, updateDisplayRect)
useEventListener(window, 'resize', updateDisplayRect)

// 快捷键监听
useEventListener(window, 'keydown', (e: KeyboardEvent) => {
  if (!props.show || isLoading.value || isEncoding.value) return
  if (e.ctrlKey && e.key.toLowerCase() === 'z') {
    e.preventDefault()
    if (e.shiftKey) {
      redo()
    } else {
      undo()
    }
  } else if (e.ctrlKey && e.key.toLowerCase() === 'y') {
    e.preventDefault()
    redo()
  }
})

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
  if (isLoading.value || isEncoding.value) return

  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()

  // 此时 e.currentTarget 已经是物理锁定层，坐标计算极其简单
  const x = (e.clientX - rect.left) / rect.width
  const y = (e.clientY - rect.top) / rect.height

  // 边界检查
  if (x < 0 || x > 1 || y < 0 || y > 1) return

  // 保存历史记录
  historyPast.value.push([...points.value])
  historyFuture.value = []

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

const undo = () => {
  if (!historyPast.value.length || isLoading.value || isEncoding.value) return
  historyFuture.value.push([...points.value])
  points.value = historyPast.value.pop()!
  if (points.value.length > 0) {
    triggerDecode()
  } else {
    clearMask()
  }
}

const redo = () => {
  if (!historyFuture.value.length || isLoading.value || isEncoding.value) return
  historyPast.value.push([...points.value])
  points.value = historyFuture.value.pop()!
  triggerDecode()
}

const clearMask = () => {
  if (maskUrl.value) URL.revokeObjectURL(maskUrl.value)
  maskUrl.value = null
}

const resetPoints = () => {
  if (points.value.length > 0) {
    historyPast.value.push([...points.value])
    historyFuture.value = []
  }
  points.value = []
  clearMask()
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
    if (newVal) {
      // 打开时彻底清空记录
      historyPast.value = []
      historyFuture.value = []
      points.value = []
      clearMask()
      initWorker()
    } else {
      // 退出清理
    }
  }
)
</script>

<template>
  <AppModal :show="show" pane-only title="高级交互编辑器 (SAM2)" @close="emit('close')">
    <div class="flex-1 flex flex-col bg-[#050505] select-none overflow-hidden min-h-0">
      <!-- 顶部工具栏 -->
      <div class="h-14 border-b border-white/5 flex items-center justify-between px-4 shrink-0">
        <div class="flex items-center gap-4">
          <div
            class="flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-full border border-primary/20"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
            <span class="text-[10px] font-bold text-primary uppercase">{{ statusMessage }}</span>
          </div>
          <button
            v-if="points.length > 0"
            class="text-xs text-white/40 hover:text-white transition-colors"
            @click="resetPoints"
            title="清空"
          >
            清空所有标注
          </button>

          <div class="h-4 w-px bg-white/10 mx-2"></div>

          <div class="flex items-center gap-1.5">
            <button
              class="p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-white/40 transition-colors"
              title="撤销 (Ctrl+Z)"
              :disabled="!historyPast.length"
              @click="undo"
            >
              <Undo2 :size="16" />
            </button>
            <button
              class="p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-white/40 transition-colors"
              title="重做 (Ctrl+Y)"
              :disabled="!historyFuture.length"
              @click="redo"
            >
              <Redo2 :size="16" />
            </button>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <AppButton variant="ghost" size="sm" @click="emit('close')">取消</AppButton>
          <AppButton variant="primary" size="sm" :disabled="!maskUrl" @click="handleApply">
            应用遮罩
          </AppButton>
        </div>
      </div>

      <!-- 图片核心展示区：强制缩放约束 -->
      <div
        ref="viewportRef"
        class="flex-1 relative min-h-0 bg-[#0a0a0a] group overflow-hidden"
        @contextmenu.prevent
      >
        <div class="absolute inset-0 flex items-center justify-center p-2 sm:p-4 md:p-6 lg:p-8">
          <!-- 比例容器 -->
          <div class="relative w-full h-full flex items-center justify-center">
            <!-- 物理交互层 -->
            <div
              class="relative shadow-[0_0_100px_rgba(0,0,0,0.8)] cursor-crosshair transition-all duration-300"
              :style="{
                width: displayRect.width ? `${displayRect.width}px` : 'auto',
                height: displayRect.height ? `${displayRect.height}px` : 'auto'
              }"
              @mousedown="handleCanvasClick"
            >
              <!-- 核心图像 -->
              <img
                ref="imageRef"
                :src="imageItem.url"
                class="w-full h-full block select-none pointer-events-none rounded-sm border border-white/5"
                alt="Interactive target"
                @load="updateDisplayRect"
              />

              <!-- 动态生成的遮罩层 (Blue Tint) -->
              <img
                v-if="maskUrl"
                :src="maskUrl"
                class="absolute inset-0 w-full h-full object-contain pointer-events-none mix-blend-screen opacity-70"
                style="
                  filter: invert(33%) sepia(90%) saturate(2000%) hue-rotate(190deg) brightness(100%)
                    contrast(120%);
                "
              />

              <!-- 交互锚点层 -->
              <div
                v-for="(p, i) in points"
                :key="i"
                class="absolute w-4 h-4 -ml-2 -mt-2 rounded-full border-2 border-white shadow-2xl flex items-center justify-center pointer-events-none z-20 animate-in zoom-in-0 duration-200"
                :class="p.label === 1 ? 'bg-emerald-500' : 'bg-rose-500'"
                :style="{ left: p.x * 100 + '%', top: p.y * 100 + '%' }"
              ></div>
            </div>
          </div>
        </div>

        <!-- 悬浮指令提示板 (恢复) -->
        <div
          class="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-6 px-6 py-2 bg-black/40 backdrop-blur-md rounded-full border border-white/5 text-[10px] font-bold text-white/40 pointer-events-none transition-all duration-300 group-hover:opacity-100 opacity-60 uppercase tracking-widest italic"
        >
          <div class="flex items-center gap-2">
            <span class="text-emerald-400">Left Click</span>
            <span class="text-white/20">/</span>
            <span>Add</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-rose-400">Right Click</span>
            <span class="text-white/20">/</span>
            <span>Remove</span>
          </div>
        </div>
      </div>
    </div>
  </AppModal>
</template>
