<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  Minimize2,
  Maximize2,
  Scissors,
  Trash2,
  Split,
  Layers,
  Palette,
  Menu,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Box,
  Heart,
  Eraser
} from 'lucide-vue-next'
import { useImageStore } from './stores/imageStore'
import { useLayoutStore } from './stores/layoutStore'
import SponsorModal from './components/SponsorModal.vue'
import LanguageSwitcher from './components/common/LanguageSwitcher.vue'

const store = useImageStore()
const layoutStore = useLayoutStore()
const { t } = useI18n()
const router = useRouter()
const route = useRoute()

const isMobileSidebarOpen = ref(false)
const showSponsorModal = ref(false)
const isGlobalDragging = ref(false)
let dragTarget: EventTarget | null = null

const isCover = computed(() => route.name === 'home')

const toggleMobileSidebar = () => {
  isMobileSidebarOpen.value = !isMobileSidebarOpen.value
}
const closeMobileSidebar = () => {
  isMobileSidebarOpen.value = false
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
    if (route.name === 'home') {
      router.push('/compress')
    }
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

const onGlobalFileSelect = (e: Event) => {
  const target = e.target as HTMLInputElement
  if (target.files) {
    handleFiles(target.files)
  }
  target.value = ''
}

onMounted(() => {
  document.documentElement.setAttribute('data-theme', 'light')

  window.addEventListener('paste', onPaste)
  document.addEventListener('dragenter', onGlobalDragEnter)
  document.addEventListener('dragover', onGlobalDragOver)
  document.addEventListener('dragleave', onGlobalDragLeave)
  document.addEventListener('drop', onGlobalDrop)

  onBeforeUnmount(() => {
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
      { name: t('tools.resize.name'), path: '/resize', icon: Maximize2 },
      { name: t('tools.crop.name'), path: '/crop', icon: Scissors },
      { name: t('tools.exif.name'), path: '/exif', icon: Trash2 }
    ]
  },
  {
    label: t('nav.groups.edit'),
    items: [
      { name: t('tools.split.name'), path: '/split', icon: Split },
      { name: t('tools.combine.name'), path: '/combine', icon: Layers }
    ]
  },
  {
    label: t('nav.groups.creative'),
    items: [
      { name: t('tools.bgRemove.name'), path: '/bg-remove', icon: Eraser },
      { name: t('tools.filters.name'), path: '/filters', icon: Palette },
      { name: t('tools.favicon.name'), path: '/favicon', icon: Box }
    ]
  }
])

const currentRouteName = computed(() => {
  const routeName = route.name as string
  if (routeName === 'home') return t('app.subtitle')
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

const navItemClass = (active: boolean, collapsed: boolean) => {
  const base =
    'flex items-center text-sm transition-colors duration-150 group relative shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'
  const pad = collapsed
    ? 'md:justify-center min-h-[40px] md:h-10 md:w-10 md:mx-auto px-3 py-2 gap-2 rounded-[var(--radius-ctrl)]'
    : 'px-3 py-2 min-h-[40px] gap-2 rounded-[var(--radius-ctrl)]'
  const state = active
    ? 'bg-[var(--well)] text-[var(--ink)]'
    : 'text-[var(--muted)] hover:bg-[var(--well)] hover:text-[var(--ink)]'
  return `${base} ${pad} ${state}`
}
</script>

<template>
  <div
    class="flex h-[100dvh] w-full overflow-hidden relative bg-[var(--paper)] text-[var(--ink)] antialiased"
  >
    <div
      v-if="isGlobalDragging && !isCover"
      class="fixed inset-0 z-[9999] pointer-events-none flex items-center justify-center"
    >
      <p
        class="text-[var(--ink)] text-sm font-medium bg-[var(--well)] px-4 py-2 rounded-[var(--radius-ctrl)]"
      >
        {{ t('common.image.upload.dropToImago') }}
      </p>
    </div>

    <div
      v-show="isMobileSidebarOpen && !isCover"
      @click="closeMobileSidebar"
      class="fixed inset-0 bg-[var(--paper)]/70 z-[90] md:hidden"
    ></div>

    <aside
      v-if="!isCover"
      class="imago-board border-r border-[color-mix(in_srgb,var(--ink)_8%,transparent)] flex flex-col z-[100] transition-all duration-200 ease-out md:static fixed inset-y-0 left-0 pt-[env(safe-area-inset-top,8px)] md:pt-0"
      :class="[
        isMobileSidebarOpen ? 'translate-x-0 w-[240px]' : '-translate-x-full md:translate-x-0',
        layoutStore.isMenuCollapsed ? 'md:w-[64px]' : 'md:w-[220px]'
      ]"
    >
      <div
        class="overflow-hidden flex-shrink-0 flex flex-col"
        :class="[
          layoutStore.isMenuCollapsed
            ? 'md:w-[64px] md:p-0 md:pt-4 md:pb-3 md:items-center p-4 pb-4'
            : 'p-4 pb-3'
        ]"
      >
        <router-link
          to="/"
          @click="closeMobileSidebar"
          class="flex items-center outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-[var(--radius-ctrl)]"
          :class="layoutStore.isMenuCollapsed ? 'md:justify-center w-full gap-3 md:gap-0' : 'gap-2'"
        >
          <div
            v-if="!layoutStore.isMenuCollapsed || isMobileSidebarOpen"
            class="flex flex-col min-w-0"
            :class="{ 'md:hidden': layoutStore.isMenuCollapsed && !isMobileSidebarOpen }"
          >
            <span
              class="imago-serif text-[22px] font-semibold leading-none tracking-tight text-[var(--ink)]"
              >Imago</span
            >
            <span class="mt-1 text-[10px] font-medium tracking-[0.16em] text-[var(--muted)]">{{
              t('app.subtitle')
            }}</span>
          </div>
          <span
            v-else
            class="imago-serif hidden md:inline text-[18px] font-semibold text-[var(--ink)]"
            aria-hidden="true"
            >I</span
          >
        </router-link>
      </div>

      <nav
        class="flex-1 min-h-0 overflow-y-auto flex flex-col custom-scrollbar overflow-x-hidden pb-6 pt-1"
        :class="
          layoutStore.isMenuCollapsed ? 'md:px-2 md:items-start gap-0.5 px-3' : 'px-3 gap-0.5'
        "
      >
        <div
          v-for="group in menuGroups"
          :key="group.label"
          class="flex flex-col"
          :class="[
            layoutStore.isMenuCollapsed && !isMobileSidebarOpen
              ? 'md:w-[64px] mt-1 gap-0.5 md:items-center w-full'
              : 'w-full mt-5 first:mt-1 gap-0.5'
          ]"
        >
          <div
            v-if="!layoutStore.isMenuCollapsed || isMobileSidebarOpen"
            class="text-[11px] font-medium text-[var(--muted)] mb-1 ml-3 whitespace-nowrap"
            :class="{ 'md:hidden': layoutStore.isMenuCollapsed && !isMobileSidebarOpen }"
          >
            {{ group.label }}
          </div>
          <div
            v-else-if="!isMobileSidebarOpen"
            class="h-px bg-[color-mix(in_srgb,var(--ink)_10%,transparent)] my-2 w-6 mx-auto"
          ></div>

          <router-link
            v-for="item in group.items"
            :key="item.path"
            :to="item.path"
            :class="
              navItemClass(
                $route.path === item.path,
                layoutStore.isMenuCollapsed && !isMobileSidebarOpen
              )
            "
            :title="layoutStore.isMenuCollapsed ? item.name : ''"
            @click="closeMobileSidebar"
          >
            <component
              :is="item.icon"
              :size="layoutStore.isMenuCollapsed && !isMobileSidebarOpen ? 18 : 16"
              class="shrink-0"
            />
            <span
              v-if="!layoutStore.isMenuCollapsed || isMobileSidebarOpen"
              :class="{ 'md:hidden': layoutStore.isMenuCollapsed && !isMobileSidebarOpen }"
              class="whitespace-nowrap"
              >{{ item.name }}</span
            >
          </router-link>
        </div>
      </nav>

      <div
        class="flex border-t border-[color-mix(in_srgb,var(--ink)_8%,transparent)] shrink-0 px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]"
        :class="[
          layoutStore.isMenuCollapsed && !isMobileSidebarOpen
            ? 'flex-col items-center gap-2'
            : 'flex-row items-center justify-center gap-1 md:justify-start'
        ]"
      >
        <LanguageSwitcher />

        <button
          @click="showSponsorModal = true"
          class="flex items-center justify-center w-9 h-9 rounded-[var(--radius)] text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] transition-colors shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          :title="t('nav.sponsor')"
          :aria-label="t('nav.sponsor')"
        >
          <Heart :size="16" />
        </button>

        <div
          v-if="!layoutStore.isMenuCollapsed || isMobileSidebarOpen"
          class="hidden md:block flex-1"
        ></div>

        <button
          @click="layoutStore.toggleMenu"
          class="hidden md:flex items-center justify-center w-9 h-9 rounded-[var(--radius)] text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] transition-colors shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
          :title="layoutStore.isMenuCollapsed ? t('nav.expand') : t('nav.collapse')"
          :aria-label="layoutStore.isMenuCollapsed ? t('nav.expand') : t('nav.collapse')"
        >
          <ChevronRight v-if="layoutStore.isMenuCollapsed" :size="16" />
          <ChevronLeft v-else :size="16" />
        </button>
      </div>
    </aside>

    <div
      class="absolute top-0 left-0 right-0 h-[2px] z-50 pointer-events-none"
      v-if="store.processingCount > 0"
    >
      <div
        class="h-full bg-[var(--accent)] transition-transform duration-300 ease-out origin-left"
        :style="{ transform: `scaleX(${store.globalProgress / 100})` }"
      ></div>
    </div>

    <main class="flex-1 min-h-0 flex flex-col relative z-20 bg-[var(--paper)]">
      <header
        v-if="!isCover"
        class="shrink-0 flex items-center justify-between px-3 md:px-4 bg-[var(--paper)] z-50 md:z-[110] h-11"
      >
        <div class="flex items-center gap-2 flex-none min-w-0 z-20">
          <button
            class="md:hidden text-[var(--ink)] hover:text-[var(--accent)] p-2 -ml-1 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-[var(--radius)] shrink-0"
            :aria-label="t('nav.toggleMobile')"
            @click="toggleMobileSidebar"
          >
            <Menu :size="18" />
          </button>

          <div class="flex items-center gap-3 min-w-0">
            <span class="text-[13px] font-medium text-[var(--ink)] whitespace-nowrap">{{
              currentRouteName
            }}</span>
            <div id="top-bar-left" class="hidden sm:flex items-center min-w-0"></div>
          </div>
        </div>

        <div class="flex-1 flex items-center justify-end gap-2 min-w-0 z-20 pl-3">
          <div
            id="top-bar-center"
            class="flex items-center justify-end overflow-x-auto no-scrollbar min-w-0"
          ></div>

          <div
            class="flex items-center gap-2 text-[11px] font-medium text-[var(--muted)] hidden xl:flex shrink-0 tabular-nums"
          >
            <Loader2 v-if="store.processingCount > 0" class="animate-spin" :size="10" />
            <span v-if="store.processingCount === 0">{{ t('app.localProcessing') }}</span>
            <span v-else>{{ t('app.processing') }} ({{ store.globalProgress }}%)</span>
          </div>

          <div
            id="top-bar-right"
            class="flex items-center gap-2 shrink-0 has-[:any-link]:border-l has-[:enabled]:border-l has-[button]:border-l border-[color-mix(in_srgb,var(--ink)_10%,transparent)] pl-2 md:pl-3"
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
                  <div class="h-full w-full flex items-center justify-center bg-[var(--paper)]">
                    <Loader2 class="animate-spin text-[var(--accent)]" :size="24" />
                  </div>
                </template>
              </suspense>
            </div>
          </transition>
        </router-view>
      </div>
    </main>

    <SponsorModal :show="showSponsorModal" @close="showSponsorModal = false" />

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
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.15s ease-out;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}

.page-fade-enter-active,
.page-fade-leave-active {
  transition: opacity 0.15s ease-out;
}

.page-fade-enter-from,
.page-fade-leave-to {
  opacity: 0;
}
</style>
