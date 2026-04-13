<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useImageStore } from '../stores/imageStore'
import { useLayoutStore } from '../stores/layoutStore'
import { useFileHelpers } from '../composables/useFileHelpers'
import WorkspaceLayout from '../components/layout/WorkspaceLayout.vue'
import AppButton from '../components/common/AppButton.vue'
import AppSlider from '../components/common/AppSlider.vue'
import AppSectionHeader from '../components/common/AppSectionHeader.vue'
import ImageCard from '../components/common/ImageCard.vue'
import ImageSelectionStatus from '../components/common/ImageSelectionStatus.vue'
import ImageActionsToolbar from '../components/common/ImageActionsToolbar.vue'
import AppExportSettings from '../components/common/AppExportSettings.vue'
import {
  Settings2,
  Sparkles,
  Sun,
  Contrast,
  Droplets,
  Layers,
  Wind,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Download
} from 'lucide-vue-next'
import { filterEngine } from '../lib/engines/filterEngine'
import { useImageProcessor } from '../composables/useImageProcessor'

import InspectorFooter from '../components/layout/InspectorFooter.vue'

const store = useImageStore()
const layoutStore = useLayoutStore()
const { downloadImage, downloadAllAsZip } = useFileHelpers()

// 状态
const brightness = ref(100)
const contrast = ref(100)
const saturation = ref(100)
const blur = ref(0)
const sepia = ref(0)
const outputFormat = ref<string>('original')
const outputQuality = ref(0.9)
const isDirty = ref(false)
const activePresetName = ref<string>('原图')
const lastPresetName = ref<string>('原图')

// 基准值（随预设变化），用于滑块的默认重置点
const baselineValues = ref({
  brightness: 100,
  contrast: 100,
  saturation: 100,
  blur: 0,
  sepia: 0
})

// 是否修改过参数（用于显示批量重置）
const isFiltersDirty = computed(() => {
  return (
    Math.abs(brightness.value - baselineValues.value.brightness) > 0.001 ||
    Math.abs(contrast.value - baselineValues.value.contrast) > 0.001 ||
    Math.abs(saturation.value - baselineValues.value.saturation) > 0.001 ||
    Math.abs(blur.value - baselineValues.value.blur) > 0.001 ||
    Math.abs(sepia.value - baselineValues.value.sepia) > 0.001
  )
})

// 滚动控制
const scrollContainer = ref<HTMLElement | null>(null)
const canScrollLeft = ref(false)
const canScrollRight = ref(false)

const checkScroll = () => {
  const el = scrollContainer.value
  if (el) {
    canScrollLeft.value = el.scrollLeft > 5
    canScrollRight.value = el.scrollLeft < el.scrollWidth - el.clientWidth - 5
  }
}

const scrollPresets = (direction: 'left' | 'right') => {
  const el = scrollContainer.value
  if (el) {
    const scrollAmount = el.clientWidth * 0.6
    el.scrollBy({
      left: direction === 'left' ? -scrollAmount : scrollAmount,
      behavior: 'smooth'
    })
  }
}

const handleWheel = (e: WheelEvent) => {
  const el = scrollContainer.value
  if (el && Math.abs(e.deltaY) > Math.abs(e.deltaX)) {
    e.preventDefault()
    el.scrollLeft += e.deltaY
    checkScroll()
  }
}

onMounted(() => {
  setTimeout(checkScroll, 100)
})

const { isProcessing, processSelected } = useImageProcessor(filterEngine)

const resetFilters = () => {
  const preset = presets.find((p) => p.name === lastPresetName.value) || presets[0]
  if (preset) applyPreset(preset)
}

