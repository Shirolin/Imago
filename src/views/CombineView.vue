<script setup lang="ts">
import { ref, computed, nextTick, watch, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { useImageStore, type ImageItem } from '../stores/imageStore'
import { useResizeObserver } from '@vueuse/core'
import WorkspaceLayout from '../components/layout/WorkspaceLayout.vue'
import AppButton from '../components/common/AppButton.vue'
import AppCanvasWorkspace from '../components/common/AppCanvasWorkspace.vue'
import AppExportSettings from '../components/common/AppExportSettings.vue'
import {
  Layers,
  Settings2,
  ArrowDown,
  ArrowRight,
  Grid3X3,
  AlignLeft,
  AlignCenter,
  Box,
  AlignRight,
  AlignStartVertical,
  AlignCenterVertical,
  AlignEndVertical,
  AlertCircle,
  Plus,
  ArrowUp,
  Trash2,
  Loader2
} from 'lucide-vue-next'
import ImageSelectionStatus from '../components/common/ImageSelectionStatus.vue'
import ImageActionsToolbar from '../components/common/ImageActionsToolbar.vue'
import AppSectionHeader from '../components/common/AppSectionHeader.vue'
import AppSegmentedControl from '../components/common/AppSegmentedControl.vue'
import AppSlider from '../components/common/AppSlider.vue'
import AppColorPicker from '../components/common/AppColorPicker.vue'
import { combineEngine } from '../lib/engines/combineEngine'
import { useImageProcessor } from '../composables/useImageProcessor'
import { useFileHelpers } from '../composables/useFileHelpers'
import type { ProcessResult } from '../lib/engines/types'

import InspectorFooter from '../components/layout/InspectorFooter.vue'

const store = useImageStore()
const { downloadImage, triggerFileInput } = useFileHelpers()
const { t } = useI18n()

// 状态
const srMessage = ref('')
// P1-1：拼接失败可见错误（复用引擎错误消息，不新增 i18n 键）
const combineError = ref('')
// P1-3：托盘排序被强制回锁时的可见提示
const sortOrderNotice = ref('')
let sortNoticeTimer: ReturnType<typeof setTimeout> | undefined

// 【打磨】：触感反馈辅助函数
const triggerHaptic = (intensity = 5) => {
  if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
    window.navigator.vibrate(intensity)
  }
}

// 视口引擎
const workspaceRef = ref<InstanceType<typeof AppCanvasWorkspace> | null>(null)
const containerRef = computed(() => workspaceRef.value?.containerRef)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const isInitialLoad = ref(true)

const { isProcessing, processCombine, abortProcessing } = useImageProcessor(combineEngine)

// 配置状态
const combineDirection = ref<'vertical' | 'horizontal' | 'grid'>('vertical')
const layoutMode = ref<'smart' | 'original'>('smart')
const alignment = ref<'start' | 'center' | 'end'>('center')
const spacing = ref(0)
const columns = ref(3)
const padding = ref(0)
const borderRadius = ref(0)
const backgroundColor = ref('transparent')
const outputFormat = ref<string>('image/png')
const outputQuality = ref(0.9)

// 预览用降采样位图缓存（最长边 ~2048）：不缓存全尺寸解码图（4000×3000 ≈ 48MB/张），
// 每次重绘只把 ~2048 小图 drawImage 到预览画布，采样与显存开销约降 4 倍；
// 导出路径（combineEngine）仍用原始文件全尺寸，两者分离互不影响（P1-6 预览性能）
const thumbCache = new Map<string, HTMLImageElement | ImageBitmap>()
// 同一图片并发解码去重：拖动参数时多次 requestDraw 可能同时触发首次加载
const pendingThumbLoads = new Map<string, Promise<HTMLImageElement | ImageBitmap>>()
const THUMB_MAX_SIDE = 2048
// 解码失败的预览图 id（P0-1：失败图片标记错误态而非永久挂起）
const previewErrorIds = ref<Set<string>>(new Set())
let isDrawingRaf = false
let pendingDraw = false

const closeBitmap = (src: HTMLImageElement | ImageBitmap) => {
  if (src instanceof ImageBitmap) src.close()
}

