<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { useResizeObserver, useEventListener } from '@vueuse/core'
import AppModal from './common/AppModal.vue'
import AppButton from './common/AppButton.vue'
import { Undo2, Redo2, ZoomIn, ZoomOut, Maximize } from 'lucide-vue-next'

const props = defineProps<{
  show: boolean
  imageItem: { id: string; file: File; url: string }
}>()

const emit = defineEmits(['close', 'apply'])
const { t } = useI18n()

// 状态管理
const isLoading = ref(true)
const statusMessage = ref(t('common.modal.interactive.connecting'))
const isEncoding = ref(false)
const points = ref<{ x: number; y: number; label: number }[]>([])
const maskUrl = ref<string | null>(null)
const imageRef = ref<HTMLImageElement | null>(null)
const viewportRef = ref<HTMLElement | null>(null)

// 历史记录栈用于撤销/重做
type Point = { x: number; y: number; label: number }
const historyPast = ref<Point[][]>([])
const historyFuture = ref<Point[][]>([])

// --- 平移逻辑 (Pan Logic) ---
const isSpacePressed = ref(false)
const isPanning = ref(false)
const panStart = ref({ x: 0, y: 0, scrollLeft: 0, scrollTop: 0 })

const handlePointerDown = (e: PointerEvent) => {
  if (isSpacePressed.value) {
    const container = document.getElementById('sam2-zoom-container')
    if (!container) return
    isPanning.value = true
    panStart.value = {
      x: e.clientX,
      y: e.clientY,
      scrollLeft: container.scrollLeft,
      scrollTop: container.scrollTop
    }
    // 防止触发图片选择等
    container.setPointerCapture(e.pointerId)
  }
}

const handlePointerMove = (e: PointerEvent) => {
  if (isPanning.value) {
    const container = document.getElementById('sam2-zoom-container')
    if (!container) return
    const dx = e.clientX - panStart.value.x
    const dy = e.clientY - panStart.value.y
    container.scrollLeft = panStart.value.scrollLeft - dx
    container.scrollTop = panStart.value.scrollTop - dy
  }
}

const handlePointerUp = (e: PointerEvent) => {
  if (isPanning.value) {
    isPanning.value = false
    const container = document.getElementById('sam2-zoom-container')
    container?.releasePointerCapture(e.pointerId)
  }
}

// 实时计算图片的物理显示矩形 (Display Rect)
const displayRect = ref({ width: 0, height: 0, left: 0, top: 0 })

// 监听尺寸变化
useResizeObserver(viewportRef, () => updateDisplayRect())
useEventListener(window, 'resize', () => updateDisplayRect())

// 快捷键监听
useEventListener(window, 'keydown', (e: KeyboardEvent) => {
  if (!props.show) return

  // 拦截空格键用于平移模式
  if (e.code === 'Space') {
    if (!isSpacePressed.value) isSpacePressed.value = true
    // 防止页面滚动
    if ((e.target as HTMLElement).tagName !== 'INPUT') {
      e.preventDefault()
    }
    return
  }

  if (isLoading.value || isEncoding.value) return
  if (e.ctrlKey && e.key.toLowerCase() === 'z') {
    e.preventDefault()
    if (e.shiftKey) {
      redo()
    } else {
      undo()
    }
  } else if (e.ctrlKey && e.key.toLowerCase() === 'y') {
    e.preventDefault()
    redo()
  }
})

useEventListener(window, 'keyup', (e: KeyboardEvent) => {
  if (e.code === 'Space') {
    isSpacePressed.value = false
    isPanning.value = false
  }
})

// Worker 引用
let worker: Worker | null = null

// 初始化 Worker
const initWorker = () => {
  // P2-16: 重复打开模态框会反复创建 Worker，先终止上一个实例防止线程与显存泄漏
  if (worker) {
    worker.terminate()
    worker = null
  }

  // 滚动至中心
  nextTick(() => {
    const container = document.getElementById('sam2-zoom-container')
    if (container) {
      container.scrollLeft = (container.scrollWidth - container.clientWidth) / 2
      container.scrollTop = (container.scrollHeight - container.clientHeight) / 2
    }
  })

  import('../lib/engines/sam2.worker?worker').then((WorkerModule) => {
    worker = new WorkerModule.default()

    // 主动触发模型加载
    worker.postMessage({ type: 'load' })

    worker!.onmessage = (e) => {
      const { type, message, maskUrl: newMaskUrl } = e.data

      switch (type) {
        case 'status':
          // 这里的 message 如果是内置状态字符串，可能需要映射
          statusMessage.value = message
          break
        case 'ready':
          isLoading.value = false
          startEncoding()
          break
        case 'encoded':
          isEncoding.value = false
          statusMessage.value = t('common.modal.interactive.readyTip')
          break
        case 'mask':
          if (maskUrl.value) URL.revokeObjectURL(maskUrl.value)
          maskUrl.value = newMaskUrl
          break
        case 'error':
          console.error('[SAM2 Editor] Error:', message)
          statusMessage.value = `${t('common.modal.interactive.error')}: ${message}`
          break
      }
    }
  })
}

