<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useImageStore } from '../stores/imageStore'
import WorkspaceLayout from '../components/layout/WorkspaceLayout.vue'
import ImageCard from '../components/common/ImageCard.vue'
import AppButton from '../components/common/AppButton.vue'
import {
  Sun,
  Contrast,
  Droplets,
  Check,
  Sparkles,
  Image as ImageIcon,
  RotateCcw,
  Eye,
  Zap,
  Palette,
  Wand2,
  CloudRain,
  EyeOff
} from 'lucide-vue-next'
import ImageSelectionStatus from '../components/common/ImageSelectionStatus.vue'
import ImageActionsToolbar from '../components/common/ImageActionsToolbar.vue'
import AppSectionHeader from '../components/common/AppSectionHeader.vue'
import AppSlider from '../components/common/AppSlider.vue'
import { filterEngine } from '../lib/engines/filterEngine'
import { useImageProcessor } from '../composables/useImageProcessor'
import { useDebounceFn } from '@vueuse/core'
import { ChevronDown, ChevronUp } from 'lucide-vue-next'

const store = useImageStore()

const activeImageId = ref<string | null>(null)
const isComparing = ref(false)

// 折叠状态管理
const expandedSections = ref({
  exposure: true,
  color: false,
  effects: false
})

const toggleSection = (section: keyof typeof expandedSections.value) => {
  expandedSections.value[section] = !expandedSections.value[section]
}

// 基础状态
const brightness = ref(100)
const contrast = ref(100)
const saturation = ref(100)
const blur = ref(0)
const grayscale = ref(0)
const sepia = ref(0)
const hueRotate = ref(0)
const invert = ref(0)
const vignette = ref(0)
const noise = ref(0)
const sharpen = ref(0)

const { isProcessing, processSelected } = useImageProcessor(filterEngine)

const activeImage = computed(() => {
  return store.images.find((img) => img.id === activeImageId.value) || store.images[0]
})

// 生成 CSS Filter 字符串
const filterValue = computed(() => {
  if (isComparing.value) return 'none'
  return `brightness(${brightness.value}%) contrast(${contrast.value}%) saturate(${saturation.value}%) blur(${blur.value}px) grayscale(${grayscale.value}%) sepia(${sepia.value}%) hue-rotate(${hueRotate.value}deg) invert(${invert.value}%)`
})

// 实时预览样式
const filterStyle = computed(() => ({
  filter: filterValue.value
}))

// 暗角预览样式 (使用径向渐变模拟)
const vignetteOverlayStyle = computed(() => {
  if (isComparing.value || vignette.value === 0) return { display: 'none' }
  return {
    background: `radial-gradient(circle, transparent 40%, rgba(0,0,0,${vignette.value / 100}) 100%)`,
    pointerEvents: 'none' as const,
    position: 'absolute' as const,
    inset: 0,
    zIndex: 10
  }
})

// 噪点预览样式 (使用 SVG 滤镜模拟)
const noiseOverlayStyle = computed(() => {
  if (isComparing.value || noise.value === 0) return { display: 'none' }
  return {
    opacity: noise.value / 200,
    pointerEvents: 'none' as const,
    position: 'absolute' as const,
    inset: 0,
    backgroundColor: '#000',
    maskImage:
      "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.65' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E\")",
    zIndex: 11
  }
})

