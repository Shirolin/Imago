<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
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
const { t } = useI18n()

// 引擎模式：Match (取色) vs Smart (智能-标准) vs Pro (专业-全量)
const engineMode = ref<'match' | 'smart' | 'pro'>('match')

const engineOptions = computed(() => [
  { label: t('tools.bgRemove.engineMatch'), value: 'match', icon: Palette },
  { label: t('tools.bgRemove.engineSmart'), value: 'smart', icon: Wand2 },
  { label: t('tools.bgRemove.enginePro'), value: 'pro', icon: Trophy }
])

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

const handleInteractiveApply = async (maskBlob: Blob) => {
  if (!activeInteractiveImage.value) return

  const id = activeInteractiveImage.value.id
  const originalUrl = activeInteractiveImage.value.preview

  // === 遮罩合成：将 SAM2 遮罩叠加到原图，生成透明背景抠图 ===
  const [origImg, maskImg] = await Promise.all([
    // 加载原图
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = reject
      img.crossOrigin = 'anonymous'
      img.src = originalUrl
    }),
    // 加载遮罩（白色=前景，黑色=背景）
    new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = reject
      img.src = URL.createObjectURL(maskBlob)
    })
  ])

  const canvas = document.createElement('canvas')
  canvas.width = origImg.naturalWidth
  canvas.height = origImg.naturalHeight
  const ctx = canvas.getContext('2d')!

  // 1. 绘制原图
  ctx.drawImage(origImg, 0, 0)

  // 2. 读取原图像素，并以遮罩的 R 通道作为 Alpha 通道写回
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)

  // 在临时 Canvas 上读取遮罩的灰度值
  const maskCanvas = document.createElement('canvas')
  maskCanvas.width = canvas.width
  maskCanvas.height = canvas.height
  const maskCtx = maskCanvas.getContext('2d')!
  maskCtx.drawImage(maskImg, 0, 0, canvas.width, canvas.height)
  const maskData = maskCtx.getImageData(0, 0, canvas.width, canvas.height)

  // 3. 遮罩的 R 通道即为 Alpha（白色=255=完全保留，黑色=0=完全透明）
  for (let i = 0; i < imgData.data.length; i += 4) {
    imgData.data[i + 3] = maskData.data[i]! // R 通道即是灰度值
  }
  ctx.putImageData(imgData, 0, 0)

  // 4. 导出为 PNG（保留透明通道）
  const resultBlob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob)
      else reject(new Error('Canvas toBlob failed'))
    }, 'image/png')
  })

  // 5. 更新图片状态
  if (activeInteractiveImage.value.processedPreview) {
    URL.revokeObjectURL(activeInteractiveImage.value.processedPreview)
  }

  const preview = URL.createObjectURL(resultBlob)
  store.updateImage(id, {
    status: 'done',
    processedBlob: resultBlob,
    processedPreview: preview,
    processedSize: resultBlob.size,
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
  if (item?.processedBlob) downloadImage(item.processedBlob, item.file.name, t('common.export.suffix.bgRemoved'))
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
    initError.value = (err as Error).message || t('tools.bgRemove.initError')
  }
}