const startEncoding = () => {
  if (!props.imageItem.file) return
  isEncoding.value = true
  worker?.postMessage({
    type: 'encode',
    data: { blob: props.imageItem.file }
  })
}

// 交互逻辑：精确计算相对于图片像素的归一化坐标
const handleCanvasClick = (e: MouseEvent) => {
  if (isLoading.value || isEncoding.value || isSpacePressed.value) return

  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect()

  // 此时 e.currentTarget 已经是物理锁定层，坐标计算极其简单
  const x = (e.clientX - rect.left) / rect.width
  const y = (e.clientY - rect.top) / rect.height

  // 边界检查
  if (x < 0 || x > 1 || y < 0 || y > 1) return

  // 保存历史记录
  historyPast.value.push([...points.value])
  // P2-16: 撤销栈上限 50，防止长会话无界增长
  if (historyPast.value.length > 50) historyPast.value.shift()
  historyFuture.value = []

  // 左键正向(1)，右键负向(0)
  const label = e.button === 2 ? 0 : 1

  points.value.push({ x, y, label })
  triggerDecode()
}

const triggerDecode = () => {
  const pts = points.value.map((p) => [p.x, p.y])
  const lbls = points.value.map((p) => p.label)

  worker?.postMessage({
    type: 'decode',
    data: { points: pts, labels: lbls }
  })
}

const undo = () => {
  if (!historyPast.value.length || isLoading.value || isEncoding.value) return
  historyFuture.value.push([...points.value])
  points.value = historyPast.value.pop()!
  if (points.value.length > 0) {
    triggerDecode()
  } else {
    // 撤销到空点：logits 停留在旧状态会导致下一次推理基于旧会话，
    // 与 resetPoints 保持一致，通知 Worker 重置累积式分割会话
    worker?.postMessage({ type: 'reset' })
    clearMask()
  }
}

const redo = () => {
  if (!historyFuture.value.length || isLoading.value || isEncoding.value) return
  historyPast.value.push([...points.value])
  points.value = historyFuture.value.pop()!
  triggerDecode()
}

const clearMask = () => {
  if (maskUrl.value) URL.revokeObjectURL(maskUrl.value)
  maskUrl.value = null
}

const resetPoints = () => {
  if (points.value.length > 0) {
    historyPast.value.push([...points.value])
    // P2-16: 撤销栈上限 50
    if (historyPast.value.length > 50) historyPast.value.shift()
    historyFuture.value = []
  }
  points.value = []
  // 通知 Worker 同步清除历史 logit，下次点击将从零开始推理
  worker?.postMessage({ type: 'reset' })
  clearMask()
}

// --- 缩放逻辑 (Zoom Logic) ---
const zoom = ref(1) // 这里的 1 代表 100% 原生尺寸
const initialZoom = ref(1) // 存储“最佳贴合”时的缩放倍率

const updateDisplayRect = () => {
  if (!imageRef.value || !viewportRef.value) return

  const img = imageRef.value
  const viewport = viewportRef.value
  const vw = viewport.clientWidth - 64 // 预留 padding 空间
  const vh = viewport.clientHeight - 64
  const nw = img.naturalWidth
  const nh = img.naturalHeight

  if (!nw || !nh) return

  // 计算“最佳贴合窗口”的缩放倍率
  const fitZoom = Math.min(vw / nw, vh / nh, 1) // 不自动放大过小的图，最大贴合倍率为 1
  initialZoom.value = fitZoom

  // 如果是第一次加载或重置，应用最佳贴合
  if (zoom.value === 1 && !historyPast.value.length) {
    zoom.value = fitZoom
  }

  displayRect.value = {
    width: nw,
    height: nh,
    left: 0,
    top: 0
  }
}

