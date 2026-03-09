<script setup lang="ts">
import { ref, watch, onMounted, computed } from 'vue'
import { X } from 'lucide-vue-next'

interface Props {
  show: boolean
  title?: string
  variant?: 'full' | 'dialog' // 增加变体支持
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'full'
})

const emit = defineEmits(['close', 'after-leave'])

const dialogRef = ref<HTMLDialogElement | null>(null)
const contentReady = ref(false)

// 计算容器样式类
const containerClasses = computed(() => {
  if (props.variant === 'dialog') {
    return 'w-[90vw] max-w-md h-auto my-auto mx-auto rounded-3xl shadow-2xl border border-border bg-background flex flex-col overflow-hidden'
  }
  return 'w-full h-full flex flex-col p-3 md:p-6'
})

watch(
  () => props.show,
  (newVal) => {
    if (newVal) {
      dialogRef.value?.showModal()
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
  }
)

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
      <!-- 对话框模式：居中卡片 -->
      <div v-if="variant === 'dialog'" class="w-full h-full flex items-center justify-center p-4">
        <div :class="containerClasses" style="transform: translateZ(0)">
          <header
            class="h-14 flex items-center justify-between px-6 border-b border-border shrink-0 bg-card"
          >
            <slot name="header">
              <h3 class="font-bold text-foreground text-xs uppercase tracking-widest">
                {{ title }}
              </h3>
            </slot>
            <button
              @click="emit('close')"
              class="text-muted-foreground hover:text-foreground transition-colors"
            >
              <X :size="18" />
            </button>
          </header>

          <main class="overflow-y-auto">
            <slot></slot>
          </main>

          <footer v-if="$slots.footer" class="p-4 border-t border-border bg-card/30">
            <slot name="footer"></slot>
          </footer>
        </div>
      </div>

      <!-- 全屏模式：原有逻辑 -->
      <div
        v-else
        class="w-full h-full flex flex-col p-3 md:p-6"
        style="transform: translateZ(0); isolation: isolate"
      >
        <div
          class="flex-1 flex flex-col bg-background shadow-2xl overflow-hidden relative border border-border rounded-2xl"
        >
          <header
            class="h-14 flex items-center justify-between px-4 border-b border-border shrink-0 bg-card"
          >
            <div class="flex items-center gap-3">
              <slot name="header">
                <h3 class="font-bold text-foreground text-xs uppercase tracking-widest">
                  {{ title }}
                </h3>
              </slot>
            </div>
            <button
              @click="emit('close')"
              class="w-9 h-9 flex items-center justify-center hover:bg-muted rounded-lg text-muted-foreground transition-colors"
            >
              <X :size="18" />
            </button>
          </header>

          <main class="flex-1 overflow-hidden relative bg-muted/5">
            <slot v-if="contentReady"></slot>
          </main>

          <footer
            v-if="$slots.footer && contentReady"
            class="h-10 border-t border-border flex items-center justify-center shrink-0 bg-card/30"
          >
            <slot name="footer"></slot>
          </footer>
        </div>
      </div>
    </dialog>
  </Teleport>
</template>

<style scoped>
dialog {
  opacity: 0;
  transition:
    opacity 0.2s ease-out,
    display 0.2s allow-discrete;
}
dialog[open] {
  opacity: 1;
}
@starting-style {
  dialog[open] {
    opacity: 0;
  }
}
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
