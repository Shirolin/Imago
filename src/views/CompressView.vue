<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useImageStore } from '../stores/imageStore'
import { useLayoutStore } from '../stores/layoutStore'
import { useFileHelpers } from '../composables/useFileHelpers'
import WorkspaceLayout from '../components/layout/WorkspaceLayout.vue'
import AppButton from '../components/common/AppButton.vue'
import AppModal from '../components/common/AppModal.vue'
import ImageCard from '../components/common/ImageCard.vue'
import ImageCompare from '../components/common/ImageCompare.vue'
import ImageSelectionStatus from '../components/common/ImageSelectionStatus.vue'
import ImageActionsToolbar from '../components/common/ImageActionsToolbar.vue'
import AppExportSettings from '../components/common/AppExportSettings.vue'
import { Zap, Info, ArrowRight } from 'lucide-vue-next'
import { compressEngine } from '../lib/engines/compressEngine'
import { useImageProcessor } from '../composables/useImageProcessor'

import InspectorFooter from '../components/layout/InspectorFooter.vue'

const store = useImageStore()
const layoutStore = useLayoutStore()
const { formatSize, downloadImage } = useFileHelpers()

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
const comparingImage = ref<any>(null)
const processedPreviewUrl = ref<string | null>(null)

const { isProcessing, processSelected } = useImageProcessor(compressEngine)

const displayImages = computed(() => [...store.images].reverse())

const handleCompress = async () => {
  await processSelected({
    quality: quality.value,
    format: (outputFormat.value === 'original' ? undefined : outputFormat.value) as any,
    mode: compressionMode.value,
    maxSizeMB: compressionMode.value === 'target' ? targetSizeKB.value / 1024 : undefined,
    colors: outputFormat.value === 'image/png' ? pngColors.value : undefined,
    effort: outputFormat.value === 'image/png' ? pngEffort.value : undefined,
    keepOriginalIfLarger: keepOriginalIfLarger.value,
    preserveExif: preserveExif.value,
    maxWidth: maxWidth.value,
    maxHeight: maxHeight.value
  })
}

const handleCompare = (id: string) => {
  const item = store.images.find((img) => img.id === id)
  if (!item || !item.processedBlob) return
  comparingImage.value = item
  processedPreviewUrl.value = URL.createObjectURL(item.processedBlob)
  showCompareModal.value = true
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
  if (item?.processedBlob) downloadImage(item.processedBlob, item.file.name, '_Compressed')
}

watch([quality, outputFormat], () => store.markAllAsDirty(), { deep: true })

const buttonText = computed(() => {
  if (isProcessing.value) return '正在压缩...'
  if (store.selectedCount > 0) return `压缩选中的 ${store.selectedCount} 张`
  return '开始压缩'
})
</script>

<template>
  <div class="h-full w-full flex flex-col overflow-hidden">
    <WorkspaceLayout show-sidebar no-scroll show-assets-tray>
      <template #header-left><ImageSelectionStatus /></template>
      <template #header-actions
        ><ImageActionsToolbar :is-processing="isProcessing" show-clear-all zip-prefix="_Compressed"
      /></template>

      <template #content>
        <div class="h-full w-full overflow-y-auto custom-scrollbar p-4 md:p-6">
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
              @toggle="store.toggleSelection"
              @remove="store.removeImage"
              @download="handleDownload"
              @compare="handleCompare"
            >
              <template #meta="{ image }">
                <div
                  class="flex items-center bg-muted/30 border border-border transition-all duration-300 group-hover:border-primary/20 p-2 md:p-3 rounded-xl md:rounded-2xl mt-1.5"
                  :class="[layoutStore.cardSizeMode === 'compact' ? 'gap-1.5' : 'gap-3']"
                >
                  <div class="flex-1 flex flex-col gap-0.5">
                    <span
                      class="font-black uppercase text-muted-foreground tracking-widest text-[0.55rem] md:text-[0.6rem]"
                      >原始</span
                    ><span class="font-bold text-foreground text-[0.65rem] md:text-[0.75rem]">{{
                      formatSize(image.originalSize)
                    }}</span>
                  </div>
                  <ArrowRight :size="12" class="text-muted-foreground shrink-0" />
                  <div class="flex-1 flex flex-col gap-0.5">
                    <span
                      class="font-black uppercase text-muted-foreground tracking-widest text-[0.55rem] md:text-[0.6rem]"
                      >压缩后</span
                    ><span
                      class="font-bold text-[0.65rem] md:text-[0.75rem]"
                      :class="image.status === 'done' ? 'text-primary' : 'text-foreground'"
                      >{{
                        image.status === 'done' ? formatSize(image.processedSize || 0) : '--'
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
          title="压缩设置"
        />

        <section class="pt-2">
          <div
            class="p-4 bg-primary/[0.03] border border-dashed border-primary/20 rounded-2xl flex gap-3"
          >
            <Info :size="16" class="text-primary shrink-0 mt-0.5" />
            <p class="text-[0.65rem] text-muted-foreground leading-relaxed">
              采用先进的 Web 压缩算法，在保持视觉质量的同时大幅减小文件体积。
            </p>
          </div>
        </section>
      </template>

      <template #footer>
        <InspectorFooter>
          <AppButton
            size="lg"
            variant="cta"
            class="w-full h-12 rounded-xl shadow-xl shadow-primary/10 transition-all active:scale-95"
            :loading="isProcessing"
            :disabled="!store.selectedCount || isProcessing"
            @click="handleCompress"
          >
            <template #icon><Zap v-if="!isProcessing" :size="18" class="mr-2" /></template>
            <span class="font-bold text-sm tracking-tight">{{ buttonText }}</span>
          </AppButton>
        </InspectorFooter>
      </template>
    </WorkspaceLayout>

    <AppModal :show="showCompareModal" @close="closeCompare" @after-leave="handleModalLeave">
      <ImageCompare
        v-if="comparingImage && processedPreviewUrl"
        :original-url="comparingImage.preview"
        :processed-url="processedPreviewUrl"
        :original-size="formatSize(comparingImage.originalSize)"
        :processed-size="formatSize(comparingImage.processedSize || 0)"
      />
    </AppModal>
  </div>
</template>
