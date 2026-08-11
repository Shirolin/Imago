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
    class="flex items-center gap-1 p-1 bg-background/90 backdrop-blur border border-border/60 rounded-2xl shadow-lg"
  >
    <button
      @click="handleZoomOut"
      :aria-label="t('common.ui.zoomOut')"
      class="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted active:scale-90 transition-all"
    >
      <ZoomOut :size="16" />
    </button>
    <div class="px-2 min-w-[50px] text-center font-mono text-[10px] font-bold">
      {{ Math.round(props.scale * 100) }}%
    </div>
    <button
      @click="handleZoomIn"
      :aria-label="t('common.ui.zoomIn')"
      class="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-muted active:scale-90 transition-all"
    >
      <ZoomIn :size="16" />
    </button>
    <div class="w-px h-4 bg-border/20 mx-1"></div>
    <button
      @click="handleZoom100"
      :aria-label="t('common.ui.oneToOne')"
      class="h-9 px-3 rounded-xl hover:bg-muted text-[10px] font-bold uppercase tracking-widest active:scale-95 transition-all"
    >
      1:1
    </button>
    <button
      @click="handleReset"
      :aria-label="t('common.ui.fitScreen')"
      :title="t('common.ui.fitScreen')"
      class="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-primary/10 text-primary active:scale-90 transition-all"
    >
      <Maximize :size="16" />
    </button>
  </div>
</template>
