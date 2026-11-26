<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import JSZip from 'jszip'
import { Download, Frame, Grid2X2, LayoutGrid, Loader2, Layers, Printer } from 'lucide-vue-next'
import { useImageStore, type ImageItem } from '../stores/imageStore'
import { useFileHelpers } from '../composables/useFileHelpers'
import {
  MAX_SEAMLESS_SIDE,
  clampInt,
  computeSheetLayout,
  computeUnitGeometry,
  hasTransparency,
  normalizeSource,
  normalizeTileMode,
  opaqueBounds,
  sheetExceedsCanvasLimit,
  snapToPowerOfTwo,
  type ContentBounds,
  type SeamlessSource,
  type TileMode
} from '../lib/seamless'
import {
  SEAMLESS_SHEET_TOO_LARGE,
  createSeamlessUnit,
  drawSeamlessSheet,
  seamlessEngine,
  type SeamReport,
  type SeamlessOptions
} from '../lib/engines/seamlessEngine'
import { DPI_OPTIONS, formatCm } from '../lib/imageDpi'
import type { ProcessResult } from '../lib/engines/types'
import WorkspaceLayout from '../components/layout/WorkspaceLayout.vue'
import AppCanvasWorkspace from '../components/common/AppCanvasWorkspace.vue'
import AppExportSettings from '../components/common/AppExportSettings.vue'
import AppButton from '../components/common/AppButton.vue'
import AppCheckbox from '../components/common/AppCheckbox.vue'
import AppInput from '../components/common/AppInput.vue'
import AppSectionHeader from '../components/common/AppSectionHeader.vue'
import AppSegmentedControl from '../components/common/AppSegmentedControl.vue'
import AppSelect from '../components/common/AppSelect.vue'
import AppSlider from '../components/common/AppSlider.vue'
import AppTip from '../components/common/AppTip.vue'
import ImageSelectionStatus from '../components/common/ImageSelectionStatus.vue'
import ImageActionsToolbar from '../components/common/ImageActionsToolbar.vue'
import InspectorFooter from '../components/layout/InspectorFooter.vue'

const { t } = useI18n()
const store = useImageStore()
const { downloadImage } = useFileHelpers()

const selectedImage = computed(() => store.activeImage)
const canExport = computed(() => !!selectedImage.value && !isExporting.value)

// --- 参数（导出与预览共用） ---
const unitW = ref(1024)
const unitH = ref(1024)
const lockRatio = ref(true)
const ratio = ref(1)
const gap = ref(0)
const feather = ref(0)
const rotate = ref(0)
const source = ref<SeamlessSource>('fullBleed')
const mode = ref<TileMode>('straight')
const cols = ref(3)
const rows = ref(3)
const outputFormat = ref('image/png')
const outputQuality = ref(0.92)
const dpi = ref(300)
const pow2 = ref(false)

const isExporting = ref(false)
const exportTarget = ref<'unit' | 'sheet' | 'batch' | null>(null)
const exportError = ref('')
const batchDone = ref(0)
const seamReport = ref<SeamReport | null>(null)

const isMotif = computed(() => source.value === 'motif')

const effectiveUnitW = computed(() =>
  pow2.value ? snapToPowerOfTwo(unitW.value) : clampInt(unitW.value, 1, MAX_SEAMLESS_SIDE)
)
const effectiveUnitH = computed(() =>
  pow2.value ? snapToPowerOfTwo(unitH.value) : clampInt(unitH.value, 1, MAX_SEAMLESS_SIDE)
)

const maxPadding = computed(() =>
  Math.max(1, Math.floor(Math.min(effectiveUnitW.value, effectiveUnitH.value) / 4))
)

const layout = computed(() =>
  computeSheetLayout(effectiveUnitW.value, effectiveUnitH.value, cols.value, rows.value, mode.value)
)
const sheetFits = computed(() => !sheetExceedsCanvasLimit(layout.value))

const batchImages = computed(() => store.images.filter((img) => store.selectedIds.has(img.id)))

