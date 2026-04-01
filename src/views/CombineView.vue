<script setup lang="ts">
import { ref, computed, nextTick, watch, onMounted } from 'vue'
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
import { combineEngine } from '../lib/engines/combineEngine'
import { useImageProcessor } from '../composables/useImageProcessor'
import { useFileHelpers } from '../composables/useFileHelpers'

import InspectorFooter from '../components/layout/InspectorFooter.vue'

const store = useImageStore()
const { downloadImage, triggerFileInput } = useFileHelpers()

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

const { isProcessing, processCombine } = useImageProcessor(combineEngine)

// 配置状态
const combineDirection = ref<'vertical' | 'horizontal' | 'grid'>('vertical')
const alignment = ref<'start' | 'center' | 'end'>('center')
const spacing = ref(20)
const columns = ref(3)
const padding = ref(20)
const borderRadius = ref(12)
const backgroundColor = ref('#00000000')
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

  if (combineDirection.value === 'vertical') {
    totalWidth = maxWidth
    totalHeight =
      loadedImages.reduce((sum, img) => sum + img.height, 0) +
      (loadedImages.length - 1) * spacing.value
  } else if (combineDirection.value === 'horizontal') {
    totalWidth =
      loadedImages.reduce((sum, img) => sum + img.width, 0) +
      (loadedImages.length - 1) * spacing.value
    totalHeight = maxHeight
  } else {
    cols = columns.value || Math.ceil(Math.sqrt(loadedImages.length))
    rows = Math.ceil(loadedImages.length / cols)
    totalWidth = maxWidth * cols + (cols - 1) * spacing.value
    totalHeight = maxHeight * rows + (rows - 1) * spacing.value
  }

  const finalW = totalWidth + padding.value * 2
  const finalH = totalHeight + padding.value * 2

  if (canvas.width !== finalW || canvas.height !== finalH) {
    canvas.width = finalW
    canvas.height = finalH
    nextTick(() => {
      workspaceRef.value?.triggerAutoFit(finalW, finalH)
    })
  }

  ctx.clearRect(0, 0, finalW, finalH)
  if (backgroundColor.value !== '#00000000') {
    ctx.fillStyle = backgroundColor.value
    ctx.fillRect(0, 0, finalW, finalH)
  }

  const drawImg = (img: HTMLImageElement, x: number, y: number, w: number, h: number) => {
    ctx.save()
    if (borderRadius.value > 0) {
      ctx.beginPath()
      if (ctx.roundRect) {
        ctx.roundRect(x, y, w, h, borderRadius.value)
      } else {
        ctx.rect(x, y, w, h)
      }
      ctx.clip()
    }
    ctx.drawImage(img, x, y, w, h)
    ctx.restore()
  }

  let currentX = padding.value
  let currentY = padding.value

  if (combineDirection.value === 'vertical') {
    loadedImages.forEach((img) => {
      let x = padding.value
      if (alignment.value === 'center') x = padding.value + (maxWidth - img.width) / 2
      else if (alignment.value === 'end') x = padding.value + maxWidth - img.width
      drawImg(img, x, currentY, img.width, img.height)
      currentY += img.height + spacing.value
    })
  } else if (combineDirection.value === 'horizontal') {
    loadedImages.forEach((img) => {
      let y = padding.value
      if (alignment.value === 'center') y = padding.value + (maxHeight - img.height) / 2
      else if (alignment.value === 'end') y = padding.value + maxHeight - img.height
      drawImg(img, currentX, y, img.width, img.height)
      currentX += img.width + spacing.value
    })
  } else {
    loadedImages.forEach((img, i) => {
      const r = Math.floor(i / cols)
      const c = i % cols
      let offsetX = padding.value
      let offsetY = padding.value
      if (alignment.value === 'center') {
        offsetX = padding.value + (maxWidth - img.width) / 2
        offsetY = padding.value + (maxHeight - img.height) / 2
      } else if (alignment.value === 'end') {
        offsetX = padding.value + maxWidth - img.width
        offsetY = padding.value + maxHeight - img.height
      }
      const x = c * (maxWidth + spacing.value) + offsetX
      const y = r * (maxHeight + spacing.value) + offsetY
      drawImg(img, x, y, img.width, img.height)
    })
  }
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

watch(
  [
    combineDirection,
    alignment,
    spacing,
    columns,
    padding,
    borderRadius,
    backgroundColor,
    () => store.images.length
  ],
  (newValues, oldValues) => {
    // 如果没有 oldValues，说明是 watch 的初次运行（虽然我们去掉了 immediate，但为了防御性编程仍保留判断）
    if (!oldValues) {
      requestDraw()
      return
    }

    // 只有在方向、对齐、背景重置或图片增删时触发较明显的振动
    if (
      newValues[0] !== oldValues[0] ||
      newValues[1] !== oldValues[1] ||
      newValues[7] !== oldValues[7]
    ) {
      triggerHaptic(10)
    }
    requestDraw()
  },
  { deep: true }
)

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

