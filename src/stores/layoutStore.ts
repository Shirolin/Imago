import { defineStore } from 'pinia'
import { ref, watch } from 'vue'

// P2-17: localStorage 脏值防护。布尔值统一走 readBool（仅字面量 'true' 为真），
// 任何第三方写入的脏字符串（如 '1'、'yes'、'false '）都不会被误解析。
const readBool = (key: string) => localStorage.getItem(key) === 'true'

// 卡片尺寸仅接受 'compact' | 'large'，其余脏值一律回退默认 'large'
const readCardSizeMode = (): 'compact' | 'large' => {
  const raw = localStorage.getItem('imago-card-size-mode')
  return raw === 'compact' ? 'compact' : 'large'
}

export const useLayoutStore = defineStore('layout', () => {
  // 侧边栏菜单状态
  const isMenuCollapsed = ref(readBool('imago-menu-collapsed'))

  // 右侧属性面板状态
  const isInspectorCollapsed = ref(readBool('imago-inspector-collapsed'))

  // 底部资源托盘折叠状态
  const isAssetsTrayCollapsed = ref(readBool('imago-assets-tray-collapsed'))

  // 卡片尺寸模式: 'compact' | 'large'
  const cardSizeMode = ref<'compact' | 'large'>(readCardSizeMode())

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
