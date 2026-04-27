<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  Minimize2,
  Maximize2,
  Scissors,
  Settings2,
  Trash2,
  Split,
  Layers,
  Palette,
  Sun,
  Moon,
  Monitor,
  Menu,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Box,
  Sparkles,
  Heart,
  MousePointer2
} from 'lucide-vue-next'
import { useImageStore } from './stores/imageStore'
import { useLayoutStore } from './stores/layoutStore'
import AppLogo from './components/common/AppLogo.vue'
import SponsorModal from './components/SponsorModal.vue'
import LanguageSwitcher from './components/common/LanguageSwitcher.vue'

const store = useImageStore()
const layoutStore = useLayoutStore()
const { t } = useI18n()

const theme = ref<'light' | 'dark' | 'system'>('system')
const themeModes = ['light', 'system', 'dark'] as const

const isMobileSidebarOpen = ref(false)
const showSponsorModal = ref(false)
const isGlobalDragging = ref(false)
let dragTarget: EventTarget | null = null

const toggleMobileSidebar = () => {
  isMobileSidebarOpen.value = !isMobileSidebarOpen.value
}
const closeMobileSidebar = () => {
  isMobileSidebarOpen.value = false
}

const setTheme = (mode: 'light' | 'dark' | 'system') => {
  theme.value = mode
  applyTheme()
}

const toggleTheme = () => {
  const modes: ('light' | 'dark' | 'system')[] = ['light', 'dark', 'system']
  const currentIndex = modes.indexOf(theme.value)
  const nextIndex = (currentIndex + 1) % modes.length
  setTheme(modes[nextIndex])
}

const applyTheme = () => {
  const root = document.documentElement
  let effectiveTheme = theme.value

  if (theme.value === 'system') {
    effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }

  root.setAttribute('data-theme', effectiveTheme)
  localStorage.setItem('imago-theme', theme.value)
}

const handleFiles = (files: FileList | File[]) => {
  const MAX_SIZE = 50 * 1024 * 1024 // 50MB
  const validTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/avif',
    'image/gif',
    'image/svg+xml'
  ]

  const validFiles = Array.from(files).filter((file) => {
    if (!file.type.startsWith('image/') && !validTypes.includes(file.type)) {
      return false
    }
    if (file.size > MAX_SIZE) {
      alert(
        t('common.image.upload.errorSize', {
          name: file.name,
          size: (file.size / 1024 / 1024).toFixed(1)
        })
      )
      return false
    }
    return true
  })

  if (validFiles.length > 0) {
    store.addImages(validFiles)
  }
}

const onGlobalDragEnter = (e: DragEvent) => {
  e.preventDefault()
  dragTarget = e.target
  isGlobalDragging.value = true
}

const onGlobalDragOver = (e: DragEvent) => {
  e.preventDefault()
}

const onGlobalDragLeave = (e: DragEvent) => {
  if (e.target === dragTarget || e.target === document) {
    isGlobalDragging.value = false
  }
}

const onGlobalDrop = (e: DragEvent) => {
  e.preventDefault()
  isGlobalDragging.value = false
  if (e.dataTransfer?.files) {
    handleFiles(e.dataTransfer.files)
  }
}

const onPaste = (e: ClipboardEvent) => {
  if (e.clipboardData?.files && e.clipboardData.files.length > 0) {
    handleFiles(e.clipboardData.files)
  }
}

onMounted(() => {
  const saved = localStorage.getItem('imago-theme') as 'light' | 'dark' | 'system' | null
  if (saved) theme.value = saved
  applyTheme()

  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  const handleThemeChange = () => {
    if (theme.value === 'system') applyTheme()
  }

  mediaQuery.addEventListener('change', handleThemeChange)

  // 全局文件监听
  window.addEventListener('paste', onPaste)
  document.addEventListener('dragenter', onGlobalDragEnter)
  document.addEventListener('dragover', onGlobalDragOver)
  document.addEventListener('dragleave', onGlobalDragLeave)
  document.addEventListener('drop', onGlobalDrop)

  onBeforeUnmount(() => {
    mediaQuery.removeEventListener('change', handleThemeChange)
    window.removeEventListener('paste', onPaste)
    document.removeEventListener('dragenter', onGlobalDragEnter)
    document.removeEventListener('dragover', onGlobalDragOver)
    document.removeEventListener('dragleave', onGlobalDragLeave)
    document.removeEventListener('drop', onGlobalDrop)
  })
})

