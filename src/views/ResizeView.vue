<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import type { ImageItem } from '../stores/imageStore'
import { useImageStore } from '../stores/imageStore'
import { useLayoutStore } from '../stores/layoutStore'
import { useFileHelpers } from '../composables/useFileHelpers'
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
  Maximize2,
  Percent,
  RotateCcw,
  RefreshCw,
  Download,
  FileSearch
} from 'lucide-vue-next'
import { resizeEngine } from '../lib/engines/resizeEngine'
import { useImageProcessor } from '../composables/useImageProcessor'

import InspectorFooter from '../components/layout/InspectorFooter.vue'

const store = useImageStore()
const layoutStore = useLayoutStore()
const { downloadImage, downloadAllAsZip } = useFileHelpers()

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

const { isProcessing, processSingle } = useImageProcessor(resizeEngine)

const displayImages = computed(() => [...store.images].reverse())

const modeOptions = [
  { label: '按比例', value: 'percentage', icon: Percent },
  { label: '按尺寸', value: 'dimensions', icon: Maximize2 }
]

const resetDimensions = () => {
  width.value = 1920
  height.value = 1080
}

const showCompareModal = ref(false)
const comparingImage = ref<ImageItem | null>(null)
const processedPreviewUrl = ref<string | null>(null)

const handleCompare = async (id: string) => {
  const item = store.images.find((img) => img.id === id)
  if (!item) return
  comparingImage.value = item
  if (item.processedBlob) {
    processedPreviewUrl.value = URL.createObjectURL(item.processedBlob)
    showCompareModal.value = true
  }
}

const closeCompare = () => {
  showCompareModal.value = false
}
const handleModalLeave = () => {
  if (processedPreviewUrl.value) {
    URL.revokeObjectURL(processedPreviewUrl.value)
    processedPreviewUrl.value = null
  }
  comparingImage.value = null
}

const handleDownload = (id: string) => {
  const item = store.images.find((img) => img.id === id)
  if (item?.processedBlob) downloadImage(item.processedBlob, item.file.name, '_Resized')
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
      store.markAllAsDirty()
    }, 150)
  },
  { deep: true }
)

const ctaState = computed(() => {
  if (store.selectedCount === 0)
    return { text: '请选择图片', icon: RefreshCw, action: 'none', disabled: true }
  if (isProcessing.value)
    return { text: '渲染中...', icon: RefreshCw, action: 'none', disabled: true }

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
    text: anyDirty ? `更新尺寸 (${store.selectedCount})` : `调整尺寸 (${store.selectedCount})`,
    icon: RefreshCw,
    action: 'process',
    disabled: false
  }
})

const handleCtaClick = async () => {
  const state = ctaState.value
  if (state.action === 'none') return

  if (state.action === 'download') {
    await downloadAllAsZip('_Resized')
    return
  }

  if (state.action === 'process') {
    await Array.from(store.selectedIds).reduce(async (p, id) => {
      await p
      await processSingle(id, {
        mode: resizeMode.value === 'dimensions' ? 'pixels' : 'percentage',
        width: width.value,
        height: height.value,
        percentage: percentage.value,
        maintainAspectRatio: maintainAspectRatio.value,
        format: outputFormat.value === 'original' ? undefined : outputFormat.value,
        quality: outputQuality.value,
        preserveExif: preserveExif.value
      })
    }, Promise.resolve())
  }
}
</script>

<template>
  <div class="h-full w-full flex flex-col overflow-hidden">
    <WorkspaceLayout show-sidebar no-scroll show-assets-tray>
      <template #header-left><ImageSelectionStatus :show-card-size="false" /></template>
      <template #header-actions
        ><ImageActionsToolbar
          :is-processing="isProcessing"
          show-clear-all
          zip-prefix="_Imago_Resized"
      /></template>

      <template #content>
        <div class="h-full w-full overflow-y-auto custom-scrollbar p-4 md:p-6">
          <AppEmptyState
            v-if="store.images.length === 0"
            title="暂无图片"
            description="导入图片以开始批量缩放"
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
              @toggle="store.toggleSelection"
              @remove="store.removeImage"
              @download="handleDownload"
              @compare="handleCompare"
            >
              <template #meta="{ image }">
                <AppComparisonBadge
                  before-label="原始"
                  :before-value="`${image.width}x${image.height}`"
                  after-label="目标"
                  :after-value="`${image.processedWidth}x${image.processedHeight}`"
                  :status="image.status"
                  :compact="layoutStore.cardSizeMode === 'compact'"
                />
              </template>
            </ImageCard>
          </div>
        </div>
      </template>

      <template #sidebar>
        <section class="space-y-4">
          <AppSectionHeader title="调整模式" :icon="Settings2" />
          <AppSegmentedControl v-model="resizeMode" :options="modeOptions" />

          <AppSidebarCard>
            <div v-if="resizeMode === 'percentage'" class="space-y-3">
              <AppSlider
                v-model="percentage"
                label="缩放比例"
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
                  placeholder="宽度"
                  suffix="W"
                  aria-label="宽度"
                />
                <AppInput
                  v-model.number="height"
                  type="number"
                  placeholder="高度"
                  suffix="H"
                  aria-label="高度"
                />
              </div>
              <div class="flex items-center justify-between px-1">
                <AppCheckbox v-model="maintainAspectRatio" label="锁定纵横比" />
                <button
                  @click="resetDimensions"
                  aria-label="重置尺寸"
                  title="重置尺寸"
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

    <AppModal :show="showCompareModal" @close="closeCompare" @after-leave="handleModalLeave">
      <ImageCompare
        v-if="comparingImage && processedPreviewUrl"
        :original-url="comparingImage.preview"
        :processed-url="processedPreviewUrl"
        :original-size="`${comparingImage.width}x${comparingImage.height}`"
        :processed-size="`${comparingImage.processedWidth || '--'}x${comparingImage.processedHeight || '--'}`"
      />
    </AppModal>
  </div>
</template>
