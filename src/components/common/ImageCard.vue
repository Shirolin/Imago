<script setup lang="ts">
import { ref, computed, onUnmounted, watch } from 'vue'
import {
  Download,
  X,
  Loader2,
  CheckCircle2,
  Square,
  CheckSquare,
  Columns2
} from 'lucide-vue-next'
import { useFileHelpers } from '../../composables/useFileHelpers'
import { useImageStore } from '../../stores/imageStore'
import type { ImageItem } from '../../stores/imageStore'

const { formatSize } = useFileHelpers()
const store = useImageStore()

interface Props {
  image: ImageItem
  isSelected?: boolean
}

const props = defineProps<Props>()
const emit = defineEmits(['toggle', 'remove', 'download', 'compare'])

// 智能倍镜逻辑
const showMagnifier = ref(false)
const mousePos = ref({ x: 50, y: 50 })
const originalHDUrl = ref<string | null>(null)
const processedUrl = ref<string | null>(null)
const imageRef = ref<HTMLElement | null>(null)
const rafId = ref<number | null>(null)

// 只有在完成处理且悬停时才处理高清 URL
watch(showMagnifier, (isShowing) => {
  if (isShowing) {
    if (props.image.processedBlob && !processedUrl.value) {
      processedUrl.value = URL.createObjectURL(props.image.processedBlob)
    }
    if (!originalHDUrl.value) {
      originalHDUrl.value = URL.createObjectURL(props.image.file)
    }
  }
})

onUnmounted(() => {
  if (processedUrl.value) URL.revokeObjectURL(processedUrl.value)
  if (originalHDUrl.value) URL.revokeObjectURL(originalHDUrl.value)
  if (rafId.value) cancelAnimationFrame(rafId.value)
})

const handleMouseMove = (e: MouseEvent) => {
  if (!showMagnifier.value || !imageRef.value) return
  
  // 使用 RAF 确保每一帧同步渲染，解决“不跟手”问题
  if (rafId.value) cancelAnimationFrame(rafId.value)
  
  rafId.value = requestAnimationFrame(() => {
    const rect = imageRef.value!.getBoundingClientRect()
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100))
    mousePos.value = { x, y }
  })
}

const enterMagnifier = () => {
  if (props.image.status === 'done' && store.showMagnifier) showMagnifier.value = true
}

const leaveMagnifier = () => {
  showMagnifier.value = false
}

const magnifierStyle = computed(() => ({
  left: `${mousePos.value.x}%`,
  top: `${mousePos.value.y}%`,
  willChange: 'left, top' // 提示浏览器优化
}))

const innerImageStyle = computed(() => ({
  transform: `scale(2.5)`, 
  transformOrigin: `${mousePos.value.x}% ${mousePos.value.y}%`,
  imageRendering: 'auto'
}))
</script>