// createImageBitmap 不可用（如 HEIC/SVG）时退回 HTMLImageElement 全尺寸解码
const loadFullImage = (imgData: ImageItem): Promise<HTMLImageElement> => {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => {
      // P0-1：不可解码图片必须 reject，否则 Promise.all 会永久挂起
      reject(new Error(`图片预览加载失败: ${imgData.file.name}`))
    }
    img.src = imgData.preview
  })
}

const loadPreviewImage = (imgData: ImageItem): Promise<HTMLImageElement | ImageBitmap> => {
  const cached = thumbCache.get(imgData.id)
  if (cached) return Promise.resolve(cached)
  const pending = pendingThumbLoads.get(imgData.id)
  if (pending) return pending

  const promise = (async (): Promise<HTMLImageElement | ImageBitmap> => {
    const srcW = imgData.width || 0
    const srcH = imgData.height || 0
    // 等比降采样：createImageBitmap 一次性按最长边 ~2048 解码，后续重绘零重采样成本
    if (srcW > THUMB_MAX_SIDE || srcH > THUMB_MAX_SIDE) {
      const scale = THUMB_MAX_SIDE / Math.max(srcW, srcH)
      try {
        return await createImageBitmap(imgData.file, {
          resizeWidth: Math.max(1, Math.round(srcW * scale)),
          resizeHeight: Math.max(1, Math.round(srcH * scale)),
          resizeQuality: 'medium'
        })
      } catch {
        // 降采样失败 → 退回全尺寸解码（保功能）
      }
    }
    try {
      return await createImageBitmap(imgData.file)
    } catch {
      // createImageBitmap 整体不可用 → 退回 HTMLImageElement（原行为）
      return loadFullImage(imgData)
    }
  })()

  pendingThumbLoads.set(imgData.id, promise)
  // 缓存结果；解码期间图片被移除则丢弃缓存，防已删除图片的位图残留
  void promise.then(
    (src) => {
      pendingThumbLoads.delete(imgData.id)
      if (store.images.some((img) => img.id === imgData.id)) thumbCache.set(imgData.id, src)
    },
    () => pendingThumbLoads.delete(imgData.id)
  )
  return promise
}

// 预览失败提示（复用引擎错误消息的中文风格，不新增 i18n 键）
const previewErrorText = computed(() => {
  if (previewErrorIds.value.size === 0) return ''
  const names = store.images
    .filter((img) => previewErrorIds.value.has(img.id))
    .map((img) => img.file.name)
  return names.length > 0 ? `部分图片无法预览，已跳过: ${names.join('、')}` : ''
})

