<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { ImageItem } from '../stores/imageStore'
import { useImageStore } from '../stores/imageStore'
import { useLayoutStore } from '../stores/layoutStore'
import WorkspaceLayout from '../components/layout/WorkspaceLayout.vue'
import AppButton from '../components/common/AppButton.vue'
import ImageCard from '../components/common/ImageCard.vue'
import AppExportSettings from '../components/common/AppExportSettings.vue'
import ImageSelectionStatus from '../components/common/ImageSelectionStatus.vue'
import ImageActionsToolbar from '../components/common/ImageActionsToolbar.vue'
import AppSectionHeader from '../components/common/AppSectionHeader.vue'
import AppSegmentedControl from '../components/common/AppSegmentedControl.vue'
import InspectorFooter from '../components/layout/InspectorFooter.vue'
import {
  Sparkles,
  Download,
  ImageMinus,
  Info,
  Zap,
  Loader2,
  AlertCircle,
  Trophy,
  Palette,
  Flower,
  RotateCcw
} from 'lucide-vue-next'
import { bgRemoveEngine } from '../lib/engines/bgRemoveEngine'
import { matchBgRemoveEngine } from '../lib/engines/matchBgRemoveEngine'
import { animeEngine } from '../lib/engines/animeEngine'
import { preload } from '@imgly/background-removal'
import { useImageProcessor } from '../composables/useImageProcessor'
import { useFileHelpers } from '../composables/useFileHelpers'
import AppSlider from '../components/common/AppSlider.vue'
import AppCheckbox from '../components/common/AppCheckbox.vue'
import AppModal from '../components/common/AppModal.vue'
import AppColorPicker from '../components/common/AppColorPicker.vue'
import AppTip from '../components/common/AppTip.vue'
import ImageCompare from '../components/common/ImageCompare.vue'

const store = useImageStore()
const layoutStore = useLayoutStore()
const { downloadImage, downloadAllAsZip, formatSize } = useFileHelpers()

// 引擎模式：Match (智能取色) vs Pro (通用专业) vs Anime (二次元专用)
const engineMode = ref<'match' | 'pro' | 'anime'>('match')

const engineOptions = [
  { label: '取色 (Match)', value: 'match', icon: Palette },
  { label: '通用专业 (Pro)', value: 'pro', icon: Trophy },
  { label: '二次元 (Anime)', value: 'anime', icon: Flower }
]

// --- 参数默认值 ---
const DEFAULT_MATCH_TOLERANCE = 15
const DEFAULT_MATCH_FEATHER = 5
const DEFAULT_ANIME_THRESHOLD = 0
const DEFAULT_ANIME_BLUR = 0
const DEFAULT_ANIME_RECOVERY = 0
const DEFAULT_ANIME_DENOISE = 0

// --- 响应式状态 ---
const matchTolerance = ref(DEFAULT_MATCH_TOLERANCE)
const matchFeather = ref(DEFAULT_MATCH_FEATHER)
const matchColor = ref('#ffffff')

const animeThreshold = ref(DEFAULT_ANIME_THRESHOLD)
const animeBlur = ref(DEFAULT_ANIME_BLUR)
const animeRecovery = ref(DEFAULT_ANIME_RECOVERY)
const animeDenoise = ref(DEFAULT_ANIME_DENOISE)

const useHighFidelity = ref(false)
const outputFormat = ref<string>('image/png')
const outputQuality = ref(1.0)

// 是否修改过参数
const isMatchDirty = computed(() => {
  return (
    Math.abs(matchTolerance.value - DEFAULT_MATCH_TOLERANCE) > 0.001 ||
    Math.abs(matchFeather.value - DEFAULT_MATCH_FEATHER) > 0.001
  )
})

