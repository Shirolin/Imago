<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { Grip, ZoomIn, ZoomOut, RotateCcw, Layout, AlertCircle, Split } from 'lucide-vue-next'

const props = defineProps<{
  originalUrl: string | File
  processedUrl: string | File | Blob
  originalSize?: string
  processedSize?: string
  showTransparency?: boolean
}>()

const { t } = useI18n()

// 渲染用的临时预览 URL
const beforeUrl = ref<string>('')
const afterUrl = ref<string>('')
const isDecoding = ref(true)
const error = ref<string | null>(null)

// 缩放与平移状态
const zoom = ref(1)
const offset = ref({ x: 0, y: 0 })
const sliderPos = ref(50) // 0-100
const isDragging = ref(false)
const dragStart = ref({ x: 0, y: 0, offX: 0, dyOffY: 0 })

const viewportRef = ref<HTMLElement | null>(null)

// 检查图片加载状态的 Promise
const checkImage = (url: string) =>
  new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })

const initUrls = async () => {
  isDecoding.value = true
  error.value = null
  try {
    // 释放之前的 URL
    if (beforeUrl.value && beforeUrl.value.startsWith('blob:')) URL.revokeObjectURL(beforeUrl.value)
    if (afterUrl.value && afterUrl.value.startsWith('blob:')) URL.revokeObjectURL(afterUrl.value)

    beforeUrl.value =
      typeof props.originalUrl === 'string'
        ? props.originalUrl
        : URL.createObjectURL(props.originalUrl)
    afterUrl.value =
      typeof props.processedUrl === 'string'
        ? props.processedUrl
        : URL.createObjectURL(props.processedUrl)

    await Promise.all([checkImage(beforeUrl.value), checkImage(afterUrl.value)])
    isDecoding.value = false
    resetView()
  } catch {
    error.value = t('common.image.compare.errorDesc')
    isDecoding.value = false
  }
}

const resetView = () => {
  zoom.value = 1
  offset.value = { x: 0, y: 0 }
  sliderPos.value = 50
}

// 实时获取容器矩形以应对可能的窗口缩放或滚动
const getViewportRect = () => viewportRef.value?.getBoundingClientRect()

const handleWheel = (e: WheelEvent) => {
  if (isDecoding.value) return
  e.preventDefault()

  const rect = getViewportRect()
  if (!rect) return

  const mouseX = e.clientX - rect.left
  const mouseY = e.clientY - rect.top

  const delta = e.deltaY > 0 ? 0.9 : 1.1
  const newZoom = Math.max(0.1, Math.min(zoom.value * delta, 20))

  // 计算相对于鼠标位置的缩放偏移
  const zoomRatio = newZoom / zoom.value
  offset.value = {
    x: mouseX - (mouseX - offset.value.x) * zoomRatio,
    y: mouseY - (mouseY - offset.value.y) * zoomRatio
  }
  zoom.value = newZoom
}

const handlePointerDown = (e: PointerEvent) => {
  if (isDecoding.value) return
  isDragging.value = true
  dragStart.value = { x: e.clientX, y: e.clientY, offX: offset.value.x, dyOffY: offset.value.y }
  viewportRef.value?.setPointerCapture(e.pointerId)
}

const handlePointerMove = (e: PointerEvent) => {
  if (!isDragging.value) return
  const dx = e.clientX - dragStart.value.x
  const dy = e.clientY - dragStart.value.y
  offset.value = { x: dragStart.value.offX + dx, y: dragStart.value.dyOffY + dy }
}

const handlePointerUp = (e: PointerEvent) => {
  isDragging.value = false
  viewportRef.value?.releasePointerCapture(e.pointerId)
}

const handleSliderInput = (e: Event) => {
  sliderPos.value = parseInt((e.target as HTMLInputElement).value)
}

onMounted(initUrls)
onUnmounted(() => {
  if (beforeUrl.value.startsWith('blob:')) URL.revokeObjectURL(beforeUrl.value)
  if (afterUrl.value.startsWith('blob:')) URL.revokeObjectURL(afterUrl.value)
})

