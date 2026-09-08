<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import JSZip from 'jszip'
import { Stamp, Download, Trash2, Link as LinkIcon, Unlink, LayoutGrid } from 'lucide-vue-next'
import { useImageStore } from '../stores/imageStore'
import { useStampBasket } from '../composables/useStampBasket'
import {
  MOLD_PRESETS,
  MAX_MOLD_SIDE,
  normalizeMold,
  normalizeMoldSize,
  containMold,
  isOutOfBounds,
  needsOpaqueFill,
  uniqueZipName
} from '../lib/moldCut'
import { cropEngine } from '../lib/engines/cropEngine'
import type { ProcessResult } from '../lib/engines/types'
import WorkspaceLayout from '../components/layout/WorkspaceLayout.vue'
import AppCanvasWorkspace from '../components/common/AppCanvasWorkspace.vue'
import AppExportSettings from '../components/common/AppExportSettings.vue'
import AppButton from '../components/common/AppButton.vue'
import AppInput from '../components/common/AppInput.vue'
import AppSectionHeader from '../components/common/AppSectionHeader.vue'
import AppSegmentedControl from '../components/common/AppSegmentedControl.vue'
import AppTip from '../components/common/AppTip.vue'
import MoldBox from '../components/common/MoldBox.vue'
import ImageSelectionStatus from '../components/common/ImageSelectionStatus.vue'
import ImageActionsToolbar from '../components/common/ImageActionsToolbar.vue'
import InspectorFooter from '../components/layout/InspectorFooter.vue'

const { t } = useI18n()
const store = useImageStore()
const basket = useStampBasket()

// --- 模具状态（原图像素帧） ---
const moldW = ref(32)
const moldH = ref(32)
const lockRatio = ref(true)
const ratio = ref(1)
const pos = ref({ x: 0, y: 0 })

const outputFormat = ref('image/png')
const outputQuality = ref(0.92)
const isStamping = ref(false)
const isExporting = ref(false)

const workspaceRef = ref<InstanceType<typeof AppCanvasWorkspace> | null>(null)
const selectedImage = computed(() => store.activeImage)
const imgW = computed(() => selectedImage.value?.width ?? 0)
const imgH = computed(() => selectedImage.value?.height ?? 0)
const hasSize = computed(() => imgW.value > 0 && imgH.value > 0)

const mold = computed(() =>
  normalizeMold({ x: pos.value.x, y: pos.value.y, w: moldW.value, h: moldH.value })
)
const outOfBounds = computed(
  () => hasSize.value && isOutOfBounds(mold.value, imgW.value, imgH.value)
)
const opaqueFill = computed(() =>
  needsOpaqueFill(outputFormat.value, selectedImage.value?.file.type ?? '')
)

const presetValue = computed(() => (moldW.value === moldH.value ? moldW.value : -1))
const presetOptions = computed(() => [
  ...MOLD_PRESETS.map((p) => ({ label: `${p}×${p}`, value: p as number })),
  ...(presetValue.value === -1 ? [{ label: t('tools.moldCut.custom'), value: -1 as number }] : [])
])

const applySize = (w: number, h: number) => {
  const n = normalizeMoldSize(w, h)
  moldW.value = n.w
  moldH.value = n.h
  if (!hasSize.value) return
  pos.value = containMold({ ...mold.value, w: n.w, h: n.h }, imgW.value, imgH.value)
}

const handlePreset = (p: number) => {
  if (p === -1) return
  applySize(p, p)
}

const handleW = (v: number | string) => {
  if (v === '' || v == null) return
  const w = Number(v)
  if (!Number.isFinite(w)) return
  if (lockRatio.value && moldW.value > 0) {
    applySize(w, Math.max(1, Math.round(w / ratio.value)))
  } else {
    applySize(w, moldH.value)
  }
}

const handleH = (v: number | string) => {
  if (v === '' || v == null) return
  const h = Number(v)
  if (!Number.isFinite(h)) return
  if (lockRatio.value && moldH.value > 0) {
    applySize(Math.max(1, Math.round(h * ratio.value)), h)
  } else {
    applySize(moldW.value, h)
  }
}

const toggleLock = () => {
  lockRatio.value = !lockRatio.value
  if (lockRatio.value && moldH.value > 0) ratio.value = moldW.value / moldH.value
}

const centerMold = () => {
  if (!hasSize.value) return
  pos.value = containMold(
    {
      x: Math.round((imgW.value - moldW.value) / 2),
      y: Math.round((imgH.value - moldH.value) / 2),
      w: moldW.value,
      h: moldH.value
    },
    imgW.value,
    imgH.value
  )
}

const resetView = () => {
  if (!hasSize.value) return
  workspaceRef.value?.triggerAutoFit(imgW.value, imgH.value)
}

const onMoldDrag = (m: { x: number; y: number }) => {
  pos.value = { x: m.x, y: m.y }
}

