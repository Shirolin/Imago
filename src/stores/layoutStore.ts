import { defineStore } from 'pinia'
import { ref } from 'vue'

export const useLayoutStore = defineStore('layout', () => {
  // 1. 左侧导航菜单 (Menu) - 独立控制
  const isMenuCollapsed = ref(localStorage.getItem('menuCollapsed') === 'true')

  // 2. 顶部全局工具栏 (Global Toolbar) - 独立控制 (紧凑模式)
  const isTopBarCompact = ref(localStorage.getItem('topBarCompact') === 'true')

  // 3. 右侧属性面板 (Right Inspector) - 独立控制 (完全收起)
  const isInspectorCollapsed = ref(localStorage.getItem('inspectorCollapsed') === 'true')

  const toggleMenu = () => {
    isMenuCollapsed.value = !isMenuCollapsed.value
    localStorage.setItem('menuCollapsed', String(isMenuCollapsed.value))
  }

  const toggleTopBar = () => {
    isTopBarCompact.value = !isTopBarCompact.value
    localStorage.setItem('topBarCompact', String(isTopBarCompact.value))
  }

  const toggleInspector = () => {
    isInspectorCollapsed.value = !isInspectorCollapsed.value
    localStorage.setItem('inspectorCollapsed', String(isInspectorCollapsed.value))
  }

  return {
    isMenuCollapsed,
    isTopBarCompact,
    isInspectorCollapsed,
    toggleMenu,
    toggleTopBar,
    toggleInspector
  }
})
