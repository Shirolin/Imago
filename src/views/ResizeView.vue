<script setup lang="ts">
import { ref, watch, computed, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ImageItem } from '../stores/imageStore'
import { useImageStore } from '../stores/imageStore'
import { useLayoutStore } from '../stores/layoutStore'
import { useFileHelpers, type ZipResultItem } from '../composables/useFileHelpers'
import WorkspaceLayout from '../components/layout/WorkspaceLayout.vue'
import AppButton from '../components/common/AppButton.vue'
import AppInput from '../components/common/AppInput.vue'
import AppCheckbox from '../components/common/AppCheckbox.vue'
import AppSlider from '../components/common/AppSlider.vue'
import AppSegmentedControl from '../components/common/AppSegmentedControl.vue'
import AppSectionHeader from '../components/common/AppSectionHeader.vue'
import AppComparisonBadge from '../components/common/AppComparisonBadge.vue'
import AppSidebarCard from '../components/common/AppSidebarCard.vue'
import AppEmptyState from '../components/common/AppEmptyState.vue'
import AppModal from '../components/common/AppModal.vue'
import ImageCard from '../components/common/ImageCard.vue'
import ImageCompare from '../components/common/ImageCompare.vue'
import ImageSelectionStatus from '../components/common/ImageSelectionStatus.vue'
import ImageActionsToolbar from '../components/common/ImageActionsToolbar.vue'
import AppExportSettings from '../components/common/AppExportSettings.vue'
import {
  Settings2,
  Percent,
  RotateCcw,
  RefreshCw,
  Download,
  FileSearch,
  AlertCircle
} from 'lucide-vue-next'
import { resizeEngine } from '../lib/engines/resizeEngine'
import { useImageProcessor } from '../composables/useImageProcessor'
import type { ProcessResult } from '../lib/engines/types'

import InspectorFooter from '../components/layout/InspectorFooter.vue'

const store = useImageStore()
const layoutStore = useLayoutStore()
const { downloadImage, downloadAllAsZip } = useFileHelpers()
const { t } = useI18n()

// 本地结果存储
interface LocalResult {
  blob: Blob
  preview: string
  size: number
  width?: number
  height?: number
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
const resizeMode = ref<'percentage' | 'dimensions'>('percentage')
const width = ref(1920)
const height = ref(1080)
const percentage = ref(100)
const maintainAspectRatio = ref(true)
const outputFormat = ref<string>('original')
const outputQuality = ref(0.9)
const preserveExif = ref(false)

// 比例联动逻辑
const isUpdatingFromRatio = ref(false)
const currentRatio = computed(() => {
  const img = store.activeImage
  if (img && img.width && img.height) {
    return img.width / img.height
  }
  return 1920 / 1080
})

// 初始化尺寸
watch(resizeMode, (newMode) => {
  if (newMode === 'dimensions' && store.activeImage) {
    width.value = store.activeImage.width || 1920
    height.value = store.activeImage.height || 1080
  }
})

// 宽度联动高度
watch(width, (newWidth) => {
  if (
    resizeMode.value === 'dimensions' &&
    maintainAspectRatio.value &&
    !isUpdatingFromRatio.value
  ) {
    isUpdatingFromRatio.value = true
    height.value = Math.round(newWidth / currentRatio.value)
    setTimeout(() => {
      isUpdatingFromRatio.value = false
    }, 0)
  }
})

// 高度联动宽度
watch(height, (newHeight) => {
  if (
    resizeMode.value === 'dimensions' &&
    maintainAspectRatio.value &&
    !isUpdatingFromRatio.value
  ) {
    isUpdatingFromRatio.value = true
    width.value = Math.round(newHeight * currentRatio.value)
    setTimeout(() => {
      isUpdatingFromRatio.value = false
    }, 0)
  }
})

const { isProcessing, processSelected } = useImageProcessor(resizeEngine)

// 确认框状态
const showResetConfirm = ref(false)

const resetDimensions = () => {
  showResetConfirm.value = true
}

const confirmResetDimensions = () => {
  if (store.activeImage) {
    width.value = store.activeImage.width || 1920
    height.value = store.activeImage.height || 1080
  } else {
    width.value = 1920
    height.value = 1080
  }
  percentage.value = 100
  showResetConfirm.value = false
}

const displayImages = computed(() => [...store.images].reverse())

const modeOptions = computed(() => [
  { label: t('tools.resize.byPercentage'), value: 'percentage', icon: Percent },
  { label: t('tools.resize.byDimensions'), value: 'dimensions', icon: RefreshCw }
])

const showCompareModal = ref(false)
const comparingImage = ref<ImageItem | null>(null)

const handleCompare = async (id: string) => {
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
  if (item && result) downloadImage(result.blob, item.file.name, 'resize')
}

const handleReset = (id: string) => {
  const result = results.value.get(id)
  if (result) {
    URL.revokeObjectURL(result.preview)
    results.value.delete(id)
  }
  store.updateImage(id, { status: 'idle', error: undefined, progress: 0 })
}

let debounceTimeout: ReturnType<typeof setTimeout>
watch(
  [
    resizeMode,
    width,
    height,
    percentage,
    maintainAspectRatio,
    outputFormat,
    outputQuality,
    preserveExif
  ],
  () => {
    clearTimeout(debounceTimeout)
    debounceTimeout = setTimeout(() => {
      results.value.forEach((res) => {
        res.isDirty = true
      })
    }, 150)
  },
  { deep: true }
)

const ctaState = computed(() => {
  if (store.selectedCount === 0)
    return { text: t('tools.resize.cta.select'), icon: RefreshCw, action: 'none', disabled: true }
  if (isProcessing.value)
    return {
      text: t('tools.resize.cta.rendering'),
      icon: RefreshCw,
      action: 'none',
      disabled: true
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
      text: t('tools.resize.cta.exportResults', { count: store.selectedCount }),
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
    text: anyDirty
      ? t('tools.resize.cta.updateDimensions', { count: store.selectedCount })
      : t('tools.resize.cta.adjustDimensions', { count: store.selectedCount }),
    icon: RefreshCw,
    action: 'process',
    disabled: false
  }
})

const handleCtaClick = async () => {
  const state = ctaState.value
  if (state.action === 'none') return

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

    await downloadAllAsZip('resize', zipResults)
    return
  }

