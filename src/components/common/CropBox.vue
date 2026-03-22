<script setup lang="ts">
import { ref, onUnmounted, watch, computed } from 'vue'

interface Props {
  aspectRatio?: number
  imageUrl: string
  modelValue?: { x: number; y: number; w: number; h: number }
  gridMode?: 'none' | 'thirds' | 'golden' | 'cross'
  fillColor?: string
  scale?: number
  rotation?: number
  flipH?: boolean
  flipV?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  gridMode: 'thirds',
  fillColor: 'transparent',
  scale: 1,
  rotation: 0,
  flipH: false,
  flipV: false
})
const emit = defineEmits(['update:modelValue', 'change'])

const imgRef = ref<HTMLImageElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)

// --- 状态归位 ---
const internalCrop = ref({ x: 0, y: 0, w: 100, h: 100 })
const activePercent = ref({ x: 0, y: 0 })
const contentBounds = ref<{ x: number; y: number; w: number; h: number } | null>(null)
const isSnapping = ref(false)
const isDragging = ref(false)
const dragMode = ref<'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'w' | 'e' | null>(null)

// 基础变换计算
const transformStyle = computed(() => ({
  transform: `rotate(${props.rotation}deg) scaleX(${props.flipH ? -1 : 1}) scaleY(${props.flipV ? -1 : 1})`,
  transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
}))

// --- 坐标转换逻辑 (核心修复：解决旋转后的拖拽错乱) ---
const getRotatedDelta = (dx: number, dy: number) => {
  const rad = (props.rotation * Math.PI) / 180
  const cos = Math.cos(rad)
  const sin = Math.sin(rad)
  // 应用反向旋转矩阵
  let rDx = dx * cos + dy * sin
  let rDy = dy * cos - dx * sin
  // 处理镜像
  if (props.flipH) rDx = -rDx
  if (props.flipV) rDy = -rDy
  return { dx: rDx, dy: rDy }
}

// --- 还原：吸附线状态 (百分比) ---
const snapLines = ref({
  x: null as number | null,
  y: null as number | null,
  cx: null as number | null,
  cy: null as number | null
})

// 适配：图片自然尺寸
const imgNaturalSize = ref({ w: 0, h: 0 })

// --- 核心：高精度放大镜算法 (极致对齐补丁) ---
const magnifierBgPos = computed(() => {
  const { x, y } = activePercent.value
  const zoom = 2
  const zw = imgNaturalSize.value.w * zoom
  const zh = imgNaturalSize.value.h * zoom

  // 物理补偿：160px (w-40) - 8px (左右 border 共 4px*2) = 152px 净尺寸
  const innerSize = 152
  const posX = -(x / 100) * zw + innerSize / 2
  const posY = -(y / 100) * zh + innerSize / 2
  return `${posX}px ${posY}px`
})

const showMagnifier = computed(() => isDragging.value && dragMode.value !== 'move')

// 还原并增强：放大镜内红线 (更细、更高对比度)
const magnifierCropLines = computed(() => {
  if (!dragMode.value || dragMode.value === 'move') return null
  const style: any = {
    position: 'absolute',
    borderStyle: 'solid',
    borderColor: 'hsl(var(--primary))',
    boxShadow: '0 0 0 999px rgba(0,0,0,0.4)',
    zIndex: 10,
    pointerEvents: 'none'
  }
  const mode = dragMode.value
  if (mode.includes('n')) {
    style.top = '50%'
    style.height = '200%'
    style.borderTopWidth = '1.5px'
  }
  if (mode.includes('s')) {
    style.bottom = '50%'
    style.height = '200%'
    style.borderBottomWidth = '1.5px'
  }
  if (mode.includes('w')) {
    style.left = '50%'
    style.width = '200%'
    style.borderLeftWidth = '1.5px'
  }
  if (mode.includes('e')) {
    style.right = '50%'
    style.width = '200%'
    style.borderRightWidth = '1.5px'
  }
  return style
})

// --- 逻辑逻辑逻辑 ---
watch(
  () => props.modelValue,
  (v) => {
    if (v && JSON.stringify(v) !== JSON.stringify(internalCrop.value)) internalCrop.value = { ...v }
  },
  { deep: true, immediate: true }
)

const pixelSize = computed(() => ({
  w: Math.round((internalCrop.value.w / 100) * imgNaturalSize.value.w),
  h: Math.round((internalCrop.value.h / 100) * imgNaturalSize.value.h)
}))

