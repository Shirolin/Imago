<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { ImageItem } from '../stores/imageStore'
import { useImageStore } from '../stores/imageStore'
import { useLayoutStore } from '../stores/layoutStore'
import WorkspaceLayout from '../components/layout/WorkspaceLayout.vue'
import AppButton from '../components/common/AppButton.vue'
import ImageCard from '../components/common/ImageCard.vue'
import InteractiveDownloadModal from '../components/InteractiveDownloadModal.vue'
import InteractiveEditorModal from '../components/InteractiveEditorModal.vue'
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
  RotateCcw,
  SlidersHorizontal,
  Wand2,
  Database,
  Trash2,
  CheckCircle2
} from 'lucide-vue-next'
import { bgRemoveEngine } from '../lib/engines/bgRemoveEngine'
import { matchBgRemoveEngine } from '../lib/engines/matchBgRemoveEngine'
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

// 引擎模式：Match (取色) vs Smart (智能-标准) vs Pro (专业-全量)
const engineMode = ref<'match' | 'smart' | 'pro'>('match')

const engineOptions = [
  { label: '取色 (Match)', value: 'match', icon: Palette },
  { label: '智能 (Smart)', value: 'smart', icon: Wand2 },
  { label: '专业 (Pro)', value: 'pro', icon: Trophy }
]

// --- 参数默认值 ---
const DEFAULT_MATCH_TOLERANCE = 15
const DEFAULT_MATCH_FEATHER = 5
const DEFAULT_AI_STRICTNESS = 0
const DEFAULT_AI_OFFSET = 0
const DEFAULT_AI_SMOOTHNESS = 0

// --- 响应式状态 ---
const matchTolerance = ref(DEFAULT_MATCH_TOLERANCE)
const matchFeather = ref(DEFAULT_MATCH_FEATHER)
const matchColor = ref('#ffffff')

// AI 精修参数
const aiStrictness = ref(DEFAULT_AI_STRICTNESS)
const aiOffset = ref(DEFAULT_AI_OFFSET)
const aiSmoothness = ref(DEFAULT_AI_SMOOTHNESS)

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

