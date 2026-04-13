<script setup lang="ts">
import { computed, watch, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import AppSelect from './AppSelect.vue'
import AppSlider from './AppSlider.vue'
import AppSectionHeader from './AppSectionHeader.vue'
import AppCheckbox from './AppCheckbox.vue'
import AppSegmentedControl from './AppSegmentedControl.vue'
import AppInput from './AppInput.vue'
import {
  FileType,
  Sparkles,
  Target,
  CircleGauge,
  Palette,
  Activity,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp
} from 'lucide-vue-next'

const { t } = useI18n()

interface Props {
  format: string
  quality: number
  mode?: 'quality' | 'target'
  targetSizeKB?: number
  colors?: number
  effort?: number
  maxWidth?: number
  maxHeight?: number
  keepOriginalIfLarger?: boolean
  showMagnifier?: boolean
  preserveExif?: boolean
  allowManualQuality?: boolean
  showExifOption?: boolean
  title?: string
}

const props = withDefaults(defineProps<Props>(), {
  mode: 'quality',
  targetSizeKB: 500,
  colors: 256,
  effort: 7,
  keepOriginalIfLarger: true,
  showMagnifier: true,
  preserveExif: false,
  allowManualQuality: false,
  showExifOption: false,
  title: ''
})

const displayTitle = computed(() => props.title || t('common.export.title'))

const emit = defineEmits<{
  'update:format': [value: string]
  'update:quality': [value: number]
  'update:mode': [value: 'quality' | 'target']
  'update:targetSizeKB': [value: number]
  'update:colors': [value: number]
  'update:effort': [value: number]
  'update:maxWidth': [value: number | undefined]
  'update:maxHeight': [value: number | undefined]
  'update:keepOriginalIfLarger': [value: boolean]
  'update:showMagnifier': [value: boolean]
  'update:preserveExif': [value: boolean]
}>()

const showAdvanced = ref(false)

const formatOptions = computed(() => [
  { label: t('common.export.formatOriginal'), value: 'original' },
  { label: t('common.export.formatWebp'), value: 'image/webp' },
  { label: t('common.export.formatJpeg'), value: 'image/jpeg-li' },
  { label: t('common.export.formatPng'), value: 'image/png' },
  { label: t('common.export.formatAvif'), value: 'image/avif' },
  { label: t('common.export.formatJxl'), value: 'image/jxl' },
  { label: t('common.export.formatWebp2'), value: 'image/webp2' }
])

const recommendedQualities: Record<string, number> = {
  original: 0.8,
  'image/webp': 0.75,
  'image/jpeg-li': 0.75,
  'image/png': 1.0,
  'image/avif': 0.55,
  'image/jxl': 0.7,
  'image/webp2': 0.65
}

watch(
  () => props.format,
  (newFormat, oldFormat) => {
    const recommended = recommendedQualities[newFormat] || 0.8
    const oldRecommended = oldFormat ? recommendedQualities[oldFormat] || 0.8 : null
    if (!oldFormat || Math.abs(props.quality - (oldRecommended || 0)) < 0.01) {
      emit('update:quality', recommended)
    }
  },
  { immediate: true }
)

const handleFormatChange = (val: string) => emit('update:format', val)
const handleQualityChange = (val: number) => emit('update:quality', val)
const handleModeChange = (val: 'quality' | 'target') => emit('update:mode', val)
const handleExifChange = (val: boolean) => emit('update:preserveExif', val)

const showQualitySlider = computed(
  () => props.allowManualQuality && props.mode === 'quality' && props.format !== 'image/png'
)
const showTargetSizeInput = computed(
  () => props.allowManualQuality && props.mode === 'target' && props.format !== 'image/png'
)
const showPngOptions = computed(() => props.allowManualQuality && props.format === 'image/png')
</script>

<template>
  <div class="space-y-6">
    <section class="space-y-4">
      <div class="flex items-center justify-between px-0.5">
        <AppSectionHeader :title="displayTitle" :icon="FileType" />
      </div>

      <div class="space-y-4 px-1">
        <AppSelect
          :model-value="format"
          @update:model-value="handleFormatChange"
          :options="formatOptions"
        />
        <AppSegmentedControl
          v-if="allowManualQuality && format !== 'image/png'"
          :model-value="mode"
          @update:model-value="handleModeChange"
          :options="[
            { label: t('common.export.qualityMode'), value: 'quality', icon: Sparkles },
            { label: t('common.export.targetSizeMode'), value: 'target', icon: Target }
          ]"
        />

        <div
          v-if="showQualitySlider || showTargetSizeInput || showPngOptions"
          class="bg-muted/10 rounded-2xl p-4 border border-border/60 mt-2 space-y-6"
        >
          <!-- A. 输出质量 -->
          <div v-if="showQualitySlider" class="space-y-3">
            <AppSlider
              :model-value="quality"
              @update:model-value="handleQualityChange"
              :label="t('common.export.outputQuality')"
              :icon="CircleGauge"
              :min="0.1"
              :max="1.0"
              :step="0.01"
              :snap-value="recommendedQualities[format]"
              :default-value="recommendedQualities[format]"
            />
          </div>

          <!-- B. 目标体积 -->
          <div v-if="showTargetSizeInput" class="space-y-3">
            <div class="flex items-center justify-between px-0.5 h-6">
              <div class="flex items-center gap-2.5">
                <div
                  class="bg-primary/5 p-1 rounded-full flex items-center justify-center overflow-visible"
                >
                  <Target :size="15" :stroke-width="2.5" class="text-primary" />
                </div>
                <span
                  class="text-[0.65rem] font-bold text-muted-foreground uppercase tracking-widest leading-none"
                  >{{ t('common.export.targetSize') }}</span
                >
              </div>
              <span class="font-mono text-sm font-black text-primary"
                >{{ targetSizeKB }} <span class="text-[10px] opacity-60">KB</span></span
              >
            </div>
            <AppInput
              :model-value="targetSizeKB"
              @update:model-value="emit('update:targetSizeKB', $event)"
              type="number"
              suffix="KB"
            />
          </div>

          <!-- C. PNG 选项 -->
          <template v-if="showPngOptions">
            <div class="space-y-3">
              <AppSlider
                :model-value="colors"
                @update:model-value="emit('update:colors', $event)"
                :label="t('common.export.maxColors')"
                :icon="Palette"
                unit=" Colors"
                :min="2"
                :max="256"
                :default-value="256"
              />
            </div>
            <div class="space-y-3">
              <AppSlider
                :model-value="effort"
                @update:model-value="emit('update:effort', $event)"
                :label="t('common.export.effort')"
                :icon="Activity"
                unit=""
                :min="1"
                :max="9"
                :default-value="7"
              />
            </div>
          </template>
        </div>
      </div>
    </section>

    <!-- 2. 进阶微调 -->
    <section v-if="showExifOption || allowManualQuality" class="space-y-4 @container">
      <button
        @click="showAdvanced = !showAdvanced"
        class="flex items-center justify-between w-full group px-0.5"
      >
        <AppSectionHeader
          :title="t('common.export.advanced')"
          :icon="SlidersHorizontal"
          class="group-hover:text-primary"
        />
        <component
          :is="showAdvanced ? ChevronUp : ChevronDown"
          :size="14"
          class="text-muted-foreground/40 group-hover:text-primary"
        />
      </button>
      <div v-if="showAdvanced" class="space-y-6 px-1 animate-in fade-in slide-in-from-top-2">
        <div v-if="allowManualQuality" class="space-y-3">
          <label
            class="text-[0.6rem] font-black text-muted-foreground uppercase tracking-widest px-1"
            >{{ t('common.export.resolutionLimit') }}</label
          >
          <div class="grid grid-cols-1 @[240px]:grid-cols-2 gap-3">
            <AppInput
              :model-value="maxWidth"
              @update:model-value="emit('update:maxWidth', $event)"
              type="number"
              :placeholder="t('common.export.width')"
              suffix="W"
            />
            <AppInput
              :model-value="maxHeight"
              @update:model-value="emit('update:maxHeight', $event)"
              type="number"
              :placeholder="t('common.export.height')"
              suffix="H"
            />
          </div>
        </div>
        <div class="space-y-3">
          <AppCheckbox
            v-if="allowManualQuality"
            :model-value="keepOriginalIfLarger"
            @update:model-value="emit('update:keepOriginalIfLarger', $event)"
            :label="t('common.export.skipIfLarger')"
          />
          <AppCheckbox
            v-if="showExifOption || allowManualQuality"
            :model-value="preserveExif"
            @update:model-value="handleExifChange"
            :label="t('common.export.preserveExif')"
          />
          <AppCheckbox
            v-if="allowManualQuality"
            :model-value="showMagnifier"
            @update:model-value="emit('update:showMagnifier', $event)"
            :label="t('common.export.showMagnifier')"
          />
        </div>
      </div>
    </section>
  </div>
</template>
