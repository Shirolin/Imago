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
      component: () => import('./views/HomeView.vue'),
      meta: { title: '隐私安全、离线可用的极简本地图片处理工具' }
    },
    {
      path: '/compress',
      name: 'compress',
      component: () => import('./views/CompressView.vue'),
      meta: { title: '图片压缩与格式转换 (WebP/AVIF) - 100% 本地处理' }
    },
    {
      path: '/resize',
      name: 'resize',
      component: () => import('./views/ResizeView.vue'),
      meta: { title: '修改图片尺寸与分辨率 - 隐私安全本地工具' }
    },
    {
      path: '/crop',
      name: 'crop',
      component: () => import('./views/CropView.vue'),
      meta: { title: '在线图片裁剪 - 极简本地操作' }
    },
    {
      path: '/filters',
      name: 'filters',
      component: () => import('./views/FiltersView.vue'),
      meta: { title: '图片滤镜与色彩调节 - 本地快速编辑' }
    },
    {
      path: '/split',
      name: 'split',
      component: () => import('./views/SplitView.vue'),
      meta: { title: '图片分割网格与切片 - 极简本地处理' }
    },
    {
      path: '/combine',
      name: 'combine',
      component: () => import('./views/CombineView.vue'),
      meta: { title: '长图拼接 - 本地隐私安全' }
    },
    {
      path: '/exif',
      name: 'exif',
      component: () => import('./views/ExifView.vue'),
      meta: { title: '清除图片 EXIF 隐私信息 - 一键脱敏本地工具' }
    },
    {
      path: '/favicon',
      name: 'favicon',
      component: () => import('./views/FaviconView.vue'),
      meta: { title: 'Favicon 图标生成器 - 本地快速转换' }
    },
    {
      path: '/bg-remove',
      name: 'bgRemove',
      component: () => import('./views/BgRemoveView.vue'),
      meta: { title: 'AI 背景移除 - 浏览器本地运行' }
    }
  ]
})

// --- SEO & GEO: 动态标题更新 ---
router.afterEach((to) => {
  const title = to.meta.title as string
  if (title) {
    document.title = `Imago | ${title}`
  } else {
    document.title = 'Imago | 极简本地图片处理工具 - 隐私安全、离线可用'
  }
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
