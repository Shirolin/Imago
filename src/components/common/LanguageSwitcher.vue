<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Languages, Check } from 'lucide-vue-next'
import { useStorage } from '@vueuse/core'

const props = withDefaults(
  defineProps<{
    placement?: 'top' | 'bottom'
    align?: 'left' | 'right'
  }>(),
  {
    placement: 'bottom',
    align: 'left'
  }
)

const { locale, t } = useI18n()
const savedLocale = useStorage('imago-locale', 'zh-CN')

const isOpen = ref(false)

const languages = [
  { code: 'zh-CN', name: '简体中文' },
  { code: 'zh-TW', name: '繁體中文' },
  { code: 'en', name: 'English' },
  { code: 'ja', name: '日本語' },
  { code: 'ko', name: '한국어' },
  { code: 'de', name: 'Deutsch' },
  { code: 'fr', name: 'Français' },
  { code: 'es', name: 'Español' },
  { code: 'pt-BR', name: 'Português' },
  { code: 'tr', name: 'Türkçe' }
]

const currentLanguageName = ref('')

const menuPositionClass = computed(() => {
  const horizontal = props.align === 'right' ? 'right-0' : 'left-0'
  const vertical = props.placement === 'top' ? 'top-full mt-2' : 'bottom-full mb-2'
  return `${horizontal} ${vertical}`
})

const enterFromClass = computed(() =>
  props.placement === 'top'
    ? 'transform scale-95 -translate-y-2 opacity-0'
    : 'transform scale-95 translate-y-2 opacity-0'
)

const leaveToClass = computed(() =>
  props.placement === 'top'
    ? 'transform scale-95 -translate-y-2 opacity-0'
    : 'transform scale-95 translate-y-2 opacity-0'
)

const updateCurrentName = () => {
  const lang = languages.find((l) => l.code === locale.value)
  currentLanguageName.value = lang ? lang.name : 'Language'
}

const setLanguage = (code: string) => {
  locale.value = code
  savedLocale.value = code
  updateCurrentName()
  isOpen.value = false
}

const handleWindowClick = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  if (!target.closest('.language-switcher')) {
    isOpen.value = false
  }
}

onMounted(() => {
  updateCurrentName()
  window.addEventListener('click', handleWindowClick)
})

onUnmounted(() => {
  window.removeEventListener('click', handleWindowClick)
})
</script>

<template>
  <div class="relative language-switcher">
    <button
      @click="isOpen = !isOpen"
      class="flex items-center justify-center w-9 h-9 rounded-[var(--radius)] hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] transition-colors text-[var(--muted)] hover:text-[var(--ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      :title="currentLanguageName"
      :aria-label="t('nav.language')"
      :aria-expanded="isOpen"
    >
      <Languages :size="16" />
    </button>

    <transition
      enter-active-class="transition duration-200 ease-out"
      :enter-from-class="enterFromClass"
      enter-to-class="transform scale-100 translate-y-0 opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="transform scale-100 translate-y-0 opacity-100"
      :leave-to-class="leaveToClass"
    >
      <div
        v-if="isOpen"
        class="absolute w-40 bg-[var(--chrome)] border border-[color-mix(in_srgb,var(--ink)_10%,transparent)] z-[100] py-1 rounded-[var(--radius)] overflow-hidden"
        :class="menuPositionClass"
      >
        <div class="max-h-[300px] overflow-y-auto custom-scrollbar">
          <button
            v-for="lang in languages"
            :key="lang.code"
            @click="setLanguage(lang.code)"
            class="w-full flex items-center justify-between px-4 py-2 text-xs font-medium hover:bg-primary/10 hover:text-primary transition-colors text-left"
            :class="{ 'text-primary bg-primary/5': locale === lang.code }"
          >
            <span>{{ lang.name }}</span>
            <Check v-if="locale === lang.code" :size="12" />
          </button>
        </div>
      </div>
    </transition>
  </div>
</template>
