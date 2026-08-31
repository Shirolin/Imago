<script setup lang="ts">
import { computed, ref, watch, onMounted, onUnmounted } from 'vue'
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
  Eraser,
  Download,
  ImageMinus,
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
import { useFileHelpers, type ZipResultItem } from '../composables/useFileHelpers'
import AppSlider from '../components/common/AppSlider.vue'
import AppCheckbox from '../components/common/AppCheckbox.vue'
import AppModal from '../components/common/AppModal.vue'
import AppColorPicker from '../components/common/AppColorPicker.vue'
import AppTip from '../components/common/AppTip.vue'
import ImageCompare from '../components/common/ImageCompare.vue'
import type { ProcessResult } from '../lib/engines/types'

const store = useImageStore()
const layoutStore = useLayoutStore()
const { downloadImage, downloadAllAsZip, formatSize } = useFileHelpers()
const { t } = useI18n()

// 本地结果存储
interface LocalResult {
  blob: Blob
  preview: string
  size: number
  isDirty: boolean
}
const results = ref<Map<string, LocalResult>>(new Map())

const cleanupResults = () => {
  results.value.forEach((res) => {
    URL.revokeObjectURL(res.preview)
  })
  results.value.clear()
}

onUnmounted(() => {
  cleanupResults()
})

// P2-20：跨视图状态残留 —— 卸载时本地 results 已清空但 store.status 仍为 done。
// 挂载时把「无本地结果却标记 done」的图片复位为 idle，避免误显示已处理/可导出；
// 不影响其他视图：其他视图的本地结果同样随其卸载清空，回来后本就按未处理展示。
onMounted(() => {
  store.images.forEach((img) => {
    if (img.status === 'done' && !results.value.has(img.id)) {
      store.updateImage(img.id, { status: 'idle', progress: 0 })
    }
  })
})

// 监听图片列表变化，自动清理已删除图片的本地结果
watch(
  () => store.images,
  (newImages) => {
    const currentIds = new Set(newImages.map((img) => img.id))
    results.value.forEach((res, id) => {
      if (!currentIds.has(id)) {
        URL.revokeObjectURL(res.preview)
        results.value.delete(id)
      }
    })
  },
  { deep: true }
)

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
const DEFAULT_MATCH_COLOR = '#ffffff'
const DEFAULT_AI_STRICTNESS = 0
const DEFAULT_AI_OFFSET = 0
const DEFAULT_AI_SMOOTHNESS = 0

// --- 响应式状态 ---
const matchTolerance = ref(DEFAULT_MATCH_TOLERANCE)
const matchFeather = ref(DEFAULT_MATCH_FEATHER)
const matchColor = ref('#ffffff')

