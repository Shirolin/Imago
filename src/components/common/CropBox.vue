<script setup lang="ts">
import { ref, onUnmounted, onMounted, watch, computed } from 'vue'

interface Props {
  aspectRatio?: number
  imageUrl: string
  modelValue?: { x: number; y: number; w: number; h: number }
  gridMode?: 'none' | 'thirds' | 'golden' | 'cross'
}

const props = withDefaults(defineProps<Props>(), {
  gridMode: 'thirds'
})
const emit = defineEmits(['update:modelValue', 'change'])

const imgRef = ref<HTMLImageElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)
const imgRenderedRect = ref({ left: 0, top: 0, width: 0, height: 0 })

const internalCrop = ref({ x: 10, y: 10, w: 80, h: 80 })
const mouseRawPos = ref({ x: 0, y: 0 })
const contentBounds = ref<{ x: number; y: number; w: number; h: number } | null>(null)
const isSnapping = ref(false)
const isDragging = ref(false)
const dragMode = ref<'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'w' | 'e' | null>(null)

const updateRenderedRect = () => {
  if (!imgRef.value || !containerRef.value) return
  const img = imgRef.value,
    container = containerRef.value
  const padding = 64
  const availableW = Math.max(container.offsetWidth - padding, 100)
  const availableH = Math.max(container.offsetHeight - padding, 100)
  const ir = img.naturalWidth / img.naturalHeight,
    cr = availableW / availableH
  let w, h
  if (ir > cr) {
    w = availableW
    h = availableW / ir
  } else {
    h = availableH
    w = availableH * ir
  }
  imgRenderedRect.value = {
    left: (container.offsetWidth - w) / 2,
    top: (container.offsetHeight - h) / 2,
    width: w,
    height: h
  }
}

const activeCropPointPercent = computed(() => {
  if (!dragMode.value) return { x: 0, y: 0 }
  const c = internalCrop.value
  const m = {
    x: (mouseRawPos.value.x / imgRenderedRect.value.width) * 100,
    y: (mouseRawPos.value.y / imgRenderedRect.value.height) * 100
  }
  let px = m.x,
    py = m.y
  if (dragMode.value.includes('w')) px = c.x
  if (dragMode.value.includes('e')) px = c.x + c.w
  if (dragMode.value.includes('n')) py = c.y
  if (dragMode.value.includes('s')) py = c.y + c.h
  return { x: px, y: py }
})

const magnifierBgPos = computed(() => {
  const p = activeCropPointPercent.value
  const zoom = 2 // 统一使用 2 倍放大
  const zw = imgRenderedRect.value.width * zoom
  const zh = imgRenderedRect.value.height * zoom
  const size = 144 // w-36 = 144px
  const x = -(p.x / 100) * zw + size / 2
  const y = -(p.y / 100) * zh + size / 2
  return `${x}px ${y}px`
})

const showMagnifier = computed(() => isDragging.value && dragMode.value !== 'move')

const magnifierCropLines = computed(() => {
  if (!dragMode.value || dragMode.value === 'move') return null
  const style: any = {
    position: 'absolute',
    borderStyle: 'solid',
    borderColor: 'hsl(var(--primary))',
    boxShadow: '0 0 0 999px rgba(0,0,0,0.5)',
    zIndex: 10,
    pointerEvents: 'none'
  }
  switch (dragMode.value) {
    case 'nw':
      style.left = '50%'
      style.top = '50%'
      style.width = '200%'
      style.height = '200%'
      style.borderWidth = '2.5px 0 0 2.5px'
      break
    case 'ne':
      style.right = '50%'
      style.top = '50%'
      style.width = '200%'
      style.height = '200%'
      style.borderWidth = '2.5px 2.5px 0 0'
      break
    case 'sw':
      style.left = '50%'
      style.bottom = '50%'
      style.width = '200%'
      style.height = '200%'
      style.borderWidth = '0 0 2.5px 2.5px'
      break
    case 'se':
      style.right = '50%'
      style.bottom = '50%'
      style.width = '200%'
      style.height = '200%'
      style.borderWidth = '0 2.5px 2.5px 0'
      break
    case 'n':
      style.left = '-100%'
      style.top = '50%'
      style.width = '300%'
      style.height = '200%'
      style.borderWidth = '2.5px 0 0 0'
      break
    case 's':
      style.left = '-100%'
      style.bottom = '50%'
      style.width = '300%'
      style.height = '200%'
      style.borderWidth = '0 0 2.5px 0'
      break
    case 'w':
      style.left = '50%'
      style.top = '-100%'
      style.width = '200%'
      style.height = '300%'
      style.borderWidth = '0 0 0 2.5px'
      break
    case 'e':
      style.right = '50%'
      style.top = '-100%'
      style.width = '200%'
      style.height = '300%'
      style.borderWidth = '0 2.5px 0 0'
      break
  }
  return style
})

