<script setup lang="ts">
import { computed } from 'vue'
import { Plus, Minus } from 'lucide-vue-next'

interface Props {
  id?: string
  modelValue: string | number | undefined
  type?: 'text' | 'number'
  placeholder?: string
  suffix?: string
  step?: number
  min?: number
  max?: number
  ariaLabel?: string
}

const props = withDefaults(defineProps<Props>(), {
  type: 'text',
  placeholder: '',
  step: 1,
  ariaLabel: ''
})

const emit = defineEmits(['update:modelValue'])

const inputId = props.id || `input-${Math.random().toString(36).slice(2, 9)}`

const value = computed({
  get: () => props.modelValue,
  set: (val) => {
    const nextVal = props.type === 'number' ? (val === '' ? '' : Number(val)) : val
    emit('update:modelValue', nextVal)
  }
})

/**
 * 数字输入在失焦时按 min/max 钳制，避免 0/负数/超大值透传到引擎
 * （步进按钮已钳制，手动输入此前无任何限制）
 */
const handleBlur = () => {
  if (props.type !== 'number' || props.modelValue === '' || props.modelValue == null) return
  const current = Number(props.modelValue)
  let next = current
  if (props.min !== undefined && next < props.min) next = props.min
  if (props.max !== undefined && next > props.max) next = props.max
  if (Number.isNaN(next)) next = props.min ?? 0
  if (next !== current) emit('update:modelValue', next)
}

const isAtMin = computed(() => {
  if (props.type !== 'number' || props.min === undefined) return false
  return Number(props.modelValue) <= props.min
})

const isAtMax = computed(() => {
  if (props.type !== 'number' || props.max === undefined) return false
  return Number(props.modelValue) >= props.max
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
  <div class="relative group/input flex items-center w-full">
    <div class="relative flex-1 min-w-0">
      <input
        :id="inputId"
        v-model="value"
        :type="type"
        :placeholder="placeholder"
        :aria-label="ariaLabel || undefined"
        :min="type === 'number' && min !== undefined ? min : undefined"
        :max="type === 'number' && max !== undefined ? max : undefined"
        :step="type === 'number' ? step : undefined"
        class="w-full h-10 bg-muted/30 dark:bg-muted/50 border border-border/40 rounded-lg text-xs font-bold text-muted-foreground focus:text-foreground focus:border-primary focus:bg-background/80 outline-none transition-all tabular-nums placeholder:text-muted-foreground/40 pl-3 focus:ring-2 focus:ring-primary/20 focus:ring-offset-2 focus:ring-offset-background"
        :class="[
          type === 'number' ? 'pr-14' : suffix ? 'pr-8' : 'pr-3',
          { 'ring-2 ring-amber-500/30 border-amber-500/40': type === 'number' && isAtMax }
        ]"
        @blur="handleBlur"
      />

      <!-- 数字调节按钮 (Stepper) -->
      <div
        v-if="type === 'number'"
        class="absolute right-0.5 top-1/2 -translate-y-1/2 flex items-center h-8 transition-opacity p-0.5"
      >
        <button
          @click.stop="handleDecrement"
          type="button"
          :disabled="isAtMin"
          class="w-6 h-7 flex items-center justify-center rounded-lg hover:bg-primary/10 text-muted-foreground/60 hover:text-primary active:scale-90 transition-all outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:opacity-30 disabled:cursor-not-allowed"
          :aria-label="ariaLabel || undefined"
        >
          <Minus :size="14" />
        </button>
        <div class="w-[1px] h-3 bg-border/20 mx-0.5"></div>
        <button
          @click.stop="handleIncrement"
          type="button"
          :disabled="isAtMax"
          class="w-6 h-7 flex items-center justify-center rounded-lg hover:bg-primary/10 text-muted-foreground/60 hover:text-primary active:scale-90 transition-all outline-none focus-visible:ring-1 focus-visible:ring-primary disabled:opacity-30 disabled:cursor-not-allowed"
          :aria-label="ariaLabel || undefined"
        >
          <Plus :size="14" />
        </button>
      </div>

      <!-- 文本输入的后缀 -->
      <div
        v-if="suffix && type !== 'number'"
        class="absolute right-3 top-1/2 -translate-y-1/2 text-[0.7rem] font-semibold text-muted-foreground/40 pointer-events-none group-focus-within/input:text-primary transition-colors"
      >
        {{ suffix }}
      </div>
    </div>

    <!-- 数字输入的后缀：置于输入框外部，避免与 4 位以上数字文本重叠 -->
    <div
      v-if="suffix && type === 'number'"
      class="shrink-0 ml-1.5 text-[0.7rem] font-semibold text-muted-foreground/40 pointer-events-none transition-colors group-focus-within/input:text-primary tabular-nums"
    >
      {{ suffix }}
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
  appearance: textfield;
}
</style>
