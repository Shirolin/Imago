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
  ChevronRight
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

const routeNameMap: Record<string, string> = {
  home: '概览',
  Home: '概览',
  compress: '压缩转换',
  Compress: '压缩转换',
  resize: '调整尺寸',
  Resize: '调整尺寸',
  crop: '裁剪图片',
  Crop: '裁剪图片',
  exif: '清除 EXIF',
  Exif: '清除 EXIF',
  split: '图片分割',
  Split: '图片分割',
  combine: '图片合并',
  Combine: '图片合并',
  filters: '色彩滤镜',
  Filters: '色彩滤镜',
  grid: '网格生成',
  Grid: '网格生成'
}

const menuGroups = [
  {
    label: '核心工具',
    items: [
      { name: '压缩转换', path: '/compress', icon: Minimize2 },
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
        :class="[
          layoutStore.isMenuCollapsed
            ? 'md:w-[72px] md:p-0 md:pt-4 md:pb-3 md:items-center p-6 pb-8 pl-4 pr-0'
            : 'p-6 pb-8 pl-4 pr-0'
        ]"
      >
        <router-link
          to="/"
          @click="closeMobileSidebar"
          class="flex items-center hover:opacity-80 transition-opacity active:scale-95 duration-200"
          :class="layoutStore.isMenuCollapsed ? 'md:justify-center w-full gap-4 md:gap-0' : 'gap-4'"
        >
          <div
            class="bg-primary text-primary-foreground p-2.5 rounded-xl shadow-lg shadow-primary/20 shrink-0"
          >
            <Image :size="22" />
          </div>
          <transition name="fade">
            <div
              v-if="!layoutStore.isMenuCollapsed || isMobileSidebarOpen"
              class="flex flex-col justify-center"
              :class="{ 'md:hidden': layoutStore.isMenuCollapsed && !isMobileSidebarOpen }"
            >
              <h1 class="text-2xl font-extrabold tracking-tight whitespace-nowrap leading-none">
                Imago
              </h1>
              <span class="text-[10px] font-bold text-muted-foreground/60 tracking-tight mt-1.5">
                极简图像处理工具
              </span>
            </div>
          </transition>
        </router-link>
      </div>

      <nav
        class="flex-1 overflow-y-auto flex flex-col custom-scrollbar overflow-x-hidden pb-10 transition-all duration-300 pt-2"
        :style="!layoutStore.isMenuCollapsed ? 'scrollbar-gutter: stable' : ''"
        :class="[
          layoutStore.isMenuCollapsed
            ? 'md:px-0 md:items-start gap-1 pl-4 pr-0'
            : 'pl-4 pr-0 gap-1.5'
        ]"
      >
        <router-link
          to="/"
          class="flex items-center font-bold text-sm transition-all duration-300 group relative overflow-hidden shrink-0"
          :class="[
            $route.path === '/'
              ? 'bg-primary/10 text-primary shadow-[inset_0_0_12px_rgba(var(--primary-rgb),0.05)]'
              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
            layoutStore.isMenuCollapsed
              ? 'md:justify-center h-11 md:w-[72px] md:rounded-none px-4 py-3.5 gap-3 rounded-xl'
              : 'px-4 py-3.5 gap-3 rounded-xl'
          ]"
          :title="layoutStore.isMenuCollapsed ? '所有工具' : ''"
          @click="closeMobileSidebar"
        >
          <Settings2
            :size="layoutStore.isMenuCollapsed ? 20 : 18"
            :class="{ 'scale-110': $route.path === '/' }"
            class="transition-transform duration-300 shrink-0"
          />
          <span
            v-if="!layoutStore.isMenuCollapsed || isMobileSidebarOpen"
            class="whitespace-nowrap"
            :class="{ 'md:hidden': layoutStore.isMenuCollapsed && !isMobileSidebarOpen }"
            >所有工具</span
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
              : 'w-full mt-6 gap-1.5'
          ]"
        >
          <div
            v-if="!layoutStore.isMenuCollapsed || isMobileSidebarOpen"
            class="text-[10px] font-black uppercase text-muted-foreground/50 tracking-[0.2em] mb-2 ml-4 whitespace-nowrap"
            :class="{ 'md:hidden': layoutStore.isMenuCollapsed && !isMobileSidebarOpen }"
          >
            {{ group.label }}
          </div>
          <div v-else-if="!isMobileSidebarOpen" class="h-px bg-border/40 my-0.5 w-8"></div>

          <router-link
            v-for="item in group.items"
            :key="item.path"
            :to="item.path"
            class="flex items-center font-bold text-sm transition-all duration-300 group relative overflow-hidden shrink-0"
            :class="[
              $route.path === item.path
                ? 'bg-primary/10 text-primary shadow-[inset_0_0_12px_rgba(var(--primary-rgb),0.05)]'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
              layoutStore.isMenuCollapsed && !isMobileSidebarOpen
                ? 'md:justify-center h-11 md:w-[72px] md:rounded-none'
                : 'px-4 py-3.5 gap-3 rounded-xl'
            ]"
            :title="layoutStore.isMenuCollapsed ? item.name : ''"
            @click="closeMobileSidebar"
          >
            <component
              :is="item.icon"
              :size="layoutStore.isMenuCollapsed && !isMobileSidebarOpen ? 20 : 18"
              :class="{ 'scale-110': $route.path === item.path }"
              class="transition-transform duration-300 shrink-0"
            />
            <span
              v-if="!layoutStore.isMenuCollapsed || isMobileSidebarOpen"
              :class="{ 'md:hidden': layoutStore.isMenuCollapsed && !isMobileSidebarOpen }"
              class="whitespace-nowrap"
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
        class="flex flex-col border-t border-border shrink-0 bg-card/50 backdrop-blur-md transition-all duration-300"
        :style="!layoutStore.isMenuCollapsed ? 'scrollbar-gutter: stable' : ''"
        :class="
          layoutStore.isMenuCollapsed && !isMobileSidebarOpen
            ? 'md:w-[72px] md:p-0 md:pt-4 md:pb-4 md:items-center md:gap-4 p-4 pb-6 pl-6 pr-4 gap-3'
            : 'p-4 pb-6 pl-6 pr-4 gap-3'
        "
      >
        <div
          class="flex items-center"
          :class="
            layoutStore.isMenuCollapsed && !isMobileSidebarOpen
              ? 'md:flex-col md:gap-4 w-full md:justify-center flex-row gap-2'
              : 'flex-row w-full gap-2'
          "
        >
          <div
            class="bg-muted/60 p-1 rounded-xl flex gap-1 transition-all duration-300"
            :class="
              layoutStore.isMenuCollapsed && !isMobileSidebarOpen
                ? 'md:flex-col md:w-12 md:items-center flex-row flex-1'
                : 'flex-1 flex-row'
            "
          >
            <button
              v-for="mode in themeModes"
              :key="mode"
              class="flex items-center justify-center rounded-lg text-muted-foreground transition-all hover:text-foreground hover:bg-card/50"
              :class="[
                theme === mode
                  ? 'bg-card text-primary shadow-sm ring-1 ring-black/5 dark:ring-white/5'
                  : '',
                layoutStore.isMenuCollapsed && !isMobileSidebarOpen
                  ? 'md:h-10 md:w-10 flex-1 py-2'
                  : 'flex-1 py-2'
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
            v-if="!layoutStore.isMenuCollapsed || isMobileSidebarOpen"
            @click="layoutStore.toggleMenu"
            class="hidden md:flex items-center justify-center h-10 w-10 shrink-0 rounded-xl bg-muted/60 hover:bg-primary/10 hover:text-primary transition-all text-muted-foreground group"
            title="收起菜单"
          >
            <ChevronLeft :size="18" class="group-hover:-translate-x-0.5 transition-transform" />
          </button>
        </div>

        <button
          v-if="layoutStore.isMenuCollapsed && !isMobileSidebarOpen"
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
        class="shrink-0 flex items-center justify-between px-4 md:px-8 bg-background/80 backdrop-blur-xl border-b border-border z-10 sticky top-0 h-16"
      >
        <div class="flex items-center gap-3">
          <button
            class="md:hidden text-foreground hover:text-primary p-2 -ml-2 transition-colors"
            @click="toggleMobileSidebar"
          >
            <Menu :size="20" />
          </button>

          <div class="flex items-center gap-3">
            <div
              class="hidden md:flex items-center gap-2.5 text-[0.7rem] font-black text-muted-foreground/60 uppercase tracking-[0.2em]"
            >
              <div class="w-2 h-2 rounded-full bg-muted-foreground/30"></div>
              <span>工作区</span>
            </div>
            <span class="hidden md:inline text-border/60 mx-1">/</span>
            <div
              class="h-8 flex items-center bg-primary/10 border border-primary/20 rounded-full text-[0.7rem] font-bold text-primary uppercase tracking-[0.1em] shadow-sm backdrop-blur-sm px-4 transition-all"
            >
              <span>{{ routeNameMap[$route.name as string] || $route.name || '概览' }}</span>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-5">
          <div id="top-bar-tools" class="flex items-center gap-2"></div>

          <div class="w-px h-6 bg-border hidden md:block"></div>

          <div
            class="flex items-center gap-2.5 text-xs font-bold text-primary dark:text-primary bg-primary/10 px-4 py-2 rounded-full hidden sm:flex transition-all"
          >
            <span
              v-if="store.processingCount === 0"
              class="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_var(--primary)]"
            ></span>
            <Loader2 v-else class="animate-spin" :size="12" />
            <span v-if="store.processingCount === 0">本地处理</span>
            <span v-else>处理中 ({{ store.globalProgress }}%)</span>
          </div>

          <div class="w-px h-6 bg-border"></div>

          <a
            href="https://github.com/Shirolin/Imago"
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

      <div class="flex-1 overflow-hidden relative">
        <router-view v-slot="{ Component, route }">
          <transition name="page-fade" mode="out-in">
            <suspense :timeout="0">
              <template #default>
                <component :is="Component" :key="route.fullPath" />
              </template>
              <template #fallback>
                <div class="h-full w-full flex items-center justify-center">
                  <Loader2 class="animate-spin text-primary/10" :size="32" />
                </div>
              </template>
            </suspense>
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