const handleWheel = (e: WheelEvent) => {
  if (e.ctrlKey || e.metaKey) {
    e.preventDefault()
    const zoomContainer = document.getElementById('sam2-zoom-container')
    if (!zoomContainer) return

    const rect = zoomContainer.getBoundingClientRect()
    const mouseX = e.clientX - rect.left
    const mouseY = e.clientY - rect.top
    const scrollX = zoomContainer.scrollLeft + mouseX
    const scrollY = zoomContainer.scrollTop + mouseY

    // 缩放步进：更细腻的滚轮反馈
    const delta = e.deltaY > 0 ? 0.9 : 1.1
    let newZoom = zoom.value * delta
    newZoom = Math.max(0.05, Math.min(newZoom, 10))

    if (newZoom === zoom.value) return

    const scaleRatio = newZoom / zoom.value
    zoom.value = newZoom

    nextTick(() => {
      zoomContainer.scrollLeft = scrollX * scaleRatio - mouseX
      zoomContainer.scrollTop = scrollY * scaleRatio - mouseY
    })
  }
}

const zoomIn = () => {
  zoom.value = Math.min(zoom.value * 1.2, 10)
}

const zoomOut = () => {
  zoom.value = Math.max(zoom.value * 0.8, 0.05)
}

// 对应名词：1:1
const setOneToOne = () => {
  zoom.value = 1
}

// 对应名词：最佳贴合窗口
const setFitToWindow = () => {
  zoom.value = initialZoom.value
}

// P2-16: 应用遮罩的防重复 guard——fetch 期间重复点击会并发导出同一遮罩，
// 用 isApplying 锁住入口，AppButton loading 态同时提供视觉反馈。
const isApplying = ref(false)

const handleApply = async () => {
  if (!maskUrl.value || isApplying.value) return
  isApplying.value = true
  try {
    const res = await fetch(maskUrl.value)
    const blob = await res.blob()
    emit('apply', blob)
  } finally {
    isApplying.value = false
  }
}

onMounted(() => {
  if (props.show) initWorker()
})

onUnmounted(() => {
  if (maskUrl.value) URL.revokeObjectURL(maskUrl.value)
  worker?.terminate()
})

watch(
  () => props.show,
  (newVal) => {
    if (newVal) {
      // 打开时彻底清空记录
      historyPast.value = []
      historyFuture.value = []
      points.value = []
      clearMask()
      initWorker()
    } else {
      // 退出清理
    }
  }
)
</script>

