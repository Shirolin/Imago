<script setup lang="ts">
import { ZoomIn, ZoomOut, Maximize } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

interface Props {
  scale: number
}

const props = defineProps<Props>()
const emit = defineEmits(['zoomIn', 'zoomOut', 'reset', 'zoom100', 'update:scale'])
const { t } = useI18n()

const handleZoomIn = () => emit('zoomIn')
const handleZoomOut = () => emit('zoomOut')
const handleReset = () => emit('reset')
const handleZoom100 = () => emit('zoom100')
</script>

<template>
  <div
    class="flex items-center gap-1 p-1 bg-[var(--chrome)] border border-[color-mix(in_srgb,var(--ink)_12%,transparent)] rounded-[var(--radius)]"
  >
    <button
      @click="handleZoomOut"
      :aria-label="t('common.ui.zoomOut')"
      class="w-10 h-10 min-h-10 min-w-10 flex items-center justify-center rounded-[var(--radius)] text-[var(--ink)] hover:bg-secondary outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
    >
      <ZoomOut :size="16" />
    </button>
    <div class="px-2 min-w-[50px] text-center text-[10px] tabular-nums text-[var(--ink)]">
      {{ Math.round(props.scale * 100) }}%
    </div>
    <button
      @click="handleZoomIn"
      :aria-label="t('common.ui.zoomIn')"
      class="w-10 h-10 min-h-10 min-w-10 flex items-center justify-center rounded-[var(--radius)] text-[var(--ink)] hover:bg-secondary outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
    >
      <ZoomIn :size="16" />
    </button>
    <div class="w-px h-4 bg-[color-mix(in_srgb,var(--ink)_12%,transparent)] mx-1"></div>
    <button
      @click="handleZoom100"
      :aria-label="t('common.ui.oneToOne')"
      class="h-10 min-h-10 min-w-10 px-3 rounded-[var(--radius-ctrl)] hover:bg-secondary text-[10px] tabular-nums text-[var(--ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
    >
      1:1
    </button>
    <button
      @click="handleReset"
      :aria-label="t('common.ui.fitScreen')"
      :title="t('common.ui.fitScreen')"
      class="w-10 h-10 min-h-10 min-w-10 flex items-center justify-center rounded-[var(--radius)] text-[var(--accent)] hover:bg-secondary outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
    >
      <Maximize :size="16" />
    </button>
  </div>
</template>
