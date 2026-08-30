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
import { useBreakpoints } from '../../composables/useBreakpoints'
import { cardActionChrome as resolveCardActionChrome } from '../../composables/cardChrome'
import { useI18n } from 'vue-i18n'
import AppModal from './AppModal.vue'
import AppButton from './AppButton.vue'

const store = useImageStore()
const layoutStore = useLayoutStore()
const { isOverlayChrome } = useBreakpoints()
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
  showCompare?: boolean
  showDownload?: boolean
  showInteractive?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  isSelected: false,
  imageStyle: () => ({}),
  allowMagnifier: true,
  showTransparency: false,
  processedPreview: undefined,
  processedBlob: undefined,
  isDirty: false,
  showCompare: true,
  showDownload: true,
  showInteractive: false
})
const emit = defineEmits(['toggle', 'remove', 'download', 'compare', 'interactive', 'reset'])

const isLargeMode = computed(() => layoutStore.cardSizeMode === 'large')
const actionChrome = computed(() =>
  resolveCardActionChrome({
    large: isLargeMode.value,
    overlay: isOverlayChrome.value
  })
)
const statusLabel = computed(() => {
  if (props.image.status !== 'done') return ''
  return props.isDirty ? t('common.image.card.dirty') : t('common.image.card.ready')
})

const showResetConfirm = ref(false)

const handleReset = () => {
  showResetConfirm.value = true
}

const confirmReset = () => {
  emit('reset', props.image.id)
  showResetConfirm.value = false
}

const imageRef = ref<HTMLElement | null>(null)

const isDirtyDone = computed(() => props.isDirty && props.image.status === 'done')

const showMagnifier = ref(false)
const mousePos = ref({ x: 50, y: 50 })
const originalHDUrl = ref<string | null>(null)
const localProcessedUrl = ref<string | null>(null)
const rafId = ref<number | null>(null)

watch(showMagnifier, (isShowing) => {
  if (isShowing) {
    if (props.processedPreview) {
      const oldUrl = localProcessedUrl.value
      localProcessedUrl.value = props.processedPreview
      if (oldUrl && oldUrl !== props.processedPreview) URL.revokeObjectURL(oldUrl)
    } else if (props.processedBlob) {
      const oldUrl = localProcessedUrl.value
      localProcessedUrl.value = URL.createObjectURL(props.processedBlob)
      if (oldUrl && oldUrl !== props.processedPreview) URL.revokeObjectURL(oldUrl)
    }

    if (!originalHDUrl.value) {
      originalHDUrl.value = props.image.preview || URL.createObjectURL(props.image.file)
    }
  }
})

watch(
  () => props.processedPreview,
  (newUrl) => {
    if (showMagnifier.value && newUrl) {
      const oldUrl = localProcessedUrl.value
      localProcessedUrl.value = newUrl
      if (oldUrl && oldUrl !== newUrl) URL.revokeObjectURL(oldUrl)
    }
  }
)

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

const dynamicClipPath = computed(() => {
  const x = mousePos.value.x
  return {
    original: `inset(0 ${100 - x}% 0 0)`,
    processed: `inset(0 0 0 ${x}%)`
  }
})

const displayUrl = computed(() => {
  if (props.image.status === 'done' && props.processedPreview) {
    return props.processedPreview
  }
  return props.image.preview
})

const previewLoaded = ref(false)
watch(displayUrl, () => {
  previewLoaded.value = false
})
</script>