const combineDirections = [
  { label: '纵向', value: 'vertical', icon: ArrowDown },
  { label: '横向', value: 'horizontal', icon: ArrowRight },
  { label: '网格', value: 'grid', icon: Grid3X3 }
]

const alignmentOptions = computed(() => {
  if (combineDirection.value === 'vertical')
    return [
      { label: '左对齐', value: 'start', icon: AlignLeft },
      { label: '居中', value: 'center', icon: AlignCenter },
      { label: '右对齐', value: 'end', icon: AlignRight }
    ]
  if (combineDirection.value === 'horizontal')
    return [
      { label: '顶对齐', value: 'start', icon: AlignStartVertical },
      { label: '居中', value: 'center', icon: AlignCenterVertical },
      { label: '底对齐', value: 'end', icon: AlignEndVertical }
    ]
  return [
    { label: '起点', value: 'start', icon: AlignLeft },
    { label: '居中', value: 'center', icon: AlignCenter },
    { label: '终点', value: 'end', icon: AlignRight }
  ]
})

const handleCombine = async () => {
  if (store.images.length < 2) return
  triggerHaptic(15) // 启动任务反馈
  try {
    const result = await processCombine({
      direction: combineDirection.value,
      spacing: spacing.value,
      columns: columns.value,
      padding: padding.value,
      borderRadius: borderRadius.value,
      backgroundColor:
        backgroundColor.value === '#00000000' ? 'transparent' : backgroundColor.value,
      alignment: alignment.value,
      format: outputFormat.value,
      quality: outputQuality.value
    })
    if (result?.blob) {
      triggerHaptic(8) // 成功反馈
      downloadImage(result.blob, `combined_${Date.now()}`)
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
  srMessage.value = `已将第 ${index + 1} 张图片移至第 ${newIndex + 1} 位`

  nextTick(() => {
    const el = document.querySelector(`[data-order-item="${newIndex}"]`) as HTMLElement
    el?.focus()
  })
}

const handleRemoveImage = (id: string, name: string) => {
  store.removeImage(id)
  triggerHaptic(12) // 删除反馈
  srMessage.value = `已从拼接列表中移除图片: ${name}`
}

const resetBackgroundColor = () => {
  backgroundColor.value = '#00000000'
  triggerHaptic(12)
}

const selectPresetColor = (color: string) => {
  backgroundColor.value = color
  triggerHaptic(5)
}

const hasEnoughImages = computed(() => store.images.length >= 2)

useResizeObserver(containerRef, resetView)
</script>

<template>
  <WorkspaceLayout show-sidebar no-scroll show-assets-tray>
    <template #header-left><ImageSelectionStatus :show-card-size="false" /></template>
    <template #header-actions
      ><ImageActionsToolbar :is-processing="isProcessing" show-clear-all
    /></template>

    <template #content>
      <div class="sr-only" aria-live="polite">{{ srMessage }}</div>
      <AppCanvasWorkspace
        ref="workspaceRef"
        transform-duration="duration-300"
        aria-label="图片拼接预览"
        :aria-describedby="'combine-instructions'"
        @reset="resetView"
      >
        <template #default>
          <div id="combine-instructions" class="sr-only">
            这是图片拼接的实时预览。您可以通过 AssetsTray 托盘或下方的无障碍排序列表调整图片顺序。
            在排序列表中，使用键盘方向键左/右移动图片顺序，使用 Delete 键从拼接列表中移除图片。
          </div>

          <Transition name="preview-layout">
            <div
              v-if="store.images.length > 0"
              class="relative shadow-2xl transition-shadow will-change-transform"
            >
              <canvas ref="canvasRef" class="block rounded-sm" />

              <!-- 【无障碍层】：逻辑排序层 -->
              <div class="sr-only" role="list" aria-label="拼接图片排序列表">
                <TransitionGroup name="sort-list">
                  <div
                    v-for="(img, index) in store.images"
                    :key="img.id"
                    :data-order-item="index"
                    tabindex="0"
                    role="listitem"
                    class="focus:not-sr-only focus:absolute focus:top-0 focus:left-0 focus:z-50 focus:bg-background/95 focus:backdrop-blur-md focus:p-3 focus:rounded-2xl focus:border-2 focus:border-primary focus:shadow-2xl focus:animate-in focus:fade-in focus:zoom-in-95 focus:duration-200"
                    :aria-label="`图片 ${index + 1}: ${img.file.name}。按左右方向键排序，Delete 键移除。`"
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
                          aria-label="前移"
                        >
                          <ArrowUp :size="12" class="-rotate-90" />
                        </button>
                        <button
                          @click="handleMoveImage(index, 1)"
                          class="p-1 hover:bg-muted rounded"
                          aria-label="后移"
                        >
                          <ArrowUp :size="12" class="rotate-90" />
                        </button>
                        <button
                          @click="handleRemoveImage(img.id, img.file.name)"
                          class="p-1 hover:text-destructive rounded"
                          aria-label="移除"
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
                <Plus :size="18" class="mr-1.5" />立即添加图片
              </AppButton>
            </div>
          </Transition>
        </template>
      </AppCanvasWorkspace>
    </template>

    <template #sidebar>
      <div class="stagger-list space-y-8 py-2">
        <section
          class="space-y-5 animate-in fade-in slide-in-from-right-4 duration-500"
          style="--stagger: 1"
        >
          <AppSectionHeader title="拼接模式" :icon="Settings2" /><AppSegmentedControl
            v-model="combineDirection"
            :options="combineDirections"
          />
        </section>

        <section
          class="space-y-5 animate-in fade-in slide-in-from-right-4 duration-500"
          style="--stagger: 2"
        >
          <AppSectionHeader title="对齐方式" :icon="AlignCenter" /><AppSegmentedControl
            v-model="alignment"
            :options="alignmentOptions"
          />
        </section>

        <div
          class="space-y-6 px-1 animate-in fade-in slide-in-from-right-4 duration-500"
          style="--stagger: 3"
        >
          <AppSlider
            v-if="combineDirection === 'grid'"
            v-model="columns"
            label="网格列数"
            :min="1"
            :max="10"
            unit="列"
          />
          <AppSlider v-model="spacing" label="图片间距" :min="0" :max="200" unit="px" />
          <AppSlider v-model="padding" label="外边距" :min="0" :max="200" unit="px" />
          <AppSlider v-model="borderRadius" label="图片圆角" :min="0" :max="100" unit="px" />

          <div class="space-y-4">
            <div class="flex flex-col gap-1 px-1">
              <span class="text-[10px] font-black text-muted-foreground uppercase tracking-widest"
                >画布背景</span
              >
              <p class="text-[10px] text-muted-foreground/60 leading-relaxed">
                设置图片缝隙及外边距的填充底色。
              </p>
            </div>

            <div
              class="bg-muted/10 rounded-2xl p-4 border border-border/60 flex items-center gap-4 hover:border-border transition-colors"
            >
              <div class="relative group">
                <input
                  type="color"
                  v-model="backgroundColor"
                  class="w-12 h-12 rounded-xl cursor-pointer border-2 border-border/40 p-0.5 bg-background transition-all hover:scale-105 active:scale-95"
                  title="选择背景颜色"
                />
                <div
                  class="absolute -bottom-1 -right-1 w-4 h-4 bg-primary text-white rounded-full flex items-center justify-center shadow-sm pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <Plus :size="10" />
                </div>
              </div>

              <div class="flex flex-col flex-1 gap-1.5">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-mono font-bold text-primary tracking-wider">{{
                    backgroundColor.toUpperCase()
                  }}</span>
                  <AppButton
                    v-if="backgroundColor !== '#00000000'"
                    variant="ghost"
                    size="sm"
                    @click="resetBackgroundColor"
                    class="h-6 px-2 text-[9px] font-bold uppercase tracking-tighter text-muted-foreground hover:text-primary hover:bg-primary/5 rounded-lg transition-all"
                  >
                    设为透明
                  </AppButton>
                </div>
                <div class="flex gap-1">
                  <div
                    v-for="preset in ['#000000', '#FFFFFF', '#F3F4F6']"
                    :key="preset"
                    @click="selectPresetColor(preset)"
                    class="w-5 h-5 rounded-md border border-border/40 cursor-pointer hover:scale-110 active:scale-90 transition-all"
                    :style="{ backgroundColor: preset }"
                  ></div>
                </div>
              </div>
            </div>
          </div>

          <AppExportSettings
            v-model:format="outputFormat"
            v-model:quality="outputQuality"
            class="pt-4"
          />
        </div>
      </div>
    </template>

    <template #footer>
      <InspectorFooter>
        <AppButton
          size="lg"
          variant="cta"
          class="w-full h-12 rounded-xl shadow-xl shadow-primary/10 active:scale-[0.98] transition-all duration-300"
          :loading="isProcessing"
          :disabled="!hasEnoughImages"
          @click="handleCombine"
        >
          <template #icon>
            <Layers v-if="!isProcessing" :size="19" class="mr-2 animate-in zoom-in duration-300" />
          </template>
          <span class="font-bold text-sm tracking-tight">{{
            isProcessing ? '正在拼合...' : '生成并下载'
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