const nudge = (dx: number, dy: number) => {
  if (!hasSize.value) return
  const next = containMold(
    { ...mold.value, x: mold.value.x + dx, y: mold.value.y + dy },
    imgW.value,
    imgH.value
  )
  pos.value = { x: next.x, y: next.y }
}

// --- 盖章：直接调 cropEngine，不污染原图在 store 中的状态 ---
const canStamp = computed(
  () => selectedImage.value && hasSize.value && !isStamping.value && !basket.isFull.value
)

const stamp = async () => {
  const img = selectedImage.value
  if (!img || !hasSize.value || isStamping.value || basket.isFull.value) return
  isStamping.value = true
  try {
    const m = mold.value
    const res = (await cropEngine(img.file, {
      x: m.x,
      y: m.y,
      width: m.w,
      height: m.h,
      usePercentage: false,
      fillColor: opaqueFill.value ? '#ffffff' : 'transparent',
      format: outputFormat.value === 'original' ? undefined : outputFormat.value,
      quality: outputQuality.value
    })) as ProcessResult
    const blob = res.blob
    if (blob) basket.addStamp(blob, img.file.name, m)
  } catch (e) {
    console.warn('模具盖章失败:', e)
  } finally {
    isStamping.value = false
  }
}

// --- 导出 ---
const mimeToExt = (mime: string): string => {
  const map: Record<string, string> = {
    'image/png': '.png',
    'image/jpeg': '.jpg',
    'image/webp': '.webp',
    'image/avif': '.avif',
    'image/jxl': '.jxl'
  }
  return map[mime] ?? '.png'
}

