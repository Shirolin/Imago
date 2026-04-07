<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import {
  ChevronsLeftRight,
  Loader2,
  ZoomIn,
  ZoomOut,
  Maximize,
  Grip,
  RotateCcw
} from 'lucide-vue-next'

interface Props {
  originalUrl: string | Blob
  processedUrl: string | Blob
  originalSize: string
  processedSize: string
  showTransparency?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showTransparency: false
})

// 渲染用的临时预览 URL
const originalViewUrl = ref<string>('')
const processedViewUrl = ref<string>('')

const sliderPos = ref(50)
const isResizing = ref(false)
const isPanning = ref(false)
const container = ref<HTMLElement | null>(null)
const isDecoding = ref(true)
const originalLoaded = ref(false)
const processedLoaded = ref(false)

// 缩放与平移状态
const scale = ref(1)
const offset = ref({ x: 0, y: 0 })
const lastMousePos = ref({ x: 0, y: 0 })
const isError = ref(false)

const preloadImages = async () => {
  isDecoding.value = true
  isError.value = false
  originalLoaded.value = false
  processedLoaded.value = false

  try {
    originalViewUrl.value =
      props.originalUrl instanceof Blob ? URL.createObjectURL(props.originalUrl) : props.originalUrl
    processedViewUrl.value =
      props.processedUrl instanceof Blob
        ? URL.createObjectURL(props.processedUrl)
        : props.processedUrl

    // 检查图片加载状态的 Promise
    const checkLoaded = () => {
      if (originalLoaded.value && processedLoaded.value) {
        isDecoding.value = false
      }
    }

    // 暴露给模板使用
    return { checkLoaded }
  } catch (err) {
    console.error('Failed to load images for comparison', err)
    isDecoding.value = false
    isError.value = true
  }
}

const handleImageLoad = (type: 'original' | 'processed') => {
  if (type === 'original') originalLoaded.value = true
  else processedLoaded.value = true

  if (originalLoaded.value && processedLoaded.value) {
    isDecoding.value = false
  }
}

const containerRect = ref<DOMRect | null>(null)

const handlePointerMove = (e: PointerEvent) => {
  if (isResizing.value && container.value) {
    // 实时获取容器矩形以应对可能的窗口缩放或滚动
    const rect = container.value.getBoundingClientRect()
    const x = Math.max(0, Math.min(rect.width, e.clientX - rect.left))
    sliderPos.value = (x / rect.width) * 100
  } else if (isPanning.value) {
    const dx = e.clientX - lastMousePos.value.x
    const dy = e.clientY - lastMousePos.value.y
    offset.value.x += dx
    offset.value.y += dy
  }
  lastMousePos.value = { x: e.clientX, y: e.clientY }
}

const handlePointerDown = (e: PointerEvent, type: 'resize' | 'pan') => {
  if (container.value) {
    containerRect.value = container.value.getBoundingClientRect()
  }

  if (type === 'resize') {
    isResizing.value = true
    ;(e.currentTarget as HTMLElement)?.setPointerCapture(e.pointerId)
  } else {
    isPanning.value = true
    lastMousePos.value = { x: e.clientX, y: e.clientY }
  }
}

const handlePointerUp = () => {
  isResizing.value = false
  isPanning.value = false
  containerRect.value = null
  if (scale.value === 1) {
    offset.value = { x: 0, y: 0 }
  }
}

const handleWheel = (e: WheelEvent) => {
  if (!e.ctrlKey && Math.abs(e.deltaY) < 5) return
  e.preventDefault()
  const delta = e.deltaY > 0 ? -0.2 : 0.2
  const newScale = Math.max(1, Math.min(8, scale.value + delta))
  scale.value = newScale
  if (scale.value === 1) offset.value = { x: 0, y: 0 }
}

const zoom = (delta: number) => {
  scale.value = Math.max(1, Math.min(8, scale.value + delta))
  if (scale.value === 1) offset.value = { x: 0, y: 0 }
}

const reset = () => {
  scale.value = 1
  offset.value = { x: 0, y: 0 }
  sliderPos.value = 50
}

