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

const HUD_INSET = { top: 96, side: 48, bottom: 128 }

type CompareSide = 'before' | 'after' | 'split'

const compareSide = computed((): CompareSide => {
  if (sliderPos.value <= 8) return 'after'
  if (sliderPos.value >= 92) return 'before'
  return 'split'
})

const snapToSide = (side: Exclude<CompareSide, 'split'>) => {
  sliderPos.value = side === 'before' ? 100 : 0
}

const calculateFitScale = () => {
  if (!imageSize.value.width || !viewportSize.value.width) return 1
  const availableW = viewportSize.value.width - HUD_INSET.side * 2
  const availableH = viewportSize.value.height - HUD_INSET.top - HUD_INSET.bottom
  if (availableW <= 0 || availableH <= 0) return 1
  return Math.min(availableW / imageSize.value.width, availableH / imageSize.value.height, 1)
}

const updateFitView = () => {
  const fitScale = calculateFitScale()
  zoom.value = fitScale
  const drawnW = imageSize.value.width * fitScale
  const drawnH = imageSize.value.height * fitScale
  offset.value = {
    x: (viewportSize.value.width - drawnW) / 2,
    y: HUD_INSET.top + (viewportSize.value.height - HUD_INSET.top - HUD_INSET.bottom - drawnH) / 2
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
  // P2-14: 仅 Ctrl/Cmd + 滚轮时劫持滚动并缩放；
  // 普通滚动（浏览长图/页面滚动）不 preventDefault，不劫持。
  if (!e.ctrlKey && !e.metaKey) return
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
const imageBox = computed(() => ({
  left: offset.value.x,
  top: offset.value.y,
  width: imageSize.value.width * zoom.value,
  height: imageSize.value.height * zoom.value
}))

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
    class="w-full h-full flex flex-col bg-[var(--product)] text-[var(--on-product)] relative overflow-hidden select-none"
    @contextmenu.prevent
  >
    <!--沉浸式专业 HUD：顶栏 -->
    <div
      class="absolute top-0 left-0 right-0 h-20 bg-gradient-to-b from-black/80 to-transparent z-[100] flex items-center justify-between px-8 pointer-events-none"
    >
      <div class="flex items-center gap-4 pointer-events-auto">
        <div class="p-2.5 compare-hud-fill rounded-[var(--radius-ctrl)] text-[var(--accent)]">
          <Layout :size="20" stroke-width="2.5" />
        </div>
        <div class="flex flex-col">
          <h3 class="text-sm font-medium">
            {{ t('common.image.compare.title') }}
          </h3>
          <span class="text-[11px] font-medium compare-hud-muted mt-0.5">{{
            t('common.image.compare.subtitle')
          }}</span>
        </div>
      </div>

      <div class="flex items-center gap-6 pointer-events-auto">
        <div class="compare-hud flex items-center p-1">
          <button
            type="button"
            class="px-3.5 min-h-10 rounded-[var(--radius-ctrl)] text-xs font-medium transition-colors"
            :class="
              compareSide === 'before'
                ? 'bg-[var(--accent)] text-[var(--on-product)]'
                : 'compare-hud-muted hover:text-[var(--on-product)]'
            "
            @click="snapToSide('before')"
          >
            {{ t('common.image.card.before') }}
          </button>
          <div class="w-px h-3 compare-hud-rule"></div>
          <button
            type="button"
            class="px-3.5 min-h-10 rounded-[var(--radius-ctrl)] text-xs font-medium transition-colors"
            :class="
              compareSide === 'after'
                ? 'bg-[var(--accent)] text-[var(--on-product)]'
                : 'compare-hud-muted hover:text-[var(--on-product)]'
            "
            @click="snapToSide('after')"
          >
            {{ t('common.image.card.after') }}
          </button>
        </div>

        <button
          @click="emit('close')"
          class="compare-hud w-11 h-11 flex items-center justify-center compare-hud-muted hover:bg-[var(--danger)]/20 hover:border-[var(--danger)] hover:text-[var(--danger)] transition-colors"
          :aria-label="t('common.ui.close')"
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
        <h4 class="text-xl font-medium text-white">
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
        <p class="text-[11px] font-medium text-primary">
          {{ t('common.image.compare.decoding') }}
        </p>
        <span class="text-[11px] font-medium text-white/10">Preparing Hardware Acceleration</span>
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
        class="absolute inset-0 app-transparency-grid pointer-events-none opacity-40"
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
          </div>
        </div>
      </div>

      <div
        class="absolute top-0 bottom-24 w-[2px] bg-[var(--on-product)] z-50 pointer-events-none shadow-line transition-all duration-300 ease-[cubic-bezier(0.2,0,0,1)]"
        :class="{ '!duration-0': sliderActive }"
        :style="{ left: `${sliderPos}%` }"
      >
        <div
          class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 flex items-center justify-center pointer-events-auto cursor-ew-resize compare-slider-handle"
        >
          <div
            class="w-10 h-10 bg-[var(--on-product)] rounded-full shadow-[0_0_0_1px_rgba(0,0,0,0.1),0_2px_8px_rgba(0,0,0,0.25)] flex items-center justify-center"
          >
            <GripVertical :size="18" class="text-[var(--product)]" stroke-width="3" />
          </div>
        </div>
      </div>

      <div
        v-if="originalSize && compareSide !== 'after'"
        class="compare-hud absolute z-[60] pointer-events-none px-3 py-1.5 text-[11px] tabular-nums"
        :style="{
          left: `${imageBox.left + 16}px`,
          top: `${imageBox.top + imageBox.height - 44}px`
        }"
      >
        <span class="compare-hud-muted mr-2 font-medium">{{ t('common.image.card.before') }}</span
        >{{ originalSize }}
      </div>
      <div
        v-if="processedSize && compareSide !== 'before'"
        class="compare-hud absolute z-[60] pointer-events-none px-3 py-1.5 text-[11px] tabular-nums"
        :style="{
          left: `${imageBox.left + imageBox.width - 16}px`,
          top: `${imageBox.top + imageBox.height - 44}px`,
          transform: 'translateX(-100%)'
        }"
      >
        <span class="compare-hud-muted mr-2 font-medium">{{ t('common.image.card.after') }}</span
        >{{ processedSize }}
      </div>
    </div>

    <div
      class="compare-hud absolute bottom-6 left-1/2 -translate-x-1/2 flex items-center gap-1 p-1 z-[100]"
    >
      <button
        class="w-10 h-10 flex items-center justify-center rounded-[var(--radius-ctrl)] compare-hud-hover"
        :aria-label="t('common.image.compare.zoomOut')"
        @click="zoom = Math.max(0.05, zoom * 0.8)"
      >
        <ZoomOut :size="18" stroke-width="2.5" />
      </button>

      <div class="px-3 min-w-[64px] flex items-center justify-center compare-hud-divider">
        <span class="text-[11px] font-medium font-mono tabular-nums">
          {{ Math.round(zoom * 100) }}%
        </span>
      </div>

      <button
        class="w-10 h-10 flex items-center justify-center rounded-[var(--radius-ctrl)] compare-hud-hover"
        :aria-label="t('common.image.compare.zoomIn')"
        @click="zoom = Math.min(20, zoom * 1.2)"
      >
        <ZoomIn :size="18" stroke-width="2.5" />
      </button>

      <button
        class="flex items-center gap-2 px-3 md:px-4 h-10 rounded-[var(--radius-ctrl)] text-[var(--accent)] compare-hud-hover"
        :aria-label="t('common.image.compare.resetView')"
        @click="updateFitView"
      >
        <RotateCcw :size="14" stroke-width="3" />
        <span class="text-[11px] font-medium hidden md:inline">{{
          t('common.image.compare.resetView')
        }}</span>
      </button>
    </div>
  </div>
</template>

<style scoped>
.compare-hud {
  background: var(--product);
  color: var(--on-product);
  border: 1px solid color-mix(in srgb, var(--on-product) 15%, transparent);
  border-radius: var(--radius-ctrl);
}

.compare-hud-fill {
  background: color-mix(in srgb, var(--on-product) 10%, transparent);
}

.compare-hud-muted {
  color: color-mix(in srgb, var(--on-product) 70%, transparent);
}

.compare-hud-rule {
  background: color-mix(in srgb, var(--on-product) 15%, transparent);
}

.compare-hud-divider {
  border-left: 1px solid color-mix(in srgb, var(--on-product) 15%, transparent);
  border-right: 1px solid color-mix(in srgb, var(--on-product) 15%, transparent);
}

.compare-hud-hover:hover {
  background: color-mix(in srgb, var(--on-product) 10%, transparent);
}

.shadow-line {
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.1),
    0 0 15px rgba(0, 0, 0, 0.5);
}

.compare-slider-handle {
  touch-action: none;
}
</style>
