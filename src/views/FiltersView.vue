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
  Check,
  Sun,
  Contrast,
  Droplets,
  Layers,
  Wind,
  RotateCcw,
  ChevronLeft,
  ChevronRight
} from 'lucide-vue-next'
import { filterEngine } from '../lib/engines/filterEngine'
import { useImageProcessor } from '../composables/useImageProcessor'

import InspectorFooter from '../components/layout/InspectorFooter.vue'

const store = useImageStore()
const layoutStore = useLayoutStore()
const { downloadImage } = useFileHelpers()

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
  { name: '雷耶斯', values: { brightness: 110, contrast: 85, saturation: 75, blur: 0, sepia: 22 } }, // Reyes: 古旧照片
  { name: '水墨', values: { brightness: 110, contrast: 120, saturation: 0, blur: 0, sepia: 10 } }, // Inkwell: 质感黑白
  { name: '云雀', values: { brightness: 105, contrast: 90, saturation: 115, blur: 0, sepia: 0 } } // Lark: 风景专用
]

const applyPreset = (preset: (typeof presets)[0]) => {
  brightness.value = preset.values.brightness
  contrast.value = preset.values.contrast
  saturation.value = preset.values.saturation
  blur.value = preset.values.blur
  sepia.value = preset.values.sepia
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

const buttonText = computed(() => {
  if (isProcessing.value) return '正在应用...'
  if (store.selectedCount > 0) return `对选中的 ${store.selectedCount} 张应用效果`
  return '应用滤镜效果'
})
</script>

<template>
  <div class="h-full w-full flex flex-col overflow-hidden">
    <WorkspaceLayout show-sidebar no-scroll show-assets-tray>
      <template #header-left><ImageSelectionStatus /></template>
      <template #header-actions
        ><ImageActionsToolbar :is-processing="isProcessing" show-clear-all zip-prefix="_Filtered"
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
                class="flex-shrink-0 px-4 py-2.5 rounded-xl border transition-all active:scale-95 flex flex-col items-center gap-1.5 min-w-[70px] group"
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
                  class="text-[0.65rem] font-bold uppercase tracking-widest"
                  :class="[
                    activePresetName === preset.name ? 'text-primary' : 'text-muted-foreground'
                  ]"
                  >{{ preset.name }}</span
                >
              </button>
            </div>
          </div>
        </section>

        <section class="space-y-4 pt-2">
          <div class="flex items-center justify-between">
            <AppSectionHeader title="精细调整" :icon="Settings2" />
            <button
              @click="resetFilters"
              class="p-1.5 hover:bg-muted rounded-lg transition-all text-muted-foreground hover:text-primary active:scale-90"
              title="重置参数"
              aria-label="重置参数"
            >
              <RotateCcw :size="14" />
            </button>
          </div>

          <div class="bg-muted/10 rounded-2xl p-4 border border-border/60 space-y-6">
            <!-- 亮度 -->
            <div class="space-y-3">
              <div class="flex items-center justify-between px-0.5 h-6">
                <div class="flex items-center gap-2.5">
                  <div class="bg-primary/5 p-1 rounded-full flex items-center justify-center">
                    <Sun :size="15" :stroke-width="2.5" class="text-primary" />
                  </div>
                  <span
                    class="text-[0.65rem] font-bold text-muted-foreground uppercase tracking-widest leading-none"
                    >亮度</span
                  >
                </div>
                <span class="font-mono text-sm font-black text-primary tabular-nums"
                  >{{ brightness }}%</span
                >
              </div>
              <AppSlider
                v-model="brightness"
                :min="0"
                :max="200"
                :step="1"
                @update:model-value="activePresetName = ''"
              />
            </div>

            <!-- 对比度 -->
            <div class="space-y-3">
              <div class="flex items-center justify-between px-0.5 h-6">
                <div class="flex items-center gap-2.5">
                  <div class="bg-primary/5 p-1 rounded-full flex items-center justify-center">
                    <Contrast :size="15" :stroke-width="2.5" class="text-primary" />
                  </div>
                  <span
                    class="text-[0.65rem] font-bold text-muted-foreground uppercase tracking-widest leading-none"
                    >对比度</span
                  >
                </div>
                <span class="font-mono text-sm font-black text-primary tabular-nums"
                  >{{ contrast }}%</span
                >
              </div>
              <AppSlider
                v-model="contrast"
                :min="0"
                :max="200"
                :step="1"
                @update:model-value="activePresetName = ''"
              />
            </div>

            <!-- 饱和度 -->
            <div class="space-y-3">
              <div class="flex items-center justify-between px-0.5 h-6">
                <div class="flex items-center gap-2.5">
                  <div class="bg-primary/5 p-1 rounded-full flex items-center justify-center">
                    <Droplets :size="15" :stroke-width="2.5" class="text-primary" />
                  </div>
                  <span
                    class="text-[0.65rem] font-bold text-muted-foreground uppercase tracking-widest leading-none"
                    >饱和度</span
                  >
                </div>
                <span class="font-mono text-sm font-black text-primary tabular-nums"
                  >{{ saturation }}%</span
                >
              </div>
              <AppSlider
                v-model="saturation"
                :min="0"
                :max="200"
                :step="1"
                @update:model-value="activePresetName = ''"
              />
            </div>

            <!-- 模糊 -->
            <div class="space-y-3">
              <div class="flex items-center justify-between px-0.5 h-6">
                <div class="flex items-center gap-2.5">
                  <div class="bg-primary/5 p-1 rounded-full flex items-center justify-center">
                    <Layers :size="15" :stroke-width="2.5" class="text-primary" />
                  </div>
                  <span
                    class="text-[0.65rem] font-bold text-muted-foreground uppercase tracking-widest leading-none"
                    >模糊</span
                  >
                </div>
                <span class="font-mono text-sm font-black text-primary tabular-nums"
                  >{{ blur }}px</span
                >
              </div>
              <AppSlider
                v-model="blur"
                :min="0"
                :max="20"
                :step="1"
                @update:model-value="activePresetName = ''"
              />
            </div>

            <!-- 褐色 -->
            <div class="space-y-3">
              <div class="flex items-center justify-between px-0.5 h-6">
                <div class="flex items-center gap-2.5">
                  <div class="bg-primary/5 p-1 rounded-full flex items-center justify-center">
                    <Wind :size="15" :stroke-width="2.5" class="text-primary" />
                  </div>
                  <span
                    class="text-[0.65rem] font-bold text-muted-foreground uppercase tracking-widest leading-none"
                    >褐色</span
                  >
                </div>
                <span class="font-mono text-sm font-black text-primary tabular-nums"
                  >{{ sepia }}%</span
                >
              </div>
              <AppSlider
                v-model="sepia"
                :min="0"
                :max="100"
                :step="1"
                @update:model-value="activePresetName = ''"
              />
            </div>
          </div>
        </section>

        <section class="relative">
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
          class="pt-2"
        />
      </template>

      <template #footer>
        <InspectorFooter>
          <AppButton
            size="lg"
            variant="cta"
            class="w-full h-12 rounded-xl shadow-xl shadow-primary/10 transition-all active:scale-95"
            :loading="isProcessing"
            :disabled="!store.selectedCount || isProcessing"
            @click="handleApplyFilters"
          >
            <template #icon><Check v-if="!isProcessing" :size="18" class="mr-2" /></template>
            <span class="font-bold text-sm tracking-tight">{{ buttonText }}</span>
          </AppButton>
        </InspectorFooter>
      </template>
    </WorkspaceLayout>
  </div>
</template>
