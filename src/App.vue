<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  Image,
  Minimize2,
  Maximize2,
  Scissors,
  Settings2,
  Trash2,
  Split,
  Layers,
  Palette,
  Grid3X3,
  Sun,
  Moon,
  Monitor,
  Menu,
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronsUp,
  ChevronsDown
} from 'lucide-vue-next'
import { useImageStore } from './stores/imageStore'
import { useLayoutStore } from './stores/layoutStore'

const store = useImageStore()
const layoutStore = useLayoutStore()

const theme = ref<'light' | 'dark' | 'system'>('system')
const themeModes = ['light', 'system', 'dark'] as const

const isMobileSidebarOpen = ref(false)
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

const applyTheme = () => {
  const root = document.documentElement
  let effectiveTheme = theme.value

  if (theme.value === 'system') {
    effectiveTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }

  root.setAttribute('data-theme', effectiveTheme)
  localStorage.setItem('imago-theme', theme.value)
}

onMounted(() => {
  const saved = localStorage.getItem('imago-theme') as 'light' | 'dark' | 'system' | null
  if (saved) theme.value = saved
  applyTheme()

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    if (theme.value === 'system') applyTheme()
  })
})

const menuGroups = [
  {
    label: '核心工具',
    items: [
      { name: '图片压缩', path: '/compress', icon: Minimize2 },
      { name: '调整尺寸', path: '/resize', icon: Maximize2 }
    ]
  },
  {
    label: '编辑工具',
    items: [
      { name: '裁剪图片', path: '/crop', icon: Scissors },
      { name: '清除 EXIF', path: '/exif', icon: Trash2 },
      { name: '图片分割', path: '/split', icon: Split }
    ]
  },
  {
    label: '创意工具',
    items: [
      { name: '图片合并', path: '/combine', icon: Layers },
      { name: '色彩滤镜', path: '/filters', icon: Palette },
      { name: '网格生成', path: '/grid', icon: Grid3X3 }
    ]
  }
]
</script>