const drawPreview = async () => {
  const canvas = canvasRef.value
  const ctx = canvas?.getContext('2d')
  if (!canvas || !ctx || store.images.length === 0) return

  // P0-1：Promise.allSettled 隔离解码失败的图片，单张失败不卡死整块画布
  const settled = await Promise.allSettled(store.images.map(loadPreviewImage))
  const loadedImages: (HTMLImageElement | ImageBitmap)[] = []
  const failedIds = new Set<string>()
  store.images.forEach((item, i) => {
    const r = settled[i]
    if (r && r.status === 'fulfilled') loadedImages.push(r.value)
    else failedIds.add(item.id)
  })
  previewErrorIds.value = failedIds

  // 全部解码失败：清空画布，仅保留可见错误提示
  if (loadedImages.length === 0) {
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    return
  }

  const maxWidth = Math.max(...loadedImages.map((img) => img.width))
  const maxHeight = Math.max(...loadedImages.map((img) => img.height))

  let totalWidth = 0
  let totalHeight = 0
  let cols = 1
  let rows = 1

  const drawInfos: { x: number; y: number; w: number; h: number }[] = []

  if (combineDirection.value === 'vertical') {
    let currentY = padding.value
    loadedImages.forEach((img) => {
      let drawW = img.width
      let drawH = img.height
      let drawX = padding.value

      if (layoutMode.value === 'smart') {
        drawW = maxWidth
        drawH = img.height * (maxWidth / img.width)
      } else {
        if (alignment.value === 'center') drawX = padding.value + (maxWidth - img.width) / 2
        else if (alignment.value === 'end') drawX = padding.value + maxWidth - img.width
      }

      drawInfos.push({ x: drawX, y: currentY, w: drawW, h: drawH })
      currentY += drawH + spacing.value
    })
    totalWidth = maxWidth
    totalHeight = currentY - spacing.value - padding.value
  } else if (combineDirection.value === 'horizontal') {
    let currentX = padding.value
    loadedImages.forEach((img) => {
      let drawW = img.width
      let drawH = img.height
      let drawY = padding.value

      if (layoutMode.value === 'smart') {
        drawH = maxHeight
        drawW = img.width * (maxHeight / img.height)
      } else {
        if (alignment.value === 'center') drawY = padding.value + (maxHeight - img.height) / 2
        else if (alignment.value === 'end') drawY = padding.value + maxHeight - img.height
      }

      drawInfos.push({ x: currentX, y: drawY, w: drawW, h: drawH })
      currentX += drawW + spacing.value
    })
    totalWidth = currentX - spacing.value - padding.value
    totalHeight = maxHeight
  } else {
    cols = columns.value || Math.ceil(Math.sqrt(loadedImages.length))
    rows = Math.ceil(loadedImages.length / cols)
    const cellW = maxWidth
    const cellH = maxHeight

    loadedImages.forEach((img, i) => {
      const r = Math.floor(i / cols)
      const c = i % cols
      let drawW = img.width
      let drawH = img.height
      let offsetX = 0
      let offsetY = 0

      if (layoutMode.value === 'smart') {
        const ratio = Math.max(cellW / img.width, cellH / img.height)
        drawW = img.width * ratio
        drawH = img.height * ratio
        offsetX = (cellW - drawW) / 2
        offsetY = (cellH - drawH) / 2
      } else {
        if (alignment.value === 'center') {
          offsetX = (cellW - img.width) / 2
          offsetY = (cellH - img.height) / 2
        } else if (alignment.value === 'end') {
          offsetX = cellW - img.width
          offsetY = cellH - img.height
        }
      }

      const x = padding.value + c * (cellW + spacing.value) + offsetX
      const y = padding.value + r * (cellH + spacing.value) + offsetY
      drawInfos.push({ x, y, w: drawW, h: drawH })
    })

    totalWidth = cols * cellW + (cols - 1) * spacing.value
    totalHeight = rows * cellH + (rows - 1) * spacing.value
  }

  const finalW = totalWidth + padding.value * 2
  const finalH = totalHeight + padding.value * 2

  // P1-5：预览降采样 —— 超大拼接（如 6000x80000）不撑爆预览画布，
  // 同时降低每次重绘的像素开销，保证拖动参数时界面可用
  const MAX_PREVIEW_SIDE = 8192
  const previewScale = Math.min(1, MAX_PREVIEW_SIDE / finalW, MAX_PREVIEW_SIDE / finalH)
  const scaledW = Math.max(1, Math.round(finalW * previewScale))
  const scaledH = Math.max(1, Math.round(finalH * previewScale))

  const sizeChanged = canvas.width !== scaledW || canvas.height !== scaledH
  if (sizeChanged) {
    canvas.width = scaledW
    canvas.height = scaledH

    // 【核心修复】：如果是初始加载或重大属性变化，执行 AutoFit
    if (isInitialLoad.value) {
      nextTick(() => {
        workspaceRef.value?.triggerAutoFit(scaledW, scaledH, 80, false)
        isInitialLoad.value = false
      })
    }
  }

  // 画布尺寸赋值会重置变换，这里幂等应用预览缩放；背景填充覆盖整个画布
  ctx.setTransform(previewScale, 0, 0, previewScale, 0, 0)
  ctx.clearRect(0, 0, Math.ceil(scaledW / previewScale), Math.ceil(scaledH / previewScale))
  if (backgroundColor.value !== 'transparent') {
    ctx.fillStyle = backgroundColor.value
    ctx.fillRect(0, 0, Math.ceil(scaledW / previewScale), Math.ceil(scaledH / previewScale))
  }

  loadedImages.forEach((img, i) => {
    const { x, y, w, h } = drawInfos[i]!
    ctx.save()

    // 网格裁剪
    if (combineDirection.value === 'grid' && layoutMode.value === 'smart') {
      const r = Math.floor(i / cols)
      const c = i % cols
      ctx.beginPath()
      ctx.rect(
        padding.value + c * (maxWidth + spacing.value),
        padding.value + r * (maxHeight + spacing.value),
        maxWidth,
        maxHeight
      )
      ctx.clip()
    }

    if (borderRadius.value > 0) {
      ctx.beginPath()
      if (ctx.roundRect) ctx.roundRect(x, y, w, h, borderRadius.value)
      else ctx.rect(x, y, w, h)
      ctx.clip()
    }
    ctx.drawImage(img, x, y, w, h)
    ctx.restore()
  })
}

