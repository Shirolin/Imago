<script setup lang="ts">
import { ref } from 'vue'
import { useImageStore } from '../../stores/imageStore'
import { useFileHelpers } from '../../composables/useFileHelpers'
import AppButton from './AppButton.vue'
import AppModal from './AppModal.vue'
import { Plus, Trash2, X, AlertTriangle, Download, RotateCcw } from 'lucide-vue-next'

interface Props {
  showDeleteSelected?: boolean
  showClearAll?: boolean
  showDownloadAll?: boolean
  isProcessing?: boolean
  zipPrefix?: string
}

const props = withDefaults(defineProps<Props>(), {
  showDeleteSelected: true,
  showClearAll: false,
  showDownloadAll: true,
  isProcessing: false,
  zipPrefix: 'Processed'
})

const store = useImageStore()
const { fileInput, triggerFileInput, handleFileChange, downloadAllAsZip, isDownloadingAll } =
  useFileHelpers()

// 确认框状态
const showConfirm = ref(false)
const confirmMode = ref<'delete' | 'clear'>('delete')

const openConfirm = (mode: 'delete' | 'clear') => {
  confirmMode.value = mode
  showConfirm.value = true
}

const handleConfirmAction = () => {
  if (confirmMode.value === 'delete') {
    store.removeSelected()
  } else {
    store.clearImages()
  }
  showConfirm.value = false
}
</script>

<template>
  <div class="flex items-center gap-2 md:gap-3 shrink-0">
    <input
      type="file"
      ref="fileInput"
      multiple
      accept="image/*"
      @change="handleFileChange"
      class="hidden"
    />

    <!-- 1. 核心操作组 (添加与下载) -->
    <div class="flex items-center gap-1.5 md:gap-2">
      <AppButton
        variant="secondary"
        size="md"
        @click="triggerFileInput"
        class="!px-3 md:!px-4 h-9 md:h-10 text-foreground/80 hover:text-primary transition-all group shrink-0"
        title="导入图片"
        aria-label="从本地选择并导入图片"
      >
        <template #icon>
          <Plus :size="16" class="opacity-70 group-hover:opacity-100 transition-opacity" />
        </template>
        <span class="hidden md:inline text-[0.75rem] font-bold">导入图片</span>
      </AppButton>

      <AppButton
        v-if="showDownloadAll && store.doneCount > 0"
        variant="cta"
        size="md"
        :loading="isDownloadingAll"
        :disabled="isProcessing || isDownloadingAll"
        @click="downloadAllAsZip(props.zipPrefix)"
        class="!px-3 md:!px-4 h-9 md:h-10 transition-all shrink-0"
        title="导出全部"
        :aria-label="`打包并导出全部 ${store.doneCount} 张已处理图片`"
      >
        <template #icon><Download :size="16" /></template>
        <span class="hidden lg:inline text-[0.75rem] font-bold"
          >导出全部 ({{ store.doneCount }})</span
        >
        <span class="lg:hidden font-mono text-[0.75rem] font-bold">{{ store.doneCount }}</span>
      </AppButton>
    </div>

    <!-- 竖向分隔线 -->
    <div v-if="store.images.length > 0" class="w-px h-4 bg-border/40 mx-1 shrink-0"></div>

    <!-- 2. 队列管理组 (恢复、删除、清空) -->
    <div
      v-if="store.images.length > 0"
      class="flex items-center gap-1 animate-in fade-in slide-in-from-right-2 duration-300"
    >
      <!-- 恢复原图 -->
      <AppButton
        v-if="store.doneCount > 0"
        variant="ghost"
        size="md"
        :disabled="isProcessing"
        @click="store.resetAll"
        class="h-9 w-9 md:h-10 md:w-10 !p-0 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all group shrink-0"
        title="恢复原图"
        aria-label="重置所有图片到原始状态"
      >
        <template #icon>
          <RotateCcw :size="16" class="opacity-60 group-hover:opacity-100" />
        </template>
      </AppButton>

      <!-- 删除选中 -->
      <AppButton
        v-if="showDeleteSelected && store.selectedCount > 0"
        variant="ghost"
        size="md"
        :disabled="isProcessing"
        @click="openConfirm('delete')"
        class="h-9 w-9 md:h-10 md:w-10 !p-0 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-all group shrink-0"
        title="删除选中"
        :aria-label="`从队列中移除选中的 ${store.selectedCount} 张图片`"
      >
        <template #icon>
          <Trash2 :size="16" class="opacity-60 group-hover:opacity-100" />
        </template>
      </AppButton>

      <!-- 清空全部 -->
      <AppButton
        v-if="showClearAll"
        variant="ghost"
        size="md"
        :disabled="isProcessing"
        @click="openConfirm('clear')"
        class="h-9 w-9 md:h-10 md:w-10 !p-0 rounded-xl text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-all group shrink-0"
        title="清空全部"
        aria-label="清空当前所有处理队列"
      >
        <template #icon>
          <X :size="16" class="opacity-60 group-hover:opacity-100" />
        </template>
      </AppButton>
    </div>

    <!-- 允许插入额外的操作 -->
    <div class="flex items-center gap-2">
      <slot name="extra"></slot>
    </div>

    <!-- 统一确认对话框 -->
    <AppModal :show="showConfirm" @close="showConfirm = false" title="确认操作" variant="dialog">
      <template #header>
        <div class="flex items-center gap-2 text-destructive">
          <AlertTriangle :size="18" />
          <span class="font-bold text-[0.7rem] uppercase tracking-[0.2em]">{{
            confirmMode === 'clear' ? '清空队列确认' : '删除选中确认'
          }}</span>
        </div>
      </template>

      <div class="p-8 flex flex-col items-center text-center gap-4">
        <div
          class="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center text-destructive mb-2"
        >
          <Trash2 v-if="confirmMode === 'delete'" :size="32" />
          <X v-else :size="32" />
        </div>
        <div class="space-y-1.5">
          <h3 class="text-lg font-black text-foreground leading-tight tracking-tight">
            {{
              confirmMode === 'delete'
                ? `删除选中的 ${store.selectedCount} 张图片？`
                : '确定要清空所有图片吗？'
            }}
          </h3>
          <p class="text-xs text-muted-foreground max-w-[240px] leading-relaxed">
            {{
              confirmMode === 'delete'
                ? '该操作将永久从当前队列中移除选中的文件。'
                : '此操作将移除队列中的所有内容，无法撤销。'
            }}
          </p>
        </div>
      </div>

      <template #footer>
        <div class="flex items-center gap-3 w-full">
          <AppButton variant="secondary" class="flex-1" @click="showConfirm = false">
            取消
          </AppButton>
          <AppButton variant="danger" class="flex-1" @click="handleConfirmAction">
            确认执行
          </AppButton>
        </div>
      </template>
    </AppModal>
  </div>
</template>
