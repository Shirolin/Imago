<script setup lang="ts">
/**
 * InspectorFooter
 * 统一的功能配置面板底部操作区
 * 提供粘性置底、磨砂背景、标准内边距和顶部分割线
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
  padding: 'p-6'
})
</script>

<template>
  <footer
    class="sticky bottom-0 z-20 shrink-0 transition-all duration-300"
    :class="[
      glass ? 'bg-card/95 backdrop-blur-md' : 'bg-card',
      showBorder ? 'border-t border-border/50' : '',
      padding,
      // 增加向上的微弱投影，提示下方有可滚动内容
      'shadow-[0_-12px_24px_-10px_rgba(0,0,0,0.05)]'
    ]"
  >
    <div class="flex items-center gap-3">
      <slot></slot>
    </div>
  </footer>
</template>

<style scoped>
/* 确保在深色模式下阴影更克制 */
[data-theme='dark'] footer {
  box-shadow: 0 -12px 30px -15px rgba(0, 0, 0, 0.3);
}
</style>
