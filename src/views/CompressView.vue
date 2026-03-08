<script setup lang="ts">
import { ref, computed } from 'vue'
import { useImageStore } from '../stores/imageStore'
import { useFileHelpers } from '../composables/useFileHelpers'
import WorkspaceLayout from '../components/layout/WorkspaceLayout.vue'
import ImageCard from '../components/common/ImageCard.vue'
import AppButton from '../components/common/AppButton.vue'
import ImageSelectionStatus from '../components/common/ImageSelectionStatus.vue'
import ImageActionsToolbar from '../components/common/ImageActionsToolbar.vue'
import AppSectionHeader from '../components/common/AppSectionHeader.vue'
import AppSlider from '../components/common/AppSlider.vue'
import AppTip from '../components/common/AppTip.vue'
import AppSegmentedControl from '../components/common/AppSegmentedControl.vue'
import ImageCompare from '../components/common/ImageCompare.vue'
import AppModal from '../components/common/AppModal.vue'
import {
  Zap,
  ArrowRight,
  Settings2,
  ImageIcon,
  Maximize2,
  FileType,
  ChevronDown,
  ChevronUp
} from 'lucide-vue-next'
import { compressEngine } from '../lib/engines/compressEngine'
import { useImageProcessor } from '../composables/useImageProcessor'
import type { ImageItem } from '../stores/imageStore'

const store = useImageStore()
const { formatSize, downloadImage } = useFileHelpers()

// 状态控制
const compressionMode = ref<'quality' | 'target'>('quality')
const compressionQuality = ref(0.8)
const targetSizeKB = ref(500)
const outputFormat = ref<'original' | 'image/webp' | 'image/jpeg'>('original')
const showAdvanced = ref(false)
const maxWidth = ref<number | undefined>(undefined)
const maxHeight = ref<number | undefined>(undefined)

// 对比预览状态
const showCompareModal = ref(false)
const comparingImage = ref<ImageItem | null>(null)
const processedPreviewUrl = ref<string | null>(null)

const { isProcessing, processAll, processSelected } = useImageProcessor(compressEngine)

// 对比逻辑
const handleCompare = (id: string) => {
  const img = store.images.find((i) => i.id === id)

  if (img && img.processedBlob) {
    if (processedPreviewUrl.value) URL.revokeObjectURL(processedPreviewUrl.value)
    processedPreviewUrl.value = URL.createObjectURL(img.processedBlob)
    comparingImage.value = img
    showCompareModal.value = true
  }
}

// 仅仅关闭显示状态，让动画平滑开始
const closeCompare = () => {
  showCompareModal.value = false
}

// 核心优化：在动画彻底结束（消失在屏幕外）后再销毁资源
const handleModalLeave = () => {
  if (processedPreviewUrl.value) {
    URL.revokeObjectURL(processedPreviewUrl.value)
    processedPreviewUrl.value = null
  }
  comparingImage.value = null
}

// 选项配置
const modeOptions = [
  { label: '画质优先', value: 'quality', icon: ImageIcon },
  { label: '指定体积', value: 'target', icon: Zap }
]

const formatOptions = [
  { label: '保留原格式', value: 'original' },
  { label: 'WebP (高压缩率)', value: 'image/webp' },
  { label: 'JPEG (高兼容性)', value: 'image/jpeg' }
]

const handleProcess = () => {
  const options = {
    quality: compressionQuality.value,
    maxSizeMB: compressionMode.value === 'target' ? targetSizeKB.value / 1024 : undefined,
    maxWidth: maxWidth.value,
    maxHeight: maxHeight.value,
    format: outputFormat.value === 'original' ? undefined : outputFormat.value
  }

  if (store.selectedCount > 0) {
    processSelected(options)
  } else {
    processAll(options)
  }
}

const handleDownload = (id: string) => {
  const item = store.images.find((img) => img.id === id)
  if (item?.processedBlob) {
    downloadImage(item.processedBlob, item.file.name, 'compressed_')
  }
}

// 按钮文本动态显示
const buttonText = computed(() => {
  if (isProcessing.value) return '正在处理...'
  if (store.selectedCount > 0) return `压缩选中的 ${store.selectedCount} 张`
  return '压缩全部图片'
})
</script>

