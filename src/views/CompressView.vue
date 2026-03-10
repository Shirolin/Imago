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
  if (store.selectedCount > 0) return `转换选中的 ${store.selectedCount} 张`
  return '开始压缩转换'
})
</script>

<template>
  <div class="h-full flex flex-col">
    <WorkspaceLayout show-sidebar>
      <template #header-left>
        <ImageSelectionStatus />
      </template>

      <template #header-actions>
        <ImageActionsToolbar :is-processing="isProcessing" show-clear-all zip-prefix="压缩转换" />
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
        <div class="flex flex-col h-full bg-card/40 backdrop-blur-sm border-l border-border/50">
          <div class="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-9">
            <!-- 1. 核心策略选择 -->
            <section class="space-y-4">
              <div class="flex items-center justify-between px-0.5">
                <AppSectionHeader title="压缩策略" :icon="Settings2" />
                <span
                  class="text-[0.6rem] font-black text-primary bg-primary/10 px-2 py-0.5 rounded-full uppercase tracking-widest"
                  >Smart</span
                >
              </div>
              <AppSegmentedControl v-model="compressionMode" :options="modeOptions" />
            </section>

            <!-- 2. 参数调节区 (动态切换) -->
            <section class="relative">
              <div class="bg-background/40 rounded-2xl p-5 border border-border/40 shadow-soft">
                <div v-if="compressionMode === 'quality'" class="space-y-7">
                  <!-- PNG 特殊处理 -->
                  <template v-if="outputFormat === 'image/png'">
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
                        <span class="font-mono text-xs font-bold text-primary"
                          >{{ modelValue }} <span class="text-[10px] opacity-60">Colors</span></span
                        >
                      </template>
                    </AppSlider>

                    <AppSlider
                      v-model="pngEffort"
                      label="编码精细度"
                      :min="1"
                      :max="9"
                      :step="1"
                      unit=""
                      :icon="Zap"
                    >
                      <template #default="{ modelValue }">
                        <div class="flex items-center gap-1.5">
                          <span class="font-mono text-xs font-bold text-primary"
                            >Lv.{{ modelValue }}</span
                          >
                          <span
                            v-if="modelValue >= 7"
                            class="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-sm font-black uppercase tracking-tighter"
                            >Pro</span
                          >
                        </div>
                      </template>
                    </AppSlider>
                    <p class="text-[0.65rem] text-muted-foreground/60 leading-relaxed pl-1">
                      精细度越高处理越慢，但能在保持色彩的前提下获得更极致的体积。
                    </p>
                  </template>

                  <!-- 通用格式质量 -->
                  <template v-else>
                    <AppSlider
                      v-model="compressionQuality"
                      label="平衡画质与体积"
                      :min="0.1"
                      :max="1.0"
                      :step="0.05"
                      :unit="''"
                    >
                      <template #default="{ modelValue }">
                        <div class="flex items-center gap-2">
                          <span class="font-mono text-sm font-black text-primary"
                            >{{ Math.round(modelValue * 100) }}%</span
                          >
                          <div
                            v-if="modelValue === recommendedQualities[outputFormat]"
                            class="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"
                            title="推荐质量"
                          ></div>
                        </div>
                      </template>
                    </AppSlider>
                    <div class="flex justify-between items-center px-1">
                      <span
                        class="text-[0.55rem] font-black text-muted-foreground uppercase tracking-[0.2em]"
                        >Smallest</span
                      >
                      <div
                        class="h-px flex-1 mx-4 bg-gradient-to-r from-transparent via-border/60 to-transparent"
                      ></div>
                      <span
                        class="text-[0.55rem] font-black text-muted-foreground uppercase tracking-[0.2em]"
                        >Best Quality</span
                      >
                    </div>
                  </template>
                </div>

                <div v-else class="space-y-4">
                  <div class="flex justify-between items-center mb-1">
                    <label
                      class="text-[0.65rem] font-black text-muted-foreground uppercase tracking-widest pl-1"
                      >Target Size</label
                    >
                    <span class="font-mono text-sm font-black text-primary"
                      >{{ targetSizeKB }} <span class="text-[10px] opacity-60">KB</span></span
                    >
                  </div>
                  <div class="relative group">
                    <input
                      type="number"
                      v-model.number="targetSizeKB"
                      class="w-full h-11 px-4 bg-muted/30 border border-border/50 rounded-xl text-sm font-bold focus:border-primary focus:bg-background outline-none transition-all tabular-nums"
                      placeholder="500"
                    />
                    <Zap
                      :size="14"
                      class="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/40 group-focus-within:text-primary group-focus-within:animate-pulse transition-colors"
                    />
                  </div>
                  <p class="text-[0.65rem] text-muted-foreground/60 leading-relaxed italic pl-1">
                    系统将智能调整参数以接近该目标，但结果受限于原图细节复杂度。
                  </p>
                </div>
              </div>
            </section>

            <!-- 3. 格式与转换 -->
            <section class="space-y-4">
              <AppSectionHeader title="转换格式" :icon="FileType" />
              <div class="space-y-3">
                <AppSelect v-model="outputFormat" :options="formatOptions" />
                <div v-if="outputFormat !== 'original'" class="px-1">
                  <AppTip variant="info" class="bg-primary/[0.03] border-primary/10 py-2">
                    <span class="text-[0.65rem] font-medium leading-tight">
                      已切换至
                      <span class="font-black underline decoration-primary/30">{{
                        formatOptions.find((o) => o.value === outputFormat)?.label.split(' ')[0]
                      }}</span
                      >。系统已为您自动适配该格式的最佳压缩算法。
                    </span>
                  </AppTip>
                </div>
              </div>
            </section>

            <!-- 4. 进阶微调 -->
            <section class="space-y-4">
              <button
                @click="showAdvanced = !showAdvanced"
                class="flex items-center justify-between w-full group transition-colors px-0.5"
              >
                <AppSectionHeader
                  title="进阶设置"
                  :icon="Settings2"
                  class="group-hover:text-primary"
                />
                <div class="flex items-center gap-2">
                  <span
                    class="text-[0.6rem] font-bold text-muted-foreground/60 uppercase tracking-widest"
                    >{{ showAdvanced ? 'Collapse' : 'Expand' }}</span
                  >
                  <component
                    :is="showAdvanced ? ChevronUp : ChevronDown"
                    :size="14"
                    class="text-muted-foreground/40 group-hover:text-primary transition-all"
                  />
                </div>
              </button>

              <div
                v-if="showAdvanced"
                class="space-y-6 pt-1 animate-in fade-in slide-in-from-top-3 duration-300"
              >
                <div class="space-y-3">
                  <label
                    class="text-[0.6rem] font-black text-muted-foreground uppercase tracking-widest px-1"
                    >调整分辨率 (Optional)</label
                  >
                  <div class="grid grid-cols-2 gap-3">
                    <div class="relative">
                      <input
                        type="number"
                        v-model.number="maxWidth"
                        class="w-full h-10 pl-3 pr-8 bg-muted/20 border border-border/40 rounded-lg text-xs font-bold focus:border-primary outline-none transition-all"
                        placeholder="Width"
                      />
                      <span
                        class="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-muted-foreground/40 pointer-events-none"
                        >W</span
                      >
                    </div>
                    <div class="relative">
                      <input
                        type="number"
                        v-model.number="maxHeight"
                        class="w-full h-10 pl-3 pr-8 bg-muted/20 border border-border/40 rounded-lg text-xs font-bold focus:border-primary outline-none transition-all"
                        placeholder="Height"
                      />
                      <span
                        class="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-muted-foreground/40 pointer-events-none"
                        >H</span
                      >
                    </div>
                  </div>
                </div>

                <label class="flex items-center gap-3 cursor-pointer group p-1 select-none">
                  <div
                    class="relative w-4.5 h-4.5 rounded-md border-2 border-border/80 bg-muted/30 flex items-center justify-center transition-all group-hover:border-primary shadow-sm"
                    :class="{
                      'bg-primary border-primary scale-110 shadow-primary/20': keepOriginalIfLarger
                    }"
                  >
                    <input
                      type="checkbox"
                      v-model="keepOriginalIfLarger"
                      class="absolute opacity-0 w-full h-full cursor-pointer z-10"
                    />
                    <Check v-if="keepOriginalIfLarger" :size="10" class="text-white stroke-[3px]" />
                  </div>
                  <span
                    class="text-xs font-bold text-muted-foreground group-hover:text-foreground transition-colors"
                    >体积变大时保留原图</span
                  >
                </label>
              </div>
            </section>
          </div>

          <div
            class="p-6 bg-gradient-to-t from-card via-card to-transparent pt-12 mt-auto border-t border-border/40 relative z-20 shrink-0"
          >
            <AppButton
              size="lg"
              variant="cta"
              class="w-full h-14 rounded-2xl hover:-translate-y-0.5 transition-all duration-300 active:scale-95 shrink-0"
              :loading="isProcessing"
              :disabled="!store.images.length"
              @click="handleProcess"
            >
              <template #icon>
                <Zap v-if="!isProcessing" :size="20" class="mr-2.5 fill-current" />
              </template>
              <span class="tracking-tight text-base">{{ buttonText }}</span>
            </AppButton>
            <p
              class="text-center text-[0.6rem] font-bold text-muted-foreground/40 uppercase tracking-[0.2em] mt-4"
            >
              Powered by Browser-Native Engines
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
