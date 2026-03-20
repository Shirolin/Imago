<script setup lang="ts">
import { computed, watch, ref } from 'vue'
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
  Gauge,
  Palette,
  Activity,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp
} from 'lucide-vue-next'

interface Props {
  format: string
  quality: number
  // 核心功能恢复
  mode?: 'quality' | 'target'
  targetSizeKB?: number
  colors?: number
  effort?: number
  maxWidth?: number
  maxHeight?: number
  keepOriginalIfLarger?: boolean
  showMagnifier?: boolean
  // 基础配置
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
  title: '导出设置'
})

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

const formatOptions = [
  { label: '保留原格式', value: 'original' },
  { label: 'WebP (推荐)', value: 'image/webp' },
  { label: 'JPEG (最佳兼容)', value: 'image/jpeg-li' },
  { label: 'PNG (无损/透明)', value: 'image/png' },
  { label: 'AVIF (先进格式)', value: 'image/avif' },
  { label: 'JPEG XL (次世代)', value: 'image/jxl' },
  { label: 'WebP2 (实验性)', value: 'image/webp2' }
]

const recommendedQualities: Record<string, number> = {
  original: 0.8,
  'image/webp': 0.75,
  'image/jpeg-li': 0.75,
  'image/jpeg': 0.8,
  'image/png': 1.0,
  'image/avif': 0.55,
  'image/jxl': 0.7,
  'image/webp2': 0.65
}

// 核心联动逻辑：切换格式时，智能同步推荐质量
watch(
  () => props.format,
  (newFormat, oldFormat) => {
    const recommended = recommendedQualities[newFormat] || 0.8

    // 如果没有 oldFormat (初次加载) 或者 当前质量恰好等于旧格式的推荐值 (说明用户没调过)
    // 则自动跟随新格式的推荐值
    const oldRecommended = oldFormat ? recommendedQualities[oldFormat] || 0.8 : null

    if (!oldFormat || Math.abs(props.quality - (oldRecommended || 0)) < 0.01) {
      emit('update:quality', recommended)
    }
  },
  { immediate: true }
)

const handleFormatChange = (val: string) => emit('update:format', val)
const handleQualityChange = (val: number) => emit('update:quality', val)
const handleModeChange = (val: any) => emit('update:mode', val)
const handleExifChange = (val: boolean) => emit('update:preserveExif', val)

// 计算属性：控制 UI 展示
const showQualitySlider = computed(() => {
  return props.allowManualQuality && props.mode === 'quality' && props.format !== 'image/png'
})

const showTargetSizeInput = computed(() => {
  return props.allowManualQuality && props.mode === 'target' && props.format !== 'image/png'
})

const showPngOptions = computed(() => {
  return props.allowManualQuality && props.format === 'image/png'
})
</script>

