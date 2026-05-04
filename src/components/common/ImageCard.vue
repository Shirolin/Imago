<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import type { CSSProperties } from 'vue'
import {
  Download,
  X,
  Square,
  CheckSquare,
  Columns2,
  RotateCcw,
  Sparkles,
  AlertCircle,
  Loader2
} from 'lucide-vue-next'
import { useFileHelpers } from '../../composables/useFileHelpers'
import { useImageStore } from '../../stores/imageStore'
import { useI18n } from 'vue-i18n'
import type { ImageItem } from '../../stores/imageStore'
import AppModal from './AppModal.vue'
import AppButton from './AppButton.vue'

const { formatSize } = useFileHelpers()
const store = useImageStore()
const { t } = useI18n()

interface Props {
  image: ImageItem
  isSelected?: boolean
  imageStyle?: CSSProperties
  allowMagnifier?: boolean
  showTransparency?: boolean
  processedPreview?: string
  processedBlob?: Blob
}

const props = withDefaults(defineProps<Props>(), {
  isSelected: false,
  imageStyle: () => ({}),
  allowMagnifier: true,
  showTransparency: false,
  processedPreview: undefined,
  processedBlob: undefined
})
const emit = defineEmits(['toggle', 'remove', 'download', 'compare', 'interactive'])

// 确认框状态
const showResetConfirm = ref(false)

const handleReset = () => {
  showResetConfirm.value = true
}

const confirmReset = () => {
  store.resetImage(props.image.id)
  showResetConfirm.value = false
}

const imageRef = ref<HTMLElement | null>(null)

const isDirtyDone = computed(() => props.image.isDirty && props.image.status === 'done')
const isDirty = computed(() => props.image.isDirty)

// --- Magnifier Logic ---
const showMagnifier = ref(false)
const mousePos = ref({ x: 50, y: 50 })
const originalHDUrl = ref<string | null>(null)
const localProcessedUrl = ref<string | null>(null)
const rafId = ref<number | null>(null)

// 只有在完成处理且悬停时才处理高清 URL
watch(showMagnifier, (isShowing) => {
  if (isShowing) {
    if (props.processedPreview) {
      localProcessedUrl.value = props.processedPreview
    } else if (props.processedBlob) {
      localProcessedUrl.value = URL.createObjectURL(props.processedBlob)
    }

    if (!originalHDUrl.value) {
      originalHDUrl.value = props.image.preview || (props.image.file ? URL.createObjectURL(props.image.file) : null)
    }
  }
})

// 监听处理结果变化，实时更新倍镜
watch(() => props.processedPreview, (newUrl) => {
  if (showMagnifier.value && newUrl) {
    localProcessedUrl.value = newUrl
  }
})

onUnmounted(() => {
  if (localProcessedUrl.value && localProcessedUrl.value !== props.processedPreview) {
    URL.revokeObjectURL(localProcessedUrl.value)
  }
  if (originalHDUrl.value && originalHDUrl.value !== props.image.preview) {
    URL.revokeObjectURL(originalHDUrl.value)
  }
  if (rafId.value) cancelAnimationFrame(rafId.value)
})

const handleMouseMove = (e: MouseEvent) => {
  if (!props.allowMagnifier || !showMagnifier.value || !imageRef.value) return

  if (rafId.value) cancelAnimationFrame(rafId.value)

  rafId.value = requestAnimationFrame(() => {
    const rect = imageRef.value!.getBoundingClientRect()
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100))
    mousePos.value = { x, y }
  })
}

const enterMagnifier = () => {
  // 仅在大图模式且完成处理时允许进入倍镜
  if (props.allowMagnifier && (props.image.status === 'done' || props.processedPreview) && store.showMagnifier) {
    const isLarge = imageRef.value?.clientWidth ? imageRef.value.clientWidth > 220 : true
    if (isLarge) showMagnifier.value = true
  }
}

const leaveMagnifier = () => {
  showMagnifier.value = false
}

const innerContainerStyle = computed(() => {
  const { x, y } = mousePos.value
  return {
    transform: `scale(2)`,
    transformOrigin: `${x}% ${y}%`
  }
})

const dynamicClipPath = computed(() => {
  if (!imageRef.value) return ''
  const rect = imageRef.value.getBoundingClientRect()
  const { x, y } = mousePos.value
  const absX = (x * rect.width) / 100
  const absY = (y * rect.height) / 100
  const size = 100 // 放大镜半径
  return `circle(${size}px at ${absX}px ${absY}px)`
})
// --- End Magnifier Logic ---