<template>
  <div class="contents">
    <WorkspaceLayout show-sidebar>
      <template #header-left>
        <ImageSelectionStatus />
      </template>

      <template #header-actions>
        <ImageActionsToolbar :is-processing="isProcessing" show-clear-all zip-prefix="Compress" />
      </template>
      <template #content>
        <ImageCard
          v-for="img in store.images"
          :key="img.id"
          :image="img"
          :is-selected="store.selectedIds.has(img.id)"
          @toggle="store.toggleSelection"
          @remove="store.removeImage"
          @download="handleDownload"
          @compare="handleCompare"
        >
          <template #overlay="{ image }">
            <div
              v-if="image.status === 'done'"
              class="px-2 py-1 rounded-lg text-[0.65rem] font-black flex items-center gap-1 shadow-xl backdrop-blur-md border border-white/10 animate-in fade-in zoom-in-95 duration-300"
              :class="
                image.processedSize === image.originalSize
                  ? 'bg-muted/80 text-muted-foreground'
                  : 'bg-primary text-primary-foreground'
              "
            >
              <template v-if="image.processedSize === image.originalSize">
                <span>已跳过</span>
              </template>
              <template v-else>
                <Zap :size="10" class="fill-current" />
                {{ Math.round((1 - image.processedSize! / image.originalSize) * 100) }}%
              </template>
            </div>
          </template>
          <template #meta="{ image }">
            <div
              class="flex items-center gap-2 md:gap-3 bg-background p-2 md:p-3 rounded-xl md:rounded-2xl mt-1.5 border border-border transition-all duration-300 group-hover:border-primary/20"
            >
              <div class="flex-1 flex flex-col gap-0.5">
                <span
                  class="text-[0.6rem] md:text-[0.65rem] font-extrabold uppercase text-muted-foreground tracking-widest mt-0.5 opacity-80"
                  >原始</span
                >
                <span class="text-[0.75rem] md:text-[0.8125rem] font-bold text-foreground">{{
                  formatSize(image.originalSize)
                }}</span>
              </div>
              <div class="text-muted-foreground/60 flex shrink-0">
                <ArrowRight :size="12" class="md:w-3.5 md:h-3.5" />
              </div>
              <div class="flex-1 flex flex-col gap-0.5">
                <span
                  class="text-[0.6rem] md:text-[0.65rem] font-extrabold uppercase text-muted-foreground tracking-widest mt-0.5 opacity-80"
                  >压缩后</span
                >
                <span
                  class="text-[0.75rem] md:text-[0.8125rem] font-bold transition-colors"
                  :class="image.status === 'done' ? 'text-primary' : 'text-foreground'"
                  >{{ image.status === 'done' ? formatSize(image.processedSize!) : '--' }}</span
                >
              </div>
            </div>
          </template>
        </ImageCard>
      </template>

      <template #sidebar>
        <div class="p-6 flex flex-col gap-6 h-full overflow-y-auto custom-scrollbar">
          <div class="flex flex-col gap-4">
            <AppSectionHeader title="压缩策略" :icon="Settings2" />
            <AppSegmentedControl v-model="compressionMode" :options="modeOptions" />
          </div>

          <div class="flex flex-col gap-5 bg-muted/40 p-4 rounded-2xl border border-border/50">
            <div v-if="compressionMode === 'quality'" class="space-y-4">
              <AppSlider
                v-model="compressionQuality"
                label="压缩质量"
                :min="0.1"
                :max="1.0"
                :step="0.05"
                :unit="''"
              >
                <template #default="{ modelValue }">
                  <span
                    class="text-primary bg-primary/10 px-1.5 py-0.5 rounded leading-none text-xs font-bold"
                    >{{ Math.round(modelValue * 100) }}%</span
                  >
                </template>
              </AppSlider>
              <div
                class="flex justify-between text-[0.65rem] text-muted-foreground font-bold px-1 uppercase tracking-tight"
              >
                <span>高压缩</span>
                <span>高画质</span>
              </div>
            </div>

            <div v-else class="space-y-3">
              <div class="flex justify-between items-end mb-1">
                <label
                  class="text-[0.7rem] font-bold text-muted-foreground uppercase tracking-widest"
                  >目标大小 (KB)</label
                >
                <span class="text-xs font-bold text-primary">{{ targetSizeKB }} KB</span>
              </div>
              <input
                type="number"
                v-model.number="targetSizeKB"
                class="w-full p-3 bg-background border border-border rounded-xl text-sm font-bold focus:border-primary outline-none transition-all"
                placeholder="例如: 200"
              />
              <p class="text-[0.65rem] text-muted-foreground/80 leading-relaxed italic">
                提示: 引擎将尝试通过调整质量接近该数值，但最终结果受限于原图噪点与细节。
              </p>
            </div>
          </div>

          <div class="flex flex-col gap-4">
            <AppSectionHeader title="输出格式" :icon="FileType" />
            <div class="relative group">
              <select
                v-model="outputFormat"
                class="w-full p-3 bg-muted/40 border border-border/50 rounded-xl text-sm font-bold appearance-none outline-none focus:border-primary transition-all pr-10 cursor-pointer"
              >
                <option v-for="opt in formatOptions" :key="opt.value" :value="opt.value">
                  {{ opt.label }}
                </option>
              </select>
              <ChevronDown
                class="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none group-focus-within:rotate-180 transition-transform"
                :size="16"
              />
            </div>
          </div>

          <div class="flex flex-col gap-3">
            <button
              @click="showAdvanced = !showAdvanced"
              class="flex items-center justify-between group hover:text-primary transition-colors"
            >
              <AppSectionHeader
                title="调整分辨率 (Resize)"
                :icon="Maximize2"
                class="cursor-pointer"
              />
              <component
                :is="showAdvanced ? ChevronUp : ChevronDown"
                :size="16"
                class="text-muted-foreground group-hover:text-primary"
              />
            </button>

            <div
              v-if="showAdvanced"
              class="space-y-4 pt-1 animate-in fade-in slide-in-from-top-2 duration-300"
            >
              <div class="grid grid-cols-2 gap-3">
                <div class="space-y-1.5">
                  <label class="text-[0.65rem] font-bold text-muted-foreground uppercase px-1"
                    >最大宽度</label
                  >
                  <input
                    type="number"
                    v-model.number="maxWidth"
                    class="w-full p-2.5 bg-muted/30 border border-border/50 rounded-xl text-xs font-bold focus:border-primary outline-none"
                    placeholder="不限"
                  />
                </div>
                <div class="space-y-1.5">
                  <label class="text-[0.65rem] font-bold text-muted-foreground uppercase px-1"
                    >最大高度</label
                  >
                  <input
                    type="number"
                    v-model.number="maxHeight"
                    class="w-full p-2.5 bg-muted/30 border border-border/50 rounded-xl text-xs font-bold focus:border-primary outline-none"
                    placeholder="不限"
                  />
                </div>
              </div>
            </div>
          </div>

          <AppTip> 处理完全在本地完成。压缩后若体积反而变大，系统将自动保留原图。 </AppTip>
          <div class="mt-auto pt-6 flex flex-col gap-3">
            <AppButton
              size="lg"
              variant="cta"
              class="w-full h-12 rounded-xl"
              :loading="isProcessing"
              :disabled="!store.images.length"
              @click="handleProcess"
            >
              <template #icon>
                <Zap v-if="!isProcessing" :size="18" class="mr-2" />
              </template>
              {{ buttonText }}
            </AppButton>
            <p
              class="text-center text-[0.65rem] text-muted-foreground font-medium uppercase tracking-widest opacity-60"
            >
              {{ isProcessing ? '计算中...' : 'Local Processing' }}
            </p>
          </div>
        </div>
      </template>
    </WorkspaceLayout>

    <AppModal :show="showCompareModal" @close="closeCompare" @after-leave="handleModalLeave">
      <template #header>
        <div class="flex items-center gap-3">
          <div class="p-2 bg-primary rounded-lg text-primary-foreground">
            <ImageIcon :size="20" />
          </div>
          <div v-if="comparingImage">
            <h3 class="text-sm font-bold text-foreground truncate max-w-[180px] md:max-w-md">
              {{ comparingImage.file.name }}
            </h3>
            <p
              class="text-[0.65rem] text-muted-foreground font-bold uppercase tracking-widest leading-none mt-1"
            >
              对比画质细节
            </p>
          </div>
        </div>
      </template>

      <ImageCompare
        v-if="comparingImage && processedPreviewUrl"
        :original-url="comparingImage.preview"
        :processed-url="processedPreviewUrl"
        :original-size="formatSize(comparingImage.originalSize)"
        :processed-size="formatSize(comparingImage.processedSize || 0)"
      />

      <template #footer>
        <p class="text-[0.65rem] text-muted-foreground/60 font-bold uppercase tracking-[0.3em]">
          左右拖动滑块查看压缩前后的像素细节
        </p>
      </template>
    </AppModal>
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
.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: hsl(var(--primary) / 0.3);
}
</style>