<template>
  <div class="space-y-6">
    <!-- 1. 导出/压缩核心配置 -->
    <section class="space-y-4">
      <div class="flex items-center justify-between px-0.5">
        <AppSectionHeader :title="title" :icon="FileType" />
      </div>

      <div class="space-y-4 px-1">
        <!-- 格式选择 -->
        <AppSelect
          :model-value="format"
          @update:model-value="handleFormatChange"
          :options="formatOptions"
        />

        <!-- 策略切换 (仅压缩模式) -->
        <AppSegmentedControl
          v-if="allowManualQuality && format !== 'image/png'"
          :model-value="mode"
          @update:model-value="handleModeChange"
          :options="[
            { label: '画质优先', value: 'quality', icon: Sparkles },
            { label: '指定体积', value: 'target', icon: Target }
          ]"
        />

        <!-- 画质调节 -->
        <div
          v-if="showQualitySlider"
          class="bg-muted/10 rounded-2xl p-4 border border-border/60 mt-2"
        >
          <AppSlider
            :model-value="quality"
            @update:model-value="handleQualityChange"
            label="输出质量"
            :min="0.1"
            :max="1.0"
            :step="0.01"
            :icon="Gauge"
            :snap-value="recommendedQualities[format] || 0.8"
          >
            <template #default="{ modelValue }">
              <div class="flex items-center gap-2">
                <span class="font-mono text-sm font-black text-primary">
                  {{ Math.round(modelValue * 100) }}%
                </span>
                <div
                  v-if="Math.abs(modelValue - (recommendedQualities[format] || 0.8)) < 0.001"
                  class="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"
                  title="推荐值"
                ></div>
              </div>
            </template>
          </AppSlider>
        </div>

        <!-- 体积调节 -->
        <div
          v-if="showTargetSizeInput"
          class="bg-muted/10 rounded-2xl p-4 border border-border/60 mt-2"
        >
          <div class="flex justify-between items-center mb-3">
            <label
              class="text-[0.65rem] font-black text-muted-foreground uppercase tracking-widest pl-1"
              >目标体积</label
            >
            <span class="font-mono text-sm font-black text-primary"
              >{{ targetSizeKB }} <span class="text-[10px] opacity-60">KB</span></span
            >
          </div>
          <AppInput
            :model-value="targetSizeKB"
            @update:model-value="emit('update:targetSizeKB', $event)"
            type="number"
            placeholder="500"
            :icon="Target"
            suffix="KB"
          />
        </div>

        <!-- PNG 特有精细化选项 -->
        <div
          v-if="showPngOptions"
          class="bg-muted/10 rounded-2xl p-4 border border-border/60 mt-2 space-y-6"
        >
          <AppSlider
            :model-value="colors"
            @update:model-value="emit('update:colors', $event)"
            label="最大颜色数"
            :min="2"
            :max="256"
            :step="1"
            :icon="Palette"
          >
            <template #default="{ modelValue }">
              <span class="font-mono text-xs font-bold text-primary"
                >{{ modelValue }} <span class="text-[10px] opacity-60">Colors</span></span
              >
            </template>
          </AppSlider>
          <AppSlider
            :model-value="effort"
            @update:model-value="emit('update:effort', $event)"
            label="编码精细度"
            :min="1"
            :max="9"
            :step="1"
            :icon="Activity"
          >
            <template #default="{ modelValue }">
              <div class="flex items-center gap-1.5">
                <span class="font-mono text-xs font-bold text-primary">Lv.{{ modelValue }}</span>
                <span
                  v-if="modelValue >= 7"
                  class="text-[9px] bg-primary/10 text-primary px-1.5 py-0.5 rounded-sm font-black uppercase tracking-tighter"
                  >Pro</span
                >
              </div>
            </template>
          </AppSlider>
        </div>
      </div>
    </section>

    <!-- 2. 进阶微调 (支持 EXIF、宽高限制、智能跳过等) -->
    <section v-if="showExifOption || allowManualQuality" class="space-y-4 @container">
      <button
        @click="showAdvanced = !showAdvanced"
        class="flex items-center justify-between w-full group transition-colors px-0.5"
      >
        <AppSectionHeader
          title="进阶微调"
          :icon="SlidersHorizontal"
          class="group-hover:text-primary"
        />
        <div class="flex items-center gap-2">
          <span
            class="text-[0.6rem] font-bold text-muted-foreground/60 uppercase tracking-widest"
            >{{ showAdvanced ? '收起' : '展开' }}</span
          >
          <component
            :is="showAdvanced ? ChevronUp : ChevronDown"
            :size="14"
            class="text-muted-foreground/40 group-hover:text-primary transition-all"
          />
        </div>
      </button>

      <div v-if="showAdvanced" class="space-y-6 px-1 animate-in fade-in slide-in-from-top-2">
        <!-- 分辨率限制 (仅 Pro Mode) -->
        <div v-if="allowManualQuality" class="space-y-3">
          <label
            class="text-[0.6rem] font-black text-muted-foreground uppercase tracking-widest px-1"
            >分辨率限制 (可选)</label
          >
          <div class="grid grid-cols-1 @[240px]:grid-cols-2 gap-3">
            <AppInput
              :model-value="maxWidth"
              @update:model-value="emit('update:maxWidth', $event)"
              type="number"
              placeholder="宽度"
              suffix="W"
            />
            <AppInput
              :model-value="maxHeight"
              @update:model-value="emit('update:maxHeight', $event)"
              type="number"
              placeholder="高度"
              suffix="H"
            />
          </div>
        </div>

        <!-- 各种开关 -->
        <div class="space-y-3">
          <AppCheckbox
            v-if="allowManualQuality"
            :model-value="keepOriginalIfLarger"
            @update:model-value="emit('update:keepOriginalIfLarger', $event)"
            label="智能跳过变大文件"
          />
          <AppCheckbox
            v-if="showExifOption || allowManualQuality"
            :model-value="preserveExif"
            @update:model-value="handleExifChange"
            label="保留 EXIF 元数据"
          />
          <AppCheckbox
            v-if="allowManualQuality"
            :model-value="showMagnifier"
            @update:model-value="emit('update:showMagnifier', $event)"
            label="开启智能对比倍镜"
          />
        </div>
      </div>
    </section>
  </div>
</template>