// 自动切换处理前后预览图
const displayUrl = computed(() => {
  if (props.processedPreview) return props.processedPreview
  if (props.image.status === 'done' && props.image.processedPreview) {
    return props.image.processedPreview
  }
  return props.image.preview
})
</script>

<template>
  <div
    class="relative bg-card rounded-2xl overflow-hidden border border-border/60 transition-all duration-500 cursor-pointer flex flex-col group hover:shadow-elevated hover:-translate-y-0.5 hover:shadow-primary/10 hover:border-primary/30 @container outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background shadow-inner-glow"
    :class="[
      isSelected ? 'ring-2 ring-primary ring-offset-2 ring-offset-background bg-primary/[0.03]' : '',
      isDirtyDone ? 'animate-dirty-pulse border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.15)]' : ''
    ]"
    tabindex="0"
    @click="emit('toggle', image.id)"
  >
    <!-- Layer 1: Canvas (4:3) -->
    <div ref="imageRef" class="relative aspect-[4/3] flex items-center justify-center shrink-0 group/canvas">
       <!-- Background & Preview remains similar but wrapped -->
       <div class="absolute inset-0 overflow-hidden rounded-t-[calc(1rem-1px)] bg-muted/20" :class="{ 'app-transparency-grid-sm': showTransparency }">
         <div class="absolute inset-0 z-10 pointer-events-none"><slot name="visual-effects" :image="image"></slot></div>
         <img :src="displayUrl" class="w-full h-full object-contain transition-all duration-700 group-hover/canvas:scale-105" :class="{ 'opacity-40 grayscale-[0.5] blur-[1px] scale-95': image.status === 'processing' }" :style="imageStyle" />
         <div v-if="isDirtyDone" class="absolute inset-0 z-20 pointer-events-none overflow-hidden opacity-30"><div class="absolute inset-[-100%] bg-stripe-pattern animate-stripe-scroll"></div></div>
       </div>

       <!-- Top Overlays -->
       <div class="absolute top-3 left-3 z-30 flex items-center gap-2">
         <div class="transition-all duration-300" :class="isSelected ? 'text-primary scale-110' : 'text-foreground/60 opacity-0 group-hover:opacity-100'"><CheckSquare v-if="isSelected" :size="20" /><Square v-else :size="20" /></div>
         <slot name="overlay" :image="image"></slot>
       </div>
       <button @click.stop="store.removeImage(image.id)" class="absolute top-3 right-3 z-30 bg-background/40 hover:bg-destructive text-foreground/60 hover:text-destructive-foreground p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-300 backdrop-blur-md active:scale-90 border border-border/40"><X :size="14" /></button>

       <!-- Center Progress -->
       <div v-if="image.status === 'processing'" class="absolute inset-0 bg-background/40 backdrop-blur-[2px] z-35 flex items-center justify-center"><Loader2 :size="24" class="text-primary animate-spin" /></div>

       <!-- HUD Tray -->
       <div class="absolute bottom-3 left-3 right-3 z-40 bg-background/80 backdrop-blur-xl border border-white/20 rounded-xl p-1.5 shadow-2xl flex items-center justify-between gap-1.5 translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500 ease-apple pointer-events-auto">
          <!-- Action Buttons -->
          <div class="flex items-center gap-1">
             <button v-if="image.status === 'done'" @click.stop="emit('compare', image.id)" class="p-2 hover:bg-primary/10 text-muted-foreground hover:text-primary rounded-lg transition-all"><Columns2 :size="14" /></button>
             <button v-if="image.status === 'done' || image.status === 'error'" @click.stop="handleReset" class="p-2 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-lg transition-all"><RotateCcw :size="14" /></button>
          </div>
          <!-- Reactive Data (Small mode only) -->
          <div class="flex @[221px]:hidden items-center gap-2 px-2 border-l border-border/40 ml-1">
             <span class="text-[9px] font-mono font-bold opacity-60 tabular-nums">{{ image.width }}x{{ image.height }}</span>
             <span class="text-[9px] font-bold opacity-60 tabular-nums">{{ formatSize(image.originalSize) }}</span>
          </div>
          <div class="flex items-center gap-1.5">
            <button
              @click.stop="emit('interactive', image.id)"
              class="p-2 bg-primary/10 text-primary hover:bg-primary hover:text-primary-foreground rounded-lg transition-all active:scale-90"
              :title="$t('common.image.card.interactive')"
            >
              <Sparkles :size="14" />
            </button>
            <button @click.stop="emit('download', image.id)" class="p-2 bg-primary text-primary-foreground rounded-lg shadow-lg active:scale-90 transition-all"><Download :size="14" /></button>
          </div>
       </div>
    </div>

    <!-- Layer 2: Info Area -->
    <div class="p-3.5 flex flex-col gap-1.5 min-w-0">
      <div class="flex items-center justify-between gap-2">
        <h4 class="font-bold text-foreground truncate text-sm flex-1">{{ image.file.name }}</h4>
        <!-- Status Shorthand -->
        <div class="shrink-0 flex items-center gap-1.5">
           <div v-if="image.status === 'done'" class="w-2 h-2 rounded-full bg-emerald-500" :class="{ 'bg-amber-500 animate-pulse': isDirty }"></div>
           <Loader2 v-else-if="image.status === 'processing'" :size="12" class="text-primary animate-spin" />
        </div>
      </div>
      <!-- Detailed Specs (Large mode only) -->
      <div class="hidden @[221px]:flex items-center gap-2 text-[10px] font-bold text-muted-foreground/60 tracking-tight uppercase tabular-nums">
        <span class="px-1 py-0.5 rounded bg-muted/40 text-[9px]">{{ image.format }}</span>
        <span>{{ image.width }} × {{ image.height }}</span>
        <span class="opacity-30">|</span>
        <span>{{ formatSize(image.originalSize) }}</span>
      </div>
      <slot name="meta" :image="image"></slot>
    </div>

    <!-- 单张图片还原确认对话框 -->
    <AppModal
      :show="showResetConfirm"
      @close="showResetConfirm = false"
      :title="t('common.image.toolbar.confirmTitle')"
      variant="dialog"
    >
      <div class="p-6" @click.stop>
        <div class="flex items-start gap-4 mb-6">
          <div class="p-3 bg-destructive/10 rounded-2xl text-destructive shrink-0">
            <AlertCircle :size="24" />
          </div>
          <div>
            <h3 class="text-lg font-black text-foreground mb-1 tracking-tight">
              {{ t('common.image.toolbar.confirmReset') }}
            </h3>
            <p class="text-muted-foreground text-sm leading-relaxed font-medium">
              {{ t('common.image.toolbar.confirmResetTitle') }}
            </p>
            <p class="text-muted-foreground/60 text-[11px] mt-2 italic">
              {{ t('common.image.toolbar.confirmResetDesc') }}
            </p>
          </div>
        </div>
        <div class="flex gap-3">
          <AppButton
            variant="ghost"
            class="flex-1 rounded-xl h-11"
            @click="showResetConfirm = false"
          >
            {{ t('common.image.toolbar.cancel') }}
          </AppButton>
          <AppButton
            variant="danger"
            class="flex-1 rounded-xl h-11 shadow-lg shadow-destructive/10"
            @click="confirmReset"
          >
            {{ t('common.image.toolbar.confirm') }}
          </AppButton>
        </div>
      </div>
    </AppModal>
  </div>
</template>

<style scoped>
.animate-dirty-pulse {
  animation: dirty-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
  border-right-width: 3px;
  border-right-color: theme('colors.amber.500');
}
@keyframes dirty-pulse {
  0%, 100% { border-right-color: rgba(245, 158, 11, 0.4); }
  50% { border-right-color: rgba(245, 158, 11, 0.8); }
}
/* Ensure Apple transition curve is defined or used from tailwind */
.ease-apple { transition-timing-function: cubic-bezier(0.32, 0.72, 0, 1); }

/* Reuse existing patterns if needed */
.bg-stripe-pattern {
  background-image: repeating-linear-gradient(
    45deg,
    transparent,
    transparent 20px,
    rgba(245, 158, 11, 0.08) 20px,
    rgba(245, 158, 11, 0.08) 40px
  );
}
@keyframes stripe-scroll {
  from { transform: translateX(0) translateY(0); }
  to { transform: translateX(40px) translateY(40px); }
}
.animate-stripe-scroll {
  animation: stripe-scroll 3s linear infinite;
}
</style>
