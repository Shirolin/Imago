<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useImageStore } from '../stores/imageStore'
import WorkspaceLayout from '../components/layout/WorkspaceLayout.vue'
import AppButton from '../components/common/AppButton.vue'
import AppSectionHeader from '../components/common/AppSectionHeader.vue'
import AppSlider from '../components/common/AppSlider.vue'
import AppSelect from '../components/common/AppSelect.vue'
import ImageSelectionStatus from '../components/common/ImageSelectionStatus.vue'
import ImageActionsToolbar from '../components/common/ImageActionsToolbar.vue'
import CropBox from '../components/common/CropBox.vue'
import {
  RotateCw,
  FlipHorizontal,
  FlipVertical,
  Check,
  X,
  Square,
  CheckSquare,
  ListOrdered,
  Scissors,
  FileType,
  Maximize2,
  Undo2,
  RefreshCcw
} from 'lucide-vue-next'
import { cropEngine } from '../lib/engines/cropEngine'
import { useImageProcessor } from '../composables/useImageProcessor'

const store = useImageStore()

// --- 状态 (Refs) ---
const selectedImageId = ref<string | null>(store.images[0]?.id || null)
const rotation = ref(0)
const flipH = ref(false)
const flipV = ref(false)
const currentRatio = ref<number | undefined>(undefined) // undefined for free
const outputQuality = ref(0.85)
const outputFormat = ref<string>('original')
const preserveExif = ref(false)

// 当前裁剪坐标 (从 CropBox 组件传回)
const cropCoords = ref({ x: 0, y: 0, width: 0, height: 0, usePercentage: true })

// 历史记录状态
interface CropState {
  rotation: number
  flipH: boolean
  flipV: boolean
  cropCoords: { x: number; y: number; width: number; height: number; usePercentage: boolean }
}
const history = ref<CropState[]>([])
const historyIndex = ref(-1)

const { isProcessing, processSelected, processSingle } = useImageProcessor(cropEngine)

// --- 业务函数 (Functions) ---

const handleReset = () => {
  rotation.value = 0
  flipH.value = false
  flipV.value = false
  currentRatio.value = undefined
}

const applyState = (state: CropState) => {
  rotation.value = state.rotation
  flipH.value = state.flipH
  flipV.value = state.flipV
  cropCoords.value = { ...state.cropCoords }
}

const saveState = () => {
  const newState: CropState = {
    rotation: rotation.value,
    flipH: flipH.value,
    flipV: flipV.value,
    cropCoords: { ...cropCoords.value }
  }

  // 如果新状态与当前指向的状态一致，则不记录
  const currentState = history.value[historyIndex.value]
  if (currentState && JSON.stringify(currentState) === JSON.stringify(newState)) return

  // 丢弃指针之后的“未来”状态
  history.value = history.value.slice(0, historyIndex.value + 1)
  history.value.push(newState)

  // 限制栈大小为 20
  if (history.value.length > 20) {
    history.value.shift()
  } else {
    historyIndex.value++
  }
}

const handleUndo = () => {
  if (historyIndex.value > 0) {
    historyIndex.value--
    const state = history.value[historyIndex.value]
    if (state) applyState(state)
  }
}

const handleRedo = () => {
  if (historyIndex.value < history.value.length - 1) {
    historyIndex.value++
    const state = history.value[historyIndex.value]
    if (state) applyState(state)
  }
}

const handleRotate = () => {
  rotation.value = (rotation.value + 90) % 360
}

const handleFlipH = () => {
  flipH.value = !flipH.value
}

const handleFlipV = () => {
  flipV.value = !flipV.value
}

const handleCropChange = (coords: {
  x: number
  y: number
  width: number
  height: number
  usePercentage: boolean
}) => {
  cropCoords.value = coords
}