const modeOptions = computed(() => [
  {
    value: 'straight',
    label: t('tools.seamless.modes.straight'),
    description: t('tools.seamless.modeHints.straight')
  },
  {
    value: 'halfDrop',
    label: t('tools.seamless.modes.halfDrop'),
    description: t('tools.seamless.modeHints.halfDrop')
  },
  {
    value: 'brick',
    label: t('tools.seamless.modes.brick'),
    description: t('tools.seamless.modeHints.brick')
  },
  {
    value: 'horizontal',
    label: t('tools.seamless.modes.horizontal'),
    description: t('tools.seamless.modeHints.horizontal')
  },
  {
    value: 'vertical',
    label: t('tools.seamless.modes.vertical'),
    description: t('tools.seamless.modeHints.vertical')
  },
  {
    value: 'mirror',
    label: t('tools.seamless.modes.mirror'),
    description: t('tools.seamless.modeHints.mirror')
  }
])

const sourceOptions = computed<{ value: SeamlessSource; label: string }[]>(() => [
  { value: 'fullBleed', label: t('tools.seamless.sources.fullBleed') },
  { value: 'motif', label: t('tools.seamless.sources.motif') }
])

const dpiOptions = DPI_OPTIONS.map((value) => ({ value: String(value), label: `${value} dpi` }))

const modeHint = computed(() => t(`tools.seamless.modeHints.${mode.value}`))
const sourceHint = computed(() => t(`tools.seamless.sourceHints.${source.value}`))
const effectiveCols = computed(() => layout.value.cols)
const effectiveRows = computed(() => layout.value.rows)

const seamLabel = computed(() =>
  seamReport.value ? t(`tools.seamless.seamGrades.${seamReport.value.grade}`) : ''
)
const seamWeak = computed(() => seamReport.value?.grade === 'poor')
const bandWeak = computed(() => !!seamReport.value && seamReport.value.bandDetail < 0.8)
const seamTone = computed(() => {
  const grade = seamReport.value?.grade
  if (grade === 'poor') return 'text-[var(--danger)]'
  if (grade === 'fair') return 'text-[var(--muted)]'
  return 'text-[var(--ink)]'
})
const gapLabel = computed(() =>
  t(isMotif.value ? 'tools.seamless.padding' : 'tools.seamless.seamGap')
)
const printSize = computed(
  () =>
    `${formatCm(effectiveUnitW.value, dpi.value)} × ${formatCm(effectiveUnitH.value, dpi.value)} cm`
)

// --- 尺寸与比例 ---
const applySize = (w: number, h: number) => {
  unitW.value = clampInt(w, 1, MAX_SEAMLESS_SIDE)
  unitH.value = clampInt(h, 1, MAX_SEAMLESS_SIDE)
}

const handleW = (v: number | string | undefined) => {
  if (v === '' || v == null) return
  const n = Number(v)
  if (!Number.isFinite(n)) return
  const w = clampInt(n, 1, MAX_SEAMLESS_SIDE)
  if (lockRatio.value && ratio.value > 0) {
    applySize(w, w / ratio.value)
  } else {
    applySize(w, unitH.value)
  }
}

const handleH = (v: number | string | undefined) => {
  if (v === '' || v == null) return
  const n = Number(v)
  if (!Number.isFinite(n)) return
  const h = clampInt(n, 1, MAX_SEAMLESS_SIDE)
  if (lockRatio.value && ratio.value > 0) {
    applySize(h * ratio.value, h)
  } else {
    applySize(unitW.value, h)
  }
}

const setLock = (on: boolean | undefined) => {
  lockRatio.value = !!on
  if (lockRatio.value && unitH.value > 0) ratio.value = unitW.value / unitH.value
}

const togglePow2 = (on: boolean | undefined) => {
  pow2.value = !!on
  if (!on) return
  unitW.value = snapToPowerOfTwo(unitW.value)
  unitH.value = snapToPowerOfTwo(unitH.value)
  if (unitH.value > 0 && lockRatio.value) ratio.value = unitW.value / unitH.value
}

const handleCols = (v: number | string | undefined) => {
  if (v === '' || v == null) return
  const n = Number(v)
  if (Number.isFinite(n)) cols.value = clampInt(n, 1, 8)
}

const handleRows = (v: number | string | undefined) => {
  if (v === '' || v == null) return
  const n = Number(v)
  if (Number.isFinite(n)) rows.value = clampInt(n, 1, 8)
}

// --- 预览 ---
const workspaceRef = ref<InstanceType<typeof AppCanvasWorkspace> | null>(null)
const canvasRef = ref<HTMLCanvasElement | null>(null)
const previewImage = ref<HTMLImageElement | null>(null)
const contentBounds = ref<ContentBounds | null>(null)
const isInitialLoad = ref(true)
let loadToken = 0
let isDrawingRaf = false
let pendingDraw = false
let pendingFit = true

