import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import './style.css'
import App from './App.vue'

import { useImageStore } from './stores/imageStore'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('./views/HomeView.vue')
    },
    {
      path: '/compress',
      name: 'compress',
      component: () => import('./views/CompressView.vue')
    },
    {
      path: '/resize',
      name: 'resize',
      component: () => import('./views/ResizeView.vue')
    },
    {
      path: '/crop',
      name: 'crop',
      component: () => import('./views/CropView.vue')
    },
    {
      path: '/filters',
      name: 'filters',
      component: () => import('./views/FiltersView.vue')
    },
    {
      path: '/split',
      name: 'split',
      component: () => import('./views/SplitView.vue')
    },
    {
      path: '/combine',
      name: 'combine',
      component: () => import('./views/CombineView.vue')
    },
    {
      path: '/exif',
      name: 'exif',
      component: () => import('./views/ExifView.vue')
    },
    {
      path: '/favicon',
      name: 'favicon',
      component: () => import('./views/FaviconView.vue')
    }
  ]
})

// --- [方案 A] 工具箱隔离模式核心逻辑 ---
router.beforeEach((to, from) => {
  // 仅在功能页面之间切换时触发重置（如果只是回主页或进入功能，也执行重置以保安全）
  if (to.name !== from.name) {
    const store = useImageStore()
    // 强制重置所有图片的临时处理状态和预览 URL，防止跨页面污染并释放内存
    store.resetAll()
  }
})

const app = createApp(App)
const pinia = createPinia()

app.use(pinia)
app.use(router)
app.mount('#app')
