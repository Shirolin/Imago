<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { X } from 'lucide-vue-next'

interface Props {
  show: boolean
  title?: string
}

const props = defineProps<Props>()
const emit = defineEmits(['close', 'after-leave'])

const dialogRef = ref<HTMLDialogElement | null>(null)
const contentReady = ref(false)

// 监听显隐状态，直接操作原生 DOM 开启最高优先级渲染
watch(() => props.show, (newVal) => {
  if (newVal) {
    dialogRef.value?.showModal()
    // 异步加载重型内容，确保弹窗本身先出现
    requestAnimationFrame(() => {
      setTimeout(() => {
        contentReady.value = true
      }, 50)
    })
  } else {
    contentReady.value = false
    dialogRef.value?.close()
    emit('after-leave')
  }
})

onMounted(() => {
  if (props.show) dialogRef.value?.showModal()
})
</script>

<template>
  <Teleport to="body">
    <dialog
      ref="dialogRef"
      class="fixed inset-0 w-full h-full max-w-full max-h-full p-0 bg-transparent border-none outline-none backdrop:bg-background/80 backdrop:backdrop-blur-sm m-0 overflow-hidden"
      @cancel.prevent="emit('close')"
    >
      <div 
        class="w-full h-full flex flex-col p-3 md:p-6"
        style="will-change: opacity; transform: translateZ(0); isolation: isolate;"
      >
        <div class="flex-1 flex flex-col bg-background shadow-2xl overflow-hidden relative border border-border rounded-2xl">
          <!-- Header -->
          <header class="h-14 flex items-center justify-between px-4 border-b border-border shrink-0 bg-card">
            <div class="flex items-center gap-3">
              <slot name="header">
                <h3 class="font-bold text-foreground text-xs uppercase tracking-widest">{{ title }}</h3>
              </slot>
            </div>
            
            <button 
              @click="emit('close')"
              class="w-9 h-9 flex items-center justify-center hover:bg-muted rounded-lg text-muted-foreground transition-colors"
            >
              <X :size="18" />
            </button>
          </header>

          <!-- Main Content -->
          <main class="flex-1 overflow-hidden relative bg-muted/5">
            <slot v-if="contentReady"></slot>
          </main>

          <!-- Footer -->
          <footer v-if="$slots.footer && contentReady" class="h-10 border-t border-border flex items-center justify-center shrink-0 bg-card/30 text-muted-foreground">
            <slot name="footer"></slot>
          </footer>
        </div>
      </div>
    </dialog>
  </Teleport>
</template>

<style scoped>
/* 原生 Dialog 动画优化 */
dialog {
  opacity: 0;
  transition: opacity 0.2s ease-out, display 0.2s allow-discrete;
}

dialog[open] {
  opacity: 1;
}

/* 针对起始状态的平滑处理 */
@starting-style {
  dialog[open] {
    opacity: 0;
  }
}

/* 遮罩层动画 */
dialog::backdrop {
  opacity: 0;
  transition: opacity 0.2s ease-out;
}

dialog[open]::backdrop {
  opacity: 1;
}

@starting-style {
  dialog[open]::backdrop {
    opacity: 0;
  }
}
</style>
