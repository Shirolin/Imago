<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import AppModal from './common/AppModal.vue'
import AppButton from './common/AppButton.vue'
import { Coffee, Heart, ExternalLink, Zap, Github } from 'lucide-vue-next'

defineProps<{
  show: boolean
}>()

const emit = defineEmits(['close'])
const { t } = useI18n()
</script>

<template>
  <AppModal
    :show="show"
    :title="t('common.modal.sponsor.title')"
    variant="dialog"
    @close="emit('close')"
  >
    <div class="p-6 space-y-6 overflow-hidden">
      <div class="text-center animate-in fade-in slide-in-from-bottom-4 duration-700 ease-apple">
        <div
          class="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4 relative"
        >
          <!-- 核心：双重光晕心跳 -->
          <div class="absolute inset-0 bg-primary/20 rounded-full animate-heart-halo"></div>
          <Heart
            class="text-primary animate-heart-beat relative z-10"
            :size="32"
            fill="currentColor"
          />
        </div>
        <h3 class="text-xl font-black tracking-tight">{{ t('common.modal.sponsor.heroTitle') }}</h3>
      </div>

      <div class="grid gap-4">
        <!-- Featured: GitHub -->
        <a
          href="https://github.com/Shirolin/Imago"
          target="_blank"
          rel="noopener noreferrer"
          :aria-label="t('common.modal.sponsor.githubAria')"
          class="flex flex-col gap-4 p-5 bg-foreground/5 hover:bg-foreground/[0.08] border border-border/50 rounded-[2rem] transition-[background-color,border-color,box-shadow] duration-300 group relative overflow-hidden shrink-0 animate-in fade-in slide-in-from-bottom-6 duration-700 ease-apple delay-100"
          style="animation-fill-mode: both"
        >
          <div class="flex items-center justify-between relative z-10">
            <div
              class="w-12 h-12 bg-foreground rounded-2xl flex items-center justify-center text-background shadow-lg group-hover:scale-110 group-hover:rotate-[-4deg] transition-all duration-500 ease-apple"
            >
              <Github :size="24" />
            </div>
            <div class="flex flex-col items-end">
              <div
                class="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/50"
              >
                {{ t('common.modal.sponsor.community') }}
              </div>
              <ExternalLink
                :size="16"
                class="text-muted-foreground/40 mt-1 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              />
            </div>
          </div>
          <div class="relative z-10">
            <div class="font-black text-lg tracking-tight mb-1 truncate">
              {{ t('common.modal.sponsor.githubStar') }}
            </div>
            <div class="text-xs text-muted-foreground/80 leading-relaxed line-clamp-2">
              {{ t('common.modal.sponsor.githubDesc') }}
            </div>
          </div>
          <!-- 装饰性背景图标：优化 transition 属性 -->
          <Github
            aria-hidden="true"
            class="absolute -right-4 -bottom-4 text-foreground/[0.03] rotate-12 scale-[2.5] pointer-events-none transition-[transform,opacity] group-hover:rotate-0 group-hover:scale-[2.8] duration-1000 ease-apple"
          />
        </a>

        <!-- Secondary Actions: Staggered -->
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 shrink-0">
          <!-- 爱发电 -->
          <a
            href="https://ifdian.net/a/shirolin"
            target="_blank"
            rel="noopener noreferrer"
            :aria-label="t('common.modal.sponsor.afdianAria')"
            class="relative flex flex-row sm:flex-col items-center sm:items-start gap-3 p-4 bg-[oklch(0.6_0.2_300/0.08)] hover:bg-[oklch(0.6_0.2_300/0.12)] border border-[oklch(0.6_0.2_300/0.2)] rounded-[1.5rem] transition-[background-color,border-color,box-shadow] duration-300 group min-w-0 animate-in fade-in slide-in-from-bottom-8 duration-700 ease-apple delay-200"
            style="animation-fill-mode: both"
          >
            <div class="flex items-center justify-between w-full sm:w-auto">
              <div
                class="w-8 h-8 bg-[oklch(0.6_0.2_300)] rounded-lg flex items-center justify-center text-white shadow-lg shadow-[oklch(0.6_0.2_300/0.2)] group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 ease-apple"
              >
                <Zap :size="16" fill="currentColor" />
              </div>
              <ExternalLink :size="14" class="text-purple-500/40 sm:hidden" />
            </div>
            <div class="min-w-0 flex-1 sm:flex-none">
              <div class="flex items-center justify-between sm:block relative">
                <div class="font-bold text-sm text-purple-600 dark:text-purple-400 truncate">
                  {{ t('common.modal.sponsor.afdian') }}
                </div>
                <ExternalLink
                  :size="14"
                  class="text-purple-500/40 hidden sm:block absolute -top-1 -right-1"
                />
              </div>
              <div
                class="text-[9px] text-muted-foreground font-bold uppercase tracking-wider mt-0.5 truncate"
              >
                {{ t('common.modal.sponsor.afdianTip') }}
              </div>
            </div>
          </a>

          <!-- Ko-fi -->
          <a
            href="https://ko-fi.com/shirolin"
            target="_blank"
            rel="noopener noreferrer"
            :aria-label="t('common.modal.sponsor.kofiAria')"
            class="relative flex flex-row sm:flex-col items-center sm:items-start gap-3 p-4 bg-[oklch(0.6_0.2_250/0.08)] hover:bg-[oklch(0.6_0.2_250/0.12)] border border-[oklch(0.6_0.2_250/0.2)] rounded-[1.5rem] transition-[background-color,border-color,box-shadow] duration-300 group min-w-0 animate-in fade-in slide-in-from-bottom-8 duration-700 ease-apple delay-300"
            style="animation-fill-mode: both"
          >
            <div class="flex items-center justify-between w-full sm:w-auto">
              <div
                class="w-8 h-8 bg-[oklch(0.6_0.2_250)] rounded-lg flex items-center justify-center text-white shadow-lg shadow-[oklch(0.6_0.2_250/0.2)] group-hover:scale-110 group-hover:-rotate-6 transition-all duration-500 ease-apple"
              >
                <Coffee :size="16" />
              </div>
              <ExternalLink :size="14" class="text-blue-500/40 sm:hidden" />
            </div>
            <div class="min-w-0 flex-1 sm:flex-none">
              <div class="flex items-center justify-between sm:block relative">
                <div class="font-bold text-sm text-blue-600 dark:text-blue-400 truncate">
                  {{ t('common.modal.sponsor.kofi') }}
                </div>
                <ExternalLink
                  :size="14"
                  class="text-blue-500/40 hidden sm:block absolute -top-1 -right-1"
                />
              </div>
              <div
                class="text-[9px] text-muted-foreground font-bold uppercase tracking-wider mt-0.5 truncate"
              >
                {{ t('common.modal.sponsor.kofiTip') }}
              </div>
            </div>
          </a>
        </div>

        <p
          class="px-4 py-2 text-[10px] text-muted-foreground/60 leading-relaxed text-center italic animate-in fade-in duration-1000 delay-500"
        >
          {{ t('common.modal.sponsor.footer') }}
        </p>
      </div>
    </div>

    <template #footer>
      <AppButton variant="secondary" class="w-full h-11 rounded-xl" @click="emit('close')">
        {{ t('common.image.toolbar.cancel') }}
      </AppButton>
    </template>
  </AppModal>
</template>

<style scoped>
@keyframes heart-beat {
  0%,
  100% {
    transform: scale(1);
  }
  10% {
    transform: scale(1.15);
  }
  20% {
    transform: scale(1);
  }
  30% {
    transform: scale(1.1);
  }
  45% {
    transform: scale(1);
  }
}

@keyframes heart-halo {
  0% {
    transform: scale(1);
    opacity: 0.5;
  }
  100% {
    transform: scale(1.8);
    opacity: 0;
  }
}

.animate-heart-beat {
  animation: heart-beat 2.5s infinite cubic-bezier(0.4, 0, 0.2, 1);
}

.animate-heart-halo {
  animation: heart-halo 2.5s infinite cubic-bezier(0.4, 0, 0.2, 1);
}

.ease-apple {
  transition-timing-function: cubic-bezier(0.22, 1, 0.36, 1);
}

@media (prefers-reduced-motion: reduce) {
  .animate-heart-beat,
  .animate-heart-halo,
  .animate-in {
    animation: none !important;
    transition: none !important;
  }
}
</style>
