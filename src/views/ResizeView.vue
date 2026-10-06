<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ImageItem } from '../stores/imageStore'
import { useImageStore } from '../stores/imageStore'
import { useLayoutStore } from '../stores/layoutStore'
import WorkspaceLayout from '../components/layout/WorkspaceLayout.vue'
import AppButton from '../components/common/AppButton.vue'
import AppInput from '../components/common/AppInput.vue'
import AppCheckbox from '../components/common/AppCheckbox.vue'
import AppSlider from '../components/common/AppSlider.vue'
import AppSegmentedControl from '../components/common/AppSegmentedControl.vue'
import AppSectionHeader from '../components/common/AppSectionHeader.vue'
import AppSidebarCard from '../components/common/AppSidebarCard.vue'
import AppEmptyState from '../components/common/AppEmptyState.vue'
import AppModal from '../components/common/AppModal.vue'
import ImageCard from '../components/common/ImageCard.vue'
import ImageCompare from '../components/common/ImageCompare.vue'
import ImageSelectionStatus from '../components/common/ImageSelectionStatus.vue'
import ImageActionsToolbar from '../components/common/ImageActionsToolbar.vue'
import AppExportSettings from '../components/common/AppExportSettings.vue'
import { MAX_PROCESS_SIDE } from '../lib/limits'
import {
  Settings2,
  Percent,
  RotateCcw,
  RefreshCw,
  Download,
  FileSearch,
  AlertCircle,
  Loader2
} from 'lucide-vue-next'
import { resizeEngine } from '../lib/engines/resizeEngine'
import { useToolRun } from '../composables/useToolRun'

import InspectorFooter from '../components/layout/InspectorFooter.vue'

const store = useImageStore()
const layoutStore = useLayoutStore()
const { t } = useI18n()

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

/**
 * 处理 → 结果 → 导出交给 useToolRun。
 *
 * dirtyDebounceMs: 150 保留迁移前的滑杆防抖——比例联动会连续改 width/height，
 * 不防抖则拖动过程中每帧都标脏。module 在 dispose 时 clearTimeout，
 * 顺带修掉了此前 debounceTimeout 无卸载清理的泄漏。
 */
const toolRun = useToolRun({
  id: 'resize',
  scope: 'selected',
  processor: resizeEngine,
  dirtyDebounceMs: 150,
  options: () => ({
    mode: resizeMode.value === 'dimensions' ? ('pixels' as const) : ('percentage' as const),
    width: width.value,
    height: height.value,
    percentage: percentage.value,
    maintainAspectRatio: maintainAspectRatio.value,
    format: outputFormat.value === 'original' ? undefined : outputFormat.value,
    quality: outputQuality.value,
    preserveExif: preserveExif.value
  })
})

const { cta, result: resultOf, act: run, download, reset, exportAll } = toolRun
const isProcessing = toolRun.isRunning

const handleCompare = async (id: string) => {
  const item = store.images.find((img) => img.id === id)
  const result = resultOf(id)
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

const ctaCopy = computed(() => {
  switch (cta.value.action) {
    case 'select':
      return { text: t('tools.resize.cta.select'), icon: RefreshCw }
    case 'export':
      return {
        text: t('tools.resize.cta.exportResults', { count: store.selectedCount }),
        icon: Download
      }
    case 'update':
      return {
        text: t('tools.resize.cta.updateDimensions', { count: store.selectedCount }),
        icon: RefreshCw
      }
    case 'abort':
      return { text: t('tools.resize.cta.rendering'), icon: RefreshCw }
    default:
      return {
        text: t('tools.resize.cta.adjustDimensions', { count: store.selectedCount }),
        icon: RefreshCw
      }
  }
})

const handleCtaClick = async () => {
  await run()
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
          @reset-all="() => reset()"
          @export-all="exportAll"
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
                ? 'grid-cols-[repeat(auto-fill,minmax(130px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3 md:gap-4'
                : 'grid-cols-[repeat(auto-fill,minmax(160px,1fr))] md:grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-3 md:gap-5'
            ]"
          >
            <ImageCard
              v-for="img in displayImages"
              :key="img.id"
              :image="img"
              :is-selected="store.selectedIds.has(img.id)"
              :processed-preview="resultOf(img.id)?.preview"
              :processed-blob="resultOf(img.id)?.primary"
              :is-dirty="resultOf(img.id)?.dirty"
              @toggle="store.toggleSelection"
              @remove="store.removeImage"
              @download="download"
              @compare="handleCompare"
              @reset="reset"
            />
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
            <div v-else class="space-y-3">
              <!-- 单列布局：grid-cols-2 下输入框过窄（~83px），4 位数文本会溢出/与步进按钮重叠 -->
              <AppInput
                v-model.number="width"
                type="number"
                :placeholder="t('tools.resize.width')"
                :suffix="t('tools.resize.widthUnit')"
                :aria-label="t('tools.resize.width')"
                :min="1"
                :max="MAX_PROCESS_SIDE"
              />
              <AppInput
                v-model.number="height"
                type="number"
                :placeholder="t('tools.resize.height')"
                :suffix="t('tools.resize.heightUnit')"
                :aria-label="t('tools.resize.height')"
                :min="1"
                :max="MAX_PROCESS_SIDE"
              />
              <div class="flex items-center justify-between px-1 pt-0.5">
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

        <section class="pt-6 border-t border-[var(--hairline)]">
          <AppExportSettings
            v-model:format="outputFormat"
            v-model:quality="outputQuality"
            v-model:preserve-exif="preserveExif"
            show-exif-option
            canvas-only
          />
        </section>
      </template>

      <template #footer>
        <InspectorFooter>
          <AppButton
            size="lg"
            fill
            :variant="cta.action === 'export' ? 'success' : 'cta'"
            class="w-full rounded-xl transition-colors"
            :disabled="cta.disabled"
            :hint="cta.action === 'abort' ? t('tools.split.cta.clickToAbort') : undefined"
            @click="handleCtaClick"
          >
            <template #icon>
              <Loader2 v-if="isProcessing" :size="18" class="animate-spin mr-2" />
              <component :is="ctaCopy.icon" v-else :size="18" class="mr-2" />
            </template>
            {{ ctaCopy.text }}
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
        v-if="comparingImage && resultOf(comparingImage.id)"
        :original-url="comparingImage.preview"
        :processed-url="resultOf(comparingImage.id)!.primary"
        :original-size="`${comparingImage.width}x${comparingImage.height}`"
        :processed-size="`${resultOf(comparingImage.id)!.meta.width || '--'}x${resultOf(comparingImage.id)!.meta.height || '--'}`"
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
            <h3 class="text-lg font-medium text-foreground mb-1">
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
            class="flex-1 rounded-xl h-11"
            @click="confirmResetDimensions"
          >
            {{ t('common.image.toolbar.confirm') }}
          </AppButton>
        </div>
      </div>
    </AppModal>
  </div>
</template>
