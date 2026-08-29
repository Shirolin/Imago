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
  AlertCircle,
  Loader2,
  MousePointer2
} from 'lucide-vue-next'
import { useImageStore, type ImageItem } from '../../stores/imageStore'
import { useLayoutStore } from '../../stores/layoutStore'
import { useI18n } from 'vue-i18n'
import AppModal from './AppModal.vue'
import AppButton from './AppButton.vue'

const store = useImageStore()
const layoutStore = useLayoutStore()
const { t } = useI18n()

interface Props {
  image: ImageItem
  isSelected?: boolean
  imageStyle?: CSSProperties
  allowMagnifier?: boolean
  showTransparency?: boolean
  processedPreview?: string
  processedBlob?: Blob
  isDirty?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isSelected: false,
  imageStyle: () => ({}),
  allowMagnifier: true,
  showTransparency: false,
  processedPreview: undefined,
  processedBlob: undefined,
  isDirty: false
})
const emit = defineEmits(['toggle', 'remove', 'download', 'compare', 'interactive', 'reset'])

// 模式判定：严格遵循用户切换的全局指令
const isLargeMode = computed(() => layoutStore.cardSizeMode === 'large')

// 确认框状态
const showResetConfirm = ref(false)

const handleReset = () => {
  showResetConfirm.value = true
}

const confirmReset = () => {
  emit('reset', props.image.id)
  showResetConfirm.value = false
}

const imageRef = ref<HTMLElement | null>(null)

// 衍生状态
const isDirtyDone = computed(() => props.isDirty && props.image.status === 'done')

// --- 【逻辑对齐】：智能倍镜核心逻辑 ---
const showMagnifier = ref(false)
const mousePos = ref({ x: 50, y: 50 })
const originalHDUrl = ref<string | null>(null)
const localProcessedUrl = ref<string | null>(null)
const rafId = ref<number | null>(null)

// 只有在完成处理且悬停时才处理高清 URL
watch(showMagnifier, (isShowing) => {
  if (isShowing) {
    if (props.processedPreview) {
      // 切到 preview（外部 URL）：旧 blob URL 必须释放，防止泄漏
      const oldUrl = localProcessedUrl.value
      localProcessedUrl.value = props.processedPreview
      if (oldUrl && oldUrl !== props.processedPreview) URL.revokeObjectURL(oldUrl)
    } else if (props.processedBlob) {
      const oldUrl = localProcessedUrl.value
      localProcessedUrl.value = URL.createObjectURL(props.processedBlob)
      // 立即释放旧的临时 URL，防止堆积
      if (oldUrl && oldUrl !== props.processedPreview) URL.revokeObjectURL(oldUrl)
    }

    if (!originalHDUrl.value) {
      originalHDUrl.value = props.image.preview || URL.createObjectURL(props.image.file)
    }
  }
})

// 监听处理结果变化，实时更新倍镜
watch(
  () => props.processedPreview,
  (newUrl) => {
    if (showMagnifier.value && newUrl) {
      const oldUrl = localProcessedUrl.value
      localProcessedUrl.value = newUrl
      // P2-13: 替换时释放旧 blob URL（preview 是外部 URL，不释放）
      if (oldUrl && oldUrl !== newUrl) URL.revokeObjectURL(oldUrl)
    }
  }
)

// P2-13: 处理结果 Blob 变化时重建倍镜 URL，并释放被替换的旧 blob URL，
// 避免反复处理同一张图时临时 URL 无限堆积。
watch(
  () => props.processedBlob,
  (newBlob) => {
    if (!showMagnifier.value || !newBlob || props.processedPreview) return
    const oldUrl = localProcessedUrl.value
    localProcessedUrl.value = URL.createObjectURL(newBlob)
    if (oldUrl && oldUrl !== props.processedPreview) URL.revokeObjectURL(oldUrl)
  }
)

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
  // 【严谨限制】：仅在大图模式下进行坐标计算
  if (!isLargeMode.value || !props.allowMagnifier || !showMagnifier.value || !imageRef.value) return

  if (rafId.value) cancelAnimationFrame(rafId.value)

  rafId.value = requestAnimationFrame(() => {
    const rect = imageRef.value!.getBoundingClientRect()
    const x = Math.max(0, Math.min(100, ((e.clientX - rect.left) / rect.width) * 100))
    const y = Math.max(0, Math.min(100, ((e.clientY - rect.top) / rect.height) * 100))
    mousePos.value = { x, y }
  })
}