const requestDraw = () => {
  // P1-5：rAF 合并重绘；绘制期间收到的新请求合并为一次（pendingDraw），
  // 拖动参数时每帧至多重绘一次，避免同步阻塞
  if (isDrawingRaf) {
    pendingDraw = true
    return
  }
  isDrawingRaf = true
  requestAnimationFrame(() => {
    drawPreview()
      .catch(() => {
        /* 预览绘制异常不打断后续重绘 */
      })
      .finally(() => {
        isDrawingRaf = false
        if (pendingDraw) {
          pendingDraw = false
          requestDraw()
        }
      })
  })
}

onMounted(() => {
  // P1-3：拼接顺序依赖导入顺序（预览与引擎均按 store.images 绘制），
  // 进入视图时锁定托盘排序，保证「托盘顺序 == 拼接顺序」
  store.sortMode = 'upload'
  requestDraw()
})

onUnmounted(() => {
  if (sortNoticeTimer) clearTimeout(sortNoticeTimer)
  // 释放预览降采样位图（ImageBitmap 需显式 close 才能回收显存/内存）
  thumbCache.forEach(closeBitmap)
  thumbCache.clear()
})

// 监听图片列表变化，如果有图片被删除，强制重置拼接结果以防过期
watch(
  () => store.images.length,
  (newLen, oldLen) => {
    if (newLen < oldLen) {
      combineError.value = ''
    }
  }
)

// 分离 Watch 逻辑：重大变化触发 AutoFit，微调触发重绘
watch([() => store.images.length, combineDirection, layoutMode], (newValues, oldValues) => {
  isInitialLoad.value = true
  if (oldValues) triggerHaptic(10)
  requestDraw()
  combineError.value = ''
})

watch([alignment, spacing, columns, padding, borderRadius, backgroundColor], () => {
  requestDraw()
  combineError.value = ''
})

watch(
  () => store.images.map((img) => img.id),
  (newIds) => {
    const idSet = new Set(newIds)
    for (const id of thumbCache.keys()) {
      if (!idSet.has(id)) {
        const src = thumbCache.get(id)
        if (src) closeBitmap(src)
        thumbCache.delete(id)
      }
    }
    // 同步清理已移除图片的预览错误标记
    if (previewErrorIds.value.size > 0) {
      const kept = new Set([...previewErrorIds.value].filter((id) => idSet.has(id)))
      if (kept.size !== previewErrorIds.value.size) previewErrorIds.value = kept
    }
    requestDraw()
  },
  { deep: true }
)

// P1-3：拼接顺序一致性 —— 托盘按 sortedImages 展示，若被切到名称/状态排序，
// 会与预览/导出（store.images 顺序）矛盾，回锁为导入顺序并提示
watch(
  () => store.sortMode,
  (mode) => {
    if (mode !== 'upload') {
      store.sortMode = 'upload'
      srMessage.value = '拼接顺序已锁定为导入顺序（与预览及导出一致）'
      sortOrderNotice.value = '拼接顺序已锁定为导入顺序'
      if (sortNoticeTimer) clearTimeout(sortNoticeTimer)
      sortNoticeTimer = setTimeout(() => {
        sortOrderNotice.value = ''
      }, 3200)
    }
  }
)

const resetView = () => {
  const canvas = canvasRef.value
  if (!canvas) return
  workspaceRef.value?.triggerAutoFit(canvas.width, canvas.height)
}