watch(
  () => props.modelValue,
  (v) => {
    if (v && JSON.stringify(v) !== JSON.stringify(internalCrop.value)) internalCrop.value = { ...v }
  },
  { deep: true, immediate: true }
)

const pixelSize = computed(() => {
  if (!imgRef.value) return { w: 0, h: 0 }
  return {
    w: Math.round((internalCrop.value.w / 100) * imgRef.value.naturalWidth),
    h: Math.round((internalCrop.value.h / 100) * imgRef.value.naturalHeight)
  }
})

let startX = 0,
  startY = 0,
  startCrop = { x: 0, y: 0, w: 0, h: 0 },
  rafId: number | null = null

const updateCrop = (n: typeof internalCrop.value) => {
  // 核心稳定性修复：在这里只做最终的赋值和 Emit，所有的逻辑都在 handleMove 里处理完
  n.x = Number(n.x.toFixed(4))
  n.y = Number(n.y.toFixed(4))
  n.w = Number(n.w.toFixed(4))
  n.h = Number(n.h.toFixed(4))
  internalCrop.value = { ...n }
  emit('update:modelValue', { ...n })
  emit('change', { ...n, usePercentage: true })
}

const handleImageLoad = () => {
  updateRenderedRect()
  const img = imgRef.value
  if (!img) return
  const canvas = document.createElement('canvas'),
    ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) return
  const max = 1024
  let w = img.naturalWidth,
    h = img.naturalHeight
  if (w > max || h > max) {
    if (w > h) {
      h = Math.round((h * max) / w)
      w = max
    } else {
      w = Math.round((w * max) / h)
      h = max
    }
  }
  canvas.width = w
  canvas.height = h
  ctx.drawImage(img, 0, 0, w, h)
  try {
    const data = ctx.getImageData(0, 0, w, h).data
    const rs: number[] = [],
      gs: number[] = [],
      bs: number[] = [],
      as: number[] = []
    const step = Math.max(1, Math.round(Math.min(w, h) / 40))
    for (let x = 0; x < w; x += step) {
      const ti = x * 4,
        bi = ((h - 1) * w + x) * 4
      for (const idx of [ti, bi]) {
        rs.push(data[idx] ?? 0)
        gs.push(data[idx + 1] ?? 0)
        bs.push(data[idx + 2] ?? 0)
        as.push(data[idx + 3] ?? 0)
      }
    }
    for (let y = 0; y < h; y += step) {
      const li = y * w * 4,
        ri = (y * w + w - 1) * 4
      for (const idx of [li, ri]) {
        rs.push(data[idx] ?? 0)
        gs.push(data[idx + 1] ?? 0)
        bs.push(data[idx + 2] ?? 0)
        as.push(data[idx + 3] ?? 0)
      }
    }
    const med = (arr: number[]) => {
      arr.sort((a, b) => a - b)
      return arr[Math.floor(arr.length / 2)] ?? 0
    }
    const bg = { r: med(rs), g: med(gs), b: med(bs), a: med(as) }
    const isTransparentBg = bg.a < 64
    const isBg = (r: number, g: number, b: number, a: number) =>
      isTransparentBg
        ? a < 128
        : Math.abs(r - bg.r) + Math.abs(g - bg.g) + Math.abs(b - bg.b) < 40 &&
          Math.abs(a - bg.a) < 40

    let minX = w,
      minY = h,
      maxX = 0,
      maxY = 0,
      hasC = false
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4
        if (!isBg(data[i] || 0, data[i + 1] || 0, data[i + 2] || 0, data[i + 3] || 0)) {
          minX = Math.min(minX, x)
          minY = Math.min(minY, y)
          maxX = Math.max(maxX, x)
          maxY = Math.max(maxY, y)
          hasC = true
        }
      }
    if (hasC && maxX - minX > 2) {
      const hasRealContent_y = (y: number): boolean => {
        for (let x = minX; x <= maxX; x++) {
          const i = (y * w + x) * 4
          if ((data[i + 3] ?? 0) < 10) continue
          if (Math.min(data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0) < 200) return true
        }
        return false
      }
      const hasRealContent_x = (x: number): boolean => {
        for (let y = minY; y <= maxY; y++) {
          const i = (y * w + x) * 4
          if ((data[i + 3] ?? 0) < 10) continue
          if (Math.min(data[i] ?? 0, data[i + 1] ?? 0, data[i + 2] ?? 0) < 200) return true
        }
        return false
      }
      while (maxY > minY && !hasRealContent_y(maxY)) maxY--
      while (minY < maxY && !hasRealContent_y(minY)) minY++
      while (maxX > minX && !hasRealContent_x(maxX)) maxX--
      while (minX < maxX && !hasRealContent_x(minX)) minX++
      contentBounds.value = {
        x: (minX / w) * 100,
        y: (minY / h) * 100,
        w: ((maxX - minX + 1) / w) * 100,
        h: ((maxY - minY + 1) / h) * 100
      }
    }
  } catch (e) {
    console.warn('Image data extraction failed:', e)
  }
}

