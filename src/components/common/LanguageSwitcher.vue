<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Languages, ChevronDown, Check } from 'lucide-vue-next'
import { useStorage } from '@vueuse/core'

const { locale } = useI18n()
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

onMounted(() => {
  updateCurrentName()
  // 点击外部关闭
  window.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    if (!target.closest('.language-switcher')) {
      isOpen.value = false
    }
  })
})
</script>

<template>
  <div class="relative language-switcher">
    <button
      @click="isOpen = !isOpen"
      class="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-muted/60 transition-colors text-muted-foreground hover:text-foreground text-xs font-bold"
      :title="currentLanguageName"
    >
      <Languages :size="16" />
      <span class="hidden lg:inline">{{ currentLanguageName }}</span>
      <ChevronDown
        :size="12"
        class="transition-transform duration-200"
        :class="{ 'rotate-180': isOpen }"
      />
    </button>

    <transition
      enter-active-class="transition duration-100 ease-out"
      enter-from-class="transform scale-95 opacity-0"
      enter-to-class="transform scale-100 opacity-100"
      leave-active-class="transition duration-75 ease-in"
      leave-from-class="transform scale-100 opacity-100"
      leave-to-class="transform scale-95 opacity-0"
    >
      <div
        v-if="isOpen"
        class="absolute right-0 mt-2 w-40 bg-card border border-border rounded-xl shadow-xl z-[100] py-1.5 overflow-hidden"
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
