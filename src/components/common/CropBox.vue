<script setup lang="ts">
import { ref, onUnmounted, watch, computed } from 'vue'

interface Props {
  aspectRatio?: number // null for free
  imageUrl: string
}

const props = defineProps<Props>()
const emit = defineEmits(['change'])

const containerRef = ref<HTMLDivElement | null>(null)
const imgRef = ref<HTMLImageElement | null>(null)

// 裁剪区域 (百分比 0-100)
const crop = ref({
  x: 10,
  y: 10,
  w: 80,
  h: 80
})

// 计算当前像素尺寸
const pixelSize = computed(() => {
  const nw = imgRef.value?.naturalWidth || 0
  const nh = imgRef.value?.naturalHeight || 0
  if (!nw) return { w: 0, h: 0 }
  return {
    w: Math.round((crop.value.w / 100) * nw),
    h: Math.round((crop.value.h / 100) * nh)
  }
})

const isDragging = ref(false)
const dragMode = ref<'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'w' | 'e' | null>(null)
let startX = 0
let startY = 0
let startCrop = { x: 0, y: 0, w: 0, h: 0 }

const updateCrop = (newCrop: typeof crop.value) => {
  // 加固：限制最小裁剪面积 (5%)
  newCrop.w = Math.max(5, Math.min(newCrop.w, 100 - newCrop.x))
  newCrop.h = Math.max(5, Math.min(newCrop.h, 100 - newCrop.y))
  newCrop.x = Math.max(0, Math.min(newCrop.x, 100 - newCrop.w))
  newCrop.y = Math.max(0, Math.min(newCrop.y, 100 - newCrop.h))

  crop.value = { ...newCrop }
  emitChange()
}

const emitChange = () => {
  if (!imgRef.value || !imgRef.value.naturalWidth) return
  // 发送归一化百分比坐标
  emit('change', {
    x: crop.value.x,
    y: crop.value.y,
    width: crop.value.w,
    height: crop.value.h,
    usePercentage: true
  })
}

const getCoordinates = (e: MouseEvent | TouchEvent) => {
  if ('touches' in e && e.touches.length > 0) {
    return { x: e.touches[0]?.clientX ?? 0, y: e.touches[0]?.clientY ?? 0 }
  } else if ('clientX' in e) {
    return { x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY }
  }
  return { x: 0, y: 0 }
}

const handleStart = (e: MouseEvent | TouchEvent, mode: typeof dragMode.value) => {
  if (e.cancelable) e.preventDefault()
  isDragging.value = true
  dragMode.value = mode

  const { x, y } = getCoordinates(e)
  startX = x
  startY = y
  startCrop = { ...crop.value }

  if ('touches' in e) {
    window.addEventListener('touchmove', handleMove, { passive: false })
    window.addEventListener('touchend', handleEnd)
  } else {
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleEnd)
  }
}

const handleMove = (e: MouseEvent | TouchEvent) => {
  if (!isDragging.value || !containerRef.value) return
  if (e.cancelable) e.preventDefault()

  const rect = containerRef.value.getBoundingClientRect()
  const { x, y } = getCoordinates(e)
  const dx = ((x - startX) / rect.width) * 100
  const dy = ((y - startY) / rect.height) * 100

  const next = { ...startCrop }

  if (dragMode.value === 'move') {
    next.x += dx
    next.y += dy
  } else {
    if (dragMode.value?.includes('n')) {
      const delta = Math.min(dy, startCrop.h - 5)
      next.y += delta
      next.h -= delta
    }
    if (dragMode.value?.includes('s')) {
      next.h = Math.max(5, startCrop.h + dy)
    }
    if (dragMode.value?.includes('w')) {
      const delta = Math.min(dx, startCrop.w - 5)
      next.x += delta
      next.w -= delta
    }
    if (dragMode.value?.includes('e')) {
      next.w = Math.max(5, startCrop.w + dx)
    }
  }

  updateCrop(next)
}