const presets = [
  {
    name: '默认',
    category: '基础',
    values: {
      brightness: 100,
      contrast: 100,
      saturation: 100,
      blur: 0,
      grayscale: 0,
      sepia: 0,
      hueRotate: 0,
      invert: 0,
      vignette: 0,
      noise: 0,
      sharpen: 0
    }
  },
  {
    name: '电影感',
    category: '风格',
    values: {
      brightness: 90,
      contrast: 120,
      saturation: 80,
      blur: 0,
      grayscale: 0,
      sepia: 10,
      hueRotate: 0,
      invert: 0,
      vignette: 40,
      noise: 10,
      sharpen: 20
    }
  },
  {
    name: '复古',
    category: '风格',
    values: {
      brightness: 105,
      contrast: 90,
      saturation: 70,
      blur: 0,
      grayscale: 0,
      sepia: 60,
      hueRotate: 0,
      invert: 0,
      vignette: 30,
      noise: 20,
      sharpen: 0
    }
  },
  {
    name: '高反差黑白',
    category: '艺术',
    values: {
      brightness: 100,
      contrast: 150,
      saturation: 0,
      blur: 0,
      grayscale: 100,
      sepia: 0,
      hueRotate: 0,
      invert: 0,
      vignette: 50,
      noise: 5,
      sharpen: 40
    }
  },
  {
    name: '赛博朋克',
    category: '艺术',
    values: {
      brightness: 110,
      contrast: 120,
      saturation: 140,
      blur: 0,
      grayscale: 0,
      sepia: 0,
      hueRotate: 280,
      invert: 0,
      vignette: 20,
      noise: 0,
      sharpen: 10
    }
  },
  {
    name: '柔和梦幻',
    category: '效果',
    values: {
      brightness: 115,
      contrast: 85,
      saturation: 90,
      blur: 4,
      grayscale: 0,
      sepia: 5,
      hueRotate: 0,
      invert: 0,
      vignette: 0,
      noise: 0,
      sharpen: 0
    }
  }
]

const applyPreset = (preset: (typeof presets)[0]) => {
  const v = preset.values
  brightness.value = v.brightness
  contrast.value = v.contrast
  saturation.value = v.saturation
  blur.value = v.blur
  grayscale.value = v.grayscale
  sepia.value = v.sepia
  hueRotate.value = v.hueRotate
  invert.value = v.invert
  vignette.value = v.vignette
  noise.value = v.noise
  sharpen.value = v.sharpen
}

const handleApplyFilters = () => {
  processSelected({
    brightness: brightness.value,
    contrast: contrast.value,
    saturation: saturation.value,
    blur: blur.value,
    grayscale: grayscale.value,
    sepia: sepia.value,
    hueRotate: hueRotate.value,
    invert: invert.value,
    vignette: vignette.value,
    noise: noise.value,
    sharpen: sharpen.value
  })
}

const resetAll = () => applyPreset(presets[0]!)
const resetField = (field: string) => {
  const defaultValue = presets[0]!.values[field as keyof (typeof presets)[0]['values']]
  switch (field) {
    case 'brightness':
      brightness.value = defaultValue
      break
    case 'contrast':
      contrast.value = defaultValue
      break
    case 'saturation':
      saturation.value = defaultValue
      break
    case 'blur':
      blur.value = defaultValue
      break
    case 'grayscale':
      grayscale.value = defaultValue
      break
    case 'sepia':
      sepia.value = defaultValue
      break
    case 'hueRotate':
      hueRotate.value = defaultValue
      break
    case 'invert':
      invert.value = defaultValue
      break
    case 'vignette':
      vignette.value = defaultValue
      break
    case 'noise':
      noise.value = defaultValue
      break
    case 'sharpen':
      sharpen.value = defaultValue
      break
  }
}

const handleCardClick = (id: string) => {
  activeImageId.value = id
  store.toggleSelection(id)
}

const resetExposure = () => {
  resetField('brightness')
  resetField('contrast')
}

const resetColor = () => {
  resetField('saturation')
  resetField('hueRotate')
  resetField('grayscale')
  resetField('sepia')
}

const resetEffects = () => {
  resetField('blur')
  resetField('sharpen')
  resetField('vignette')
  resetField('noise')
  resetField('invert')
}

// 检查是否有未应用的变更
const isDirty = computed(() => {
  const d = presets[0]!.values
  return (
    brightness.value !== d.brightness ||
    contrast.value !== d.contrast ||
    saturation.value !== d.saturation ||
    blur.value !== d.blur ||
    grayscale.value !== d.grayscale ||
    sepia.value !== d.sepia ||
    hueRotate.value !== d.hueRotate ||
    invert.value !== d.invert ||
    vignette.value !== d.vignette ||
    noise.value !== d.noise ||
    sharpen.value !== d.sharpen
  )
})