const handleStart = (e: MouseEvent | TouchEvent, mode: typeof dragMode.value) => {
  if (e.cancelable) e.preventDefault()
  isDragging.value = true
  dragMode.value = mode
  const t = 'touches' in e ? e.touches[0] : e
  startX = t?.clientX ?? 0
  startY = t?.clientY ?? 0
  startCrop = { ...internalCrop.value }
  window.addEventListener('mousemove', handleMove)
  window.addEventListener('mouseup', handleEnd)
  window.addEventListener('touchmove', handleMove, { passive: false })
  window.addEventListener('touchend', handleEnd)
}

const handleMove = (e: MouseEvent | TouchEvent) => {
  if (!isDragging.value || !containerRef.value) return
  if (e.cancelable) e.preventDefault()
  const t = 'touches' in e ? e.touches[0] : e,
    cx = t?.clientX ?? 0,
    cy = t?.clientY ?? 0
  const alt = 'altKey' in e ? (e as MouseEvent).altKey : false
  if (rafId) cancelAnimationFrame(rafId)
  rafId = requestAnimationFrame(() => {
    const rect = containerRef.value!.getBoundingClientRect()
    const x = cx - rect.left - imgRenderedRect.value.left,
      y = cy - rect.top - imgRenderedRect.value.top
    mouseRawPos.value = { x, y }
    const dx =
      (x / imgRenderedRect.value.width) * 100 -
      ((startX - rect.left - imgRenderedRect.value.left) / imgRenderedRect.value.width) * 100
    const dy =
      (y / imgRenderedRect.value.height) * 100 -
      ((startY - rect.top - imgRenderedRect.value.top) / imgRenderedRect.value.height) * 100

    const n = { ...startCrop }
    let sH = false,
      sV = false
    const snap = (val: number, target: number) =>
      !alt && contentBounds.value && Math.abs(val - target) < 2.5 ? target : val

    if (dragMode.value === 'move') {
      n.x = Math.max(0, Math.min(100 - n.w, startCrop.x + dx))
      n.y = Math.max(0, Math.min(100 - n.h, startCrop.y + dy))
    } else {
      const mode = dragMode.value!
      // 1. 独立计算基础变更 (不考虑比例)
      if (mode.includes('n')) {
        const ny = snap(startCrop.y + dy, contentBounds.value?.y ?? -999)
        n.y = Math.max(0, Math.min(ny, startCrop.y + startCrop.h - 0.5))
        n.h = startCrop.h - (n.y - startCrop.y)
        if (ny === contentBounds.value?.y) sV = true
      }
      if (mode.includes('s')) {
        const nb = snap(
          startCrop.y + startCrop.h + dy,
          (contentBounds.value?.y ?? 0) + (contentBounds.value?.h ?? 0)
        )
        n.h = Math.max(0.5, Math.min(100 - n.y, nb - n.y))
        if (nb === (contentBounds.value?.y ?? 0) + (contentBounds.value?.h ?? 0)) sV = true
      }
      if (mode.includes('w')) {
        const nx = snap(startCrop.x + dx, contentBounds.value?.x ?? -999)
        n.x = Math.max(0, Math.min(nx, startCrop.x + startCrop.w - 0.5))
        n.w = startCrop.w - (n.x - startCrop.x)
        if (nx === contentBounds.value?.x) sH = true
      }
      if (mode.includes('e')) {
        const nr = snap(
          startCrop.x + startCrop.w + dx,
          (contentBounds.value?.x ?? 0) + (contentBounds.value?.w ?? 0)
        )
        n.w = Math.max(0.5, Math.min(100 - n.x, nr - n.x))
        if (nr === (contentBounds.value?.x ?? 0) + (contentBounds.value?.w ?? 0)) sH = true
      }

      // 2. 比例修正逻辑 (核心修复：根据拖拽柄智能选择 master)
      if (props.aspectRatio) {
        const ar = props.aspectRatio
        const isHeightMaster = mode === 'n' || mode === 's'
        if (isHeightMaster) {
          n.w = n.h * ar
          if (n.x + n.w > 100) {
            n.w = 100 - n.x
            n.h = n.w / ar
          }
        } else {
          // 默认以宽度为准（适合左右拖动和角点拖动）
          n.h = n.w / ar
          if (n.y + n.h > 100) {
            n.h = 100 - n.y
            n.w = n.h * ar
          }
        }
      }
    }
    isSnapping.value = sH || sV
    updateCrop(n)
  })
}

