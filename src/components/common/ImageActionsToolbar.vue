<script setup lang="ts">
import { useImageStore } from '../../stores/imageStore'
import { useFileHelpers } from '../../composables/useFileHelpers'
import AppButton from './AppButton.vue'
import { Plus, Trash2, X } from 'lucide-vue-next'

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
</script>

<template>
  <div class="flex items-center gap-1.5 md:gap-2">
    <input
      type="file"
      ref="fileInput"
      multiple
      accept="image/*"
      @change="handleFileChange"
      class="hidden"
    />

    <AppButton variant="secondary" size="md" @click="triggerFileInput">
      <template #icon><Plus :size="16" class="mr-1.5" /></template>
      添加图片
    </AppButton>

    <AppButton
      v-if="showDeleteSelected"
      variant="danger"
      size="md"
      :disabled="!store.selectedCount || isProcessing"
      @click="store.removeSelected"
    >
      <template #icon><Trash2 :size="16" class="mr-1.5" /></template>
      删除选中
    </AppButton>

    <AppButton
      v-if="showClearAll"
      variant="secondary"
      size="md"
      :disabled="isProcessing"
      @click="store.clearImages"
    >
      <template #icon><X :size="16" class="mr-1.5" /></template>
      清空全部
    </AppButton>

    <!-- 允许插入额外的操作，如“处理全部” -->
    <slot name="extra"></slot>
  </div>
</template>
