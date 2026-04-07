<script setup lang="ts">
import { ref, computed, onUnmounted, watch } from 'vue'
import type { CSSProperties } from 'vue'
import {
  Download,
  X,
  Loader2,
  CheckCircle2,
  Square,
  CheckSquare,
  Columns2,
  RotateCcw
} from 'lucide-vue-next'
import { useFileHelpers } from '../../composables/useFileHelpers'
import { useImageStore } from '../../stores/imageStore'
import { useLayoutStore } from '../../stores/layoutStore'
import type { ImageItem } from '../../stores/imageStore'

const { formatSize } = useFileHelpers()
const store = useImageStore()
const layoutStore = useLayoutStore()

interface Props {
  image: ImageItem
  isSelected?: boolean
  imageStyle?: CSSProperties
  allowMagnifier?: boolean
  showTransparency?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isSelected: false,
  imageStyle: () => ({}),
  allowMagnifier: true,
  showTransparency: false
})
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
    if (props.image.processedPreview) {
      processedUrl.value = props.image.processedPreview
    } else if (props.image.processedBlob) {
      processedUrl.value = URL.createObjectURL(props.image.processedBlob)
    }

    if (!originalHDUrl.value) {
      originalHDUrl.value = props.image.preview || URL.createObjectURL(props.image.file)
    }
  }
})

// 监听处理结果变化，实时更新倍镜
watch(
  () => props.image.processedPreview,
  (newUrl) => {
    if (showMagnifier.value && newUrl) {
      processedUrl.value = newUrl
    }
  }
)

onUnmounted(() => {
  // 仅释放由本组件创建的 URL
  if (processedUrl.value && processedUrl.value !== props.image.processedPreview) {
    URL.revokeObjectURL(processedUrl.value)
  }
  if (originalHDUrl.value && originalHDUrl.value !== props.image.preview) {
    URL.revokeObjectURL(originalHDUrl.value)
  }
  if (rafId.value) cancelAnimationFrame(rafId.value)
})

const handleMouseMove = (e: MouseEvent) => {
  if (!props.allowMagnifier || !showMagnifier.value || !imageRef.value) return

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
  if (props.allowMagnifier && props.image.status === 'done' && store.showMagnifier) {
    showMagnifier.value = true
  }
}

const leaveMagnifier = () => {
  showMagnifier.value = false
}

const magnifierStyle = computed<CSSProperties>(() => ({
  left: `${mousePos.value.x}%`,
  top: `${mousePos.value.y}%`,
  willChange: 'left, top'
}))

const innerContainerStyle = computed<CSSProperties>(() => {
  // 核心修复：内部容器比例必须与外层完全一致
  // 关键：使用 translate(-x%, -y%) 配合 transform-origin，确保鼠标指向的像素始终在倍镜中心
  return {
    position: 'absolute',
    width: `${imageRef.value?.clientWidth || 0}px`,
    height: `${imageRef.value?.clientHeight || 0}px`,
    left: '50%',
    top: '50%',
    transform: `translate(-${mousePos.value.x}%, -${mousePos.value.y}%) scale(2.5)`,
    transformOrigin: `${mousePos.value.x}% ${mousePos.value.y}%`,
    willChange: 'transform, transform-origin'
  }
})

// 计算动态分割线位置：基于图片坐标系裁剪，确保裁剪线始终处于倍镜中心
const dynamicClipPath = computed(() => {
  const x = mousePos.value.x
  return {
    original: `inset(0 ${100 - x}% 0 0)`,
    processed: `inset(0 0 0 ${x}%)`
  }
})

const isDirtyDone = computed(() => props.image.isDirty && props.image.status === 'done')

// 自动切换处理前后预览图
const displayUrl = computed(() => {
  if (props.image.status === 'done' && props.image.processedPreview) {
    return props.image.processedPreview
  }
  return props.image.preview
})
</script>

