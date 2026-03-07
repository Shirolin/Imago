<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { 
  Image, Minimize2, Maximize2, Scissors, Settings2, Trash2, 
  Split, Layers, Palette, Grid3X3, Sun, Moon, Monitor 
} from 'lucide-vue-next'

const theme = ref<'light' | 'dark' | 'system'>('system')

const toggleTheme = () => {
  if (theme.value === 'system') theme.value = 'dark'
  else if (theme.value === 'dark') theme.value = 'light'
  else theme.value = 'system'
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
  const saved = localStorage.getItem('imago-theme') as any
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
      { name: '调整尺寸', path: '/resize', icon: Maximize2 },
    ]
  },
  {
    label: '编辑工具',
    items: [
      { name: '裁剪图片', path: '/crop', icon: Scissors },
      { name: '清除 EXIF', path: '/exif', icon: Trash2 },
      { name: '图片分割', path: '/split', icon: Split },
    ]
  },
  {
    label: '创意工具',
    items: [
      { name: '图片合并', path: '/combine', icon: Layers },
      { name: '色彩滤镜', path: '/filters', icon: Palette },
      { name: '网格生成', path: '/grid', icon: Grid3X3 },
    ]
  }
]
</script>

<template>
  <div class="app-container">
    <aside class="sidebar">
      <div class="sidebar-header">
        <div class="logo">
          <div class="logo-icon">
            <Image :size="22" color="#22C55E" />
          </div>
          <h1>Imago</h1>
        </div>
      </div>

      <nav class="sidebar-nav custom-scrollbar">
        <router-link to="/" class="nav-item main-nav">
          <Settings2 :size="18" />
          <span>所有工具</span>
        </router-link>

        <div v-for="group in menuGroups" :key="group.label" class="nav-group-wrapper">
          <div class="nav-group-label">{{ group.label }}</div>
          <router-link 
            v-for="item in group.items" 
            :key="item.path" 
            :to="item.path" 
            class="nav-item"
          >
            <component :is="item.icon" :size="18" />
            <span>{{ item.name }}</span>
          </router-link>
        </div>
      </nav>

      <div class="sidebar-footer">
        <div class="theme-switcher" @click="toggleTheme">
          <div class="switch-track">
            <div class="switch-thumb" :class="theme">
              <Sun v-if="theme === 'light'" :size="14" />
              <Moon v-if="theme === 'dark'" :size="14" />
              <Monitor v-if="theme === 'system'" :size="14" />
            </div>
            <span class="theme-label">
              {{ theme === 'system' ? '系统' : theme === 'dark' ? '深色' : '浅色' }}
            </span>
          </div>
        </div>
        
        <div class="security-card">
          <div class="security-tag">
            <div class="dot"></div>
            Privacy Guaranteed
          </div>
          <p>所有操作均在本地完成</p>
        </div>
      </div>
    </aside>

    <main class="main-content">
      <header class="top-bar">
        <div class="breadcrumb">
          <span class="folder">Dashboard</span>
          <span class="separator">/</span>
          <span class="current">{{ $route.name || 'Overview' }}</span>
        </div>
        <div class="top-bar-actions">
          <div class="status-indicator">
            <span class="status-dot"></span>
            Offline Mode
          </div>
        </div>
      </header>
      
      <div class="content-wrapper custom-scrollbar">
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
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;700&family=Space+Grotesk:wght@400;500;600;700&display=swap');

:root {
  /* Dark Theme (Default) */
  --primary-color: #1E293B;
  --accent-color: #22C55E;
  --bg-color: #0F172A;
  --sidebar-bg: #1E293B;
  --text-primary: #F8FAFC;
  --text-secondary: #94A3B8;
  --border-color: #334155;
  --hover-bg: #334155;
  --card-bg: #1E293B;
  --topbar-bg: rgba(15, 23, 42, 0.8);
  
  --font-heading: 'Space Grotesk', sans-serif;
  --font-body: 'DM Sans', sans-serif;
  --scrollbar-thumb: #334155;
  --scrollbar-track: transparent;
}

[data-theme="light"] {
  --primary-color: #FFFFFF;
  --accent-color: #16A34A;
  --bg-color: #F8FAF9;
  --sidebar-bg: #FFFFFF;
  --text-primary: #0F172A;
  --text-secondary: #64748B;
  --border-color: #E2E8F0;
  --hover-bg: #F1F5F9;
  --card-bg: #FFFFFF;
  --topbar-bg: rgba(248, 250, 249, 0.8);
  --scrollbar-thumb: #CBD5E1;
}

* {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
}

body {
  font-family: var(--font-body);
  background-color: var(--bg-color);
  color: var(--text-primary);
  -webkit-font-smoothing: antialiased;
  overflow: hidden;
  transition: background-color 0.3s ease;
}

/* Custom Scrollbar Styling */
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: var(--scrollbar-track);
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: var(--scrollbar-thumb);
  border-radius: 10px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: var(--accent-color);
}