const exportBasket = async () => {
  const img = selectedImage.value
  if (!img || basket.count.value === 0 || isExporting.value) return
  // 单张直下，多张打 ZIP
  if (basket.count.value === 1) {
    const item = basket.items.value[0]!
    const url = URL.createObjectURL(item.blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${item.name}${mimeToExt(item.blob.type)}`
    a.click()
    URL.revokeObjectURL(url)
    return
  }
  isExporting.value = true
  try {
    const zip = new JSZip()
    const used = new Set<string>()
    for (const item of basket.items.value) {
      zip.file(uniqueZipName(used, `${item.name}${mimeToExt(item.blob.type)}`), item.blob)
    }
    const content = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(content)
    const a = document.createElement('a')
    a.href = url
    const dot = img.file.name.lastIndexOf('.')
    const base = dot > 0 ? img.file.name.substring(0, dot) : img.file.name
    a.download = `${base}${t('common.export.suffix.moldCut')}.zip`
    a.click()
    URL.revokeObjectURL(url)
  } catch (e) {
    console.warn('收集篮导出失败:', e)
  } finally {
    isExporting.value = false
  }
}

// --- 键盘：空格/回车盖章，方向键步进 ---
const handleKeyDown = (e: KeyboardEvent) => {
  if (e.ctrlKey || e.metaKey) return
  const el = e.target as HTMLElement
  if (['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName)) return
  // 焦点在按钮上时放行：让按钮自身的键盘激活生效，避免“想导出却盖了一张”
  if (typeof el.closest === 'function' && el.closest('button, [role="button"]')) return
  if (e.key === ' ' || e.key === 'Enter') {
    e.preventDefault()
    void stamp()
  } else if (e.key.startsWith('Arrow')) {
    const step = e.shiftKey ? 10 : 1
    if (e.key === 'ArrowLeft') nudge(-step, 0)
    else if (e.key === 'ArrowRight') nudge(step, 0)
    else if (e.key === 'ArrowUp') nudge(0, -step)
    else if (e.key === 'ArrowDown') nudge(0, step)
    else return
    e.preventDefault()
  }
}

onMounted(() => window.addEventListener('keydown', handleKeyDown))
onUnmounted(() => {
  window.removeEventListener('keydown', handleKeyDown)
  basket.clear()
})

watch(
  () => store.activeId,
  (id) => {
    basket.bindSource(id ?? null)
    centerMold()
    nextTick(resetView)
  },
  { immediate: true }
)
</script>

<template>
  <WorkspaceLayout show-sidebar no-scroll show-assets-tray>
    <template #header-left><ImageSelectionStatus :show-card-size="false" /></template>
    <template #header-actions>
      <ImageActionsToolbar
        view-id="moldCut"
        :is-processing="isStamping"
        show-clear-all
        :show-reset-all="false"
      />
    </template>

    <template #content>
      <AppCanvasWorkspace ref="workspaceRef" hide-default-hint @reset="resetView">
        <template #default="{ scale }">
          <div v-if="selectedImage && hasSize" class="relative z-10">
            <MoldBox
              :image-url="selectedImage.preview"
              :image-width="imgW"
              :image-height="imgH"
              :model-value="mold"
              :scale="scale"
              @update:model-value="onMoldDrag"
            />
          </div>
        </template>
        <template #floating>
          <div
            v-if="outOfBounds"
            class="absolute imago-canvas-hud left-1/2 -translate-x-1/2 bottom-16 pointer-events-none z-40"
          >
            <div
              class="px-3 py-1.5 bg-[var(--board)] border border-[var(--hairline)] rounded-lg text-[11px] text-[var(--muted)] font-medium tabular-nums"
            >
              {{
                opaqueFill ? t('tools.moldCut.jpegFillHint') : t('tools.moldCut.outOfBoundsHint')
              }}
            </div>
          </div>
        </template>
      </AppCanvasWorkspace>
    </template>

    <template #sidebar>
      <!-- 模具尺寸 -->
      <section class="space-y-4">
        <AppSectionHeader :title="t('tools.moldCut.moldSize')" :icon="Stamp" />
        <AppSegmentedControl
          :model-value="presetValue"
          :options="presetOptions"
          :aria-label="t('tools.moldCut.moldSize')"
          @update:model-value="handlePreset"
        />
        <div class="flex items-end gap-2 px-1">
          <div class="flex-1 space-y-1">
            <label class="text-[11px] text-[var(--muted)]">{{ t('tools.moldCut.width') }}</label>
            <AppInput
              type="number"
              :model-value="moldW"
              :min="1"
              :max="MAX_MOLD_SIDE"
              @update:model-value="handleW"
            />
          </div>
          <button
            class="w-9 h-9 mb-[1px] flex items-center justify-center rounded-[var(--radius-ctrl)] border border-[var(--hairline)] text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[var(--well)] transition-colors"
            :title="lockRatio ? t('tools.moldCut.unlockRatio') : t('tools.moldCut.lockRatio')"
            :aria-label="lockRatio ? t('tools.moldCut.unlockRatio') : t('tools.moldCut.lockRatio')"
            :aria-pressed="lockRatio"
            @click="toggleLock"
          >
            <component :is="lockRatio ? LinkIcon : Unlink" :size="15" />
          </button>
          <div class="flex-1 space-y-1">
            <label class="text-[11px] text-[var(--muted)]">{{ t('tools.moldCut.height') }}</label>
            <AppInput
              type="number"
              :model-value="moldH"
              :min="1"
              :max="MAX_MOLD_SIDE"
              @update:model-value="handleH"
            />
          </div>
        </div>
        <div class="px-1 font-mono text-[11px] tabular-nums text-[var(--muted)]" aria-live="polite">
          x {{ mold.x }} · y {{ mold.y }} · {{ mold.w }} × {{ mold.h }}
        </div>
        <AppTip v-if="basket.isFull.value" class="mx-1">{{ t('tools.moldCut.basketFull') }}</AppTip>
      </section>

      <!-- 收集篮 -->
      <section class="space-y-4 pt-6 border-t border-[var(--hairline)]">
        <AppSectionHeader
          :title="t('tools.moldCut.basket', { count: basket.count.value })"
          :icon="LayoutGrid"
        />
        <div v-if="basket.count.value === 0" class="px-1 text-[12px] text-[var(--muted)]">
          {{ t('tools.moldCut.basketEmpty') }}
        </div>
        <div v-else class="grid grid-cols-3 gap-2 px-1">
          <div
            v-for="item in basket.items.value"
            :key="item.id"
            class="group relative rounded-[var(--radius-ctrl)] overflow-hidden border border-[var(--hairline)] bg-[var(--well)]"
            :title="item.name"
          >
            <img :src="item.preview" :alt="item.name" class="w-full aspect-square object-contain" />
            <div
              class="px-1.5 py-1 font-mono text-[10px] tabular-nums text-[var(--muted)] truncate"
            >
              {{ item.x }},{{ item.y }}
            </div>
            <button
              class="absolute top-1 right-1 w-6 h-6 items-center justify-center rounded-md bg-[var(--board)] border border-[var(--hairline)] text-[var(--muted)] hover:text-[var(--danger)] hidden group-hover:flex"
              :aria-label="t('tools.moldCut.removeStamp', { name: item.name })"
              @click="basket.removeStamp(item.id)"
            >
              <Trash2 :size="13" />
            </button>
          </div>
        </div>
      </section>

      <AppExportSettings
        v-model:format="outputFormat"
        v-model:quality="outputQuality"
        allow-manual-quality
        canvas-only
        :title="t('common.export.title')"
        class="pt-2 pb-6 border-t border-[var(--hairline)]"
      />
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
          :loading="isStamping"
          :disabled="!canStamp"
          @click="stamp"
        >
          <template #icon><Stamp v-if="!isStamping" :size="18" class="mr-2" /></template>
          {{ t('tools.moldCut.stamp') }}
        </AppButton>
        <AppButton
          size="lg"
          variant="secondary"
          class="rounded-xl"
          :loading="isExporting"
          :disabled="basket.count.value === 0 || isExporting"
          @click="exportBasket"
          :aria-label="t('tools.moldCut.exportZip')"
        >
          <template #icon><Download v-if="!isExporting" :size="17" /></template>
          {{ basket.count.value }}
        </AppButton>
      </InspectorFooter>
    </template>
  </WorkspaceLayout>
</template>
