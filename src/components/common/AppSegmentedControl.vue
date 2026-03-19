<script setup lang="ts" generic="T extends string | number | boolean">
import type { Component } from 'vue'

interface Option<V> {
  label: string
  value: V
  icon?: Component
}

interface Props<V> {
  modelValue: V
  options: Option<V>[]
  ariaLabel?: string
}

const props = defineProps<Props<T>>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: T): void
}>()

const select = (value: T) => {
  emit('update:modelValue', value)
}
</script>

<template>
  <div
    class="segmented-control p-1 bg-muted/50 rounded-xl border border-border/40 grid gap-1 w-full"
    :style="{
      gridTemplateColumns: `repeat(${options.length}, 1fr)`
    }"
    role="radiogroup"
    :aria-label="ariaLabel"
  >
    <button
      v-for="option in options"
      :key="String(option.value)"
      type="button"
      role="radio"
      :aria-checked="modelValue === option.value"
      class="button-item relative flex flex-col items-center justify-center py-2 px-1 rounded-lg transition-all duration-200 outline-none min-w-0"
      :class="
        modelValue === option.value
          ? 'bg-card text-primary shadow-sm ring-1 ring-black/5'
          : 'text-muted-foreground hover:text-foreground hover:bg-card/40'
      "
      @click="select(option.value)"
    >
      <div v-if="option.icon" class="icon-wrapper flex items-center justify-center w-5 h-4 mb-1">
        <!-- Polish: 恢复图标的自然渲染比例，通过调整 stroke 增强微标清晰度 -->
        <component
          :is="option.icon"
          class="w-auto h-full max-w-full max-h-full"
          :size="16"
          :stroke-width="2"
        />
      </div>
      <span class="text-[10px] font-black uppercase tracking-tighter truncate w-full text-center">{{
        option.label
      }}</span>
    </button>
  </div>
</template>

<style scoped>
.segmented-control {
  /* 确保整个组件在侧边栏中拥有绝对稳定的几何结构 */
  box-sizing: border-box;
}

.button-item {
  /* 强制按钮在 Grid 单元格内居中，绝不外溢 */
  aspect-ratio: auto;
}

.icon-wrapper {
  /* 解决图标对齐问题的核心：固定占位，内容居中 */
  flex-shrink: 0;
}
</style>
