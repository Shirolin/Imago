import { createApp, watch } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import i18n from './i18n'
import './style.css'
import App from './App.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('./views/HomeView.vue'),
      meta: { title: 'common.pageTitleHome' }
    },
    {
      path: '/compress',
      name: 'compress',
      component: () => import('./views/CompressView.vue'),
      meta: { title: 'tools.compress.title' }
    },
    {
      path: '/resize',
      name: 'resize',
      component: () => import('./views/ResizeView.vue'),
      meta: { title: 'tools.resize.title' }
    },
    {
      path: '/crop',
      name: 'crop',
      component: () => import('./views/CropView.vue'),
      meta: { title: 'tools.crop.title' }
    },
    {
      path: '/filters',
      name: 'filters',
      component: () => import('./views/FiltersView.vue'),
      meta: { title: 'tools.filters.title' }
    },
    {
      path: '/split',
      name: 'split',
      component: () => import('./views/SplitView.vue'),
      meta: { title: 'tools.split.title' }
    },
    {
      path: '/combine',
      name: 'combine',
      component: () => import('./views/CombineView.vue'),
      meta: { title: 'tools.combine.title' }
    },
    {
      path: '/exif',
      name: 'exif',
      component: () => import('./views/ExifView.vue'),
      meta: { title: 'tools.exif.title' }
    },
    {
      path: '/favicon',
      name: 'favicon',
      component: () => import('./views/FaviconView.vue'),
      meta: { title: 'tools.favicon.title' }
    },
    {
      path: '/bg-remove',
      name: 'bgRemove',
      component: () => import('./views/BgRemoveView.vue'),
      meta: { title: 'tools.bgRemove.title' }
    }
  ]
})

const updateTitle = () => {
  const currentRoute = router.currentRoute.value
  const titleKey = currentRoute.meta.title as string
  if (titleKey) {
    document.title = `Imago | ${i18n.global.t(titleKey)}`
  } else {
    document.title = `Imago | ${i18n.global.t('app.subtitle')}`
  }
}

// --- SEO & GEO: 动态标题更新 ---
router.afterEach(() => {
  updateTitle()
})

// 监听语言变化同步更新标题
watch(() => i18n.global.locale.value, updateTitle)

const app = createApp(App)
const pinia = createPinia()

app.use(i18n)
app.use(pinia)
app.use(router)
app.mount('#app')
