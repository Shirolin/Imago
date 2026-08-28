<script setup lang="ts">
import { ref, onUnmounted, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()

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
  isHandMode?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  gridMode: 'thirds',
  fillColor: 'transparent',
  scale: 1,
  rotation: 0,
  flipH: false,
  flipV: false,
  isHandMode: false
})
const emit = defineEmits(['update:modelValue', 'change', 'drag-start', 'drag-end', 'reset'])

const imgRef = ref<HTMLImageElement | null>(null)
const containerRef = ref<HTMLDivElement | null>(null)

// --- 状态 ---
const internalCrop = ref({ x: 0, y: 0, w: 100, h: 100 })
const activePercent = ref({ x: 0, y: 0 })
const contentBounds = ref<{ x: number; y: number; w: number; h: number } | null>(null)
const isSnapping = ref(false)
const isDragging = ref(false)
const dragMode = ref<'move' | 'nw' | 'ne' | 'sw' | 'se' | 'n' | 's' | 'w' | 'e' | null>(null)

// 记录图片原始尺寸
const imgNaturalSize = ref({ w: 0, h: 0 })

// 基础变换样式 (应用在根容器上)
const transformStyle = computed(() => ({
  transform: `rotate(${props.rotation}deg) scaleX(${props.flipH ? -1 : 1}) scaleY(${props.flipV ? -1 : 1})`,
  transition: 'all 0.4s cubic-bezier(0.4, 0, 0.2, 1)'
}))

// 物理容器：承载物理尺寸与变换
const containerStyle = computed(() => ({
  width: (imgNaturalSize.value.w || 100) + 'px',
  height: (imgNaturalSize.value.h || 100) + 'px',
  ...transformStyle.value
}))

// --- 坐标转换逻辑 (逆向矩阵) ---
const getRotatedDelta = (dx: number, dy: number) => {
  const rad = (props.rotation * Math.PI) / 180
  const cos = Math.cos(rad),
    sin = Math.sin(rad)
  let rDx = dx * cos + dy * sin
  let rDy = dy * cos - dx * sin
  if (props.flipH) rDx = -rDx
  if (props.flipV) rDy = -rDy
  return { dx: rDx, dy: rDy }
}

const snapLines = ref({ x: null as number | null, y: null as number | null })

const magnifierBgPos = computed(() => {
  const { x, y } = activePercent.value
  const zw = imgNaturalSize.value.w * 2,
    zh = imgNaturalSize.value.h * 2
  const innerSize = 152
  return `${-(x / 100) * zw + innerSize / 2}px ${-(y / 100) * zh + innerSize / 2}px`
})

const showMagnifier = computed(() => isDragging.value && dragMode.value !== 'move')