const updateCrop = (n: typeof internalCrop.value) => {
  n.x = Number(n.x.toFixed(4))
  n.y = Number(n.y.toFixed(4))
  n.w = Number(n.w.toFixed(4))
  n.h = Number(n.h.toFixed(4))
  internalCrop.value = { ...n }
  emit('update:modelValue', { ...n })
  emit('change', {
    ...n,
    usePercentage: true,
    isDragging: isDragging.value,
    isSnapping: isSnapping.value
  })
}

const handleImageLoad = () => {
  const img = imgRef.value
  if (!img) return
  imgNaturalSize.value = { w: img.naturalWidth, h: img.naturalHeight }

  // 还原：像素检测逻辑
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
        rs.push(data[idx]!)
        gs.push(data[idx + 1]!)
        bs.push(data[idx + 2]!)
        as.push(data[idx + 3]!)
      }
    }
    const med = (arr: number[]) => {
      arr.sort((a, b) => a - b)
      return arr[Math.floor(arr.length / 2)] ?? 0
    }
    const bg = { r: med(rs), g: med(gs), b: med(bs), a: med(as) }
    const isBg = (r: number, g: number, b: number, a: number) =>
      bg.a < 64
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
        if (!isBg(data[i]!, data[i + 1]!, data[i + 2]!, data[i + 3]!)) {
          minX = Math.min(minX, x)
          minY = Math.min(minY, y)
          maxX = Math.max(maxX, x)
          maxY = Math.max(maxY, y)
          hasC = true
        }
      }
    if (hasC)
      contentBounds.value = {
        x: (minX / w) * 100,
        y: (minY / h) * 100,
        w: ((maxX - minX + 1) / w) * 100,
        h: ((maxY - minY + 1) / h) * 100
      }
  } catch (e) {
    console.warn(e)
  }
}