const handleKeyDown = (e: KeyboardEvent) => {
  if (['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(e.key)) {
    e.preventDefault()
    const step = e.shiftKey ? 10 : 1
    if (e.key === 'ArrowLeft') sliderPos.value = Math.max(0, sliderPos.value - step)
    if (e.key === 'ArrowRight') sliderPos.value = Math.min(100, sliderPos.value + step)
    if (e.key === 'Home') sliderPos.value = 0
    if (e.key === 'End') sliderPos.value = 100
  }
}

onMounted(() => {
  preloadImages()
  window.addEventListener('pointermove', handlePointerMove)
  window.addEventListener('pointerup', handlePointerUp)
  window.addEventListener('wheel', handleWheel, { passive: false })
})

onUnmounted(() => {
  window.removeEventListener('pointermove', handlePointerMove)
  window.removeEventListener('pointerup', handlePointerUp)
  window.removeEventListener('wheel', handleWheel)
  if (props.originalUrl instanceof Blob) URL.revokeObjectURL(originalViewUrl.value)
  if (props.processedUrl instanceof Blob) URL.revokeObjectURL(processedViewUrl.value)
})
</script>

<template>
  <div class="w-full h-full flex flex-col bg-muted/20 relative overflow-hidden">
    <!-- UI 覆盖层：功能标题 (极致常显，z-index 最高) -->
    <div
      class="absolute top-6 left-1/2 -translate-x-1/2 z-[120] px-6 py-2 bg-foreground/10 backdrop-blur-md border border-foreground/10 rounded-full pointer-events-none shadow-xl transition-all duration-700"
      :class="isDecoding ? 'opacity-0 -translate-y-4' : 'opacity-100 translate-y-0'"
    >
      <span class="text-[0.7rem] font-black text-foreground uppercase tracking-[0.3em]"
        >细节预览对比</span
      >
    </div>

    <!-- UI 覆盖层：左右标签 (极致常显，z-index 最高) -->
    <div
      class="absolute top-6 left-6 md:top-10 md:left-10 z-[120] px-4 py-2 bg-background/95 backdrop-blur-xl border border-border shadow-2xl rounded-2xl flex flex-col pointer-events-none transition-all duration-500"
      :class="isDecoding ? 'opacity-0 -translate-x-4' : 'opacity-100 translate-x-0'"
    >
      <span
        class="text-[0.6rem] font-black text-muted-foreground uppercase tracking-[0.2em] leading-none mb-1.5"
        >Original</span
      >
      <span class="text-[0.85rem] font-black text-foreground tabular-nums leading-none">{{
        originalSize
      }}</span>
    </div>

    <div
      class="absolute top-6 right-6 md:top-10 md:right-10 z-[120] px-4 py-2 bg-primary/20 backdrop-blur-xl border border-primary/30 shadow-2xl rounded-2xl flex flex-col text-right pointer-events-none transition-all duration-500"
      :class="isDecoding ? 'opacity-0 translate-x-4' : 'opacity-100 translate-x-0'"
    >
      <span
        class="text-[0.6rem] font-black text-primary uppercase tracking-[0.2em] leading-none mb-1.5"
        >Processed</span
      >
      <span class="text-[0.85rem] font-black text-primary tabular-nums leading-none">{{
        processedSize
      }}</span>
    </div>

    <!-- 异常状态 -->
    <div
      v-if="isError"
      class="absolute inset-0 z-[130] flex flex-col items-center justify-center bg-background/95 backdrop-blur-md px-6 text-center animate-in fade-in duration-500"
    >
      <div
        class="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center text-destructive mb-6 shadow-soft"
      >
        <Maximize :size="40" />
      </div>
      <h3 class="text-lg font-black text-foreground mb-2">预览生成失败</h3>
      <p
        class="text-[0.7rem] text-muted-foreground uppercase tracking-[0.25em] font-black opacity-60 max-w-xs leading-relaxed"
      >
        无法获取高分辨率图片，请尝试重新处理或检查连接。
      </p>
    </div>

    <!-- 加载中状态 -->
    <div
      v-if="isDecoding && !isError"
      class="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-background/80 backdrop-blur-xl"
    >
      <div class="relative">
        <Loader2 class="w-12 h-12 text-primary animate-spin" stroke-width="2.5" />
        <div class="absolute inset-0 blur-xl bg-primary/20 animate-pulse -z-10"></div>
      </div>
      <span
        class="mt-6 text-[0.7rem] font-black text-primary uppercase tracking-[0.4em] animate-pulse"
        >Decoding Resolution...</span
      >
    </div>

    <!-- 核心视图区域 -->
    <div class="flex-1 relative flex items-center justify-center p-4 md:p-12 cursor-move group">
      <div
        class="w-full h-full max-w-7xl relative rounded-3xl overflow-hidden border border-border/50 bg-background shadow-elevated transition-all duration-700"
        :class="[
          { 'transparency-grid': showTransparency },
          isDecoding ? 'opacity-0 scale-95' : 'opacity-100 scale-100',
          isResizing || isPanning ? 'select-none ring-2 ring-primary/20' : ''
        ]"
        ref="container"
        @pointerdown.self="handlePointerDown($event, 'pan')"
      >
        <!-- 层级 1: 处理后图片 (底层) -->
        <div
          class="absolute inset-0 w-full h-full will-change-transform"
          :class="{ 'transition-transform duration-500 cubic-bezier(0.2, 0, 0, 1)': !isPanning }"
          :style="{
            transform: `scale(${scale}) translate(${offset.x / scale}px, ${offset.y / scale}px)`
          }"
          @pointerdown.self="handlePointerDown($event, 'pan')"
        >
          <img
            :src="processedViewUrl"
            class="absolute inset-0 w-full h-full object-contain pointer-events-none"
            style="transform: translateZ(0)"
            alt="After"
            @load="handleImageLoad('processed')"
            @error="isError = true"
          />
        </div>

        <!-- 层级 2: 处理前图片 (顶层，带静态裁剪容器) -->
        <div
          class="absolute inset-0 w-full h-full pointer-events-none z-20 overflow-hidden"
          :style="{
            clipPath: `inset(0 ${100 - sliderPos}% 0 0)`,
            willChange: 'clip-path'
          }"
        >
          <div
            class="absolute inset-0 w-full h-full will-change-transform"
            :class="{ 'transition-transform duration-500 cubic-bezier(0.2, 0, 0, 1)': !isPanning }"
            :style="{
              transform: `scale(${scale}) translate(${offset.x / scale}px, ${offset.y / scale}px)`
            }"
          >
            <img
              :src="originalViewUrl"
              class="absolute inset-0 w-full h-full object-contain pointer-events-none"
              style="transform: translateZ(0)"
              alt="Before"
              @load="handleImageLoad('original')"
              @error="isError = true"
            />
          </div>
        </div>

        <!-- 分割线 -->
        <div
          class="absolute inset-y-0 z-30 w-[2px] bg-primary shadow-[0_0_20px_rgba(var(--primary-rgb),0.6)] pointer-events-none transition-opacity duration-300"
          :class="isDecoding ? 'opacity-0' : 'opacity-100'"
          :style="{ left: `${sliderPos}%` }"
        ></div>

        <!-- 滑块控制柄 -->
        <div
          class="absolute inset-y-0 z-40 w-20 -ml-10 cursor-col-resize flex items-center justify-center group/handle active:scale-110 transition-transform touch-none outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-full"
          :style="{ left: `${sliderPos}%` }"
          role="slider"
          :aria-valuenow="sliderPos"
          aria-valuemin="0"
          aria-valuemax="100"
          aria-label="对比分割线"
          tabindex="0"
          @pointerdown.prevent="handlePointerDown($event, 'resize')"
          @keydown="handleKeyDown"
        >
          <div
            class="w-12 h-12 bg-background border-2 border-primary/40 rounded-full shadow-elevated flex items-center justify-center transition-all group-hover/handle:border-primary group-hover/handle:scale-110 group-hover/handle:shadow-primary/20 group-active/handle:bg-primary group-active/handle:text-primary-foreground group-active/handle:border-primary"
          >
            <ChevronsLeftRight
              :size="20"
              class="text-muted-foreground group-hover/handle:text-primary group-active/handle:text-primary-foreground transition-colors"
              stroke-width="3"
            />
          </div>
        </div>
      </div>
    </div>

    <!-- 底部缩放工具栏 -->
    <div
      class="absolute bottom-10 left-1/2 -translate-x-1/2 z-[150] flex items-center gap-2 p-2 bg-background/80 backdrop-blur-2xl border border-border/60 rounded-[1.5rem] shadow-elevated scale-90 md:scale-100 transition-all hover:scale-105"
    >
      <button
        @click="zoom(-0.5)"
        class="w-11 h-11 flex items-center justify-center rounded-2xl hover:bg-muted text-muted-foreground hover:text-primary transition-all active:scale-90"
        title="缩小"
      >
        <ZoomOut :size="18" />
      </button>

      <div class="px-3 min-w-[60px] text-center border-x border-border/30">
        <span class="text-[0.8rem] font-black tabular-nums tracking-tighter text-foreground"
          >{{ Math.round(scale * 100) }}%</span
        >
      </div>

      <button
        @click="zoom(0.5)"
        class="w-11 h-11 flex items-center justify-center rounded-2xl hover:bg-muted text-muted-foreground hover:text-primary transition-all active:scale-90"
        title="放大"
      >
        <ZoomIn :size="18" />
      </button>

      <div class="w-[1.5px] h-4 bg-border/20 mx-1"></div>

      <button
        @click="reset"
        class="w-11 h-11 flex items-center justify-center rounded-2xl hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all active:scale-90"
        title="重置全部视图"
      >
        <RotateCcw :size="18" />
      </button>
    </div>

    <!-- 操作提示 -->
    <div
      class="absolute top-20 left-1/2 -translate-x-1/2 px-5 py-2.5 bg-background/40 backdrop-blur-xl border border-border/20 rounded-full pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500 hidden md:block"
    >
      <span
        class="text-[0.65rem] text-muted-foreground/80 font-black uppercase tracking-[0.2em] flex items-center gap-3"
      >
        <Grip :size="14" class="text-primary/60" /> 滚轮缩放 • 拖拽背景平移
      </span>
    </div>
  </div>
</template>
