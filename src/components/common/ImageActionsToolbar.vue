<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { useImageStore } from '../../stores/imageStore'
import { useLayoutStore } from '../../stores/layoutStore'
import { useFileHelpers } from '../../composables/useFileHelpers'
import { getViewConfig } from '../../lib/ui-config'
import AppModal from './AppModal.vue'
import AppButton from './AppButton.vue'
import {
  Download,
  RotateCcw,
  Trash2,
  Plus,
  AlertCircle,
  LayoutGrid,
  LayoutList
} from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    viewId: string
    isProcessing?: boolean
    showDownloadAll?: boolean
    showResetAll?: boolean
    showDeleteSelected?: boolean
    showClearAll?: boolean
    /** 是否显示卡片尺寸切换按钮。无卡片网格的视图（如 Combine）传 false 隐藏 */
    showLayoutToggle?: boolean
  }>(),
  {
    isProcessing: false,
    showDownloadAll: true,
    showResetAll: true,
    showDeleteSelected: true,
    showClearAll: true,
    showLayoutToggle: true
  }
)

const store = useImageStore()
const layoutStore = useLayoutStore()
const { downloadAllAsZip, triggerFileInput } = useFileHelpers()
const { t } = useI18n()

const showConfirm = ref(false)
const confirmMode = ref<'clear' | 'delete' | 'reset'>('clear')

const openConfirm = (mode: 'clear' | 'delete' | 'reset') => {
  confirmMode.value = mode
  showConfirm.value = true
}

const handleRemoveAction = () => {
  if (store.selectedCount > 0) {
    openConfirm('delete')
  } else if (store.images.length > 0) {
    openConfirm('clear')
  }
}

const emit = defineEmits(['reset-all'])

const isBusy = computed(() => props.isProcessing || store.processingCount > 0)
const layoutToggleVisible = computed(() => {
  if (getViewConfig(props.viewId)?.features.showLayoutToggle === false) return false
  return props.showLayoutToggle
})

const handleConfirm = () => {
  if (confirmMode.value === 'clear') {
    store.clearImages()
  } else if (confirmMode.value === 'delete') {
    store.removeSelected()
  } else {
    emit('reset-all')
    store.images.forEach((img) => {
      store.updateImage(img.id, { status: 'idle', error: undefined, progress: 0 })
    })
  }
  showConfirm.value = false
}
</script>

