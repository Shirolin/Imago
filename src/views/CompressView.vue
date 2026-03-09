<script setup lang="ts">
import { ref, computed, watch } from 'vue'
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
import AppSelect from '../components/common/AppSelect.vue'
import ImageCompare from '../components/common/ImageCompare.vue'
import AppModal from '../components/common/AppModal.vue'
import {
  Zap,
  ArrowRight,
  Settings2,
  ImageIcon,
  FileType,
  ChevronDown,
  ChevronUp,
  Palette,
  Check
} from 'lucide-vue-next'
import { compressEngine } from '../lib/engines/compressEngine'
import { useImageProcessor } from '../composables/useImageProcessor'
import type { ImageItem } from '../stores/imageStore'

const store = useImageStore()
const { formatSize, downloadImage } = useFileHelpers()

// 状态控制
const compressionMode = ref<'quality' | 'target'>('quality')
const compressionQuality = ref(0.8)
const pngColors = ref(256)
const pngEffort = ref(7)
const targetSizeKB = ref(500)
const outputFormat = ref<
  | 'original'
  | 'image/webp'
  | 'image/jpeg'
  | 'image/png'
  | 'image/avif'
  | 'image/jxl'
  | 'image/heif'
  | 'image/webp2'
  | 'image/jpeg-li'
>('original')
const showAdvanced = ref(false)
const keepOriginalIfLarger = ref(true)
const maxWidth = ref<number | undefined>(undefined)
const maxHeight = ref<number | undefined>(undefined)

// 格式推荐质量映射
const recommendedQualities: Record<string, number> = {
  'image/jpeg-li': 0.8,
  'image/jpeg': 0.8,
  'image/webp': 0.75,
  'image/avif': 0.65,
  'image/heif': 0.6,
  'image/jxl': 0.85,
  'image/webp2': 0.7
}

// 对比预览状态
const showCompareModal = ref(false)
const comparingImage = ref<ImageItem | null>(null)
const processedPreviewUrl = ref<string | null>(null)

const { isProcessing, processAll, processSelected } = useImageProcessor(compressEngine)

// 监听格式变化，自动设置推荐质量
watch(outputFormat, (newFormat) => {
  if (recommendedQualities[newFormat]) {
    compressionQuality.value = recommendedQualities[newFormat]
  }
})

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

const closeCompare = () => {
  showCompareModal.value = false
}

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
  { label: 'JPEG (Google 增强，最佳兼容)', value: 'image/jpeg-li' },
  { label: 'WebP (全能标准，极高压缩率)', value: 'image/webp' },
  { label: 'AVIF (最先进格式，极致压缩)', value: 'image/avif' },
  { label: 'PNG (无损压缩，支持透明)', value: 'image/png' },
  { label: 'JPEG XL (次世代全能标准)', value: 'image/jxl' },
  { label: 'HEIF/HEIC (高效率，苹果标准)', value: 'image/heif' },
  { label: 'WebP2 (Google 实验性后继者)', value: 'image/webp2' }
]

