<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ImageItem } from '../stores/imageStore'
import { useImageStore } from '../stores/imageStore'
import { useLayoutStore } from '../stores/layoutStore'
import { useFileHelpers, type ZipResultItem } from '../composables/useFileHelpers'
import WorkspaceLayout from '../components/layout/WorkspaceLayout.vue'
import AppButton from '../components/common/AppButton.vue'
import AppModal from '../components/common/AppModal.vue'
import ImageCard from '../components/common/ImageCard.vue'
import ImageCompare from '../components/common/ImageCompare.vue'
import ImageSelectionStatus from '../components/common/ImageSelectionStatus.vue'
import ImageActionsToolbar from '../components/common/ImageActionsToolbar.vue'
import AppExportSettings from '../components/common/AppExportSettings.vue'
import AppTip from '../components/common/AppTip.vue'
import { Play, Download, Loader2 } from 'lucide-vue-next'
import { dualEngine } from '../lib/engines/index'
import type { CompressionOptions } from '../lib/engines/compressEngine'
import { useImageProcessor } from '../composables/useImageProcessor'
import type { ProcessResult } from '../lib/engines/types'
import { DEFAULT_COMPRESS_LONG_EDGE, MAX_TARGET_SIZE_KB } from '../lib/limits'

import InspectorFooter from '../components/layout/InspectorFooter.vue'

const store = useImageStore()
const layoutStore = useLayoutStore()
const { formatSize, downloadImage, downloadAllAsZip } = useFileHelpers()
const { t } = useI18n()

// 本地结果存储
interface LocalResult {
  blob: Blob
  preview: string
  size: number
  isDirty: boolean
  /** 压缩结果未减小（保留原图），UI 显示「已跳过」而非虚假成功 */
  skipped?: boolean
}
const results = ref<Map<string, LocalResult>>(new Map())

const cleanupResults = () => {
  results.value.forEach((res) => {
    URL.revokeObjectURL(res.preview)
  })
  results.value.clear()
}