<template>
  <div
    class="flex h-screen w-full overflow-hidden relative bg-background text-foreground antialiased transition-colors duration-300"
  >
    <div
      v-show="isMobileSidebarOpen"
      @click="closeMobileSidebar"
      class="fixed inset-0 bg-black/40 backdrop-blur-sm z-30 md:hidden"
    ></div>

    <!-- Sidebar (Menu) -->
    <aside
      class="bg-card border-r border-border flex flex-col z-40 transition-all duration-300 ease-in-out md:static fixed inset-y-0 left-0"
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
        :class="[layoutStore.isMenuCollapsed ? 'p-0 pt-4 pb-3 items-center' : 'p-6 pb-8 pl-4 pr-0']"
      >
        <div class="flex items-center gap-4">
          <div
            class="bg-primary text-primary-foreground p-2.5 rounded-xl shadow-lg shadow-primary/20 shrink-0"
          >
            <Image :size="22" />
          </div>
          <transition name="fade">
            <h1
              v-if="!layoutStore.isMenuCollapsed"
              class="text-2xl font-extrabold tracking-tight whitespace-nowrap"
            >
              Imago
            </h1>
          </transition>
        </div>
      </div>

      <nav
        class="flex-1 overflow-y-auto flex flex-col custom-scrollbar overflow-x-hidden pb-10 transition-all duration-300 pt-2"
        :style="!layoutStore.isMenuCollapsed ? 'scrollbar-gutter: stable' : ''"
        :class="[layoutStore.isMenuCollapsed ? 'px-0 items-center gap-1' : 'pl-4 pr-0 gap-1.5']"
      >
        <router-link
          to="/"
          class="flex items-center rounded-xl font-bold text-sm transition-all duration-300 group relative overflow-hidden shrink-0"
          :class="[
            $route.path === '/'
              ? 'bg-primary/10 text-primary shadow-[inset_0_0_12px_rgba(var(--primary-rgb),0.05)]'
              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
            layoutStore.isMenuCollapsed ? 'justify-center h-11 w-11' : 'px-4 py-3.5 gap-3'
          ]"
          :title="layoutStore.isMenuCollapsed ? '所有工具' : ''"
          @click="closeMobileSidebar"
        >
          <Settings2
            :size="layoutStore.isMenuCollapsed ? 20 : 18"
            :class="{ 'scale-110': $route.path === '/' }"
            class="transition-transform duration-300 shrink-0"
          />
          <span v-if="!layoutStore.isMenuCollapsed" class="whitespace-nowrap">所有工具</span>
          <div
            v-if="$route.path === '/' && !layoutStore.isMenuCollapsed"
            class="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary rounded-r-full shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)]"
          ></div>
        </router-link>

        <div
          v-for="group in menuGroups"
          :key="group.label"
          class="flex flex-col transition-all duration-300 w-full"
          :class="layoutStore.isMenuCollapsed ? 'mt-1 gap-1 items-center' : 'mt-6 gap-1.5'"
        >
          <div
            v-if="!layoutStore.isMenuCollapsed"
            class="text-[10px] font-black uppercase text-muted-foreground/50 tracking-[0.2em] mb-2 ml-4 whitespace-nowrap"
          >
            {{ group.label }}
          </div>
          <div v-else class="h-px bg-border/40 my-0.5 w-8"></div>

          <router-link
            v-for="item in group.items"
            :key="item.path"
            :to="item.path"
            class="flex items-center rounded-xl font-bold text-sm transition-all duration-300 group relative overflow-hidden shrink-0"
            :class="[
              $route.path === item.path
                ? 'bg-primary/10 text-primary shadow-[inset_0_0_12px_rgba(var(--primary-rgb),0.05)]'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
              layoutStore.isMenuCollapsed ? 'justify-center h-11 w-11' : 'px-4 py-3.5 gap-3'
            ]"
            :title="layoutStore.isMenuCollapsed ? item.name : ''"
            @click="closeMobileSidebar"
          >
            <component
              :is="item.icon"
              :size="layoutStore.isMenuCollapsed ? 20 : 18"
              :class="{ 'scale-110': $route.path === item.path }"
              class="transition-transform duration-300 shrink-0"
            />
            <span v-if="!layoutStore.isMenuCollapsed" class="whitespace-nowrap">{{
              item.name
            }}</span>
            <div
              v-if="$route.path === item.path && !layoutStore.isMenuCollapsed"
              class="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary rounded-r-full shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)]"
            ></div>
          </router-link>
        </div>
      </nav>

      <div
        class="flex flex-col border-t border-border shrink-0 bg-card/50 backdrop-blur-md transition-all duration-300"
        :style="!layoutStore.isMenuCollapsed ? 'scrollbar-gutter: stable' : ''"
        :class="
          layoutStore.isMenuCollapsed
            ? 'p-0 pt-4 pb-4 items-center gap-4'
            : 'p-4 pb-6 pl-6 pr-4 gap-3'
        "
      >
        <div
          class="flex items-center gap-2"
          :class="layoutStore.isMenuCollapsed ? 'flex-col' : 'flex-row w-full'"
        >
          <div
            class="bg-muted/60 p-1 rounded-xl flex gap-1 transition-all duration-300"
            :class="layoutStore.isMenuCollapsed ? 'flex-col w-12 items-center' : 'flex-1 flex-row'"
          >
            <button
              v-for="mode in themeModes"
              :key="mode"
              class="flex items-center justify-center rounded-lg text-muted-foreground transition-all hover:text-foreground hover:bg-card/50"
              :class="[
                theme === mode
                  ? 'bg-card text-primary shadow-sm ring-1 ring-black/5 dark:ring-white/5'
                  : '',
                layoutStore.isMenuCollapsed ? 'h-10 w-10' : 'flex-1 py-2'
              ]"
              @click="setTheme(mode)"
              :title="mode"
            >
              <Sun v-if="mode === 'light'" :size="14" />
              <Monitor v-if="mode === 'system'" :size="14" />
              <Moon v-if="mode === 'dark'" :size="14" />
            </button>
          </div>

          <button
            v-if="!layoutStore.isMenuCollapsed"
            @click="layoutStore.toggleMenu"
            class="hidden md:flex items-center justify-center h-10 w-10 shrink-0 rounded-xl bg-muted/60 hover:bg-primary/10 hover:text-primary transition-all text-muted-foreground group"
            title="收起菜单"
          >
            <ChevronLeft :size="18" class="group-hover:-translate-x-0.5 transition-transform" />
          </button>
        </div>

        <button
          v-if="layoutStore.isMenuCollapsed"
          @click="layoutStore.toggleMenu"
          class="hidden md:flex items-center justify-center h-12 w-12 rounded-xl bg-muted/60 hover:bg-primary/10 hover:text-primary transition-all text-muted-foreground group"
          title="展开菜单"
        >
          <ChevronRight :size="18" class="group-hover:translate-x-0.5 transition-transform" />
        </button>
      </div>
    </aside>

    <div
      class="absolute top-0 left-0 right-0 h-[3px] z-50 pointer-events-none"
      v-if="store.processingCount > 0"
    >
      <div
        class="h-full bg-primary transition-all duration-300 ease-out shadow-[0_0_10px_var(--primary)]"
        :style="{ width: store.globalProgress + '%' }"
      ></div>
    </div>

    <main class="flex-1 flex flex-col overflow-hidden relative">
      <!-- Toolbar (Header) -->
      <header
        class="shrink-0 flex items-center justify-between px-4 md:px-8 bg-background/80 backdrop-blur-xl border-b border-border z-10 sticky top-0 transition-all duration-300 ease-in-out"
        :class="layoutStore.isTopBarCompact ? 'h-14 md:h-14' : 'h-20'"
      >
        <div class="flex items-center gap-3">
          <button
            class="md:hidden text-foreground hover:text-primary p-2 -ml-2 transition-colors"
            @click="toggleMobileSidebar"
          >
            <Menu :size="20" />
          </button>

          <div class="flex items-center gap-3">
            <button
              @click="layoutStore.toggleTopBar"
              class="hidden md:flex text-muted-foreground hover:text-primary p-1.5 hover:bg-muted rounded-lg transition-all"
              :title="layoutStore.isTopBarCompact ? '展开工具栏' : '收起工具栏'"
            >
              <ChevronsDown v-if="layoutStore.isTopBarCompact" :size="16" />
              <ChevronsUp v-else :size="16" />
            </button>

            <div
              v-if="!layoutStore.isTopBarCompact"
              class="hidden md:flex items-center gap-2.5 text-[0.7rem] font-black text-muted-foreground/60 uppercase tracking-[0.2em]"
            >
              <div class="w-2 h-2 rounded-full bg-muted-foreground/30"></div>
              <span>Workspace</span>
            </div>
            <span v-if="!layoutStore.isTopBarCompact" class="hidden md:inline text-border/60 mx-1"
              >/</span
            >
            <div
              class="h-8 flex items-center bg-primary/10 border border-primary/20 rounded-full text-[0.7rem] font-bold text-primary uppercase tracking-[0.1em] shadow-sm backdrop-blur-sm transition-all"
              :class="layoutStore.isTopBarCompact ? 'px-3' : 'px-4 md:h-9'"
            >
              <span>{{ $route.name || 'Overview' }}</span>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-5">
          <div id="top-bar-tools" class="flex items-center gap-2"></div>

          <div class="w-px h-6 bg-border hidden md:block"></div>

          <div
            class="flex items-center gap-2.5 text-xs font-bold text-primary dark:text-primary bg-primary/10 px-4 py-2 rounded-full hidden sm:flex transition-all"
            :class="layoutStore.isTopBarCompact ? 'py-1.5' : 'py-2'"
          >
            <span
              v-if="store.processingCount === 0"
              class="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_var(--primary)]"
            ></span>
            <Loader2 v-else class="animate-spin" :size="12" />
            <span v-if="store.processingCount === 0">Offline Safe</span>
            <span v-else>处理中 ({{ store.globalProgress }}%)</span>
          </div>

          <div class="w-px h-6 bg-border"></div>

          <a
            href="https://github.com/shironone/imago"
            target="_blank"
            class="text-muted-foreground hover:text-primary hover:-translate-y-0.5 transition-all"
          >
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              stroke="currentColor"
              stroke-width="2"
              fill="none"
              stroke-linecap="round"
              stroke-linejoin="round"
            >
              <path
                d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"
              />
            </svg>
          </a>
        </div>
      </header>

      <div class="flex-1 overflow-y-auto scroll-smooth custom-scrollbar relative">
        <router-view v-slot="{ Component }">
          <transition name="page-fade" mode="out-in">
            <component :is="Component" />
          </transition>
        </router-view>
      </div>
    </main>
  </div>
</template>

<style>
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
