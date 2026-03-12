<script setup lang="ts">
import { ref, onUnmounted, watch, computed } from 'vue'

interface Props {
  aspectRatio?: number // null for free
  imageUrl: string
  modelValue?: { x: number; y: number; w: number; h: number }
  gridMode?: 'none' | 'thirds' | 'golden' | 'cross'
}

const props = withDefaults(defineProps<Props>(), {
  gridMode: 'thirds'
})
const emit = defineEmits(['update:modelValue', 'change'])

const containerRef = ref<HTMLDivElement | null>(null)
const imgRef = ref<HTMLImageElement | null>(null)
const imgMeta = ref({ nw: 0, nh: 0 })

// 内部裁剪区域 (百分比 0-100)
const internalCrop = ref({
  x: 10,
  y: 10,
  w: 80,
  h: 80
})

// 同步外部传入的坐标
watch(
  () => props.modelValue,
  (val) => {
    if (val && JSON.stringify(val) !== JSON.stringify(internalCrop.value)) {
      internalCrop.value = { ...val }
    }
  },
  { deep: true, immediate: true }
)

const pixelSize = computed(() => {
  const { nw, nh } = imgMeta.value
  if (!nw) return { w: 0, h: 0 }
  return {
    w: Math.round((internalCrop.value.w / 100) * nw),
    h: Math.round((internalCrop.value.h / 100) * nh)
  }
})

const isDragging = ref(false)
const dragMode = ref<'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'w' | 'e' | null>(null)
const focusedHandle = ref<string | null>(null)
let startX = 0
let startY = 0
let startCrop = { x: 0, y: 0, w: 0, h: 0 }
let rafId: number | null = null

const updateCrop = (newCrop: typeof internalCrop.value) => {
  newCrop.x = Number(newCrop.x.toFixed(2))
  newCrop.y = Number(newCrop.y.toFixed(2))
  newCrop.w = Number(newCrop.w.toFixed(2))
  newCrop.h = Number(newCrop.h.toFixed(2))

  const minSize = 5
  newCrop.w = Math.max(minSize, Math.min(newCrop.w, 100))
  newCrop.h = Math.max(minSize, Math.min(newCrop.h, 100))

  if (newCrop.x + newCrop.w > 100) {
    if (dragMode.value === 'move') newCrop.x = 100 - newCrop.w
    else newCrop.w = 100 - newCrop.x
  }
  if (newCrop.y + newCrop.h > 100) {
    if (dragMode.value === 'move') newCrop.y = 100 - newCrop.h
    else newCrop.h = 100 - newCrop.y
  }

  newCrop.x = Math.max(0, newCrop.x)
  newCrop.y = Math.max(0, newCrop.y)

  if (props.aspectRatio) {
    const currentR = newCrop.w / newCrop.h
    if (Math.abs(currentR - props.aspectRatio) > 0.001) {
      newCrop.h = newCrop.w / props.aspectRatio
      if (newCrop.y + newCrop.h > 100) {
        newCrop.h = 100 - newCrop.y
        newCrop.w = newCrop.h * props.aspectRatio
      }
    }
  }

  internalCrop.value = { ...newCrop }
  emit('update:modelValue', { ...internalCrop.value })
  debouncedEmitChange()
}

let emitTimer: ReturnType<typeof setTimeout> | null = null
const debouncedEmitChange = () => {
  if (emitTimer) clearTimeout(emitTimer)
  emitTimer = setTimeout(emitChange, 10)
}

const emitChange = () => {
  if (!imgRef.value || !imgRef.value.naturalWidth) return
  if (imgMeta.value.nw !== imgRef.value.naturalWidth) {
    imgMeta.value = { nw: imgRef.value.naturalWidth, nh: imgRef.value.naturalHeight }
  }
  emit('change', {
    x: internalCrop.value.x,
    y: internalCrop.value.y,
    width: internalCrop.value.w,
    height: internalCrop.value.h,
    usePercentage: true
  })
}

