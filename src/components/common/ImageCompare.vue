<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { ChevronsLeftRight, Loader2, ZoomIn, ZoomOut, Maximize, Grip } from 'lucide-vue-next'

interface Props {
  originalUrl: string | Blob
  processedUrl: string | Blob
  originalSize: string
  processedSize: string
}

const props = defineProps<Props>()

// 渲染用的临时预览 URL (Fix: Type compatibility for <img>)
const originalViewUrl = ref<string>('')
const processedViewUrl = ref<string>('')

// 带有容量限制和显式内存释放的全局位图缓存 (Optimize: Memory/VRAM Safety)
const MAX_CACHE_SIZE = 10
const bitmapCache = new Map<string | Blob, ImageBitmap>()
const cacheOrder: (string | Blob)[] = []

const addToCache = (key: string | Blob, bitmap: ImageBitmap) => {
  if (bitmapCache.has(key)) return

  if (cacheOrder.length >= MAX_CACHE_SIZE) {
    const oldestKey = cacheOrder.shift()
    if (oldestKey) {
      const oldestBitmap = bitmapCache.get(oldestKey)
      oldestBitmap?.close() // 显式释放显存 (Critical)
      bitmapCache.delete(oldestKey)
    }
  }

  bitmapCache.set(key, bitmap)
  cacheOrder.push(key)
}

const sliderPos = ref(50)
const isResizing = ref(false)
const isPanning = ref(false)
const container = ref<HTMLElement | null>(null)
const isDecoding = ref(true)

// 缩放与平移状态
const scale = ref(1)
const offset = ref({ x: 0, y: 0 })
const lastMousePos = ref({ x: 0, y: 0 })
const isError = ref(false)

// 辅助函数：将输入转换为 ImageBitmap (Harden: Robust data source)
const convertToBitmap = async (input: string | Blob): Promise<ImageBitmap> => {
  if (input instanceof Blob) {
    return createImageBitmap(input)
  }
  // 仅对非 Blob 字符串使用 fetch (通常是远端图片)
  const response = await fetch(input)
  const blob = await response.blob()
  return createImageBitmap(blob)
}

const preloadImages = async () => {
  isDecoding.value = true
  isError.value = false
  try {
    // 准备渲染 URL
    originalViewUrl.value =
      props.originalUrl instanceof Blob ? URL.createObjectURL(props.originalUrl) : props.originalUrl
    processedViewUrl.value =
      props.processedUrl instanceof Blob
        ? URL.createObjectURL(props.processedUrl)
        : props.processedUrl

    // 检查缓存
    if (bitmapCache.has(props.originalUrl) && bitmapCache.has(props.processedUrl)) {
      isDecoding.value = false
      return
    }

    const [img1, img2] = await Promise.all([
      convertToBitmap(props.originalUrl),
      convertToBitmap(props.processedUrl)
    ])

    addToCache(props.originalUrl, img1)
    addToCache(props.processedUrl, img2)

    isDecoding.value = false
  } catch (err) {
    console.error('Failed to load images for comparison', err)
    isDecoding.value = false
    isError.value = true
  }
}

const handlePointerMove = (e: PointerEvent) => {
  if (isResizing.value && container.value) {
    const rect = container.value.getBoundingClientRect()
    sliderPos.value = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))
  } else if (isPanning.value) {
    const dx = e.clientX - lastMousePos.value.x
    const dy = e.clientY - lastMousePos.value.y

    // 平移逻辑，允许根据缩放比例进行偏移
    offset.value.x += dx
    offset.value.y += dy
  }

  lastMousePos.value = { x: e.clientX, y: e.clientY }
}

const handlePointerDown = (e: PointerEvent, type: 'resize' | 'pan') => {
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

  // 抬起时如果缩放为 1，重置偏移
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

  // 释放临时渲染 URL
  if (props.originalUrl instanceof Blob) URL.revokeObjectURL(originalViewUrl.value)
  if (props.processedUrl instanceof Blob) URL.revokeObjectURL(processedViewUrl.value)
})
</script>