.app-container {
  display: flex;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}

/* Sidebar */
.sidebar {
  width: 280px;
  background: var(--sidebar-bg);
  border-right: 1px solid var(--border-color);
  display: flex;
  flex-direction: column;
  z-index: 20;
  transition: all 0.3s ease;
}

.sidebar-header {
  padding: 2rem 1.5rem;
}

.logo {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.logo-icon {
  background: var(--bg-color);
  padding: 8px;
  border-radius: 12px;
  border: 1px solid var(--border-color);
  display: flex;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.logo h1 {
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: -0.02em;
  color: var(--text-primary);
  font-family: var(--font-heading);
}

.sidebar-nav {
  flex: 1;
  overflow-y: auto;
  padding: 0 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.nav-group-wrapper {
  margin-top: 1.5rem;
}

.nav-group-label {
  font-family: var(--font-heading);
  font-size: 0.65rem;
  font-weight: 800;
  text-transform: uppercase;
  color: var(--text-secondary);
  letter-spacing: 0.15em;
  margin: 0 0 0.5rem 0.75rem;
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.nav-group-label::after {
  content: '';
  flex: 1;
  height: 1px;
  background: var(--border-color);
  opacity: 0.5;
}

.nav-item {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.875rem;
  padding: 0.75rem 1rem;
  text-decoration: none;
  color: var(--text-secondary);
  border-radius: 12px;
  transition: 
    background-color 0.25s cubic-bezier(0.4, 0, 0.2, 1),
    color 0.25s cubic-bezier(0.4, 0, 0.2, 1),
    transform 0.25s cubic-bezier(0.4, 0, 0.2, 1),
    box-shadow 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  font-weight: 500;
  font-size: 0.925rem;
  cursor: pointer;
  overflow: hidden;
}

.nav-item:hover {
  background-color: var(--hover-bg);
  color: var(--text-primary);
  transform: translateX(4px);
}

.nav-item:active {
  transform: scale(0.96) translateX(4px);
}

/* Active Indicator */
.nav-item::before {
  content: '';
  position: absolute;
  left: 0;
  top: 50%;
  transform: translateY(-50%) scaleY(0);
  width: 4px;
  height: 16px;
  background: #FFFFFF;
  border-radius: 0 4px 4px 0;
  transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
  opacity: 0;
}

.nav-item.router-link-active {
  background-color: var(--accent-color);
  color: #FFFFFF;
  font-weight: 700;
  box-shadow: 0 4px 15px rgba(34, 197, 94, 0.3);
}

.nav-item.router-link-active::before {
  transform: translateY(-50%) scaleY(1);
  opacity: 1;
}

.nav-item.router-link-active svg {
  transform: scale(1.1);
  filter: drop-shadow(0 0 4px rgba(255, 255, 255, 0.4));
}

[data-theme="light"] .nav-item.router-link-active {
  color: #FFFFFF;
}

.main-nav {
  margin-bottom: 0.5rem;
}

/* Sidebar Footer & Theme Switcher */
.sidebar-footer {
  padding: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  border-top: 1px solid var(--border-color);
}

.theme-switcher {
  cursor: pointer;
}

.switch-track {
  background: var(--bg-color);
  border: 1px solid var(--border-color);
  border-radius: 12px;
  padding: 4px;
  display: flex;
  align-items: center;
  gap: 0.75rem;
  transition: all 0.2s;
}

.switch-thumb {
  width: 28px;
  height: 28px;
  background: var(--accent-color);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
}

.theme-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-secondary);
}

.security-card {
  padding: 1rem;
  background: var(--bg-color);
  border-radius: 16px;
  border: 1px solid var(--border-color);
}

.security-tag {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.7rem;
  font-weight: 700;
  color: var(--accent-color);
  margin-bottom: 0.25rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.security-tag .dot {
  width: 6px;
  height: 6px;
  background: var(--accent-color);
  border-radius: 50%;
  box-shadow: 0 0 8px var(--accent-color);
}

.security-card p {
  font-size: 0.7rem;
  color: var(--text-secondary);
}

/* Main Content */
.main-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.top-bar {
  height: 72px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 2.5rem;
  background: var(--topbar-bg);
  backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border-color);
  z-index: 10;
}

.status-indicator {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
  background: var(--hover-bg);
  padding: 0.4rem 0.8rem;
  border-radius: 99px;
  border: 1px solid var(--border-color);
}

.status-dot {
  width: 8px;
  height: 8px;
  background: #22C55E;
  border-radius: 50%;
}

.content-wrapper {
  flex: 1;
  overflow-y: auto;
  padding: 0;
  scroll-behavior: smooth;
  scrollbar-gutter: stable;
}

/* Page Transitions */
.page-fade-enter-active,
.page-fade-leave-active {
  transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1), transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
}

.page-fade-enter-from {
  opacity: 0;
  transform: translateY(12px);
}

.page-fade-leave-to {
  opacity: 0;
  transform: translateY(-12px);
}
</style>


