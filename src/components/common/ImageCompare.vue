<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Zap, ChevronsLeftRight, Loader2 } from 'lucide-vue-next'

interface Props {
  originalUrl: string
  processedUrl: string
  originalSize: string
  processedSize: string
}

const props = defineProps<Props>()

const sliderPos = ref(50)
const isResizing = ref(false)
const container = ref<HTMLElement | null>(null)
const isDecoding = ref(true)

const preloadImages = async () => {
  isDecoding.value = true
  try {
    const img1 = new Image(); const img2 = new Image()
    img1.src = props.originalUrl; img2.src = props.processedUrl
    await Promise.all([img1.decode(), img2.decode()])
    isDecoding.value = false
  } catch (e) {
    isDecoding.value = false
  }
}

const handleMove = (e: MouseEvent | TouchEvent) => {
  if (!isResizing.value || !container.value) return
  const rect = container.value.getBoundingClientRect()
  const x = 'touches' in e ? e.touches[0].clientX : e.clientX
  sliderPos.value = Math.max(0, Math.min(100, ((x - rect.left) / rect.width) * 100))
}

onMounted(() => {
  preloadImages()
  window.addEventListener('mousemove', handleMove, { passive: true })
  window.addEventListener('mouseup', () => isResizing.value = false)
  window.addEventListener('touchmove', handleMove, { passive: false })
  window.addEventListener('touchend', () => isResizing.value = false)
})
</script>

<template>
  <div class="w-full h-full flex flex-col bg-muted/10 relative overflow-hidden">
    <div v-if="isDecoding" class="absolute inset-0 z-50 flex flex-col items-center justify-center bg-background/80">
      <Loader2 class="w-8 h-8 text-primary animate-spin" />
      <span class="mt-3 text-[0.65rem] font-bold text-muted-foreground uppercase tracking-widest">准备高清预览...</span>
    </div>

    <div class="flex-1 relative flex items-center justify-center p-2 md:p-8">
      <div 
        class="w-full h-full max-w-7xl relative rounded-xl overflow-hidden border border-border bg-card shadow-lg" 
        :class="isDecoding ? 'invisible' : 'visible'"
        ref="container"
      >
        <!-- 下层 -->
        <img :src="processedUrl" class="absolute inset-0 w-full h-full object-contain p-2 md:p-4" alt="After" />
        
        <!-- 上层 -->
        <div 
          class="absolute inset-0 w-full h-full overflow-hidden border-r-2 border-primary/50"
          :style="{ clipPath: `inset(0 ${100 - sliderPos}% 0 0)` }"
        >
          <img :src="originalUrl" class="absolute inset-0 w-full h-full object-contain p-2 md:p-4 bg-background" alt="Before" />
        </div>

        <!-- 滑块 -->
        <div 
          class="absolute inset-y-0 z-40 w-10 -ml-5 cursor-col-resize flex items-center justify-center"
          :style="{ left: `${sliderPos}%` }"
          @mousedown="isResizing = true"
          @touchstart="isResizing = true"
        >
          <div class="w-9 h-9 bg-primary text-primary-foreground rounded-full shadow-xl flex items-center justify-center ring-4 ring-primary/10">
            <ChevronsLeftRight :size="18" />
          </div>
        </div>

        <!-- 标签 -->
        <div class="absolute bottom-4 left-4 z-10 px-2 py-1 bg-background/90 border border-border rounded-lg shadow-sm flex flex-col pointer-events-none">
          <span class="text-[0.5rem] font-bold text-primary uppercase">Before</span>
          <span class="text-[0.7rem] font-black tabular-nums">{{ originalSize }}</span>
        </div>

        <div class="absolute bottom-4 right-4 z-10 px-2 py-1 bg-primary text-primary-foreground rounded-lg shadow-sm flex flex-col text-right pointer-events-none">
          <span class="text-[0.5rem] font-bold opacity-80 uppercase">After</span>
          <span class="text-[0.7rem] font-black tabular-nums">{{ processedSize }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
