<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'

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
  LayoutList,
  Ellipsis,
  CheckSquare,
  MinusSquare,
  Square,
  Check
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

const moreOpen = ref(false)

const moreRef = ref<HTMLElement | null>(null)

const openConfirm = (mode: 'clear' | 'delete' | 'reset') => {
  confirmMode.value = mode

  showConfirm.value = true

  moreOpen.value = false
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

const showCompactMore = computed(() => store.images.length > 0)

const selectionLabel = computed(() =>
  store.isAllSelected
    ? t('common.image.selection.deselectAll')
    : t('common.image.selection.selectAll')
)

const selectionIcon = computed(() => {
  if (store.isAllSelected) return CheckSquare

  if (store.selectedCount > 0) return MinusSquare

  return Square
})

const removeMenuLabel = computed(() =>
  store.selectedCount > 0
    ? t('common.image.toolbar.deleteSelected')
    : t('common.image.toolbar.clearAll')
)

const showRemoveInMenu = computed(() => props.showDeleteSelected || props.showClearAll)

const toggleMore = () => {
  moreOpen.value = !moreOpen.value
}

const closeMore = () => {
  moreOpen.value = false
}

const handleSelectAll = () => {
  store.toggleAll()

  closeMore()
}

const handleResetFromMenu = () => {
  openConfirm('reset')
}

const handleRemoveFromMenu = () => {
  handleRemoveAction()
}

const setCardSizeMode = (mode: 'compact' | 'large') => {
  layoutStore.cardSizeMode = mode

  closeMore()
}

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

const handleClickOutside = (event: MouseEvent) => {
  if (moreRef.value && !moreRef.value.contains(event.target as Node)) {
    closeMore()
  }
}

const handleEscape = (event: KeyboardEvent) => {
  if (event.key === 'Escape') closeMore()
}

onMounted(() => {
  document.addEventListener('click', handleClickOutside)

  document.addEventListener('keydown', handleEscape)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)

  document.removeEventListener('keydown', handleEscape)
})
</script>

