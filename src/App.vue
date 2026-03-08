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
  Loader2
} from 'lucide-vue-next'
import { useImageStore } from './stores/imageStore'

const store = useImageStore()

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

    <aside
      class="w-[280px] bg-card border-r border-border flex flex-col z-40 transition-transform duration-300 md:static fixed inset-y-0 left-0"
      :class="
        isMobileSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full md:translate-x-0'
      "
    >
      <div class="p-10 pb-6">
        <div class="flex items-center gap-4">
          <div
            class="bg-primary text-primary-foreground p-2.5 rounded-xl shadow-lg shadow-primary/20"
          >
            <Image :size="22" />
          </div>
          <h1 class="text-2xl font-extrabold tracking-tight">Imago</h1>
        </div>
      </div>

      <nav class="flex-1 overflow-y-auto px-4 flex flex-col gap-1.5 custom-scrollbar">
        <router-link
          to="/"
          class="flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all duration-300 group relative overflow-hidden"
          :class="[
            $route.path === '/'
              ? 'bg-primary/10 text-primary shadow-[inset_0_0_12px_rgba(var(--primary-rgb),0.05)]'
              : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground hover:translate-x-1'
          ]"
          @click="closeMobileSidebar"
        >
          <Settings2
            :size="18"
            :class="{ 'scale-110': $route.path === '/' }"
            class="transition-transform duration-300"
          />
          <span>所有工具</span>
          <div
            v-if="$route.path === '/'"
            class="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary rounded-r-full shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)]"
          ></div>
        </router-link>

        <div v-for="group in menuGroups" :key="group.label" class="mt-7 flex flex-col gap-1.5">
          <div
            class="text-[11px] font-extrabold uppercase text-muted-foreground tracking-widest mb-3 ml-4 opacity-70"
          >
            {{ group.label }}
          </div>
          <router-link
            v-for="item in group.items"
            :key="item.path"
            :to="item.path"
            class="flex items-center gap-3 px-4 py-3 rounded-xl font-bold text-sm transition-all duration-300 group relative overflow-hidden"
            :class="[
              $route.path === item.path
                ? 'bg-primary/10 text-primary shadow-[inset_0_0_12px_rgba(var(--primary-rgb),0.05)]'
                : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground hover:translate-x-1'
            ]"
            @click="closeMobileSidebar"
          >
            <component
              :is="item.icon"
              :size="18"
              :class="{ 'scale-110': $route.path === item.path }"
              class="transition-transform duration-300"
            />
            <span>{{ item.name }}</span>
            <div
              v-if="$route.path === item.path"
              class="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-primary rounded-r-full shadow-[0_0_10px_rgba(var(--primary-rgb),0.5)]"
            ></div>
          </router-link>
        </div>
      </nav>

      <div class="p-6 flex flex-col gap-5 border-t border-border">
        <div class="bg-muted p-1 rounded-xl flex gap-1">
          <button
            v-for="mode in themeModes"
            :key="mode"
            class="flex-1 flex items-center justify-center py-2 rounded-lg text-muted-foreground transition-all hover:text-foreground"
            :class="{ 'bg-card text-primary shadow-sm dark:text-primary': theme === mode }"
            @click="setTheme(mode)"
            :title="mode"
          >
            <Sun v-if="mode === 'light'" :size="14" />
            <Monitor v-if="mode === 'system'" :size="14" />
            <Moon v-if="mode === 'dark'" :size="14" />
          </button>
        </div>

        <div
          class="flex items-center gap-2.5 p-3 bg-primary/5 hover:bg-primary/10 transition-colors rounded-xl text-primary dark:text-primary cursor-help"
          title="您的所有图片处理均在本地浏览器中完成，100% 安全隐私。"
        >
          <div class="opacity-80">
            <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
              <path
                d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"
              />
            </svg>
          </div>
          <span class="text-xs font-bold tracking-wide">Local Secured</span>
        </div>
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

    <main class="flex-1 flex flex-col overflow-hidden">
      <header
        class="h-20 shrink-0 flex items-center justify-between px-4 md:px-8 bg-background/80 backdrop-blur-xl border-b border-border z-10 sticky top-0"
      >
        <div class="flex items-center gap-3">
          <button
            class="md:hidden text-foreground hover:text-primary p-2 -ml-2 transition-colors"
            @click="toggleMobileSidebar"
          >
            <Menu :size="20" />
          </button>
          <div
            class="hidden md:flex items-center gap-2.5 text-[0.7rem] font-black text-muted-foreground/60 uppercase tracking-[0.2em]"
          >
            <div class="w-2 h-2 rounded-full bg-muted-foreground/30"></div>
            <span>Workspace</span>
          </div>
          <span class="hidden md:inline text-border/60 mx-1">/</span>
          <div
            class="h-8 md:h-9 px-4 flex items-center bg-primary/10 border border-primary/20 rounded-full text-[0.7rem] font-bold text-primary uppercase tracking-[0.1em] shadow-sm backdrop-blur-sm"
          >
            <span>{{ $route.name || 'Overview' }}</span>
          </div>
        </div>

        <div class="flex items-center gap-5">
          <div id="top-bar-tools" class="flex items-center gap-2"></div>

          <div class="w-px h-6 bg-border hidden md:block"></div>

          <div
            class="flex items-center gap-2.5 text-xs font-bold text-primary dark:text-primary bg-primary/10 px-4 py-2 rounded-full hidden sm:flex"
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
/* 页面路由切换动画 - iOS 风格更平滑的曲线 */
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
