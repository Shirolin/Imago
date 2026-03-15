<script setup lang="ts">
import { ref, computed } from 'vue'
import { useImageStore } from '../stores/imageStore'
import { useElementSize, watchOnce, useResizeObserver, useElementBounding } from '@vueuse/core'
import WorkspaceLayout from '../components/layout/WorkspaceLayout.vue'
import AppButton from '../components/common/AppButton.vue'
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
  Info,
  GripVertical,
  X,
  Maximize,
  ZoomIn,
  ZoomOut,
  RefreshCw
} from 'lucide-vue-next'
import ImageSelectionStatus from '../components/common/ImageSelectionStatus.vue'
import ImageActionsToolbar from '../components/common/ImageActionsToolbar.vue'
import AppSectionHeader from '../components/common/AppSectionHeader.vue'
import AppSegmentedControl from '../components/common/AppSegmentedControl.vue'
import AppSlider from '../components/common/AppSlider.vue'
import AppTip from '../components/common/AppTip.vue'
import { combineEngine } from '../lib/engines/combineEngine'
import { useImageProcessor } from '../composables/useImageProcessor'
import { useFileHelpers } from '../composables/useFileHelpers'

const store = useImageStore()
const { downloadImage } = useFileHelpers()

// 核心视口框架 (仿 Split)
const containerRef = ref<HTMLDivElement | null>(null)
const contentRef = ref<HTMLDivElement | null>(null)
const scale = ref(1)
const offset = ref({ x: 0, y: 0 })
const isPanning = ref(false)
const startPanPos = ref({ x: 0, y: 0 })

// 优化：使用 useResizeObserver 提供的 rect 避免直接读取 offsetWidth 触发重绘
const { width: contentWidth, height: contentHeight } = useElementSize(contentRef)
const {
  width: containerWidth,
  height: containerHeight,
  left: containerLeft,
  top: containerTop
} = useElementBounding(containerRef)

const resetView = () => {
  if (
    !containerWidth.value ||
    !containerHeight.value ||
    !contentWidth.value ||
    !contentHeight.value
  )
    return

  const cw = containerWidth.value - 100
  const ch = containerHeight.value - 100
  const w = contentWidth.value
  const h = contentHeight.value

  scale.value = Math.min(cw / w, ch / h, 1)
  offset.value = { x: 0, y: 0 }
}

// 监听尺寸变化自动适配，增加防抖保护
import { useDebounceFn } from '@vueuse/core'
const debouncedReset = useDebounceFn(resetView, 150)

useResizeObserver(containerRef, debouncedReset)
useResizeObserver(contentRef, debouncedReset)

const handleWheel = (e: WheelEvent) => {
  const container = containerRef.value
  if (!container) return
  e.preventDefault()

  const zoomStep = 1.15
  const delta = e.deltaY > 0 ? 1 / zoomStep : zoomStep
  const newScale = Math.max(0.05, Math.min(scale.value * delta, 10))

  // 优化：使用缓存的 container 尺寸和位置
  const mouseX = e.clientX - containerLeft.value - containerWidth.value / 2
  const mouseY = e.clientY - containerTop.value - containerHeight.value / 2

  offset.value = {
    x: mouseX - (mouseX - offset.value.x) * (newScale / scale.value),
    y: mouseY - (mouseY - offset.value.y) * (newScale / scale.value)
  }
  scale.value = newScale
}

const handlePointerDown = (e: PointerEvent) => {
  const container = containerRef.value
  if (!container) return
  // 中键或 Shift+左键 触发平移
  if (e.button === 1 || (e.button === 0 && e.shiftKey)) {
    isPanning.value = true
    startPanPos.value = { x: e.clientX - offset.value.x, y: e.clientY - offset.value.y }
    container.setPointerCapture(e.pointerId)
  }
}

const handlePointerMove = (e: PointerEvent) => {
  if (isPanning.value) {
    offset.value = { x: e.clientX - startPanPos.value.x, y: e.clientY - startPanPos.value.y }
  }
}

const handlePointerUp = () => {
  isPanning.value = false
}

const zoomIn = () => {
  scale.value *= 1.2
}
const zoomOut = () => {
  scale.value /= 1.2
}

// 监听内容或容器变化自动重置一次 (初次加载)
watchOnce([() => store.images.length, containerRef], () => {
  setTimeout(resetView, 100)
})