const PREVIEW_MAX_SIDE = 1800

const syncPadding = () => {
  const max = maxPadding.value
  if (gap.value > max) gap.value = max
  if (feather.value > max) feather.value = max
}

const drawPreview = () => {
  const img = previewImage.value
  const canvas = canvasRef.value
  if (!img || !canvas) return

  const rawW = effectiveUnitW.value
  const rawH = effectiveUnitH.value
  const rawLayout = computeSheetLayout(rawW, rawH, cols.value, rows.value, mode.value)
  const scale = Math.min(
    1,
    PREVIEW_MAX_SIDE / Math.max(1, rawLayout.width),
    PREVIEW_MAX_SIDE / Math.max(1, rawLayout.height)
  )

  const pw = Math.max(1, Math.round(rawW * scale))
  const ph = Math.max(1, Math.round(rawH * scale))
  const pLayout = computeSheetLayout(pw, ph, cols.value, rows.value, mode.value)
  const kind = source.value
  const geometry = computeUnitGeometry(img.naturalWidth, img.naturalHeight, pw, ph, {
    gap: gap.value * scale,
    feather: kind === 'motif' ? 0 : feather.value * scale,
    rotate: rotate.value,
    cover: kind === 'fullBleed',
    content: kind === 'motif' && rotate.value !== 0 ? (contentBounds.value ?? undefined) : undefined
  })

  const { canvas: unit, seam } = createSeamlessUnit(img, geometry, pw, ph, false, kind)
  seamReport.value = seam

  canvas.width = pLayout.width
  canvas.height = pLayout.height
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  drawSeamlessSheet(ctx, unit, pLayout)

  if (pendingFit) {
    pendingFit = false
    isInitialLoad.value = false
    nextTick(() => {
      workspaceRef.value?.triggerAutoFit(pLayout.width, pLayout.height, 72, false)
    })
  }
}

const requestDraw = (fit = false) => {
  if (fit) pendingFit = true
  if (isDrawingRaf) {
    pendingDraw = true
    return
  }
  isDrawingRaf = true
  requestAnimationFrame(() => {
    try {
      drawPreview()
    } catch (e) {
      console.warn('四方连续预览失败:', e)
    } finally {
      isDrawingRaf = false
      if (pendingDraw) {
        pendingDraw = false
        requestDraw()
      }
    }
  })
}

const loadPreviewImage = (item: ImageItem) => {
  const token = ++loadToken
  previewImage.value = null
  const img = new Image()
  img.onload = () => {
    if (token !== loadToken) return
    previewImage.value = img
    source.value = hasTransparency(img) ? 'motif' : 'fullBleed'
    contentBounds.value = opaqueBounds(img)
    requestDraw(true)
  }
  img.onerror = () => {
    if (token !== loadToken) return
    previewImage.value = null
  }
  img.src = item.preview
}

const initFromImage = (item: ImageItem | null) => {
  exportError.value = ''
  if (!item) {
    previewImage.value = null
    contentBounds.value = null
    seamReport.value = null
    const canvas = canvasRef.value
    if (canvas) {
      canvas.width = 1
      canvas.height = 1
    }
    return
  }

  const w = clampInt(item.width ?? 1024, 1, MAX_SEAMLESS_SIDE)
  const h = clampInt(item.height ?? 1024, 1, MAX_SEAMLESS_SIDE)
  applySize(w, h)
  ratio.value = w / h
  gap.value = 0
  feather.value = Math.max(2, Math.round(Math.min(w, h) * 0.06))
  rotate.value = 0
  syncPadding()
  isInitialLoad.value = true
  pendingFit = true
  loadPreviewImage(item)
}

onMounted(() => {
  requestDraw(true)
})

onUnmounted(() => {
  loadToken++
})

watch(
  () => store.activeId,
  () => initFromImage(selectedImage.value),
  { immediate: true }
)

watch([unitW, unitH, mode, cols, rows, pow2], () => {
  syncPadding()
  requestDraw(true)
})
watch([gap, feather, rotate, source], () => requestDraw())
watch(selectedImage, () => requestDraw())