// ---------------------------------------------------------
// 直方图逻辑 (性能优化版)
// ---------------------------------------------------------
const histogramCanvas = ref<HTMLCanvasElement | null>(null)
let analysisCanvas: HTMLCanvasElement | null = null
let analysisCtx: CanvasRenderingContext2D | null = null
let cachedAnalysisImg: HTMLImageElement | null = null

const initAnalysis = () => {
  if (!analysisCanvas) {
    analysisCanvas = document.createElement('canvas')
    analysisCanvas.width = 100
    analysisCanvas.height = 100
    analysisCtx = analysisCanvas.getContext('2d', { willReadFrequently: true })
  }
}

const updateHistogram = useDebounceFn(() => {
  if (!activeImage.value || !histogramCanvas.value) return
  initAnalysis()

  const runAnalysis = (img: HTMLImageElement) => {
    if (!analysisCtx || !analysisCanvas) return

    // 1. 将图片绘制到离屏 Canvas 并应用当前滤镜 (确保直方图准确)
    analysisCtx.clearRect(0, 0, 100, 100)
    analysisCtx.filter = filterValue.value
    analysisCtx.drawImage(img, 0, 0, 100, 100)

    const data = analysisCtx.getImageData(0, 0, 100, 100).data
    const r = new Array(256).fill(0)
    const g = new Array(256).fill(0)
    const b = new Array(256).fill(0)

    for (let i = 0; i < data.length; i += 4) {
      r[data[i]!]++
      g[data[i + 1]!]++
      b[data[i + 2]!]++
    }

    const hCtx = histogramCanvas.value!.getContext('2d')
    if (!hCtx) return
    const hW = histogramCanvas.value!.width
    const hH = histogramCanvas.value!.height
    hCtx.clearRect(0, 0, hW, hH)

    const max = Math.max(...r, ...g, ...b)
    const drawChannel = (arr: number[], color: string) => {
      hCtx.beginPath()
      hCtx.strokeStyle = color
      hCtx.lineWidth = 1
      for (let i = 0; i < 256; i++) {
        const x = (i / 256) * hW
        const y = hH - (arr[i]! / max) * hH
        if (i === 0) hCtx.moveTo(x, y)
        else hCtx.lineTo(x, y)
      }
      hCtx.stroke()
    }

    hCtx.globalCompositeOperation = 'screen'
    drawChannel(r, '#ff4444')
    drawChannel(g, '#44ff44')
    drawChannel(b, '#4444ff')
  }

  // 缓存 Image 对象，避免重复创建
  if (cachedAnalysisImg && cachedAnalysisImg.src === activeImage.value.preview) {
    runAnalysis(cachedAnalysisImg)
  } else {
    cachedAnalysisImg = new Image()
    cachedAnalysisImg.src = activeImage.value.preview
    cachedAnalysisImg.onload = () => runAnalysis(cachedAnalysisImg!)
  }
}, 100)

watch(
  [activeImage, brightness, contrast, saturation, grayscale, sepia, hueRotate, invert, isComparing],
  () => {
    updateHistogram()
  },
  { immediate: true }
)

onMounted(() => initAnalysis())
</script>

