<script setup lang="ts">
import { computed } from 'vue'
import type { Component } from 'vue'
import { Plus, Minus } from 'lucide-vue-next'

interface Props {
  modelValue: string | number
  type?: 'text' | 'number'
  placeholder?: string
  icon?: Component
  suffix?: string
  step?: number
  min?: number
  max?: number
}

const props = withDefaults(defineProps<Props>(), {
  type: 'text',
  step: 1
})

const emit = defineEmits(['update:modelValue'])

const value = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const handleIncrement = () => {
  const current = Number(props.modelValue) || 0
  const next = current + props.step
  if (props.max !== undefined && next > props.max) return
  emit('update:modelValue', next)
}

const handleDecrement = () => {
  const current = Number(props.modelValue) || 0
  const next = current - props.step
  if (props.min !== undefined && next < props.min) return
  emit('update:modelValue', next)
}
</script>

<template>
  <div class="relative group/input flex items-center">
    <div
      v-if="icon"
      class="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 group-focus-within/input:text-primary transition-colors pointer-events-none z-10"
    >
      <component :is="icon" :size="14" />
    </div>
    
    <div class="relative flex-1">
      <input
        v-model="value"
        :type="type"
        :placeholder="placeholder"
        class="w-full h-10 bg-muted/20 border border-border/40 rounded-lg text-xs font-bold focus:border-primary focus:bg-background/80 outline-none transition-all tabular-nums placeholder:text-muted-foreground/20"
        :class="[
          icon ? 'pl-9' : 'pl-3',
          type === 'number' ? 'pr-14' : suffix ? 'pr-8' : 'pr-3'
        ]"
      />

      <!-- 数字调节按钮 (Stepper) - 更加紧凑与透亮 -->
      <div 
        v-if="type === 'number'"
        class="absolute right-0.5 top-1/2 -translate-y-1/2 flex items-center h-8 opacity-0 group-hover/input:opacity-100 group-focus-within/input:opacity-100 transition-opacity p-0.5"
      >
        <button
          @click.stop="handleDecrement"
          type="button"
          class="w-5 h-7 flex items-center justify-center rounded-l-md hover:bg-primary/10 text-muted-foreground/60 hover:text-primary active:scale-90 transition-all"
        >
          <Minus :size="10" />
        </button>
        <div class="w-[1px] h-2 bg-border/20"></div>
        <button
          @click.stop="handleIncrement"
          type="button"
          class="w-5 h-7 flex items-center justify-center rounded-r-md hover:bg-primary/10 text-muted-foreground/60 hover:text-primary active:scale-90 transition-all"
        >
          <Plus :size="10" />
        </button>
      </div>

      <div
        v-if="suffix && type !== 'number'"
        class="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-black text-muted-foreground/30 pointer-events-none uppercase group-focus-within/input:text-primary/50 transition-colors"
      >
        {{ suffix }}
      </div>
      
      <!-- 数字输入框的后缀逻辑 - 紧贴 Stepper 提升空间利用率 -->
      <div
        v-if="suffix && type === 'number'"
        class="absolute right-11 top-1/2 -translate-y-1/2 text-[8px] font-black text-muted-foreground/20 pointer-events-none uppercase transition-colors"
      >
        {{ suffix }}
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 隐藏 Chrome, Safari, Edge, Opera 的数字箭头 */
input::-webkit-outer-spin-button,
input::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}

/* 隐藏 Firefox 的数字箭头 */
input[type='number'] {
  -moz-appearance: textfield;
}
</style>
