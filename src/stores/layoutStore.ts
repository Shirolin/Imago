import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const useLayoutStore = defineStore('layout', () => {
  // 侧边栏菜单状态
  const isMenuCollapsed = ref(localStorage.getItem('imago-menu-collapsed') === 'true')

  // 右侧属性面板状态
  const isInspectorCollapsed = ref(localStorage.getItem('imago-inspector-collapsed') === 'true')

  // 切换侧边栏
  const toggleMenu = () => {
    isMenuCollapsed.value = !isMenuCollapsed.value
  }

  // 切换属性面板
  const toggleInspector = () => {
    isInspectorCollapsed.value = !isInspectorCollapsed.value
  }

  // 持久化存储
  watch(isMenuCollapsed, (val) => {
    localStorage.setItem('imago-menu-collapsed', String(val))
  })

  watch(isInspectorCollapsed, (val) => {
    localStorage.setItem('imago-inspector-collapsed', String(val))
  })

  return {
    isMenuCollapsed,
    isInspectorCollapsed,
    toggleMenu,
    toggleInspector
  }
})
