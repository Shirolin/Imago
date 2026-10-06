<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import type { ImageItem } from '../stores/imageStore'
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
import AppTip from '../components/common/AppTip.vue'
import { Play, Download, Loader2 } from 'lucide-vue-next'
import { dualEngine } from '../lib/engines/index'
import type { CompressionOptions } from '../lib/engines/compressEngine'
import { useToolRun } from '../composables/useToolRun'
import { DEFAULT_COMPRESS_LONG_EDGE, MAX_TARGET_SIZE_KB } from '../lib/limits'

import InspectorFooter from '../components/layout/InspectorFooter.vue'

const store = useImageStore()
const layoutStore = useLayoutStore()
const { formatSize } = useFileHelpers()
const { t } = useI18n()

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

/**
 * 处理 → 结果 → 导出交给 useToolRun。这里只声明引擎与参数，
 * 结果容器、预览 URL 所有权、脏标记、CTA 判定、ZIP 组装、卸载清理都在 module 内。
 */
const toolRun = useToolRun<CompressionOptions>({
  id: 'compress',
  scope: 'selected',
  processor: dualEngine,
  options: () => ({
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
  })
})

const { cta, result: resultOf, act: run, download, reset, exportAll } = toolRun
const isProcessing = toolRun.isRunning

// P2-15：GIF 会被引擎转为静态图（取首帧），选中 GIF 时提示
const hasGifSelected = computed(() =>
  store.images.some((img) => store.selectedIds.has(img.id) && img.file.type === 'image/gif')
)

// 未设分辨率上限时引擎默认按 4096px 长边约束，质量/目标模式均显示提示
const showDefaultLimitHint = computed(() => !maxWidth.value && !maxHeight.value)

const displayImages = computed(() => [...store.images].reverse())

const handleCompare = (id: string) => {
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

// CTA 文案与图标。判定逻辑在 module 内（resolveCta），这里只做展示映射。
const ctaCopy = computed(() => {
  switch (cta.value.action) {
    case 'import':
      return { text: t('tools.compress.cta.startCompress'), icon: Play }
    case 'select':
      return { text: t('tools.compress.cta.selectImage'), icon: Play }
    case 'abort':
      return { text: t('tools.compress.cta.rendering'), icon: Loader2 }
    case 'export':
      return { text: t('tools.compress.cta.exportResults'), icon: Download }
    case 'update':
      return { text: t('tools.compress.cta.updateCompress'), icon: Play }
    case 'blocked':
      return { text: t('tools.compress.cta.startCompress'), icon: Play }
    default:
      return { text: t('tools.compress.cta.startCompress'), icon: Play }
  }
})

const handleCtaClick = async () => {
  await run()
}

const cleanupResults = () => {
  reset()
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
          @export-all="exportAll"
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
            :variant="cta.action === 'export' ? 'success' : 'cta'"
            class="w-full rounded-[var(--radius-ctrl)] transition-colors"
            :disabled="cta.disabled"
            :hint="cta.action === 'abort' ? t('tools.compress.cta.clickToAbort') : undefined"
            @click="handleCtaClick"
          >
            <template #icon>
              <Loader2 v-if="isProcessing" :size="18" class="animate-spin mr-2" />
              <component :is="ctaCopy.icon" v-else :size="18" class="mr-2" />
            </template>
            {{ ctaCopy.text
            }}<span v-if="cta.badge" class="tabular-nums opacity-70">{{ cta.badge }}</span>
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
        :original-url="comparingImage.file"
        :processed-url="resultOf(comparingImage.id)!.primary"
        :original-size="formatSize(comparingImage.originalSize)"
        :processed-size="formatSize(resultOf(comparingImage.id)!.size)"
        @close="closeCompare"
      />
    </AppModal>
  </div>
</template>