const menuGroups = computed(() => [
  {
    label: t('nav.groups.core'),
    items: [
      { name: t('tools.compress.name'), path: '/compress', icon: Minimize2 },
      { name: t('tools.resize.name'), path: '/resize', icon: Maximize2 }
    ]
  },
  {
    label: t('nav.groups.edit'),
    items: [
      { name: t('tools.crop.name'), path: '/crop', icon: Scissors },
      { name: t('tools.split.name'), path: '/split', icon: Split },
      { name: t('tools.exif.name'), path: '/exif', icon: Trash2 }
    ]
  },
  {
    label: t('nav.groups.creative'),
    items: [
      { name: t('tools.favicon.name'), path: '/favicon', icon: Box },
      { name: t('tools.combine.name'), path: '/combine', icon: Layers },
      { name: t('tools.bgRemove.name'), path: '/bg-remove', icon: Sparkles },
      { name: t('tools.filters.name'), path: '/filters', icon: Palette }
    ]
  }
])

const currentRouteName = computed(() => {
  const routeName = useRoute().name as string
  if (routeName === 'home') return t('nav.allTools')
  const toolKey = [
    'compress',
    'resize',
    'crop',
    'split',
    'exif',
    'favicon',
    'combine',
    'bgRemove',
    'filters'
  ].find((key) => key.toLowerCase() === routeName?.toLowerCase())
  if (toolKey) return t(`tools.${toolKey}.name`)
  return routeName || t('nav.allTools')
})

const onGlobalFileSelect = (e: Event) => {
  const target = e.target as HTMLInputElement
  if (target.files) {
    handleFiles(target.files)
  }
  // 重置以允许重复导入相同文件
  target.value = ''
}
</script>

