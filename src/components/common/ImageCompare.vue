<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { ChevronsLeftRight, Loader2, ZoomIn, ZoomOut, Maximize, Grip } from 'lucide-vue-next'

interface Props {
  originalUrl: string
  processedUrl: string
  originalSize: string
  processedSize: string
}

const props = defineProps<Props>()

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

const preloadImages = async () => {
  isDecoding.value = true
  isError.value = false
  try {
    const img1 = new Image()
    const img2 = new Image()
    img1.src = props.originalUrl
    img2.src = props.processedUrl

    await Promise.all([
      new Promise((resolve, reject) => {
        img1.onload = resolve
        img1.onerror = reject
      }),
      new Promise((resolve, reject) => {
        img2.onload = resolve
        img2.onerror = reject
      })
    ])

    await Promise.all([img1.decode(), img2.decode()])
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
})
</script>

<template>
  <div class="w-full h-full flex flex-col bg-slate-950 relative overflow-hidden">
    <!-- 异常状态 (Robustness) -->
    <div
      v-if="isError"
      class="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/90 backdrop-blur-sm px-6 text-center"
    >
      <div
        class="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center text-destructive mb-4 animate-in zoom-in duration-300"
      >
        <Maximize :size="32" />
      </div>
      <h3 class="text-base font-bold text-foreground mb-1">预览生成失败</h3>
      <p
        class="text-[0.7rem] text-muted-foreground uppercase tracking-[0.2em] font-black opacity-60"
      >
        请尝试重新处理该图片或检查网络连接
      </p>
    </div>

    <!-- 准备中状态 (Performance Feedback) -->
    <div
      v-if="isDecoding && !isError"
      class="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/60 backdrop-blur-md"
    >
      <Loader2 class="w-10 h-10 text-primary animate-spin" stroke-width="3" />
      <span
        class="mt-4 text-[0.75rem] font-black text-primary uppercase tracking-[0.3em] animate-pulse"
        >Decoding High-Res...</span
      >
    </div>

    <!-- 核心视图区域 -->
    <div class="flex-1 relative flex items-center justify-center p-2 md:p-8 cursor-move">
      <div
        class="w-full h-full max-w-7xl relative rounded-2xl overflow-hidden border border-white/5 bg-black shadow-2xl transition-opacity duration-500"
        :class="[
          isDecoding ? 'opacity-0' : 'opacity-100',
          isResizing || isPanning ? 'select-none' : ''
        ]"
        ref="container"
        @pointerdown.self="handlePointerDown($event, 'pan')"
      >
        <!-- 图片内容层 (Performance: will-change-transform) -->
        <div
          class="absolute inset-0 w-full h-full will-change-transform"
          :class="{ 'transition-transform duration-300 ease-out': !isPanning }"
          :style="{
            transform: `scale(${scale}) translate(${offset.x / scale}px, ${offset.y / scale}px)`
          }"
          @pointerdown.self="handlePointerDown($event, 'pan')"
        >
          <!-- 下层 (处理后) -->
          <img
            :src="processedUrl"
            class="absolute inset-0 w-full h-full object-contain pointer-events-none"
            style="transform: translateZ(0)"
            alt="After"
          />

          <!-- 上层 (处理前) -->
          <div
            class="absolute inset-0 w-full h-full overflow-hidden pointer-events-none z-20"
            :style="{
              clipPath: `inset(0 ${100 - sliderPos}% 0 0)`,
              willChange: 'clip-path'
            }"
          >
            <img
              :src="originalUrl"
              class="absolute inset-0 w-full h-full object-contain pointer-events-none"
              style="transform: translateZ(0)"
              alt="Before"
            />
          </div>

          <!-- 显性分割线 -->
          <div
            class="absolute inset-y-0 z-30 w-[1.5px] bg-primary shadow-[0_0_20px_rgba(var(--primary-rgb),0.8)] pointer-events-none"
            :style="{ left: `${sliderPos}%` }"
          ></div>
        </div>

        <!-- 滑块控制柄 (Adaptation: Larger touch target) -->
        <div
          class="absolute inset-y-0 z-40 w-16 -ml-8 cursor-col-resize flex items-center justify-center group active:scale-110 transition-transform touch-none"
          :style="{ left: `${sliderPos}%` }"
          @pointerdown.prevent="handlePointerDown($event, 'resize')"
        >
          <div
            class="w-12 h-12 bg-white text-black rounded-full shadow-2xl flex items-center justify-center ring-4 ring-black/40 group-hover:ring-primary/40 transition-all border border-black/10"
          >
            <ChevronsLeftRight
              :size="24"
              class="group-active:scale-125 transition-transform"
              stroke-width="2.5"
            />
          </div>
        </div>

        <!-- 悬浮标签 (Adaptation: Mobile Optimized Positions) -->
        <div
          class="absolute top-4 left-4 md:top-auto md:bottom-8 md:left-8 z-10 px-3 py-2 bg-black/60 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl flex flex-col pointer-events-none opacity-90 transition-all duration-300"
          :class="{ 'scale-75 origin-top-left md:scale-100': scale > 1.5 }"
        >
          <span
            class="text-[0.6rem] font-black text-white/60 uppercase tracking-widest leading-none mb-1"
            >Original</span
          >
          <span class="text-[0.75rem] font-black text-white tabular-nums">{{ originalSize }}</span>
        </div>

        <div
          class="absolute top-4 right-4 md:top-auto md:bottom-8 md:right-8 z-10 px-3 py-2 bg-primary/80 backdrop-blur-md text-white border border-white/10 rounded-xl shadow-2xl flex flex-col text-right pointer-events-none opacity-90 transition-all duration-300"
          :class="{ 'scale-75 origin-top-right md:scale-100': scale > 1.5 }"
        >
          <span
            class="text-[0.6rem] font-black text-white/60 uppercase tracking-widest leading-none mb-1"
            >Processed</span
          >
          <span class="text-[0.75rem] font-black text-white tabular-nums">{{ processedSize }}</span>
        </div>
      </div>
    </div>

    <!-- 底部缩放工具栏 (Adaptation: Scaled for mobile) -->
    <div
      class="absolute bottom-8 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-1 p-1.5 bg-background/80 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden scale-90 md:scale-100 transition-transform"
    >
      <button
        @click="zoom(-0.5)"
        class="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-muted text-foreground transition-all active:scale-90"
        title="缩小"
      >
        <ZoomOut :size="18" />
      </button>

      <div class="px-2 min-w-[50px] text-center">
        <span class="text-[0.75rem] font-black tabular-nums tracking-tighter"
          >{{ Math.round(scale * 100) }}%</span
        >
      </div>

      <button
        @click="zoom(0.5)"
        class="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-muted text-foreground transition-all active:scale-90"
        title="放大"
      >
        <ZoomIn :size="18" />
      </button>

      <div class="w-px h-4 bg-border/60 mx-1"></div>

      <button
        @click="reset"
        class="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-primary hover:text-white text-foreground transition-all active:scale-90"
        title="重置视图"
      >
        <Maximize :size="18" />
      </button>
    </div>

    <!-- 操作提示 (Experience) -->
    <div
      class="absolute top-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/20 backdrop-blur-md rounded-full pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity hidden md:block"
    >
      <span
        class="text-[0.6rem] text-white/60 font-medium uppercase tracking-widest flex items-center gap-2"
      >
        <Grip :size="12" /> 滚轮缩放 • 拖拽背景移动
      </span>
    </div>
  </div>
</template>