// 滤镜预设定义 (基于工业级开源项目 CSSgram 调校)
const presets = [
  { name: '原图', values: { brightness: 100, contrast: 100, saturation: 100, blur: 0, sepia: 0 } },
  {
    name: '克拉伦登',
    values: { brightness: 110, contrast: 120, saturation: 135, blur: 0, sepia: 0 }
  }, // Clarendon: 万能通透
  {
    name: '高保真',
    values: { brightness: 100, contrast: 150, saturation: 110, blur: 0, sepia: 0 }
  }, // Lo-fi: 浓郁扫街感
  {
    name: '瓦伦西亚',
    values: { brightness: 108, contrast: 108, saturation: 100, blur: 0, sepia: 15 }
  }, // Valencia: 暖阳复古
  { name: '银座', values: { brightness: 105, contrast: 90, saturation: 100, blur: 0, sepia: 10 } }, // Gingham: 日系柔美
  { name: '1977', values: { brightness: 110, contrast: 110, saturation: 130, blur: 0, sepia: 30 } }, // 1977: 经典胶片
  { name: '浅梦', values: { brightness: 120, contrast: 90, saturation: 85, blur: 0, sepia: 0 } }, // Aden: 梦幻马卡龙
  { name: '雷耶斯', values: { brightness: 110, contrast: 85, saturation: 75, blur: 0, sepia: 22 } }, // Reyes: 古旧图片
  { name: '水墨', values: { brightness: 110, contrast: 120, saturation: 0, blur: 0, sepia: 10 } }, // Inkwell: 质感黑白
  { name: '云雀', values: { brightness: 105, contrast: 90, saturation: 115, blur: 0, sepia: 0 } } // Lark: 风景专用
]

const applyPreset = (preset: (typeof presets)[0]) => {
  // 更新当前值
  brightness.value = preset.values.brightness
  contrast.value = preset.values.contrast
  saturation.value = preset.values.saturation
  blur.value = preset.values.blur
  sepia.value = preset.values.sepia

  // 更新基准值，使滑块的默认重置点与预设一致
  baselineValues.value = { ...preset.values }

  activePresetName.value = preset.name
  lastPresetName.value = preset.name
}

const displayImages = computed(() => [...store.images].reverse())

// 实时预览滤镜字符串
const previewFilterStyle = computed(() => {
  return {
    backdropFilter: `brightness(${brightness.value}%) contrast(${contrast.value}%) saturate(${saturation.value}%) blur(${blur.value}px) sepia(${sepia.value}%)`,
    WebkitBackdropFilter: `brightness(${brightness.value}%) contrast(${contrast.value}%) saturate(${saturation.value}%) blur(${blur.value}px) sepia(${sepia.value}%)`
  }
})

// 预设栏动态遮罩样式
const presetsMaskStyle = computed(() => {
  const left = canScrollLeft.value ? 'transparent' : 'black'
  const right = canScrollRight.value ? 'transparent' : 'black'
  const mask = `linear-gradient(to right, ${left}, black 20px, black calc(100% - 20px), ${right})`
  return {
    maskImage: mask,
    WebkitMaskImage: mask
  }
})

const handleApplyFilters = async () => {
  await processSelected({
    brightness: brightness.value,
    contrast: contrast.value,
    saturation: saturation.value,
    blur: blur.value,
    sepia: sepia.value,
    grayscale: 0,
    hueRotate: 0,
    invert: 0,
    vignette: 0,
    sharpen: 0,
    noise: 0,
    format: outputFormat.value,
    quality: outputQuality.value
  })
  isDirty.value = false
}

const handleDownload = (id: string) => {
  const item = store.images.find((img) => img.id === id)
  if (item?.processedBlob) downloadImage(item.processedBlob, item.file.name, '_Filtered')
}

watch(
  [brightness, contrast, saturation, blur, sepia, outputFormat, outputQuality],
  () => {
    isDirty.value = true
    store.markAllAsDirty()
  },
  { deep: true }
)

const ctaState = computed(() => {
  if (store.selectedCount === 0)
    return { text: '请选择图片', icon: Sparkles, action: 'none', disabled: true }
  if (isProcessing.value)
    return { text: '渲染中...', icon: Sparkles, action: 'none', disabled: true }

  const selectedImages = store.images.filter((img) => store.selectedIds.has(img.id))
  const allDoneAndClean =
    selectedImages.length > 0 &&
    selectedImages.every((img) => img.status === 'done' && img.processedBlob && !img.isDirty)

  if (allDoneAndClean) {
    return {
      text: `导出成果 (${store.selectedCount})`,
      icon: Download,
      action: 'download',
      disabled: false
    }
  }

  const anyDirty = selectedImages.some((img) => img.status === 'done' && img.isDirty)
  return {
    text: anyDirty ? `更新滤镜 (${store.selectedCount})` : `应用滤镜 (${store.selectedCount})`,
    icon: Sparkles,
    action: 'process',
    disabled: false
  }
})

const handleCtaClick = async () => {
  const state = ctaState.value
  if (state.action === 'none') return

  if (state.action === 'download') {
    await downloadAllAsZip('_Filtered')
    return
  }

  if (state.action === 'process') {
    await handleApplyFilters()
  }
}
</script>

