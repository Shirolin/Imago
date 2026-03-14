<script setup lang="ts">
import { ref, computed } from 'vue'
import { useImageStore } from '../stores/imageStore'
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
  X
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

// --- State ---
const combineDirection = ref<'vertical' | 'horizontal' | 'grid'>('vertical')
const alignment = ref<'start' | 'center' | 'end'>('center')
const spacing = ref(10)
const backgroundColor = ref('#00000000') // Default transparent

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
  () =>
    'mt-auto pt-6 border-t border-border bg-background/80 backdrop-blur sticky bottom-0 -mx-6 px-6 pb-6 z-10 shadow-[0_-12px_24px_-12px_rgba(0,0,0,0.1)]'
)
const contentClasses = computed(
  () =>
    'flex-1 overflow-auto p-12 flex flex-col items-center min-h-0 bg-neutral-900/5 custom-scrollbar focus:outline-none'
)

const previewCanvasClasses = computed(() => {
  const base =
    'relative transition-all duration-300 ease-out p-1 ring-1 ring-border/50 shadow-2xl rounded-sm'
  return base
})

const previewListStyles = computed(() => {
  const isTransparent = backgroundColor.value === '#00000000'

  const styles: Record<string, string | number> = {
    display: 'flex',
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
    padding: `${spacing.value > 20 ? 0 : 4}px`,
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
      <ImageSelectionStatus />
    </template>

    <template #header-actions>
      <ImageActionsToolbar show-clear-all />
    </template>

    <template #content>
      <div :class="contentClasses" tabindex="-1">
        <AppTip v-if="!hasEnoughImages" :icon="Info" class="mb-8 max-w-md">
          请至少上传两张图片以开启合并。当前模式支持纵向长图、横向拼接及智能网格。
        </AppTip>

        <div
          v-if="store.images.length > 0"
          :class="previewCanvasClasses"
          :style="previewListStyles"
          role="list"
          aria-label="图片拼接预览区"
        >
          <TransitionGroup name="preview-list">
            <div
              v-for="(img, index) in store.images"
              :key="img.id"
              :class="itemWrapperClasses(index)"
              draggable="true"
              tabindex="0"
              role="listitem"
              :aria-label="`图片 ${index + 1}: ${img.file.name}`"
              @dragstart="onDragStart(index)"
              @dragover="(e) => onDragOver(e, index)"
              @drop="onDrop(index)"
              @dragend="onDragEnd"
              @keydown="(e) => handleKeyDown(e, index)"
            >
              <!-- 纯净预览 -->
              <div
                class="relative overflow-hidden shadow-sm hover:shadow-md transition-shadow rounded-sm bg-background"
              >
                <img
                  :src="img.preview"
                  class="block max-w-[240px] md:max-w-[400px] h-auto pointer-events-none select-none"
                  :alt="img.file.name"
                />

                <!-- 悬浮操作 -->
                <div
                  class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity flex flex-col items-center justify-center gap-2"
                >
                  <button
                    @click.stop="store.removeImage(img.id)"
                    class="p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors shadow-lg active:scale-90 focus:ring-2 focus:ring-white outline-none"
                    title="移除此图"
                    tabindex="0"
                  >
                    <X :size="14" />
                  </button>
                  <div
                    class="px-2 py-0.5 bg-white/20 backdrop-blur-md rounded text-[10px] text-white font-medium select-none"
                  >
                    #{{ index + 1 }}
                  </div>
                  <div class="cursor-grab active:cursor-grabbing p-1 text-white/70 hidden md:block">
                    <GripVertical :size="16" />
                  </div>
                </div>
              </div>

              <!-- 排序指示器 -->
              <div
                v-if="dropTargetIndex === index && dragIndex !== index"
                class="absolute inset-0 bg-primary/20 border-2 border-primary border-dashed rounded-sm pointer-events-none z-30 flex items-center justify-center"
              >
                <div
                  class="bg-primary text-white text-[10px] px-2 py-1 rounded-full font-bold shadow-lg animate-pulse"
                >
                  置于此处
                </div>
              </div>
            </div>
          </TransitionGroup>
        </div>
      </div>
    </template>

    <template #sidebar>
      <div :class="sidebarClasses">
        <div class="flex flex-col gap-6 pb-24">
          <!-- 设置区块 -->
          <div class="flex flex-col gap-4">
            <AppSectionHeader title="拼接模式" :icon="Settings2" />
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
            <div
              class="flex items-center justify-between font-bold text-[0.85rem] text-foreground/70 uppercase tracking-wider"
            >
              <label for="bg-color-input">画布背景</label>
              <button
                @click="backgroundColor = '#00000000'"
                class="text-[10px] text-primary hover:underline focus:outline-none focus:ring-1 focus:ring-primary rounded px-1"
              >
                重置透明
              </button>
            </div>
            <div class="flex gap-3">
              <div class="relative w-11 h-11 shrink-0">
                <input
                  id="bg-color-input"
                  type="color"
                  v-model="backgroundColor"
                  class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                  aria-label="选择背景颜色"
                />
                <div
                  class="w-full h-full border-2 border-border rounded-xl shadow-sm overflow-hidden bg-[url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAAXNSR0IArs4c6QAAACBJREFUGFdjZEADJv///2f4z8DAwMgABYwC+AzYJKGSAEYpBAtunp26AAAAAElFTkSuQmCC')] bg-repeat"
                >
                  <div
                    class="w-full h-full transition-colors duration-300"
                    :style="{
                      backgroundColor:
                        backgroundColor === '#00000000' ? 'transparent' : backgroundColor
                    }"
                  ></div>
                </div>
              </div>
              <input
                type="text"
                v-model="backgroundColor"
                class="flex-1 px-4 bg-muted/50 border border-border/50 rounded-xl text-foreground font-mono text-xs outline-none focus:border-primary/50 focus:bg-muted transition-all"
                placeholder="HEX 或 #00000000"
                aria-label="背景颜色 HEX 值"
              />
            </div>
          </div>
        </div>

        <div :class="bottomCtaClasses">
          <AppButton
            size="lg"
            variant="cta"
            class="w-full shadow-xl shadow-primary/20"
            :loading="isProcessing"
            :disabled="!hasEnoughImages"
            @click="handleCombine"
          >
            <template #icon>
              <Layers v-if="!isProcessing" :size="19" class="mr-2.5" />
            </template>
            {{ isProcessing ? '正在拼合...' : '生成并下载' }}
          </AppButton>
          <div
            class="text-center text-[10px] text-muted-foreground mt-3 flex flex-col items-center gap-1 italic"
          >
            <p class="flex items-center gap-1.5">
              <GripVertical :size="10" /> 提示：直接拖动图片可以实时预览排序效果
            </p>
            <p class="opacity-60 text-[9px]">支持键盘 Ctrl + 方向键 移动图片顺序</p>
          </div>
        </div>
      </div>
    </template>
  </WorkspaceLayout>
</template>

<style>
:root {
  --checkerboard-pattern: url('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAQAAAAECAYAAACp8Z5+AAAAAXNSR0IArs4c6QAAACBJREFUGFdjZEADJv///2f4z8DAwMgABYwC+AzYJKGSAEYpBAtunp26AAAAAElFTkSuQmCC');
}
</style>

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
  background: var(--border);
  border-radius: 10px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
</style>