onUnmounted(() => {
  // 路由切换中止处理：DESIGN.md 2.2 要求全局清理挂起任务，避免后台继续跑 + 结果泄漏
  abortProcessing()
  cleanupResults()
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

// 状态
const compressionMode = ref<'quality' | 'target'>('quality')
const quality = ref(0.8)
const outputFormat = ref<string>('original')
const pngColors = ref(256)
const jxlEffort = ref(7)
const targetSizeKB = ref(500)
// 目标体积输入为空/非法时钳制到最小有效值
const sanitizeTargetSize = (val: unknown) => {
  const n = Number(val)
  if (!Number.isFinite(n) || n < 1) return 1
  return Math.min(MAX_TARGET_SIZE_KB, Math.round(n))
}
const handleTargetSize = (val: string | number | undefined) => {
  targetSizeKB.value = sanitizeTargetSize(val)
}
const keepOriginalIfLarger = ref(true)
const preserveExif = ref(false)
const maxWidth = ref<number | undefined>(undefined)
const maxHeight = ref<number | undefined>(undefined)

const showCompareModal = ref(false)
const comparingImage = ref<ImageItem | null>(null)

// 切到 PNG 后「目标体积」模式无意义（PNG 为无损），重置为 quality 模式，
// 修复 P1-4：目标模式下切 PNG 后参数残留、引擎静默按目标循环降分辨率
watch(outputFormat, (fmt) => {
  if (fmt === 'image/png' && compressionMode.value === 'target') {
    compressionMode.value = 'quality'
  }
})

const { isProcessing, processSelected, abortProcessing } = useImageProcessor(dualEngine)

// P2-15：GIF 会被引擎转为静态图（取首帧），选中 GIF 时提示
const hasGifSelected = computed(() =>
  store.images.some((img) => store.selectedIds.has(img.id) && img.file.type === 'image/gif')
)

// 未设分辨率上限时引擎默认按 4096px 长边约束，质量/目标模式均显示提示
const showDefaultLimitHint = computed(() => !maxWidth.value && !maxHeight.value)

const displayImages = computed(() => [...store.images].reverse())

const handleCompare = (id: string) => {
  const item = store.images.find((img) => img.id === id)
  const result = results.value.get(id)
  if (!item || !result) return
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
  const result = results.value.get(id)
  if (item && result) downloadImage(result.blob, item.file.name, 'compress')
}

const handleReset = (id: string) => {
  const result = results.value.get(id)
  if (result) {
    URL.revokeObjectURL(result.preview)
    results.value.delete(id)
  }
  store.updateImage(id, { status: 'idle', error: undefined, progress: 0 })
}

watch(
  [
    quality,
    outputFormat,
    compressionMode,
    targetSizeKB,
    pngColors,
    jxlEffort,
    maxWidth,
    maxHeight,
    keepOriginalIfLarger,
    preserveExif
  ],
  () => {
    results.value.forEach((res) => {
      res.isDirty = true
    })
  },
  { deep: true }
)

const ctaState = computed(() => {
  // P2-13：区分「无图片」与「有图片但未选中」——无图提示导入，未选中提示选择
  if (store.images.length === 0)
    return {
      text: t('tools.compress.cta.startCompress'),
      progress: '',
      icon: Play,
      action: 'none',
      disabled: true
    }

  if (store.selectedCount === 0)
    return {
      text: t('tools.compress.cta.selectImage'),
      progress: '',
      icon: Play,
      action: 'none',
      disabled: true
    }

  // P2-9：处理中 CTA 可点击中止（参考 SplitView：action:'abort'、禁用解除、Loader2 图标）
  if (isProcessing.value) {
    const total = store.selectedCount
    const processed = store.images.filter(
      (img) => store.selectedIds.has(img.id) && img.status === 'done'
    ).length
    return {
      text: t('tools.compress.cta.rendering'),
      progress: `(${processed}/${total})`,
      icon: Loader2,
      action: 'abort',
      disabled: false
    }
  }

  const selectedImages = store.images.filter((img) => store.selectedIds.has(img.id))
  const allDoneAndClean =
    selectedImages.length > 0 &&
    selectedImages.every((img) => {
      const res = results.value.get(img.id)
      return img.status === 'done' && res && !res.isDirty
    })

  if (allDoneAndClean) {
    return {
      text: t('tools.compress.cta.exportResults'),
      progress: `(${store.selectedCount})`,
      icon: Download,
      action: 'download',
      disabled: false
    }
  }

  const anyDirty = selectedImages.some((img) => {
    const res = results.value.get(img.id)
    return img.status === 'done' && res?.isDirty
  })
  return {
    text: anyDirty ? t('tools.compress.cta.updateCompress') : t('tools.compress.cta.startCompress'),
    progress: `(${store.selectedCount})`,
    icon: Play,
    action: 'process',
    disabled: false
  }
})

const handleCtaClick = async () => {
  const state = ctaState.value
  if (state.action === 'none') return

  if (state.action === 'abort') {
    abortProcessing()
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

    await downloadAllAsZip('compress', zipResults)
    return
  }

  if (state.action === 'process') {
    await processSelected(
      {
        quality: quality.value,
        format: (outputFormat.value === 'original'
          ? undefined
          : outputFormat.value) as CompressionOptions['format'],
        mode: compressionMode.value,
        maxSizeMB:
          compressionMode.value === 'target' && Number(targetSizeKB.value) > 0
            ? Number(targetSizeKB.value) / 1024
            : undefined,
        colors: outputFormat.value === 'image/png' ? pngColors.value : undefined,
        effort: outputFormat.value === 'image/jxl' ? jxlEffort.value : undefined,
        keepOriginalIfLarger: keepOriginalIfLarger.value,
        preserveExif: preserveExif.value,
        maxWidth: maxWidth.value,
        maxHeight: maxHeight.value
      },
      (id: string, result: ProcessResult | Blob | Blob[]) => {
        const typedResult = result as ProcessResult
        const blob = typedResult.blob || (result as Blob)
        const oldRes = results.value.get(id)

        if (oldRes) URL.revokeObjectURL(oldRes.preview)

        results.value.set(id, {
          blob,
          preview: URL.createObjectURL(blob),
          size: typedResult.size || blob.size,
          isDirty: false,
          skipped: typedResult.skipped
        })
      }
    )
  }
}
</script>

<template>
  <div class="h-full w-full flex flex-col overflow-hidden">
    <WorkspaceLayout show-sidebar no-scroll show-assets-tray>
      <template #header-left><ImageSelectionStatus /></template>
      <template #header-actions
        ><ImageActionsToolbar
          view-id="compress"
          :is-processing="isProcessing"
          :show-download-all="false"
          show-clear-all
          @reset-all="cleanupResults"
      /></template>

      <template #content>
        <div class="h-full w-full overflow-y-auto custom-scrollbar p-4 md:p-5 pt-2 md:pt-3">
          <div
            class="grid transition-colors"
            :class="[
              layoutStore.cardSizeMode === 'compact'
                ? 'grid-cols-[repeat(auto-fill,minmax(130px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3 md:gap-4'
                : 'grid-cols-[repeat(auto-fill,minmax(160px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3 md:gap-5'
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
              @toggle="store.toggleSelection"
              @remove="store.removeImage"
              @download="handleDownload"
              @compare="handleCompare"
              @reset="handleReset"
            />
          </div>
        </div>
      </template>

      <template #sidebar>
        <AppExportSettings
          v-model:format="outputFormat"
          v-model:quality="quality"
          v-model:mode="compressionMode"
          v-model:target-size-k-b="targetSizeKB"
          @update:target-size-k-b="handleTargetSize"
          v-model:colors="pngColors"
          v-model:effort="jxlEffort"
          v-model:max-width="maxWidth"
          v-model:max-height="maxHeight"
          v-model:keep-original-if-larger="keepOriginalIfLarger"
          v-model:show-magnifier="store.showMagnifier"
          v-model:preserve-exif="preserveExif"
          allow-manual-quality
          :title="t('tools.compress.settingsTitle')"
        />

        <section class="pt-2 space-y-2">
          <AppTip v-if="hasGifSelected" status>{{ t('tools.compress.gifHint') }}</AppTip>
          <AppTip>{{ t('tools.compress.infoTip') }}</AppTip>
          <p
            v-if="showDefaultLimitHint"
            class="text-[11px] text-muted-foreground/70 mt-2 px-1 leading-relaxed tabular-nums"
          >
            {{ t('tools.compress.maxDimensionHint', { limit: DEFAULT_COMPRESS_LONG_EDGE }) }}
          </p>
        </section>
      </template>

      <template #footer>
        <InspectorFooter>
          <AppButton
            size="lg"
            fill
            :variant="ctaState.action === 'download' ? 'success' : 'cta'"
            class="w-full rounded-[var(--radius-ctrl)] transition-colors"
            :disabled="ctaState.disabled"
            :hint="ctaState.action === 'abort' ? t('tools.compress.cta.clickToAbort') : undefined"
            @click="handleCtaClick"
          >
            <template #icon>
              <Loader2 v-if="isProcessing" :size="18" class="animate-spin mr-2" />
              <component :is="ctaState.icon" v-else :size="18" class="mr-2" />
            </template>
            {{ ctaState.text
            }}<span v-if="ctaState.progress" class="tabular-nums opacity-70">{{
              ctaState.progress
            }}</span>
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
        @close="closeCompare"
      />
    </AppModal>
  </div>
</template>