let startX = 0,
  startY = 0,
  startCrop = { x: 0, y: 0, w: 0, h: 0 },
  rafId: number | null = null

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
  if (!isDragging.value || !imgRef.value || !containerRef.value) return
  if (e.cancelable) e.preventDefault()
  const t = 'touches' in e ? e.touches[0] : e,
    cx = t?.clientX ?? 0,
    cy = t?.clientY ?? 0
  const alt = 'altKey' in e ? (e as MouseEvent).altKey : false
  if (rafId) cancelAnimationFrame(rafId)
  rafId = requestAnimationFrame(() => {
    const rect = containerRef.value!.getBoundingClientRect()
    const nw = imgNaturalSize.value.w
    const nh = imgNaturalSize.value.h

    // 计算鼠标相对于容器中心的物理像素偏移
    const cxOffset = (cx - rect.left - rect.width / 2) / props.scale
    const cyOffset = (cy - rect.top - rect.height / 2) / props.scale

    // 将偏移逆向映射回图片 0 度的原始空间
    const { dx: rX, dy: rY } = getRotatedDelta(cxOffset, cyOffset)

    // 换算为 0-100 的绝对百分比坐标
    const px = Math.max(0, Math.min(100, (rX / nw + 0.5) * 100))
    const py = Math.max(0, Math.min(100, (rY / nh + 0.5) * 100))

    // 计算拖拽增量的百分比
    const dxRaw = (cx - startX) / props.scale
    const dyRaw = (cy - startY) / props.scale
    const { dx: deltaX, dy: deltaY } = getRotatedDelta(dxRaw, dyRaw)
    const dxPercent = (deltaX / nw) * 100
    const dyPercent = (deltaY / nh) * 100

    const n = { ...startCrop }
    let sH = false,
      sV = false

    const currentLines = {
      x: null as number | null,
      y: null as number | null,
      cx: null as number | null,
      cy: null as number | null
    }
    // 吸附在百分比空间进行，阈值需换算
    const snap = (val: number, target: number) =>
      !alt &&
      contentBounds.value &&
      Math.abs(val - target) < (15 / props.scale / Math.max(nw, nh)) * 100
        ? target
        : val

    if (dragMode.value === 'move') {
      n.x = Math.max(-50, Math.min(150 - n.w, startCrop.x + dxPercent))
      n.y = Math.max(-50, Math.min(150 - n.h, startCrop.y + dyPercent))
      activePercent.value = { x: px, y: py }

      // 移动模式吸附线判定
      if (contentBounds.value) {
        const threshold = (15 / props.scale / Math.max(nw, nh)) * 100
        if (Math.abs(n.x - contentBounds.value.x) < threshold) {
          n.x = contentBounds.value.x
          currentLines.x = contentBounds.value.x
          sH = true
        }
        if (Math.abs(n.y - contentBounds.value.y) < threshold) {
          n.y = contentBounds.value.y
          currentLines.y = contentBounds.value.y
          sV = true
        }
        if (Math.abs(n.x + n.w - (contentBounds.value.x + contentBounds.value.w)) < threshold) {
          n.x = contentBounds.value.x + contentBounds.value.w - n.w
          currentLines.x = contentBounds.value.x + contentBounds.value.w
          sH = true
        }
        if (Math.abs(n.y + n.h - (contentBounds.value.y + contentBounds.value.h)) < threshold) {
          n.y = contentBounds.value.y + contentBounds.value.h - n.h
          currentLines.y = contentBounds.value.y + contentBounds.value.h
          sV = true
        }
      }
    } else {
      const mode = dragMode.value!
      if (mode.includes('n')) {
        const ny = snap(startCrop.y + dyPercent, contentBounds.value?.y ?? -999)
        n.y = Math.min(ny, startCrop.y + startCrop.h - 0.5)
        n.h = startCrop.h - (n.y - startCrop.y)
        if (ny === contentBounds.value?.y) {
          sV = true
          currentLines.y = ny
        }
      }
      if (mode.includes('s')) {
        const target = (contentBounds.value?.y ?? 0) + (contentBounds.value?.h ?? 0)
        const nb = snap(startCrop.y + startCrop.h + dyPercent, target)
        n.h = Math.max(0.5, nb - n.y)
        if (nb === target) {
          sV = true
          currentLines.y = target
        }
      }
      if (mode.includes('w')) {
        const nx = snap(startCrop.x + dxPercent, contentBounds.value?.x ?? -999)
        n.x = Math.min(nx, startCrop.x + startCrop.w - 0.5)
        n.w = startCrop.w - (n.x - startCrop.x)
        if (nx === contentBounds.value?.x) {
          sH = true
          currentLines.x = nx
        }
      }
      if (mode.includes('e')) {
        const target = (contentBounds.value?.x ?? 0) + (contentBounds.value?.w ?? 0)
        const nr = snap(startCrop.x + startCrop.w + dxPercent, target)
        n.w = Math.max(0.5, nr - n.x)
        if (nr === target) {
          sH = true
          currentLines.x = target
        }
      }
      if (props.aspectRatio) {
        const ar = props.aspectRatio
        // 根据图片自然尺寸的宽高比修正百分比换算
        const imgRatio = nw / nh
        const visualRatio = ar / imgRatio
        if (mode === 'n' || mode === 's') n.w = n.h * visualRatio
        else n.h = n.w / visualRatio
      }

      // 更新放大镜追踪点：如果是拉动角点，放大镜锁定在角点上
      activePercent.value = {
        x: mode.includes('w') ? n.x : mode.includes('e') ? n.x + n.w : px,
        y: mode.includes('n') ? n.y : mode.includes('s') ? n.y + n.h : py
      }
    }
    isSnapping.value = sH || sV
    snapLines.value = currentLines
    updateCrop(n)
  })
}

const handleEnd = () => {
  isDragging.value = false
  isSnapping.value = false
  dragMode.value = null
  snapLines.value = { x: null, y: null, cx: null, cy: null }
  window.removeEventListener('mousemove', handleMove)
  window.removeEventListener('mouseup', handleEnd)
  window.removeEventListener('touchmove', handleMove)
  window.removeEventListener('touchend', handleEnd)
}

const handleReset = () => updateCrop({ x: 0, y: 0, w: 100, h: 100 })
onUnmounted(handleEnd)
</script>