// --- 导出 ---
const engineOptions = (): SeamlessOptions => ({
  width: effectiveUnitW.value,
  height: effectiveUnitH.value,
  gap: gap.value,
  feather: isMotif.value ? 0 : feather.value,
  rotate: rotate.value,
  source: source.value,
  mode: mode.value,
  cols: cols.value,
  rows: rows.value,
  format: outputFormat.value === 'original' ? undefined : outputFormat.value,
  quality: outputQuality.value,
  dpi: dpi.value,
  pow2: pow2.value
})

const errorText = (e: unknown) =>
  (e as Error)?.message === SEAMLESS_SHEET_TOO_LARGE
    ? t('tools.seamless.oversized')
    : t('tools.seamless.failed')

const exportOutput = async (output: 'unit' | 'sheet') => {
  const img = selectedImage.value
  if (!img || isExporting.value) return
  isExporting.value = true
  exportTarget.value = output
  exportError.value = ''
  try {
    const result = (await seamlessEngine(img.file, {
      ...engineOptions(),
      output
    })) as ProcessResult

    if (!result.blob) throw new Error('empty-result')
    const tag = t(
      output === 'unit' ? 'common.export.suffix.seamlessUnit' : 'common.export.suffix.seamlessSheet'
    )
    await downloadImage(result.blob, img.file.name, tag)
  } catch (e) {
    exportError.value = errorText(e)
    console.warn('四方连续导出失败:', e)
  } finally {
    isExporting.value = false
    exportTarget.value = null
  }
}

const EXT_BY_FORMAT: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp'
}

const exportBatch = async () => {
  const items = batchImages.value
  if (!items.length || isExporting.value) return
  isExporting.value = true
  exportTarget.value = 'batch'
  exportError.value = ''
  batchDone.value = 0
  try {
    const zip = new JSZip()
    const tag = t('common.export.suffix.seamlessUnit')
    const used = new Set<string>()
    for (const item of items) {
      const result = (await seamlessEngine(item.file, {
        ...engineOptions(),
        // 混合选择时每张图各自判断形态，避免把单元图形折返
        source: 'auto',
        output: 'unit'
      })) as ProcessResult
      if (!result.blob) continue
      const dot = item.file.name.lastIndexOf('.')
      const base = dot > 0 ? item.file.name.slice(0, dot) : item.file.name
      const ext = EXT_BY_FORMAT[result.blob.type] ?? 'png'
      let name = `${base}${tag}.${ext}`
      let i = 2
      while (used.has(name)) {
        name = `${base}${tag} (${i}).${ext}`
        i++
      }
      used.add(name)
      zip.file(name, result.blob)
      batchDone.value++
    }
    if (!batchDone.value) throw new Error('empty-result')
    const blob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `imago${tag}.zip`
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    exportError.value = errorText(e)
    console.warn('四方连续批量导出失败:', e)
  } finally {
    isExporting.value = false
    exportTarget.value = null
    batchDone.value = 0
  }
}
</script>