const isAnimeDirty = computed(() => {
  return (
    Math.abs(animeThreshold.value - DEFAULT_ANIME_THRESHOLD) > 0.001 ||
    Math.abs(animeBlur.value - DEFAULT_ANIME_BLUR) > 0.001 ||
    Math.abs(animeRecovery.value - DEFAULT_ANIME_RECOVERY) > 0.001 ||
    Math.abs(animeDenoise.value - DEFAULT_ANIME_DENOISE) > 0.001
  )
})

// 辅助：HEX 转 RGB
const hexToRgb = (hex: string) => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
  return result
    ? {
        r: parseInt(result[1]!, 16),
        g: parseInt(result[2]!, 16),
        b: parseInt(result[3]!, 16)
      }
    : { r: 255, g: 255, b: 255 }
}

// 模型状态
const proStatus = ref<'not_ready' | 'loading' | 'ready' | 'error'>(
  localStorage.getItem('imago-bg-pro-ready') === 'true' ? 'ready' : 'not_ready'
)
const animeStatus = ref<'not_ready' | 'loading' | 'ready' | 'error'>(
  localStorage.getItem('imago-bg-anime-ready') === 'true' ? 'ready' : 'not_ready'
)

const currentStatus = computed(() => {
  if (engineMode.value === 'match') return 'ready'
  if (engineMode.value === 'anime') return animeStatus.value
  return proStatus.value
})

const showInitModal = ref(false)
const initProgress = ref(0)
const initError = ref('')
const showCompareModal = ref(false)
const comparingImage = ref<ImageItem | null>(null)

const matchProcessor = useImageProcessor(matchBgRemoveEngine)
const proProcessor = useImageProcessor(bgRemoveEngine)
const animeProcessor = useImageProcessor(animeEngine)

const isProcessing = computed(
  () =>
    matchProcessor.isProcessing.value ||
    proProcessor.isProcessing.value ||
    animeProcessor.isProcessing.value
)

const displayImages = computed(() => [...store.images].reverse())

const handleCardClick = (id: string) => store.toggleSelection(id)
const handleCompare = (id: string) => {
  const item = store.images.find((img) => img.id === id)
  if (!item || !item.processedBlob) return
  comparingImage.value = item
  showCompareModal.value = true
}
const closeCompare = () => (showCompareModal.value = false)
const handleModalLeave = () => (comparingImage.value = null)
const handleDownload = (id: string) => {
  const item = store.images.find((img) => img.id === id)
  if (item?.processedBlob) downloadImage(item.processedBlob, item.file.name, '_NoBG')
}

// 监听参数变化标记脏数据
watch(
  [
    outputFormat,
    outputQuality,
    matchTolerance,
    matchFeather,
    matchColor,
    animeThreshold,
    animeBlur,
    animeRecovery,
    animeDenoise,
    useHighFidelity,
    engineMode
  ],
  () => store.markAllAsDirty()
)

const handleInitialize = async () => {
  if (currentStatus.value === 'loading') return
  initProgress.value = 0
  initError.value = ''

  if (engineMode.value === 'pro') {
    proStatus.value = 'loading'
    try {
      await preload({
        progress: (key, current, total) => {
          if (key.includes('fetch')) initProgress.value = Math.round((current / total) * 100)
        }
      })
      proStatus.value = 'ready'
      localStorage.setItem('imago-bg-pro-ready', 'true')
      showInitModal.value = false
    } catch (err) {
      proStatus.value = 'error'
      initError.value = (err as Error).message || '下载通用引擎失败'
    }
  } else if (engineMode.value === 'anime') {
    animeStatus.value = 'loading'
    try {
      animeStatus.value = 'ready'
      localStorage.setItem('imago-bg-anime-ready', 'true')
      showInitModal.value = false
    } catch (err) {
      animeStatus.value = 'error'
      initError.value = (err as Error).message || '下载二次元引擎失败'
    }
  }
}