const handleProcess = () => {
  const options = {
    quality: compressionQuality.value,
    maxSizeMB: compressionMode.value === 'target' ? targetSizeKB.value / 1024 : undefined,
    maxWidth: maxWidth.value,
    maxHeight: maxHeight.value,
    format: outputFormat.value === 'original' ? undefined : (outputFormat.value as any),
    colors: outputFormat.value === 'image/png' ? pngColors.value : undefined,
    effort: outputFormat.value === 'image/png' ? pngEffort.value : undefined,
    keepOriginalIfLarger: keepOriginalIfLarger.value
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
        <ImageActionsToolbar :is-processing="isProcessing" show-clear-all zip-prefix="图片压缩" />
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
              <!-- PNG 特殊处理：颜色量化与优化强度 -->
              <template v-if="outputFormat === 'image/png'">
                <div class="space-y-6">
                  <AppSlider
                    v-model="pngColors"
                    label="最大颜色数"
                    :min="2"
                    :max="256"
                    :step="1"
                    unit=""
                    :icon="Palette"
                  >
                    <template #default="{ modelValue }">
                      <span
                        class="text-primary bg-primary/10 px-1.5 py-0.5 rounded leading-none text-xs font-bold"
                        >{{ modelValue }} 色</span
                      >
                    </template>
                  </AppSlider>

                  <AppSlider
                    v-model="pngEffort"
                    label="优化强度"
                    :min="1"
                    :max="9"
                    :step="1"
                    unit=""
                    :icon="Zap"
                  >
                    <template #default="{ modelValue }">
                      <span
                        class="text-primary bg-primary/10 px-1.5 py-0.5 rounded leading-none text-xs font-bold"
                      >
                        Level {{ modelValue }}
                        <span v-if="modelValue === 7" class="ml-1 opacity-80 text-[10px]"
                          >(推荐)</span
                        >
                      </span>
                    </template>
                  </AppSlider>
                </div>
                <p class="text-[0.65rem] text-muted-foreground/80 leading-relaxed italic mt-2">
                  提示: 强度越高，能在保持颜色数的前提下获得更小的体积，但处理时间会增加。
                </p>
              </template>

              <!-- 其他格式：质量百分比 (带智能推荐) -->
              <template v-else>
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
                    >
                      {{ Math.round(modelValue * 100) }}%
                      <span
                        v-if="modelValue === recommendedQualities[outputFormat]"
                        class="ml-1 opacity-80 text-[10px]"
                        >(推荐)</span
                      >
                    </span>
                  </template>
                </AppSlider>
                <div
                  class="flex justify-between text-[0.65rem] text-muted-foreground font-bold px-1 uppercase tracking-tight"
                >
                  <span>高压缩</span>
                  <span>高画质</span>
                </div>
              </template>
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
            <AppSelect v-model="outputFormat" :options="formatOptions" />
          </div>

          <div class="flex flex-col gap-3">
            <button
              @click="showAdvanced = !showAdvanced"
              class="flex items-center justify-between group hover:text-primary transition-colors"
            >
              <AppSectionHeader title="进阶设置" :icon="Settings2" />
              <component
                :is="showAdvanced ? ChevronUp : ChevronDown"
                :size="16"
                class="text-muted-foreground group-hover:text-primary"
              />
            </button>

            <div
              v-if="showAdvanced"
              class="space-y-5 pt-1 animate-in fade-in slide-in-from-top-2 duration-300"
            >
              <div class="flex flex-col gap-3">
                <label class="text-[0.65rem] font-bold text-muted-foreground uppercase px-1"
                  >调整分辨率 (可选)</label
                >
                <div class="grid grid-cols-2 gap-3">
                  <div class="space-y-1.5">
                    <input
                      type="number"
                      v-model.number="maxWidth"
                      class="w-full p-2.5 bg-muted/30 border border-border/50 rounded-xl text-xs font-bold focus:border-primary outline-none"
                      placeholder="最大宽度"
                    />
                  </div>
                  <div class="space-y-1.5">
                    <input
                      type="number"
                      v-model.number="maxHeight"
                      class="w-full p-2.5 bg-muted/30 border border-border/50 rounded-xl text-xs font-bold focus:border-primary outline-none"
                      placeholder="最大高度"
                    />
                  </div>
                </div>
              </div>

              <label
                class="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-muted-foreground hover:text-foreground transition-all group p-1"
              >
                <div
                  class="relative w-5 h-5 rounded-md border border-border bg-muted flex items-center justify-center transition-all group-hover:border-primary"
                  :class="{ 'bg-primary border-primary': keepOriginalIfLarger }"
                >
                  <input
                    type="checkbox"
                    v-model="keepOriginalIfLarger"
                    class="absolute opacity-0 w-full h-full cursor-pointer z-10"
                  />
                  <Check v-if="keepOriginalIfLarger" :size="12" class="text-white" />
                </div>
                <span>体积变大时保留原图</span>
              </label>
            </div>
          </div>

          <AppTip>
            {{
              keepOriginalIfLarger
                ? '若压缩后体积反而变大，系统将自动保留原始文件。'
                : '系统将强制保存压缩后的文件，即便体积可能由于格式转换而变大。'
            }}
          </AppTip>

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