const handleEnd = () => {
  isDragging.value = false
  dragMode.value = null

  window.removeEventListener('mousemove', handleMove)
  window.removeEventListener('mouseup', handleEnd)
  window.removeEventListener('touchmove', handleMove)
  window.removeEventListener('touchend', handleEnd)
}

// 监听比例变化
watch(
  () => props.aspectRatio,
  (newRatio) => {
    if (newRatio) {
      const next = { ...crop.value }
      next.h = next.w / newRatio
      if (next.y + next.h > 100) {
        next.h = 100 - next.y
        next.w = next.h * newRatio
      }
      updateCrop(next)
    }
  }
)

onUnmounted(() => {
  handleEnd()
})
</script>

<template>
  <div
    ref="containerRef"
    class="relative w-full h-full flex items-center justify-center select-none touch-none group"
  >
    <img
      ref="imgRef"
      :src="imageUrl"
      alt="Crop source"
      class="max-w-full max-h-full w-auto h-auto block pointer-events-none shadow-2xl rounded-sm"
      @load="emitChange"
    />

    <!-- 遮罩层 -->
    <div class="absolute inset-0 bg-black/50 pointer-events-none"></div>

    <!-- 裁剪框 -->
    <div
      class="absolute border-2 border-primary shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] cursor-move"
      :style="{
        left: crop.x + '%',
        top: crop.y + '%',
        width: crop.w + '%',
        height: crop.h + '%',
        willChange: 'left, top, width, height'
      }"
      role="region"
      aria-label="裁剪区域选择器"
      @mousedown="handleStart($event, 'move')"
      @touchstart="handleStart($event, 'move')"
    >
      <!-- 九宫格线 -->
      <div class="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-40">
        <div v-for="i in 9" :key="i" class="border-[0.5px] border-white/50"></div>
      </div>

      <!-- 中心十字辅助线 -->
      <div
        class="absolute inset-0 pointer-events-none opacity-20 group-active:opacity-40 transition-opacity"
      >
        <div class="absolute top-1/2 left-0 right-0 h-[0.5px] bg-white"></div>
        <div class="absolute left-1/2 top-0 bottom-0 w-[0.5px] bg-white"></div>
      </div>

      <!-- 尺寸标签 -->
      <div
        class="absolute bottom-2 right-2 px-1.5 py-0.5 bg-black/60 backdrop-blur-md rounded text-[10px] text-white font-mono font-bold border border-white/20 pointer-events-none select-none transition-opacity duration-300"
        :class="{ 'opacity-100': isDragging, 'opacity-60': !isDragging }"
      >
        {{ pixelSize.w }} × {{ pixelSize.h }}
      </div>

      <!-- 手柄 -->
      <div
        v-for="pos in ['nw', 'ne', 'sw', 'se', 'n', 's', 'w', 'e']"
        :key="pos"
        class="absolute z-20"
        :class="{
          '-top-3 -left-3 cursor-nw-resize': pos === 'nw',
          '-top-3 -right-3 cursor-ne-resize': pos === 'ne',
          '-bottom-3 -left-3 cursor-sw-resize': pos === 'sw',
          '-bottom-3 -right-3 cursor-se-resize': pos === 'se',
          '-top-3 left-1/2 -ml-3 cursor-n-resize': pos === 'n',
          '-bottom-3 left-1/2 -ml-3 cursor-s-resize': pos === 's',
          'top-1/2 -left-3 -mt-3 cursor-w-resize': pos === 'w',
          'top-1/2 -right-3 -mt-3 cursor-e-resize': pos === 'e'
        }"
        @mousedown.stop="handleStart($event, pos as any)"
        @touchstart.stop="handleStart($event, pos as any)"
      >
        <!-- 实际视觉小圆点 -->
        <div
          class="w-4 h-4 md:w-3 md:h-3 bg-white border-2 border-primary rounded-full shadow-lg transition-transform duration-200"
          :class="[dragMode === pos ? 'scale-150 bg-primary border-white' : 'scale-100']"
        ></div>
        <!-- 触控热区扩展层 -->
        <div class="absolute inset-[-12px] bg-transparent"></div>
      </div>
    </div>
  </div>
</template>