const combineDirections = computed(() => [
  { label: t('tools.combine.dirVertical'), value: 'vertical', icon: ArrowDown },
  { label: t('tools.combine.dirHorizontal'), value: 'horizontal', icon: ArrowRight },
  { label: t('tools.combine.grid'), value: 'grid', icon: Grid3X3 }
])

const layoutModes = computed(() => [
  { label: t('tools.combine.smartScale'), value: 'smart', icon: Layers },
  { label: t('tools.combine.originalSize'), value: 'original', icon: Box }
])

const alignmentOptions = computed(() => {
  if (combineDirection.value === 'vertical')
    return [
      { label: t('tools.combine.alignLeft'), value: 'start', icon: AlignLeft },
      { label: t('tools.combine.alignCenter'), value: 'center', icon: AlignCenter },
      { label: t('tools.combine.alignRight'), value: 'end', icon: AlignRight }
    ]
  if (combineDirection.value === 'horizontal')
    return [
      { label: t('tools.combine.alignTop'), value: 'start', icon: AlignStartVertical },
      { label: t('tools.combine.alignCenter'), value: 'center', icon: AlignCenterVertical },
      { label: t('tools.combine.alignBottom'), value: 'end', icon: AlignEndVertical }
    ]
  return [
    { label: t('tools.combine.start'), value: 'start', icon: AlignLeft },
    { label: t('tools.combine.center'), value: 'center', icon: AlignCenter },
    { label: t('tools.combine.end'), value: 'end', icon: AlignRight }
  ]
})

const handleCombine = async () => {
  // P2-2：处理中点击 CTA 转为中止（引擎侧已支持 AbortSignal）
  if (isProcessing.value) {
    abortProcessing()
    return
  }
  if (store.images.length < 2) return
  triggerHaptic(15) // 启动任务反馈
  combineError.value = ''
  try {
    const result = await processCombine({
      direction: combineDirection.value,
      layoutMode: layoutMode.value,
      spacing: spacing.value,
      columns: columns.value,
      padding: padding.value,
      borderRadius: borderRadius.value,
      backgroundColor: backgroundColor.value,
      alignment: alignment.value,
      format: outputFormat.value,
      quality: outputQuality.value
    })
    const typedResult = result as ProcessResult
    const blob = typedResult.blob || (result as Blob)
    if (blob) {
      triggerHaptic(8) // 成功反馈
      downloadImage(blob, `_Imago${t('common.export.suffix.combined')}_${Date.now()}`, 'combine')
    }
  } catch (error) {
    const err = error as Error
    // P2-2：用户主动中止不算失败，不展示错误
    if (
      err?.name === 'AbortError' ||
      err?.message?.includes('AbortError') ||
      err?.message?.includes('abort')
    ) {
      return
    }
    // P1-1：拼接失败必须有可见反馈，不能仅 console.error
    combineError.value = err?.message || '拼接失败，请重试'
    console.error('Combine failed:', error)
  }
}

const handleMoveImage = (fromIndex: number, direction: -1 | 1) => {
  const toIndex = fromIndex + direction
  if (toIndex < 0 || toIndex >= store.images.length) return

  const fromId = store.images[fromIndex]?.id
  const toId = store.images[toIndex]?.id

  if (fromId && toId) {
    store.reorderImage(fromId, toId)
    triggerHaptic(5) // 排序反馈
    srMessage.value = t('tools.combine.messages.moved', { from: fromIndex + 1, to: toIndex + 1 })

    nextTick(() => {
      const el = document.querySelector(`[data-order-item="${toIndex}"]`) as HTMLElement
      el?.focus()
    })
  }
}

const handleRemoveImage = (id: string, name: string) => {
  store.removeImage(id)
  triggerHaptic(12) // 删除反馈
  srMessage.value = t('tools.combine.messages.removed', { name })
}

const hasEnoughImages = computed(() => store.images.length >= 2)

// P2-1：原 combinedResult 死状态已移除，重置改为清除可见错误并重绘预览
const handleResetAll = () => {
  combineError.value = ''
  requestDraw()
}

useResizeObserver(containerRef, resetView)
</script>