<template>
  <div class="flex min-h-10 items-center gap-2 md:gap-3">
    <div
      class="flex h-10 items-center gap-0.5 bg-[var(--well)] px-0.5 rounded-[var(--radius-ctrl)] ring-1 ring-inset ring-[var(--hairline)]"
    >
      <template v-if="layoutToggleVisible">
        <button
          @click="
            layoutStore.cardSizeMode = layoutStore.cardSizeMode === 'compact' ? 'large' : 'compact'
          "
          class="min-h-10 min-w-10 w-10 h-10 flex items-center justify-center rounded-[var(--radius-ctrl)] hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] text-muted-foreground hover:text-foreground transition-colors shrink-0"
          :aria-label="
            layoutStore.cardSizeMode === 'compact'
              ? t('common.image.toolbar.layoutLarge')
              : t('common.image.toolbar.layoutCompact')
          "
          :title="
            layoutStore.cardSizeMode === 'compact'
              ? t('common.image.toolbar.layoutLarge')
              : t('common.image.toolbar.layoutCompact')
          "
        >
          <component
            :is="layoutStore.cardSizeMode === 'compact' ? LayoutGrid : LayoutList"
            :size="16"
          />
        </button>

        <div class="w-px h-3.5 bg-[var(--hairline)] mx-0.5"></div>
      </template>

      <button
        @click="triggerFileInput"
        class="flex items-center justify-center gap-2 px-2.5 min-h-10 min-w-10 h-10 rounded-[var(--radius-ctrl)] hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
        :aria-label="t('common.image.toolbar.importAria')"
        :title="t('common.image.toolbar.import')"
      >
        <Plus :size="16" class="text-muted-foreground" />
        <span class="hidden md:inline text-[13px] font-medium">{{
          t('common.image.toolbar.import')
        }}</span>
      </button>
    </div>

    <button
      v-if="props.showDownloadAll && store.doneCount > 0"
      @click="downloadAllAsZip(viewId)"
      class="flex items-center gap-2 px-3 md:px-4 min-h-10 h-10 rounded-[var(--radius-ctrl)] bg-[var(--accent)] text-[var(--on-product)] hover:bg-[var(--accent-press)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--paper)] whitespace-nowrap"
      :class="{ 'opacity-50 cursor-not-allowed': isBusy }"
      :disabled="isBusy"
      :aria-label="t('common.image.toolbar.exportAllAria', { count: store.doneCount })"
      :title="t('common.image.toolbar.exportAll')"
    >
      <Download :size="16" />
      <span class="hidden md:inline text-[13px] font-medium">{{
        t('common.image.toolbar.exportAll')
      }}</span>
      <span
        class="ml-0.5 px-1.5 py-0.5 rounded-[4px] bg-[var(--on-product)]/15 text-[11px] font-medium leading-none tabular-spec"
        >{{ store.doneCount }}</span
      >
    </button>

    <div
      v-if="store.images.length > 0"
      class="flex h-10 items-center gap-0.5 bg-[var(--well)] px-0.5 rounded-[var(--radius-ctrl)] ring-1 ring-inset ring-[var(--hairline)]"
    >
      <button
        v-if="props.showResetAll"
        @click="openConfirm('reset')"
        class="min-h-10 min-w-10 w-10 h-10 flex items-center justify-center rounded-[var(--radius-ctrl)] hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] text-muted-foreground hover:text-foreground transition-colors shrink-0"
        :aria-label="t('common.image.toolbar.resetAllAria')"
        :title="t('common.image.toolbar.resetAll')"
        :disabled="isBusy"
      >
        <RotateCcw :size="16" />
      </button>

      <div v-if="props.showResetAll" class="w-px h-3.5 bg-[var(--hairline)] mx-0.5"></div>

      <button
        v-if="props.showDeleteSelected || props.showClearAll"
        @click="handleRemoveAction"
        class="min-h-10 min-w-10 w-10 h-10 flex items-center justify-center rounded-[var(--radius-ctrl)] hover:bg-[var(--danger)]/10 transition-colors shrink-0"
        :class="store.selectedCount > 0 ? 'text-[var(--danger)]' : 'text-muted-foreground'"
        :aria-label="
          store.selectedCount > 0
            ? t('common.image.toolbar.deleteSelectedAria', { count: store.selectedCount })
            : t('common.image.toolbar.clearAllAria')
        "
        :title="
          store.selectedCount > 0
            ? t('common.image.toolbar.deleteSelected')
            : t('common.image.toolbar.clearAll')
        "
        :disabled="isBusy"
      >
        <Trash2
          :size="16"
          :class="store.selectedCount > 0 ? '' : 'opacity-40 group-hover:opacity-100'"
        />
      </button>
    </div>

    <slot name="extra"></slot>

    <AppModal
      :show="showConfirm"
      @close="showConfirm = false"
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
              {{
                confirmMode === 'clear'
                  ? t('common.image.toolbar.confirmClear')
                  : confirmMode === 'delete'
                    ? t('common.image.toolbar.confirmDelete')
                    : t('common.image.toolbar.confirmReset')
              }}
            </h3>
            <p class="text-muted-foreground text-sm leading-relaxed font-medium">
              {{
                confirmMode === 'delete'
                  ? t('common.image.toolbar.confirmDeleteTitle', { count: store.selectedCount })
                  : confirmMode === 'clear'
                    ? t('common.image.toolbar.confirmClearTitle')
                    : t('common.image.toolbar.confirmResetTitle')
              }}
            </p>
            <p class="text-muted-foreground/60 text-[11px] mt-2 italic">
              {{
                confirmMode === 'delete'
                  ? t('common.image.toolbar.confirmDeleteDesc')
                  : confirmMode === 'clear'
                    ? t('common.image.toolbar.confirmClearDesc')
                    : t('common.image.toolbar.confirmResetDesc')
              }}
            </p>
          </div>
        </div>
        <div class="flex gap-3">
          <AppButton variant="ghost" class="flex-1 rounded-xl h-11" @click="showConfirm = false">
            {{ t('common.image.toolbar.cancel') }}
          </AppButton>
          <AppButton
            variant="danger"
            class="flex-1 rounded-[var(--radius-ctrl)] h-11"
            @click="handleConfirm"
          >
            {{ t('common.image.toolbar.confirm') }}
          </AppButton>
        </div>
      </div>
    </AppModal>
  </div>
</template>
