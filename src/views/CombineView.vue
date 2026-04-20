<script setup lang="ts">
import { ref, computed, nextTick, watch, onMounted } from 'vue'
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
  Plus,
  ArrowUp,
  Trash2
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

import InspectorFooter from '../components/layout/InspectorFooter.vue'

const store = useImageStore()
const { downloadImage, triggerFileInput } = useFileHelpers()
const { t } = useI18n()

// 状态
const srMessage = ref('')

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

const { isProcessing, processCombine } = useImageProcessor(combineEngine)

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

// 缓存已加载的预览图对象
const imageCache = new Map<string, HTMLImageElement>()
let isDrawingRaf = false

const loadAndCacheImage = (imgData: ImageItem): Promise<HTMLImageElement> => {
  if (imageCache.has(imgData.id)) return Promise.resolve(imageCache.get(imgData.id)!)

  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => {
      imageCache.set(imgData.id, img)
      resolve(img)
    }
    img.src = imgData.preview
  })
}

const drawPreview = async () => {
  const canvas = canvasRef.value
  const ctx = canvas?.getContext('2d')
  if (!canvas || !ctx || store.images.length === 0) return

  const loadedImages = await Promise.all(store.images.map(loadAndCacheImage))

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

  const sizeChanged = canvas.width !== finalW || canvas.height !== finalH
  if (sizeChanged) {
    canvas.width = finalW
    canvas.height = finalH

    // 【核心修复】：如果是初始加载或重大属性变化，执行 AutoFit
    if (isInitialLoad.value) {
      nextTick(() => {
        workspaceRef.value?.triggerAutoFit(finalW, finalH, 80, false)
        isInitialLoad.value = false
      })
    }
  }

  ctx.clearRect(0, 0, finalW, finalH)
  if (backgroundColor.value !== 'transparent') {
    ctx.fillStyle = backgroundColor.value
    ctx.fillRect(0, 0, finalW, finalH)
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
  if (isDrawingRaf) return
  isDrawingRaf = true
  requestAnimationFrame(() => {
    drawPreview()
    isDrawingRaf = false
  })
}

onMounted(() => {
  requestDraw()
})

// 分离 Watch 逻辑：重大变化触发 AutoFit，微调触发重绘
watch([() => store.images.length, combineDirection, layoutMode], (newValues, oldValues) => {
  isInitialLoad.value = true
  if (oldValues) triggerHaptic(10)
  requestDraw()
})

watch([alignment, spacing, columns, padding, borderRadius, backgroundColor], () => {
  requestDraw()
})

watch(
  () => store.images.map((img) => img.id),
  (newIds) => {
    const idSet = new Set(newIds)
    for (const id of imageCache.keys()) {
      if (!idSet.has(id)) imageCache.delete(id)
    }
    requestDraw()
  },
  { deep: true }
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
  if (store.images.length < 2) return
  triggerHaptic(15) // 启动任务反馈
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
    if (result?.blob) {
      triggerHaptic(8) // 成功反馈
      downloadImage(result.blob, `_Imago${t('common.export.suffix.combined')}_${Date.now()}`)
    }
  } catch (error) {
    console.error('Combine failed:', error)
  }
}

const handleMoveImage = (index: number, direction: -1 | 1) => {
  const newIndex = index + direction
  if (newIndex < 0 || newIndex >= store.images.length) return

  const newImages = [...store.images]
  const [movedItem] = newImages.splice(index, 1)
  newImages.splice(newIndex, 0, movedItem!)
  store.images = newImages

  triggerHaptic(5) // 排序反馈
  srMessage.value = t('tools.combine.messages.moved', { from: index + 1, to: newIndex + 1 })

  nextTick(() => {
    const el = document.querySelector(`[data-order-item="${newIndex}"]`) as HTMLElement
    el?.focus()
  })
}

const handleRemoveImage = (id: string, name: string) => {
  store.removeImage(id)
  triggerHaptic(12) // 删除反馈
  srMessage.value = t('tools.combine.messages.removed', { name })
}

const hasEnoughImages = computed(() => store.images.length >= 2)

useResizeObserver(containerRef, resetView)
</script>

<template>
  <WorkspaceLayout show-sidebar no-scroll show-assets-tray>
    <template #header-left><ImageSelectionStatus :show-card-size="false" /></template>
    <template #header-actions
      ><ImageActionsToolbar
        view-id="combine"
        :is-processing="isProcessing"
        show-clear-all
        show-reset-all
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
                class="rounded-full px-10 pointer-events-auto shadow-xl shadow-primary/20 transition-all active:scale-95"
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
            <AppColorPicker v-model="backgroundColor" :label="t('tools.combine.bgFill')" />
          </div>
        </section>

        <AppExportSettings
          v-model:format="outputFormat"
          v-model:quality="outputQuality"
          class="pt-6 border-t border-border/40"
        />
      </div>
    </template>

    <template #footer>
      <InspectorFooter>
        <AppButton
          size="lg"
          variant="cta"
          class="w-full h-12 rounded-xl shadow-lg transition-all duration-500 active:scale-95 group overflow-hidden"
          :loading="isProcessing"
          :disabled="!hasEnoughImages"
          @click="handleCombine"
        >
          <template #icon>
            <Layers v-if="!isProcessing" :size="19" class="mr-2 animate-in zoom-in duration-300" />
          </template>
          <span class="font-bold text-sm tracking-tight">{{
            isProcessing ? t('tools.combine.cta.processing') : t('tools.combine.cta.export')
          }}</span>
        </AppButton>
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