<template>
  <WorkspaceLayout show-sidebar no-scroll show-assets-tray>
    <template #header-left><ImageSelectionStatus :show-card-size="false" /></template>
    <template #header-actions
      ><ImageActionsToolbar
        view-id="combine"
        :is-processing="isProcessing"
        :show-download-all="false"
        :show-layout-toggle="false"
        show-clear-all
        @reset-all="handleResetAll"
    /></template>

    <template #content>
      <div class="sr-only" aria-live="polite">{{ srMessage }}</div>
      <AppCanvasWorkspace
        ref="workspaceRef"
        transform-duration="duration-300"
        :aria-label="t('tools.combine.canvas.ariaLabel')"
        :aria-describedby="'combine-instructions'"
        @reset="resetView"
      >
        <template #default>
          <div id="combine-instructions" class="sr-only">
            {{ t('tools.combine.canvas.instructions') }}
          </div>

          <Transition name="preview-layout">
            <div
              v-if="store.images.length > 0"
              class="relative shadow-2xl transition-shadow will-change-transform isolate"
            >
              <canvas
                ref="canvasRef"
                class="block rounded-sm will-change-contents backface-hidden"
              />

              <!-- 骨架屏：预览解码/首帧绘制完成前显示 shimmer -->
              <div
                v-if="isInitialLoad"
                class="shimmer-skeleton rounded-sm animate-in fade-in duration-300"
                aria-hidden="true"
              ></div>

              <!-- P0-1：解码失败图片的可见错误态 -->
              <div
                v-if="previewErrorText"
                class="absolute bottom-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none max-w-[92%] px-4 py-2 rounded-xl bg-destructive/10 border border-destructive/30 text-destructive text-[11px] font-bold leading-normal text-center shadow-lg backdrop-blur-md animate-in fade-in"
                role="alert"
              >
                {{ previewErrorText }}
              </div>

              <!-- P1-3：托盘排序被回锁为导入顺序的提示 -->
              <div
                v-if="sortOrderNotice"
                class="absolute top-3 left-1/2 -translate-x-1/2 z-20 pointer-events-none px-3 py-1.5 rounded-full bg-card/95 backdrop-blur border border-border/60 text-[11px] font-bold text-foreground shadow-lg animate-in fade-in"
                role="status"
              >
                {{ sortOrderNotice }}
              </div>

              <!-- 【无障碍层】：逻辑排序层 -->
              <div class="sr-only" role="list" :aria-label="t('tools.combine.canvas.sortListAria')">
                <TransitionGroup name="sort-list">
                  <div
                    v-for="(img, index) in store.images"
                    :key="img.id"
                    :data-order-item="index"
                    tabindex="0"
                    role="listitem"
                    class="focus:not-sr-only focus:absolute focus:top-0 focus:left-0 focus:z-50 focus:bg-background/95 focus:backdrop-blur-md focus:p-3 focus:rounded-2xl focus:border-2 focus:border-primary focus:shadow-2xl focus:animate-in focus:fade-in focus:zoom-in-95 focus:duration-200"
                    :aria-label="
                      t('tools.combine.canvas.itemAria', { index: index + 1, name: img.file.name })
                    "
                    @keydown.left.prevent="handleMoveImage(index, -1)"
                    @keydown.right.prevent="handleMoveImage(index, 1)"
                    @keydown.delete.prevent="handleRemoveImage(img.id, img.file.name)"
                  >
                    <div class="flex items-center gap-3 text-xs font-bold min-w-[200px]">
                      <span class="bg-primary/10 text-primary px-2 py-1 rounded-lg">{{
                        index + 1
                      }}</span>
                      <span class="truncate flex-1">{{ img.file.name }}</span>
                      <div class="flex gap-1.5 ml-auto">
                        <button
                          @click="handleMoveImage(index, -1)"
                          class="p-1 hover:bg-muted rounded"
                          :aria-label="t('tools.combine.canvas.movePrev')"
                        >
                          <ArrowUp :size="12" class="-rotate-90" />
                        </button>
                        <button
                          @click="handleMoveImage(index, 1)"
                          class="p-1 hover:bg-muted rounded"
                          :aria-label="t('tools.combine.canvas.moveNext')"
                        >
                          <ArrowUp :size="12" class="rotate-90" />
                        </button>
                        <button
                          @click="handleRemoveImage(img.id, img.file.name)"
                          class="p-1 hover:text-destructive rounded"
                          :aria-label="t('common.image.card.remove')"
                        >
                          <Trash2 :size="12" />
                        </button>
                      </div>
                    </div>
                  </div>
                </TransitionGroup>
              </div>
            </div>
          </Transition>

          <Transition name="fade-scale">
            <div
              v-if="!hasEnoughImages"
              class="absolute inset-0 flex flex-col items-center justify-center p-6 text-center pointer-events-none"
            >
              <div
                class="w-24 h-28 bg-primary/10 rounded-[2.5rem] flex items-center justify-center mb-8 ring-[12px] ring-primary/5 shadow-inner-white animate-float"
              >
                <Layers :size="40" class="text-primary/80" />
              </div>
              <AppButton
                variant="cta"
                size="md"
                class="rounded-[var(--radius)] px-8 pointer-events-auto"
                @click="triggerFileInput"
              >
                <Plus :size="18" class="mr-1.5" />{{ t('tools.combine.importNow') }}
              </AppButton>
            </div>
          </Transition>
        </template>
      </AppCanvasWorkspace>
    </template>

    <template #sidebar>
      <div class="stagger-list space-y-8 py-2">
        <section
          class="space-y-4 animate-in fade-in slide-in-from-right-4 duration-500"
          style="--stagger: 1"
        >
          <AppSectionHeader
            :title="t('tools.combine.direction')"
            :icon="Settings2"
          /><AppSegmentedControl v-model="combineDirection" :options="combineDirections" />
        </section>

        <section
          class="space-y-4 pt-6 border-t border-border/40 animate-in fade-in slide-in-from-right-4 duration-500"
          style="--stagger: 2"
        >
          <AppSectionHeader
            :title="t('tools.combine.layoutMode')"
            :icon="Layers"
          /><AppSegmentedControl v-model="layoutMode" :options="layoutModes" />
        </section>

        <section
          v-if="layoutMode === 'original'"
          class="space-y-4 pt-6 border-t border-border/40 animate-in fade-in slide-in-from-right-4 duration-500"
          style="--stagger: 3"
        >
          <AppSectionHeader
            :title="t('tools.combine.alignment')"
            :icon="AlignCenter"
          /><AppSegmentedControl v-model="alignment" :options="alignmentOptions" />
        </section>

        <section
          class="space-y-4 pt-6 border-t border-border/40 animate-in fade-in slide-in-from-right-4 duration-500"
          style="--stagger: 4"
        >
          <AppSectionHeader :title="t('tools.combine.params')" :icon="Settings2" />
          <div class="bg-muted/10 rounded-2xl p-4 border border-border/60 space-y-5">
            <div v-if="combineDirection === 'grid'" class="space-y-3">
              <AppSlider
                v-model="columns"
                :label="t('tools.combine.gridCols')"
                :icon="Grid3X3"
                :unit="t('tools.combine.unitCol')"
                :min="1"
                :max="10"
                :default-value="3"
              />
            </div>

            <div class="space-y-3">
              <AppSlider
                v-model="spacing"
                :label="t('tools.combine.spacing')"
                :icon="Layers"
                unit="px"
                :min="0"
                :max="200"
                :default-value="0"
              />
            </div>

            <div class="space-y-3">
              <AppSlider
                v-model="padding"
                :label="t('tools.combine.padding')"
                :icon="Box"
                unit="px"
                :min="0"
                :max="200"
                :default-value="0"
              />
            </div>

            <div class="space-y-3">
              <AppSlider
                v-model="borderRadius"
                :label="t('tools.combine.borderRadius')"
                :icon="Settings2"
                unit="px"
                :min="0"
                :max="100"
                :default-value="0"
              />
            </div>
          </div>
        </section>

        <section
          class="space-y-4 pt-6 border-t border-border/40 animate-in fade-in slide-in-from-right-4 duration-500"
          style="--stagger: 5"
        >
          <AppSectionHeader :title="t('tools.combine.canvasAppearance')" :icon="Settings2" />
          <div
            class="bg-muted/10 rounded-2xl p-4 border border-border/60 hover:border-border transition-colors"
          >
            <AppColorPicker
              v-model:model-value="backgroundColor"
              :label="t('tools.combine.bgFill')"
            />
          </div>
        </section>

        <!-- P1-4：canvas 引擎只支持 toBlob 原生格式（original/webp/jpeg/png），
             canvasOnly 移除 JXL/AVIF/WebP2 选项，避免导出格式静默降级为 PNG -->
        <AppExportSettings
          v-model:format="outputFormat"
          v-model:quality="outputQuality"
          canvas-only
          class="pt-6 border-t border-border/40"
        />
        <!-- P2-7：「保持原始格式」在 canvas 引擎中恒输出 PNG，显示提示避免误导 -->
        <p
          v-if="outputFormat === 'original'"
          class="text-[0.6rem] text-muted-foreground/70 px-1 leading-relaxed"
        >
          {{ t('tools.combine.originalFormatHint') }}
        </p>
      </div>
    </template>

    <template #footer>
      <InspectorFooter>
        <div class="w-full space-y-3">
          <!-- P1-1：拼接失败可见反馈（不再仅 console.error） -->
          <div
            v-if="combineError"
            class="p-3 bg-destructive/5 border border-destructive/20 rounded-xl flex items-start gap-2.5 text-left animate-in fade-in"
            role="alert"
          >
            <AlertCircle :size="16" class="text-destructive shrink-0 mt-0.5" />
            <div class="text-xs font-bold text-destructive leading-normal break-words">
              {{ combineError }}
            </div>
          </div>
          <!-- P1-2：图片不足（0/1 张）时仅保留空态覆盖层单个 CTA，避免双琥珀按钮 -->
          <AppButton
            v-if="hasEnoughImages"
            size="lg"
            variant="cta"
            class="w-full h-12 rounded-xl transition-all duration-500 group overflow-hidden"
            @click="handleCombine"
          >
            <template #icon>
              <Loader2 v-if="isProcessing" :size="18" class="animate-spin mr-2" />
              <Layers v-else :size="19" class="mr-2 animate-in zoom-in duration-300" />
            </template>
            <span class="font-bold text-sm tracking-tight">{{
              isProcessing
                ? `${t('tools.combine.cta.processing')} ${t('tools.split.cta.clickToAbort')}`
                : t('tools.combine.cta.export')
            }}</span>
          </AppButton>
        </div>
      </InspectorFooter>
    </template>
  </WorkspaceLayout>
