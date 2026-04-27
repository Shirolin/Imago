<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useImageStore } from '../../stores/imageStore'
import { useLayoutStore } from '../../stores/layoutStore'
import { useFileHelpers } from '../../composables/useFileHelpers'
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
  }>(),
  {
    isProcessing: false,
    showDownloadAll: true,
    showResetAll: true,
    showDeleteSelected: true,
    showClearAll: true
  }
)

const store = useImageStore()
const layoutStore = useLayoutStore()
const { downloadAllAsZip, triggerFileInput } = useFileHelpers()
const { t } = useI18n()

// 确认框状态
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

const handleConfirm = () => {
  if (confirmMode.value === 'clear') {
    store.clearImages()
  } else if (confirmMode.value === 'delete') {
    store.removeSelected()
  } else {
    store.resetAll()
  }
  showConfirm.value = false
}
</script>

<template>
  <div
    class="flex items-center gap-2 md:gap-3 bg-card/60 backdrop-blur-md px-1.5 py-1 rounded-2xl border border-border/50 shadow-inner-glow"
  >
    <!-- 1. 视图与导入组 -->
    <div class="flex items-center bg-muted/20 p-0.5 rounded-xl border border-border/20">
      <!-- 布局切换 -->
      <button
        @click="
          layoutStore.cardSizeMode = layoutStore.cardSizeMode === 'compact' ? 'large' : 'compact'
        "
        class="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-background hover:shadow-sm text-muted-foreground hover:text-primary transition-all duration-200 active:scale-90 group shrink-0"
        :aria-label="
          layoutStore.cardSizeMode === 'compact'
            ? t('common.image.toolbar.layoutLarge')
            : t('common.image.toolbar.layoutCompact')
        "
      >
        <component
          :is="layoutStore.cardSizeMode === 'compact' ? LayoutGrid : LayoutList"
          :size="16"
          class="transition-colors"
        />
      </button>

      <div class="w-px h-4 bg-border/40 mx-1"></div>

      <!-- 导入 -->
      <button
        @click="triggerFileInput"
        class="flex items-center justify-center gap-2 px-3 h-9 rounded-xl hover:bg-background hover:shadow-sm text-muted-foreground hover:text-primary transition-all duration-200 active:scale-95 group whitespace-nowrap"
        :aria-label="t('common.image.toolbar.importAria')"
      >
        <Plus
          :size="16"
          class="text-muted-foreground/60 group-hover:text-primary transition-colors"
        />
        <span class="hidden md:inline text-[0.7rem] font-bold tracking-tight">{{
          t('common.image.toolbar.import')
        }}</span>
      </button>
    </div>

    <!-- 2. 全部导出 (核心动作) -->
    <button
      v-if="props.showDownloadAll && store.doneCount > 0"
      @click="downloadAllAsZip(viewId)"
      class="flex items-center gap-2 px-4 md:px-5 h-10 rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:scale-[1.02] hover:shadow-primary/30 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background active:scale-95 whitespace-nowrap"
      :class="{ 'opacity-50 cursor-not-allowed grayscale-[0.3]': isProcessing }"
      :disabled="isProcessing"
      :aria-label="t('common.image.toolbar.exportAllAria', { count: store.doneCount })"
    >
      <Download :size="16" class="animate-in zoom-in duration-300" />
      <span class="text-[0.7rem] md:text-[0.75rem] font-black tracking-tight uppercase">{{
        t('common.image.toolbar.exportAll')
      }}</span>
      <span
        class="ml-0.5 px-1.5 py-0.5 rounded-md bg-white/20 text-[0.65rem] font-black leading-none"
        >{{ store.doneCount }}</span
      >
    </button>

    <!-- 3. 队列管理组 -->
    <div
      v-if="store.images.length > 0"
      class="flex items-center bg-muted/40 p-1 rounded-2xl border border-border/40 shadow-inner-sm"
    >
      <!-- 恢复原图 -->
      <button
        v-if="props.showResetAll"
        @click="openConfirm('reset')"
        class="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-background hover:shadow-sm text-muted-foreground hover:text-primary transition-all duration-200 active:scale-90 group shrink-0"
        :aria-label="t('common.image.toolbar.resetAllAria')"
      >
        <RotateCcw
          :size="16"
          class="group-hover:text-primary group-hover:rotate-[-45deg] transition-all duration-300"
        />
      </button>

      <div v-if="props.showResetAll" class="w-px h-4 bg-border/40 mx-1"></div>

      <!-- 删除/清空 -->
      <button
        v-if="props.showDeleteSelected || props.showClearAll"
        @click="handleRemoveAction"
        class="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-destructive/5 hover:shadow-sm transition-all duration-200 active:scale-90 shrink-0 group"
        :class="store.selectedCount > 0 ? 'text-destructive' : 'text-muted-foreground'"
        :title="
          store.selectedCount > 0
            ? t('common.image.toolbar.deleteSelected')
            : t('common.image.toolbar.clearAll')
        "
      >
        <Trash2
          :size="16"
          class="transition-colors group-hover:text-destructive"
          :class="store.selectedCount > 0 ? '' : 'opacity-40 group-hover:opacity-100'"
        />
      </button>
    </div>

    <!-- 允许插入额外的操作 -->
    <slot name="extra"></slot>

    <!-- 统一确认对话框 -->
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
            <h3 class="text-lg font-black text-foreground mb-1 tracking-tight">
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
            class="flex-1 rounded-xl h-11 shadow-lg shadow-destructive/10"
            @click="handleConfirm"
          >
            {{ t('common.image.toolbar.confirm') }}
          </AppButton>
        </div>
      </div>
    </AppModal>
  </div>
</template>