<template>
  <WorkspaceLayout show-sidebar>
    <template #header-left>
      <ImageSelectionStatus />
    </template>

    <template #header-actions>
      <ImageActionsToolbar show-clear-all />
    </template>

    <template #content>
      <ImageCard
        v-for="img in store.images"
        :key="img.id"
        :image="img"
        :is-selected="store.selectedIds.has(img.id)"
        :class="{
          'ring-2 ring-primary ring-offset-2 ring-offset-background': activeImage?.id === img.id
        }"
        @click="handleCardClick(img.id)"
        @remove="store.removeImage"
        :image-style="store.selectedIds.has(img.id) ? filterStyle : {}"
      >
        <template #visual-effects="{ image }">
          <!-- 实时效果叠加层 (仅选中的图片卡片显示预览，且通过专用插槽隔离 UI) -->
          <div v-if="store.selectedIds.has(image.id)" :style="vignetteOverlayStyle"></div>
          <div v-if="store.selectedIds.has(image.id)" :style="noiseOverlayStyle"></div>
        </template>
      </ImageCard>
    </template>

    <template #sidebar>
      <div class="flex flex-col h-full bg-card/40 backdrop-blur-sm border-l border-border/50">
        <div class="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-10">
          <!-- 1. 沉浸式预览区 -->
          <section class="space-y-4">
            <div class="flex items-center justify-between px-0.5">
              <AppSectionHeader title="画质预览" :icon="Eye" />
              <div class="flex items-center gap-3">
                <canvas
                  ref="histogramCanvas"
                  width="60"
                  height="24"
                  class="opacity-50 grayscale hover:grayscale-0 transition-all"
                ></canvas>
                <span class="text-[0.6rem] font-black text-primary/60 uppercase tracking-[0.2em]"
                  >Live</span
                >
              </div>
            </div>

            <div
              class="group relative aspect-video bg-slate-950 rounded-2xl border border-border/40 overflow-hidden shadow-soft ring-1 ring-white/5"
            >
              <!-- 预览模式标签 (Clarify) -->
              <div
                v-if="activeImage && isDirty && !isComparing"
                class="absolute top-3 left-3 z-30 px-2 py-1 bg-primary/20 backdrop-blur-md border border-primary/30 rounded-md animate-in fade-in slide-in-from-top-1 duration-300"
              >
                <span
                  class="text-[0.55rem] font-black text-primary uppercase tracking-[0.15em] flex items-center gap-1.5"
                >
                  <span class="w-1 h-1 rounded-full bg-primary animate-pulse"></span>
                  预览中 (未应用)
                </span>
              </div>

              <img
                v-if="activeImage"
                :src="activeImage.preview"
                :style="filterStyle"
                alt="Preview"
                class="w-full h-full object-contain transition-transform duration-700 group-hover:scale-105"
              />
              <div v-if="activeImage" :style="vignetteOverlayStyle"></div>
              <div v-if="activeImage" :style="noiseOverlayStyle"></div>

              <div
                v-else
                class="absolute inset-0 flex flex-col items-center justify-center gap-2 text-muted-foreground/40"
              >
                <ImageIcon :size="32" stroke-width="1.5" />
                <span class="text-[0.65rem] font-bold uppercase tracking-widest"
                  >Select an Image</span
                >
              </div>

              <!-- 对比触发器 (拇指优先) -->
              <button
                v-if="activeImage"
                @mousedown="isComparing = true"
                @mouseup="isComparing = false"
                @touchstart.prevent="isComparing = true"
                @touchend.prevent="isComparing = false"
                @mouseleave="isComparing = false"
                class="absolute bottom-3 left-3 flex items-center gap-2 px-3 py-1.5 bg-black/60 backdrop-blur-md rounded-full border border-white/10 hover:bg-primary/20 hover:border-primary/40 transition-all active:scale-95 group/compare z-30"
              >
                <component
                  :is="isComparing ? EyeOff : Eye"
                  :size="12"
                  class="text-white group-hover/compare:text-primary transition-colors"
                />
                <span class="text-[0.55rem] font-black text-white uppercase tracking-widest">{{
                  isComparing ? '正在查看原图' : '长按对比效果'
                }}</span>
              </button>
            </div>
          </section>

          <!-- 2. 分类预设 -->
          <section class="space-y-5">
            <AppSectionHeader title="风格预设" :icon="Sparkles" />
            <div class="grid grid-cols-3 gap-2">
              <button
                v-for="preset in presets"
                :key="preset.name"
                @click="applyPreset(preset)"
                class="group flex flex-col items-center gap-1.5 p-1 rounded-xl transition-all"
              >
                <div
                  class="relative w-full aspect-square rounded-lg overflow-hidden border border-border/40 group-hover:border-primary/50 transition-colors"
                >
                  <img
                    v-if="activeImage"
                    :src="activeImage.preview"
                    :style="{
                      filter: `brightness(${preset.values.brightness}%) contrast(${preset.values.contrast}%) saturate(${preset.values.saturation}%) grayscale(${preset.values.grayscale}%) sepia(${preset.values.sepia}%) hue-rotate(${preset.values.hueRotate}deg)`
                    }"
                    class="w-full h-full object-cover grayscale-[0.2] group-hover:grayscale-0 transition-all"
                  />
                  <div
                    class="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity"
                  ></div>
                </div>
                <span
                  class="text-[0.5rem] font-black text-muted-foreground group-hover:text-primary uppercase tracking-tighter truncate w-full text-center"
                  >{{ preset.name }}</span
                >
              </button>
            </div>
          </section>

          <!-- 3. 精细调节 (折叠版块) -->
          <div class="space-y-4">
            <!-- 曝光与对比 -->
            <section
              class="border border-border/20 rounded-2xl overflow-hidden transition-all duration-300 bg-background/20"
            >
              <button
                @click="toggleSection('exposure')"
                class="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
              >
                <div class="flex items-center gap-2.5">
                  <Zap :size="14" class="text-primary" />
                  <span class="text-[0.65rem] font-black uppercase tracking-widest text-foreground"
                    >曝光与对比</span
                  >
                </div>
                <div class="flex items-center gap-3">
                  <button
                    @click.stop="resetExposure"
                    class="text-muted-foreground/30 hover:text-primary transition-colors"
                  >
                    <RotateCcw :size="12" />
                  </button>
                  <component
                    :is="expandedSections.exposure ? ChevronUp : ChevronDown"
                    :size="14"
                    class="text-muted-foreground/40"
                  />
                </div>
              </button>

              <Transition
                enter-active-class="transition-all duration-300 ease-out"
                leave-active-class="transition-all duration-200 ease-in"
                enter-from-class="max-h-0 opacity-0"
                enter-to-class="max-h-[200px] opacity-100"
                leave-from-class="max-h-[200px] opacity-100"
                leave-to-class="max-h-0 opacity-0"
              >
                <div v-show="expandedSections.exposure" class="px-4 pb-5 space-y-5 overflow-hidden">
                  <AppSlider v-model="brightness" label="亮度" :max="200" :icon="Sun" />
                  <AppSlider v-model="contrast" label="对比度" :max="200" :icon="Contrast" />
                </div>
              </Transition>
            </section>

            <!-- 色彩与色调 -->
            <section
              class="border border-border/20 rounded-2xl overflow-hidden transition-all duration-300 bg-background/20"
            >
              <button
                @click="toggleSection('color')"
                class="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
              >
                <div class="flex items-center gap-2.5">
                  <Palette :size="14" class="text-primary" />
                  <span class="text-[0.65rem] font-black uppercase tracking-widest text-foreground"
                    >色彩与色调</span
                  >
                </div>
                <div class="flex items-center gap-3">
                  <button
                    @click.stop="resetColor"
                    class="text-muted-foreground/30 hover:text-primary transition-colors"
                  >
                    <RotateCcw :size="12" />
                  </button>
                  <component
                    :is="expandedSections.color ? ChevronUp : ChevronDown"
                    :size="14"
                    class="text-muted-foreground/40"
                  />
                </div>
              </button>

              <Transition
                enter-active-class="transition-all duration-300 ease-out"
                leave-active-class="transition-all duration-200 ease-in"
                enter-from-class="max-h-0 opacity-0"
                enter-to-class="max-h-[400px] opacity-100"
                leave-from-class="max-h-[400px] opacity-100"
                leave-to-class="max-h-0 opacity-0"
              >
                <div v-show="expandedSections.color" class="px-4 pb-5 space-y-5 overflow-hidden">
                  <AppSlider v-model="saturation" label="饱和度" :max="200" :icon="Droplets" />
                  <AppSlider
                    v-model="hueRotate"
                    label="色相旋转"
                    :max="360"
                    :icon="Wand2"
                    unit="°"
                  />
                  <AppSlider v-model="grayscale" label="黑白深度" :max="100" />
                  <AppSlider v-model="sepia" label="复古怀旧" :max="100" />
                </div>
              </Transition>
            </section>

            <!-- 细节与特效 -->
            <section
              class="border border-border/20 rounded-2xl overflow-hidden transition-all duration-300 bg-background/20"
            >
              <button
                @click="toggleSection('effects')"
                class="w-full flex items-center justify-between px-4 py-3 hover:bg-muted/30 transition-colors"
              >
                <div class="flex items-center gap-2.5">
                  <Sparkles :size="14" class="text-primary" />
                  <span class="text-[0.65rem] font-black uppercase tracking-widest text-foreground"
                    >细节与特效</span
                  >
                </div>
                <div class="flex items-center gap-3">
                  <button
                    @click.stop="resetEffects"
                    class="text-muted-foreground/30 hover:text-primary transition-colors"
                  >
                    <RotateCcw :size="12" />
                  </button>
                  <component
                    :is="expandedSections.effects ? ChevronUp : ChevronDown"
                    :size="14"
                    class="text-muted-foreground/40"
                  />
                </div>
              </button>

              <Transition
                enter-active-class="transition-all duration-300 ease-out"
                leave-active-class="transition-all duration-200 ease-in"
                enter-from-class="max-h-0 opacity-0"
                enter-to-class="max-h-[500px] opacity-100"
                leave-from-class="max-h-[500px] opacity-100"
                leave-to-class="max-h-0 opacity-0"
              >
                <div v-show="expandedSections.effects" class="px-4 pb-5 space-y-5 overflow-hidden">
                  <AppSlider v-model="sharpen" label="锐化细节" :max="100" />
                  <AppSlider v-model="vignette" label="暗角范围" :max="100" />
                  <AppSlider v-model="noise" label="颗粒杂色" :max="100" :icon="CloudRain" />
                  <AppSlider v-model="blur" label="柔和模糊" :max="20" unit="px" />
                  <AppSlider v-model="invert" label="色彩反转" :max="100" />
                </div>
              </Transition>
            </section>
          </div>
        </div>

        <!-- 底部动作条 -->
        <div
          class="p-6 bg-gradient-to-t from-card via-card to-transparent pt-12 mt-auto border-t border-border/40 relative z-20 shrink-0"
        >
          <div class="flex items-center justify-between mb-4 px-1">
            <button
              @click="resetAll"
              class="flex items-center gap-2 text-[0.55rem] font-black text-muted-foreground/60 hover:text-destructive uppercase tracking-widest transition-colors"
            >
              <RotateCcw :size="10" /> Reset All
            </button>
            <div class="flex flex-col items-end gap-0.5">
              <span
                class="text-[0.55rem] font-black text-muted-foreground/40 uppercase tracking-widest"
              >
                {{ store.selectedCount || store.images.length }} Assets Selected
              </span>
              <span v-if="isDirty" class="text-[0.5rem] font-bold text-primary/60 animate-pulse">
                效果尚未应用到原图
              </span>
            </div>
          </div>
          <AppButton
            size="lg"
            variant="cta"
            class="w-full h-14 rounded-2xl hover:-translate-y-0.5 shadow-xl shadow-primary/10 transition-all duration-300 active:scale-95 shrink-0"
            :loading="isProcessing"
            @click="handleApplyFilters"
          >
            <template #icon
              ><Check v-if="!isProcessing" :size="20" class="mr-2.5 stroke-[3px]"
            /></template>
            <span class="tracking-tight uppercase font-black text-sm">{{
              isDirty ? '应用当前效果' : '保存设置'
            }}</span>
          </AppButton>
        </div>
      </div>
    </template>
  </WorkspaceLayout>
</template>

<style scoped>
.shadow-soft {
  box-shadow: 0 10px 30px -10px rgba(0, 0, 0, 0.1);
}
</style>