const ctaState = computed(() => {
  const status = currentStatus.value
  if (status === 'not_ready' || status === 'error') {
    const size = engineMode.value === 'anime' ? '176MB' : '40MB'
    return {
      text:
        status === 'error'
          ? '重试下载引擎'
          : `下载${engineMode.value === 'anime' ? '二次元' : 'AI'}引擎 (~${size})`,
      icon: Zap,
      action: 'show_init',
      disabled: false,
      variant: 'cta' as const
    }
  }
  if (status === 'loading') {
    return {
      text: `正在初始化 (${initProgress.value}%)`,
      icon: Loader2,
      action: 'none',
      disabled: true,
      variant: 'cta' as const
    }
  }
  if (store.selectedCount === 0)
    return {
      text: '请选择图片',
      icon: ImageMinus,
      action: 'none',
      disabled: true,
      variant: 'cta' as const
    }
  if (isProcessing.value) {
    const p =
      engineMode.value === 'match'
        ? matchProcessor.progress.value
        : engineMode.value === 'anime'
          ? animeProcessor.progress.value
          : proProcessor.progress.value
    return {
      text: `正在去除背景 (${p}%)`,
      icon: Sparkles,
      action: 'none',
      disabled: true,
      variant: 'cta' as const
    }
  }
  const selectedImages = store.images.filter((img) => store.selectedIds.has(img.id))
  const allDone =
    selectedImages.length > 0 &&
    selectedImages.every((img) => img.status === 'done' && img.processedBlob && !img.isDirty)
  if (allDone)
    return {
      text: `导出透明图片 (${store.selectedCount})`,
      icon: Download,
      action: 'download',
      disabled: false,
      variant: 'success' as const
    }
  return {
    text: `一键去除背景 (${store.selectedCount})`,
    icon: Sparkles,
    action: 'process',
    disabled: false,
    variant: 'cta' as const
  }
})

const handleCtaClick = async () => {
  const state = ctaState.value
  if (state.action === 'none') return
  if (state.action === 'show_init') {
    showInitModal.value = true
    return
  }
  if (state.action === 'download') {
    await downloadAllAsZip('_NoBG')
    return
  }

  if (state.action === 'process') {
    const commonOptions = {
      format: outputFormat.value,
      quality: outputQuality.value,
      usePreScaling: !useHighFidelity.value
    }
    if (engineMode.value === 'match') {
      await matchProcessor.processSelected({
        ...commonOptions,
        targetColor: hexToRgb(matchColor.value),
        tolerance: matchTolerance.value / 100,
        feather: matchFeather.value / 100
      })
    } else if (engineMode.value === 'anime') {
      await animeProcessor.processSelected({
        ...commonOptions,
        maskThreshold: animeThreshold.value / 100,
        maskBlur: animeBlur.value,
        alphaRecovery: animeRecovery.value / 100,
        denoise: animeDenoise.value
      })
    } else {
      await proProcessor.processSelected({ ...commonOptions, isAnime: false })
    }
  }
}

const handleResetParams = () => {
  if (engineMode.value === 'match') {
    matchTolerance.value = DEFAULT_MATCH_TOLERANCE
    matchFeather.value = DEFAULT_MATCH_FEATHER
  } else if (engineMode.value === 'anime') {
    animeThreshold.value = DEFAULT_ANIME_THRESHOLD
    animeBlur.value = DEFAULT_ANIME_BLUR
    animeRecovery.value = DEFAULT_ANIME_RECOVERY
    animeDenoise.value = DEFAULT_ANIME_DENOISE
  }
}
</script>

