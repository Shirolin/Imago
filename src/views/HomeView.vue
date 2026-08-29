<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import AppButton from '../components/common/AppButton.vue'

const { t } = useI18n()
const router = useRouter()
const listRef = ref<HTMLElement | null>(null)
const fadeTop = ref(false)
const fadeBottom = ref(true)

const steps = computed(() => [
  { n: '01', label: t('cover.steps.compress') },
  { n: '02', label: t('cover.steps.crop') },
  { n: '03', label: t('cover.steps.exif') },
  { n: '04', label: t('cover.steps.split') },
  { n: '05', label: t('cover.steps.combine') },
  { n: '06', label: t('cover.steps.bgRemove') },
  { n: '07', label: t('cover.steps.filters') },
  { n: '08', label: t('cover.steps.favicon') }
])

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
  <div class="relative h-full w-full min-h-0 overflow-hidden bg-[var(--paper)] text-[var(--ink)]">
    <header
      class="absolute inset-x-0 top-0 z-10 flex items-center justify-between px-8 pt-7 md:px-10"
    >
      <span class="imago-serif text-[28px] font-semibold leading-none tracking-tight">Imago</span>
      <span class="text-[12px] font-medium tracking-[0.04em] text-[var(--muted)]">{{
        t('app.localProcessing')
      }}</span>
    </header>

    <div
      class="flex h-full w-full items-center justify-center gap-10 px-8 pb-8 pt-20 md:gap-16 md:px-16"
    >
      <figure class="imago-board shrink-0 rounded-[var(--radius-well)] p-12 md:p-14">
        <img
          src="/cover-print.jpg"
          :alt="t('cover.printAlt')"
          class="block aspect-[3/4] w-[min(42vw,280px)] max-w-[280px] object-cover"
          width="1024"
          height="1536"
        />
      </figure>

      <aside class="flex w-[9.5rem] shrink-0 flex-col self-center md:w-[10.5rem]">
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
          <li v-for="step in steps" :key="step.n" class="imago-ticket-row">
            <span class="w-6 shrink-0 tabular-nums text-[13px] text-[var(--muted)]">{{
              step.n
            }}</span>
            <span class="text-[15px] leading-none text-[var(--ink)]">{{ step.label }}</span>
          </li>
        </ol>
      </aside>
    </div>

    <div class="absolute bottom-8 right-8 z-10">
      <AppButton variant="cta" size="lg" class="min-w-[7.5rem] px-6" @click="enterWorkbench">
        {{ t('cover.start') }}
      </AppButton>
    </div>
  </div>
</template>
