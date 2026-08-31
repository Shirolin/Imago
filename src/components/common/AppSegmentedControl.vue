<script setup lang="ts" generic="T extends string | number | boolean">
import { computed } from 'vue'
import type { Component } from 'vue'
import SegmentLabel from './SegmentLabel.vue'

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

// 计算当前激活项的索引，用于驱动滑动指示器
const activeIndex = computed(() => props.options.findIndex((opt) => opt.value === props.modelValue))

const select = (value: T) => {
  emit('update:modelValue', value)
}
</script>

<template>
  <div
    class="segmented-control p-1 bg-[var(--well)] rounded-[var(--radius-ctrl)] border border-[var(--hairline)] w-full select-none isolate relative overflow-hidden"
    role="radiogroup"
    :aria-label="ariaLabel"
  >
    <!-- 内容包装层：建立纯净的坐标系，隔离 Padding 对百分比计算的影响 -->
    <div
      class="relative w-full isolate h-full grid"
      :style="{ gridTemplateColumns: `repeat(${options.length}, 1fr)` }"
    >
      <!-- 滑动指示器 (GPU 加速版) -->
      <div
        v-if="activeIndex !== -1"
        class="indicator absolute inset-y-0 z-0 pointer-events-none will-change-transform"
        :style="{
          width: `${100 / (options.length || 1)}%`,
          transform: `translateX(${activeIndex * 100}%)`
        }"
      >
        <div class="w-full h-full p-0.5">
          <div
            class="w-full h-full bg-[var(--board)] rounded-[var(--radius-ctrl)] border border-[var(--hairline)]"
          ></div>
        </div>
      </div>

      <!-- 按钮层 -->
      <button
        v-for="option in options"
        :key="String(option.value)"
        type="button"
        role="radio"
        :aria-checked="modelValue === option.value"
        class="relative z-10 flex w-full flex-row items-center justify-center gap-1.5 overflow-hidden py-2.5 px-1 rounded-[var(--radius-ctrl)] transition-colors duration-150 outline-none min-w-0 min-h-[2.75rem]"
        :class="
          modelValue === option.value
            ? 'text-primary'
            : 'text-muted-foreground hover:text-foreground'
        "
        @click="select(option.value)"
      >
        <div v-if="option.icon" class="icon-wrapper flex items-center justify-center w-5 h-4">
          <!-- Polish: 恢复图标的自然渲染比例，通过调整 stroke 增强微标清晰度 -->
          <component
            :is="option.icon"
            class="w-auto h-full max-w-full max-h-full"
            :size="16"
            :stroke-width="2"
          />
        </div>
        <SegmentLabel v-if="option.label" :label="option.label" />
      </button>
    </div>
  </div>
</template>

<style scoped>
.segmented-control {
  /* 确保整个组件在布局中拥有绝对稳定的几何结构 */
  box-sizing: border-box;
}

.icon-wrapper {
  /* 固定占位，内容居中，防止图标尺寸微差导致的抖动 */
  flex-shrink: 0;
}

.indicator {
  transition: transform 0.15s ease-out;
}
</style>
