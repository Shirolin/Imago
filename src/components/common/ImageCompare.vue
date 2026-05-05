<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useResizeObserver } from '@vueuse/core'
import {
  GripVertical,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Layout,
  AlertCircle,
  Split,
  X
} from 'lucide-vue-next'

const props = defineProps<{
  originalUrl: string | File
  processedUrl: string | File | Blob
  originalSize?: string
  processedSize?: string
  showTransparency?: boolean
}>()

const emit = defineEmits(['close'])
const { t } = useI18n()

// --- 基础状态 ---
const beforeUrl = ref<string>('')
const afterUrl = ref<string>('')
const isDecoding = ref(true)
const error = ref<string | null>(null)

// --- 物理变换状态 (Physical Transform) ---
const zoom = ref(1)
const offset = ref({ x: 0, y: 0 })
const sliderPos = ref(50) // 0-100
const isDragging = ref(false)
const dragStart = ref({ x: 0, y: 0, offX: 0, offY: 0 })

// --- 视口与尺寸状态 ---
const viewportRef = ref<HTMLElement | null>(null)
const imageSize = ref({ width: 0, height: 0 })
const viewportSize = ref({ width: 0, height: 0 })

// 智能计算 FitScale
const calculateFitScale = () => {
  if (!imageSize.value.width || !viewportSize.value.width) return 1
  const padding = 64
  const availableW = viewportSize.value.width - padding
  const availableH = viewportSize.value.height - padding
  return Math.min(availableW / imageSize.value.width, availableH / imageSize.value.height, 1)
}

const updateFitView = () => {
  const fitScale = calculateFitScale()
  zoom.value = fitScale
  // 居中偏移
  offset.value = {
    x: (viewportSize.value.width - imageSize.value.width * fitScale) / 2,
    y: (viewportSize.value.height - imageSize.value.height * fitScale) / 2
  }
}

const initUrls = async () => {
  isDecoding.value = true
  error.value = null
  try {
    if (beforeUrl.value && beforeUrl.value.startsWith('blob:')) URL.revokeObjectURL(beforeUrl.value)
    if (afterUrl.value && afterUrl.value.startsWith('blob:')) URL.revokeObjectURL(afterUrl.value)

    beforeUrl.value =
      typeof props.originalUrl === 'string'
        ? props.originalUrl
        : URL.createObjectURL(props.originalUrl)
    afterUrl.value =
      typeof props.processedUrl === 'string'
        ? props.processedUrl
        : URL.createObjectURL(props.processedUrl as Blob)

    const img = new Image()
    img.src = beforeUrl.value
    await new Promise((resolve, reject) => {
      img.onload = () => {
        imageSize.value = { width: img.naturalWidth, height: img.naturalHeight }
        resolve(true)
      }
      img.onerror = reject
    })

    isDecoding.value = false
    nextTick(() => {
      if (viewportRef.value) {
        viewportSize.value = {
          width: viewportRef.value.clientWidth,
          height: viewportRef.value.clientHeight
        }
        updateFitView()
      }
    })
  } catch {
    error.value = t('common.image.compare.errorDesc')
    isDecoding.value = false
  }
}

// --- 交互逻辑 (Interaction) ---
const handleWheel = (e: WheelEvent) => {
  if (isDecoding.value) return
  e.preventDefault()

  const rect = viewportRef.value?.getBoundingClientRect()
  if (!rect) return

  const mouseX = e.clientX - rect.left
  const mouseY = e.clientY - rect.top

  // 工业级：以鼠标指针为中心缩放
  const delta = e.deltaY > 0 ? 0.9 : 1.1
  const newZoom = Math.max(0.05, Math.min(zoom.value * delta, 20))

  const zoomRatio = newZoom / zoom.value
  offset.value = {
    x: mouseX - (mouseX - offset.value.x) * zoomRatio,
    y: mouseY - (mouseY - offset.value.y) * zoomRatio
  }
  zoom.value = newZoom
}

const sliderActive = ref(false)