<template>
  <div
    class="imago-sheet relative cursor-pointer flex flex-col group outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--well)] p-3 md:p-8"
    :class="[isDirtyDone ? 'ring-1 ring-[var(--muted)]' : '']"
    tabindex="0"
    role="button"
    :aria-pressed="isSelected"
    @click="emit('toggle', image.id)"
    @keydown.enter.space.prevent="emit('toggle', image.id)"
  >
    <div
      ref="imageRef"
      class="relative aspect-[4/3] flex items-center justify-center shrink-0 group/canvas"
      @mouseenter="enterMagnifier"
      @mouseleave="leaveMagnifier"
      @mousemove="handleMouseMove"
    >
      <div
        class="absolute inset-0 overflow-hidden bg-[var(--well)]"
        :class="{ 'app-transparency-grid-sm': showTransparency }"
      >
        <div class="absolute inset-0 z-10 pointer-events-none">
          <slot name="visual-effects" :image="image"></slot>
        </div>
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

      <div
        v-if="isLargeMode && showMagnifier && localProcessedUrl && originalHDUrl"
        class="absolute inset-0 z-40 pointer-events-none"
      >
        <div
          class="absolute w-40 h-40 md:w-48 md:h-48 -ml-20 -mt-20 md:-ml-24 md:-mt-24 rounded-full border-2 border-[var(--on-product)] overflow-hidden bg-[var(--product)] flex items-center justify-center"
          :class="{ 'app-transparency-grid-sm': showTransparency }"
          :style="{ left: `${mousePos.x}%`, top: `${mousePos.y}%` }"
        >
          <div
            class="absolute"
            :style="{ ...innerContainerStyle, clipPath: dynamicClipPath.original } as CSSProperties"
          >
            <img :src="originalHDUrl!" class="w-full h-full object-contain" />
          </div>
          <div
            class="absolute"
            :style="
              { ...innerContainerStyle, clipPath: dynamicClipPath.processed } as CSSProperties
            "
          >
            <img :src="localProcessedUrl!" class="w-full h-full object-contain" />
          </div>
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

      <div
        v-if="actionChrome === 'hud' && (image.status === 'done' || image.status === 'error')"
        class="absolute bottom-2 left-2 right-2 z-30 bg-[var(--board)] border border-[var(--hairline)] rounded-[var(--radius-ctrl)] p-1 flex items-center justify-between gap-1 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto touch-reveal md:bottom-3 md:left-3 md:right-3 md:p-1.5 md:gap-1.5"
      >
        <div class="flex items-center gap-1">
          <button
            v-if="showCompare && image.status === 'done'"
            @click.stop="emit('compare', image.id)"
            class="p-1.5 min-h-10 min-w-10 flex items-center justify-center hover:bg-primary/10 text-muted-foreground hover:text-primary rounded-lg transition-all"
            :aria-label="t('common.image.card.compare')"
          >
            <Columns2 :size="14" />
          </button>
          <button
            v-if="image.status === 'done' || image.status === 'error'"
            @click.stop="handleReset"
            class="p-1.5 min-h-10 min-w-10 flex items-center justify-center hover:bg-destructive/10 text-muted-foreground hover:text-destructive rounded-lg transition-all"
            :aria-label="t('common.image.card.reset')"
          >
            <RotateCcw :size="14" />
          </button>
        </div>
        <div class="flex items-center gap-1.5">
          <button
            v-if="showInteractive && image.status === 'done'"
            @click.stop="emit('interactive', image.id)"
            class="p-1.5 min-h-10 min-w-10 flex items-center justify-center hover:bg-primary/10 text-muted-foreground hover:text-primary rounded-[var(--radius)] transition-colors"
            :aria-label="t('common.image.card.sam2')"
            :title="t('common.image.card.sam2')"
          >
            <MousePointer2 :size="14" />
          </button>
          <button
            v-if="showDownload && image.status === 'done'"
            @click.stop="emit('download', image.id)"
            class="p-1.5 min-h-10 min-w-10 flex items-center justify-center bg-[var(--accent)] text-[var(--on-product)] rounded-[var(--radius-ctrl)] active:brightness-95 transition-colors"
            :aria-label="t('common.image.card.download')"
          >
            <Download :size="14" />
          </button>
        </div>
      </div>

      <div v-if="!showMagnifier" class="absolute top-3 left-3 z-30 flex items-center gap-2">
        <div
          class="transition-all duration-300"
          :class="
            isSelected
              ? 'text-primary scale-110'
              : 'text-[var(--ink)]/40 opacity-0 group-hover:opacity-100 touch-reveal'
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
        class="absolute top-2 right-2 z-30 bg-[var(--board)] hover:bg-[var(--danger)] text-[var(--muted)] hover:text-[var(--on-product)] p-2 min-h-10 min-w-10 flex items-center justify-center rounded-[var(--radius-ctrl)] opacity-0 group-hover:opacity-100 transition-colors border border-[var(--hairline)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] touch-reveal md:top-3 md:right-3"
        :title="$t('common.image.card.remove')"
        :aria-label="$t('common.image.card.remove')"
      >
        <X :size="14" />
      </button>

      <div
        v-if="image.status === 'processing'"
        class="absolute inset-0 bg-[var(--board)]/70 z-30 flex items-center justify-center"
      >
        <Loader2 :size="24" class="text-primary animate-spin" />
      </div>
    </div>

    <div class="pt-2.5 flex flex-col gap-1.5 min-w-0">
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
          <span
            v-if="image.status === 'done'"
            class="text-[11px] font-medium text-[var(--muted)]"
            :class="{ 'text-[var(--accent)]': !isDirty }"
          >
            {{ statusLabel }}
          </span>
          <Loader2
            v-else-if="image.status === 'processing'"
            :size="12"
            class="text-primary animate-spin"
            :aria-label="t('common.image.card.wait')"
          />
        </div>
      </div>
      <slot name="meta" :image="image"></slot>

      <div
        v-if="actionChrome === 'bar' && (image.status === 'done' || image.status === 'error')"
        class="flex items-center gap-2 mt-3 pt-3 border-t border-[var(--hairline)]"
      >
        <button
          v-if="showCompare && image.status === 'done'"
          class="flex-1 min-w-0 flex items-center justify-center gap-2 min-h-9 h-auto py-1.5 rounded-[var(--radius-ctrl)] bg-[var(--well)] hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] text-[var(--muted)] hover:text-[var(--ink)] transition-colors text-[12px] font-medium leading-tight outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          @click.stop="emit('compare', image.id)"
          :aria-label="t('common.image.card.compare')"
        >
          <Columns2 :size="14" />
          <span class="ui-label min-w-0 flex-1">{{ t('common.image.card.compare') }}</span>
        </button>
        <button
          v-if="image.status === 'done' || image.status === 'error'"
          class="flex-1 min-w-0 flex items-center justify-center gap-2 min-h-9 h-auto py-1.5 rounded-[var(--radius-ctrl)] bg-[var(--well)] hover:bg-[var(--danger)]/10 text-[var(--muted)] hover:text-[var(--danger)] transition-colors text-[12px] font-medium leading-tight outline-none focus-visible:ring-2 focus-visible:ring-[var(--danger)]"
          @click.stop="handleReset"
          :aria-label="t('common.image.card.reset')"
        >
          <RotateCcw :size="14" />
          <span class="ui-label min-w-0 flex-1">{{ t('common.image.card.reset') }}</span>
        </button>
        <button
          v-if="showInteractive && image.status === 'done'"
          class="flex-1 min-w-0 flex items-center justify-center gap-2 min-h-9 h-auto py-1.5 rounded-[var(--radius-ctrl)] bg-[var(--well)] hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] text-[var(--muted)] hover:text-[var(--ink)] transition-colors text-[12px] font-medium leading-tight outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          @click.stop="emit('interactive', image.id)"
          :aria-label="t('common.image.card.sam2')"
        >
          <MousePointer2 :size="14" />
          <span class="ui-label min-w-0 flex-1">{{ t('common.image.card.sam2') }}</span>
        </button>
        <div
          v-if="showDownload && image.status === 'done'"
          class="flex gap-2 ml-auto pl-2 border-l border-[var(--hairline)]"
        >
          <button
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