<template>
  <div
    class="flex h-[100dvh] w-full overflow-hidden relative bg-background text-foreground antialiased transition-colors duration-300"
  >
    <!-- 全局拖拽覆盖层 (Delight Overlay) -->
    <Transition
      enter-active-class="transition duration-300 [transition-timing-function:cubic-bezier(0.16,1,0.3,1)]"
      enter-from-class="opacity-0 scale-95"
      enter-to-class="opacity-100 scale-100"
      leave-active-class="transition duration-200 ease-in"
      leave-from-class="opacity-100 scale-100"
      leave-to-class="opacity-0 scale-105"
    >
      <div
        v-if="isGlobalDragging"
        class="fixed inset-4 bg-primary/20 backdrop-blur-xl z-[9999] flex items-center justify-center border-2 border-dashed border-primary/40 rounded-[2.5rem] pointer-events-none shadow-[0_0_80px_-20px_rgba(var(--primary-rgb),0.3)]"
      >
        <div
          class="flex flex-col items-center gap-8 text-primary animate-in fade-in slide-in-from-bottom-4 duration-500"
        >
          <div class="relative">
            <div class="absolute inset-0 bg-primary/20 blur-3xl rounded-full animate-pulse"></div>
            <MousePointer2 :size="64" class="relative z-10 animate-bounce" stroke-width="2.5" />
          </div>
          <div class="flex flex-col items-center gap-2">
            <span class="font-black text-3xl md:text-4xl tracking-tighter uppercase"
              >Drop to Imago</span
            >
            <p class="text-primary/70 font-bold text-sm tracking-[0.2em] uppercase">
              {{ t('common.image.upload.dropTip') }}
            </p>
          </div>
        </div>
      </div>
    </Transition>

    <div
      v-show="isMobileSidebarOpen"
      @click="closeMobileSidebar"
      class="fixed inset-0 bg-background/20 backdrop-blur-md z-30 md:hidden"
    ></div>

    <!-- Sidebar (Menu) -->
    <aside
      class="bg-card/95 backdrop-blur-2xl border-r border-border flex flex-col z-40 transition-all duration-300 ease-in-out md:static fixed inset-y-0 left-0 pt-2 md:pt-0"
      :class="[
        isMobileSidebarOpen
          ? 'translate-x-0 shadow-2xl w-[280px]'
          : '-translate-x-full md:translate-x-0',
        layoutStore.isMenuCollapsed ? 'md:w-[72px]' : 'md:w-[280px]'
      ]"
    >
      <div
        class="transition-all duration-300 overflow-hidden flex-shrink-0 flex flex-col"
        :style="!layoutStore.isMenuCollapsed ? 'scrollbar-gutter: stable' : ''"
        :class="[
          layoutStore.isMenuCollapsed
            ? 'md:w-[72px] md:p-0 md:pt-5 md:pb-4 md:items-center p-6 pb-8 pl-3.5 pr-0'
            : 'p-6 pb-8 pl-3.5 pr-0'
        ]"
      >
        <router-link
          to="/"
          @click="closeMobileSidebar"
          class="flex items-center hover:opacity-90 transition-all active:scale-95 duration-200"
          :class="
            layoutStore.isMenuCollapsed ? 'md:justify-center w-full gap-4 md:gap-0' : 'gap-3.5'
          "
        >
          <AppLogo :size="layoutStore.isMenuCollapsed ? 36 : 42" />

          <transition name="fade">
            <div
              v-if="!layoutStore.isMenuCollapsed || isMobileSidebarOpen"
              class="flex flex-col justify-center translate-y-[2px]"
              :class="{ 'md:hidden': layoutStore.isMenuCollapsed && !isMobileSidebarOpen }"
            >
              <h1
                class="text-[28px] font-black tracking-tighter whitespace-nowrap leading-none pb-1"
              >
                <span
                  class="bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent"
                  >imago</span
                >
              </h1>
              <span
                class="text-[11px] font-extrabold text-primary/80 tracking-widest leading-none mt-[2px] ml-[2px]"
              >
                {{ t('app.subtitle') }}
              </span>
            </div>
          </transition>
        </router-link>
      </div>

      <nav
        class="flex-1 min-h-0 overflow-y-auto flex flex-col custom-scrollbar overflow-x-hidden pb-10 transition-all duration-300 pt-3"
        :style="!layoutStore.isMenuCollapsed ? 'scrollbar-gutter: stable' : ''"
        :class="[
          layoutStore.isMenuCollapsed
            ? 'md:px-0 md:items-start gap-1 pl-3.5 pr-0'
            : 'pl-3.5 pr-0 gap-1.5'
        ]"
      >
        <router-link
          to="/"
          class="flex items-center font-bold text-sm transition-all duration-300 group relative overflow-hidden shrink-0"
          :class="[
            $route.path === '/'
              ? 'bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20'
              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
            layoutStore.isMenuCollapsed
              ? 'md:justify-center h-11 md:w-11 md:mx-auto md:rounded-xl px-4 py-2.5 gap-3 rounded-xl'
              : 'px-3.5 py-2.5 gap-3 rounded-xl active:bg-primary/5 active:scale-[0.98]'
          ]"
          :title="layoutStore.isMenuCollapsed ? t('nav.allTools') : ''"
          @click="closeMobileSidebar"
        >
          <Settings2
            :size="layoutStore.isMenuCollapsed ? 20 : 18"
            :class="{ 'scale-110': $route.path === '/' }"
            class="transition-transform duration-300 shrink-0 group-hover:translate-x-0.5"
          />
          <span
            v-if="!layoutStore.isMenuCollapsed || isMobileSidebarOpen"
            class="whitespace-nowrap transition-transform duration-300 group-hover:translate-x-0.5"
            :class="{ 'md:hidden': layoutStore.isMenuCollapsed && !isMobileSidebarOpen }"
            >{{ t('nav.allTools') }}</span
          >
          <div
            v-if="$route.path === '/' && (!layoutStore.isMenuCollapsed || isMobileSidebarOpen)"
            class="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary rounded-r-full shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)]"
            :class="{ 'md:h-6 md:w-1': layoutStore.isMenuCollapsed && !isMobileSidebarOpen }"
          ></div>
        </router-link>

        <div
          v-for="group in menuGroups"
          :key="group.label"
          class="flex flex-col transition-all duration-300"
          :class="[
            layoutStore.isMenuCollapsed && !isMobileSidebarOpen
              ? 'md:w-[72px] mt-1 gap-1 md:items-center w-full'
              : 'w-full mt-7 gap-1.5'
          ]"
        >
          <div
            v-if="!layoutStore.isMenuCollapsed || isMobileSidebarOpen"
            class="text-[10px] font-bold uppercase text-muted-foreground/30 tracking-widest mb-1.5 ml-3.5 whitespace-nowrap"
            :class="{ 'md:hidden': layoutStore.isMenuCollapsed && !isMobileSidebarOpen }"
          >
            {{ group.label }}
          </div>
          <div
            v-else-if="!isMobileSidebarOpen"
            class="h-px bg-border/40 my-2 w-6 mx-auto rounded-full"
          ></div>

          <router-link
            v-for="item in group.items"
            :key="item.path"
            :to="item.path"
            class="flex items-center font-bold text-sm transition-all duration-300 group relative overflow-hidden shrink-0"
            :class="[
              $route.path === item.path
                ? 'bg-primary/10 text-primary shadow-sm ring-1 ring-primary/20'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
              layoutStore.isMenuCollapsed && !isMobileSidebarOpen
                ? 'md:justify-center h-11 md:w-11 md:mx-auto md:rounded-xl px-4 py-2.5 gap-3 rounded-xl'
                : 'px-3.5 py-2.5 gap-3 rounded-xl active:bg-primary/5 active:scale-[0.98]'
            ]"
            :title="layoutStore.isMenuCollapsed ? item.name : ''"
            @click="closeMobileSidebar"
          >
            <component
              :is="item.icon"
              :size="layoutStore.isMenuCollapsed && !isMobileSidebarOpen ? 20 : 18"
              :class="{ 'scale-110': $route.path === item.path }"
              class="transition-transform duration-300 shrink-0 group-hover:translate-x-0.5"
            />
            <span
              v-if="!layoutStore.isMenuCollapsed || isMobileSidebarOpen"
              :class="{ 'md:hidden': layoutStore.isMenuCollapsed && !isMobileSidebarOpen }"
              class="whitespace-nowrap transition-transform duration-300 group-hover:translate-x-0.5"
              >{{ item.name }}</span
            >
            <div
              v-if="
                $route.path === item.path && (!layoutStore.isMenuCollapsed || isMobileSidebarOpen)
              "
              class="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary rounded-r-full shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)]"
              :class="{ 'md:h-6 md:w-1': layoutStore.isMenuCollapsed && !isMobileSidebarOpen }"
            ></div>
          </router-link>
        </div>
      </nav>

      <div
        class="flex border-t border-border shrink-0 bg-card/50 backdrop-blur-md transition-all duration-300 px-3.5 py-4"
        :class="[
          layoutStore.isMenuCollapsed && !isMobileSidebarOpen
            ? 'flex-col items-center gap-5'
            : 'flex-row items-center gap-1.5'
        ]"
      >
        <LanguageSwitcher />

        <button
          @click="showSponsorModal = true"
          class="flex items-center justify-center w-10 h-10 rounded-xl text-muted-foreground/60 hover:text-rose-500 hover:bg-rose-500/5 transition-all active:scale-[0.94] group shrink-0"
          :title="t('nav.sponsor')"
        >
          <Heart :size="18" class="group-hover:scale-110 transition-transform" />
        </button>

        <button
          @click="toggleTheme"
          class="flex items-center justify-center w-10 h-10 rounded-xl text-muted-foreground hover:text-primary hover:bg-primary/5 transition-all active:scale-[0.94] group shrink-0"
          :title="t('common.theme.' + theme)"
        >
          <transition name="theme-spin" mode="out-in">
            <Sun
              v-if="theme === 'light'"
              :key="'sun'"
              :size="18"
              class="group-hover:rotate-45 transition-transform"
            />
            <Moon
              v-else-if="theme === 'dark'"
              :key="'moon'"
              :size="18"
              class="group-hover:-rotate-12 transition-transform"
            />
            <Monitor v-else :key="'monitor'" :size="18" />
          </transition>
        </button>

        <div v-if="!layoutStore.isMenuCollapsed || isMobileSidebarOpen" class="flex-1"></div>

        <button
          @click="layoutStore.toggleMenu"
          class="hidden md:flex items-center justify-center w-10 h-10 rounded-xl bg-muted/40 hover:bg-primary/10 hover:text-primary transition-all text-muted-foreground active:scale-[0.94] group shrink-0"
          :title="layoutStore.isMenuCollapsed ? t('nav.expand') : t('nav.collapse')"
        >
          <ChevronRight
            v-if="layoutStore.isMenuCollapsed"
            :size="18"
            class="group-hover:translate-x-0.5 transition-transform"
          />
          <ChevronLeft
            v-else
            :size="18"
            class="group-hover:-translate-x-0.5 transition-transform"
          />
        </button>
      </div>
    </aside>

    <div
      class="absolute top-0 left-0 right-0 h-[3px] z-50 pointer-events-none"
      v-if="store.processingCount > 0"
    >
      <div
        class="h-full bg-primary transition-transform duration-300 ease-out origin-left"
        :style="{ transform: `scaleX(${store.globalProgress / 100})` }"
      ></div>
    </div>

    <main class="flex-1 min-h-0 flex flex-col relative z-20">
      <!-- Toolbar (Header) -->
      <header
        class="shrink-0 flex items-center justify-between px-4 md:px-6 bg-background/80 backdrop-blur-xl shadow-[0_1px_0_0_rgba(0,0,0,0.05)] shadow-inner-glow z-50 md:z-[110] sticky top-0 h-14 transition-all duration-300"
      >
        <!-- Left: Identity & Context -->
        <div class="flex items-center gap-3 w-1/3 min-w-0">
          <button
            class="md:hidden text-foreground hover:text-primary p-2 -ml-2 transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-lg shrink-0"
            :aria-label="t('nav.toggleMobile')"
            @click="toggleMobileSidebar"
          >
            <Menu :size="20" />
          </button>

          <div class="flex items-center gap-3 min-w-0">
            <div
              class="relative h-8 flex items-center bg-primary/10 border border-primary/20 rounded-full text-[0.7rem] font-bold text-primary uppercase tracking-[0.1em] shadow-sm px-4 whitespace-nowrap shrink-0 transition-all overflow-hidden"
            >
              <div
                class="absolute inset-0 bg-gradient-to-r from-transparent via-primary/20 to-transparent -translate-x-full animate-[shimmer_3s_infinite]"
              ></div>
              <span class="relative z-10">{{ currentRouteName }}</span>
            </div>
            <!-- Teleport target for header-left (e.g. ImageSelectionStatus) -->
            <div id="top-bar-left" class="hidden sm:flex items-center min-w-0"></div>
          </div>
        </div>

        <!-- Center: Core Actions (Teleport Target) -->
        <div
          id="top-bar-center"
          class="flex-1 flex justify-center items-center px-4 overflow-x-auto no-scrollbar"
        ></div>

        <!-- Right: Meta & Global -->
        <div class="flex items-center justify-end w-1/3 min-w-0">
          <div
            class="flex items-center gap-2.5 text-[0.65rem] font-bold text-primary bg-primary/10 px-3 py-1.5 rounded-full hidden xl:flex transition-all shrink-0 mr-4"
          >
            <span
              v-if="store.processingCount === 0"
              class="w-1.5 h-1.5 rounded-full bg-primary/70"
            ></span>
            <Loader2 v-else class="animate-spin" :size="10" />
            <span v-if="store.processingCount === 0">{{ t('app.localProcessing') }}</span>
            <span v-else>{{ t('app.processing') }} ({{ store.globalProgress }}%)</span>
          </div>

          <!-- Teleport target with dynamic divider -->
          <div
            id="top-bar-right"
            class="flex items-center gap-2 shrink-0 has-[:any-link]:border-l has-[:enabled]:border-l has-[button]:border-l border-border/40 pl-4 transition-all"
          ></div>
        </div>
      </header>

      <div class="flex-1 min-h-0 overflow-hidden relative h-full">
        <router-view v-slot="{ Component, route }">
          <transition name="page-fade" mode="out-in">
            <div v-if="Component" :key="route.fullPath" class="h-full w-full flex flex-col min-h-0">
              <suspense :timeout="0">
                <template #default>
                  <component :is="Component" />
                </template>
                <template #fallback>
                  <div class="h-full w-full flex items-center justify-center">
                    <Loader2 class="animate-spin text-primary/10" :size="32" />
                  </div>
                </template>
              </suspense>
            </div>
          </transition>
        </router-view>
      </div>
    </main>

    <SponsorModal :show="showSponsorModal" @close="showSponsorModal = false" />

    <!-- 全局隐藏导入控件 -->
    <input
      id="global-file-input"
      type="file"
      multiple
      accept="image/*"
      class="hidden"
      @change="onGlobalFileSelect"
    />
  </div>
</template>

<style>
/* 主题切换旋转缩放动效 */
.theme-spin-enter-active,
.theme-spin-leave-active {
  transition: all 0.4s cubic-bezier(0.22, 1, 0.36, 1);
}

.theme-spin-enter-from {
  opacity: 0;
  transform: rotate(-90deg) scale(0.5);
}

.theme-spin-leave-to {
  opacity: 0;
  transform: rotate(90deg) scale(0.5);
}

@keyframes shimmer {
  100% {
    transform: translateX(100%);
  }
}

/* 文字淡入淡出 */
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.2s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

/* 页面路由切换动画 */
.page-fade-enter-active,
.page-fade-leave-active {
  transition:
    opacity 0.4s cubic-bezier(0.32, 0.72, 0, 1),
    transform 0.4s cubic-bezier(0.32, 0.72, 0, 1),
    filter 0.4s cubic-bezier(0.32, 0.72, 0, 1);
}

.page-fade-enter-from {
  opacity: 0;
  transform: scale(0.98) translateY(10px);
  filter: blur(4px);
}

.page-fade-leave-to {
  opacity: 0;
  transform: scale(1.02) translateY(-10px);
  filter: blur(4px);
}
</style>
