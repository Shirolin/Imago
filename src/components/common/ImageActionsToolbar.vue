<script setup lang="ts">
import { ref } from 'vue'
import { useImageStore } from '../../stores/imageStore'
import { useFileHelpers } from '../../composables/useFileHelpers'
import AppButton from './AppButton.vue'
import AppModal from './AppModal.vue'
import { Plus, Trash2, X, AlertTriangle, Download } from 'lucide-vue-next'
import { useBreakpoints } from '../../composables/useBreakpoints'

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
const { isPC } = useBreakpoints()

// 确认框状态
const showConfirm = ref(false)

const openConfirm = () => {
  if (store.selectedCount > 0) {
    showConfirm.value = true
  }
}

const handleConfirmDelete = () => {
  store.removeSelected()
  showConfirm.value = false
}
</script>

<template>
  <div class="flex items-center gap-1 md:gap-2">
    <input
      type="file"
      ref="fileInput"
      multiple
      accept="image/*"
      @change="handleFileChange"
      class="hidden"
    />

    <!-- 1. 添加图片按钮 -->
    <AppButton
      variant="secondary"
      size="md"
      @click="triggerFileInput"
      class="!px-3 md:!px-4 !h-9 md:!h-10 animate-in fade-in slide-in-from-right-4 duration-500 fill-mode-both"
    >
      <template #icon><Plus :size="16" /></template>
      <span v-if="isPC" class="ml-2">添加图片</span>
    </AppButton>

    <!-- 2. 打包下载按钮 (带交错延迟) -->
    <AppButton
      v-if="showDownloadAll && store.doneCount > 0"
      variant="cta"
      size="md"
      :loading="isDownloadingAll"
      @click="downloadAllAsZip(props.zipPrefix)"
      class="!px-3 md:!px-4 !h-9 md:!h-10 animate-in fade-in slide-in-from-right-4 duration-500 delay-75 fill-mode-both"
    >
      <template #icon><Download :size="16" /></template>
      <span v-if="isPC" class="ml-2">下载全部 ({{ store.doneCount }})</span>
    </AppButton>

    <!-- 3. 删除选中按钮 (带交错延迟) -->
    <AppButton
      v-if="showDeleteSelected"
      variant="danger"
      size="md"
      :disabled="!store.selectedCount || isProcessing"
      @click="openConfirm"
      class="!px-3 md:!px-4 !h-9 md:!h-10 animate-in fade-in slide-in-from-right-4 duration-500 delay-100 fill-mode-both"
    >
      <template #icon><Trash2 :size="16" /></template>
      <span v-if="isPC" class="ml-2">删除选中</span>
    </AppButton>

    <!-- 4. 清空全部按钮 (带交错延迟) -->
    <AppButton
      v-if="showClearAll"
      variant="secondary"
      size="md"
      :disabled="isProcessing"
      @click="store.clearImages"
      class="!px-3 md:!px-4 !h-9 md:!h-10 animate-in fade-in slide-in-from-right-4 duration-500 delay-150 fill-mode-both"
    >
      <template #icon><X :size="16" /></template>
      <span v-if="isPC" class="ml-2">清空全部</span>
    </AppButton>

    <!-- 允许插入额外的操作 -->
    <div class="animate-in fade-in slide-in-from-right-4 duration-500 delay-200 fill-mode-both">
      <slot name="extra"></slot>
    </div>

    <!-- 删除确认对话框 -->
    <AppModal :show="showConfirm" @close="showConfirm = false" title="确认操作" variant="dialog">
      <template #header>
        <div class="flex items-center gap-2 text-destructive">
          <AlertTriangle :size="18" />
          <span class="font-bold text-sm uppercase tracking-widest">危险操作确认</span>
        </div>
      </template>

      <div class="p-8 flex flex-col items-center text-center gap-4">
        <div
          class="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center text-destructive mb-2"
        >
          <Trash2 :size="32" />
        </div>
        <div class="space-y-1">
          <h3 class="text-lg font-bold text-foreground leading-tight">
            删除选中的 {{ store.selectedCount }} 张图片？
          </h3>
          <p class="text-sm text-muted-foreground">该操作将永久从当前队列中移除这些文件。</p>
        </div>
      </div>

      <template #footer>
        <div class="flex items-center gap-3 w-full px-6">
          <AppButton variant="secondary" class="flex-1" @click="showConfirm = false">
            取消
          </AppButton>
          <AppButton variant="danger" class="flex-1" @click="handleConfirmDelete">
            确认删除
          </AppButton>
        </div>
      </template>
    </AppModal>
  </div>
</template>