const ctaState = computed(() => {
  const status = currentStatus.value
  if (status === 'not_ready' || status === 'error') {
    const size = engineMode.value === 'pro' ? '176MB' : '40MB'
    return {
      text:
        status === 'error'
          ? t('tools.bgRemove.retryInit')
          : t('tools.bgRemove.activateModel', {
              model:
                engineMode.value === 'pro' ? t('tools.bgRemove.pro') : t('tools.bgRemove.smart'),
              size
            }),
      icon: Zap,
      action: 'show_init',
      disabled: false,
      variant: 'cta' as const
    }
  }
  if (status === 'loading') {
    return {
      text: t('tools.bgRemove.initializing', { progress: initProgress.value }),
      icon: Loader2,
      action: 'none',
      disabled: true,
      variant: 'cta' as const
    }
  }
  if (store.selectedCount === 0)
    return {
      text: t('tools.bgRemove.cta.select'),
      icon: ImageMinus,
      action: 'none',
      disabled: true,
      variant: 'cta' as const
    }
  if (isProcessing.value) {
    const p =
      engineMode.value === 'match' ? matchProcessor.progress.value : proProcessor.progress.value
    return {
      text: t('tools.bgRemove.cta.processing', { progress: p }),
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
      text: t('tools.bgRemove.cta.export', { count: store.selectedCount }),
      icon: Download,
      action: 'download',
      disabled: false,
      variant: 'success' as const
    }
  return {
    text: t('tools.bgRemove.cta.process', { count: store.selectedCount }),
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
    <template #header-actions
      ><ImageActionsToolbar
        view-id="bgRemove"
        :is-processing="isProcessing"
        show-clear-all
        show-reset-all
        :zip-prefix="t('common.export.suffix.bgRemoved')"
        /></template>
    <template #content>
      <div class="h-full w-full overflow-y-auto custom-scrollbar p-4 md:p-6 relative">
        <AppModal
          :show="showInitModal"
          variant="dialog"
          :title="
            engineMode === 'pro'
              ? t('tools.bgRemove.initTitlePro')
              : t('tools.bgRemove.initTitleSmart')
          "
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
              {{
                engineMode === 'pro'
                  ? t('tools.bgRemove.initTitlePro')
                  : t('tools.bgRemove.initTitleSmart')
              }}
            </h2>
            <p class="text-sm text-muted-foreground font-medium leading-relaxed mb-8">
              <template v-if="engineMode === 'pro'"
                >{{ t('tools.bgRemove.initDescPro1') }}
                <span class="text-primary font-bold">176MB</span>
                {{ t('tools.bgRemove.initDescPro2') }}</template
              >
              <template v-else
                >{{ t('tools.bgRemove.initDescSmart1') }}
                <span class="text-primary font-bold">40MB</span>
                {{ t('tools.bgRemove.initDescSmart2') }}</template
              >
            </p>
            <div
              v-if="currentStatus === 'loading'"
              class="mb-8 space-y-3 text-left"
              role="progressbar"
              :aria-valuenow="initProgress"
              aria-valuemin="0"
              aria-valuemax="100"
              :aria-label="
                t('tools.bgRemove.downloadAria', {
                  model: engineMode === 'pro' ? t('tools.bgRemove.pro') : t('tools.bgRemove.smart')
                })
              "
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
                <span>{{ t('tools.bgRemove.downloading') }}</span
                ><span aria-hidden="true">{{ initProgress }}%</span>
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
                  ? t('tools.bgRemove.retryDownload')
                  : t('tools.bgRemove.agreeDownload', {
                      size: engineMode === 'pro' ? '176MB' : '40MB'
                    })
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
            {{ t('tools.bgRemove.empty.title') }}
          </p>
          <p class="text-[11px] font-medium text-muted-foreground/40">
            {{ t('tools.bgRemove.empty.desc') }}
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
          <AppSectionHeader :title="t('tools.bgRemove.engineTitle')" :icon="Sparkles" />
          <div class="flex items-center gap-1">
            <transition name="fade">
              <div
                v-if="isProcessing || currentStatus === 'loading'"
                class="flex items-center gap-1.5 px-2 py-0.5 bg-primary/10 rounded-full border border-primary/20"
              >
                <Loader2 :size="10" class="animate-spin text-primary" />
                <span class="text-[9px] font-bold text-primary uppercase tracking-wider">{{
                  t('common.processing')
                }}</span>
              </div>
              <button
                v-else-if="
                  (engineMode === 'match' && isMatchDirty) || (engineMode !== 'match' && isAiDirty)
                "
                @click="handleResetParams"
                class="p-1.5 hover:bg-muted rounded-lg transition-all text-muted-foreground hover:text-primary"
                :title="t('tools.bgRemove.resetParams')"
                :aria-label="t('tools.bgRemove.resetParams')"
              >
                <RotateCcw :size="14" />
              </button>
            </transition>
          </div>
        </div>
        <AppSegmentedControl
          v-model="engineMode"
          :options="engineOptions"
          :aria-label="t('tools.bgRemove.engineAria')"
        />
        <AppTip :icon="Info">
          <span v-if="engineMode === 'match'"
            >{{ t('tools.bgRemove.tipMatch1') }}
            <span class="text-primary font-bold uppercase">0MB</span>
            {{ t('tools.bgRemove.tipMatch2') }}</span
          >
          <span v-else-if="engineMode === 'smart'"
            >{{ t('tools.bgRemove.tipSmart1') }}
            <span class="text-primary font-bold uppercase">40MB</span>
            {{ t('tools.bgRemove.tipSmart2') }}</span
          >
          <span v-else
            >{{ t('tools.bgRemove.tipPro1') }}
            <span class="text-primary font-black uppercase">176MB</span>
            {{ t('tools.bgRemove.tipPro2') }}</span
          >
        </AppTip>
      </section>

      <!-- 引擎看板：指向性状态反馈 -->
      <section v-if="engineMode !== 'match'" class="space-y-3 pt-6 border-t border-border/40">
        <div class="flex items-center justify-between group">
          <div class="flex items-center gap-2">
            <Database :size="14" class="text-muted-foreground" />
            <span class="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">{{
              t('tools.bgRemove.engineDashboard')
            }}</span>
          </div>
          <button
            @click="handleResetEngine"
            class="text-[10px] text-muted-foreground/40 hover:text-destructive flex items-center gap-1 transition-colors"
            :title="t('tools.bgRemove.forceInit')"
          >
            <Trash2 :size="10" /> <span>{{ t('tools.bgRemove.deleteModel') }}</span>
          </button>
        </div>

        <div class="p-3 bg-muted/5 rounded-xl border border-border/40 space-y-2">
          <div class="flex items-center justify-between">
            <span class="text-[10px] text-muted-foreground/60 font-medium">{{
              t('tools.bgRemove.currentModel')
            }}</span>
            <span
              class="text-[10px] font-bold"
              :class="engineMode === 'pro' ? 'text-primary' : 'text-foreground'"
            >
              {{ engineMode === 'pro' ? 'ISNet (176MB Full)' : 'ISNet (40MB Quant)' }}
            </span>
          </div>
          <div class="flex items-center justify-between">
            <span class="text-[10px] text-muted-foreground/60 font-medium">{{
              t('tools.bgRemove.connectionStatus')
            }}</span>
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
                  currentStatus === 'ready'
                    ? t('tools.bgRemove.statusReady')
                    : t('tools.bgRemove.statusUpdate')
                }}
              </span>
            </div>
          </div>
        </div>
      </section>

      <!-- 第二分区：细分参数 -->
      <transition name="fade" mode="out-in">
        <section v-if="engineMode === 'match'" class="space-y-4 pt-6 border-t border-border/40">
          <AppSectionHeader :title="t('tools.bgRemove.matchAdjust')" :icon="Palette" />
          <div class="bg-muted/10 rounded-2xl p-4 border border-border/60 space-y-5">
            <div class="space-y-2">
              <div class="flex items-center gap-2 px-1 h-5">
                <div class="bg-primary/5 p-1 rounded-full flex items-center justify-center">
                  <Palette :size="13" :stroke-width="2.5" class="text-primary" />
                </div>
                <span
                  id="bg-color-label"
                  class="text-[11px] font-bold text-muted-foreground leading-none"
                  >{{ t('tools.bgRemove.bgColorToRemove') }}</span
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
              :label="t('tools.bgRemove.tolerance')"
              unit="%"
              :default-value="DEFAULT_MATCH_TOLERANCE"
              :description="t('tools.bgRemove.toleranceDesc')"
            />
            <AppSlider
              v-model="matchFeather"
              :min="0"
              :max="30"
              :label="t('tools.bgRemove.feather')"
              unit="%"
              :default-value="DEFAULT_MATCH_FEATHER"
              :description="t('tools.bgRemove.featherDesc')"
            />
          </div>
        </section>

        <section v-else class="space-y-4 pt-6 border-t border-border/40">
          <div class="flex items-center justify-between">
            <AppSectionHeader :title="t('tools.bgRemove.refinerTitle')" :icon="SlidersHorizontal" />
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
              :label="t('tools.bgRemove.strictness')"
              unit="%"
              :default-value="DEFAULT_AI_STRICTNESS"
              :description="t('tools.bgRemove.strictnessDesc')"
            />
            <AppSlider
              v-model="aiOffset"
              :min="0"
              :max="50"
              :label="t('tools.bgRemove.offset')"
              unit="%"
              :default-value="DEFAULT_AI_OFFSET"
              :description="t('tools.bgRemove.offsetDesc')"
            />
            <AppSlider
              v-model="aiSmoothness"
              :min="0"
              :max="10"
              :step="0.5"
              :label="t('tools.bgRemove.smoothness')"
              unit="px"
              :default-value="DEFAULT_AI_SMOOTHNESS"
              :description="t('tools.bgRemove.smoothnessDesc')"
            />
          </div>
        </section>
      </transition>

      <!-- 第三分区：处理选项 -->
      <section v-if="engineMode !== 'match'" class="space-y-4 pt-6 border-t border-border/40">
        <AppSectionHeader :title="t('tools.bgRemove.processOptions')" :icon="Zap" />
        <div class="bg-muted/10 rounded-2xl p-4 border border-border/60">
          <AppCheckbox
            v-model="useHighFidelity"
            :label="t('tools.bgRemove.disableScaling')"
            :description="t('tools.bgRemove.disableScalingDesc')"
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
    :title="t('tools.bgRemove.compareTitle')"
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
