<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useImageStore, type ImageItem } from '../stores/imageStore'
import { useLayoutStore } from '../stores/layoutStore'
import { useFileHelpers } from '../composables/useFileHelpers'
import WorkspaceLayout from '../components/layout/WorkspaceLayout.vue'
import AppButton from '../components/common/AppButton.vue'
import AppInput from '../components/common/AppInput.vue'
import AppCheckbox from '../components/common/AppCheckbox.vue'
import AppSlider from '../components/common/AppSlider.vue'
import AppSegmentedControl from '../components/common/AppSegmentedControl.vue'
import AppSectionHeader from '../components/common/AppSectionHeader.vue'
import AppModal from '../components/common/AppModal.vue'
import ImageCard from '../components/common/ImageCard.vue'
import ImageCompare from '../components/common/ImageCompare.vue'
import ImageSelectionStatus from '../components/common/ImageSelectionStatus.vue'
import ImageActionsToolbar from '../components/common/ImageActionsToolbar.vue'
import AppExportSettings from '../components/common/AppExportSettings.vue'
import { Settings2, Maximize2, Percent, RotateCcw, ArrowRight, RefreshCw } from 'lucide-vue-next'
import { resizeEngine } from '../lib/engines/resizeEngine'
import { useImageProcessor } from '../composables/useImageProcessor'

import InspectorFooter from '../components/layout/InspectorFooter.vue'

const store = useImageStore()
const layoutStore = useLayoutStore()
const { downloadImage } = useFileHelpers()

// 状态
const resizeMode = ref<'percentage' | 'dimensions'>('percentage')
const width = ref(1920)
const height = ref(1080)
const percentage = ref(100)
const maintainAspectRatio = ref(true)
const outputFormat = ref<string>('original')
const outputQuality = ref(0.9)
const preserveExif = ref(false)

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

const handleProcess = async () => {
  if (store.selectedCount === 0) return
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
  if (item?.processedBlob) downloadImage(item.processedBlob, item.file.name, '_Imago_Resized')
}

const buttonText = computed(() => {
  if (isProcessing.value) return '正在处理...'
  if (store.selectedCount > 0) return `调整选中的 ${store.selectedCount} 张`
  return '开始调整尺寸'
})
</script>

<template>
  <div class="h-full w-full flex flex-col overflow-hidden">
    <WorkspaceLayout show-sidebar no-scroll show-assets-tray>
      <template #header-left><ImageSelectionStatus /></template>
      <template #header-actions
        ><ImageActionsToolbar
          :is-processing="isProcessing"
          show-clear-all
          zip-prefix="_Imago_Resized"
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
                  class="flex items-center bg-muted/30 border border-border transition-all duration-300 group-hover:border-primary/20"
                  :class="[
                    layoutStore.cardSizeMode === 'compact'
                      ? 'gap-1.5 p-1.5 rounded-xl mt-1'
                      : 'gap-3 p-3 rounded-2xl mt-1.5'
                  ]"
                >
                  <div class="flex-1 flex flex-col gap-0.5">
                    <span
                      class="font-medium text-muted-foreground mt-0.5"
                      :class="
                        layoutStore.cardSizeMode === 'compact' ? 'text-[0.5rem]' : 'text-[0.6rem]'
                      "
                      >原始</span
                    ><span
                      class="font-bold text-foreground transition-all"
                      :class="
                        layoutStore.cardSizeMode === 'compact' ? 'text-[0.65rem]' : 'text-[0.75rem]'
                      "
                      >{{ image.width }}x{{ image.height }}</span
                    >
                  </div>
                  <div class="text-muted-foreground flex shrink-0">
                    <ArrowRight :size="layoutStore.cardSizeMode === 'compact' ? 10 : 12" />
                  </div>
                  <div class="flex-1 flex flex-col gap-0.5">
                    <span
                      class="font-medium text-muted-foreground mt-0.5"
                      :class="
                        layoutStore.cardSizeMode === 'compact' ? 'text-[0.5rem]' : 'text-[0.6rem]'
                      "
                      >目标</span
                    ><span
                      class="font-bold transition-all"
                      :class="[
                        image.status === 'done' ? 'text-primary' : 'text-foreground',
                        layoutStore.cardSizeMode === 'compact' ? 'text-[0.65rem]' : 'text-[0.75rem]'
                      ]"
                      >{{
                        image.status === 'done'
                          ? `${image.processedWidth}x${image.processedHeight}`
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
        <section class="space-y-4">
          <AppSectionHeader title="调整模式" :icon="Settings2" />
          <AppSegmentedControl v-model="resizeMode" :options="modeOptions" />
        </section>

        <section class="relative">
          <div class="bg-muted/10 rounded-2xl p-4 border border-border/60">
            <div v-if="resizeMode === 'percentage'" class="space-y-3">
              <div class="flex items-center justify-between px-0.5 h-6">
                <div class="flex items-center gap-2.5">
                  <div
                    class="bg-primary/5 p-1 rounded-full flex items-center justify-center overflow-visible"
                  >
                    <Percent :size="15" :stroke-width="2.5" class="text-primary" />
                  </div>
                  <span
                    class="text-[0.65rem] font-bold text-muted-foreground uppercase tracking-widest leading-none"
                    >缩放比例</span
                  >
                </div>
                <span class="font-mono text-sm font-black text-primary tabular-nums"
                  >{{ percentage }}%</span
                >
              </div>
              <AppSlider v-model="percentage" :min="1" :max="200" :step="1" />
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
          </div>
        </section>

        <AppExportSettings
          v-model:format="outputFormat"
          v-model:quality="outputQuality"
          v-model:preserve-exif="preserveExif"
          show-exif-option
        />
      </template>

      <template #footer>
        <InspectorFooter>
          <AppButton
            size="lg"
            variant="cta"
            class="w-full h-12 rounded-xl shadow-xl shadow-primary/10 transition-all active:scale-95"
            :loading="isProcessing"
            :disabled="!store.selectedCount || isProcessing"
            @click="handleProcess"
          >
            <template #icon><RefreshCw v-if="!isProcessing" :size="18" class="mr-2" /></template>
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
        :original-size="`${comparingImage.width}x${comparingImage.height}`"
        :processed-size="`${comparingImage.processedWidth || '--'}x${comparingImage.processedHeight || '--'}`"
      />
    </AppModal>
  </div>
</template>