// P2-14：模型体积常量（0MB 匹配 / 40MB 智能 / 176MB 专业），集中管理避免散落硬编码
const MODEL_SIZE = { match: '0MB', smart: '40MB', pro: '176MB' } as const
const modelSize = computed(() => MODEL_SIZE[engineMode.value])

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
    Math.abs(matchFeather.value - DEFAULT_MATCH_FEATHER) > 0.001 ||
    // P2-13：取色目标（matchColor）纳入脏检测
    matchColor.value.toLowerCase() !== DEFAULT_MATCH_COLOR.toLowerCase()
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
  // P2-19：遮罩 objectURL 用完即 revoke，避免泄漏
  const maskUrl = URL.createObjectURL(maskBlob)
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
      img.onerror = () => {
        URL.revokeObjectURL(maskUrl)
        reject(new Error('遮罩图片加载失败'))
      }
      img.src = maskUrl
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
  URL.revokeObjectURL(maskUrl) // P2-19：遮罩像素已读入 maskCanvas，URL 立即释放
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

  // 5. 更新本地结果
  const oldRes = results.value.get(id)
  if (oldRes) URL.revokeObjectURL(oldRes.preview)

  const preview = URL.createObjectURL(resultBlob)
  results.value.set(id, {
    blob: resultBlob,
    preview,
    size: resultBlob.size,
    isDirty: false
  })

  store.updateImage(id, {
    status: 'done',
    progress: 1
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
  const result = results.value.get(id)
  if (!item || !result) return
  comparingImage.value = item
  showCompareModal.value = true
}
const closeCompare = () => (showCompareModal.value = false)
const handleModalLeave = () => (comparingImage.value = null)
const handleDownload = (id: string) => {
  const item = store.images.find((img) => img.id === id)
  const result = results.value.get(id)
  if (item && result) downloadImage(result.blob, item.file.name, 'bg-remove')
}

const handleReset = (id: string) => {
  const result = results.value.get(id)
  if (result) {
    URL.revokeObjectURL(result.preview)
    results.value.delete(id)
  }
  store.updateImage(id, { status: 'idle', error: undefined, progress: 0 })
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
  () => {
    results.value.forEach((res) => {
      res.isDirty = true
    })
  }
)

const handleInitialize = async () => {
  if (currentStatus.value === 'loading') return
  initProgress.value = 0
  initError.value = ''

  const targetModel = (engineMode.value === 'pro' ? 'isnet' : 'isnet_quint8') as
    'isnet' | 'isnet_quint8'
  const statusRef = engineMode.value === 'pro' ? proStatus : smartStatus
  const storageKey =
    engineMode.value === 'pro' ? 'imago-bg-v2-pro-ready' : 'imago-bg-v2-smart-ready'

  statusRef.value = 'loading'
  try {
    await preload({
      model: targetModel,
      progress: (key, current, total) => {
        // P2-21：total 可能为 0，防除零
        if (key.includes('fetch'))
          initProgress.value = Math.round((current / Math.max(1, total)) * 100)
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
    return {
      text:
        status === 'error'
          ? t('tools.bgRemove.retryInit')
          : t('tools.bgRemove.activateModel', {
              model:
                engineMode.value === 'pro' ? t('tools.bgRemove.pro') : t('tools.bgRemove.smart'),
              size: MODEL_SIZE[engineMode.value]
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
    // 队列聚合进度为 0-100、单任务进度为 0-1，统一归一化为整数百分比
    const pct = Math.round(p <= 1 ? p * 100 : p)
    return {
      text: t('tools.bgRemove.cta.processing', { progress: pct }),
      icon: Eraser,
      action: 'abort',
      disabled: false,
      variant: 'cta' as const
    }
  }
  const selectedImages = store.images.filter((img) => store.selectedIds.has(img.id))
  const allDone =
    selectedImages.length > 0 &&
    selectedImages.every((img) => {
      const res = results.value.get(img.id)
      return img.status === 'done' && res && !res.isDirty
    })

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
    icon: Eraser,
    action: 'process',
    disabled: false,
    variant: 'cta' as const
  }
})

const handleCtaClick = async () => {
  const state = ctaState.value
  if (state.action === 'none') return
  if (state.action === 'abort') {
    // 长任务可中止：两个处理器各持队列级 AbortController，未激活的一侧自动空转
    matchProcessor.abortProcessing()
    proProcessor.abortProcessing()
    return
  }
  if (state.action === 'show_init') {
    showInitModal.value = true
    return
  }
  if (state.action === 'download') {
    const zipResults = store.images
      .filter((img) => store.selectedIds.has(img.id))
      .map((img) => {
        const res = results.value.get(img.id)
        return {
          file: img.file,
          processedBlob: res?.blob,
          status: img.status
        }
      })
      .filter((r) => r.status === 'done' && r.processedBlob) as ZipResultItem[]

    await downloadAllAsZip('bg-remove', zipResults)
    return
  }

  if (state.action === 'process') {
    const commonOptions = {
      format: outputFormat.value,
      quality: outputQuality.value,
      usePreScaling: !useHighFidelity.value
    }

    const onResult = (id: string, result: ProcessResult | Blob | Blob[]) => {
      const typedResult = result as ProcessResult
      const blob = typedResult.blob || (result as Blob)
      const oldRes = results.value.get(id)
      if (oldRes) URL.revokeObjectURL(oldRes.preview)

      results.value.set(id, {
        blob,
        preview: URL.createObjectURL(blob),
        size: typedResult.size || blob.size,
        isDirty: false
      })
    }

    if (engineMode.value === 'match') {
      await matchProcessor.processSelected(
        {
          ...commonOptions,
          targetColor: hexToRgb(matchColor.value),
          tolerance: matchTolerance.value / 100,
          feather: matchFeather.value / 100
        },
        onResult
      )
    } else {
      await proProcessor.processSelected(
        {
          ...commonOptions,
          model: engineMode.value === 'pro' ? 'isnet' : 'isnet_quint8',
          maskThreshold: aiStrictness.value / 100,
          maskShrink: aiOffset.value / 100,
          maskBlur: aiSmoothness.value
        },
        onResult
      )
    }
  }
}

const handleResetEngine = async () => {
  // 1. 物理删除：清理浏览器 Cache Storage 中的大文件资产。
  //    P2-12：不再依赖 'imgly' 前缀匹配（@imgly 版本升级可能换缓存名），
  //    直接枚举并删除本域全部 Cache 键；本应用无 Service Worker，无其他缓存需要保留。
  //    IndexedDB：代码库无 indexedDB 使用（grep 确认），模型资产仅存 CacheStorage，无需处理。
  try {
    const cacheKeys = await caches.keys()
    for (const key of cacheKeys) {
      await caches.delete(key)
      console.log(`[Imago] 🗑️ Erased Cache Storage: ${key}`)
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
        view-id="bg-remove"
        :is-processing="isProcessing"
        show-clear-all
        @reset-all="cleanupResults"
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
          <div class="p-6 text-center">
            <div
              class="w-14 h-14 rounded-[var(--radius-ctrl)] flex items-center justify-center mx-auto mb-4"
            >
              <Zap v-if="currentStatus !== 'loading'" :size="28" class="text-primary" />
              <Loader2 v-else :size="28" class="text-primary animate-spin" />
            </div>
            <p class="text-sm text-muted-foreground font-medium leading-relaxed mb-6">
              <template v-if="engineMode === 'pro'"
                >{{ t('tools.bgRemove.initDescPro1') }}
                <span class="text-primary font-medium">{{ modelSize }}</span>
                {{ t('tools.bgRemove.initDescPro2') }}</template
              >
              <template v-else
                >{{ t('tools.bgRemove.initDescSmart1') }}
                <span class="text-primary font-medium">{{ modelSize }}</span>
                {{ t('tools.bgRemove.initDescSmart2') }}</template
              >
            </p>
            <div
              v-if="currentStatus === 'loading'"
              class="mb-6 space-y-3 text-left"
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
              <div class="flex justify-between text-[11px] font-medium text-muted-foreground/60">
                <span>{{ t('tools.bgRemove.downloading') }}</span
                ><span aria-hidden="true">{{ initProgress }}%</span>
              </div>
            </div>
            <div
              v-if="currentStatus === 'error'"
              class="mb-6 p-3 bg-destructive/5 border border-destructive/20 rounded-[var(--radius-ctrl)] flex items-start gap-3 text-left"
              role="alert"
            >
              <AlertCircle :size="18" class="text-destructive shrink-0 mt-0.5" />
              <div class="text-xs font-medium text-destructive leading-normal">{{ initError }}</div>
            </div>
            <AppButton
              size="lg"
              fill
              variant="cta"
              class="w-full rounded-[var(--radius-ctrl)] text-sm"
              :loading="currentStatus === 'loading'"
              @click="handleInitialize"
            >
              {{
                currentStatus === 'error'
                  ? t('tools.bgRemove.retryDownload')
                  : t('tools.bgRemove.agreeDownload', { size: modelSize })
              }}
            </AppButton>
          </div>
        </AppModal>

        <div
          v-if="store.images.length === 0"
          class="flex flex-col items-center justify-center py-16 md:py-20 animate-in fade-in duration-300"
        >
          <div class="mb-4">
            <ImageMinus :size="32" class="text-muted-foreground/40" />
          </div>
          <p class="text-[11px] font-medium text-muted-foreground/60 mb-2">
            {{ t('tools.bgRemove.empty.title') }}
          </p>
          <p class="text-[11px] font-medium text-muted-foreground/40 max-w-[280px]">
            {{ t('tools.bgRemove.empty.desc') }}
          </p>
        </div>
        <div
          v-else
          class="grid transition-all duration-300"
          :class="[
            layoutStore.cardSizeMode === 'compact'
              ? 'grid-cols-[repeat(auto-fill,minmax(130px,1fr))] lg:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3 lg:gap-8'
              : 'grid-cols-[repeat(auto-fill,minmax(160px,1fr))] lg:grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3 lg:gap-5'
          ]"
        >
          <ImageCard
            v-for="img in displayImages"
            :key="img.id"
            :image="img"
            :is-selected="store.selectedIds.has(img.id)"
            :processed-preview="results.get(img.id)?.preview"
            :processed-blob="results.get(img.id)?.blob"
            :is-dirty="results.get(img.id)?.isDirty"
            show-transparency
            show-interactive
            @toggle="handleCardClick"
            @remove="store.removeImage"
            @compare="handleCompare"
            @download="handleDownload"
            @interactive="handleInteractiveClick"
            @reset="handleReset"
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
          <AppSectionHeader :title="t('tools.bgRemove.engineTitle')" :icon="Eraser" />
          <div class="flex items-center gap-1">
            <transition name="fade">
              <div
                v-if="isProcessing || currentStatus === 'loading'"
                class="flex items-center gap-1.5 px-2 py-0.5 bg-primary/10 rounded-[var(--radius-ctrl)] border border-primary/20"
              >
                <Loader2 :size="10" class="animate-spin text-primary" />
                <span class="text-[11px] font-medium text-primary">{{
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
        <fieldset
          :disabled="isProcessing"
          :class="{ 'opacity-60': isProcessing }"
          class="border-0 p-0 m-0 min-w-0"
        >
          <AppSegmentedControl
            v-model="engineMode"
            :options="engineOptions"
            :aria-label="t('tools.bgRemove.engineAria')"
          />
        </fieldset>
        <AppTip>
          <span v-if="engineMode === 'match'"
            >{{ t('tools.bgRemove.tipMatch1') }}
            <span class="text-primary font-medium">{{ modelSize }}</span>
            {{ t('tools.bgRemove.tipMatch2') }}</span
          >
          <span v-else-if="engineMode === 'smart'"
            >{{ t('tools.bgRemove.tipSmart1') }}
            <span class="text-primary font-medium">{{ modelSize }}</span>
            {{ t('tools.bgRemove.tipSmart2') }}</span
          >
          <span v-else
            >{{ t('tools.bgRemove.tipPro1') }}
            <span class="text-primary font-medium">{{ modelSize }}</span>
            {{ t('tools.bgRemove.tipPro2') }}</span
          >
        </AppTip>
      </section>

      <!-- 引擎看板：指向性状态反馈 -->
      <section
        v-if="engineMode !== 'match'"
        class="space-y-3 pt-6 border-t border-[var(--hairline)]"
      >
        <AppSectionHeader :title="t('tools.bgRemove.engineDashboard')" :icon="Database">
          <template #actions>
            <button
              type="button"
              @click="handleResetEngine"
              class="p-1 rounded-md text-muted-foreground/50 hover:text-destructive transition-colors"
              :title="t('tools.bgRemove.forceInit')"
              :aria-label="t('tools.bgRemove.deleteModel')"
            >
              <Trash2 :size="14" />
            </button>
          </template>
        </AppSectionHeader>

        <div class="p-3 bg-muted/5 rounded-xl border border-[var(--hairline)] space-y-3">
          <div class="space-y-0.5 min-w-0">
            <span class="text-[10px] text-muted-foreground/60 font-medium">{{
              t('tools.bgRemove.currentModel')
            }}</span>
            <span
              class="text-[10px] font-medium block truncate"
              :class="engineMode === 'pro' ? 'text-primary' : 'text-foreground'"
              :title="
                engineMode === 'pro'
                  ? t('tools.bgRemove.modelFull')
                  : t('tools.bgRemove.modelQuant')
              "
            >
              {{
                engineMode === 'pro'
                  ? t('tools.bgRemove.modelFull')
                  : t('tools.bgRemove.modelQuant')
              }}
            </span>
          </div>
          <div class="space-y-0.5 min-w-0">
            <span class="text-[10px] text-muted-foreground/60 font-medium">{{
              t('tools.bgRemove.connectionStatus')
            }}</span>
            <div class="flex items-center gap-1.5 min-w-0">
              <span
                class="h-1.5 w-1.5 rounded-full shrink-0"
                :class="currentStatus === 'ready' ? 'bg-success' : 'bg-warning animate-pulse'"
              ></span>
              <span
                class="text-[10px] font-medium truncate"
                :class="currentStatus === 'ready' ? 'text-success' : 'text-warning'"
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
        <section
          v-if="engineMode === 'match'"
          class="space-y-4 pt-6 border-t border-[var(--hairline)]"
        >
          <AppSectionHeader :title="t('tools.bgRemove.matchAdjust')" :icon="Palette" />
          <div class="space-y-5">
            <div class="space-y-2">
              <div class="flex items-center gap-2 px-1 h-5">
                <div class="p-1 rounded-[var(--radius-ctrl)] flex items-center justify-center">
                  <Palette :size="13" :stroke-width="2.5" class="text-primary" />
                </div>
                <span
                  id="bg-color-label"
                  class="text-[11px] font-medium text-muted-foreground leading-none"
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

        <section v-else class="space-y-4 pt-6 border-t border-[var(--hairline)]">
          <AppSectionHeader :title="t('tools.bgRemove.refinerTitle')" :icon="SlidersHorizontal">
            <template #actions>
              <div
                class="flex items-center gap-1 px-1.5 py-0.5 bg-primary/10 rounded-md border border-primary/20"
              >
                <CheckCircle2 :size="10" class="text-primary shrink-0" />
                <span class="text-[11px] font-medium text-primary whitespace-nowrap">{{
                  engineMode === 'pro'
                    ? t('tools.bgRemove.corePremium')
                    : t('tools.bgRemove.coreLite')
                }}</span>
              </div>
            </template>
          </AppSectionHeader>
          <div class="space-y-4">
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
      <section
        v-if="engineMode !== 'match'"
        class="space-y-4 pt-6 border-t border-[var(--hairline)]"
      >
        <AppSectionHeader :title="t('tools.bgRemove.processOptions')" :icon="Zap" />
        <AppCheckbox
          v-model="useHighFidelity"
          :label="t('tools.bgRemove.disableScaling')"
          :description="t('tools.bgRemove.disableScalingDesc')"
        />
      </section>

      <!-- 第四分区：导出设置 -->
      <section class="pt-6 border-t border-[var(--hairline)]">
        <AppExportSettings
          v-model:format="outputFormat"
          v-model:quality="outputQuality"
          canvas-only
        />
      </section>
    </template>

    <template #footer>
      <InspectorFooter>
        <AppButton
          size="lg"
          fill
          :variant="ctaState.variant"
          class="w-full rounded-xl transition-colors"
          :loading="currentStatus === 'loading'"
          :disabled="ctaState.disabled"
          :hint="ctaState.action === 'abort' ? t('tools.split.cta.clickToAbort') : undefined"
          @click="handleCtaClick"
        >
          <template #icon>
            <Loader2 v-if="isProcessing" :size="18" class="animate-spin mr-2" />
            <component
              v-else-if="currentStatus !== 'loading'"
              :is="ctaState.icon"
              :size="18"
              class="mr-2"
            />
          </template>
          {{ ctaState.text }}
        </AppButton>
      </InspectorFooter>
    </template>
  </WorkspaceLayout>

  <AppModal
    :show="showCompareModal"
    pane-only
    hide-header
    @close="closeCompare"
    @after-leave="handleModalLeave"
  >
    <ImageCompare
      v-if="comparingImage && results.has(comparingImage.id)"
      :original-url="comparingImage.file"
      :processed-url="results.get(comparingImage.id)!.blob"
      :original-size="formatSize(comparingImage.originalSize)"
      :processed-size="formatSize(results.get(comparingImage.id)!.size)"
      show-transparency
      @close="closeCompare"
    />
  </AppModal>
</template>
