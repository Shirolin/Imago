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
      meta: { title: 'tools.compress.name' }
    },
    {
      path: '/resize',
      name: 'resize',
      component: () => import('./views/ResizeView.vue'),
      meta: { title: 'tools.resize.name' }
    },
    {
      path: '/crop',
      name: 'crop',
      component: () => import('./views/CropView.vue'),
      meta: { title: 'tools.crop.name' }
    },
    {
      path: '/filters',
      name: 'filters',
      component: () => import('./views/FiltersView.vue'),
      meta: { title: 'tools.filters.name' }
    },
    {
      path: '/split',
      name: 'split',
      component: () => import('./views/SplitView.vue'),
      meta: { title: 'tools.split.name' }
    },
    {
      path: '/combine',
      name: 'combine',
      component: () => import('./views/CombineView.vue'),
      meta: { title: 'tools.combine.name' }
    },
    {
      path: '/exif',
      name: 'exif',
      component: () => import('./views/ExifView.vue'),
      meta: { title: 'tools.exif.name' }
    },
    {
      path: '/favicon',
      name: 'favicon',
      component: () => import('./views/FaviconView.vue'),
      meta: { title: 'tools.favicon.name' }
    },
    {
      path: '/bg-remove',
      name: 'bgRemove',
      component: () => import('./views/BgRemoveView.vue'),
      meta: { title: 'tools.bgRemove.name' }
    }
  ]
})

const updateTitle = () => {
  const currentRoute = router.currentRoute.value
  const titleKey = currentRoute.meta.title as string
  if (titleKey) {
    document.title = `Imago | ${i18n.global.t(titleKey)}`
  } else {
    document.title = 'Imago'
  }
}

/** Map app locale codes to BCP 47 for typography (hyphens / keep-all). */
const syncHtmlLang = (locale: string) => {
  const lang = locale.startsWith('pt') ? 'pt' : locale.split('-')[0] || locale
  document.documentElement.lang = lang
}

syncHtmlLang(i18n.global.locale.value)

// --- SEO & GEO: 动态标题更新 ---
router.afterEach(() => {
  updateTitle()
})

watch(
  () => i18n.global.locale.value,
  (locale) => {
    syncHtmlLang(locale)
    updateTitle()
  }
)

const app = createApp(App)
const pinia = createPinia()

app.use(i18n)
app.use(pinia)
app.use(router)
router.isReady().then(updateTitle)
app.mount('#app')