<template>
  <div class="h-full w-full flex flex-col overflow-hidden">
    <WorkspaceLayout show-sidebar no-scroll show-assets-tray>
      <template #header-left><ImageSelectionStatus /></template>
      <template #header-actions
        ><ImageActionsToolbar
          view-id="filters"
          :is-processing="isProcessing"
          show-clear-all
          zip-prefix="_Filtered"
      /></template>

      <template #content>
        <div class="h-full w-full overflow-y-auto custom-scrollbar p-4 md:p-6">
          <div
            class="grid transition-all duration-300"
            :class="[
              layoutStore.cardSizeMode === 'compact'
                ? 'grid-cols-[repeat(auto-fill,minmax(130px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3 md:gap-8'
                : 'grid-cols-[repeat(auto-fill,minmax(160px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4 md:gap-10'
            ]"
          >
            <ImageCard
              v-for="img in displayImages"
              :key="img.id"
              :image="img"
              :is-selected="store.selectedIds.has(img.id)"
              :image-style="{ filter: 'none' }"
              :allow-magnifier="false"
              @toggle="store.toggleSelection"
              @remove="store.removeImage"
              @download="handleDownload"
            >
              <template #visual-effects>
                <div
                  v-if="img.status !== 'done' || isDirty"
                  class="absolute inset-0 w-full h-full z-10 pointer-events-none transition-all duration-300 rounded-[inherit] overflow-hidden"
                  :style="previewFilterStyle"
                ></div>
              </template>
            </ImageCard>
          </div>
        </div>
      </template>

      <template #sidebar>
        <section class="space-y-4">
          <AppSectionHeader title="快速预设" :icon="Sparkles" />
          <div class="relative group/presets">
            <!-- 左导航箭头 -->
            <button
              v-if="canScrollLeft"
              @click="scrollPresets('left')"
              class="absolute left-0 top-1/2 -translate-y-1/2 z-20 w-8 h-8 bg-background/80 border border-border/40 rounded-full shadow-lg flex items-center justify-center text-muted-foreground hover:text-primary transition-all md:opacity-0 md:group-hover/presets:opacity-100 backdrop-blur-sm -ml-2"
              aria-label="向左滚动"
            >
              <ChevronLeft :size="16" />
            </button>

            <!-- 右导航箭头 -->
            <button
              v-if="canScrollRight"
              @click="scrollPresets('right')"
              class="absolute right-0 top-1/2 -translate-y-1/2 z-20 w-8 h-8 bg-background/80 border border-border/40 rounded-full shadow-lg flex items-center justify-center text-muted-foreground hover:text-primary transition-all md:opacity-0 md:group-hover/presets:opacity-100 backdrop-blur-sm -mr-2"
              aria-label="向右滚动"
            >
              <ChevronRight :size="16" />
            </button>

            <div
              ref="scrollContainer"
              class="flex gap-2 overflow-x-auto pb-2 no-scrollbar -mx-1 px-1 scroll-smooth"
              @scroll="checkScroll"
              @wheel="handleWheel"
              :style="presetsMaskStyle"
            >
              <button
                v-for="preset in presets"
                :key="preset.name"
                @click="applyPreset(preset)"
                class="flex-shrink-0 w-20 py-2.5 rounded-xl border transition-all active:scale-95 flex flex-col items-center gap-1.5 group"
                :class="[
                  activePresetName === preset.name
                    ? 'border-primary bg-primary/5 shadow-sm ring-1 ring-primary/20'
                    : 'border-border/60 bg-muted/5 hover:bg-primary/5 hover:border-primary/30'
                ]"
                :aria-pressed="activePresetName === preset.name"
              >
                <div
                  class="w-8 h-8 rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform"
                  :class="[activePresetName === preset.name ? 'bg-primary/20' : 'bg-primary/10']"
                >
                  <Sparkles
                    :size="14"
                    class="text-primary"
                    :fill="activePresetName === preset.name ? 'currentColor' : 'none'"
                  />
                </div>
                <span
                  class="text-[11px] font-medium transition-colors"
                  :class="[
                    activePresetName === preset.name
                      ? 'text-primary'
                      : 'text-muted-foreground group-hover:text-primary'
                  ]"
                >
                  {{ preset.name }}
                </span>
              </button>
            </div>
          </div>
        </section>

        <section class="space-y-4 pt-6 border-t border-border/40">
          <div class="flex items-center justify-between h-10 pr-1">
            <AppSectionHeader title="精细调整" :icon="Settings2" />

            <!-- 批量重置按钮占位符：固定宽度防止跳动 -->
            <div class="w-8 h-8 flex items-center justify-end">
              <transition
                enter-active-class="transition duration-300 ease-out"
                enter-from-class="opacity-0 scale-50 translate-x-2"
                enter-to-class="opacity-100 scale-100 translate-x-0"
                leave-active-class="transition duration-200 ease-in"
                leave-from-class="opacity-100 scale-100 translate-x-0"
                leave-to-class="opacity-0 scale-50 translate-x-2"
              >
                <button
                  v-if="isFiltersDirty"
                  @click="resetFilters"
                  class="p-1.5 hover:bg-muted rounded-lg transition-all text-muted-foreground hover:text-primary active:scale-90"
                  title="重置所有参数"
                  aria-label="重置所有参数"
                >
                  <RotateCcw :size="14" />
                </button>
              </transition>
            </div>
          </div>

          <div class="bg-muted/10 rounded-2xl p-4 border border-border/60 space-y-4">
            <!-- 亮度 -->
            <div class="space-y-3">
              <AppSlider
                v-model="brightness"
                label="亮度"
                :icon="Sun"
                unit="%"
                :min="0"
                :max="200"
                :step="1"
                :default-value="baselineValues.brightness"
                @update:model-value="activePresetName = ''"
              />
            </div>

            <!-- 对比度 -->
            <div class="space-y-3">
              <AppSlider
                v-model="contrast"
                label="对比度"
                :icon="Contrast"
                unit="%"
                :min="0"
                :max="200"
                :step="1"
                :default-value="baselineValues.contrast"
                @update:model-value="activePresetName = ''"
              />
            </div>

            <!-- 饱和度 -->
            <div class="space-y-3">
              <AppSlider
                v-model="saturation"
                label="饱和度"
                :icon="Droplets"
                unit="%"
                :min="0"
                :max="200"
                :step="1"
                :default-value="baselineValues.saturation"
                @update:model-value="activePresetName = ''"
              />
            </div>

            <!-- 模糊 -->
            <div class="space-y-3">
              <AppSlider
                v-model="blur"
                label="模糊"
                :icon="Layers"
                unit="px"
                :min="0"
                :max="20"
                :step="1"
                :default-value="baselineValues.blur"
                @update:model-value="activePresetName = ''"
              />
            </div>

            <!-- 褐色 -->
            <div class="space-y-3">
              <AppSlider
                v-model="sepia"
                label="褐色"
                :icon="Wind"
                unit="%"
                :min="0"
                :max="100"
                :step="1"
                :default-value="baselineValues.sepia"
                @update:model-value="activePresetName = ''"
              />
            </div>
          </div>
        </section>

        <section class="pt-6 border-t border-border/40">
          <div
            class="p-4 bg-muted/20 border border-border/40 rounded-2xl flex items-start gap-3 transition-all group hover:bg-muted/30"
          >
            <div class="bg-primary/10 p-2 rounded-xl group-hover:scale-110 transition-transform">
              <Sparkles :size="16" class="text-primary" />
            </div>
            <div class="space-y-1">
              <div class="text-[0.65rem] font-black text-primary uppercase tracking-widest">
                实时滤镜
              </div>
              <p class="text-[0.65rem] text-muted-foreground leading-relaxed font-medium">
                拖动滑块即可实时预览效果，处理过程完全本地化，无需担心隐私。
              </p>
            </div>
          </div>
        </section>

        <AppExportSettings
          v-model:format="outputFormat"
          v-model:quality="outputQuality"
          class="pt-6 border-t border-border/40"
        />
      </template>

      <template #footer>
        <InspectorFooter>
          <AppButton
            size="lg"
            :variant="ctaState.action === 'download' ? 'success' : 'cta'"
            class="w-full h-12 rounded-xl shadow-lg transition-all duration-500 active:scale-95 group overflow-hidden"
            :loading="isProcessing"
            :disabled="ctaState.disabled"
            @click="handleCtaClick"
          >
            <template #icon>
              <component :is="ctaState.icon" v-if="!isProcessing" :size="18" class="mr-2" />
            </template>
            <span class="font-bold text-sm tracking-tight">{{ ctaState.text }}</span>
          </AppButton>
        </InspectorFooter>
      </template>
    </WorkspaceLayout>
  </div>
</template>
