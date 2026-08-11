<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  Minimize2,
  Maximize2,
  Scissors,
  Trash2,
  Split,
  Layers,
  Palette,
  ArrowRight,
  Box,
  Sparkles
} from 'lucide-vue-next'
import AppButton from '../components/common/AppButton.vue'

const { t } = useI18n()
const toolsGrid = ref<HTMLElement | null>(null)

const scrollToTools = () => {
  toolsGrid.value?.scrollIntoView({ behavior: 'smooth' })
}

const tools = computed(() => [
  {
    name: t('tools.compress.name'),
    desc: t('tools.compress.desc'),
    path: '/compress',
    icon: Minimize2,
    colorClass: 'text-emerald-500'
  },
  {
    name: t('tools.resize.name'),
    desc: t('tools.resize.desc'),
    path: '/resize',
    icon: Maximize2,
    colorClass: 'text-blue-500'
  },
  {
    name: t('tools.crop.name'),
    desc: t('tools.crop.desc'),
    path: '/crop',
    icon: Scissors,
    colorClass: 'text-amber-500'
  },
  {
    name: t('tools.exif.name'),
    desc: t('tools.exif.desc'),
    path: '/exif',
    icon: Trash2,
    colorClass: 'text-red-500'
  },
  {
    name: t('tools.split.name'),
    desc: t('tools.split.desc'),
    path: '/split',
    icon: Split,
    colorClass: 'text-purple-500'
  },
  {
    name: t('tools.combine.name'),
    desc: t('tools.combine.desc'),
    path: '/combine',
    icon: Layers,
    colorClass: 'text-pink-500'
  },
  {
    name: t('tools.bgRemove.name'),
    desc: t('tools.bgRemove.desc'),
    path: '/bg-remove',
    icon: Sparkles,
    colorClass: 'text-violet-500'
  },
  {
    name: t('tools.filters.name'),
    desc: t('tools.filters.desc'),
    path: '/filters',
    icon: Palette,
    colorClass: 'text-indigo-500'
  },
  {
    name: t('tools.favicon.name'),
    desc: t('tools.favicon.desc'),
    path: '/favicon',
    icon: Box,
    colorClass: 'text-teal-500'
  }
])
</script>

<template>
  <div class="h-full overflow-y-auto custom-scrollbar">
    <div class="px-6 py-8 md:px-16 md:py-16 w-full max-w-7xl mx-auto">
      <section class="mb-24 flex flex-col items-center text-center w-full">
        <div
          class="inline-flex items-center gap-2 px-4 py-1.5 bg-success/10 text-success dark:text-success rounded-full font-bold text-[0.7rem] uppercase tracking-[0.2em] border border-success/20 mb-8 backdrop-blur-sm"
        >
          <div class="w-1.5 h-1.5 rounded-full bg-success animate-pulse"></div>
          {{ t('app.privacyFirst') }}
        </div>
        <h1
          class="text-4xl md:text-[5rem] font-black leading-[1.05] mb-8 text-foreground tracking-tighter"
        >
          {{ t('common.heroTitle1') }}<br class="hidden md:block" />
          <span
            class="bg-gradient-to-br from-green-400 via-blue-500 to-purple-600 bg-clip-text text-transparent drop-shadow-sm"
            >{{ t('common.heroTitle2') }}</span
          >
        </h1>
        <p
          class="text-lg md:text-xl text-muted-foreground leading-relaxed mb-12 max-w-2xl font-medium opacity-90"
        >
          {{ t('common.heroDesc') }}
        </p>
        <div class="flex flex-col md:flex-row gap-4">
          <AppButton
            size="lg"
            variant="primary"
            :icon="ArrowRight"
            @click="scrollToTools"
            class="text-lg px-10 h-14 active:scale-95 transition-all duration-300"
          >
            {{ t('common.start') }}
          </AppButton>
        </div>
      </section>

      <div
        class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8 scroll-mt-24"
        ref="toolsGrid"
      >
        <router-link
          v-for="tool in tools"
          :key="tool.name"
          :to="tool.path"
          class="group bg-card border border-border/60 rounded-2xl p-6 md:p-8 flex flex-col no-underline text-inherit transition-all duration-300 relative overflow-hidden hover:border-primary/40 hover:-translate-y-1.5 shadow-lg hover:shadow-xl"
        >
          <!-- 背景高光装饰 -->
          <div
            class="absolute -top-12 -right-12 w-32 h-32 rounded-full blur-[60px] opacity-0 group-hover:opacity-10 transition-opacity duration-500 pointer-events-none bg-primary/20"
          ></div>

          <div class="flex justify-between items-start mb-8 relative z-10">
            <div
              class="w-14 h-14 rounded-xl flex items-center justify-center bg-muted/50 border border-border/50 transition-all duration-300 group-hover:scale-105 group-hover:bg-background group-hover:border-primary/20"
              :class="tool.colorClass"
            >
              <component :is="tool.icon" :size="24" stroke-width="2.5" />
            </div>
            <div
              class="text-[0.6rem] font-black bg-muted text-muted-foreground/80 px-2.5 py-1 rounded-full uppercase tracking-widest group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300"
            >
              {{ t('common.ready') }}
            </div>
          </div>
          <div class="mb-6 relative z-10">
            <h3
              class="text-xl font-bold mb-2.5 text-foreground tracking-tight group-hover:text-primary transition-colors"
            >
              {{ tool.name }}
            </h3>
            <p
              class="text-[0.85rem] text-muted-foreground font-medium leading-relaxed opacity-85 group-hover:opacity-100 transition-opacity"
            >
              {{ tool.desc }}
            </p>
          </div>
          <div class="mt-auto relative z-10">
            <div
              class="flex items-center text-primary font-bold text-xs tracking-tight opacity-0 group-hover:opacity-100 translate-x-[-8px] group-hover:translate-x-0 transition-all duration-300"
            >
              {{ t('common.go') }} <ArrowRight :size="14" class="ml-1.5" />
            </div>
          </div>
        </router-link>
      </div>
    </div>
  </div>
</template>
