<script setup lang="ts">
import { Undo2, Redo2 } from 'lucide-vue-next'

interface Props {
  canUndo?: boolean
  canRedo?: boolean
}

defineProps<Props>()
const emit = defineEmits(['undo', 'redo'])
</script>

<template>
  <div class="flex items-center justify-between w-full h-8">
    <div class="flex items-center gap-1.5">
      <button
        @click="emit('undo')"
        :disabled="!canUndo"
        title="撤销 (Ctrl+Z)"
        class="flex items-center justify-center w-8 h-8 rounded-lg transition-all"
        :class="
          canUndo
            ? 'text-foreground hover:bg-muted active:scale-90'
            : 'text-muted-foreground/30 cursor-not-allowed'
        "
      >
        <Undo2 :size="16" />
      </button>

      <button
        @click="emit('redo')"
        :disabled="!canRedo"
        title="重做 (Ctrl+Y)"
        class="flex items-center justify-center w-8 h-8 rounded-lg transition-all"
        :class="
          canRedo
            ? 'text-foreground hover:bg-muted active:scale-90'
            : 'text-muted-foreground/30 cursor-not-allowed'
        "
      >
        <Redo2 :size="16" />
      </button>
    </div>

    <!-- 右侧可以留给其它快捷信息 -->
    <slot name="right"></slot>
  </div>
</template>