<template>
  <WorkspaceLayout show-sidebar no-scroll show-assets-tray>
    <template #header-left><ImageSelectionStatus :show-card-size="false" /></template>
    <template #header-actions>
      <ImageActionsToolbar
        view-id="seamless"
        :is-processing="isExporting"
        :show-download-all="false"
        :show-reset-all="false"
        :show-layout-toggle="false"
        show-clear-all
      />
    </template>

    <template #content>
      <AppCanvasWorkspace
        ref="workspaceRef"
        hide-default-hint
        :aria-label="t('tools.seamless.canvasAria')"
        :transform-duration="isInitialLoad ? 'duration-0' : 'duration-200'"
      >
        <template #default>
          <div v-if="selectedImage" class="relative z-10">
            <canvas ref="canvasRef" class="block rounded-sm will-change-contents" />
          </div>
        </template>
        <template #floating>
          <div
            class="absolute imago-canvas-hud left-1/2 -translate-x-1/2 bottom-16 pointer-events-none z-40"
          >
            <div
              class="flex items-center gap-2 px-3 py-1.5 bg-[var(--board)] border border-[var(--hairline)] rounded-lg text-[11px] text-[var(--muted)] font-medium tabular-nums"
            >
              <span>
                {{ t('tools.seamless.unitSize') }} {{ effectiveUnitW }} × {{ effectiveUnitH }} ·
                {{ t('tools.seamless.sheetSize') }} {{ layout.width }} × {{ layout.height }}
              </span>
              <span
                v-if="seamReport"
                class="pl-2 border-l border-[var(--hairline)]"
                :class="seamWeak ? 'text-[var(--danger)]' : 'text-[var(--ink)]'"
                :title="t('tools.seamless.seamScoreHint')"
              >
                {{ t('tools.seamless.seamScore') }} {{ seamReport.score }} · {{ seamLabel }}
              </span>
            </div>
          </div>
        </template>
      </AppCanvasWorkspace>
    </template>

    <template #sidebar>
      <section class="space-y-3">
        <AppSectionHeader :title="t('tools.seamless.source')" :icon="Layers" />
        <AppSegmentedControl
          :model-value="source"
          :options="sourceOptions"
          :aria-label="t('tools.seamless.source')"
          @update:model-value="(v: SeamlessSource) => (source = normalizeSource(v))"
        />
        <AppTip status>{{ sourceHint }}</AppTip>
      </section>

      <section class="space-y-3 pt-6 border-t border-[var(--hairline)]">
        <AppSectionHeader :title="t('tools.seamless.mode')" :icon="Grid2X2" />
        <AppSelect
          :model-value="mode"
          :options="modeOptions"
          @update:model-value="(v: string) => (mode = normalizeTileMode(v))"
        />
        <AppTip status>{{ modeHint }}</AppTip>
      </section>

      <section class="space-y-3 pt-6 border-t border-[var(--hairline)]">
        <AppSectionHeader :title="t('tools.seamless.unit')" :icon="Frame" />
        <div class="grid grid-cols-2 gap-2 px-1">
          <div class="space-y-1">
            <label class="text-[11px] text-[var(--muted)]">{{ t('tools.seamless.width') }}</label>
            <AppInput
              type="number"
              :model-value="unitW"
              :min="1"
              :max="MAX_SEAMLESS_SIDE"
              :aria-label="t('tools.seamless.width')"
              @update:model-value="handleW"
            />
          </div>
          <div class="space-y-1">
            <label class="text-[11px] text-[var(--muted)]">{{ t('tools.seamless.height') }}</label>
            <AppInput
              type="number"
              :model-value="unitH"
              :min="1"
              :max="MAX_SEAMLESS_SIDE"
              :aria-label="t('tools.seamless.height')"
              @update:model-value="handleH"
            />
          </div>
        </div>

        <AppCheckbox
          :model-value="lockRatio"
          :label="t('tools.seamless.lockRatio')"
          @update:model-value="setLock"
        />

        <AppCheckbox
          :model-value="pow2"
          :label="t('tools.seamless.pow2')"
          :description="t('tools.seamless.pow2Hint')"
          @update:model-value="togglePow2"
        />

        <AppSlider
          v-model="gap"
          :min="0"
          :max="maxPadding"
          :label="gapLabel"
          unit="px"
          :default-value="0"
        />
        <div v-if="!isMotif" class="space-y-1">
          <AppSlider
            v-model="feather"
            :min="0"
            :max="maxPadding"
            :label="t('tools.seamless.feather')"
            unit="px"
            :default-value="0"
          />
          <AppTip v-if="feather === 0">{{ t('tools.seamless.featherOff') }}</AppTip>
        </div>
        <div v-else class="space-y-1">
          <AppSlider
            v-model="rotate"
            :min="0"
            :max="180"
            :label="t('tools.seamless.rotate')"
            unit="°"
            :default-value="0"
          />
          <AppTip>{{ t('tools.seamless.rotateHint') }}</AppTip>
        </div>

        <AppTip v-if="seamWeak && !bandWeak" status class="text-[var(--danger)]">{{
          t('tools.seamless.seamHint')
        }}</AppTip>
        <AppTip v-if="bandWeak" status class="text-[var(--danger)]">{{
          t('tools.seamless.bandHint')
        }}</AppTip>

        <div v-if="seamReport" class="flex items-center justify-between px-1 text-[11px]">
          <span class="text-[var(--muted)]">{{ t('tools.seamless.seamScoreLabel') }}</span>
          <span
            class="inline-flex items-center gap-1.5 font-medium tabular-nums"
            :class="seamTone"
            :title="t('tools.seamless.seamScoreHint')"
          >
            <span class="w-1.5 h-1.5 rounded-full bg-current opacity-70"></span>
            {{ seamReport.score }} · {{ seamLabel }}
          </span>
        </div>
      </section>

      <section class="space-y-4 pt-6 border-t border-[var(--hairline)]">
        <AppSectionHeader :title="t('tools.seamless.tiling')" :icon="LayoutGrid" />
        <div class="flex items-end gap-2 px-1">
          <div v-if="mode !== 'vertical'" class="flex-1 space-y-1">
            <label class="text-[11px] text-[var(--muted)]">{{ t('tools.seamless.cols') }}</label>
            <AppInput
              type="number"
              :model-value="effectiveCols"
              :min="1"
              :max="8"
              :aria-label="t('tools.seamless.cols')"
              @update:model-value="handleCols"
            />
          </div>
          <div v-if="mode !== 'horizontal'" class="flex-1 space-y-1">
            <label class="text-[11px] text-[var(--muted)]">{{ t('tools.seamless.rows') }}</label>
            <AppInput
              type="number"
              :model-value="effectiveRows"
              :min="1"
              :max="8"
              :aria-label="t('tools.seamless.rows')"
              @update:model-value="handleRows"
            />
          </div>
        </div>
        <div class="px-1 font-mono text-[11px] tabular-nums text-[var(--muted)]">
          {{ t('tools.seamless.outputSize') }} {{ layout.width }} × {{ layout.height }}
        </div>
        <AppTip v-if="!sheetFits" status class="text-[var(--danger)]">{{
          t('tools.seamless.oversized')
        }}</AppTip>
      </section>

      <section class="space-y-3 pt-6 border-t border-[var(--hairline)]">
        <AppSectionHeader :title="t('tools.seamless.print')" :icon="Printer" />
        <AppSelect
          :model-value="String(dpi)"
          :options="dpiOptions"
          @update:model-value="(v: string) => (dpi = clampInt(Number(v), 1, 65535))"
        />
        <div class="px-1 font-mono text-[11px] tabular-nums text-[var(--muted)]">
          {{ t('tools.seamless.printSize') }} {{ printSize }}
        </div>
        <AppTip>{{ t('tools.seamless.dpiHint') }}</AppTip>
      </section>

      <AppTip v-if="exportError" status class="text-[var(--danger)]">{{ exportError }}</AppTip>

      <AppExportSettings
        v-model:format="outputFormat"
        v-model:quality="outputQuality"
        allow-manual-quality
        canvas-only
        :title="t('common.export.title')"
        class="pt-2 pb-6 border-t border-[var(--hairline)]"
      />

      <div v-if="batchImages.length > 1" class="pb-4">
        <AppButton
          variant="secondary"
          fill
          :loading="isExporting && exportTarget === 'batch'"
          :disabled="!canExport"
          @click="exportBatch"
        >
          <span class="inline-flex items-center gap-2">
            <Download v-if="!(isExporting && exportTarget === 'batch')" :size="15" />
            {{
              isExporting && exportTarget === 'batch'
                ? `${batchDone}/${batchImages.length}`
                : t('tools.seamless.cta.exportBatch', { n: batchImages.length })
            }}
          </span>
        </AppButton>
      </div>
    </template>

    <template #footer>
      <InspectorFooter
        class="bg-[var(--chrome)] border-t border-[color-mix(in_srgb,var(--ink)_8%,transparent)]"
      >
        <AppButton
          size="lg"
          fill
          variant="cta"
          class="flex-1 rounded-xl"
          :loading="isExporting && exportTarget === 'unit'"
          :disabled="!canExport"
          @click="exportOutput('unit')"
        >
          <template #icon>
            <Loader2
              v-if="isExporting && exportTarget === 'unit'"
              :size="18"
              class="animate-spin mr-2"
            />
            <Download v-else :size="18" class="mr-2" />
          </template>
          {{ t('tools.seamless.cta.exportUnit') }}
        </AppButton>
        <AppButton
          size="lg"
          variant="secondary"
          class="rounded-xl"
          :loading="isExporting && exportTarget === 'sheet'"
          :disabled="!canExport || !sheetFits"
          :aria-label="t('tools.seamless.cta.exportSheet')"
          :title="!sheetFits ? t('tools.seamless.oversized') : undefined"
          @click="exportOutput('sheet')"
        >
          {{ t('tools.seamless.cta.exportSheet') }}
        </AppButton>
      </InspectorFooter>
    </template>
  </WorkspaceLayout>
</template>
