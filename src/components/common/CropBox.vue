<script setup lang="ts">
import { ref, onUnmounted, watch, computed } from 'vue'

interface Props {
  aspectRatio?: number
  imageUrl: string
  modelValue?: { x: number; y: number; w: number; h: number }
  gridMode?: 'none' | 'thirds' | 'golden' | 'cross'
  fillColor?: string
  scale?: number
}

const props = withDefaults(defineProps<Props>(), {
  gridMode: 'thirds',
  fillColor: 'transparent',
  scale: 1
})
const emit = defineEmits(['update:modelValue', 'change'])

const imgRef = ref<HTMLImageElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)

// --- 状态归位 ---
const internalCrop = ref({ x: 0, y: 0, w: 100, h: 100 })
const activePercent = ref({ x: 0, y: 0 }) // 存储当前操作点的 0-100 坐标
const contentBounds = ref<{ x: number; y: number; w: number; h: number } | null>(null)
const isSnapping = ref(false)
const isDragging = ref(false)
const dragMode = ref<'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'w' | 'e' | null>(null)

// 适配：图片自然尺寸
const imgNaturalSize = ref({ w: 0, h: 0 })

// 逆向缩放：确保 UI 元素大小恒定
const reverseScaleStyle = computed(() => ({
  transform: `scale(${1 / props.scale})`,
  transformOrigin: 'center'
}))

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
  if (!isDragging.value || !imgRef.value) return
  if (e.cancelable) e.preventDefault()
  const t = 'touches' in e ? e.touches[0] : e,
    cx = t?.clientX ?? 0,
    cy = t?.clientY ?? 0
  const alt = 'altKey' in e ? (e as MouseEvent).altKey : false
  if (rafId) cancelAnimationFrame(rafId)
  rafId = requestAnimationFrame(() => {
    const rect = imgRef.value!.getBoundingClientRect()
    // 核心修复：计算当前鼠标相对于图片的绝对百分比 (0-100)
    const px = Math.max(0, Math.min(100, ((cx - rect.left) / rect.width) * 100))
    const py = Math.max(0, Math.min(100, ((cy - rect.top) / rect.height) * 100))

    const dx = ((cx - startX) / rect.width) * 100
    const dy = ((cy - startY) / rect.height) * 100

    const n = { ...startCrop }
    let sH = false,
      sV = false
    const snap = (val: number, target: number) =>
      !alt && contentBounds.value && Math.abs(val - target) < 2.5 ? target : val

    if (dragMode.value === 'move') {
      n.x = Math.max(-50, Math.min(150 - n.w, startCrop.x + dx))
      n.y = Math.max(-50, Math.min(150 - n.h, startCrop.y + dy))
      activePercent.value = { x: px, y: py }
    } else {
      const mode = dragMode.value!
      if (mode.includes('n')) {
        const ny = snap(startCrop.y + dy, contentBounds.value?.y ?? -999)
        n.y = Math.min(ny, startCrop.y + startCrop.h - 0.5)
        n.h = startCrop.h - (n.y - startCrop.y)
        if (ny === contentBounds.value?.y) sV = true
      }
      if (mode.includes('s')) {
        const nb = snap(
          startCrop.y + startCrop.h + dy,
          (contentBounds.value?.y ?? 0) + (contentBounds.value?.h ?? 0)
        )
        n.h = Math.max(0.5, nb - n.y)
        if (nb === (contentBounds.value?.y ?? 0) + (contentBounds.value?.h ?? 0)) sV = true
      }
      if (mode.includes('w')) {
        const nx = snap(startCrop.x + dx, contentBounds.value?.x ?? -999)
        n.x = Math.min(nx, startCrop.x + startCrop.w - 0.5)
        n.w = startCrop.w - (n.x - startCrop.x)
        if (nx === contentBounds.value?.x) sH = true
      }
      if (mode.includes('e')) {
        const nr = snap(
          startCrop.x + startCrop.w + dx,
          (contentBounds.value?.x ?? 0) + (contentBounds.value?.w ?? 0)
        )
        n.w = Math.max(0.5, nr - n.x)
        if (nr === (contentBounds.value?.x ?? 0) + (contentBounds.value?.w ?? 0)) sH = true
      }
      if (props.aspectRatio) {
        const ar = props.aspectRatio
        if (mode === 'n' || mode === 's') n.w = n.h * ar
        else n.h = n.w / ar
      }

      // 更新放大镜追踪点：如果是拉动角点，放大镜锁定在角点上
      activePercent.value = {
        x: mode.includes('w') ? n.x : mode.includes('e') ? n.x + n.w : px,
        y: mode.includes('n') ? n.y : mode.includes('s') ? n.y + n.h : py
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

const handleReset = () => updateCrop({ x: 0, y: 0, w: 100, h: 100 })
onUnmounted(handleEnd)
</script>

<template>
  <div ref="containerRef" class="relative select-none touch-none flex items-center justify-center">
    <img
      ref="imgRef"
      :src="imageUrl"
      class="block rounded-sm shadow-sm pointer-events-none max-w-none"
      @load="handleImageLoad"
    />

    <div v-if="imgNaturalSize.w > 0" class="absolute inset-0 z-20 pointer-events-none">
      <div
        class="absolute border-2 border-primary shadow-[0_0_0_9999px_rgba(0,0,0,0.5)] cursor-move pointer-events-auto"
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
            <!-- 水平黄金线 -->
            <div
              v-for="y in ['38.2%', '61.8%']"
              :key="y"
              class="absolute w-full h-[1px] bg-white/60 shadow-[0_0.5px_1px_rgba(0,0,0,0.5)]"
              :style="{ top: y }"
            ></div>
            <!-- 垂直黄金线 -->
            <div
              v-for="x in ['38.2%', '61.8%']"
              :key="x"
              class="absolute h-full w-[1px] bg-white/60 shadow-[0.5px_0_1px_rgba(0,0,0,0.5)]"
              :style="{ left: x }"
            ></div>

            <!-- 黄金分割焦点 -->
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
              <div class="w-1.5 h-1.5 bg-white rounded-full shadow-[0_0_4px_rgba(0,0,0,0.8)]"></div>
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

      <!-- 专业大号放大镜 (Lens 视觉风格) -->
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
          <!-- 核心高清采样层 -->
          <div
            class="absolute inset-0"
            :style="{
              backgroundImage: `url(${imageUrl})`,
              backgroundPosition: magnifierBgPos,
              backgroundSize: `${imgNaturalSize.w * 2}px ${imgNaturalSize.h * 2}px`,
              backgroundRepeat: 'no-repeat'
            }"
          ></div>

          <!-- 局部裁剪辅助线 -->
          <div v-if="magnifierCropLines" :style="magnifierCropLines"></div>

          <!-- 工业级精密准星 (带高对比度 Halo 效果) -->
          <div class="absolute inset-0 flex items-center justify-center z-20">
            <!-- 中心空洞准星：增加白色外描边确保可见度 -->
            <div
              class="w-2.5 h-2.5 border-[1.5px] border-primary rounded-full shadow-[0_0_0_1px_rgba(255,255,255,0.8)] bg-primary/5"
            ></div>

            <!-- 十字线：使用 drop-shadow 模拟双层对比度，确保全场景可见 -->
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

    <!-- 底部状态栏 -->
    <div
      class="absolute bottom-8 left-1/2 -translate-x-1/2 pointer-events-none flex items-center gap-4 transition-all duration-300 z-40"
      :class="{ 'opacity-100 translate-y-0': isDragging, 'opacity-0 translate-y-4': !isDragging }"
    >
      <div
        v-if="dragMode && dragMode !== 'move' && contentBounds"
        class="px-4 py-2 bg-black/85 backdrop-blur-xl rounded-full border flex items-center gap-3 shadow-2xl transition-all"
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
        class="px-4 py-2 bg-black/85 backdrop-blur-xl rounded-full border border-white/10 text-[11px] text-white font-mono font-bold shadow-2xl"
      >
        {{ pixelSize.w }} × {{ pixelSize.h }}
      </div>
    </div>
  </div>
</template>