const handlePointerDown = (e: PointerEvent) => {
  if (isDecoding.value) return

  viewportRef.value?.setPointerCapture(e.pointerId)

  // 判断是滑动分割线还是平移画布
  if ((e.target as HTMLElement).closest('.compare-slider-handle')) {
    sliderActive.value = true
    return
  }

  isDragging.value = true
  dragStart.value = { x: e.clientX, y: e.clientY, offX: offset.value.x, offY: offset.value.y }
}

const handlePointerMove = (e: PointerEvent) => {
  if (sliderActive.value && viewportRef.value) {
    const rect = viewportRef.value.getBoundingClientRect()
    const x = e.clientX - rect.left
    sliderPos.value = Math.max(0, Math.min(100, (x / rect.width) * 100))
    return
  }

  if (!isDragging.value) return
  const dx = e.clientX - dragStart.value.x
  const dy = e.clientY - dragStart.value.y
  offset.value = { x: dragStart.value.offX + dx, y: dragStart.value.offY + dy }
}

const handlePointerUp = (e: PointerEvent) => {
  isDragging.value = false
  sliderActive.value = false
  viewportRef.value?.releasePointerCapture(e.pointerId)
}

useResizeObserver(viewportRef, (entries) => {
  const entry = entries[0]
  if (!entry) return
  const { width, height } = entry.contentRect
  const oldSize = { ...viewportSize.value }
  viewportSize.value = { width, height }

  // 窗口缩放时保持居中
  if (oldSize.width > 0) {
    offset.value = {
      x: offset.value.x + (width - oldSize.width) / 2,
      y: offset.value.y + (height - oldSize.height) / 2
    }
  }
})

// 共享的变换样式
const sharedTransformStyle = computed(() => ({
  transform: `translate(${offset.value.x}px, ${offset.value.y}px) scale(${zoom.value})`,
  transformOrigin: '0 0'
}))

onMounted(initUrls)
onUnmounted(() => {
  if (beforeUrl.value.startsWith('blob:')) URL.revokeObjectURL(beforeUrl.value)
  if (afterUrl.value.startsWith('blob:')) URL.revokeObjectURL(afterUrl.value)
})

watch(() => [props.originalUrl, props.processedUrl], initUrls)
</script>

