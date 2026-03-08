<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Zap, ChevronsLeftRight } from 'lucide-vue-next'

interface Props {
  originalUrl: string
  processedUrl: string
  originalSize: string
  processedSize: string
}

defineProps<Props>()

const sliderPos = ref(50)
const isResizing = ref(false)
const container = ref<HTMLElement | null>(null)

const handleMove = (e: MouseEvent | TouchEvent) => {
  if (!isResizing.value || !container.value) return
  
  const rect = container.value.getBoundingClientRect()
  const x = 'touches' in e ? e.touches[0].clientX : e.clientX
  const position = ((x - rect.left) / rect.width) * 100
  
  // 极致性能：直接操作 DOM 的 style 以避开 Vue 的响应式 diff (针对频繁移动)
  if (container.value) {
    const safePos = Math.max(0, Math.min(100, position))
    sliderPos.value = safePos
  }
}

const startResizing = (e: MouseEvent | TouchEvent) => {
  isResizing.value = true
  // 阻止默认行为，防止移动端触发下拉刷新
  if (e.cancelable) e.preventDefault()
}
const stopResizing = () => { isResizing.value = false }

onMounted(() => {
  window.addEventListener('mousemove', handleMove, { passive: true })
  window.addEventListener('mouseup', stopResizing)
  window.addEventListener('touchmove', handleMove, { passive: false })
  window.addEventListener('touchend', stopResizing)
})

onUnmounted(() => {
  window.removeEventListener('mousemove', handleMove)
  window.removeEventListener('mouseup', stopResizing)
  window.removeEventListener('touchmove', handleMove)
  window.removeEventListener('touchend', stopResizing)
})
</script>

<template>
  <div class="w-full h-full flex flex-col select-none overflow-hidden bg-card/50">
    <div class="flex-1 relative flex items-center justify-center p-2 md:p-10 overflow-hidden">
      <!-- 极简对比容器 -->
      <div class="w-full h-full max-w-7xl relative rounded-xl overflow-hidden border border-border bg-card" ref="container">
        <!-- 底部图 (原图) -->
        <img :src="originalUrl" class="absolute inset-0 w-full h-full object-contain p-2 md:p-4" alt="Original" loading="eager" />
        
        <!-- 上层图 (压缩后) -->
        <div 
          class="absolute inset-0 w-full h-full overflow-hidden"
          :style="{ 
            clipPath: `inset(0 ${100 - sliderPos}% 0 0)`,
            transform: 'translateZ(0)'
          }"
        >
          <img :src="processedUrl" class="absolute inset-0 w-full h-full object-contain p-2 md:p-4 bg-card" alt="Processed" loading="eager" />
        </div>

        <!-- 分割线 -->
        <div 
          class="absolute inset-y-0 z-40 w-0.5 bg-primary cursor-col-resize"
          :style="{ left: `${sliderPos}%`, transform: 'translateZ(0)' }"
          @mousedown="startResizing"
          @touchstart="startResizing"
        >
          <div class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-9 h-9 bg-primary text-primary-foreground rounded-full shadow-xl flex items-center justify-center cursor-col-resize ring-4 ring-primary/10">
            <ChevronsLeftRight :size="16" />
          </div>
        </div>

        <!-- 悬浮标签 (左: 原始) -->
        <div class="absolute bottom-4 left-4 z-10 px-2.5 py-1 bg-background/90 rounded-lg border border-border shadow-md flex flex-col pointer-events-none">
          <span class="text-[0.55rem] font-bold text-muted-foreground uppercase leading-none">Original</span>
          <span class="text-[0.7rem] font-black text-foreground tabular-nums">{{ originalSize }}</span>
        </div>

        <!-- 悬浮标签 (右: 压缩后) -->
        <div class="absolute bottom-4 right-4 z-10 px-2.5 py-1 bg-primary text-white rounded-lg shadow-md flex flex-col text-right pointer-events-none">
          <span class="text-[0.55rem] font-bold opacity-80 uppercase leading-none">Compressed</span>
          <span class="text-[0.7rem] font-black flex items-center justify-end gap-1 tabular-nums">
            <Zap :size="10" /> {{ processedSize }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