<template>
  <div
    class="relative bg-card rounded-2xl overflow-hidden border border-border/60 transition-all duration-500 cursor-pointer flex flex-col group hover:shadow-2xl hover:shadow-black/10 hover:border-primary/30 shadow-inner-glow @container"
    :class="[
      isSelected ? 'ring-2 ring-primary ring-offset-2 ring-offset-background bg-primary/[0.03]' : ''
    ]"
    @click="emit('toggle', image.id)"
  >
    <!-- 图片展示区 -->
    <div
      ref="imageRef"
      class="relative aspect-[4/3] overflow-hidden bg-slate-900/50 flex items-center justify-center shrink-0"
      @mouseenter="enterMagnifier"
      @mouseleave="leaveMagnifier"
      @mousemove="handleMouseMove"
    >
      <!-- 【左上角】：选择框 + 业务贴纸插槽 -->
      <div class="absolute top-3 left-3 z-30 flex items-center gap-2 pointer-events-none">
        <div
          class="transition-all duration-300"
          :class="
            isSelected
              ? 'text-primary scale-110'
              : 'text-white/60 opacity-0 group-hover:opacity-100'
          "
        >
          <CheckSquare v-if="isSelected" :size="20" />
          <Square v-else :size="20" />
        </div>

        <slot name="overlay" :image="image"></slot>
      </div>

      <!-- 【右上角】：删除按钮 -->
      <button
        @click.stop="emit('remove', image.id)"
        class="absolute top-3 right-3 z-30 bg-black/20 hover:bg-destructive text-white p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 backdrop-blur-md active:scale-90 border border-white/10"
      >
        <X :size="14" />
      </button>

      <!-- 主预览图 -->
      <img
        :src="image.preview"
        alt="Preview"
        class="w-full h-full object-contain transition-transform duration-700"
        :class="{ 'group-hover:scale-105': !showMagnifier }"
      />

      <!-- 智能倍镜组件 -->
      <div
        v-if="showMagnifier && processedUrl && originalHDUrl && store.showMagnifier"
        class="absolute inset-0 z-20 pointer-events-none overflow-hidden"
      >
        <!-- 倍镜容器 -->
        <div
          class="absolute w-32 h-32 md:w-48 md:h-48 -ml-16 -mt-16 md:-ml-24 md:-mt-24 rounded-full border-2 border-primary shadow-[0_0_30px_rgba(var(--primary-rgb),0.5)] overflow-hidden bg-black flex items-center justify-center"
          :style="magnifierStyle"
        >
          <!-- 背景：原始图 (左侧) -->
          <img
            :src="originalHDUrl"
            class="absolute inset-0 w-full h-full object-contain"
            :style="innerImageStyle"
          />
          
          <!-- 前景：处理后的图 (右侧) -->
          <div 
            class="absolute inset-0 w-full h-full"
            :style="{ 
              clipPath: `inset(0 0 0 50%)`,
              ...innerImageStyle
            }"
          >
            <img :src="processedUrl" class="w-full h-full object-contain" />
          </div>

          <!-- 分割线 -->
          <div class="absolute inset-y-0 left-1/2 w-0.5 bg-primary/80 z-10 shadow-[0_0_8px_rgba(var(--primary-rgb),1)]"></div>
          
          <!-- 增强标签标识 -->
          <div class="absolute inset-0 flex items-center justify-between px-2 text-[10px] pointer-events-none z-20">
             <div class="flex flex-col items-center gap-1 opacity-80 filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                <span class="bg-black/60 px-1.5 py-0.5 rounded text-white font-black border border-white/20">BEFORE</span>
             </div>
             <div class="flex flex-col items-center gap-1 opacity-80 filter drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]">
                <span class="bg-primary/80 px-1.5 py-0.5 rounded text-white font-black border border-white/20">AFTER</span>
             </div>
          </div>
        </div>
      </div>

      <!-- 【底部 HUD】：技术参数条 -->
      <div
        class="absolute bottom-0 left-0 right-0 h-9 bg-gradient-to-t from-black/80 via-black/30 to-transparent z-20 flex items-end px-3 pb-2 transition-opacity duration-300 md:opacity-0 md:group-hover:opacity-100 pointer-events-none"
      >
        <div
          class="flex items-center gap-2 text-[0.65rem] font-bold text-white/90 tabular-nums tracking-tight"
        >
          <span
            class="px-1.5 py-0.5 bg-white/20 rounded-sm uppercase text-white tracking-widest text-[0.6rem]"
            >{{ image.format }}</span
          >
          <span v-if="image.width" class="opacity-90">{{ image.width }} × {{ image.height }}</span>
          <span class="opacity-30">|</span>
          <span class="opacity-90">{{ formatSize(image.originalSize) }}</span>
        </div>
      </div>

      <!-- 处理中状态 -->
      <div
        v-if="image.status === 'processing'"
        class="absolute inset-0 bg-background/60 backdrop-blur-[2px] z-40 flex items-center justify-center"
      >
        <Loader2 class="animate-spin text-primary" :size="24" />
      </div>
    </div>

    <!-- 底部：文件名与操作 -->
    <div class="p-3 flex flex-col gap-2.5">
      <h4
        class="font-bold text-[0.85rem] text-foreground truncate leading-tight"
        :title="image.file.name"
      >
        {{ image.file.name }}
      </h4>

      <div class="flex justify-between items-center gap-2 mt-0.5 min-h-[32px]">
        <div
          class="flex items-center gap-1.5 px-2.5 h-6 rounded-md font-black text-[0.65rem] border transition-all duration-300 uppercase tracking-widest"
          :class="{
            'text-primary border-primary/20 bg-primary/[0.03]': image.status === 'done',
            'text-blue-500 border-blue-500/20 bg-blue-500/[0.03]': image.status === 'processing',
            'text-destructive border-destructive/20 bg-destructive/[0.03]':
              image.status === 'error',
            'text-muted-foreground border-border bg-muted/20': image.status === 'idle'
          }"
        >
          <div class="w-2.5 h-2.5 flex items-center justify-center">
            <CheckCircle2 v-if="image.status === 'done'" :size="11" />
            <div
              v-else
              class="w-1.5 h-1.5 rounded-full bg-current"
              :class="{ 'animate-pulse': image.status === 'processing' }"
            ></div>
          </div>
          <span class="mt-0.5">{{
            image.status === 'done' ? 'Ready' : image.status === 'processing' ? 'Wait' : 'Idle'
          }}</span>
        </div>

        <div class="flex items-center gap-1">
          <button
            v-if="image.status === 'done'"
            @click.stop="emit('compare', image.id)"
            class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-secondary text-muted-foreground hover:text-secondary-foreground transition-all active:scale-90"
            title="对比"
          >
            <Columns2 :size="16" />
          </button>

          <button
            v-if="image.status === 'done'"
            @click.stop="emit('download', image.id)"
            class="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-primary text-muted-foreground hover:text-primary-foreground transition-all active:scale-90"
            title="下载"
          >
            <Download :size="16" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