<template>
  <AppModal
    :show="show"
    pane-only
    :title="t('common.modal.interactive.title')"
    @close="emit('close')"
  >
    <div class="flex-1 flex flex-col bg-[var(--product)] select-none overflow-hidden min-h-0">
      <!-- 顶部工具栏 -->
      <div class="h-14 border-b border-white/5 flex items-center justify-between px-4 shrink-0">
        <div class="flex items-center gap-4">
          <div
            class="flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-full border border-primary/20"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></span>
            <span class="text-[10px] font-bold text-primary uppercase">{{ statusMessage }}</span>
          </div>
          <button
            v-if="points.length > 0"
            class="text-xs text-white/40 hover:text-white transition-colors"
            @click="resetPoints"
            :title="t('common.modal.interactive.clear')"
          >
            {{ t('common.modal.interactive.clearAll') }}
          </button>

          <div class="h-4 w-px bg-white/10 mx-2"></div>

          <div class="flex items-center gap-1.5">
            <button
              class="p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-white/40 transition-colors"
              :title="t('common.modal.interactive.undo')"
              :disabled="!historyPast.length"
              @click="undo"
            >
              <Undo2 :size="16" />
            </button>
            <button
              class="p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/10 disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-white/40 transition-colors"
              :title="t('common.modal.interactive.redo')"
              :disabled="!historyFuture.length"
              @click="redo"
            >
              <Redo2 :size="16" />
            </button>
          </div>

          <div class="h-4 w-px bg-white/10 mx-2"></div>

          <div class="flex items-center gap-1.5">
            <button
              class="p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-colors"
              :title="t('common.modal.interactive.zoomOut')"
              :aria-label="t('common.modal.interactive.zoomOut')"
              @click="zoomOut"
            >
              <ZoomOut :size="16" />
            </button>
            <span class="text-[11px] font-mono text-white/60 w-12 text-center select-none"
              >{{ Math.round(zoom * 100) }}%</span
            >
            <button
              class="p-1.5 rounded-md text-white/40 hover:text-white hover:bg-white/10 transition-colors"
              :title="t('common.modal.interactive.zoomIn')"
              :aria-label="t('common.modal.interactive.zoomIn')"
              @click="zoomIn"
            >
              <ZoomIn :size="16" />
            </button>
            <div class="h-4 w-px bg-white/10 mx-1"></div>
            <button
              class="px-2 py-1 rounded-md text-[10px] font-bold transition-colors"
              :class="
                zoom === 1
                  ? 'bg-primary/20 text-primary'
                  : 'text-white/40 hover:text-white hover:bg-white/10'
              "
              :title="t('common.modal.interactive.zoomOne')"
              :aria-label="t('common.modal.interactive.zoomOne')"
              @click="setOneToOne"
            >
              1:1
            </button>
            <button
              class="p-1.5 rounded-md transition-colors"
              :class="
                Math.abs(zoom - initialZoom) < 0.01
                  ? 'bg-primary/20 text-primary'
                  : 'text-white/40 hover:text-white hover:bg-white/10'
              "
              :title="t('common.modal.interactive.zoomFit')"
              :aria-label="t('common.modal.interactive.zoomFit')"
              @click="setFitToWindow"
            >
              <Maximize :size="16" />
            </button>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <AppButton variant="ghost" size="sm" @click="emit('close')">{{
            t('common.image.toolbar.cancel')
          }}</AppButton>
          <AppButton
            variant="primary"
            size="sm"
            :disabled="!maskUrl || isApplying"
            :loading="isApplying"
            @click="handleApply"
          >
            {{ t('common.modal.interactive.apply') }}
          </AppButton>
        </div>
      </div>

      <!-- 图片核心展示区：强制缩放约束 -->
      <div
        ref="viewportRef"
        class="flex-1 relative min-h-0 bg-[#0a0a0a] group overflow-hidden"
        @contextmenu.prevent
      >
        <div
          id="sam2-zoom-container"
          class="absolute inset-0 overflow-auto custom-scrollbar transition-all duration-200"
          :class="[
            isSpacePressed && !isPanning ? 'cursor-grab' : '',
            isPanning ? 'cursor-grabbing' : ''
          ]"
          @wheel="handleWheel"
          @pointerdown="handlePointerDown"
          @pointermove="handlePointerMove"
          @pointerup="handlePointerUp"
          @pointerleave="handlePointerUp"
        >
          <!-- 比例容器：提供一个至少两倍于视口的背景区域，确保图片始终可以自由移动 -->
          <div
            class="relative flex items-center justify-center p-[50vh] min-w-max min-h-max"
            style="width: fit-content; height: fit-content"
          >
            <!-- 物理交互层：宽高受 zoom 驱动，必须解除 max-width 限制防止变形 -->
            <div
              class="relative shadow-[0_0_100px_rgba(0,0,0,0.8)] shrink-0 max-w-none max-h-none"
              :class="isSpacePressed ? '' : 'cursor-crosshair'"
              :style="{
                width: displayRect.width ? `${displayRect.width * zoom}px` : 'auto',
                height: displayRect.height ? `${displayRect.height * zoom}px` : 'auto'
              }"
              @mousedown="handleCanvasClick"
            >
              <!-- 核心图像：确保不被父容器挤压 -->
              <img
                ref="imageRef"
                :src="imageItem.url"
                class="w-full h-full block select-none pointer-events-none rounded-sm border border-white/5 max-w-none max-h-none"
                :alt="t('common.modal.interactive.altTarget')"
                @load="updateDisplayRect"
              />

              <!-- 动态生成的遮罩层 (Blue Tint) -->
              <img
                v-if="maskUrl"
                :src="maskUrl"
                class="absolute inset-0 w-full h-full pointer-events-none mix-blend-screen opacity-70"
                style="
                  filter: invert(33%) sepia(90%) saturate(2000%) hue-rotate(190deg) brightness(100%)
                    contrast(120%);
                "
              />

              <!-- 交互锚点层 -->
              <div
                v-for="(p, i) in points"
                :key="i"
                class="absolute w-4 h-4 -ml-2 -mt-2 rounded-full border-2 border-[var(--on-product)] flex items-center justify-center pointer-events-none z-20"
                :class="p.label === 1 ? 'bg-[var(--accent)]' : 'bg-[var(--danger)]'"
                :style="{ left: p.x * 100 + '%', top: p.y * 100 + '%' }"
              ></div>
            </div>
          </div>
        </div>

        <!-- 悬浮指令提示板 (恢复) -->
        <div
          class="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-6 px-6 py-2 bg-[var(--product)] rounded-[var(--radius-ctrl)] border border-[var(--hairline)] text-[10px] font-medium text-[var(--on-product)]/70 pointer-events-none"
        >
          <div class="flex items-center gap-2">
            <span class="text-[var(--accent)]">{{ t('common.modal.interactive.leftClick') }}</span>
            <span class="text-[var(--on-product)]/25">/</span>
            <span>{{ t('common.modal.interactive.add') }}</span>
          </div>
          <div class="flex items-center gap-2">
            <span class="text-[var(--danger)]">{{ t('common.modal.interactive.rightClick') }}</span>
            <span class="text-[var(--on-product)]/25">/</span>
            <span>{{ t('common.modal.interactive.remove') }}</span>
          </div>
        </div>
      </div>
    </div>
  </AppModal>
</template>
