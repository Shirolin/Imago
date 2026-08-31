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
import { MAX_FILE_BYTES } from './lib/limits'
import { useImageImport } from './composables/useImageImport'
import { useLayoutStore } from './stores/layoutStore'
import SponsorModal from './components/SponsorModal.vue'
import LanguageSwitcher from './components/common/LanguageSwitcher.vue'

const store = useImageStore()
const layoutStore = useLayoutStore()
const { t } = useI18n()
const { importImages } = useImageImport()
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

const handleFiles = async (files: FileList | File[]) => {
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
    if (file.size > MAX_FILE_BYTES) {
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
    const before = store.images.length
    await importImages(validFiles)
    if (store.images.length > before && route.name === 'home') {
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
  if (routeName === 'home') return t('app.title')
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
    'flex items-center text-sm transition-colors duration-150 group relative outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]'
  const pad = collapsed
    ? 'shrink-0 lg:justify-center min-h-[40px] lg:h-10 lg:w-10 lg:mx-auto px-3 py-2 gap-2 rounded-[var(--radius-ctrl)]'
    : 'min-w-0 px-3 py-2 min-h-[40px] gap-2 rounded-[var(--radius-ctrl)]'
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
      class="fixed inset-0 bg-[var(--paper)]/70 z-[90] lg:hidden"
    ></div>

    <aside
      v-if="!isCover"
      class="imago-board border-r border-[var(--hairline)] flex flex-col z-[100] transition-all duration-200 ease-out lg:static fixed inset-y-0 left-0 pt-[env(safe-area-inset-top,8px)] lg:pt-0"
      :class="[
        isMobileSidebarOpen ? 'translate-x-0 w-[240px]' : '-translate-x-full lg:translate-x-0',
        layoutStore.isMenuCollapsed ? 'lg:w-[64px]' : 'lg:w-[220px]'
      ]"
    >
      <div
        class="overflow-hidden flex-shrink-0 flex flex-col"
        :class="[
          layoutStore.isMenuCollapsed
            ? 'lg:w-[64px] lg:p-0 lg:pt-4 lg:pb-3 lg:items-center p-4 pb-4'
            : 'p-4 pb-3'
        ]"
      >
        <router-link
          to="/"
          @click="closeMobileSidebar"
          class="flex items-center outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-[var(--radius-ctrl)]"
          :class="layoutStore.isMenuCollapsed ? 'lg:justify-center w-full gap-3 lg:gap-0' : 'gap-2'"
        >
          <div
            v-if="!layoutStore.isMenuCollapsed || isMobileSidebarOpen"
            class="flex flex-col min-w-0"
            :class="{ 'lg:hidden': layoutStore.isMenuCollapsed && !isMobileSidebarOpen }"
          >
            <span class="imago-serif text-[22px] leading-none text-[var(--ink)]">Imago</span>
          </div>
          <span
            v-else
            class="imago-serif hidden lg:inline text-[18px] text-[var(--ink)]"
            aria-hidden="true"
            >I</span
          >
        </router-link>
      </div>

      <nav
        class="flex-1 min-h-0 overflow-y-auto flex flex-col custom-scrollbar overflow-x-hidden pb-6 pt-1"
        :class="
          layoutStore.isMenuCollapsed ? 'lg:px-2 lg:items-start gap-0.5 px-3' : 'px-3 gap-0.5'
        "
      >
        <div
          v-for="group in menuGroups"
          :key="group.label"
          class="flex flex-col"
          :class="[
            layoutStore.isMenuCollapsed && !isMobileSidebarOpen
              ? 'lg:w-[64px] mt-1 gap-0.5 lg:items-center w-full'
              : 'w-full mt-5 first:mt-1 gap-0.5'
          ]"
        >
          <div
            v-if="!layoutStore.isMenuCollapsed || isMobileSidebarOpen"
            class="min-w-0 truncate text-[11px] font-medium text-[var(--muted)] mb-1 ml-3"
            :title="group.label"
            :class="{ 'lg:hidden': layoutStore.isMenuCollapsed && !isMobileSidebarOpen }"
          >
            {{ group.label }}
          </div>
          <div
            v-else-if="!isMobileSidebarOpen"
            class="h-px bg-[var(--hairline)] my-2 w-6 mx-auto"
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
            :title="item.name"
            @click="closeMobileSidebar"
          >
            <component
              :is="item.icon"
              :size="layoutStore.isMenuCollapsed && !isMobileSidebarOpen ? 18 : 16"
              class="shrink-0"
            />
            <span
              v-if="!layoutStore.isMenuCollapsed || isMobileSidebarOpen"
              :class="{ 'lg:hidden': layoutStore.isMenuCollapsed && !isMobileSidebarOpen }"
              class="min-w-0 text-left leading-tight line-clamp-2 text-sm font-medium"
              >{{ item.name }}</span
            >
          </router-link>
        </div>
      </nav>

      <div
        class="flex border-t border-[var(--hairline)] shrink-0 px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))]"
        :class="[
          layoutStore.isMenuCollapsed && !isMobileSidebarOpen
            ? 'flex-col items-center gap-2'
            : 'flex-row items-center justify-center gap-1 lg:justify-start'
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
          class="hidden lg:block flex-1"
        ></div>

        <button
          @click="layoutStore.toggleMenu"
          class="hidden lg:flex items-center justify-center w-9 h-9 rounded-[var(--radius)] text-[var(--muted)] hover:text-[var(--ink)] hover:bg-[color-mix(in_srgb,var(--ink)_6%,transparent)] transition-colors shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
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

    <main class="flex-1 min-w-0 min-h-0 flex flex-col relative z-20 bg-[var(--paper)]">
      <header
        v-if="!isCover"
        class="shrink-0 flex min-w-0 items-center gap-1.5 px-2 md:gap-2 md:px-4 bg-[var(--paper)] border-b border-[var(--hairline)] z-50 md:z-[110] h-[calc(var(--header-h)+env(safe-area-inset-top,0px))] pt-[env(safe-area-inset-top,0px)]"
      >
        <div class="flex min-w-0 items-center gap-1.5 md:gap-2 z-20">
          <button
            class="lg:hidden text-[var(--ink)] hover:text-[var(--accent)] p-2 -ml-1 transition-colors min-h-[40px] min-w-[40px] flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)] rounded-[var(--radius)] shrink-0"
            :aria-label="t('nav.toggleMobile')"
            @click="toggleMobileSidebar"
          >
            <Menu :size="18" />
          </button>

          <span
            class="min-w-0 truncate text-[13px] font-medium text-[var(--ink)]"
            :title="currentRouteName"
            >{{ currentRouteName }}</span
          >
          <div id="top-bar-left" class="flex shrink-0 items-center"></div>
        </div>

        <div id="top-bar-center" class="flex grow shrink-0 items-center justify-end z-20"></div>

        <div
          class="flex items-center gap-2 text-[11px] font-medium text-[var(--muted)] hidden xl:flex shrink-0 tabular-spec"
        >
          <Loader2 v-if="store.processingCount > 0" class="animate-spin" :size="10" />
          <span v-if="store.processingCount === 0">{{ t('app.localProcessing') }}</span>
          <span v-else>{{ t('app.processing') }} ({{ store.globalProgress }}%)</span>
        </div>

        <div
          id="top-bar-right"
          class="flex shrink-0 items-center gap-2 z-20 has-[:any-link]:border-l has-[:enabled]:border-l has-[button]:border-l border-[var(--hairline)] pl-1.5 md:pl-3"
        ></div>
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
