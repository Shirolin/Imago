import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { createRouter, createWebHistory } from 'vue-router'
import './style.css'
import App from './App.vue'

// 基础路由配置
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
      path: '/exif',
      name: 'exif',
      component: () => import('./views/ExifView.vue')
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
      path: '/filters',
      name: 'filters',
      component: () => import('./views/FiltersView.vue')
    },
    {
      path: '/grid',
      name: 'grid',
      component: () => import('./views/GridView.vue')
    }
  ]
})

const app = createApp(App)
app.use(createPinia())
app.use(router)
app.mount('#app')
