<script setup lang="ts">
import { computed, ref, nextTick } from 'vue'
import type { Component } from 'vue'
import { RotateCcw } from 'lucide-vue-next'

interface Props {
  modelValue: number
  label?: string
  icon?: Component
  min?: number
  max?: number
  step?: number
  unit?: string
  snapValue?: number
  defaultValue?: number
  description?: string
  ariaLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  min: 0,
  max: 100,
  step: 1,
  unit: '',
  ariaLabel: '滑动条'
})

const emit = defineEmits(['update:modelValue'])

// --- 点击即编辑逻辑 ---
const isEditing = ref(false)
const tempValue = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

const startEdit = () => {
  tempValue.value = String(props.modelValue)
  isEditing.value = true
  nextTick(() => {
    inputRef.value?.focus()
    inputRef.value?.select()
  })
}

const commitEdit = () => {
  if (!isEditing.value) return

  let val = parseFloat(tempValue.value)

  // 校验 1：如果不是有效数字，回滚
  if (isNaN(val)) {
    isEditing.value = false
    return
  }

  // 校验 2：钳制范围 [min, max] 并处理步长
  const clamped = Math.max(props.min, Math.min(props.max, val))
  const stepped = Math.round(clamped / props.step) * props.step

  emit('update:modelValue', Number(stepped.toFixed(2)))
  isEditing.value = false
}

const cancelEdit = () => {
  isEditing.value = false
}

const progressPercent = computed(() => {
  return ((props.modelValue - props.min) / (props.max - props.min)) * 100
})

const handleInput = (e: Event) => {
  let value = parseFloat((e.target as HTMLInputElement).value)
  if (props.snapValue !== undefined) {
    const threshold = (props.max - props.min) * 0.03
    if (Math.abs(value - props.snapValue) < threshold) value = props.snapValue
  }
  emit('update:modelValue', value)
}

const handleReset = () => {
  if (props.defaultValue !== undefined) {
    emit('update:modelValue', props.defaultValue)
  }
}

// 辅助：判断是否偏离默认值（处理浮点数精度）
const isDirty = computed(() => {
  if (props.defaultValue === undefined) return false
  return Math.abs(props.modelValue - props.defaultValue) > 0.001
})
</script>

<template>
  <div class="flex flex-col gap-1.5 w-full group/slider select-none">
    <!-- 文字标识层：高度固定以防抖动 -->
    <div v-if="label" class="flex justify-between items-center px-1 h-5">
      <div class="flex items-center gap-2">
        <div
          v-if="icon"
          class="bg-primary/5 p-1 rounded-full flex items-center justify-center overflow-visible"
        >
          <component :is="icon" :size="13" :stroke-width="2.5" class="text-primary" />
        </div>
        <span
          class="text-[10px] font-black text-muted-foreground uppercase tracking-widest leading-none"
          >{{ label }}</span
        >
      </div>
      <div class="flex items-center">
        <!-- 数值显示/编辑区 -->
        <div class="relative min-w-[40px] flex justify-end">
          <input
            v-if="isEditing"
            ref="inputRef"
            type="text"
            v-model="tempValue"
            class="w-12 h-5 px-1 bg-primary/10 border border-primary/30 rounded text-[11px] font-mono font-black text-primary text-right outline-none focus:ring-1 focus:ring-primary/50"
            @blur="commitEdit"
            @keydown.enter="commitEdit"
            @keydown.esc="cancelEdit"
          />
          <span
            v-else
            @click="startEdit"
            class="text-[11px] font-mono font-black text-primary leading-none cursor-text hover:bg-primary/5 px-1 rounded transition-colors"
            title="点击手动输入"
          >
            {{ modelValue }}{{ unit }}
          </span>
        </div>

        <!-- 重置按钮占位符 -->
        <div class="w-5 h-5 flex items-center justify-end ml-1">
          <transition
            enter-active-class="transition duration-300 ease-out"
            enter-from-class="opacity-0 scale-50 translate-x-2"
            enter-to-class="opacity-100 scale-100 translate-x-0"
            leave-active-class="transition duration-200 ease-in"
            leave-from-class="opacity-100 scale-100 translate-x-0"
            leave-to-class="opacity-0 scale-50 translate-x-2"
          >
            <button
              v-if="isDirty"
              @click="handleReset"
              class="p-1 hover:bg-primary/10 rounded-md transition-colors text-primary/60 hover:text-primary"
              title="重置为默认值"
            >
              <RotateCcw :size="12" />
            </button>
          </transition>
        </div>
      </div>
    </div>

    <div class="relative h-11 flex items-center px-1">
      <!-- 轨道 -->
      <div
        class="absolute left-1 right-1 h-1.5 bg-muted/40 rounded-full border border-border/5 overflow-hidden pointer-events-none"
      >
        <div
          class="h-full bg-primary transition-[width] duration-100 ease-out shadow-[0_0_15px_hsl(var(--primary)/0.4)]"
          :style="{ width: progressPercent + '%' }"
        ></div>
      </div>

      <!-- 原生滑块 -->
      <input
        type="range"
        :value="modelValue"
        @input="handleInput"
        :min="min"
        :max="max"
        :step="step"
        :aria-label="ariaLabel || label"
        :aria-valuemin="min"
        :aria-valuemax="max"
        :aria-valuenow="modelValue"
        class="absolute inset-0 w-full h-full bg-transparent appearance-none cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 focus-visible:ring-offset-background rounded-full z-20"
      />
    </div>

    <!-- 辅助说明层 -->
    <div
      v-if="description"
      class="px-1 -mt-2 mb-1 animate-in fade-in slide-in-from-top-1 duration-500"
    >
      <p class="text-[10px] leading-relaxed text-muted-foreground/60 font-medium italic">
        {{ description }}
      </p>
    </div>
  </div>
</template>

<style scoped>
/* Webkit 适配 (Chrome, Safari, Edge) */
input[type='range']::-webkit-slider-thumb {
  appearance: none;
  width: 16px;
  height: 16px;
  background: hsl(var(--primary-foreground));
  border: 2.5px solid hsl(var(--primary));
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.25, 1, 0.5, 1);
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.12);
}

input[type='range']::-webkit-slider-thumb:hover {
  transform: scale(1.1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

input[type='range']:active::-webkit-slider-thumb {
  transform: scale(1.25);
  background: hsl(var(--primary));
  border-color: hsl(var(--primary-foreground));
}

/* Firefox 适配 */
input[type='range']::-moz-range-thumb {
  width: 16px;
  height: 16px;
  background: hsl(var(--primary-foreground));
  border: 2.5px solid hsl(var(--primary));
  border-radius: 50%;
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.25, 1, 0.5, 1);
  box-shadow: 0 3px 8px rgba(0, 0, 0, 0.12);
}

input[type='range']::-moz-range-thumb:hover {
  transform: scale(1.1);
}

input[type='range']:active::-moz-range-thumb {
  transform: scale(1.25);
  background: hsl(var(--primary));
  border-color: hsl(var(--primary-foreground));
}
</style>
