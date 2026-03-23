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
        aria-label="撤销"
        class="flex items-center justify-center w-8 h-8 min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
        aria-label="重做"
        class="flex items-center justify-center w-8 h-8 min-h-[44px] min-w-[44px] md:min-h-0 md:min-w-0 rounded-lg transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