const handleEnd = () => {
  isDragging.value = false
  isSnapping.value = false
  dragMode.value = null
  window.removeEventListener('mousemove', handleMove)
  window.removeEventListener('mouseup', handleEnd)
  window.removeEventListener('touchmove', handleMove)
  window.removeEventListener('touchend', handleEnd)
}

onMounted(() => window.addEventListener('resize', updateRenderedRect))
onUnmounted(() => {
  window.removeEventListener('resize', updateRenderedRect)
  handleEnd()
})
</script>

<template>
  <div
    ref="containerRef"
    class="w-full h-full relative overflow-hidden select-none touch-none transparency-grid flex items-center justify-center"
  >
    <img
      ref="imgRef"
      :src="imageUrl"
      class="absolute opacity-0 pointer-events-none"
      @load="handleImageLoad"
    />
    <div
      v-if="imgRenderedRect.width > 0"
      class="absolute overflow-hidden"
      :style="{
        left: imgRenderedRect.left + 'px',
        top: imgRenderedRect.top + 'px',
        width: imgRenderedRect.width + 'px',
        height: imgRenderedRect.height + 'px'
      }"
    >
      <img :src="imageUrl" class="w-full h-full block rounded-sm shadow-sm pointer-events-none" />
      <div
        class="absolute border-2 border-primary shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] cursor-move"
        :style="{
          left: internalCrop.x + '%',
          top: internalCrop.y + '%',
          width: internalCrop.w + '%',
          height: internalCrop.h + '%',
          willChange: 'left, top, width, height'
        }"
        @mousedown="handleStart($event, 'move')"
        @touchstart="handleStart($event, 'move')"
      >
        <div
          v-if="gridMode === 'thirds'"
          class="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-40"
        >
          <div v-for="i in 9" :key="i" class="border-[0.5px] border-white/50"></div>
        </div>
        <!-- 角点 handles -->
        <div
          v-for="pos in ['nw', 'ne', 'sw', 'se']"
          :key="pos"
          class="absolute w-8 h-8 flex z-30 group/handle"
          :style="{
            transform: 'translate(-50%, -50%)',
            left: pos.includes('w') ? '0' : '100%',
            top: pos.includes('n') ? '0' : '100%',
            cursor: `${pos}-resize`
          }"
          @mousedown.stop="handleStart($event, pos as 'nw' | 'ne' | 'sw' | 'se')"
          @touchstart.stop="handleStart($event, pos as 'nw' | 'ne' | 'sw' | 'se')"
        >
          <div
            class="m-auto w-3 h-3 bg-white border-2 border-primary rounded-sm shadow-xl transition-all group-hover/handle:scale-125 group-active/handle:scale-90"
          ></div>
        </div>
        <!-- 边中点 handles -->
        <div
          v-for="pos in ['n', 's', 'w', 'e']"
          :key="pos"
          class="absolute flex z-20 group/handle"
          :style="{
            top: pos === 'n' ? '0' : pos === 's' ? '100%' : '50%',
            left: pos === 'w' ? '0' : pos === 'e' ? '100%' : '50%',
            width: '32px',
            height: '32px',
            transform: 'translate(-50%, -50%)',
            cursor: `${pos}-resize`
          }"
          @mousedown.stop="handleStart($event, pos as any)"
          @touchstart.stop="handleStart($event, pos as any)"
        >
          <div
            :class="['n', 's'].includes(pos) ? 'w-5 h-1.5' : 'w-1.5 h-5'"
            class="m-auto bg-white border border-primary/50 rounded-full shadow-md transition-all group-hover/handle:bg-primary group-hover/handle:scale-110"
          ></div>
        </div>
      </div>
      <!-- 放大镜 -->
      <div
        v-if="showMagnifier"
        class="absolute z-50 w-36 h-36 rounded-full border-[3px] border-white shadow-2xl pointer-events-none overflow-hidden bg-black flex flex-col"
        :style="{
          left: mouseRawPos.x + 'px',
          top: mouseRawPos.y + 'px',
          transform: `translate(${mouseRawPos.x > imgRenderedRect.width - 180 ? '-110%' : '10%'}, ${mouseRawPos.y < 120 ? '10%' : '-110%'})`
        }"
      >
        <div class="relative flex-1">
          <div
            class="absolute inset-0"
            :style="{
              backgroundImage: `url(${imageUrl})`,
              backgroundPosition: magnifierBgPos,
              backgroundSize: `${imgRenderedRect.width * 2}px ${imgRenderedRect.height * 2}px`,
              backgroundRepeat: 'no-repeat'
            }"
          ></div>
          <div v-if="magnifierCropLines" :style="magnifierCropLines"></div>
          <div class="absolute inset-0 flex items-center justify-center z-20">
            <div class="w-1 h-1 bg-white rounded-full shadow-[0_0_2px_rgba(0,0,0,0.8)]"></div>
            <div class="absolute w-full h-[0.5px] bg-white/20"></div>
            <div class="absolute h-full w-[0.5px] bg-white/20"></div>
          </div>
        </div>
        <div
          class="h-6 bg-black/90 backdrop-blur-md flex items-center justify-center border-t border-white/10 px-2 shrink-0"
        >
          <span class="text-[9px] text-white/80 font-mono font-bold tracking-tighter uppercase">{{
            isSnapping ? 'Edge Snapped' : 'Precise Target'
          }}</span>
        </div>
      </div>
    </div>
    <!-- 状态栏 -->
    <div
      class="absolute bottom-8 left-1/2 -translate-x-1/2 pointer-events-none flex items-center gap-4 transition-all duration-300 z-40"
      :class="{ 'opacity-100 translate-y-0': isDragging, 'opacity-0 translate-y-4': !isDragging }"
    >
      <div
        v-if="dragMode && dragMode !== 'move' && contentBounds"
        class="px-4 py-2 bg-black/80 backdrop-blur-xl rounded-full border flex items-center gap-3 shadow-2xl transition-all"
        :class="isSnapping ? 'border-primary text-primary' : 'border-white/10 text-white/40'"
      >
        <div
          class="w-2 h-2 rounded-full"
          :class="isSnapping ? 'bg-primary animate-pulse' : 'bg-white/10'"
        ></div>
        <span class="text-[11px] font-bold tracking-widest uppercase">{{
          isSnapping ? '已吸附边缘 (按Alt取消)' : '移动到内容边缘自动吸附'
        }}</span>
      </div>
      <div
        class="px-4 py-2 bg-black/80 backdrop-blur-xl rounded-full border border-white/10 text-[11px] text-white font-mono font-bold shadow-2xl"
      >
        {{ pixelSize.w }} × {{ pixelSize.h }}
      </div>
    </div>
  </div>
</template>

<style scoped>
.transparency-grid {
  background-image: conic-gradient(
    hsl(var(--muted-foreground) / 0.07) 0 25%,
    transparent 0 50%,
    hsl(var(--muted-foreground) / 0.07) 0 75%,
    transparent 0
  );
  background-size: 16px 16px;
}
</style>