const enterMagnifier = () => {
  // 【新】：严谨切换逻辑。仅在大图模式且完成处理时允许进入倍镜
  if (
    isLargeMode.value &&
    props.allowMagnifier &&
    props.image.status === 'done' &&
    store.showMagnifier
  ) {
    showMagnifier.value = true
  }
}

const leaveMagnifier = () => {
  showMagnifier.value = false
}

const innerContainerStyle = computed<CSSProperties>(() => {
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

// 【核心对比逻辑】：计算左右分屏的裁剪路径
const dynamicClipPath = computed(() => {
  const x = mousePos.value.x
  return {
    original: `inset(0 ${100 - x}% 0 0)`,
    processed: `inset(0 0 0 ${x}%)`
  }
})

// 自动切换处理前后预览图
const displayUrl = computed(() => {
  if (props.image.status === 'done' && props.processedPreview) {
    return props.processedPreview
  }
  return props.image.preview
})

// 骨架屏：预览解码完成前显示 shimmer（纯视觉状态，不影响任何业务逻辑）
const previewLoaded = ref(false)
watch(displayUrl, () => {
  previewLoaded.value = false
})
</script>

<template>
  <div
    class="imago-sheet relative cursor-pointer flex flex-col group outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--well)] p-3.5"
    :class="[
      isSelected ? 'ring-2 ring-[var(--accent)] ring-offset-2 ring-offset-[var(--well)]' : '',
      isDirtyDone ? 'ring-1 ring-[var(--muted)]' : ''
    ]"
    tabindex="0"
    role="button"
    :aria-pressed="isSelected"
    @click="emit('toggle', image.id)"
    @keydown.enter.space.prevent="emit('toggle', image.id)"
  >
    <!-- Layer 1: Canvas (4:3) -->
    <div
      ref="imageRef"
      class="relative aspect-[4/3] flex items-center justify-center shrink-0 group/canvas"
      @mouseenter="enterMagnifier"
      @mouseleave="leaveMagnifier"
      @mousemove="handleMouseMove"
    >
      <!-- 背景预览 -->
      <div
        class="absolute inset-0 overflow-hidden bg-[var(--well)]"
        :class="{ 'app-transparency-grid-sm': showTransparency }"
      >
        <div class="absolute inset-0 z-10 pointer-events-none">
          <slot name="visual-effects" :image="image"></slot>
        </div>
        <!-- 骨架屏：预览未解码时显示 shimmer，解码完成后移除 -->
        <div
          v-if="!previewLoaded"
          class="absolute inset-0 bg-[var(--well)]"
          aria-hidden="true"
        ></div>
        <img
          :src="displayUrl"
          :alt="t('common.image.card.previewAlt', { name: image.file.name })"
          class="w-full h-full object-contain"
          @load="previewLoaded = true"
          @error="previewLoaded = true"
          :class="{
            'opacity-40 grayscale-[0.5]': image.status === 'processing'
          }"
          :style="imageStyle"
        />
        <div
          v-if="isDirtyDone"
          class="absolute inset-0 z-20 pointer-events-none overflow-hidden opacity-20"
        >
          <div class="absolute inset-[-100%] bg-stripe-pattern animate-stripe-scroll"></div>
        </div>
      </div>

      <!-- 【模式 A】：倍镜对比层 (仅在大图模式且 Hover 时显示) -->
      <div
        v-if="isLargeMode && showMagnifier && localProcessedUrl && originalHDUrl"
        class="absolute inset-0 z-40 pointer-events-none"
      >
        <div
          class="absolute w-40 h-40 md:w-48 md:h-48 -ml-20 -mt-20 md:-ml-24 md:-mt-24 rounded-full border-2 border-[var(--on-product)] overflow-hidden bg-[var(--product)] flex items-center justify-center"
          :class="{ 'app-transparency-grid-sm': showTransparency }"
          :style="{ left: `${mousePos.x}%`, top: `${mousePos.y}%` }"
        >
          <!-- 左侧：原图 -->
          <div
            class="absolute"
            :style="{ ...innerContainerStyle, clipPath: dynamicClipPath.original } as CSSProperties"
          >
            <img :src="originalHDUrl!" class="w-full h-full object-contain" />
          </div>
          <!-- 右侧：处理后图 -->
          <div
            class="absolute"
            :style="
              { ...innerContainerStyle, clipPath: dynamicClipPath.processed } as CSSProperties
            "
          >
            <img :src="localProcessedUrl!" class="w-full h-full object-contain" />
          </div>
          <!-- 动态分割线 -->
          <div class="absolute inset-y-0 left-1/2 w-0.5 bg-[var(--on-product)] z-10"></div>
          <div
            class="absolute inset-0 flex items-center justify-between px-2 text-[10px] pointer-events-none z-20"
          >
            <span
              class="bg-[var(--product)] px-1.5 py-0.5 rounded text-[var(--on-product)] font-medium"
              >{{ $t('common.image.card.before') }}</span
            >
            <span
              class="bg-[var(--accent)] px-1.5 py-0.5 rounded text-[var(--on-product)] font-medium"
              >{{ $t('common.image.card.after') }}</span
            >
          </div>
        </div>
      </div>

      <!-- 【模式 B】：Hover HUD 托盘 (仅在小图模式 + 有可用操作时浮现) -->
      <div
        v-if="!isLargeMode && (image.status === 'done' || image.status === 'error')"
        class="absolute bottom-3 left-3 right-3 z-30 bg-[var(--board)] border border-[var(--hairline)] rounded-[var(--radius-ctrl)] p-1.5 flex items-center justify-between gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto touch-reveal"
      >
        <div class="flex items-center gap-1">
          <button
            v-if="image.status === 'done'"
            @click.stop="emit('compare', image.id)"
            class="p-1.5 hover:bg-primary/10 text-muted-foreground hover:text-primary rounded-lg transition-all"
            :aria-label="t('common.image.card.compare')"
          >
            <Columns2 :size="14" />
          </button>
          <button
            v-if="image.status === 'done' || image.status === 'error'"
            @click.stop="handleReset"
            class="p-1.5 hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-lg transition-all"
            :aria-label="t('common.image.card.reset')"
          >
            <RotateCcw :size="14" />
          </button>
        </div>
        <div class="flex items-center gap-1.5">
          <button
            v-if="image.status === 'done'"
            @click.stop="emit('interactive', image.id)"
            class="p-1.5 hover:bg-primary/10 text-muted-foreground hover:text-primary rounded-[var(--radius)] transition-colors"
            :aria-label="t('common.image.card.sam2')"
            :title="t('common.image.card.sam2')"
          >
            <MousePointer2 :size="14" />
          </button>
          <button
            v-if="image.status === 'done'"
            @click.stop="emit('download', image.id)"
            class="p-1.5 bg-[var(--accent)] text-[var(--on-product)] rounded-[var(--radius-ctrl)] active:brightness-95 transition-colors"
            :aria-label="t('common.image.card.download')"
          >
            <Download :size="14" />
          </button>
        </div>
      </div>

      <!-- 静态覆盖层 (Checkbox & X) -->
      <div v-if="!showMagnifier" class="absolute top-3 left-3 z-30 flex items-center gap-2">
        <div
          class="transition-all duration-300"
          :class="
            isSelected
              ? 'text-primary scale-110'
              : 'text-[var(--ink)]/40 opacity-0 group-hover:opacity-100'
          "
        >
          <CheckSquare v-if="isSelected" :size="20" />
          <Square v-else :size="20" />
        </div>
        <slot name="overlay" :image="image"></slot>
      </div>
      <button
        v-if="!showMagnifier"
        @click.stop="store.removeImage(image.id)"
        class="absolute top-3 right-3 z-30 bg-[var(--board)] hover:bg-[var(--danger)] text-[var(--muted)] hover:text-[var(--on-product)] p-1.5 rounded-[var(--radius-ctrl)] opacity-0 group-hover:opacity-100 transition-colors border border-[var(--hairline)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] touch-reveal"
        :title="$t('common.image.card.remove')"
        :aria-label="$t('common.image.card.remove')"
      >
        <X :size="14" />
      </button>

      <!-- 处理中中心进度 -->
      <div
        v-if="image.status === 'processing'"
        class="absolute inset-0 bg-[var(--board)]/70 z-30 flex items-center justify-center"
      >
        <Loader2 :size="24" class="text-primary animate-spin" />
      </div>
    </div>

    <!-- Layer 2: Info Area -->
    <div class="pt-2.5 flex flex-col gap-1.5 min-w-0">
      <!-- 处理失败提示 -->
      <div
        v-if="image.status === 'error'"
        class="flex items-center gap-1.5 text-[11px] font-bold text-destructive bg-destructive/10 border border-destructive/20 rounded-lg px-2 py-1.5"
        role="alert"
      >
        <AlertCircle :size="13" class="shrink-0" />
        <span class="truncate min-w-0">{{
          image.error || $t('common.image.compare.errorTitle')
        }}</span>
      </div>

      <div class="flex items-center justify-between gap-2">
        <h4 class="font-medium text-[var(--ink)] truncate text-sm flex-1">
          {{ image.file.name }}
        </h4>
        <div class="shrink-0 flex items-center gap-1.5">
          <div
            v-if="image.status === 'done'"
            class="w-2 h-2 rounded-full bg-success"
            :class="{ 'bg-[var(--muted)]': isDirty }"
          ></div>
          <Loader2
            v-else-if="image.status === 'processing'"
            :size="12"
            class="text-primary animate-spin"
          />
        </div>
      </div>
      <slot name="meta" :image="image"></slot>

      <!-- 【大图模式专属】：Large Mode Action Bar -->
      <div
        v-if="isLargeMode"
        class="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--hairline)]"
      >
        <button
          v-if="image.status === 'done'"
          class="flex-1 flex items-center justify-center gap-2 h-9 rounded-[var(--radius-ctrl)] bg-[var(--on-product)]/10 hover:bg-[var(--on-product)]/16 text-[var(--on-product)]/70 hover:text-[var(--on-product)] transition-colors text-[12px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          @click.stop="emit('compare', image.id)"
          :aria-label="t('common.image.card.compare')"
        >
          <Columns2 :size="14" />
          <span>{{ t('common.image.card.compare') }}</span>
        </button>
        <button
          v-if="image.status === 'done' || image.status === 'error'"
          class="flex-1 flex items-center justify-center gap-2 h-9 rounded-[var(--radius-ctrl)] bg-[var(--on-product)]/10 hover:bg-[var(--danger)]/15 text-[var(--on-product)]/70 hover:text-[var(--danger)] transition-colors text-[12px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-[var(--danger)]"
          @click.stop="handleReset"
          :aria-label="t('common.image.card.reset')"
        >
          <RotateCcw :size="14" />
          <span>{{ t('common.image.card.reset') }}</span>
        </button>
        <button
          v-if="image.status === 'done'"
          class="flex-1 flex items-center justify-center gap-2 h-9 rounded-[var(--radius-ctrl)] bg-[var(--on-product)]/10 hover:bg-[var(--on-product)]/16 text-[var(--on-product)]/70 hover:text-[var(--on-product)] transition-colors text-[12px] font-medium outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          @click.stop="emit('interactive', image.id)"
          :aria-label="t('common.image.card.sam2')"
        >
          <MousePointer2 :size="14" />
          <span>{{ t('common.image.card.sam2') }}</span>
        </button>
        <div class="flex gap-2 ml-auto pl-2 border-l border-[var(--hairline)]">
          <button
            v-if="image.status === 'done'"
            @click.stop="emit('download', image.id)"
            class="p-2 bg-[var(--accent)] text-[var(--on-product)] rounded-[var(--radius-ctrl)] hover:brightness-95 transition-colors outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
            :title="t('common.image.card.download')"
            :aria-label="t('common.image.card.download')"
          >
            <Download :size="16" />
          </button>
        </div>
      </div>
    </div>

    <!-- 重置确认对话框 -->
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
            <h3 class="text-lg font-medium text-foreground mb-1">
              {{ t('common.image.toolbar.confirmReset') }}
            </h3>
            <p class="text-muted-foreground text-sm leading-relaxed font-medium">
              {{ t('common.image.toolbar.confirmResetTitle') }}
            </p>
          </div>
        </div>
        <div class="flex gap-3">
          <AppButton
            variant="ghost"
            class="flex-1 rounded-[var(--radius-ctrl)] h-11"
            @click="showResetConfirm = false"
          >
            {{ t('common.image.toolbar.cancel') }}
          </AppButton>
          <AppButton
            variant="danger"
            class="flex-1 rounded-[var(--radius-ctrl)] h-11"
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
/* 触屏设备：hover 不可靠，HUD 与删除按钮常驻显示 */
@media (hover: none) {
  .touch-reveal {
    opacity: 1 !important;
    transform: none !important;
  }
}
.animate-dirty-pulse {
  animation: dirty-pulse 2.5s ease-in-out infinite;
}
@keyframes dirty-pulse {
  0%,
  100% {
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 20%, transparent);
  }
  50% {
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--accent) 40%, transparent);
  }
}
.bg-stripe-pattern {
  background-image: repeating-linear-gradient(
    45deg,
    transparent,
    transparent 20px,
    color-mix(in srgb, var(--accent) 12%, transparent) 20px,
    color-mix(in srgb, var(--accent) 12%, transparent) 40px
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
</style>