watch(() => [props.originalUrl, props.processedUrl], initUrls)
</script>

<template>
  <div
    class="w-full h-full flex flex-col bg-[#080808] relative overflow-hidden select-none"
    @contextmenu.prevent
  >
    <!-- UI 覆盖层：功能标题 (极致常显，z-index 最高) -->
    <div
      class="absolute top-6 left-6 z-50 flex items-center gap-3 animate-in fade-in slide-in-from-left-4 duration-700"
    >
      <div class="p-2 bg-primary/10 rounded-xl border border-primary/20 text-primary">
        <Layout :size="18" />
      </div>
      <h3 class="text-sm font-black text-white/90 uppercase tracking-[0.2em] shadow-black">
        {{ t('common.image.compare.title') }}
      </h3>
    </div>

    <!-- UI 覆盖层：左右标签 (极致常显，z-index 最高) -->
    <div
      class="absolute top-6 right-6 z-50 flex gap-2 animate-in fade-in slide-in-from-right-4 duration-700"
    >
      <div
        class="px-3 py-1.5 bg-black/40 backdrop-blur-md border border-white/10 rounded-lg text-[10px] font-black text-white/40 uppercase tracking-widest"
      >
        {{ t('common.image.card.before') }}
      </div>
      <div
        class="px-3 py-1.5 bg-primary/20 backdrop-blur-md border border-primary/30 rounded-lg text-[10px] font-black text-primary uppercase tracking-widest shadow-lg shadow-primary/10"
      >
        {{ t('common.image.card.after') }}
      </div>
    </div>

    <!-- 异常状态 -->
    <div
      v-if="error"
      class="flex-1 flex flex-col items-center justify-center p-12 text-center space-y-4"
    >
      <div class="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center">
        <AlertCircle :size="32" class="text-destructive" />
      </div>
      <div class="space-y-1">
        <h4 class="text-lg font-bold text-white">{{ t('common.image.compare.errorTitle') }}</h4>
        <p class="text-sm text-white/40 max-w-xs">{{ error }}</p>
      </div>
    </div>

    <!-- 加载中状态 -->
    <div
      v-else-if="isDecoding"
      class="flex-1 flex flex-col items-center justify-center p-12 space-y-6"
    >
      <div class="relative">
        <div
          class="w-16 h-16 border-4 border-primary/10 border-t-primary rounded-full animate-spin"
        ></div>
        <div class="absolute inset-0 flex items-center justify-center">
          <Split :size="20" class="text-primary/40" />
        </div>
      </div>
      <p class="text-[10px] font-black text-primary uppercase tracking-[0.3em] animate-pulse">
        {{ t('common.image.compare.decoding') }}
      </p>
    </div>

    <!-- 核心视图区域 -->
    <div
      v-else
      ref="viewportRef"
      class="flex-1 relative cursor-grab active:cursor-grabbing overflow-hidden"
      :class="{ 'compare-transparency-grid': showTransparency }"
      @wheel="handleWheel"
      @pointerdown="handlePointerDown"
      @pointermove="handlePointerMove"
      @pointerup="handlePointerUp"
      @pointerleave="handlePointerUp"
    >
      <!-- 物理缩放平移层 -->
      <div
        class="absolute will-change-transform"
        :style="{
          transform: `translate(${offset.x}px, ${offset.y}px) scale(${zoom})`,
          transformOrigin: '0 0'
        }"
      >
        <!-- 层级 1: 处理后图片 (底层) -->
        <div class="relative shadow-[0_0_100px_rgba(0,0,0,0.5)]">
          <img
            :src="afterUrl"
            class="block max-w-none pointer-events-none"
            style="image-rendering: pixelated"
          />

          <!-- 指标卡片 (后) -->
          <div
            class="absolute bottom-4 right-4 px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-lg border border-white/10 text-[10px] font-mono text-white/80 tabular-nums pointer-events-none z-30"
          >
            {{ processedSize || '--' }}
          </div>
        </div>

        <!-- 层级 2: 处理前图片 (顶层，带静态裁剪容器) -->
        <div
          class="absolute inset-0 overflow-hidden pointer-events-none"
          :style="{ width: `${sliderPos}%` }"
        >
          <div class="relative h-full">
            <img
              :src="beforeUrl"
              class="block max-w-none h-full pointer-events-none"
              style="image-rendering: pixelated"
            />

            <!-- 指标卡片 (前) -->
            <div
              class="absolute bottom-4 left-4 px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-lg border border-white/10 text-[10px] font-mono text-white/80 tabular-nums pointer-events-none z-30"
            >
              {{ originalSize || '--' }}
            </div>
          </div>
        </div>

        <!-- 分割线 -->
        <div
          class="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_15px_rgba(255,255,255,0.5)] pointer-events-none z-40"
          :style="{ left: `${sliderPos}%` }"
        >
          <!-- 滑块控制柄 -->
          <div
            class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full shadow-2xl flex items-center justify-center cursor-ew-resize pointer-events-auto"
          >
            <Grip :size="20" class="text-black rotate-90" />
            <input
              type="range"
              min="0"
              max="100"
              step="0.1"
              :value="sliderPos"
              class="absolute inset-0 opacity-0 cursor-ew-resize"
              :aria-label="t('common.image.compare.divider')"
              @input="handleSliderInput"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- 底部缩放工具栏 -->
    <div
      class="absolute bottom-10 left-1/2 -translate-x-1/2 flex items-center gap-1 p-1.5 bg-black/40 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl z-50 animate-in fade-in slide-in-from-bottom-4 duration-700"
    >
      <button
        class="p-2.5 rounded-xl hover:bg-white/10 text-white/60 hover:text-white transition-all active:scale-90"
        :title="t('common.image.compare.zoomOut')"
        @click="zoom = Math.max(0.1, zoom * 0.8)"
      >
        <ZoomOut :size="18" />
      </button>
      <div class="px-3 min-w-[60px] text-center">
        <span class="text-xs font-black font-mono text-white/90 tabular-nums"
          >{{ Math.round(zoom * 100) }}%</span
        >
      </div>
      <button
        class="p-2.5 rounded-xl hover:bg-white/10 text-white/60 hover:text-white transition-all active:scale-90"
        :title="t('common.image.compare.zoomIn')"
        @click="zoom = Math.min(20, zoom * 1.2)"
      >
        <ZoomIn :size="18" />
      </button>
      <div class="w-px h-4 bg-white/10 mx-1"></div>
      <button
        class="p-2.5 rounded-xl hover:bg-white/10 text-white/60 hover:text-white transition-all active:scale-90"
        :title="t('common.image.compare.reset')"
        @click="resetView"
      >
        <RotateCcw :size="18" />
      </button>
    </div>

    <!-- 操作提示 -->
    <div
      class="absolute bottom-10 left-8 hidden lg:flex items-center gap-2.5 text-[9px] font-black text-white/20 uppercase tracking-[0.2em] pointer-events-none z-50"
    >
      <div class="w-1.5 h-1.5 rounded-full bg-primary/40 animate-pulse"></div>
      {{ t('common.image.compare.tip') }}
    </div>
  </div>
</template>

<style scoped>
.compare-transparency-grid {
  background-image:
    linear-gradient(45deg, #121212 25%, transparent 25%),
    linear-gradient(-45deg, #121212 25%, transparent 25%),
    linear-gradient(45deg, transparent 75%, #121212 75%),
    linear-gradient(-45deg, transparent 75%, #121212 75%);
  background-size: 20px 20px;
  background-position:
    0 0,
    0 10px,
    10px -10px,
    -10px 0px;
  background-color: #080808;
}

input[type='range'] {
  -webkit-appearance: none;
  background: transparent;
}

input[type='range']::-webkit-slider-thumb {
  -webkit-appearance: none;
  height: 40px;
  width: 40px;
}
</style>