<template>
  <div ref="containerRef" class="relative select-none touch-none flex items-center justify-center">
    <!-- 变换包裹层：将图片和交互层全部打包旋转 -->
    <div class="relative w-full h-full" :style="transformStyle">
      <!-- 【视觉填充层】：仅在非透明时渲染，作为图片的衬底 -->
      <div
        v-if="props.fillColor !== 'transparent'"
        class="absolute inset-[-100%] z-0 pointer-events-none transition-colors duration-500"
        :style="{ backgroundColor: props.fillColor }"
      ></div>

      <img
        ref="imgRef"
        :src="imageUrl"
        class="relative z-10 block rounded-sm shadow-sm pointer-events-none max-w-none"
        @load="handleImageLoad"
      />

      <!-- 吸附辅助线层 -->
      <div class="absolute inset-0 pointer-events-none z-10 overflow-hidden">
        <div
          v-if="snapLines.x !== null"
          class="absolute h-full w-[1px] bg-primary shadow-[0_0_4px_rgba(255,255,255,0.8)]"
          :style="{ left: snapLines.x + '%' }"
        ></div>
        <div
          v-if="snapLines.y !== null"
          class="absolute w-full h-[1px] bg-primary shadow-[0_0_4px_rgba(255,255,255,0.8)]"
          :style="{ top: snapLines.y + '%' }"
        ></div>
      </div>

      <div v-if="imgNaturalSize.w > 0" class="absolute inset-0 z-20 pointer-events-none">
        <!-- 【工业级遮罩系统】：通过四个区块围合，消除大阴影导致的缩放锯齿 -->
        <div class="absolute inset-0 z-0">
          <div
            class="absolute top-0 left-0 w-full bg-black/50"
            :style="{ height: Math.max(0, internalCrop.y) + '%' }"
          ></div>
          <div
            class="absolute bottom-0 left-0 w-full bg-black/50"
            :style="{ height: Math.max(0, 100 - (internalCrop.y + internalCrop.h)) + '%' }"
          ></div>
          <div
            class="absolute left-0 bg-black/50"
            :style="{
              top: Math.max(0, internalCrop.y) + '%',
              height: Math.min(100, internalCrop.h + Math.min(0, internalCrop.y)) + '%',
              width: Math.max(0, internalCrop.x) + '%'
            }"
          ></div>
          <div
            class="absolute right-0 bg-black/50"
            :style="{
              top: Math.max(0, internalCrop.y) + '%',
              height: Math.min(100, internalCrop.h + Math.min(0, internalCrop.y)) + '%',
              width: Math.max(0, 100 - (internalCrop.x + internalCrop.w)) + '%'
            }"
          ></div>
        </div>

        <div
          class="absolute border-2 border-primary cursor-move pointer-events-auto"
          :style="{
            left: internalCrop.x + '%',
            top: internalCrop.y + '%',
            width: internalCrop.w + '%',
            height: internalCrop.h + '%',
            willChange: 'left, top, width, height'
          }"
          @mousedown="handleStart($event, 'move')"
          @dblclick="handleReset"
        >
          <!-- 旗舰级构图引导系统 (增强可见度版) -->
          <div
            v-if="gridMode !== 'none'"
            class="absolute inset-0 pointer-events-none transition-all duration-500 ease-out"
            :class="isDragging ? 'opacity-100 scale-100' : 'opacity-20 scale-[0.99]'"
          >
            <!-- 三分法网格 -->
            <div v-if="gridMode === 'thirds'" class="absolute inset-0 grid grid-cols-3 grid-rows-3">
              <div
                v-for="i in 9"
                :key="i"
                class="relative border-[0.5px] border-white/60 shadow-[0_0_1px_rgba(0,0,0,0.5)]"
              >
                <!-- 视觉焦点锚点 (带 Halo 效果) -->
                <div
                  v-if="[1, 2, 4, 5].includes(i)"
                  class="absolute -right-1.5 -bottom-1.5 w-3 h-3 flex items-center justify-center"
                >
                  <div
                    class="w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_4px_rgba(0,0,0,0.8)]"
                  ></div>
                  <div class="absolute inset-0 border border-white/20 rounded-full"></div>
                </div>
              </div>
            </div>

            <!-- 黄金分割网格 (Phidias Grid) -->
            <div v-if="gridMode === 'golden'" class="absolute inset-0">
              <div
                v-for="y in ['38.2%', '61.8%']"
                :key="y"
                class="absolute w-full h-[1px] bg-white/60 shadow-[0_0.5px_1px_rgba(0,0,0,0.5)]"
                :style="{ top: y }"
              ></div>
              <div
                v-for="x in ['38.2%', '61.8%']"
                :key="x"
                class="absolute h-full w-[1px] bg-white/60 shadow-[0.5px_0_1px_rgba(0,0,0,0.5)]"
                :style="{ left: x }"
              ></div>
              <div
                v-for="pos in [
                  'top:38.2%;left:38.2%',
                  'top:38.2%;left:61.8%',
                  'top:61.8%;left:38.2%',
                  'top:61.8%;left:61.8%'
                ]"
                :key="pos"
                :style="pos"
                class="absolute -translate-x-1/2 -translate-y-1/2 w-3 h-3 flex items-center justify-center"
              >
                <div
                  class="w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_4px_rgba(0,0,0,0.8)]"
                ></div>
              </div>
            </div>
          </div>

          <!-- 手柄系统 (逆向缩放) -->
          <div
            v-for="pos in ['nw', 'ne', 'sw', 'se']"
            :key="pos"
            class="absolute w-10 h-10 flex z-30 group/handle cursor-pointer"
            :style="{
              left: pos.includes('e') ? '100%' : '0',
              top: pos.includes('s') ? '100%' : '0',
              transform: `translate(-50%, -50%) scale(${1 / props.scale})`,
              cursor: `${pos}-resize`
            }"
            @mousedown.stop="handleStart($event, pos as any)"
          >
            <div
              class="m-auto w-3 h-3 bg-white border-2 border-primary rounded-sm shadow-xl transition-all group-hover/handle:scale-125"
            ></div>
          </div>
          <div
            v-for="pos in ['n', 's', 'w', 'e']"
            :key="pos"
            class="absolute flex z-20 group/handle cursor-pointer"
            :style="{
              top: pos === 'n' ? '0' : pos === 's' ? '100%' : '50%',
              left: pos === 'w' ? '0' : pos === 'e' ? '100%' : '50%',
              width: '40px',
              height: '40px',
              transform: `translate(-50%, -50%) scale(${1 / props.scale})`,
              cursor: `${pos}-resize`
            }"
            @mousedown.stop="handleStart($event, pos as any)"
          >
            <div
              :class="['n', 's'].includes(pos) ? 'w-5 h-1.5' : 'w-1.5 h-5'"
              class="m-auto bg-white border border-primary/50 rounded-full shadow-md group-hover/handle:bg-primary"
            ></div>
          </div>
        </div>
      </div>
    </div>

    <!-- 专业大号放大镜 (放置在旋转层之外，确保文字正向且绝对定位准确) -->
    <div
      v-if="showMagnifier"
      class="absolute z-50 w-40 h-40 rounded-full border-[4px] border-white shadow-[0_20px_50px_rgba(0,0,0,0.4)] pointer-events-none overflow-hidden bg-black flex flex-col"
      :style="{
        left: activePercent.x + '%',
        top: activePercent.y + '%',
        transform: `translate(${activePercent.x > 70 ? '-125%' : '25%'}, ${activePercent.y < 25 ? '25%' : '-125%'}) scale(${1 / props.scale})`
      }"
    >
      <div class="relative flex-1">
        <!-- 核心高清采样层 (对其应用旋转，以确保放大镜内的画面也是正对的) -->
        <div
          class="absolute inset-0"
          :style="{
            backgroundImage: `url(${imageUrl})`,
            backgroundPosition: magnifierBgPos,
            backgroundSize: `${imgNaturalSize.w * 2}px ${imgNaturalSize.h * 2}px`,
            backgroundRepeat: 'no-repeat',
            transform: `rotate(${props.rotation}deg) scaleX(${props.flipH ? -1 : 1}) scaleY(${props.flipV ? -1 : 1})`,
            transformOrigin: 'center'
          }"
        ></div>

        <!-- 局部裁剪辅助线 -->
        <div v-if="magnifierCropLines" :style="magnifierCropLines"></div>

        <!-- 工业级精密准星 -->
        <div class="absolute inset-0 flex items-center justify-center z-20">
          <div
            class="w-2.5 h-2.5 border-[1.5px] border-primary rounded-full shadow-[0_0_0_1px_rgba(255,255,255,0.8)] bg-primary/5"
          ></div>
          <div
            class="absolute w-full h-[0.5px] bg-primary/90 shadow-[0_0.5px_0_rgba(255,255,255,0.5)]"
          ></div>
          <div
            class="absolute h-full w-[0.5px] bg-primary/90 shadow-[0.5px_0_0_rgba(255,255,255,0.5)]"
          ></div>
        </div>

        <!-- 内部浮动状态胶囊 -->
        <div
          class="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 px-2 py-0.5 bg-black/70 backdrop-blur-md rounded-full border border-white/20 flex items-center gap-1.5 shadow-xl"
        >
          <div
            class="w-1 h-1 rounded-full"
            :class="isSnapping ? 'bg-primary animate-pulse' : 'bg-white/20'"
          ></div>
          <span class="text-[8px] text-white font-black tracking-widest uppercase italic">
            {{ isSnapping ? 'Magnetic' : 'Precision' }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