const handleKeyDown = (e: KeyboardEvent, mode: string) => {
  const step = e.shiftKey ? 10 : 1
  const next = { ...internalCrop.value }
  if (mode === 'move') {
    if (e.key === 'ArrowLeft') next.x -= step
    if (e.key === 'ArrowRight') next.x += step
    if (e.key === 'ArrowUp') next.y -= step
    if (e.key === 'ArrowDown') next.y += step
  } else {
    if (mode.includes('w')) {
      if (e.key === 'ArrowLeft') {
        next.x -= step
        next.w += step
      }
      if (e.key === 'ArrowRight') {
        next.x += step
        next.w -= step
      }
    }
    if (mode.includes('e')) {
      if (e.key === 'ArrowLeft') next.w -= step
      if (e.key === 'ArrowRight') next.w += step
    }
    if (mode.includes('n')) {
      if (e.key === 'ArrowUp') {
        next.y -= step
        next.h += step
      }
      if (e.key === 'ArrowDown') {
        next.y += step
        next.h -= step
      }
    }
    if (mode.includes('s')) {
      if (e.key === 'ArrowUp') next.h -= step
      if (e.key === 'ArrowDown') next.h += step
    }
  }
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
    e.preventDefault()
    updateCrop(next)
  }
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
  startCrop = { ...internalCrop.value }
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
  const { x, y } = getCoordinates(e)
  if (rafId) cancelAnimationFrame(rafId)
  rafId = requestAnimationFrame(() => {
    const rect = containerRef.value?.getBoundingClientRect()
    if (!rect) return
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
      if (dragMode.value?.includes('s')) next.h = Math.max(5, startCrop.h + dy)
      if (dragMode.value?.includes('w')) {
        const delta = Math.min(dx, startCrop.w - 5)
        next.x += delta
        next.w -= delta
      }
      if (dragMode.value?.includes('e')) next.w = Math.max(5, startCrop.w + dx)
    }
    updateCrop(next)
  })
}

const handleEnd = () => {
  isDragging.value = false
  dragMode.value = null
  if (rafId) cancelAnimationFrame(rafId)
  rafId = null
  emitChange()
  window.removeEventListener('mousemove', handleMove)
  window.removeEventListener('mouseup', handleEnd)
  window.removeEventListener('touchmove', handleMove)
  window.removeEventListener('touchend', handleEnd)
}

watch(
  () => props.aspectRatio,
  (newRatio) => {
    if (newRatio) {
      const next = { ...internalCrop.value }
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
      class="absolute border-2 border-primary shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] cursor-move outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-primary rounded-sm transition-shadow"
      :style="{
        left: internalCrop.x + '%',
        top: internalCrop.y + '%',
        width: internalCrop.w + '%',
        height: internalCrop.h + '%',
        willChange: 'left, top, width, height'
      }"
      role="region"
      aria-label="裁剪区域"
      tabindex="0"
      @mousedown="handleStart($event, 'move')"
      @touchstart="handleStart($event, 'move')"
      @keydown="handleKeyDown($event, 'move')"
    >
      <!-- 九宫格线 -->
      <div
        v-if="gridMode === 'thirds'"
        class="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-40"
      >
        <div v-for="i in 9" :key="i" class="border-[0.5px] border-white/50"></div>
      </div>

      <!-- 黄金分割线 -->
      <div
        v-if="gridMode === 'golden'"
        class="absolute inset-0 pointer-events-none opacity-40"
        style="
          background-image:
            linear-gradient(
              to right,
              transparent 38.2%,
              white 38.2%,
              white 38.4%,
              transparent 38.4%,
              transparent 61.8%,
              white 61.8%,
              white 62%,
              transparent 62%
            ),
            linear-gradient(
              to bottom,
              transparent 38.2%,
              white 38.2%,
              white 38.4%,
              transparent 38.4%,
              transparent 61.8%,
              white 61.8%,
              white 62%,
              transparent 62%
            );
        "
      ></div>

      <!-- 中心十字辅助线 -->
      <div
        v-if="gridMode === 'cross'"
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
        class="absolute z-20 outline-none group/handle"
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
        role="slider"
        :aria-label="`调整${pos.replace('n', '北').replace('s', '南').replace('w', '西').replace('e', '东')}边缘`"
        tabindex="0"
        @mousedown.stop="handleStart($event, pos as any)"
        @touchstart.stop="handleStart($event, pos as any)"
        @keydown.stop="handleKeyDown($event, pos as any)"
        @focus="focusedHandle = pos"
        @blur="focusedHandle = null"
      >
        <!-- 实际视觉小圆点 -->
        <div
          class="w-4 h-4 md:w-3 md:h-3 bg-white border-2 border-primary rounded-full shadow-lg transition-all duration-200 group-focus-visible/handle:scale-150 group-focus-visible/handle:ring-2 group-focus-visible/handle:ring-white"
          :class="[dragMode === pos ? 'scale-150 bg-primary border-white' : 'scale-100']"
        ></div>
        <!-- 触控热区扩展层 -->
        <div class="absolute inset-[-12px] bg-transparent"></div>
      </div>
    </div>
  </div>
</template>
