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
  padding: 'p-3 pb-5 md:p-4 md:pb-6'
})
</script>

<template>
  <div class="relative shrink-0 z-30">
    <div
      class="absolute bottom-full left-0 right-0 h-8 bg-gradient-to-t from-card to-transparent pointer-events-none z-10"
    ></div>
    <footer
      class="transition-all duration-300 relative"
      :class="[
        glass ? 'bg-card/95 backdrop-blur-md' : 'bg-card',
        showBorder ? 'border-t border-border/50' : '',
        padding
      ]"
    >
      <div class="flex items-center gap-3 w-full">
        <slot></slot>
      </div>
    </footer>
  </div>
</template>
