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
import { Play, Info, ArrowRight, Download } from 'lucide-vue-next'
import { compressEngine } from '../lib/engines/compressEngine'
import type { CompressionOptions } from '../lib/engines/compressEngine'
import { useImageProcessor } from '../composables/useImageProcessor'
import type { ProcessResult } from '../lib/engines/types'

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
const compressionMode = ref<'quality' | 'target'>('quality')
const quality = ref(0.8)
const outputFormat = ref<string>('original')
const pngColors = ref(256)
const pngEffort = ref(7)
const targetSizeKB = ref(500)
const keepOriginalIfLarger = ref(true)
const preserveExif = ref(false)
const maxWidth = ref<number | undefined>(undefined)
const maxHeight = ref<number | undefined>(undefined)

const showCompareModal = ref(false)
const comparingImage = ref<ImageItem | null>(null)

const { isProcessing, processSelected } = useImageProcessor(compressEngine)

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
    pngEffort,
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
  if (store.selectedCount === 0)
    return {
      text: t('tools.compress.cta.select'),
      progress: '',
      icon: Play,
      action: 'none',
      disabled: true
    }

  if (isProcessing.value) {
    const total = store.selectedCount
    const processed = store.images.filter(
      (img) => store.selectedIds.has(img.id) && img.status === 'done'
    ).length
    return {
      text: t('tools.compress.cta.rendering'),
      progress: `(${processed}/${total})`,
      icon: Play,
      action: 'none',
      disabled: true
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
      maxSizeMB: compressionMode.value === 'target' ? targetSizeKB.value / 1024 : undefined,
      colors: outputFormat.value === 'image/png' ? pngColors.value : undefined,
      effort: outputFormat.value === 'image/png' ? pngEffort.value : undefined,
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
      <template #header-left><ImageSelectionStatus /></template>
      <template #header-actions
        ><ImageActionsToolbar
          view-id="compress"
          :is-processing="isProcessing"
          show-clear-all
          @reset-all="cleanupResults"
      /></template>

      <template #content>
        <div class="h-full w-full overflow-y-auto custom-scrollbar p-4 md:p-8 pt-2 md:pt-3">
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
                <div
                  class="flex items-center bg-muted/30 border border-border transition-all duration-300 group-hover:border-primary/20 p-2 md:p-3 rounded-xl md:rounded-2xl mt-1.5"
                  :class="[layoutStore.cardSizeMode === 'compact' ? 'gap-1.5' : 'gap-3']"
                >
                  <div class="flex-1 flex flex-col gap-0.5">
                    <span
                      class="font-black uppercase text-muted-foreground tracking-widest text-[0.55rem] md:text-[0.6rem]"
                      >{{ t('tools.compress.original') }}</span
                    ><span class="font-bold text-foreground text-[0.65rem] md:text-[0.75rem]">{{
                      formatSize(image.originalSize)
                    }}</span>
                  </div>
                  <ArrowRight :size="12" class="text-muted-foreground shrink-0" />
                  <div class="flex-1 flex flex-col gap-0.5">
                    <span
                      class="font-black uppercase text-muted-foreground tracking-widest text-[0.55rem] md:text-[0.6rem]"
                      >{{ t('tools.compress.compressed') }}</span
                    ><span
                      class="font-bold text-[0.65rem] md:text-[0.75rem]"
                      :class="image.status === 'done' ? 'text-primary' : 'text-foreground'"
                      >{{
                        image.status === 'done' && results.has(image.id)
                          ? formatSize(results.get(image.id)!.size)
                          : '--'
                      }}</span
                    >
                  </div>
                </div>
              </template>
            </ImageCard>
          </div>
        </div>
      </template>

      <template #sidebar>
        <AppExportSettings
          v-model:format="outputFormat"
          v-model:quality="quality"
          v-model:mode="compressionMode"
          v-model:target-size-k-b="targetSizeKB"
          v-model:colors="pngColors"
          v-model:effort="pngEffort"
          v-model:max-width="maxWidth"
          v-model:max-height="maxHeight"
          v-model:keep-original-if-larger="keepOriginalIfLarger"
          v-model:show-magnifier="store.showMagnifier"
          v-model:preserve-exif="preserveExif"
          allow-manual-quality
          :title="t('tools.compress.settingsTitle')"
        />

        <section class="pt-2">
          <div
            class="p-4 bg-muted/40 border border-dashed border-primary/30 rounded-2xl flex gap-3 transition-colors hover:bg-muted/60"
          >
            <Info :size="16" class="text-primary shrink-0 mt-0.5" />
            <p class="text-[0.65rem] text-muted-foreground leading-relaxed">
              {{ t('tools.compress.infoTip') }}
            </p>
          </div>
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
            <div class="flex items-center justify-center gap-1.5 font-bold text-sm tracking-tight">
              <span>{{ ctaState.text }}</span>
              <span v-if="ctaState.progress" class="tabular-nums opacity-70">{{
                ctaState.progress
              }}</span>
            </div>
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
