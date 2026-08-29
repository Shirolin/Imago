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
      <div class="text-center">
        <Heart class="text-primary mx-auto mb-4" :size="32" fill="currentColor" />
        <h3 class="text-xl font-medium">{{ t('common.modal.sponsor.heroTitle') }}</h3>
      </div>

      <div class="grid gap-4">
        <a
          href="https://github.com/Shirolin/Imago"
          target="_blank"
          rel="noopener noreferrer"
          :aria-label="t('common.modal.sponsor.githubAria')"
          class="flex flex-col gap-4 p-5 bg-foreground/5 hover:bg-foreground/[0.08] border border-[var(--hairline)] rounded-[var(--radius-well)] transition-colors group relative overflow-hidden shrink-0"
        >
          <div class="flex items-center justify-between relative z-10">
            <div
              class="w-12 h-12 bg-foreground rounded-[var(--radius-ctrl)] flex items-center justify-center text-background"
            >
              <Github :size="24" />
            </div>
            <div class="flex flex-col items-end">
              <div class="text-[11px] font-medium text-muted-foreground/50">
                {{ t('common.modal.sponsor.community') }}
              </div>
              <ExternalLink :size="16" class="text-muted-foreground/40 mt-1" />
            </div>
          </div>
          <div class="relative z-10">
            <div class="font-medium text-lg mb-1 truncate">
              {{ t('common.modal.sponsor.githubStar') }}
            </div>
            <div class="text-xs text-muted-foreground/80 leading-relaxed line-clamp-2">
              {{ t('common.modal.sponsor.githubDesc') }}
            </div>
          </div>
        </a>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 shrink-0">
          <a
            href="https://ifdian.net/a/shirolin"
            target="_blank"
            rel="noopener noreferrer"
            :aria-label="t('common.modal.sponsor.afdianAria')"
            class="relative flex flex-row sm:flex-col items-center sm:items-start gap-3 p-4 bg-primary/5 hover:bg-primary/10 border border-primary/20 rounded-[var(--radius-ctrl)] transition-colors group min-w-0"
          >
            <div class="flex items-center justify-between w-full sm:w-auto">
              <div
                class="w-8 h-8 bg-primary rounded-[var(--radius-ctrl)] flex items-center justify-center text-primary-foreground"
              >
                <Zap :size="16" fill="currentColor" />
              </div>
              <ExternalLink :size="14" class="text-primary/40 sm:hidden" />
            </div>
            <div class="min-w-0 flex-1 sm:flex-none">
              <div class="flex items-center justify-between sm:block relative">
                <div class="font-medium text-sm text-primary truncate">
                  {{ t('common.modal.sponsor.afdian') }}
                </div>
                <ExternalLink
                  :size="14"
                  class="text-primary/40 hidden sm:block absolute -top-1 -right-1"
                />
              </div>
              <div class="text-[11px] text-muted-foreground font-medium mt-0.5 truncate">
                {{ t('common.modal.sponsor.afdianTip') }}
              </div>
            </div>
          </a>

          <a
            href="https://ko-fi.com/shirolin"
            target="_blank"
            rel="noopener noreferrer"
            :aria-label="t('common.modal.sponsor.kofiAria')"
            class="relative flex flex-row sm:flex-col items-center sm:items-start gap-3 p-4 bg-primary/5 hover:bg-primary/10 border border-primary/20 rounded-[var(--radius-ctrl)] transition-colors group min-w-0"
          >
            <div class="flex items-center justify-between w-full sm:w-auto">
              <div
                class="w-8 h-8 bg-primary rounded-[var(--radius-ctrl)] flex items-center justify-center text-primary-foreground"
              >
                <Coffee :size="16" />
              </div>
              <ExternalLink :size="14" class="text-primary/40 sm:hidden" />
            </div>
            <div class="min-w-0 flex-1 sm:flex-none">
              <div class="flex items-center justify-between sm:block relative">
                <div class="font-medium text-sm text-primary truncate">
                  {{ t('common.modal.sponsor.kofi') }}
                </div>
                <ExternalLink
                  :size="14"
                  class="text-primary/40 hidden sm:block absolute -top-1 -right-1"
                />
              </div>
              <div class="text-[11px] text-muted-foreground font-medium mt-0.5 truncate">
                {{ t('common.modal.sponsor.kofiTip') }}
              </div>
            </div>
          </a>
        </div>

        <p class="px-4 py-2 text-[10px] text-muted-foreground/60 leading-relaxed text-center">
          {{ t('common.modal.sponsor.footer') }}
        </p>
      </div>
    </div>

    <template #footer>
      <AppButton
        fill
        variant="secondary"
        class="w-full rounded-[var(--radius-ctrl)]"
        @click="emit('close')"
      >
        {{ t('common.image.toolbar.cancel') }}
      </AppButton>
    </template>
  </AppModal>
</template>