<template>
  <div class="flex min-h-10 shrink-0 items-center gap-1.5 md:gap-3">
    <div
      class="flex h-10 items-center gap-0.5 bg-[var(--well)] px-0.5 rounded-[var(--radius-ctrl)] ring-1 ring-inset ring-[var(--hairline)]"
    >
      <template v-if="layoutToggleVisible">
        <button
          @click="
            layoutStore.cardSizeMode = layoutStore.cardSizeMode === 'compact' ? 'large' : 'compact'
          "
          class="hidden sm:flex min-h-10 min-w-10 w-10 h-10 items-center justify-center rounded-[var(--radius-ctrl)] hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] text-muted-foreground hover:text-foreground transition-colors shrink-0"
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

        <div class="hidden sm:block w-px h-3.5 bg-[var(--hairline)] mx-0.5"></div>
      </template>

      <button
        @click="triggerFileInput"
        class="flex items-center justify-center gap-2 px-2.5 min-h-10 min-w-10 h-10 rounded-[var(--radius-ctrl)] hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
        :aria-label="t('common.image.toolbar.importAria')"
        :title="t('common.image.toolbar.import')"
      >
        <Plus :size="16" class="text-muted-foreground" />

        <span class="hidden lg:inline text-[13px] font-medium">{{
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

    <!-- Compact: overflow actions in More menu (< sm) -->

    <div v-if="showCompactMore" ref="moreRef" class="relative sm:hidden">
      <button
        type="button"
        class="flex h-10 min-h-10 min-w-10 w-10 items-center justify-center rounded-[var(--radius-ctrl)] bg-[var(--well)] text-muted-foreground ring-1 ring-inset ring-[var(--hairline)] hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] hover:text-foreground transition-colors shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        :aria-label="t('common.image.toolbar.moreAria')"
        :title="t('common.image.toolbar.more')"
        aria-haspopup="menu"
        :aria-expanded="moreOpen"
        @click.stop="toggleMore"
      >
        <Ellipsis :size="16" />
      </button>

      <transition
        enter-active-class="transition duration-150 ease-out"
        enter-from-class="opacity-0 translate-y-1 scale-95"
        enter-to-class="opacity-100 translate-y-0 scale-100"
        leave-active-class="transition duration-100 ease-in"
        leave-from-class="opacity-100 translate-y-0 scale-100"
        leave-to-class="opacity-0 translate-y-1 scale-95"
      >
        <div
          v-if="moreOpen"
          role="menu"
          class="absolute right-0 top-[calc(100%+4px)] z-[120] min-w-[11rem] overflow-hidden rounded-[var(--radius-ctrl)] border border-[var(--hairline)] bg-[var(--well)] py-1 shadow-[0_1px_2px_rgba(20,20,19,0.06)]"
          @click.stop
        >
          <button
            type="button"
            role="menuitem"
            class="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] font-medium text-foreground hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] transition-colors"
            @click="handleSelectAll"
          >
            <component :is="selectionIcon" :size="14" class="shrink-0 text-muted-foreground" />

            <span>{{ selectionLabel }}</span>
          </button>

          <template v-if="layoutToggleVisible">
            <div class="my-1 h-px bg-[var(--hairline)]" role="separator" />

            <button
              type="button"
              role="menuitemradio"
              :aria-checked="layoutStore.cardSizeMode === 'large'"
              class="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] font-medium transition-colors hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)]"
              :class="
                layoutStore.cardSizeMode === 'large' ? 'text-foreground' : 'text-muted-foreground'
              "
              @click="setCardSizeMode('large')"
            >
              <LayoutGrid :size="14" class="shrink-0" />

              <span class="flex-1">{{ t('common.image.toolbar.layoutLarge') }}</span>

              <Check
                v-if="layoutStore.cardSizeMode === 'large'"
                :size="14"
                class="shrink-0 text-[var(--accent)]"
              />
            </button>

            <button
              type="button"
              role="menuitemradio"
              :aria-checked="layoutStore.cardSizeMode === 'compact'"
              class="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] font-medium transition-colors hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)]"
              :class="
                layoutStore.cardSizeMode === 'compact' ? 'text-foreground' : 'text-muted-foreground'
              "
              @click="setCardSizeMode('compact')"
            >
              <LayoutList :size="14" class="shrink-0" />

              <span class="flex-1">{{ t('common.image.toolbar.layoutCompact') }}</span>

              <Check
                v-if="layoutStore.cardSizeMode === 'compact'"
                :size="14"
                class="shrink-0 text-[var(--accent)]"
              />
            </button>
          </template>

          <button
            v-if="props.showResetAll"
            type="button"
            role="menuitem"
            class="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] font-medium text-foreground hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] transition-colors disabled:opacity-50 disabled:pointer-events-none"
            :disabled="isBusy"
            @click="handleResetFromMenu"
          >
            <RotateCcw :size="14" class="shrink-0 text-muted-foreground" />

            <span>{{ t('common.image.toolbar.resetAll') }}</span>
          </button>

          <button
            v-if="showRemoveInMenu"
            type="button"
            role="menuitem"
            class="flex w-full items-center gap-2.5 px-3 py-2.5 text-left text-[13px] font-medium text-[var(--danger)] hover:bg-[var(--danger)]/10 transition-colors disabled:opacity-50 disabled:pointer-events-none"
            :disabled="isBusy"
            @click="handleRemoveFromMenu"
          >
            <Trash2 :size="14" class="shrink-0" />

            <span>{{ removeMenuLabel }}</span>
          </button>
        </div>
      </transition>
    </div>

    <!-- Dense: reset + trash in bar (≥ sm) -->

    <div
      v-if="store.images.length > 0"
      class="hidden sm:flex h-10 items-center gap-0.5 bg-[var(--well)] px-0.5 rounded-[var(--radius-ctrl)] ring-1 ring-inset ring-[var(--hairline)]"
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
        v-if="showRemoveInMenu"
        @click="handleRemoveAction"
        class="min-h-10 min-w-10 w-10 h-10 flex items-center justify-center rounded-[var(--radius-ctrl)] text-muted-foreground hover:bg-[var(--danger)]/10 hover:text-[var(--danger)] focus-visible:bg-[var(--danger)]/10 focus-visible:text-[var(--danger)] transition-colors shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-[var(--danger)]"
        :aria-label="
          store.selectedCount > 0
            ? t('common.image.toolbar.deleteSelectedAria', { count: store.selectedCount })
            : t('common.image.toolbar.clearAllAria')
        "
        :title="removeMenuLabel"
        :disabled="isBusy"
      >
        <Trash2 :size="16" />
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
