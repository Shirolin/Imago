<script setup lang="ts">
import { ref } from 'vue'
import { useImageStore } from '../../stores/imageStore'
import { useFileHelpers } from '../../composables/useFileHelpers'
import AppButton from './AppButton.vue'
import AppModal from './AppModal.vue'
import { Plus, Trash2, X, AlertTriangle, Download, RotateCcw } from 'lucide-vue-next'
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
  <div class="flex items-center gap-1.5 md:gap-2.5 shrink-0">
    <input
      type="file"
      ref="fileInput"
      multiple
      accept="image/*"
      @change="handleFileChange"
      class="hidden"
    />

    <!-- 1. 核心操作组 (高优先级) -->
    <div class="flex items-center gap-1 md:gap-1.5">
      <AppButton
        variant="secondary"
        size="md"
        @click="triggerFileInput"
        class="!px-2.5 md:!px-3 h-9 md:h-10 text-muted-foreground/80 hover:text-primary transition-all group shrink-0"
        title="添加图片"
      >
        <template #icon><Plus :size="16" class="opacity-60 group-hover:opacity-100" /></template>
        <span class="hidden md:inline text-[0.75rem]">添加图片</span>
      </AppButton>

      <AppButton
        v-if="showDownloadAll && store.doneCount > 0"
        variant="cta"
        size="md"
        :loading="isDownloadingAll"
        @click="downloadAllAsZip(props.zipPrefix)"
        class="!px-2.5 md:!px-3 h-9 md:h-10 shadow-lg shadow-primary/10 transition-all shrink-0"
        title="下载全部"
      >
        <template #icon><Download :size="16" /></template>
        <span class="hidden lg:inline text-[0.75rem]">下载全部 ({{ store.doneCount }})</span>
        <span class="lg:hidden font-mono text-[0.75rem]">{{ store.doneCount }}</span>
      </AppButton>
    </div>

    <div
      v-if="store.images.length > 0"
      class="w-[1px] h-4 bg-border/20 mx-0.5 md:mx-1 shrink-0"
    ></div>

    <!-- 2. 管理操作组 (更加紧凑的折叠) -->
    <div
      v-if="store.images.length > 0"
      class="flex items-center gap-1 md:gap-1 animate-in fade-in slide-in-from-right-2"
    >
      <!-- 恢复原图 -->
      <AppButton
        v-if="store.doneCount > 0"
        variant="ghost"
        size="md"
        :disabled="isProcessing"
        @click="store.resetAll"
        class="h-9 w-9 md:h-10 md:w-10 !p-0 !rounded-lg text-muted-foreground/60 hover:text-primary transition-colors group shrink-0"
        title="恢复原图"
      >
        <template #icon
          ><RotateCcw :size="16" class="opacity-60 group-hover:opacity-100"
        /></template>
        <span class="hidden 2xl:inline ml-2 text-[0.75rem]">恢复原图</span>
      </AppButton>

      <!-- 删除选中 -->
      <AppButton
        v-if="showDeleteSelected && store.selectedCount > 0"
        variant="ghost"
        size="md"
        :disabled="isProcessing"
        @click="openConfirm"
        class="h-9 w-9 md:h-10 md:w-10 !p-0 !rounded-lg text-muted-foreground/60 hover:text-destructive transition-colors group shrink-0"
        title="删除选中"
      >
        <template #icon><Trash2 :size="16" class="opacity-60 group-hover:opacity-100" /></template>
        <span class="hidden 2xl:inline ml-2 text-[0.75rem]">删除选中</span>
      </AppButton>

      <!-- 清空全部 -->
      <AppButton
        v-if="showClearAll"
        variant="ghost"
        size="md"
        :disabled="isProcessing"
        @click="store.clearImages"
        class="h-9 w-9 md:h-10 md:w-10 !p-0 !rounded-lg text-muted-foreground/60 hover:text-destructive transition-colors group shrink-0"
        title="清空全部"
      >
        <template #icon><X :size="16" class="opacity-60 group-hover:opacity-100" /></template>
        <span class="hidden 2xl:inline ml-2 text-[0.75rem]">清空全部</span>
      </AppButton>
    </div>

    <!-- 允许插入额外的操作 -->
    <div class="flex items-center gap-1.5">
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
