import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

export const useLayoutStore = defineStore('layout', () => {
  // 侧边栏菜单状态
  const isMenuCollapsed = ref(localStorage.getItem('imago-menu-collapsed') === 'true')

  // 右侧属性面板状态
  const isInspectorCollapsed = ref(localStorage.getItem('imago-inspector-collapsed') === 'true')

  // 底部资源托盘折叠状态
  const isAssetsTrayCollapsed = ref(localStorage.getItem('imago-assets-tray-collapsed') === 'true')

  // 卡片尺寸模式: 'compact' | 'large'
  const cardSizeMode = ref<'compact' | 'large'>(
    (localStorage.getItem('imago-card-size-mode') as 'compact' | 'large') || 'large'
  )

  // 切换侧边栏
  const toggleMenu = () => {
    isMenuCollapsed.value = !isMenuCollapsed.value
  }

  // 切换属性面板
  const toggleInspector = () => {
    isInspectorCollapsed.value = !isInspectorCollapsed.value
  }

  // 切换资产托盘
  const toggleAssetsTray = () => {
    isAssetsTrayCollapsed.value = !isAssetsTrayCollapsed.value
  }

  // 切换卡片尺寸
  const toggleCardSize = () => {
    cardSizeMode.value = cardSizeMode.value === 'compact' ? 'large' : 'compact'
  }

  // 持久化存储
  watch(isMenuCollapsed, (val) => {
    localStorage.setItem('imago-menu-collapsed', String(val))
  })

  watch(isInspectorCollapsed, (val) => {
    localStorage.setItem('imago-inspector-collapsed', String(val))
  })

  watch(isAssetsTrayCollapsed, (val) => {
    localStorage.setItem('imago-assets-tray-collapsed', String(val))
  })

  watch(cardSizeMode, (val) => {
    localStorage.setItem('imago-card-size-mode', val)
  })

  return {
    isMenuCollapsed,
    isInspectorCollapsed,
    isAssetsTrayCollapsed,
    cardSizeMode,
    toggleMenu,
    toggleInspector,
    toggleAssetsTray,
    toggleCardSize
  }
})
