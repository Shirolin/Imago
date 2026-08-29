<script setup lang="ts">
import { ref, computed } from 'vue'
import type { Component } from 'vue'
import { useI18n } from 'vue-i18n'
import { RotateCcw } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    modelValue: number
    min?: number
    max?: number
    step?: number
    label?: string
    icon?: Component
    unit?: string
    defaultValue?: number
    /** 推荐值（语义）：finishEdit 时若 |num - snapValue| <= step 则吸附到该值 */
    snapValue?: number
    description?: string
    ariaLabel?: string
  }>(),
  {
    min: 0,
    max: 100,
    step: 1,
    unit: '',
    ariaLabel: ''
  }
)

const emit = defineEmits(['update:modelValue', 'change'])
const { t } = useI18n()

// --- 点击即编辑逻辑 ---
const isEditing = ref(false)
const editValue = ref('')
const inputRef = ref<HTMLInputElement | null>(null)

// P2-10: 按 step 的小数位数格式化数值，避免 0.30000000000000004 这类浮点脏值
// 出现在展示按钮或编辑框里（step=0.01 → 2 位小数，step=1 → 0 位小数）。
const stepDecimals = computed(() => {
  const s = String(props.step)
  const dot = s.indexOf('.')
  return dot === -1 ? 0 : s.length - dot - 1
})

const formatValue = (val: number) => {
  if (!Number.isFinite(val)) return String(val)
  return val.toFixed(stepDecimals.value)
}

const startEdit = () => {
  editValue.value = formatValue(props.modelValue)
  isEditing.value = true
  setTimeout(() => inputRef.value?.focus(), 0)
}

const finishEdit = () => {
  if (!isEditing.value) return
  isEditing.value = false

  // 校验 1：如果不是有效数字，回滚
  let num = parseFloat(editValue.value)
  if (isNaN(num)) {
    return
  }

  // 校验 2：钳制范围 [min, max] 并处理步长
  num = Math.max(props.min, Math.min(props.max, num))
  if (props.step) {
    const inv = 1 / props.step
    num = Math.round(num * inv) / inv
  }

  // P2-9: 吸附到推荐值。与推荐值相差不超过一个 step 时视为用户想选推荐值，
  // 避免手动输入 0.74 后得到 0.74 而非推荐的 0.75 之类的“差一步”体验。
  if (props.snapValue !== undefined && Math.abs(num - props.snapValue) <= props.step) {
    num = props.snapValue
  }

  emit('update:modelValue', num)
  emit('change', num)
}

const handleInput = (e: Event) => {
  const val = parseFloat((e.target as HTMLInputElement).value)
  emit('update:modelValue', val)
}

const handleChange = (e: Event) => {
  const val = parseFloat((e.target as HTMLInputElement).value)
  emit('change', val)
}

const resetToDefault = () => {
  if (props.defaultValue !== undefined) {
    emit('update:modelValue', props.defaultValue)
    emit('change', props.defaultValue)
  }
}

// 辅助：判断是否偏离默认值（处理浮点数精度）
const isModified = computed(() => {
  if (props.defaultValue === undefined) return false
  return Math.abs(props.modelValue - props.defaultValue) > 0.001
})
</script>

<template>
  <div class="space-y-3 group/slider">
    <!-- 文字标识层：高度固定以防抖动 -->
    <div class="flex items-center justify-between min-h-[20px]">
      <div class="flex items-center gap-2">
        <component
          :is="icon"
          v-if="icon"
          :size="14"
          class="text-muted-foreground/60 group-hover/slider:text-[var(--ink)] transition-colors"
        />
        <span class="text-[11px] font-medium text-muted-foreground">{{ label }}</span>
      </div>

      <div class="flex items-center gap-2">
        <div class="relative flex items-center">
          <input
            v-if="isEditing"
            ref="inputRef"
            v-model="editValue"
            type="text"
            class="w-12 h-5 bg-[var(--paper)] border border-[var(--hairline)] rounded-[var(--radius-ctrl)] text-[10px] tabular-nums font-medium text-center text-[var(--ink)] focus:outline-none focus:border-[var(--accent)]"
            @blur="finishEdit"
            @keydown.enter="finishEdit"
          />
          <button
            v-else
            @click="startEdit"
            class="px-1.5 h-5 min-w-[32px] rounded-[var(--radius-ctrl)] hover:bg-[var(--well)] text-[11px] tabular-nums font-medium text-[var(--ink)] transition-colors text-right"
            :title="t('common.ui.clickToEdit')"
          >
            {{ formatValue(modelValue) }}{{ unit }}
          </button>
        </div>

        <!-- 重置按钮占位符 -->
        <div class="w-5 flex justify-end">
          <transition
            enter-active-class="transition duration-200"
            enter-from-class="opacity-0 scale-50 rotate-90"
            enter-to-class="opacity-100 scale-100 rotate-0"
            leave-active-class="transition duration-200"
            leave-from-class="opacity-100 scale-100 rotate-0"
            leave-to-class="opacity-0 scale-50 rotate-90"
          >
            <button
              v-if="isModified"
              @click="resetToDefault"
              class="text-muted-foreground/30 hover:text-primary transition-colors"
              :title="t('common.ui.resetToDefault')"
            >
              <RotateCcw :size="12" />
            </button>
          </transition>
        </div>
      </div>
    </div>

    <div class="relative flex items-center h-6">
      <!-- 轨道 -->
      <div class="absolute w-full h-1.5 bg-[var(--hairline)] rounded-full overflow-hidden">
        <div
          class="h-full bg-[var(--accent)] transition-colors"
          :style="{ width: ((modelValue - min) / (max - min)) * 100 + '%' }"
        ></div>
      </div>

      <!-- 原生滑块 -->
      <input
        type="range"
        :value="modelValue"
        :min="min"
        :max="max"
        :step="step"
        :aria-label="ariaLabel || label"
        class="absolute w-full h-6 bg-transparent appearance-none cursor-pointer z-10 outline-none"
        @input="handleInput"
        @change="handleChange"
      />
    </div>

    <!-- 辅助说明层 -->
    <p v-if="description" class="text-[10px] text-muted-foreground/60 leading-relaxed">
      {{ description }}
    </p>
  </div>
</template>

<style scoped>
/* Webkit 适配 (Chrome, Safari, Edge) */
input[type='range']::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 14px;
  height: 14px;
  background: var(--board);
  border: 2px solid var(--ink);
  border-radius: 50%;
  box-shadow: none;
  cursor: grab;
}

input[type='range']:active::-webkit-slider-thumb {
  cursor: grabbing;
}

input[type='range']::-moz-range-thumb {
  width: 14px;
  height: 14px;
  background: var(--board);
  border: 2px solid var(--ink);
  border-radius: 50%;
  box-shadow: none;
  cursor: grab;
}

input[type='range']:active::-moz-range-thumb {
  cursor: grabbing;
}
</style>