// --- 状态与配置 ---
const combineDirection = ref<'vertical' | 'horizontal' | 'grid'>('vertical')
const alignment = ref<'start' | 'center' | 'end'>('center')
const spacing = ref(0)
const backgroundColor = ref('#00000000')

// --- Options Config ---
const combineDirections = [
  { label: '纵向', value: 'vertical', icon: ArrowDown },
  { label: '横向', value: 'horizontal', icon: ArrowRight },
  { label: '网格', value: 'grid', icon: Grid3X3 }
]

const alignmentOptions = computed(() => {
  if (combineDirection.value === 'vertical') {
    return [
      { label: '左对齐', value: 'start', icon: AlignLeft },
      { label: '居中', value: 'center', icon: AlignCenter },
      { label: '右对齐', value: 'end', icon: AlignRight }
    ]
  } else if (combineDirection.value === 'horizontal') {
    return [
      { label: '顶对齐', value: 'start', icon: AlignStartVertical },
      { label: '居中', value: 'center', icon: AlignCenterVertical },
      { label: '底对齐', value: 'end', icon: AlignEndVertical }
    ]
  }
  return [
    { label: '起点', value: 'start', icon: AlignLeft },
    { label: '居中', value: 'center', icon: AlignCenter },
    { label: '终点', value: 'end', icon: AlignRight }
  ]
})

// --- Logic ---
const { isProcessing, processCombine } = useImageProcessor(combineEngine)

const handleCombine = async () => {
  if (store.images.length < 2) return

  try {
    const result = await processCombine({
      direction: combineDirection.value,
      spacing: spacing.value,
      backgroundColor:
        backgroundColor.value === '#00000000' ? 'transparent' : backgroundColor.value,
      alignment: alignment.value
    })

    if (result && result.blob) {
      downloadImage(result.blob, `combined_${Date.now()}.png`)
      store.images.forEach((img) => store.updateImage(img.id, { status: 'done' }))
    }
  } catch (error) {
    console.error('Combine failed:', error)
  }
}

// --- Native Drag & Drop Logic ---
const dragIndex = ref<number | null>(null)
const dropTargetIndex = ref<number | null>(null)

const onDragStart = (index: number) => {
  dragIndex.value = index
}

const onDragOver = (e: DragEvent, index: number) => {
  e.preventDefault()
  dropTargetIndex.value = index
}

const onDrop = (index: number) => {
  if (dragIndex.value === null || dragIndex.value === index) {
    dragIndex.value = null
    dropTargetIndex.value = null
    return
  }

  moveItem(dragIndex.value, index)
  dragIndex.value = null
  dropTargetIndex.value = null
}

const onDragEnd = () => {
  dragIndex.value = null
  dropTargetIndex.value = null
}

// --- Keyboard Navigation & Reordering ---
const moveItem = (fromIndex: number, toIndex: number) => {
  if (toIndex < 0 || toIndex >= store.images.length) return
  const newImages = [...store.images]
  const [removed] = newImages.splice(fromIndex, 1)
  newImages.splice(toIndex, 0, removed!)
  store.images = newImages
}

const handleKeyDown = (e: KeyboardEvent, index: number) => {
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      moveItem(index, index - 1)
      // Focus the moved item
      setTimeout(() => {
        const items = document.querySelectorAll('.preview-item')
        ;(items[index - 1] as HTMLElement)?.focus()
      }, 0)
    }
  } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      moveItem(index, index + 1)
      // Focus the moved item
      setTimeout(() => {
        const items = document.querySelectorAll('.preview-item')
        ;(items[index + 1] as HTMLElement)?.focus()
      }, 0)
    }
  } else if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault()
    store.removeImage(store.images[index]!.id)
  }
}

// --- Computed Styles ---
const sidebarClasses = computed(
  () => 'p-6 flex flex-col gap-6 h-full overflow-y-auto custom-scrollbar'
)
const bottomCtaClasses = computed(
  () => 'mt-auto pt-6 border-t border-border bg-background sticky bottom-0 -mx-6 px-6 pb-6 z-10'
)

const previewListStyles = computed(() => {
  const isTransparent = backgroundColor.value === '#00000000'

  const styles: Record<string, string | number> = {
    display: 'inline-flex',
    gap: `${spacing.value}px`,
    backgroundColor: isTransparent ? 'transparent' : backgroundColor.value,
    backgroundImage: isTransparent ? 'var(--checkerboard-pattern)' : 'none',
    backgroundRepeat: 'repeat',
    flexDirection: combineDirection.value === 'vertical' ? 'column' : 'row',
    flexWrap: combineDirection.value === 'grid' ? 'wrap' : 'nowrap',
    alignItems:
      alignment.value === 'start'
        ? 'flex-start'
        : alignment.value === 'end'
          ? 'flex-end'
          : 'center',
    justifyContent: 'center',
    padding: '0',
    minWidth: '100px',
    minHeight: '100px'
  }
  return styles
})

