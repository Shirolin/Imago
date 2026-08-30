<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { Heart } from 'lucide-vue-next'
import AppButton from '../components/common/AppButton.vue'
import LanguageSwitcher from '../components/common/LanguageSwitcher.vue'
import SponsorModal from '../components/SponsorModal.vue'

const { t } = useI18n()
const router = useRouter()
const listRef = ref<HTMLElement | null>(null)
const fadeTop = ref(false)
const fadeBottom = ref(true)
const showSponsorModal = ref(false)

const steps = computed(() => [
  { n: '01', label: t('cover.steps.compress'), to: '/compress' },
  { n: '02', label: t('cover.steps.crop'), to: '/crop' },
  { n: '03', label: t('cover.steps.exif'), to: '/exif' },
  { n: '04', label: t('cover.steps.split'), to: '/split' },
  { n: '05', label: t('cover.steps.combine'), to: '/combine' },
  { n: '06', label: t('cover.steps.bgRemove'), to: '/bg-remove' },
  { n: '07', label: t('cover.steps.filters'), to: '/filters' },
  { n: '08', label: t('cover.steps.favicon'), to: '/favicon' }
])

const goToStep = (to: string) => {
  router.push(to)
}

const syncTicketFade = () => {
  const el = listRef.value
  if (!el) return
  fadeTop.value = el.scrollTop > 2
  fadeBottom.value = el.scrollTop + el.clientHeight < el.scrollHeight - 2
}

const enterWorkbench = () => {
  router.push('/compress')
}

onMounted(() => {
  syncTicketFade()
})
</script>

<template>
  <div class="relative h-full w-full min-h-0 bg-[var(--paper)] text-[var(--ink)]">
    <header
      class="absolute inset-x-0 top-0 z-20 flex items-center justify-between px-4 pt-[calc(1.25rem+env(safe-area-inset-top,0px))] md:px-10 md:pt-7"
    >
      <span class="imago-serif text-[28px] font-semibold leading-none tracking-tight">Imago</span>
      <div class="flex items-center gap-1">
        <span
          class="mr-2 hidden text-[12px] font-medium tracking-[0.04em] text-[var(--muted)] sm:inline"
          >{{ t('app.localProcessing') }}</span
        >
        <LanguageSwitcher placement="top" align="right" />
        <button
          type="button"
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-[var(--radius)] text-[var(--muted)] outline-none transition-colors hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] hover:text-[var(--ink)] focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          :title="t('nav.sponsor')"
          :aria-label="t('nav.sponsor')"
          @click="showSponsorModal = true"
        >
          <Heart :size="16" />
        </button>
      </div>
    </header>

    <div class="h-full w-full min-h-0 overflow-y-auto overflow-x-hidden custom-scrollbar">
      <div
        class="flex min-h-full w-full flex-col items-center justify-center gap-8 px-4 pb-[calc(6rem+env(safe-area-inset-bottom,0px))] pt-24 md:flex-row md:gap-16 md:px-16 md:pb-8 md:pt-20"
      >
        <figure class="imago-board shrink-0 rounded-[var(--radius-well)] p-6 md:p-14">
          <img
            src="/cover-print.jpg"
            :alt="t('cover.printAlt')"
            class="block aspect-[3/4] w-[min(56vw,200px)] max-w-[280px] object-cover md:w-[min(42vw,280px)]"
            width="1024"
            height="1536"
          />
        </figure>

        <aside class="flex w-full max-w-[16rem] shrink-0 flex-col self-center md:w-[10.5rem]">
          <p class="imago-serif text-[22px] font-medium leading-none tracking-wide">
            {{ t('cover.ticket') }}
          </p>
          <p class="mt-2 text-[12px] tabular-nums tracking-[0.08em] text-[var(--muted)]">
            {{ t('cover.ticketNo') }}
          </p>
          <ol
            ref="listRef"
            class="imago-ticket-list mt-5"
            :class="{ 'is-fade-top': fadeTop, 'is-fade-bottom': fadeBottom }"
            @scroll.passive="syncTicketFade"
          >
            <li v-for="step in steps" :key="step.n">
              <button type="button" class="imago-ticket-row min-h-10" @click="goToStep(step.to)">
                <span class="imago-ticket-no w-6 shrink-0 tabular-nums text-[13px]">{{
                  step.n
                }}</span>
                <span class="imago-ticket-label text-[15px] leading-none">{{ step.label }}</span>
              </button>
            </li>
          </ol>
        </aside>
      </div>
    </div>

    <div
      class="absolute bottom-[calc(1.5rem+env(safe-area-inset-bottom,0px))] right-4 z-10 md:bottom-8 md:right-8"
    >
      <AppButton
        variant="cta"
        size="lg"
        class="min-w-[7.5rem] min-h-11 px-6"
        @click="enterWorkbench"
      >
        {{ t('cover.start') }}
      </AppButton>
    </div>

    <SponsorModal :show="showSponsorModal" @close="showSponsorModal = false" />
  </div>
</template>