<template>
  <div class="w-full h-full flex flex-col bg-muted/20 relative overflow-hidden">
    <!-- 异常状态 (Robustness) -->
    <div
      v-if="isError"
      class="absolute inset-0 z-[100] flex flex-col items-center justify-center bg-background/95 backdrop-blur-md px-6 text-center animate-in fade-in duration-500"
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
        无法获取高分辨率图像，请尝试重新处理或检查连接。
      </p>
    </div>

    <!-- 准备中状态 (Performance Feedback) -->
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
        class="w-full h-full max-w-7xl relative rounded-3xl overflow-hidden border border-border/50 bg-black shadow-elevated transition-all duration-700"
        :class="[
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
            />
          </div>
        </div>

        <!-- 层级 3: UI 覆盖层 (相对于容器固定，不随缩放变化) -->

        <!-- 分割线 -->
        <div
          class="absolute inset-y-0 z-30 w-[2px] bg-primary shadow-[0_0_20px_rgba(var(--primary-rgb),0.6)] pointer-events-none transition-opacity duration-300"
          :class="isDecoding ? 'opacity-0' : 'opacity-100'"
          :style="{ left: `${sliderPos}%` }"
        ></div>

        <!-- 滑块控制柄 -->
        <div
          class="absolute inset-y-0 z-40 w-20 -ml-10 cursor-col-resize flex items-center justify-center group/handle active:scale-110 transition-transform touch-none"
          :style="{ left: `${sliderPos}%` }"
          @pointerdown.prevent="handlePointerDown($event, 'resize')"
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

        <!-- 悬浮标签 -->
        <div
          class="absolute top-4 left-4 md:top-auto md:bottom-8 md:left-8 z-10 px-4 py-2 bg-background/80 backdrop-blur-lg border border-border/50 rounded-2xl shadow-soft flex flex-col pointer-events-none transition-all duration-300"
          :class="{ 'opacity-0 translate-y-2': scale > 2 }"
        >
          <span
            class="text-[0.6rem] font-black text-muted-foreground/40 uppercase tracking-[0.2em] leading-none mb-1.5"
            >Original</span
          >
          <span class="text-[0.85rem] font-black text-foreground tabular-nums leading-none">{{
            originalSize
          }}</span>
        </div>

        <div
          class="absolute top-4 right-4 md:top-auto md:bottom-8 md:right-8 z-10 px-4 py-2 bg-primary/10 backdrop-blur-lg border border-primary/20 rounded-2xl shadow-soft flex flex-col text-right pointer-events-none transition-all duration-300"
          :class="{ 'opacity-0 translate-y-2': scale > 2 }"
        >
          <span
            class="text-[0.6rem] font-black text-primary/60 uppercase tracking-[0.2em] leading-none mb-1.5"
            >Processed</span
          >
          <span class="text-[0.85rem] font-black text-primary tabular-nums leading-none">{{
            processedSize
          }}</span>
        </div>
      </div>
    </div>

    <!-- 底部缩放工具栏 -->
    <div
      class="absolute bottom-10 left-1/2 -translate-x-1/2 z-[150] flex items-center gap-1.5 p-2 bg-background/80 backdrop-blur-2xl border border-border/60 rounded-3xl shadow-elevated scale-90 md:scale-100 transition-all hover:scale-105"
    >
      <button
        @click="zoom(-0.5)"
        class="w-10 h-10 flex items-center justify-center rounded-2xl hover:bg-muted text-muted-foreground hover:text-primary transition-all active:scale-90"
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
        class="w-10 h-10 flex items-center justify-center rounded-2xl hover:bg-muted text-muted-foreground hover:text-primary transition-all active:scale-90"
        title="放大"
      >
        <ZoomIn :size="18" />
      </button>

      <div class="w-[1.5px] h-4 bg-border/20 mx-1"></div>

      <button
        @click="reset"
        class="w-10 h-10 flex items-center justify-center rounded-2xl hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all active:scale-90"
        title="重置视图"
      >
        <Maximize :size="18" />
      </button>
    </div>

    <!-- 操作提示 -->
    <div
      class="absolute top-8 left-1/2 -translate-x-1/2 px-5 py-2.5 bg-background/40 backdrop-blur-xl border border-border/20 rounded-full pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity duration-500 hidden md:block"
    >
      <span
        class="text-[0.65rem] text-muted-foreground/80 font-black uppercase tracking-[0.2em] flex items-center gap-3"
      >
        <Grip :size="14" class="text-primary/60" /> 滚轮缩放 • 拖拽背景平移
      </span>
    </div>
  </div>
</template>