const handleApply = async () => {
  if (!selectedImage.value || isProcessing.value) return

  // 加固：对大批量处理增加确认
  if (
    store.selectedCount > 5 &&
    !confirm(`确定要同时裁剪选中的 ${store.selectedCount} 张图片吗？`)
  ) {
    return
  }

  const options = {
    ...cropCoords.value,
    rotation: rotation.value,
    flipH: flipH.value,
    flipV: flipV.value,
    quality: Math.max(0.1, Math.min(1.0, outputQuality.value)),
    format: outputFormat.value === 'original' ? undefined : outputFormat.value,
    preserveExif: preserveExif.value
  }

  if (store.selectedCount > 0) {
    await processSelected(options)
  } else {
    await processSingle(selectedImage.value.id, options)
  }
}

// --- 计算属性 (Computed) ---

const canUndo = computed(() => historyIndex.value > 0)
const canRedo = computed(() => historyIndex.value < history.value.length - 1)

const selectedImage = computed(() => {
  return store.images.find((img) => img.id === selectedImageId.value) || store.images[0]
})

const aspectRatios = [
  { label: '自由', value: 0 },
  { label: '1:1', value: 1 },
  { label: '4:3', value: 4 / 3 },
  { label: '16:9', value: 16 / 9 },
  { label: '9:16', value: 9 / 16 },
  { label: '2:3', value: 2 / 3 }
]

const formatOptions = [
  { label: '保留原格式', value: 'original' },
  { label: 'JPEG', value: 'image/jpeg' },
  { label: 'PNG', value: 'image/png' },
  { label: 'WebP', value: 'image/webp' }
]

const buttonText = computed(() => {
  if (isProcessing.value) return '正在批量处理...'
  if (store.selectedCount > 0) return `裁剪选中的 ${store.selectedCount} 张图片`
  if (store.images.length > 1) return `应用此裁剪到所有图片 (${store.images.length})`
  return '应用裁剪并保存'
})

// --- 副作用与监听 (Watchers) ---

// 初始化/切换图片
watch(
  selectedImageId,
  () => {
    history.value = []
    historyIndex.value = -1
    handleReset()
    // 延迟记录初始状态
    setTimeout(saveState, 100)
  },
  { immediate: true }
)

// 自动切换到第一张图
watch(
  () => store.images.length,
  (newLen) => {
    if (newLen > 0 && !selectedImageId.value) {
      selectedImageId.value = store.images[0]?.id || null
    } else if (newLen === 0) {
      selectedImageId.value = null
    }
  },
  { immediate: true }
)

// 监听重要参数变化并记录（防抖处理防止频繁记录）
let saveTimer: ReturnType<typeof setTimeout> | null = null
watch(
  [rotation, flipH, flipV, cropCoords],
  () => {
    if (saveTimer) clearTimeout(saveTimer)
    saveTimer = setTimeout(saveState, 500)
  },
  { deep: true }
)
</script>

