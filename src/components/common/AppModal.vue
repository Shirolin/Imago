<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue'
import { X } from 'lucide-vue-next'

interface Props {
  show: boolean
  title?: string
}

const props = defineProps<Props>()
const emit = defineEmits(['close'])

const contentReady = ref(false)

const toggleScroll = (lock: boolean) => {
  document.body.style.overflow = lock ? 'hidden' : ''
}

// 监听开启状态，并在动画结束后加载内容
watch(() => props.show, (newVal) => {
  if (newVal) {
    toggleScroll(true)
    // 延迟一小会儿渲染内部大图，避开动画最高峰
    setTimeout(() => {
      contentReady.value = true
    }, 250)
  } else {
    contentReady.value = false
    toggleScroll(false)
  }
})

onMounted(() => {
  if (props.show) toggleScroll(true)
})

onUnmounted(() => {
  toggleScroll(false)
})
</script>

<template>
  <Teleport to="body">
    <Transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div 
        v-if="show" 
        class="fixed inset-0 z-[10000] flex flex-col bg-background p-3 md:p-6"
        style="transform: translateZ(0); backface-visibility: hidden;"
      >
        <!-- 核心容器 -->
        <div class="flex-1 flex flex-col bg-background shadow-2xl overflow-hidden relative border border-border rounded-xl md:rounded-2xl">
          
          <!-- Header: 始终保持简单 -->
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

          <!-- Main Content: 仅在 contentReady 后加载重型图片 -->
          <main class="flex-1 overflow-hidden relative">
            <div v-if="!contentReady" class="absolute inset-0 flex items-center justify-center bg-muted/5">
              <div class="w-6 h-6 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
            </div>
            <slot v-if="contentReady"></slot>
          </main>

          <!-- Footer -->
          <footer v-if="$slots.footer && contentReady" class="h-10 border-t border-border flex items-center justify-center shrink-0 bg-card/30">
            <slot name="footer"></slot>
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