<template>
  <WorkspaceLayout show-sidebar no-scroll>
    <template #header-left><ImageSelectionStatus :show-card-size="false" /></template>
    <template #header-actions><ImageActionsToolbar show-clear-all /></template>

    <template #content>
      <div class="h-full w-full overflow-y-auto custom-scrollbar p-4 md:p-6 relative">
        <AppModal
          :show="showInitModal"
          variant="dialog"
          :title="engineMode === 'anime' ? '二次元引擎初始化' : '通用专业版初始化'"
          @close="showInitModal = false"
        >
          <div class="p-8 text-center">
            <div
              class="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6"
            >
              <Zap v-if="currentStatus !== 'loading'" :size="40" class="text-primary" />
              <Loader2 v-else :size="40" class="text-primary animate-spin" />
            </div>
            <h2 class="text-2xl font-black mb-3 tracking-tight text-foreground">
              {{ engineMode === 'anime' ? '二次元引擎初始化' : '通用专业版初始化' }}
            </h2>
            <p class="text-sm text-muted-foreground font-medium leading-relaxed mb-8">
              <template v-if="engineMode === 'anime'"
                >需下载约
                <span class="text-primary font-bold">176MB</span>
                模型以获得最佳插画识别效果。</template
              >
              <template v-else
                >需下载约
                <span class="text-primary font-bold">40MB</span> 模型以开启全品类识别。</template
              >
            </p>
            <div
              v-if="currentStatus === 'loading'"
              class="mb-8 space-y-3 text-left"
              role="progressbar"
              :aria-valuenow="initProgress"
              aria-valuemin="0"
              aria-valuemax="100"
              :aria-label="`正在下载${engineMode === 'anime' ? '二次元' : '通用专业'}引擎资产`"
            >
              <div class="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div
                  class="h-full bg-primary transition-all duration-300"
                  :style="{ width: `${initProgress}%` }"
                ></div>
              </div>
              <div
                class="flex justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground/60"
              >
                <span>正在下载...</span><span aria-hidden="true">{{ initProgress }}%</span>
              </div>
            </div>
            <div
              v-if="currentStatus === 'error'"
              class="mb-8 p-4 bg-destructive/5 border border-destructive/20 rounded-2xl flex items-start gap-3 text-left"
            >
              <AlertCircle :size="18" class="text-destructive shrink-0 mt-0.5" />
              <div class="text-xs font-bold text-destructive leading-normal">{{ initError }}</div>
            </div>
            <AppButton
              size="lg"
              variant="cta"
              class="w-full h-14 rounded-2xl text-lg shadow-lg"
              :loading="currentStatus === 'loading'"
              @click="handleInitialize"
            >
              {{
                currentStatus === 'error'
                  ? '重试下载'
                  : `同意并下载 (${engineMode === 'anime' ? '176MB' : '40MB'})`
              }}
            </AppButton>
          </div>
        </AppModal>

        <div
          v-if="store.images.length === 0"
          class="flex flex-col items-center justify-center py-32 animate-in fade-in duration-700"
        >
          <div class="bg-muted/30 p-8 rounded-full mb-6">
            <ImageMinus :size="48" class="text-muted-foreground/40" />
          </div>
          <p class="text-sm font-bold uppercase tracking-[0.2em] text-muted-foreground/60 mb-2">
            暂无图片
          </p>
          <p class="text-[11px] font-medium text-muted-foreground/40">
            导入包含主体的图片以自动去除背景
          </p>
        </div>
        <div
          v-else
          class="grid transition-all duration-300"
          :class="[
            layoutStore.cardSizeMode === 'compact'
              ? 'grid-cols-[repeat(auto-fill,minmax(130px,1fr))] lg:grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3 lg:gap-8'
              : 'grid-cols-[repeat(auto-fill,minmax(160px,1fr))] lg:grid-cols-[repeat(auto-fill,minmax(320px,1fr))] gap-4 lg:gap-10'
          ]"
        >
          <ImageCard
            v-for="img in displayImages"
            :key="img.id"
            :image="img"
            :is-selected="store.selectedIds.has(img.id)"
            show-transparency
            @toggle="handleCardClick"
            @remove="store.removeImage"
            @compare="handleCompare"
            @download="handleDownload"
          />
        </div>
      </div>
    </template>

    <template #sidebar>
      <!-- 第一分区：方案设定 -->
      <section class="space-y-4">
        <div class="flex items-center justify-between pr-1">
          <AppSectionHeader title="背景去除方案" :icon="Sparkles" />
          <div class="flex items-center gap-1">
            <transition name="fade">
              <div
                v-if="isProcessing || currentStatus === 'loading'"
                class="flex items-center gap-1.5 px-2 py-0.5 bg-primary/10 rounded-full border border-primary/20"
              >
                <Loader2 :size="10" class="animate-spin text-primary" />
                <span class="text-[9px] font-bold text-primary uppercase tracking-wider"
                  >处理中</span
                >
              </div>
              <button
                v-else-if="
                  (engineMode === 'match' && isMatchDirty) ||
                  (engineMode === 'anime' && isAnimeDirty)
                "
                @click="handleResetParams"
                class="p-1.5 hover:bg-muted rounded-lg transition-all text-muted-foreground hover:text-primary"
                title="重置当前模式参数"
                aria-label="重置参数"
              >
                <RotateCcw :size="14" />
              </button>
            </transition>
          </div>
        </div>
        <AppSegmentedControl
          v-model="engineMode"
          :options="engineOptions"
          aria-label="选择背景去除引擎"
        />
        <AppTip :icon="Info">
          <span v-if="engineMode === 'match'"
            >智能取色：采用
            <span class="text-primary font-bold uppercase">感知取色算法</span
            >。通过识别背景颜色自动移除，最适合纯色或渐变背景。需下载约
            <span class="text-primary font-bold uppercase">0MB</span> 资产。</span
          >
          <span v-else-if="engineMode === 'anime'"
            >二次元专用：采用
            <span class="text-primary font-bold uppercase">ISNet-Anime</span>
            模型。专门针对插画及动漫线条优化，边缘更锐利。需下载约
            <span class="text-primary font-bold uppercase">176MB</span> 资产。</span
          >
          <span v-else
            >通用专业模式：采用
            <span class="text-primary font-black uppercase">AI 深度学习</span>
            模型。全品类识别，处理光影更细腻。需下载约
            <span class="text-primary font-black uppercase">40MB</span> 资产。</span
          >
        </AppTip>
      </section>

      <!-- 第二分区：细分参数 -->
      <transition name="fade" mode="out-in">
        <section v-if="engineMode === 'match'" class="space-y-4 pt-6 border-t border-border/40">
          <AppSectionHeader title="取色调整" :icon="Palette" />
          <div class="bg-muted/10 rounded-2xl p-4 border border-border/60 space-y-5">
            <div class="space-y-2">
              <div class="flex items-center gap-2 px-1 h-5">
                <div class="bg-primary/5 p-1 rounded-full flex items-center justify-center">
                  <Palette :size="13" :stroke-width="2.5" class="text-primary" />
                </div>
                <span
                  id="bg-color-label"
                  class="text-[11px] font-bold text-muted-foreground leading-none"
                  >要去除的背景色</span
                >
              </div>
              <AppColorPicker
                v-model="matchColor"
                class="px-1"
                :show-transparent="false"
                aria-labelledby="bg-color-label"
              />
            </div>
            <AppSlider
              v-model="matchTolerance"
              :min="0"
              :max="50"
              label="容差范围"
              unit="%"
              :default-value="DEFAULT_MATCH_TOLERANCE"
              description="数值越大，识别范围越宽。"
            />
            <AppSlider
              v-model="matchFeather"
              :min="0"
              :max="30"
              label="边缘羽化"
              unit="%"
              :default-value="DEFAULT_MATCH_FEATHER"
              description="数值越大，边缘越圆润。"
            />
          </div>
        </section>

        <section
          v-else-if="engineMode === 'anime'"
          class="space-y-4 pt-6 border-t border-border/40"
        >
          <AppSectionHeader title="二次元参数" :icon="Flower" />
          <div class="bg-muted/10 rounded-2xl p-4 border border-border/60 space-y-4">
            <AppSlider
              v-model="animeThreshold"
              :min="-50"
              :max="50"
              label="边缘偏移 (Offset)"
              unit="%"
              :default-value="DEFAULT_ANIME_THRESHOLD"
              description="正值向内收缩剔除白边，负值向外扩张保留更多细节。"
            />
            <AppSlider
              v-model="animeBlur"
              :min="0"
              :max="10"
              :step="0.5"
              label="边缘平滑 (Blur)"
              unit="px"
              :default-value="DEFAULT_ANIME_BLUR"
              description="消除 AI 推理产生的阶梯状锯齿，使曲线更圆润。"
            />
            <AppSlider
              v-model="animeRecovery"
              :min="0"
              :max="100"
              label="线条恢复 (Recovery)"
              unit="%"
              :default-value="DEFAULT_ANIME_RECOVERY"
              description="拉起极细或半透明的线条，防止线条被过度吞噬。"
            />
            <AppSlider
              v-model="animeDenoise"
              :min="0"
              :max="5"
              :step="1"
              label="杂色去除 (Denoise)"
              unit="级"
              :default-value="DEFAULT_ANIME_DENOISE"
              description="利用形态学降噪剔除背景残留的零星杂点。"
            />
          </div>
        </section>
        <div v-else class="hidden"></div>
      </transition>

      <!-- 第三分区：高级处理选项 -->
      <section v-if="engineMode !== 'match'" class="space-y-4 pt-6 border-t border-border/40">
        <AppSectionHeader title="高级处理选项" :icon="Zap" />
        <div class="bg-muted/10 rounded-2xl p-4 border border-border/60">
          <AppCheckbox
            v-model="useHighFidelity"
            :label="engineMode === 'anime' ? '高清强制锐化 (Super Sharp)' : '禁用预缩放 (原图推理)'"
            :description="
              engineMode === 'anime'
                ? '在不牺牲性能的前提下，通过二次采样和对比度拉伸使边缘恢复至原图级锐利。'
                : '跳过尺寸压缩，AI 直接在原始分辨率上运行。边缘最精准，但会消耗显著更多的内存。'
            "
          />
        </div>
      </section>

      <!-- 第四分区：输出格式注意 -->
      <section class="space-y-4 pt-6 border-t border-border/40">
        <AppSectionHeader title="输出说明" :icon="Info" />
        <AppTip :icon="Info">
          去除背景操作默认必须输出为支持 Alpha 透明通道的格式。推荐使用
          <span class="text-primary font-bold">PNG</span> 以获得最佳兼容性。
        </AppTip>
      </section>

      <!-- 第五分区：导出设置 -->
      <section class="pt-6 border-t border-border/40">
        <AppExportSettings v-model:format="outputFormat" v-model:quality="outputQuality" />
      </section>
    </template>

    <template #footer>
      <InspectorFooter>
        <AppButton
          size="lg"
          :variant="ctaState.variant"
          class="w-full h-12 rounded-xl shadow-lg transition-all active:scale-95 group overflow-hidden"
          :loading="isProcessing || currentStatus === 'loading'"
          :disabled="ctaState.disabled"
          @click="handleCtaClick"
        >
          <template #icon
            ><component
              :is="ctaState.icon"
              v-if="!isProcessing && currentStatus !== 'loading'"
              :size="18"
              class="mr-2"
          /></template>
          <span class="font-bold text-sm tracking-tight">{{ ctaState.text }}</span>
        </AppButton>
      </InspectorFooter>
    </template>
  </WorkspaceLayout>

  <AppModal
    :show="showCompareModal"
    title="去除背景细节对比"
    @close="closeCompare"
    @after-leave="handleModalLeave"
  >
    <ImageCompare
      v-if="comparingImage"
      :original-url="comparingImage.file"
      :processed-url="comparingImage.processedBlob!"
      :original-size="formatSize(comparingImage.originalSize)"
      :processed-size="formatSize(comparingImage.processedSize || 0)"
      show-transparency
    />
  </AppModal>
</template>