<template>
  <div
    class="relative bg-card rounded-2xl overflow-hidden border border-border/60 transition-all duration-500 cursor-pointer flex flex-col group hover:shadow-2xl hover:shadow-primary/10 hover:border-primary/30 @container outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background shadow-inner-glow"
    :class="[
      isSelected
        ? 'ring-2 ring-primary ring-offset-2 ring-offset-background bg-primary/[0.03]'
        : '',
      isDirtyDone
        ? 'animate-dirty-pulse border-amber-500/50 shadow-[0_0_15px_rgba(245,158,11,0.15)]'
        : ''
    ]"
    tabindex="0"
    @click="emit('toggle', image.id)"
    @keydown.enter.space.prevent="emit('toggle', image.id)"
  >
    <!-- 图片展示区 -->
    <div
      ref="imageRef"
      class="relative aspect-[4/3] flex items-center justify-center shrink-0"
      @mouseenter="enterMagnifier"
      @mouseleave="leaveMagnifier"
      @mousemove="handleMouseMove"
    >
      <!-- 主内容裁剪层：仅裁剪背景和主图，不裁剪倍镜 -->
      <div
        class="absolute inset-0 overflow-hidden rounded-t-[calc(1rem-1px)] bg-muted/20"
        :class="{ 'transparency-grid-sm': showTransparency }"
      >
        <!-- 【专用层】：滤镜与视觉效果预览 (z-10) -->
        <div class="absolute inset-0 z-10 pointer-events-none">
          <slot name="visual-effects" :image="image"></slot>
        </div>

        <!-- 主预览图 -->
        <img
          :src="displayUrl"
          alt="Preview"
          class="w-full h-full object-contain transition-all duration-700"
          :class="{
            'group-hover:scale-105': !showMagnifier && !isDirtyDone,
            'opacity-40 grayscale-[0.5] blur-[1px] scale-95': isDirtyDone
          }"
          :style="imageStyle"
        />

        <!-- 脏状态覆盖层 (z-20) -->
        <div
          v-if="isDirtyDone"
          class="absolute inset-0 z-20 pointer-events-none overflow-hidden opacity-30"
        >
          <div class="absolute inset-[-100%] bg-stripe-pattern animate-stripe-scroll"></div>
        </div>
      </div>

      <!-- 【左上角】：选择框 (z-30) -->
      <div
        class="absolute top-3 left-3 z-30 flex items-center gap-2"
        role="checkbox"
        :aria-checked="isSelected"
        aria-label="选择图片"
      >
        <div
          class="transition-all duration-300"
          :class="
            isSelected
              ? 'text-primary scale-110'
              : 'text-foreground/60 opacity-100 md:opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
          "
        >
          <CheckSquare v-if="isSelected" :size="20" />
          <Square v-else :size="20" />
        </div>

        <slot name="overlay" :image="image"></slot>
      </div>

      <!-- 【右上角】：删除按钮 (z-30) -->
      <button
        @click.stop="store.removeImage(image.id)"
        class="absolute top-3 right-3 z-30 bg-background/40 hover:bg-destructive text-foreground/60 hover:text-destructive-foreground p-1.5 rounded-full opacity-100 md:opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 focus:opacity-100 transition-all duration-300 backdrop-blur-md active:scale-90 border border-border/40 outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        title="移除图片"
      >
        <X :size="14" />
      </button>

      <!-- 智能倍镜组件 (z-40) - 放在裁剪层之外 -->
      <div
        v-if="
          allowMagnifier && showMagnifier && processedUrl && originalHDUrl && store.showMagnifier
        "
        class="absolute inset-0 z-40 pointer-events-none"
      >
        <!-- 倍镜容器 -->
        <div
          class="absolute w-32 h-32 md:w-48 md:h-48 -ml-16 -mt-16 md:-ml-24 md:-mt-24 rounded-full border-2 border-primary shadow-[0_0_30px_rgba(var(--primary-rgb),0.5)] overflow-hidden bg-background flex items-center justify-center"
          :class="{ 'transparency-grid-sm': showTransparency }"
          :style="magnifierStyle"
        >
          <!-- 左侧：原图 (动态裁剪) -->
          <div
            class="absolute"
            :style="{ ...innerContainerStyle, clipPath: dynamicClipPath.original } as CSSProperties"
          >
            <img :src="originalHDUrl!" class="w-full h-full object-contain" />
          </div>

          <!-- 右侧：处理后图 (动态裁剪) -->
          <div
            class="absolute"
            :style="
              { ...innerContainerStyle, clipPath: dynamicClipPath.processed } as CSSProperties
            "
          >
            <img :src="processedUrl!" class="w-full h-full object-contain" />
          </div>

          <!-- 动态分割线：始终对齐鼠标中心点 -->
          <div
            class="absolute inset-y-0 left-1/2 w-0.5 bg-primary/80 z-10 shadow-[0_0_8px_rgba(var(--primary-rgb),1)] will-change-[left]"
          ></div>
          <div
            class="absolute inset-0 flex items-center justify-between px-2 text-[10px] pointer-events-none z-20"
          >
            <span
              class="bg-muted/80 backdrop-blur-sm px-1.5 py-0.5 rounded text-foreground font-black border border-border/20 transition-opacity duration-300"
              >BEFORE</span
            >
            <span
              class="bg-primary/80 backdrop-blur-sm px-1.5 py-0.5 rounded text-primary-foreground font-black border border-white/20 transition-opacity duration-300"
              >AFTER</span
            >
          </div>
        </div>
      </div>

      <!-- 【底部 HUD】：技术参数条 (降级至 z-20，确保不遮挡侧边栏) -->
      <div
        class="absolute bottom-0 left-0 right-0 h-9 bg-gradient-to-t from-background/90 via-background/40 to-transparent z-20 flex items-end px-3 pb-2 transition-all duration-300 md:opacity-0 md:group-hover:opacity-100 pointer-events-none @[200px]:via-background/60"
      >
        <div
          class="flex items-center gap-2 text-[0.65rem] font-bold text-foreground/90 tabular-nums tracking-tight"
        >
          <span
            class="px-1.5 py-0.5 bg-foreground/10 rounded-sm uppercase text-foreground tracking-widest text-[0.55rem] md:text-[0.6rem]"
            >{{ image.format }}</span
          >
          <span v-if="image.width" class="opacity-90 hidden @[200px]:inline"
            >{{ image.width }} × {{ image.height }}</span
          >
          <span class="opacity-30 hidden @[200px]:inline">|</span>
          <span class="opacity-90">{{ formatSize(image.originalSize) }}</span>
        </div>
      </div>

      <!-- 处理中状态 (降级至 z-20) -->
      <div
        v-if="image.status === 'processing'"
        class="absolute inset-0 bg-background/60 backdrop-blur-[2px] z-20 flex items-center justify-center"
      >
        <Loader2 class="animate-spin text-primary" :size="24" />
      </div>
    </div>

    <!-- 底部：文件名与操作 -->
    <div
      class="flex flex-col transition-all duration-300"
      :class="layoutStore.cardSizeMode === 'compact' ? 'p-2 gap-1.5' : 'p-3 gap-2.5'"
    >
      <h4
        class="font-bold text-foreground truncate leading-tight transition-all"
        :class="layoutStore.cardSizeMode === 'compact' ? 'text-[0.75rem]' : 'text-[0.85rem]'"
        :title="image.file.name"
      >
        {{ image.file.name }}
      </h4>

      <div
        class="flex justify-between items-center gap-2 mt-0.5 transition-all"
        :class="layoutStore.cardSizeMode === 'compact' ? 'min-h-[24px]' : 'min-h-[32px]'"
      >
        <div
          class="flex items-center gap-1.5 rounded-md font-black text-[0.65rem] border transition-all duration-300 uppercase tracking-widest"
          :class="[
            {
              'text-primary border-primary/20 bg-primary/[0.03]':
                image.status === 'done' && !image.isDirty,
              'text-amber-500 border-amber-500/20 bg-amber-500/[0.03] shadow-[0_0_8px_rgba(245,158,11,0.1)]':
                isDirtyDone,
              'text-blue-500 border-blue-500/20 bg-blue-500/[0.03]': image.status === 'processing',
              'text-destructive border-destructive/20 bg-destructive/[0.03]':
                image.status === 'error',
              'text-muted-foreground border-border bg-muted/20': image.status === 'idle'
            },
            layoutStore.cardSizeMode === 'compact' ? 'px-1.5 h-5' : 'px-2.5 h-6'
          ]"
        >
          <div class="w-2.5 h-2.5 flex items-center justify-center">
            <CheckCircle2 v-if="image.status === 'done'" :size="11" />
            <div
              v-else
              class="w-1.5 h-1.5 rounded-full bg-current"
              :class="{ 'animate-pulse': image.status === 'processing' }"
            ></div>
          </div>
          <span v-if="layoutStore.cardSizeMode === 'large'" class="mt-0.5">{{
            image.status === 'done'
              ? image.isDirty
                ? '待更新'
                : 'Ready'
              : image.status === 'processing'
                ? 'Wait'
                : 'Idle'
          }}</span>
        </div>

        <div
          class="flex items-center transition-all"
          :class="layoutStore.cardSizeMode === 'compact' ? 'gap-0' : 'gap-1'"
        >
          <button
            v-if="image.status === 'done' || image.status === 'error'"
            @click.stop="store.resetImage(image.id)"
            class="flex items-center justify-center rounded-lg hover:bg-secondary text-muted-foreground hover:text-secondary-foreground transition-all active:scale-90 outline-none focus-visible:ring-2 focus-visible:ring-primary"
            :class="layoutStore.cardSizeMode === 'compact' ? 'w-6 h-6' : 'w-8 h-8'"
            title="恢复原图"
          >
            <RotateCcw :size="layoutStore.cardSizeMode === 'compact' ? 12 : 16" />
          </button>
          <button
            v-if="allowMagnifier && image.status === 'done'"
            @click.stop="emit('compare', image.id)"
            class="flex items-center justify-center rounded-lg hover:bg-secondary text-muted-foreground hover:text-secondary-foreground transition-all active:scale-90 outline-none focus-visible:ring-2 focus-visible:ring-primary"
            :class="layoutStore.cardSizeMode === 'compact' ? 'w-6 h-6' : 'w-8 h-8'"
            title="对比画质细节"
          >
            <Columns2 :size="layoutStore.cardSizeMode === 'compact' ? 12 : 16" />
          </button>
          <button
            v-if="image.status === 'done'"
            @click.stop="emit('download', image.id)"
            class="flex items-center justify-center rounded-lg hover:bg-primary text-muted-foreground hover:text-primary-foreground transition-all active:scale-90 outline-none focus-visible:ring-2 focus-visible:ring-primary"
            :class="layoutStore.cardSizeMode === 'compact' ? 'w-6 h-6' : 'w-8 h-8'"
            title="导出处理后的图片"
          >
            <Download :size="layoutStore.cardSizeMode === 'compact' ? 12 : 16" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 脏状态边框呼吸动画 */
@keyframes dirty-pulse {
  0%,
  100% {
    border-color: rgba(245, 158, 11, 0.3);
    box-shadow: 0 0 5px rgba(245, 158, 11, 0.05);
  }
  50% {
    border-color: rgba(245, 158, 11, 0.6);
    box-shadow: 0 0 15px rgba(245, 158, 11, 0.2);
  }
}

.animate-dirty-pulse {
  animation: dirty-pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite;
}

/* 斜纹背景与滚动动画 */
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
  from {
    transform: translateX(0) translateY(0);
  }
  to {
    transform: translateX(40px) translateY(40px);
  }
}

.animate-stripe-scroll {
  animation: stripe-scroll 3s linear infinite;
}

@media (prefers-reduced-motion: reduce) {
  .animate-dirty-pulse,
  .animate-stripe-scroll {
    animation: none !important;
  }
}
</style>
