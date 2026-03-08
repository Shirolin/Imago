<script setup lang="ts">
import { useImageStore } from '../../stores/imageStore'
import { useFileHelpers } from '../../composables/useFileHelpers'
import AppButton from './AppButton.vue'
import { Plus, Trash2, X } from 'lucide-vue-next'
import { useBreakpoints } from '../../composables/useBreakpoints'

interface Props {
  showDeleteSelected?: boolean
  showClearAll?: boolean
  isProcessing?: boolean
}

withDefaults(defineProps<Props>(), {
  showDeleteSelected: true,
  showClearAll: false,
  isProcessing: false
})

const store = useImageStore()
const { fileInput, triggerFileInput, handleFileChange } = useFileHelpers()
const { isPC } = useBreakpoints()
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

    <AppButton
      variant="secondary"
      size="md"
      @click="triggerFileInput"
      class="!px-3 md:!px-4 !h-9 md:!h-10"
    >
      <template #icon><Plus :size="16" /></template>
      <span v-if="isPC" class="ml-2">添加图片</span>
    </AppButton>

    <AppButton
      v-if="showDeleteSelected"
      variant="danger"
      size="md"
      :disabled="!store.selectedCount || isProcessing"
      @click="store.removeSelected"
      class="!px-3 md:!px-4 !h-9 md:!h-10"
    >
      <template #icon><Trash2 :size="16" /></template>
      <span v-if="isPC" class="ml-2">删除选中</span>
    </AppButton>

    <AppButton
      v-if="showClearAll"
      variant="secondary"
      size="md"
      :disabled="isProcessing"
      @click="store.clearImages"
      class="!px-3 md:!px-4 !h-9 md:!h-10"
    >
      <template #icon><X :size="16" /></template>
      <span v-if="isPC" class="ml-2">清空全部</span>
    </AppButton>

    <!-- 允许插入额外的操作，如“处理全部” -->
    <slot name="extra"></slot>
  </div>
</template>
