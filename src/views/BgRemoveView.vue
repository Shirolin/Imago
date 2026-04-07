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
  Palette
} from 'lucide-vue-next'
import { bgRemoveEngine } from '../lib/engines/bgRemoveEngine'
import { matchBgRemoveEngine } from '../lib/engines/matchBgRemoveEngine'
import { preload } from '@imgly/background-removal'
import { useImageProcessor } from '../composables/useImageProcessor'
import { useFileHelpers } from '../composables/useFileHelpers'
import AppSlider from '../components/common/AppSlider.vue'
import AppModal from '../components/common/AppModal.vue'
import AppColorPicker from '../components/common/AppColorPicker.vue'
import AppTip from '../components/common/AppTip.vue'
import ImageCompare from '../components/common/ImageCompare.vue'

const store = useImageStore()
const layoutStore = useLayoutStore()
const { downloadImage, downloadAllAsZip, formatSize } = useFileHelpers()

// 引擎模式：Match (智能取色, 0MB) vs Pro (全品类专业, ~40MB)
const engineMode = ref<'match' | 'pro'>('match')

const engineOptions = [
  { label: '取色 (Match)', value: 'match', icon: Palette },
  { label: '全能专业 (Pro)', value: 'pro', icon: Trophy }
]

// 智能取色参数 (使用 0-100 刻度以适配百分比显示)
const DEFAULT_TOLERANCE = 15
const DEFAULT_FEATHER = 10
const matchTolerance = ref(DEFAULT_TOLERANCE)
const matchFeather = ref(DEFAULT_FEATHER)
const matchColor = ref('#ffffff') // 默认白色

