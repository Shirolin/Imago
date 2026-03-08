<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { Zap, ChevronsLeftRight, Loader2, ZoomIn, ZoomOut, Maximize, Grip } from 'lucide-vue-next'

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

const preloadImages = async () => {
  isDecoding.value = true
  try {
    const img1 = new Image()
    const img2 = new Image()
    img1.src = props.originalUrl
    img2.src = props.processedUrl
    await Promise.all([img1.decode(), img2.decode()])
    isDecoding.value = false
  } catch (e) {
    isDecoding.value = false
  }
}

const handleMove = (e: MouseEvent | TouchEvent) => {
  const x = 'touches' in e ? e.touches[0].clientX : e.clientX
  const y = 'touches' in e ? e.touches[0].clientY : e.clientY

  if (isResizing.value && container.value) {
    const rect = container.value.getBoundingClientRect()
    sliderPos.value = Math.max(0, Math.min(100, ((x - rect.left) / rect.width) * 100))
  } else if (isPanning.value) {
    offset.value.x += x - lastMousePos.value.x
    offset.value.y += y - lastMousePos.value.y
  }

  lastMousePos.value = { x, y }
}

const handleMouseDown = (e: MouseEvent, type: 'resize' | 'pan') => {
  if (type === 'resize') {
    isResizing.value = true
  } else {
    isPanning.value = true
    lastMousePos.value = { x: e.clientX, y: e.clientY }
  }
}

const handleWheel = (e: WheelEvent) => {
  e.preventDefault()
  const delta = e.deltaY > 0 ? -0.1 : 0.1
  const newScale = Math.max(1, Math.min(5, scale.value + delta))
  scale.value = newScale
  if (scale.value === 1) offset.value = { x: 0, y: 0 }
}

const zoom = (delta: number) => {
  scale.value = Math.max(1, Math.min(5, scale.value + delta))
  if (scale.value === 1) offset.value = { x: 0, y: 0 }
}

const reset = () => {
  scale.value = 1
  offset.value = { x: 0, y: 0 }
  sliderPos.value = 50
}

onMounted(() => {
  preloadImages()
  window.addEventListener('mousemove', handleMove)
  window.addEventListener('mouseup', () => {
    isResizing.value = false
    isPanning.value = false
  })
  window.addEventListener('wheel', handleWheel, { passive: false })
})

onUnmounted(() => {
  window.removeEventListener('mousemove', handleMove)
  window.removeEventListener('wheel', handleWheel)
})
</script>

<template>
  <div class="w-full h-full flex flex-col bg-muted/10 relative overflow-hidden">
    <!-- 准备中状态 -->
    <div
      v-if="isDecoding"
      class="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/80"
    >
      <Loader2 class="w-8 h-8 text-primary animate-spin" />
      <span class="mt-3 text-[0.65rem] font-bold text-muted-foreground uppercase tracking-widest"
        >准备高清预览...</span
      >
    </div>

    <!-- 核心视图区域 -->
    <div class="flex-1 relative flex items-center justify-center p-0 md:p-4 cursor-crosshair">
      <div
        class="w-full h-full max-w-7xl relative rounded-xl overflow-hidden border border-border bg-black shadow-2xl transition-all duration-300"
        :class="[
          isDecoding ? 'invisible' : 'visible',
          isResizing || isPanning ? 'select-none' : ''
        ]"
        ref="container"
        @mousedown.self="handleMouseDown($event, 'pan')"
      >
        <!-- 图片内容层 (带缩放和平移) -->
        <div
          class="absolute inset-0 w-full h-full transition-transform duration-200 ease-out"
          :style="{
            transform: `scale(${scale}) translate(${offset.x / scale}px, ${offset.y / scale}px)`
          }"
          @mousedown.self="handleMouseDown($event, 'pan')"
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
            class="absolute inset-y-0 z-30 w-[2px] bg-primary shadow-[0_0_15px_rgba(var(--primary-rgb),0.5)] pointer-events-none"
            :style="{ left: `${sliderPos}%` }"
          ></div>
        </div>

        <!-- 滑块控制柄 (不随图片缩放) -->
        <div
          class="absolute inset-y-0 z-40 w-12 -ml-6 cursor-col-resize flex items-center justify-center group active:scale-110 transition-transform"
          :style="{ left: `${sliderPos}%` }"
          @mousedown.prevent="handleMouseDown($event, 'resize')"
          @touchstart.prevent="handleMouseDown($event, 'resize')"
        >
          <div
            class="w-10 h-10 bg-primary text-primary-foreground rounded-full shadow-2xl flex items-center justify-center ring-4 ring-background/20 group-hover:ring-primary/20 transition-all"
          >
            <ChevronsLeftRight :size="20" class="group-active:scale-125 transition-transform" />
          </div>
        </div>

        <!-- 悬浮标签 -->
        <div
          class="absolute bottom-6 left-6 z-10 px-3 py-1.5 bg-background/80 backdrop-blur-md border border-white/10 rounded-xl shadow-2xl flex flex-col pointer-events-none transform -translate-y-2 opacity-90"
        >
          <span class="text-[0.6rem] font-black text-primary uppercase tracking-tighter"
            >Original</span
          >
          <span class="text-[0.8rem] font-black tabular-nums">{{ originalSize }}</span>
        </div>

        <div
          class="absolute bottom-6 right-6 z-10 px-3 py-1.5 bg-primary/90 backdrop-blur-md text-white border border-white/10 rounded-xl shadow-2xl flex flex-col text-right pointer-events-none transform -translate-y-2 opacity-90"
        >
          <span class="text-[0.6rem] font-black opacity-80 uppercase tracking-tighter"
            >Processed</span
          >
          <span class="text-[0.8rem] font-black tabular-nums">{{ processedSize }}</span>
        </div>
      </div>
    </div>

    <!-- 底部缩放工具栏 -->
    <div
      class="absolute bottom-10 left-1/2 -translate-x-1/2 z-[60] flex items-center gap-1 p-1.5 bg-background/60 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
    >
      <button
        @click="zoom(-0.5)"
        class="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/10 text-foreground transition-all active:scale-90"
        title="缩小"
      >
        <ZoomOut :size="18" />
      </button>

      <div class="px-2 min-w-[60px] text-center">
        <span class="text-[0.7rem] font-black tabular-nums">{{ Math.round(scale * 100) }}%</span>
      </div>

      <button
        @click="zoom(0.5)"
        class="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-white/10 text-foreground transition-all active:scale-90"
        title="放大"
      >
        <ZoomIn :size="18" />
      </button>

      <div class="w-px h-4 bg-white/10 mx-1"></div>

      <button
        @click="reset"
        class="w-10 h-10 flex items-center justify-center rounded-xl hover:bg-primary hover:text-white text-foreground transition-all active:scale-90"
        title="重置视图"
      >
        <Maximize :size="18" />
      </button>
    </div>

    <!-- 操作提示 -->
    <div
      class="absolute top-6 left-1/2 -translate-x-1/2 px-4 py-2 bg-black/20 backdrop-blur-md rounded-full pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
    >
      <span
        class="text-[0.6rem] text-white/60 font-medium uppercase tracking-widest flex items-center gap-2"
      >
        <Grip :size="12" /> 滚轮缩放 • 拖拽背景移动
      </span>
    </div>
  </div>
</template>