</template>

<style scoped>
/* 1. 预览布局切换动画 (Ease Out Expo) */
.preview-layout-enter-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}
.preview-layout-leave-active {
  transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);
}
.preview-layout-enter-from {
  opacity: 0;
  transform: scale(0.98) translateY(4px);
}
.preview-layout-leave-to {
  opacity: 0;
  transform: scale(1.02);
}

/* 2. 空状态淡入缩放 */
.fade-scale-enter-active {
  transition: all 0.6s cubic-bezier(0.16, 1, 0.3, 1);
}
.fade-scale-enter-from {
  opacity: 0;
  transform: scale(0.9);
}

/* 3. 浮动动效 */
@keyframes float {
  0%,
  100% {
    transform: translateY(0);
  }
  50% {
    transform: translateY(-10px);
  }
}
.animate-float {
  animation: float 4s ease-in-out infinite;
}

/* 4. 列表排序移动动画 */
.sort-list-move {
  transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

/* 5. 侧边栏 Stagger 延迟 */
.animate-in {
  animation-delay: calc(var(--stagger) * 0.1s);
}

/* 6. 无障碍项特殊处理 */
.not-sr-only {
  position: absolute !important;
  width: auto !important;
  height: auto !important;
  padding: 0 !important;
  margin: 0 !important;
  overflow: visible !important;
  clip: auto !important;
  white-space: normal !important;
}

/* 7. 减弱动效适配 */
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
  .animate-float {
    animation: none;
  }
}
</style>