// 是否修改过参数（用于显示批量重置）
const isMatchDirty = computed(() => {
  return (
    Math.abs(matchTolerance.value - DEFAULT_TOLERANCE) > 0.001 ||
    Math.abs(matchFeather.value - DEFAULT_FEATHER) > 0.001
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

// 模型加载状态管理
const proStatus = ref<'not_ready' | 'loading' | 'ready' | 'error'>(
  localStorage.getItem('imago-bg-pro-ready') === 'true' ? 'ready' : 'not_ready'
)

// Match 模式永远是 ready 的
const currentStatus = computed(() => {
  if (engineMode.value === 'match') return 'ready'
  return proStatus.value
})

const showInitModal = ref(false)
const initProgress = ref(0)
const initError = ref('')

// 对比弹窗状态
const showCompareModal = ref(false)
const comparingImage = ref<ImageItem | null>(null)

// 默认使用 PNG 输出以保留透明通道
const outputFormat = ref<string>('image/png')
const outputQuality = ref(1.0)

const matchProcessor = useImageProcessor(matchBgRemoveEngine)
const proProcessor = useImageProcessor(bgRemoveEngine)

const isProcessing = computed(
  () => matchProcessor.isProcessing.value || proProcessor.isProcessing.value
)

const displayImages = computed(() => [...store.images].reverse())

const handleCardClick = (id: string) => {
  store.toggleSelection(id)
}

const handleCompare = (id: string) => {
  const item = store.images.find((img) => img.id === id)
  if (!item || !item.processedBlob) return
  comparingImage.value = item
  showCompareModal.value = true
}

const closeCompare = () => {
  showCompareModal.value = false
}
const handleModalLeave = () => {
  comparingImage.value = null
}

const handleDownload = (id: string) => {
  const item = store.images.find((img) => img.id === id)
  if (item?.processedBlob) downloadImage(item.processedBlob, item.file.name, '_NoBG')
}

watch([outputFormat, outputQuality, matchTolerance, matchFeather, matchColor], () =>
  store.markAllAsDirty()
)
// 切换引擎时也标记脏数据，因为不同引擎效果不同
watch(engineMode, () => store.markAllAsDirty())

const handleInitialize = async () => {
  if (currentStatus.value === 'loading') return

  initProgress.value = 0
  initError.value = ''

  if (engineMode.value === 'pro') {
    proStatus.value = 'loading'
    try {
      await preload({
        progress: (key, current, total) => {
          if (key.includes('fetch')) {
            initProgress.value = Math.round((current / total) * 100)
          }
        }
      })
      proStatus.value = 'ready'
      localStorage.setItem('imago-bg-pro-ready', 'true')
      showInitModal.value = false
    } catch (err) {
      proStatus.value = 'error'
      initError.value = (err as Error).message || '下载引擎失败'
    }
  }
}

const ctaState = computed(() => {
  const status = currentStatus.value

  // 第一优先级：模型未就绪
  if (status === 'not_ready' || status === 'error') {
    return {
      text: status === 'error' ? '重试下载引擎' : '下载 AI 引擎 (~40MB)',
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
      action: 'show_init',
      disabled: false,
      variant: 'cta' as const
    }
  }

  // 第二优先级：模型已就绪，处理图片逻辑
  if (store.selectedCount === 0)
    return {
      text: '请选择图片',
      icon: Sparkles,
      action: 'none',
      disabled: true,
      variant: 'cta' as const
    }

  if (isProcessing.value)
    return {
      text: '正在去除背景...',
      icon: Sparkles,
      action: 'none',
      disabled: true,
      variant: 'cta' as const
    }

  const selectedImages = store.images.filter((img) => store.selectedIds.has(img.id))
  const allDoneAndClean =
    selectedImages.length > 0 &&
    selectedImages.every((img) => img.status === 'done' && img.processedBlob && !img.isDirty)

  if (allDoneAndClean) {
    return {
      text: `导出透明图片 (${store.selectedCount})`,
      icon: Download,
      action: 'download',
      disabled: false,
      variant: 'success' as const
    }
  }

  const anyDirty = selectedImages.some((img) => img.status === 'done' && img.isDirty)
  return {
    text: anyDirty ? `重新去除 (${store.selectedCount})` : `一键去除背景 (${store.selectedCount})`,
    icon: Sparkles,
    action: 'process',
    disabled: false,
    variant: 'cta' as const
  }
})

interface ProcessingOptions {
  format: string
  quality: number
  targetColor?: { r: number; g: number; b: number }
  tolerance?: number
  feather?: number
}

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
    if (currentStatus.value !== 'ready') {
      showInitModal.value = true
      return
    }

    const exportOptions = {
      format: outputFormat.value,
      quality: outputQuality.value
    }

    if (engineMode.value === 'match') {
      const options: ProcessingOptions = {
        ...exportOptions,
        targetColor: hexToRgb(matchColor.value),
        tolerance: matchTolerance.value / 100, // 还原为 0-1
        feather: matchFeather.value / 100 // 还原为 0-1
      }
      await matchProcessor.processSelected(options)
    } else {
      const options: ProcessingOptions = {
        ...exportOptions
      }
      await proProcessor.processSelected(options)
    }
  }
}
</script>

<template>
  <WorkspaceLayout show-sidebar no-scroll>
    <template #header-left><ImageSelectionStatus :show-card-size="false" /></template>
    <template #header-actions><ImageActionsToolbar show-clear-all /></template>

    <template #content>
      <div class="h-full w-full overflow-y-auto custom-scrollbar p-4 md:p-6 relative">
        <!-- 初始化确认弹窗 -->
        <AppModal
          :show="showInitModal"
          variant="dialog"
          title="全能专业初始化"
          @close="showInitModal = false"
        >
          <div class="p-8 text-center">
            <div
              class="w-20 h-20 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6"
            >
              <Zap v-if="currentStatus !== 'loading'" :size="40" class="text-primary" />
              <Loader2 v-else :size="40" class="text-primary animate-spin" />
            </div>

            <h2 class="text-2xl font-black mb-3 tracking-tight text-foreground">全能专业初始化</h2>
            <p class="text-sm text-muted-foreground font-medium leading-relaxed mb-8">
              全能专业版 (Pro) 需下载约 40MB
              模型。支持全品类（物品、宠物等）背景移除，边缘处理更细腻。
              <br />
              <span class="text-primary font-bold">所有处理均在本地完成，隐私 100% 安全。</span>
            </p>

            <div v-if="currentStatus === 'loading'" class="mb-8 space-y-3">
              <div class="h-2 w-full bg-muted rounded-full overflow-hidden">
                <div
                  class="h-full bg-primary transition-all duration-300 ease-out"
                  :style="{ width: `${initProgress}%` }"
                ></div>
              </div>
              <div
                class="flex justify-between text-[10px] font-black uppercase tracking-widest text-muted-foreground/60"
              >
                <span>正在抓取 AI 资产...</span>
                <span>{{ initProgress }}%</span>
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
              class="w-full h-14 rounded-2xl text-lg shadow-[0_10px_20px_-10px_rgba(var(--primary-rgb),0.5)]"
              :loading="currentStatus === 'loading'"
              @click="handleInitialize"
            >
              {{ currentStatus === 'error' ? '重试下载' : '同意并下载 (40MB)' }}
            </AppButton>

            <p
              class="mt-6 text-[10px] text-muted-foreground/40 font-bold uppercase tracking-widest"
            >
              推荐在 Wi-Fi 环境下进行
            </p>
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
      <div class="flex items-center justify-between pr-1 h-10">
        <AppSectionHeader title="背景去除方案" :icon="Sparkles" />

        <!-- 批量重置按钮占位符：固定宽度防止切换模式时标题和下方组件跳动 -->
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
              v-if="engineMode === 'match' && isMatchDirty"
              @click="
                () => {
                  matchTolerance = DEFAULT_TOLERANCE
                  matchFeather = DEFAULT_FEATHER
                }
              "
              class="p-1.5 hover:bg-muted rounded-lg transition-all text-muted-foreground hover:text-primary active:scale-90"
              title="重置所有参数"
            >
              <RotateCcw :size="14" />
            </button>
          </transition>
        </div>
      </div>
      <div class="mb-4">
        <AppSegmentedControl v-model="engineMode" :options="engineOptions" />
      </div>

      <AppTip :icon="Info" class="mb-6">
        <span v-if="engineMode === 'match'">
          智能取色：<span class="text-primary font-black uppercase">0MB 下载</span
          >。通过识别背景颜色自动背景移除，最适合纯色或渐变色背景下的物体。
        </span>
        <span v-else> 全能专业模式：全能识别，细节更强。需下载约 40MB 资产。 </span>
      </AppTip>

      <!-- 智能取色专属控制 -->
      <transition name="fade">
        <div v-if="engineMode === 'match'" class="space-y-6 pb-6 mb-6 border-b border-border/40">
          <div class="space-y-3">
            <div class="flex items-center justify-between px-1">
              <div class="flex items-center gap-2">
                <Palette :size="14" class="text-muted-foreground" />
                <span
                  class="text-[0.65rem] font-bold text-muted-foreground uppercase tracking-widest"
                  >目标背景色</span
                >
              </div>
            </div>
            <AppColorPicker v-model="matchColor" />
          </div>

          <div class="space-y-3">
            <AppSlider
              v-model="matchTolerance"
              :min="1"
              :max="50"
              :step="1"
              label="容差范围"
              unit="%"
              :default-value="DEFAULT_TOLERANCE"
            />
          </div>

          <div class="space-y-3">
            <AppSlider
              v-model="matchFeather"
              :min="0"
              :max="30"
              :step="1"
              label="边缘羽化"
              unit="%"
              :default-value="DEFAULT_FEATHER"
            />
          </div>
        </div>
      </transition>

      <div class="mt-4 px-1">
        <div
          class="text-[0.65rem] font-black text-muted-foreground/60 uppercase tracking-[0.15em] mb-2.5"
        >
          输出格式注意
        </div>
        <div
          class="text-xs font-bold text-foreground/80 leading-relaxed bg-muted/30 p-3 rounded-lg border border-border/40"
        >
          去除背景操作默认必须输出为支持 Alpha 透明通道的格式。推荐使用
          <span class="text-primary">PNG</span> 以获得最佳兼容性。
        </div>
      </div>

      <AppExportSettings
        v-model:format="outputFormat"
        v-model:quality="outputQuality"
        class="mt-6 pt-6 border-t border-border/40"
      />
    </template>

    <template #footer>
      <InspectorFooter>
        <div class="flex flex-col w-full gap-2">
          <AppButton
            size="lg"
            :variant="ctaState.variant"
            class="w-full h-12 rounded-xl shadow-lg transition-all duration-500 active:scale-95 group overflow-hidden"
            :loading="isProcessing || currentStatus === 'loading'"
            :disabled="ctaState.disabled"
            @click="handleCtaClick"
          >
            <template #icon>
              <component
                :is="ctaState.icon"
                v-if="!isProcessing && currentStatus !== 'loading'"
                :size="18"
                class="mr-2"
              />
            </template>
            <span class="font-bold text-sm tracking-tight">{{ ctaState.text }}</span>
          </AppButton>
          <div
            v-if="isProcessing"
            class="text-[10px] text-center font-bold text-muted-foreground/60 animate-pulse px-2"
          >
            引擎正在全力运算中，请稍后...
          </div>
          <div
            v-if="currentStatus === 'loading'"
            class="text-[10px] text-center font-bold text-primary animate-pulse px-2 uppercase tracking-widest"
          >
            正在获取引擎资产 ({{ initProgress }}%)...
          </div>
        </div>
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