<template>
  <div class="h-full flex flex-col">
    <WorkspaceLayout show-sidebar no-scroll>
      <template #header-left>
        <ImageSelectionStatus />
      </template>

      <template #header-actions>
        <ImageActionsToolbar
          :is-processing="isProcessing"
          show-clear-all
          zip-prefix="_Imago_Cropped"
        />
      </template>

      <template #content>
        <div class="h-full flex flex-col p-4 md:p-6 lg:p-8 overflow-hidden min-h-0">
          <!-- 裁剪主区域 - 加固：使用 flex-1 配合 overflow-hidden 确保不撑破布局 -->
          <div
            class="flex-1 bg-background/40 backdrop-blur-sm rounded-[2rem] border border-border/50 flex items-center justify-center relative overflow-hidden shadow-2xl min-h-0"
            style="
              background-image: radial-gradient(
                circle at 2px 2px,
                hsl(var(--border) / 0.3) 1px,
                transparent 0
              );
              background-size: 32px 32px;
            "
          >
            <!-- 加固：max-w/h 使用百分比 + 视口单位，确保长图在任何屏幕下都有操作空间 -->
            <div
              v-if="selectedImage"
              class="relative max-w-[95%] max-h-[95%] transition-transform duration-500 will-change-transform flex items-center justify-center"
              :style="{
                transform: `rotate(${rotation}deg) scale(${flipH ? -1 : 1}, ${flipV ? -1 : 1})`
              }"
            >
              <CropBox
                :image-url="selectedImage.preview"
                :aspect-ratio="currentRatio"
                @change="handleCropChange"
              />
            </div>

            <div v-else class="flex flex-col items-center gap-4 text-muted-foreground/40">
              <Scissors :size="64" stroke-width="1" />
              <p class="text-sm font-bold uppercase tracking-widest">请选择图片开始裁剪</p>
            </div>
          </div>

          <!-- 底部快速操作 (移动端友好) -->
          <div class="mt-6 flex items-center justify-center gap-4 md:hidden">
            <button
              @click="handleRotate"
              class="p-4 bg-card border border-border rounded-2xl active:scale-95 transition-all"
            >
              <RotateCw :size="20" />
            </button>
            <button
              @click="handleFlipH"
              class="p-4 bg-card border border-border rounded-2xl active:scale-95 transition-all"
            >
              <FlipHorizontal :size="20" />
            </button>
            <button
              @click="handleApply"
              class="flex-1 h-14 bg-primary text-primary-foreground font-bold rounded-2xl active:scale-95 transition-all"
            >
              确认裁剪
            </button>
          </div>
        </div>
      </template>

      <template #sidebar>
        <div class="flex flex-col h-full bg-card/60 backdrop-blur-xl border-l border-border/50">
          <div class="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
            <!-- 1. 裁剪比例 -->
            <section class="space-y-4">
              <AppSectionHeader title="纵横比" :icon="Maximize2" />
              <div class="grid grid-cols-3 gap-2">
                <button
                  v-for="ratio in aspectRatios"
                  :key="ratio.label"
                  @click="currentRatio = ratio.value || undefined"
                  class="py-2.5 rounded-xl border text-[0.65rem] font-bold transition-all active:scale-95"
                  :class="
                    currentRatio === ratio.value ||
                    (ratio.value === 0 && currentRatio === undefined)
                      ? 'bg-primary border-primary text-primary-foreground shadow-lg shadow-primary/20'
                      : 'bg-background border-border text-foreground hover:border-primary/40'
                  "
                >
                  {{ ratio.label }}
                </button>
              </div>
            </section>

            <!-- 2. 变换控制 -->
            <section class="space-y-4">
              <AppSectionHeader title="变换与历史" :icon="RotateCw" />
              <div class="grid grid-cols-4 gap-2">
                <button
                  @click="handleRotate"
                  class="aspect-square flex items-center justify-center rounded-xl bg-background border border-border hover:border-primary hover:text-primary transition-all active:scale-90"
                  title="旋转 90°"
                >
                  <RotateCw :size="18" />
                </button>
                <button
                  @click="handleFlipH"
                  :class="{ 'bg-primary/10 border-primary text-primary': flipH }"
                  class="aspect-square flex items-center justify-center rounded-xl bg-background border border-border hover:border-primary transition-all active:scale-90"
                  title="水平翻转"
                >
                  <FlipHorizontal :size="18" />
                </button>

                <!-- 历史控制 -->
                <button
                  @click="handleUndo"
                  :disabled="!canUndo"
                  class="aspect-square flex items-center justify-center rounded-xl bg-background border border-border hover:border-primary transition-all active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="撤销 (Ctrl+Z)"
                >
                  <Undo2 :size="18" />
                </button>
                <button
                  @click="handleRedo"
                  :disabled="!canRedo"
                  class="aspect-square flex items-center justify-center rounded-xl bg-background border border-border hover:border-primary transition-all active:scale-90 disabled:opacity-30 disabled:cursor-not-allowed"
                  title="重做 (Ctrl+Y)"
                >
                  <RefreshCcw :size="18" />
                </button>
              </div>
              <div class="grid grid-cols-2 gap-2 mt-2">
                <button
                  @click="handleFlipV"
                  :class="{ 'bg-primary/10 border-primary text-primary': flipV }"
                  class="h-10 flex items-center justify-center gap-2 rounded-xl bg-background border border-border hover:border-primary transition-all active:scale-95"
                >
                  <FlipVertical :size="16" />
                  <span class="text-[0.65rem] font-bold">垂直翻转</span>
                </button>
                <button
                  @click="handleReset"
                  class="h-10 flex items-center justify-center gap-2 rounded-xl bg-background border border-border hover:text-destructive hover:border-destructive transition-all active:scale-95"
                >
                  <Undo2 :size="16" class="rotate-45" />
                  <span class="text-[0.65rem] font-bold">重置全图</span>
                </button>
              </div>
            </section>

            <!-- 3. 输出设置 -->
            <section class="space-y-4">
              <AppSectionHeader title="导出设置" :icon="FileType" />
              <div class="space-y-4 bg-muted/20 p-4 rounded-2xl border border-border/40">
                <AppSelect v-model="outputFormat" :options="formatOptions" />
                <AppSlider
                  v-if="outputFormat !== 'image/png' && outputFormat !== 'original'"
                  v-model="outputQuality"
                  label="画质"
                  :min="0.1"
                  :max="1.0"
                  :step="0.05"
                  unit=""
                />
              </div>
            </section>

            <!-- 4. 待处理队列 -->
            <section class="space-y-4">
              <AppSectionHeader title="待处理队列" :icon="ListOrdered" />
              <div class="space-y-2">
                <div
                  v-for="img in store.images"
                  :key="img.id"
                  class="flex items-center gap-3 p-2.5 rounded-xl cursor-pointer border-2 transition-all group relative"
                  :class="
                    selectedImageId === img.id
                      ? 'bg-primary/5 border-primary shadow-inner'
                      : 'border-transparent bg-background/40 hover:bg-muted/50'
                  "
                  @click="selectedImageId = img.id"
                >
                  <!-- 多选框触发区 -->
                  <div
                    class="flex shrink-0 transition-colors"
                    @click.stop="store.toggleSelection(img.id)"
                  >
                    <CheckSquare
                      v-if="store.selectedIds.has(img.id)"
                      :size="18"
                      class="text-primary drop-shadow-[0_0_8px_rgba(var(--primary-rgb),0.4)]"
                    />
                    <Square
                      v-else
                      :size="18"
                      class="text-muted-foreground/40 group-hover:text-muted-foreground"
                    />
                  </div>

                  <div
                    class="w-10 h-10 rounded-lg overflow-hidden shrink-0 border border-border/50 group-hover:scale-105 transition-transform"
                  >
                    <img :src="img.preview" class="w-full h-full object-cover" />
                  </div>
                  <div class="flex-1 min-w-0">
                    <p class="text-[0.7rem] font-bold text-foreground truncate">
                      {{ img.file.name }}
                    </p>
                    <p class="text-[0.6rem] text-muted-foreground font-mono mt-0.5">
                      {{ img.width }}x{{ img.height }}
                    </p>
                  </div>
                  <div
                    v-if="img.status === 'done'"
                    class="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center"
                  >
                    <Check :size="12" class="text-primary" />
                  </div>
                  <button
                    @click.stop="store.removeImage(img.id)"
                    class="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-destructive/10 hover:text-destructive rounded-lg transition-all"
                  >
                    <X :size="14" />
                  </button>
                </div>
              </div>
            </section>
          </div>

          <!-- 底部执行 -->
          <div
            class="p-6 bg-gradient-to-t from-card via-card to-transparent pt-12 mt-auto border-t border-border/40 shrink-0"
          >
            <AppButton
              size="lg"
              variant="cta"
              class="w-full h-14 rounded-2xl shadow-xl shadow-primary/20"
              :loading="isProcessing"
              :disabled="!selectedImage"
              @click="handleApply"
            >
              <template #icon><Scissors v-if="!isProcessing" :size="18" class="mr-2" /></template>
              {{ buttonText }}
            </AppButton>
          </div>
        </div>
      </template>
    </WorkspaceLayout>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: hsl(var(--border));
  border-radius: 10px;
}

.no-scrollbar::-webkit-scrollbar {
  display: none;
}
</style>