const isAiDirty = computed(() => {
  return (
    Math.abs(aiStrictness.value - DEFAULT_AI_STRICTNESS) > 0.001 ||
    Math.abs(aiOffset.value - DEFAULT_AI_OFFSET) > 0.001 ||
    Math.abs(aiSmoothness.value - DEFAULT_AI_SMOOTHNESS) > 0.001
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

// 模型状态 (v2 版本锁定，确保在重构后强制重新触发下载检测)
const smartStatus = ref<'not_ready' | 'loading' | 'ready' | 'error'>(
  localStorage.getItem('imago-bg-v2-smart-ready') === 'true' ? 'ready' : 'not_ready'
)
const proStatus = ref<'not_ready' | 'loading' | 'ready' | 'error'>(
  localStorage.getItem('imago-bg-v2-pro-ready') === 'true' ? 'ready' : 'not_ready'
)

const currentStatus = computed(() => {
  if (engineMode.value === 'match') return 'ready'
  if (engineMode.value === 'smart') return smartStatus.value
  return proStatus.value
})

const showInitModal = ref(false)
const initProgress = ref(0)
const initError = ref('')
const showCompareModal = ref(false)
const comparingImage = ref<ImageItem | null>(null)
// --- 交互式编辑器相关 (SAM2) ---
const showDownloadModal = ref(false)
const showEditorModal = ref(false)
const activeInteractiveImage = ref<ImageItem | null>(null)

const handleInteractiveClick = (id: string) => {
  const item = store.images.find((img) => img.id === id)
  if (!item) return
  activeInteractiveImage.value = item

  // 检查是否已经同意下载过 (使用 v2 版本号强制重新授权一次)
  const isReady = localStorage.getItem('imago-sam2-v2-ready') === 'true'
  if (isReady) {
    showEditorModal.value = true
  } else {
    showDownloadModal.value = true
  }
}

const handleConfirmDownload = () => {
  localStorage.setItem('imago-sam2-v2-ready', 'true')
  showDownloadModal.value = false
  // 错开状态切换，确保过渡平滑且模态框能正确捕获 show 信号
  setTimeout(() => {
    showEditorModal.value = true
  }, 300)
}

const handleInteractiveApply = (maskBlob: Blob) => {
  if (!activeInteractiveImage.value) return

  // 更新图片状态：标记为已处理，并更新预览
  const id = activeInteractiveImage.value.id

  if (activeInteractiveImage.value.processedPreview) {
    URL.revokeObjectURL(activeInteractiveImage.value.processedPreview)
  }

  const preview = URL.createObjectURL(maskBlob)
  store.updateImage(id, {
    status: 'done',
    processedBlob: maskBlob,
    processedPreview: preview,
    processedSize: maskBlob.size,
    isDirty: false
  })

  showEditorModal.value = false
  activeInteractiveImage.value = null
}

const matchProcessor = useImageProcessor(matchBgRemoveEngine)
const proProcessor = useImageProcessor(bgRemoveEngine)

const isProcessing = computed(
  () => matchProcessor.isProcessing.value || proProcessor.isProcessing.value
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
    aiStrictness,
    aiOffset,
    aiSmoothness,
    useHighFidelity,
    engineMode
  ],
  () => store.markAllAsDirty()
)

const handleInitialize = async () => {
  if (currentStatus.value === 'loading') return
  initProgress.value = 0
  initError.value = ''

  const targetModel = (engineMode.value === 'pro' ? 'isnet' : 'isnet_quint8') as
    | 'isnet'
    | 'isnet_quint8'
  const statusRef = engineMode.value === 'pro' ? proStatus : smartStatus
  const storageKey =
    engineMode.value === 'pro' ? 'imago-bg-v2-pro-ready' : 'imago-bg-v2-smart-ready'

  statusRef.value = 'loading'
  try {
    await preload({
      model: targetModel,
      progress: (key, current, total) => {
        if (key.includes('fetch')) initProgress.value = Math.round((current / total) * 100)
      }
    })
    statusRef.value = 'ready'
    localStorage.setItem(storageKey, 'true')
    showInitModal.value = false
  } catch (err) {
    statusRef.value = 'error'
    initError.value = (err as Error).message || '下载 AI 引擎资产失败'
  }
}

const ctaState = computed(() => {
  const status = currentStatus.value
  if (status === 'not_ready' || status === 'error') {
    const size = engineMode.value === 'pro' ? '176MB' : '40MB'
    return {
      text:
        status === 'error'
          ? '重试下载引擎'
          : `激活${engineMode.value === 'pro' ? '全量' : '智能'}模型 (~${size})`,
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
      engineMode.value === 'match' ? matchProcessor.progress.value : proProcessor.progress.value
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
    } else {
      await proProcessor.processSelected({
        ...commonOptions,
        model: engineMode.value === 'pro' ? 'isnet' : 'isnet_quint8',
        maskThreshold: aiStrictness.value / 100,
        maskShrink: aiOffset.value / 100,
        maskBlur: aiSmoothness.value
      })
    }
  }
}

const handleResetEngine = async () => {
  // 1. 物理删除：清理浏览器 Cache Storage 中的大文件资产
  try {
    const cacheKeys = await caches.keys()
    for (const key of cacheKeys) {
      if (key.includes('imgly')) {
        await caches.delete(key)
        console.log(`[Imago] 🗑️ Erased Cache Storage: ${key}`)
      }
    }
  } catch (err) {
    console.error('[Imago] Failed to clear Cache Storage:', err)
  }

  // 2. 标记删除：清理 LocalStorage 并更新 UI 状态
  localStorage.removeItem('imago-bg-v2-pro-ready')
  localStorage.removeItem('imago-bg-v2-smart-ready')
  smartStatus.value = 'not_ready'
  proStatus.value = 'not_ready'
}

const handleResetParams = () => {
  if (engineMode.value === 'match') {
    matchTolerance.value = DEFAULT_MATCH_TOLERANCE
    matchFeather.value = DEFAULT_MATCH_FEATHER
  } else {
    aiStrictness.value = DEFAULT_AI_STRICTNESS
    aiOffset.value = DEFAULT_AI_OFFSET
    aiSmoothness.value = DEFAULT_AI_SMOOTHNESS
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
          :title="engineMode === 'pro' ? '专业版全量 AI 引擎初始化' : '智能标准版 AI 引擎初始化'"
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
              {{ engineMode === 'pro' ? '专业版全量 AI 引擎初始化' : '智能标准版 AI 引擎初始化' }}
            </h2>
            <p class="text-sm text-muted-foreground font-medium leading-relaxed mb-8">
              <template v-if="engineMode === 'pro'"
                >需下载约
                <span class="text-primary font-bold">176MB</span>
                模型。采用完整精度算法，适合处理支架及复杂边缘。</template
              >
              <template v-else
                >需下载约
                <span class="text-primary font-bold">40MB</span>
                模型。采用量化加速算法，适合日常快速抠图。</template
              >
            </p>
            <div
              v-if="currentStatus === 'loading'"
              class="mb-8 space-y-3 text-left"
              role="progressbar"
              :aria-valuenow="initProgress"
              aria-valuemin="0"
              aria-valuemax="100"
              :aria-label="`正在下载${engineMode === 'pro' ? '专业' : '智能'} AI 引擎资产`"
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
                  : `同意并下载 (${engineMode === 'pro' ? '176MB' : '40MB'})`
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
            @interactive="handleInteractiveClick"
          />
        </div>

        <!-- 交互式编辑器模态框 -->
        <InteractiveDownloadModal
          :show="showDownloadModal"
          @confirm="handleConfirmDownload"
          @cancel="showDownloadModal = false"
        />

        <InteractiveEditorModal
          v-if="activeInteractiveImage"
          :show="showEditorModal"
          :image-item="{
            id: activeInteractiveImage.id,
            file: activeInteractiveImage.file,
            url: activeInteractiveImage.preview || ''
          }"
          @close="showEditorModal = false"
          @apply="handleInteractiveApply"
        />
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
                  (engineMode === 'match' && isMatchDirty) || (engineMode !== 'match' && isAiDirty)
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
            >智能取色：通过算法识别背景色自动移除，适合纯色背景。需下载约
            <span class="text-primary font-bold uppercase">0MB</span> 资产。</span
          >
          <span v-else-if="engineMode === 'smart'"
            >智能标准版：采用中量级 AI 模型。适合处理日常物体，光影过渡细腻。需下载约
            <span class="text-primary font-bold uppercase">40MB</span> 资产。</span
          >
          <span v-else
            >专业全量版：采用全精度 ISNet 模型。边缘识别更稳健，配合下方 “高级精修”
            功能可大幅优化复杂背景的残留。需下载约
            <span class="text-primary font-black uppercase">176MB</span> 资产。</span
          >
        </AppTip>
      </section>

      <!-- 引擎看板：指向性状态反馈 -->
      <section v-if="engineMode !== 'match'" class="space-y-3 pt-6 border-t border-border/40">
        <div class="flex items-center justify-between group">
          <div class="flex items-center gap-2">
            <Database :size="14" class="text-muted-foreground" />
            <span class="text-[11px] font-bold text-muted-foreground uppercase tracking-widest"
              >AI 引擎状态仪表盘</span
            >
          </div>
          <button
            @click="handleResetEngine"
            class="text-[10px] text-muted-foreground/40 hover:text-destructive flex items-center gap-1 transition-colors"
            title="强制重新初始化并下载"
          >
            <Trash2 :size="10" /> <span>删除模型</span>
          </button>
        </div>

        <div class="p-3 bg-muted/5 rounded-xl border border-border/40 space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-[10px] text-muted-foreground/60 font-medium">当前模型</span>
            <span
              class="text-[10px] font-bold"
              :class="engineMode === 'pro' ? 'text-primary' : 'text-foreground'"
            >
              {{ engineMode === 'pro' ? 'ISNet (176MB Full)' : 'ISNet (40MB Quant)' }}
            </span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-[10px] text-muted-foreground/60 font-medium">连接状态</span>
            <div class="flex items-center gap-1.5">
              <span
                class="h-1.5 w-1.5 rounded-full"
                :class="currentStatus === 'ready' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'"
              ></span>
              <span
                class="text-[10px] font-bold"
                :class="currentStatus === 'ready' ? 'text-emerald-500' : 'text-amber-500'"
              >
                {{
                  currentStatus === 'ready' ? '连接成功 - 本地已就绪' : '发现更新 - 待引导初始化'
                }}
              </span>
            </div>
          </div>
        </div>
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

        <section v-else class="space-y-4 pt-6 border-t border-border/40">
          <div class="flex items-center justify-between">
            <AppSectionHeader title="高级精修 (Refiner)" :icon="SlidersHorizontal" />
            <div
              class="flex items-center gap-1 px-1.5 py-0.5 bg-primary/10 rounded-md border border-primary/20 scale-90 origin-right"
            >
              <CheckCircle2 :size="10" class="text-primary" />
              <span class="text-[9px] font-black text-primary uppercase">{{
                engineMode === 'pro' ? 'Premium Core' : 'Lite Core'
              }}</span>
            </div>
          </div>
          <div class="bg-muted/10 rounded-2xl p-4 border border-border/60 space-y-4">
            <AppSlider
              v-model="aiStrictness"
              :min="0"
              :max="100"
              label="判定严格度 (Strictness)"
              unit="%"
              :default-value="DEFAULT_AI_STRICTNESS"
              description="提高此值可强制切断半透明的支架或残影。"
            />
            <AppSlider
              v-model="aiOffset"
              :min="0"
              :max="50"
              label="边缘向内偏移 (Offset)"
              unit="%"
              :default-value="DEFAULT_AI_OFFSET"
              description="物理收缩遮罩边缘，有效剔除粘连的细碎物体。"
            />
            <AppSlider
              v-model="aiSmoothness"
              :min="0"
              :max="10"
              :step="0.5"
              label="边缘平滑度 (Smooth)"
              unit="px"
              :default-value="DEFAULT_AI_SMOOTHNESS"
              description="消除 AI 产生的阶梯状锯齿，使边缘更圆润。"
            />
          </div>
        </section>
      </transition>

      <!-- 第三分区：处理选项 -->
      <section v-if="engineMode !== 'match'" class="space-y-4 pt-6 border-t border-border/40">
        <AppSectionHeader title="处理选项" :icon="Zap" />
        <div class="bg-muted/10 rounded-2xl p-4 border border-border/60">
          <AppCheckbox
            v-model="useHighFidelity"
            label="禁用预缩放 (原图推理)"
            description="跳过尺寸压缩，AI 直接在原始分辨率下运行。边缘最精准，但消耗更多内存。"
          />
        </div>
      </section>

      <!-- 第四分区：导出设置 -->
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