  if (state.action === 'process') {
    await processSelected(
      {
        mode: resizeMode.value === 'dimensions' ? 'pixels' : 'percentage',
        width: width.value,
        height: height.value,
        percentage: percentage.value,
        maintainAspectRatio: maintainAspectRatio.value,
        format: outputFormat.value === 'original' ? undefined : outputFormat.value,
        quality: outputQuality.value,
        preserveExif: preserveExif.value
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
          width: typedResult.width,
          height: typedResult.height,
          isDirty: false
        })
      }
    )
  }
}
</script>

<template>
  <div class="h-full w-full flex flex-col overflow-hidden">
    <WorkspaceLayout show-sidebar no-scroll show-assets-tray>
      <template #header-left><ImageSelectionStatus :show-card-size="false" /></template>
      <template #header-actions
        ><ImageActionsToolbar
          view-id="resize"
          :is-processing="isProcessing"
          show-clear-all
          @reset-all="cleanupResults"
      /></template>

      <template #content>
        <div class="h-full w-full overflow-y-auto custom-scrollbar p-4 md:p-6">
          <AppEmptyState
            v-if="store.images.length === 0"
            :title="t('tools.resize.status.noImages')"
            :description="t('tools.resize.status.importTip')"
            :icon="FileSearch"
          />
          <div
            v-else
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
              :processed-preview="results.get(img.id)?.preview"
              :processed-blob="results.get(img.id)?.blob"
              :is-dirty="results.get(img.id)?.isDirty"
              @toggle="store.toggleSelection"
              @remove="store.removeImage"
              @download="handleDownload"
              @compare="handleCompare"
              @reset="handleReset"
            >
              <template #meta="{ image }">
                <AppComparisonBadge
                  :before-label="t('tools.resize.status.original')"
                  :before-value="`${image.width}x${image.height}`"
                  :after-label="t('tools.resize.status.target')"
                  :after-value="
                    results.has(image.id)
                      ? `${results.get(image.id)!.width}x${results.get(image.id)!.height}`
                      : '--'
                  "
                  :status="image.status === 'processing' ? 'pending' : (image.status as any)"
                  :compact="layoutStore.cardSizeMode === 'compact'"
                />
              </template>
            </ImageCard>
          </div>
        </div>
      </template>

      <template #sidebar>
        <section class="space-y-4">
          <AppSectionHeader :title="t('tools.resize.resizeMode')" :icon="Settings2" />
          <AppSegmentedControl v-model="resizeMode" :options="modeOptions" />

          <AppSidebarCard>
            <div v-if="resizeMode === 'percentage'" class="space-y-3">
              <AppSlider
                v-model="percentage"
                :label="t('tools.resize.scaleRatio')"
                :icon="Percent"
                unit="%"
                :min="1"
                :max="200"
                :step="1"
                :default-value="100"
              />
            </div>
            <div v-else class="space-y-5">
              <div class="grid grid-cols-2 gap-3">
                <AppInput
                  v-model.number="width"
                  type="number"
                  :placeholder="t('tools.resize.width')"
                  :suffix="t('tools.resize.widthUnit')"
                  :aria-label="t('tools.resize.width')"
                />
                <AppInput
                  v-model.number="height"
                  type="number"
                  :placeholder="t('tools.resize.height')"
                  :suffix="t('tools.resize.heightUnit')"
                  :aria-label="t('tools.resize.height')"
                />
              </div>
              <div class="flex items-center justify-between px-1">
                <AppCheckbox
                  v-model="maintainAspectRatio"
                  :label="t('tools.resize.lockAspectRatio')"
                />
                <button
                  @click="resetDimensions"
                  :aria-label="t('tools.resize.resetDimensions')"
                  :title="t('tools.resize.resetDimensions')"
                  class="p-1.5 hover:bg-muted rounded-lg transition-colors text-muted-foreground"
                >
                  <RotateCcw :size="14" />
                </button>
              </div>
            </div>
          </AppSidebarCard>
        </section>

        <section class="pt-6 border-t border-border/40">
          <AppExportSettings
            v-model:format="outputFormat"
            v-model:quality="outputQuality"
            v-model:preserve-exif="preserveExif"
            show-exif-option
          />
        </section>
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

    <AppModal
      :show="showCompareModal"
      pane-only
      hide-header
      @close="closeCompare"
      @after-leave="handleModalLeave"
    >
      <ImageCompare
        v-if="comparingImage && results.has(comparingImage.id)"
        :original-url="comparingImage.preview"
        :processed-url="results.get(comparingImage.id)!.blob"
        :original-size="`${comparingImage.width}x${comparingImage.height}`"
        :processed-size="`${results.get(comparingImage.id)!.width || '--'}x${results.get(comparingImage.id)!.height || '--'}`"
        @close="closeCompare"
      />
    </AppModal>

    <!-- 重置确认对话框 -->
    <AppModal
      :show="showResetConfirm"
      @close="showResetConfirm = false"
      :title="t('common.image.toolbar.confirmTitle')"
      variant="dialog"
    >
      <div class="p-6">
        <div class="flex items-start gap-4 mb-6">
          <div class="p-3 bg-destructive/10 rounded-2xl text-destructive shrink-0">
            <AlertCircle :size="24" />
          </div>
          <div>
            <h3 class="text-lg font-black text-foreground mb-1 tracking-tight">
              {{ t('common.image.toolbar.confirmReset') }}
            </h3>
            <p class="text-muted-foreground text-sm leading-relaxed font-medium">
              {{ t('common.image.toolbar.confirmResetToolTitle') }}
            </p>
            <p class="text-muted-foreground/60 text-[11px] mt-2 italic">
              {{ t('common.image.toolbar.confirmResetToolDesc') }}
            </p>
          </div>
        </div>
        <div class="flex gap-3">
          <AppButton
            variant="ghost"
            class="flex-1 rounded-xl h-11"
            @click="showResetConfirm = false"
          >
            {{ t('common.image.toolbar.cancel') }}
          </AppButton>
          <AppButton
            variant="danger"
            class="flex-1 rounded-xl h-11 shadow-lg shadow-destructive/10"
            @click="confirmResetDimensions"
          >
            {{ t('common.image.toolbar.confirm') }}
          </AppButton>
        </div>
      </div>
    </AppModal>
  </div>
</template>
