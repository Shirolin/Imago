<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useImageStore, type ImageItem } from '../stores/imageStore'
import { useFileHelpers } from '../composables/useFileHelpers'
import WorkspaceLayout from '../components/layout/WorkspaceLayout.vue'
import ImageCard from '../components/common/ImageCard.vue'
import AppButton from '../components/common/AppButton.vue'
import ImageSelectionStatus from '../components/common/ImageSelectionStatus.vue'
import ImageActionsToolbar from '../components/common/ImageActionsToolbar.vue'
import AppSectionHeader from '../components/common/AppSectionHeader.vue'
import AppSegmentedControl from '../components/common/AppSegmentedControl.vue'
import AppSlider from '../components/common/AppSlider.vue'
import AppTip from '../components/common/AppTip.vue'
import AppInput from '../components/common/AppInput.vue'
import AppCheckbox from '../components/common/AppCheckbox.vue'
import AppSelect from '../components/common/AppSelect.vue'
import ImageCompare from '../components/common/ImageCompare.vue'
import AppModal from '../components/common/AppModal.vue'
import {
  Settings2,
  Maximize2,
  Percent,
  Monitor,
  Smartphone,
  Layers,
  FileType,
  ChevronDown,
  ChevronUp,
  RotateCcw,
  ArrowRight,
  ImageIcon
} from 'lucide-vue-next'
import { resizeEngine } from '../lib/engines/resizeEngine'
import { useImageProcessor } from '../composables/useImageProcessor'

const store = useImageStore()
const { downloadImage } = useFileHelpers()

// 限制常量
const MIN_DIMENSION = 1
const MAX_DIMENSION = 30000
const MIN_PERCENT = 1
const MAX_PERCENT = 1000

// 状态控制
const resizeMode = ref<'pixels' | 'percentage'>('percentage')
const width = ref(1920)
const height = ref(1080)
const percentage = ref(50)
const maintainAspectRatio = ref(true)
const outputQuality = ref(0.8)
const outputFormat = ref<string>('original')
const preserveExif = ref(false)
const showAdvanced = ref(false)

// 校验错误状态
const errors = computed(() => {
  const errs: Record<string, string | null> = {
    width: null,
    height: null,
    percentage: null
  }

  if (resizeMode.value === 'pixels') {
    if (!width.value || width.value < MIN_DIMENSION) errs.width = `最小 ${MIN_DIMENSION}px`
    else if (width.value > MAX_DIMENSION) errs.width = `最大 ${MAX_DIMENSION}px`

    if (!height.value || height.value < MIN_DIMENSION) errs.height = `最小 ${MIN_DIMENSION}px`
    else if (height.value > MAX_DIMENSION) errs.height = `最大 ${MAX_DIMENSION}px`
  } else {
    if (!percentage.value || percentage.value < MIN_PERCENT)
      errs.percentage = `最小 ${MIN_PERCENT}%`
    else if (percentage.value > MAX_PERCENT) errs.percentage = `最大 ${MAX_PERCENT}%`
  }

  return errs
})

const hasErrors = computed(() => Object.values(errors.value).some((v) => v !== null))

// 格式推荐质量映射 (同步自 CompressView)
const recommendedQualities: Record<string, number> = {
  'image/jpeg': 0.8,
  'image/webp': 0.75,
  'image/avif': 0.55
}

// 监听格式变化，自动设置推荐质量
watch(outputFormat, (newFormat) => {
  if (recommendedQualities[newFormat]) {
    outputQuality.value = recommendedQualities[newFormat]
  }
})

// 对比预览状态
const showCompareModal = ref(false)
const comparingImage = ref<ImageItem | null>(null)
const processedPreviewUrl = ref<string | null>(null)

const { isProcessing, processAll, processSelected } = useImageProcessor(resizeEngine)

// 选项配置
const modeOptions = [
  { label: '百分比', value: 'percentage', icon: Percent },
  { label: '像素尺寸', value: 'pixels', icon: Maximize2 }
]

const formatOptions = [
  { label: '保留原格式', value: 'original' },
  { label: 'JPEG (高兼容性)', value: 'image/jpeg' },
  { label: 'PNG (无损/透明)', value: 'image/png' },
  { label: 'WebP (推荐)', value: 'image/webp' }
]

// 预设比例
const presets = [
  { label: '4K', w: 3840, h: 2160, icon: Monitor },
  { label: '1080P', w: 1920, h: 1080, icon: Monitor },
  { label: '720P', w: 1280, h: 720, icon: Monitor },
  { label: 'WeChat/IG', w: 1080, h: 1920, icon: Smartphone }
]

const applyPreset = (p: { w: number; h: number }) => {
  resizeMode.value = 'pixels'
  width.value = p.w
  height.value = p.h
}

const resetDimensions = () => {
  width.value = 1920
  height.value = 1080
}

// 监听参数变化，标记脏状态
watch(
  [
    resizeMode,
    width,
    height,
    percentage,
    maintainAspectRatio,
    outputQuality,
    outputFormat,
    preserveExif
  ],
  () => {
    if (store.doneCount > 0) {
      store.markAllAsDirty()
    }
  }
)

