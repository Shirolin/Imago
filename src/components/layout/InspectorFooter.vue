<script setup lang="ts">
/**
 * InspectorFooter
 * 统一的功能配置面板底部操作区
 * 提供物理置底、磨砂背景、标准内边距和顶部分割线
 */
interface Props {
  // 是否显示顶部分割线
  showBorder?: boolean
  // 是否启用磨砂玻璃效果
  glass?: boolean
  // 自定义内边距类
  padding?: string
}

withDefaults(defineProps<Props>(), {
  showBorder: true,
  glass: true,
  padding: 'p-3 md:p-4'
})
</script>

<template>
  <footer
    class="shrink-0 z-20 transition-all duration-300 relative"
    :class="[glass ? 'bg-card/95' : 'bg-card', showBorder ? 'border-t border-border' : '', padding]"
  >
    <div class="flex items-center gap-3 w-full">
      <slot></slot>
    </div>
  </footer>
</template>