<template>
  <div
    class="w-full h-full flex flex-col bg-[#050505] relative overflow-hidden select-none"
    @contextmenu.prevent
  >
    <!--沉浸式专业 HUD：顶栏 -->
    <div
      class="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-black/80 to-transparent z-[100] flex items-center justify-between px-8 pointer-events-none"
    >
      <div class="flex items-center gap-4 pointer-events-auto">
        <div
          class="p-2.5 bg-primary/20 rounded-xl border border-primary/30 text-primary shadow-2xl shadow-primary/20"
        >
          <Layout :size="20" stroke-width="2.5" />
        </div>
        <div class="flex flex-col">
          <h3 class="text-sm font-black text-white uppercase tracking-[0.25em]">
            {{ t('common.image.compare.title') }}
          </h3>
          <span class="text-[9px] font-bold text-white/30 uppercase tracking-widest mt-0.5"
            >Professional Inspection Mode</span
          >
        </div>
      </div>

      <div class="flex items-center gap-6 pointer-events-auto">
        <!-- Before/After 标签组 -->
        <div
          class="flex items-center bg-white/5 backdrop-blur-md rounded-xl p-1 border border-white/10 shadow-2xl"
        >
          <div
            class="px-4 py-1.5 rounded-lg text-[10px] font-black text-white/40 uppercase tracking-widest transition-all"
          >
            {{ t('common.image.card.before') }}
          </div>
          <div class="w-px h-3 bg-white/10"></div>
          <div
            class="px-4 py-1.5 rounded-lg text-[10px] font-black text-primary uppercase tracking-widest transition-all"
          >
            {{ t('common.image.card.after') }}
          </div>
        </div>

        <button
          @click="emit('close')"
          class="w-11 h-11 flex items-center justify-center bg-white/5 hover:bg-rose-500/20 border border-white/10 hover:border-rose-500/30 rounded-xl text-white/40 hover:text-rose-500 transition-all active:scale-90"
        >
          <X :size="20" stroke-width="2.5" />
        </button>
      </div>
    </div>

    <!-- 异常状态 -->
    <div
      v-if="error"
      class="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-6"
    >
      <div
        class="w-20 h-20 bg-destructive/10 rounded-3xl flex items-center justify-center border border-destructive/20 animate-in zoom-in duration-500"
      >
        <AlertCircle :size="40" class="text-destructive" />
      </div>
      <div class="space-y-2">
        <h4 class="text-xl font-black text-white tracking-tight">
          {{ t('common.image.compare.errorTitle') }}
        </h4>
        <p class="text-sm text-white/30 max-w-xs leading-relaxed font-medium">{{ error }}</p>
      </div>
    </div>

    <!-- 加载中状态 -->
    <div
      v-else-if="isDecoding"
      class="flex-1 flex flex-col items-center justify-center p-12 space-y-8"
    >
      <div class="relative">
        <div
          class="w-20 h-20 border-[3px] border-primary/5 border-t-primary rounded-full animate-spin"
        ></div>
        <div class="absolute inset-0 flex items-center justify-center">
          <Split :size="24" class="text-primary/20" />
        </div>
      </div>
      <div class="flex flex-col items-center gap-2">
        <p class="text-[11px] font-black text-primary uppercase tracking-[0.4em] animate-pulse">
          {{ t('common.image.compare.decoding') }}
        </p>
        <span class="text-[9px] font-bold text-white/10 uppercase tracking-widest"
          >Preparing Hardware Acceleration</span
        >
      </div>
    </div>

    <!-- 核心视图区域 (物理锁定层) -->
    <div
      v-else
      ref="viewportRef"
      class="flex-1 relative cursor-grab active:cursor-grabbing overflow-hidden"
      @wheel="handleWheel"
      @pointerdown="handlePointerDown"
      @pointermove="handlePointerMove"
      @pointerup="handlePointerUp"
      @pointerleave="handlePointerUp"
    >
      <!-- 背景统一棋盘格 -->
      <div
        v-if="showTransparency"
        class="absolute inset-0 compare-transparency-grid pointer-events-none opacity-40"
      ></div>

      <!-- 层级 1: 处理后图片 (底层的全屏视口，负责 AFTER) -->
      <div class="absolute inset-0 overflow-hidden pointer-events-none">
        <div class="absolute will-change-transform" :style="sharedTransformStyle">
          <div class="relative">
            <img
              :src="afterUrl"
              class="block max-w-none pointer-events-none shadow-[0_0_120px_rgba(0,0,0,0.8)]"
              style="image-rendering: pixelated"
            />
            <!-- 物理 HUD：处理后尺寸 -->
            <div
              class="absolute bottom-6 right-6 px-4 py-2 bg-black/60 backdrop-blur-xl rounded-xl border border-white/5 text-[10px] font-mono text-white/60 tabular-nums shadow-2xl"
            >
              <span class="opacity-40 mr-2 font-sans font-black">AFTER</span
              >{{ processedSize || '--' }}
            </div>
          </div>
        </div>
      </div>

      <!-- 层级 2: 处理前图片 (顶层的全屏视口，应用视口级裁切，负责 BEFORE) -->
      <div
        class="absolute inset-0 overflow-hidden pointer-events-none"
        :style="{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }"
      >
        <div class="absolute will-change-transform" :style="sharedTransformStyle">
          <div class="relative h-full">
            <img
              :src="beforeUrl"
              class="block max-w-none h-full pointer-events-none"
              style="image-rendering: pixelated"
            />
            <!-- 物理 HUD：原图尺寸 -->
            <div
              class="absolute bottom-6 left-6 px-4 py-2 bg-black/60 backdrop-blur-xl rounded-xl border border-white/5 text-[10px] font-mono text-white/60 tabular-nums shadow-2xl"
            >
              <span class="opacity-40 mr-2 font-sans font-black">BEFORE</span
              >{{ originalSize || '--' }}
            </div>
          </div>
        </div>
      </div>

      <!-- 交互式分割线 (绝对定位于 Viewport，与裁切坐标完美重合) -->
      <div
        class="absolute top-0 bottom-0 w-[2px] bg-white z-50 pointer-events-none shadow-line transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)]"
        :class="{ '!duration-0': sliderActive }"
        :style="{ left: `${sliderPos}%` }"
      >
        <!-- 分割线控制柄 (物理质感 + 对比度增强) -->
        <div
          class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center pointer-events-auto cursor-ew-resize compare-slider-handle group"
        >
          <!-- 外层投影光圈 -->
          <div
            class="absolute inset-0 bg-black/20 rounded-full scale-50 group-hover:scale-100 transition-transform duration-500 blur-2xl"
          ></div>
          <!-- 核心触控体 -->
          <div
            class="w-10 h-10 bg-white rounded-full shadow-[0_0_0_1px_rgba(0,0,0,0.1),0_8px_24px_rgba(0,0,0,0.4)] flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-active:scale-90 border-[4px] border-white"
          >
            <GripVertical :size="18" class="text-black" stroke-width="3" />
          </div>
        </div>
      </div>
    </div>

    <div
      class="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-2 p-2 bg-black/60 backdrop-blur-2xl border border-white/10 rounded-[1.25rem] shadow-[0_20px_50px_rgba(0,0,0,0.5)] z-[100] animate-in fade-in slide-in-from-bottom-4 duration-700"
    >
      <button
        class="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/10 text-white/40 hover:text-white transition-all active:scale-90"
        @click="zoom = Math.max(0.05, zoom * 0.8)"
      >
        <ZoomOut :size="18" stroke-width="2.5" />
      </button>

      <div class="px-4 min-w-[80px] flex items-center justify-center border-x border-white/10">
        <span
          class="text-[11px] font-black font-mono text-white/90 tabular-nums translate-y-[0.5px]"
        >
          {{ Math.round(zoom * 100) }}%
        </span>
      </div>

      <button
        class="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/10 text-white/40 hover:text-white transition-all active:scale-90"
        @click="zoom = Math.min(20, zoom * 1.2)"
      >
        <ZoomIn :size="18" stroke-width="2.5" />
      </button>

      <div class="w-2"></div>

      <button
        class="flex items-center gap-2 px-3 md:px-4 h-10 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-all active:scale-95"
        @click="updateFitView"
      >
        <RotateCcw :size="14" stroke-width="3" />
        <span class="text-[10px] font-black uppercase tracking-widest hidden md:inline"
          >Reset View</span
        >
      </button>
    </div>

    <!-- 交互快捷键 HUD -->
    <div
      class="absolute bottom-12 left-10 hidden xl:flex flex-col gap-3 pointer-events-none z-[100]"
    >
      <div
        class="flex items-center gap-3 text-[9px] font-bold text-white/20 uppercase tracking-[0.2em] italic"
      >
        <div class="w-1.5 h-1.5 rounded-full bg-primary/40 animate-pulse"></div>
        Inspector Shortcuts
      </div>
      <div
        class="flex items-center gap-4 bg-black/20 backdrop-blur-md px-4 py-2 rounded-lg border border-white/5"
      >
        <div class="flex items-center gap-2">
          <kbd class="px-1.5 py-0.5 bg-white/10 rounded text-[9px] text-white/60">Wheel</kbd>
          <span class="text-[8px] text-white/30 uppercase">Zoom</span>
        </div>
        <div class="flex items-center gap-2">
          <kbd class="px-1.5 py-0.5 bg-white/10 rounded text-[9px] text-white/60">Drag</kbd>
          <span class="text-[8px] text-white/30 uppercase">Pan</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.app-transparency-grid-dark {
  background-image:
    linear-gradient(45deg, hsl(var(--muted) / 0.2) 25%, transparent 25%),
    linear-gradient(-45deg, hsl(var(--muted) / 0.2) 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, hsl(var(--muted) / 0.2) 75%),
    linear-gradient(-45deg, transparent 75%, hsl(var(--muted) / 0.2) 75%);
  background-size: 20px 20px;
  background-position:
    0 0,
    0 10px,
    10px -10px,
    -10px 0px;
  background-color: hsl(var(--background));
}

/* 分割线高对比度阴影：确保在纯白背景下依然可见 */
.shadow-line {
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.1),
    0 0 15px rgba(0, 0, 0, 0.5);
}

.compare-slider-handle {
  touch-action: none;
}
</style>