const handleProcess = () => {
  if (hasErrors.value) return

  const options = {
    mode: resizeMode.value,
    width: Math.round(width.value),
    height: Math.round(height.value),
    percentage: percentage.value,
    maintainAspectRatio: maintainAspectRatio.value,
    quality: outputQuality.value,
    format: outputFormat.value === 'original' ? undefined : outputFormat.value,
    preserveExif: preserveExif.value
  }

  if (store.selectedCount > 0) {
    processSelected(options)
  } else {
    processAll(options)
  }
}

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

const handleDownload = (id: string) => {
  const item = store.images.find((img) => img.id === id)
  if (item?.processedBlob) {
    downloadImage(item.processedBlob, item.file.name, '_Imago_Resized')
  }
}

const buttonText = computed(() => {
  if (isProcessing.value) return '正在处理...'
  if (store.images.some((img) => img.isDirty)) return '重新应用新参数'
  if (store.selectedCount > 0) return `调整选中的 ${store.selectedCount} 张`
  return '开始调整尺寸'
})
</script>

<template>
  <div class="h-full flex flex-col">
    <WorkspaceLayout show-sidebar>
      <template #header-left>
        <ImageSelectionStatus />
      </template>

      <template #header-actions>
        <ImageActionsToolbar
          :is-processing="isProcessing"
          show-clear-all
          zip-prefix="_Imago_Resized"
        />
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
          <template #meta="{ image }">
            <div
              class="flex items-center gap-3 bg-background p-3 rounded-2xl mt-1.5 border border-border transition-all duration-300 group-hover:border-primary/20"
            >
              <div class="flex-1 flex flex-col gap-0.5">
                <span
                  class="text-[0.6rem] font-extrabold uppercase text-muted-foreground tracking-widest mt-0.5 opacity-80"
                  >原始</span
                >
                <span class="text-[0.75rem] font-bold text-foreground">
                  {{ image.width }}x{{ image.height }}
                </span>
              </div>
              <div class="text-muted-foreground/60 flex shrink-0">
                <ArrowRight :size="12" />
              </div>
              <div class="flex-1 flex flex-col gap-0.5">
                <span
                  class="text-[0.6rem] font-extrabold uppercase text-muted-foreground tracking-widest mt-0.5 opacity-80"
                  >调整后</span
                >
                <span
                  class="text-[0.75rem] font-bold transition-colors"
                  :class="image.status === 'done' ? 'text-primary' : 'text-foreground'"
                >
                  {{
                    image.status === 'done'
                      ? `${image.processedWidth}x${image.processedHeight}`
                      : '--'
                  }}
                </span>
              </div>
            </div>
          </template>
        </ImageCard>
      </template>

      <template #sidebar>
        <div class="flex flex-col h-full bg-card/60 backdrop-blur-xl border-l border-border/50">
          <div class="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-7">
            <!-- 1. 调整模式 -->
            <section class="space-y-4">
              <AppSectionHeader title="调整模式" :icon="Settings2" />
              <AppSegmentedControl v-model="resizeMode" :options="modeOptions" />
            </section>

            <!-- 2. 参数调节 -->
            <section class="relative">
              <div class="bg-muted/10 rounded-xl p-5 border border-border/60">
                <div v-if="resizeMode === 'percentage'" class="space-y-6">
                  <AppSlider
                    v-model="percentage"
                    label="缩放比例"
                    :min="1"
                    :max="200"
                    :step="1"
                    unit="%"
                    :icon="Percent"
                  />
                  <div
                    v-if="errors.percentage"
                    class="text-[0.6rem] text-destructive font-bold pl-1 -mt-4 animate-in fade-in slide-in-from-top-1"
                  >
                    {{ errors.percentage }}
                  </div>
                  <div class="flex justify-between items-center px-1">
                    <span
                      class="text-[0.55rem] font-black text-muted-foreground uppercase tracking-[0.2em]"
                      >Smaller</span
                    >
                    <div
                      class="h-px flex-1 mx-4 bg-gradient-to-r from-transparent via-border/60 to-transparent"
                    ></div>
                    <span
                      class="text-[0.55rem] font-black text-muted-foreground uppercase tracking-[0.2em]"
                      >Enlarge</span
                    >
                  </div>
                </div>

                <div v-else class="space-y-5">
                  <div class="grid grid-cols-2 gap-3">
                    <div class="space-y-1.5">
                      <AppInput
                        v-model.number="width"
                        type="number"
                        placeholder="宽度"
                        suffix="W"
                        :class="{
                          'border-destructive/50 focus-visible:ring-destructive/20': errors.width
                        }"
                      />
                      <div
                        v-if="errors.width"
                        class="text-[0.6rem] text-destructive font-bold pl-1 animate-in fade-in slide-in-from-top-1"
                      >
                        {{ errors.width }}
                      </div>
                    </div>
                    <div class="space-y-1.5">
                      <AppInput
                        v-model.number="height"
                        type="number"
                        placeholder="高度"
                        suffix="H"
                        :class="{
                          'border-destructive/50 focus-visible:ring-destructive/20': errors.height
                        }"
                      />
                      <div
                        v-if="errors.height"
                        class="text-[0.6rem] text-destructive font-bold pl-1 animate-in fade-in slide-in-from-top-1"
                      >
                        {{ errors.height }}
                      </div>
                    </div>
                  </div>

                  <div class="flex items-center justify-between px-1">
                    <AppCheckbox v-model="maintainAspectRatio" label="锁定纵横比" />
                    <button
                      @click="resetDimensions"
                      class="p-1.5 hover:bg-muted rounded-lg transition-colors text-muted-foreground"
                      title="重置"
                    >
                      <RotateCcw :size="14" />
                    </button>
                  </div>

                  <!-- 预设选择器 -->
                  <div class="pt-2">
                    <label
                      class="text-[0.6rem] font-black text-muted-foreground uppercase tracking-widest mb-3 block opacity-70"
                      >常用规格</label
                    >
                    <div class="grid grid-cols-1 xs:grid-cols-2 gap-2.5">
                      <button
                        v-for="p in presets"
                        :key="p.label"
                        @click="applyPreset(p)"
                        class="flex items-center gap-3 px-4 py-3 bg-background/50 border border-border/80 rounded-xl hover:border-primary/40 hover:bg-primary/[0.03] active:scale-[0.97] active:bg-primary/[0.05] transition-all text-left group min-h-[52px]"
                      >
                        <div
                          class="p-2 rounded-lg bg-muted/50 group-hover:bg-primary/10 transition-colors"
                        >
                          <component
                            :is="p.icon"
                            :size="14"
                            class="text-muted-foreground group-hover:text-primary transition-colors"
                          />
                        </div>
                        <div class="flex flex-col gap-0.5 min-w-0">
                          <span
                            class="text-[0.7rem] font-bold text-foreground leading-tight truncate"
                            >{{ p.label }}</span
                          >
                          <span
                            class="text-[0.6rem] text-muted-foreground font-mono leading-none opacity-80"
                            >{{ p.w }}x{{ p.h }}</span
                          >
                        </div>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <!-- 3. 输出格式 -->
            <section class="space-y-4">
              <AppSectionHeader title="导出设置" :icon="FileType" />
              <div class="space-y-3">
                <AppSelect v-model="outputFormat" :options="formatOptions" />
                <AppSlider
                  v-if="outputFormat !== 'image/png' && outputFormat !== 'original'"
                  v-model="outputQuality"
                  label="导出质量"
                  :min="0.1"
                  :max="1.0"
                  :step="0.05"
                  unit=""
                >
                  <template #default="{ modelValue }">
                    <div class="flex items-center gap-2">
                      <span class="font-mono text-xs font-bold text-primary"
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
              </div>
            </section>

            <!-- 4. 进阶设置 -->
            <section class="space-y-4">
              <button
                @click="showAdvanced = !showAdvanced"
                class="flex items-center justify-between w-full group transition-colors px-0.5"
              >
                <AppSectionHeader
                  title="进阶设置"
                  :icon="Layers"
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
                class="space-y-4 pt-1 animate-in fade-in slide-in-from-top-3 duration-300"
              >
                <AppCheckbox v-model="preserveExif" label="保留图片元数据 (EXIF)" />
                <p
                  v-if="preserveExif"
                  class="text-[0.6rem] text-muted-foreground/60 leading-relaxed pl-7 -mt-1 italic"
                >
                  * 仅支持 JPEG 格式之间的元数据保留。
                </p>

                <AppTip variant="info" class="text-[0.65rem] bg-primary/[0.03] border-primary/10">
                  采用高质量插值算法，缩放后边缘依然锐利。
                </AppTip>
              </div>
            </section>
          </div>

          <!-- 底部动作 -->
          <div
            class="p-6 bg-gradient-to-t from-card via-card to-transparent pt-12 mt-auto border-t border-border/40 relative z-20 shrink-0"
          >
            <AppButton
              size="lg"
              variant="cta"
              class="w-full h-14 rounded-2xl hover:-translate-y-0.5 transition-all duration-300 active:scale-95"
              :loading="isProcessing"
              :disabled="!store.images.length || hasErrors"
              @click="handleProcess"
            >
              <template #icon>
                <Maximize2 v-if="!isProcessing" :size="20" class="mr-2.5 fill-current" />
              </template>
              <span class="tracking-tight text-base">{{ buttonText }}</span>
            </AppButton>
          </div>
        </div>
      </template>
    </WorkspaceLayout>

    <!-- 对比弹窗 -->
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
              对比缩放效果
            </p>
          </div>
        </div>
      </template>

      <ImageCompare
        v-if="comparingImage && processedPreviewUrl"
        :original-url="comparingImage.preview"
        :processed-url="processedPreviewUrl"
        :original-size="`${comparingImage.width}x${comparingImage.height}`"
        :processed-size="`${comparingImage.processedWidth || '--'}x${comparingImage.processedHeight || '--'}`"
      />
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