const magnifierCropLines = computed(() => {
  if (!dragMode.value || dragMode.value === 'move') return null
  const style: Record<string, string | number> = {
    position: 'absolute',
    borderStyle: 'solid',
    borderColor: 'hsl(var(--primary))',
    boxShadow: '0 0 0 999px hsla(var(--background) / 0.4)',
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

/**
 * 旋转感知的比例换算系数。
 * 引擎的裁剪框在“旋转后画布帧”上取值（输出 = 旋转帧矩形 (cw, ch)），而本组件的
 * internalCrop 是“未旋转局部帧”百分比。旋转 90°/270° 时局部 w 轴映射到输出高度、
 * h 轴映射到输出宽度，输出宽高比 = (h·nh)/(w·nw)；未旋转时 = (w·nw)/(h·nh)。
 * 要锁定“输出宽高比 == ar”，两种状态下的 visualRatio（n.h = n.w / VR）互为倒数：
 *   未旋转: VR = ar·nh/nw；旋转: VR = nh/(ar·nw)
 */
const visualRatioFor = (ar: number) => {
  const nw = imgNaturalSize.value.w,
    nh = imgNaturalSize.value.h
  return props.rotation % 180 !== 0 ? nh / (ar * nw) : (ar * nh) / nw
}

watch(
  // 旋转变化时若已锁定比例，围绕中心重新拟合，保证“输出宽高比 = ar”始终成立
  [() => props.aspectRatio, () => props.rotation],
  ([ar]) => {
    if (!ar || ar <= 0 || !imgNaturalSize.value.w) return
    const visualRatio = visualRatioFor(ar)

    const n = { ...internalCrop.value }
    const centerX = n.x + n.w / 2
    const centerY = n.y + n.h / 2

    n.h = n.w / visualRatio
    if (n.h > 100) {
      n.h = 100
      n.w = n.h * visualRatio
    }
    if (n.w > 100) {
      n.w = 100
      n.h = n.w / visualRatio
    }

    n.x = Math.max(0, Math.min(100 - n.w, centerX - n.w / 2))
    n.y = Math.max(0, Math.min(100 - n.h, centerY - n.h / 2))

    updateCrop(n)
  }
)

watch(
  () => props.modelValue,
  (v) => {
    if (v && JSON.stringify(v) !== JSON.stringify(internalCrop.value)) internalCrop.value = { ...v }
  },
  { deep: true, immediate: true }
)

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
  if (!img || img.naturalWidth === 0) return
  imgNaturalSize.value = { w: img.naturalWidth, h: img.naturalHeight }

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
  startCrop = { x: 0, y: 0, w: 100, h: 100 },
  rafId: number | null = null

const handleStart = (e: MouseEvent | TouchEvent, mode: typeof dragMode.value) => {
  if (props.isHandMode) return
  if ('button' in e && e.button !== 0) return
  if ('altKey' in e && e.altKey) return

  if (e.cancelable) e.preventDefault()
  isDragging.value = true
  dragMode.value = mode
  const t = 'touches' in e ? e.touches[0] : e
  startX = t?.clientX ?? 0
  startY = t?.clientY ?? 0
  startCrop = { ...internalCrop.value }

  // P2-2：pointerdown 即上报拖拽开始，供宿主在移动发生前记录历史快照
  emit('drag-start')

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
    const rawDx = (cx - rect.left) / props.scale
    const rawDy = (cy - rect.top) / props.scale
    const centerX = rect.width / 2 / props.scale
    const centerY = rect.height / 2 / props.scale
    const offX = rawDx - centerX,
      offY = rawDy - centerY
    const { dx: rx, dy: ry } = getRotatedDelta(offX, offY)

    const nw = imgNaturalSize.value.w,
      nh = imgNaturalSize.value.h
    const px = Math.max(0, Math.min(100, (rx / nw + 0.5) * 100))
    const py = Math.max(0, Math.min(100, (ry / nh + 0.5) * 100))

    const dxRaw = (cx - startX) / props.scale
    const dyRaw = (cy - startY) / props.scale
    const { dx: deltaX, dy: deltaY } = getRotatedDelta(dxRaw, dyRaw)
    const dxPercent = (deltaX / nw) * 100,
      dyPercent = (deltaY / nh) * 100

    const n = { ...startCrop }
    let sH = false,
      sV = false
    const currentLines = { x: null as number | null, y: null as number | null }

    const snap = (val: number, targets: (number | undefined)[], axis: 'x' | 'y') => {
      if (alt) return val
      const threshold = (15 / props.scale / Math.max(nw, nh)) * 100
      for (const t of targets) {
        if (t === undefined) continue
        if (Math.abs(val - t) < threshold) {
          if (axis === 'x') {
            sH = true
            currentLines.x = t
          } else {
            sV = true
            currentLines.y = t
          }
          return t
        }
      }
      return val
    }

    if (dragMode.value === 'move') {
      const targetsX = [
        0,
        100,
        contentBounds.value?.x,
        (contentBounds.value?.x ?? 0) + (contentBounds.value?.w ?? 0)
      ]
      const targetsY = [
        0,
        100,
        contentBounds.value?.y,
        (contentBounds.value?.y ?? 0) + (contentBounds.value?.h ?? 0)
      ]

      const nx = snap(startCrop.x + dxPercent, targetsX, 'x')
      if (sH) {
        n.x = nx
      } else {
        const nr = snap(startCrop.x + startCrop.w + dxPercent, targetsX, 'x')
        n.x = nr - n.w
      }

      const ny = snap(startCrop.y + dyPercent, targetsY, 'y')
      if (sV) {
        n.y = ny
      } else {
        const nb = snap(startCrop.y + startCrop.h + dyPercent, targetsY, 'y')
        n.y = nb - n.h
      }

      n.x = Math.max(-50, Math.min(150 - n.w, n.x))
      n.y = Math.max(-50, Math.min(150 - n.h, n.y))
      activePercent.value = { x: px, y: py }
    } else {
      const mode = dragMode.value!
      const targetsX = [
        0,
        100,
        contentBounds.value?.x,
        (contentBounds.value?.x ?? 0) + (contentBounds.value?.w ?? 0)
      ]
      const targetsY = [
        0,
        100,
        contentBounds.value?.y,
        (contentBounds.value?.y ?? 0) + (contentBounds.value?.h ?? 0)
      ]

      if (mode.includes('n')) {
        n.y = snap(startCrop.y + dyPercent, targetsY, 'y')
        n.y = Math.min(n.y, startCrop.y + startCrop.h - 0.5)
        n.h = startCrop.h - (n.y - startCrop.y)
      }
      if (mode.includes('s')) {
        const nb = snap(startCrop.y + startCrop.h + dyPercent, targetsY, 'y')
        n.h = Math.max(0.5, nb - n.y)
      }
      if (mode.includes('w')) {
        n.x = snap(startCrop.x + dxPercent, targetsX, 'x')
        n.x = Math.min(n.x, startCrop.x + startCrop.w - 0.5)
        n.w = startCrop.w - (n.x - startCrop.x)
      }
      if (mode.includes('e')) {
        const nr = snap(startCrop.x + startCrop.w + dxPercent, targetsX, 'x')
        n.w = Math.max(0.5, nr - n.x)
      }

      if (props.aspectRatio) {
        const visualRatio = visualRatioFor(props.aspectRatio)
        if (mode === 'n' || mode === 's') n.w = n.h * visualRatio
        else n.h = n.w / visualRatio
      }
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

const magnifierStyle = computed(() => {
  if (!showMagnifier.value) return {}
  const { x, y } = activePercent.value
  const translateX = x > 50 ? '-125%' : '25%'
  const translateY = y < 50 ? '25%' : '-125%'

  return {
    left: x + '%',
    top: y + '%',
    transform: `translate(${translateX}, ${translateY}) scale(${1 / props.scale})`,
    transition: 'transform 0.15s ease-out'
  }
})

const handleEnd = () => {
  if (rafId) cancelAnimationFrame(rafId)
  isDragging.value = false
  isSnapping.value = false
  dragMode.value = null
  snapLines.value = { x: null, y: null }
  window.removeEventListener('mousemove', handleMove)
  window.removeEventListener('mouseup', handleEnd)
  window.removeEventListener('touchmove', handleMove)
  window.removeEventListener('touchend', handleEnd)
  // P2-2：拖拽结束上报最终状态，供宿主提交拖拽后的历史快照
  emit('drag-end')
}

onUnmounted(() => {
  if (rafId) cancelAnimationFrame(rafId)
  handleEnd()
})
</script>

<template>
  <div
    ref="containerRef"
    class="relative select-none touch-none flex items-center justify-center shadow-2xl rounded-sm overflow-visible"
    :style="containerStyle"
  >
    <div class="relative w-full h-full">
      <div
        v-if="props.fillColor !== 'transparent'"
        class="absolute inset-[-100%] z-0 pointer-events-none"
        :style="{ backgroundColor: props.fillColor }"
      ></div>

      <img
        ref="imgRef"
        :src="imageUrl"
        class="relative z-10 block rounded-sm pointer-events-none w-full h-full"
        @load="handleImageLoad"
      />

      <div class="absolute inset-0 pointer-events-none z-10 overflow-hidden">
        <Transition name="fade-fast">
          <div
            v-if="snapLines.x !== null"
            class="absolute h-full w-[1px] bg-primary shadow-[0_0_4px_rgba(var(--primary-rgb),0.8)]"
            :style="{ left: snapLines.x + '%' }"
          ></div>
        </Transition>
        <Transition name="fade-fast">
          <div
            v-if="snapLines.y !== null"
            class="absolute w-full h-[1px] bg-primary shadow-[0_0_4px_rgba(var(--primary-rgb),0.8)]"
            :style="{ top: snapLines.y + '%' }"
          ></div>
        </Transition>
      </div>

      <div v-if="imgNaturalSize.w > 0" class="absolute inset-0 z-20 pointer-events-none">
        <!-- 工业级遮罩系统 (接入设计系统背景色) -->
        <div class="absolute inset-0 z-0">
          <div
            class="absolute top-0 left-0 w-full bg-background/60 backdrop-blur-[1px]"
            :style="{ height: Math.max(0, internalCrop.y) + '%' }"
          ></div>
          <div
            class="absolute bottom-0 left-0 w-full bg-background/60 backdrop-blur-[1px]"
            :style="{ height: Math.max(0, 100 - (internalCrop.y + internalCrop.h)) + '%' }"
          ></div>
          <div
            class="absolute left-0 bg-background/60 backdrop-blur-[1px]"
            :style="{
              top: Math.max(0, internalCrop.y) + '%',
              height: Math.min(100, internalCrop.h + Math.min(0, internalCrop.y)) + '%',
              width: Math.max(0, internalCrop.x) + '%'
            }"
          ></div>
          <div
            class="absolute right-0 bg-background/60 backdrop-blur-[1px]"
            :style="{
              top: Math.max(0, internalCrop.y) + '%',
              height: Math.min(100, internalCrop.h + Math.min(0, internalCrop.y)) + '%',
              width: Math.max(0, 100 - (internalCrop.x + internalCrop.w)) + '%'
            }"
          ></div>
        </div>

        <div
          class="absolute border-2 border-primary cursor-move pointer-events-auto transition-colors duration-200"
          :class="{
            'border-primary/80 shadow-[0_0_15px_rgba(var(--primary-rgb),0.4)]': isSnapping
          }"
          :style="{
            left: internalCrop.x + '%',
            top: internalCrop.y + '%',
            width: internalCrop.w + '%',
            height: internalCrop.h + '%',
            willChange: isDragging ? 'left, top, width, height' : 'auto'
          }"
          @mousedown="handleStart($event, 'move')"
          @dblclick="emit('reset')"
        >
          <!-- 构图参考线 (使用主题前景色增强对比) -->
          <div
            v-if="gridMode !== 'none'"
            class="absolute inset-0 pointer-events-none transition-all duration-500"
            :class="isDragging ? 'opacity-100' : 'opacity-20'"
          >
            <div v-if="gridMode === 'thirds'" class="absolute inset-0 grid grid-cols-3 grid-rows-3">
              <div
                v-for="i in 9"
                :key="i"
                class="relative border-[0.5px] border-foreground/30 shadow-[0_0_1px_hsla(var(--background)/0.5)]"
              >
                <div
                  v-if="[1, 2, 4, 5].includes(i)"
                  class="absolute -right-1.5 -bottom-1.5 w-3 h-3 flex items-center justify-center"
                >
                  <div
                    class="w-1.5 h-1.5 bg-primary rounded-full shadow-[0_0_4px_rgba(var(--primary-rgb),0.6)]"
                  ></div>
                </div>
              </div>
            </div>
            <div v-if="gridMode === 'golden'" class="absolute inset-0">
              <div
                v-for="y in ['38.2%', '61.8%']"
                :key="y"
                class="absolute w-full h-[1px] bg-foreground/30 shadow-[0_0.5px_1px_hsla(var(--background)/0.5)]"
                :style="{ top: y }"
              ></div>
              <div
                v-for="x in ['38.2%', '61.8%']"
                :key="x"
                class="absolute h-full w-[1px] bg-foreground/30 shadow-[0.5px_0_1px_hsla(var(--background)/0.5)]"
                :style="{ left: x }"
              ></div>
            </div>
          </div>

          <!-- 手柄 (逆向缩放) -->
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
              class="m-auto w-3 h-3 bg-foreground border-2 border-primary rounded-sm shadow-xl transition-all group-hover/handle:scale-125"
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
              class="m-auto bg-foreground border border-primary/50 rounded-full shadow-md group-hover/handle:bg-primary"
            ></div>
          </div>
        </div>
      </div>
    </div>

    <!-- 专业放大镜 (规范化材质) -->
    <div
      v-if="showMagnifier"
      class="absolute z-50 w-40 h-40 rounded-full border-[4px] border-foreground shadow-2xl pointer-events-none overflow-hidden bg-background flex flex-col"
      :style="magnifierStyle"
    >
      <div class="relative flex-1">
        <div
          class="absolute inset-0"
          :style="{
            backgroundImage: `url(${imageUrl})`,
            backgroundPosition: magnifierBgPos,
            backgroundSize: `${imgNaturalSize.w * 2}px ${imgNaturalSize.h * 2}px`,
            backgroundRepeat: 'no-repeat',
            transform: `rotate(${props.rotation}deg) scaleX(${props.flipH ? -1 : 1}) scaleY(${props.flipV ? -1 : 1})`,
            transformOrigin: 'center center'
          }"
        ></div>
        <div v-if="magnifierCropLines" :style="magnifierCropLines"></div>
        <div class="absolute inset-0 flex items-center justify-center z-20">
          <div
            class="w-2.5 h-2.5 border-[1.5px] border-primary rounded-full shadow-[0_0_0_1px_rgba(var(--primary-rgb),0.4)] bg-primary/5"
          ></div>
          <div
            class="absolute w-full h-[0.5px] bg-primary/90 shadow-[0_0.5px_0_rgba(var(--primary-rgb),0.3)]"
          ></div>
          <div
            class="absolute h-full w-[0.5px] bg-primary/90 shadow-[0.5px_0_0_rgba(var(--primary-rgb),0.3)]"
          ></div>
        </div>
        <div
          class="absolute bottom-3 left-1/2 -translate-x-1/2 z-30 px-2 py-0.5 bg-background/70 backdrop-blur-md rounded-full border border-[var(--hairline)] flex items-center gap-1.5 shadow-xl"
        >
          <div
            class="w-1 h-1 rounded-full"
            :class="isSnapping ? 'bg-primary animate-pulse' : 'bg-foreground/20'"
          ></div>
          <span class="text-[8px] text-foreground font-black tracking-widest uppercase italic">{{
            isSnapping ? t('tools.crop.magnetic') : t('tools.crop.precision')
          }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.relative {
  transition-property: transform, width, height;
}

:not(.is-dragging) > .relative,
:not(.is-dragging).absolute {
  transition-duration: 500ms;
  transition-timing-function: cubic-bezier(0.34, 1.56, 0.64, 1);
}

.is-dragging .relative,
.is-dragging .absolute {
  transition: none !important;
}

img,
.absolute {
  backface-visibility: hidden;
  transform-style: preserve-3d;
}

.fade-fast-enter-active,
.fade-fast-leave-active {
  transition: opacity 0.15s ease-out;
}
.fade-fast-enter-from,
.fade-fast-leave-to {
  opacity: 0;
}
</style>