const itemWrapperClasses = (index: number) => ({
  'preview-item relative group transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-4 focus:ring-offset-background rounded-sm': true,
  'opacity-30 grayscale scale-90 rotate-2': dragIndex.value === index,
  'ring-2 ring-primary ring-offset-4 ring-offset-background':
    dropTargetIndex.value === index && dragIndex.value !== index
})

const hasEnoughImages = computed(() => store.images.length >= 2)
</script>

<template>
  <WorkspaceLayout show-sidebar no-scroll>
    <template #header-left>
      <div class="flex items-center gap-3">
        <ImageSelectionStatus />
      </div>
    </template>

    <template #header-actions>
      <div class="flex items-center gap-2">
        <ImageActionsToolbar :show-clear-all="true" />
      </div>
    </template>

    <template #content>
      <div
        class="h-full flex flex-col gap-3 p-4 md:p-6 animate-in fade-in duration-500 overflow-hidden w-full"
      >
        <!-- 核心视口框架 (仿 Split) -->
        <div
          ref="containerRef"
          class="flex-1 min-h-0 bg-muted/10 border border-border/40 rounded-3xl overflow-hidden relative w-full group/viewport select-none touch-none"
          :class="{ 'cursor-grabbing': isPanning }"
          @wheel="handleWheel"
          @pointerdown="handlePointerDown"
          @pointermove="handlePointerMove"
          @pointerup="handlePointerUp"
          @pointerleave="handlePointerUp"
        >
          <!-- 底层棋盘格 -->
          <div class="absolute inset-0 transparency-grid"></div>

          <!-- 交互画布 -->
          <div
            class="absolute inset-0 flex items-center justify-center transition-transform duration-200 ease-out"
            :style="{ transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})` }"
          >
            <div
              v-if="store.images.length > 0"
              ref="contentRef"
              class="relative shadow-2xl transition-shadow duration-500"
              :style="previewListStyles"
              role="list"
            >
              <TransitionGroup name="preview-list">
                <div
                  v-for="(img, index) in store.images"
                  :key="img.id"
                  :class="itemWrapperClasses(index)"
                  draggable="true"
                  tabindex="0"
                  role="listitem"
                  @dragstart="onDragStart(index)"
                  @dragover="(e) => onDragOver(e, index)"
                  @drop="onDrop(index)"
                  @dragend="onDragEnd"
                  @keydown="(e) => handleKeyDown(e, index)"
                >
                  <!-- 预览图片 (直角边缘以便精准拼接) -->
                  <div
                    class="relative overflow-hidden bg-background ring-1 ring-white/10 group/item"
                  >
                    <img
                      :src="img.preview"
                      class="block max-w-[240px] md:max-w-[400px] h-auto pointer-events-none select-none"
                      :alt="`预览图 ${index + 1}: ${img.file.name}`"
                    />

                    <!-- 操作层 (仅在悬浮单张图片时显示) -->
                    <div
                      class="absolute inset-0 bg-black/20 opacity-0 group-hover/item:opacity-100 transition-all duration-300 pointer-events-none"
                    >
                      <!-- 右上角删除 (扩大热区) -->
                      <div class="absolute top-0 right-0 p-1 pointer-events-auto">
                        <button
                          @click.stop="store.removeImage(img.id)"
                          class="p-2 bg-red-500/80 text-white rounded-lg hover:bg-red-600 transition-all active:scale-90 shadow-lg backdrop-blur-sm flex items-center justify-center min-w-[32px] min-h-[32px]"
                          :title="`移除图片 ${img.file.name}`"
                          :aria-label="`移除图片 ${img.file.name}`"
                        >
                          <X :size="16" />
                        </button>
                      </div>

                      <!-- 左上角序号 -->
                      <div
                        class="absolute top-2 left-2 px-2 py-0.5 bg-black/50 backdrop-blur-md rounded text-[10px] text-white font-bold uppercase tracking-tighter ring-1 ring-white/10"
                      >
                        P{{ index + 1 }}
                      </div>

                      <!-- 底部文件名 (防御性文本处理) -->
                      <div
                        class="absolute bottom-0 left-0 right-0 px-2 py-1.5 bg-gradient-to-t from-black/80 to-transparent"
                      >
                        <p
                          class="text-[9px] text-white/90 truncate font-mono max-w-full leading-none"
                        >
                          {{ img.file.name }}
                        </p>
                      </div>
                    </div>
                  </div>

                  <!-- 排序指示器 -->
                  <div
                    v-if="dropTargetIndex === index && dragIndex !== index"
                    class="absolute inset-0 bg-primary/20 border-2 border-primary border-dashed rounded-sm pointer-events-none z-30"
                  ></div>
                </div>
              </TransitionGroup>
            </div>

            <!-- 空状态提示 (适应性宽度) -->
            <AppTip
              v-if="!hasEnoughImages"
              :icon="Info"
              class="max-w-[85%] md:max-w-md pointer-events-auto"
            >
              请至少上传两张图片。当前支持纵向、横向及网格模式。
            </AppTip>
          </div>

          <!-- 顶部快捷键提示栏 (仿 Split) -->
          <div
            class="absolute top-6 left-1/2 -translate-x-1/2 px-5 py-2.5 bg-black/40 backdrop-blur-md border border-white/5 rounded-full pointer-events-none opacity-0 group-hover/viewport:opacity-100 transition-all duration-500 flex items-center gap-4 z-30"
          >
            <span
              class="text-[0.65rem] text-white/90 font-black uppercase tracking-[0.2em] flex items-center gap-2"
            >
              <RefreshCw :size="14" class="text-primary" /> 滚轮缩放 • Shift+平移
            </span>
            <div class="w-px h-3 bg-white/10"></div>
            <span
              class="text-[0.65rem] text-white/90 font-black uppercase tracking-[0.2em] flex items-center gap-2"
            >
              <GripVertical :size="14" class="text-primary" /> 拖动图片或 Ctrl+方向键排序
            </span>
          </div>

          <!-- 底部悬浮控制栏 (仿 Split 精致样式) -->
          <div
            v-if="store.images.length > 0"
            class="absolute bottom-6 left-1/2 -translate-x-1/2 z-30 flex items-center gap-1.5 p-1.5 bg-background/80 backdrop-blur-2xl border border-border/60 rounded-2xl shadow-elevated"
          >
            <button
              @click="zoomOut"
              class="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted text-muted-foreground hover:text-primary transition-all active:scale-90 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
              aria-label="缩小视图"
            >
              <ZoomOut :size="18" />
            </button>
            <div class="px-2 min-w-[60px] text-center border-x border-border/20 font-mono">
              <span class="text-xs font-black text-foreground">{{ Math.round(scale * 100) }}%</span>
            </div>
            <button
              @click="zoomIn"
              class="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted text-muted-foreground hover:text-primary transition-all active:scale-90 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
              aria-label="放大视图"
            >
              <ZoomIn :size="18" />
            </button>
            <div class="w-px h-4 bg-border/20 mx-1"></div>
            <button
              @click="resetView"
              class="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-primary/10 text-muted-foreground hover:text-primary transition-all active:scale-90 focus-visible:ring-2 focus-visible:ring-primary focus-visible:outline-none"
              title="重置视图"
              aria-label="重置视图比例"
            >
              <Maximize :size="18" />
            </button>
          </div>
        </div>

        <!-- 底部状态信息栏 (仿 Split) -->
        <div class="flex items-center justify-between px-1 shrink-0 h-8">
          <div class="flex items-center gap-2 text-muted-foreground/40">
            <RefreshCw :size="12" class="animate-spin-slow" />
            <span class="text-[0.55rem] font-bold uppercase tracking-wider font-mono"
              >Ready to Combine</span
            >
          </div>
          <span class="text-[0.6rem] font-black uppercase tracking-widest text-primary/60">
            {{ store.images.length }} Images Selected • {{ combineDirection }} Mode
          </span>
        </div>
      </div>
    </template>

    <template #sidebar>
      <div :class="sidebarClasses">
        <div class="flex flex-col gap-6 pb-24">
          <div class="flex flex-col gap-4">
            <div class="flex items-center justify-between">
              <AppSectionHeader title="拼接模式" :icon="Settings2" />
              <div
                class="group/help relative cursor-help p-1 text-muted-foreground/40 hover:text-primary transition-colors"
                title="操作说明"
              >
                <Info :size="14" />
                <div
                  class="absolute right-0 top-full mt-2 w-48 p-3 bg-popover border border-border rounded-xl shadow-elevated opacity-0 group-hover/help:opacity-100 pointer-events-none transition-all z-50"
                >
                  <p class="text-[10px] leading-relaxed text-foreground/80 font-medium">
                    <span class="text-primary font-bold">排序:</span> 鼠标拖拽图片或使用 Ctrl +
                    方向键。<br /><br />
                    <span class="text-primary font-bold">平移:</span> 按住鼠标中键或 Shift + 左键。
                  </p>
                </div>
              </div>
            </div>
            <AppSegmentedControl
              v-model="combineDirection"
              :options="combineDirections"
              aria-label="选择拼接方向"
            />
          </div>

          <div class="flex flex-col gap-4">
            <AppSectionHeader title="对齐方式" :icon="AlignCenter" />
            <AppSegmentedControl
              v-model="alignment"
              :options="alignmentOptions"
              aria-label="选择对齐方式"
            />
          </div>

          <AppSlider v-model="spacing" label="图片间距" :min="0" :max="200" unit="px" />

          <div class="flex flex-col gap-4">
            <AppSectionHeader title="间距颜色" :icon="Settings2" />
            <div class="grid grid-cols-4 gap-2">
              <button
                v-for="color in [
                  { label: '透明', value: '#00000000' },
                  { label: '纯白', value: '#ffffff' },
                  { label: '纯黑', value: '#000000' }
                ]"
                :key="color.value"
                @click="backgroundColor = color.value"
                class="flex flex-col items-center gap-1.5 p-2 rounded-xl border transition-all"
                :class="
                  backgroundColor === color.value
                    ? 'border-primary bg-primary/5 text-primary'
                    : 'border-border bg-muted/30 text-muted-foreground hover:border-border/80'
                "
              >
                <div
                  class="w-6 h-6 rounded-md border border-border/50"
                  :class="{ 'transparency-grid-sm': color.value === '#00000000' }"
                  :style="{
                    backgroundColor: color.value !== '#00000000' ? color.value : 'transparent'
                  }"
                ></div>
                <span class="text-[10px] font-bold">{{ color.label }}</span>
              </button>
              <div
                class="relative flex flex-col items-center gap-1.5 p-2 rounded-xl border border-border bg-muted/30"
              >
                <input
                  type="color"
                  v-model="backgroundColor"
                  class="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />
                <div
                  class="w-6 h-6 rounded-md border border-border/50 shadow-sm"
                  :style="{
                    backgroundColor: !['#00000000', '#ffffff', '#000000'].includes(backgroundColor)
                      ? backgroundColor
                      : '#999'
                  }"
                ></div>
                <span class="text-[10px] font-bold text-muted-foreground">自定义</span>
              </div>
            </div>
            <div class="flex gap-2 mt-1">
              <input
                type="text"
                v-model="backgroundColor"
                class="flex-1 px-4 py-2 bg-muted/50 border border-border/50 rounded-xl text-foreground font-mono text-xs outline-none focus:border-primary/50 focus:bg-muted transition-all"
                placeholder="HEX #RRGGBB"
              />
            </div>
          </div>
        </div>

        <div :class="bottomCtaClasses">
          <AppButton
            size="lg"
            variant="cta"
            class="w-full shadow-lg"
            :loading="isProcessing"
            :disabled="!hasEnoughImages"
            @click="handleCombine"
          >
            <template #icon>
              <Layers v-if="!isProcessing" :size="19" class="mr-2.5" />
            </template>
            {{ isProcessing ? '正在拼合...' : '生成并下载' }}
          </AppButton>
        </div>
      </div>
    </template>
  </WorkspaceLayout>
</template>

<style scoped>
input[type='color']::-webkit-color-swatch-wrapper {
  padding: 0;
}
input[type='color']::-webkit-color-swatch {
  border: none;
}

.custom-scrollbar::-webkit-scrollbar {
  width: 5px;
  height: 5px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: hsl(var(--border));
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

/* Preview list transitions */
.preview-list-move,
.preview-list-enter-active,
.preview-list-leave-active {
  transition: all 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}

.preview-list-enter-from,
.preview-list-leave-to {
  opacity: 0;
  transform: scale(0.92) translateY(12px);
}

.preview-list-leave-active {
  position: absolute;
}

.shadow-elevated {
  box-shadow:
    0 10px 30px -10px rgba(0, 0, 0, 0.12),
    0 4px 10px -5px rgba(0, 0, 0, 0.05);
}
</style>
