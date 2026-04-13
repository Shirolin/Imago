<script setup lang="ts">
import { ref, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { RotateCcw } from 'lucide-vue-next'

const props = withDefaults(
  defineProps<{
    modelValue: number
    min?: number
    max?: number
    step?: number
    label?: string
    icon?: any
    unit?: string
    defaultValue?: number
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

const startEdit = () => {
  editValue.value = props.modelValue.toString()
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
          class="text-muted-foreground/60 group-hover/slider:text-primary transition-colors"
        />
        <span class="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">{{
          label
        }}</span>
      </div>

      <div class="flex items-center gap-2">
        <!-- 数值显示/编辑区 -->
        <div class="relative flex items-center">
          <input
            v-if="isEditing"
            ref="inputRef"
            v-model="editValue"
            type="text"
            class="w-12 h-5 bg-background border border-primary/50 rounded text-[10px] font-mono font-bold text-center text-primary focus:outline-none shadow-inner"
            @blur="finishEdit"
            @keydown.enter="finishEdit"
          />
          <button
            v-else
            @click="startEdit"
            class="px-1.5 h-5 min-w-[32px] rounded hover:bg-primary/10 text-[11px] font-mono font-bold text-primary transition-colors text-right"
            :title="t('common.ui.clickToEdit')"
          >
            {{ modelValue }}{{ unit }}
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
      <div class="absolute w-full h-1.5 bg-muted/40 rounded-full overflow-hidden">
        <div
          class="h-full bg-primary/20 transition-all duration-300"
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
    <p v-if="description" class="text-[10px] text-muted-foreground/50 leading-relaxed italic">
      {{ description }}
    </p>
  </div>
</template>

<style scoped>
/* Webkit 适配 (Chrome, Safari, Edge) */
input[type='range']::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  background: white;
  border: 2px solid theme('colors.primary.DEFAULT');
  border-radius: 50%;
  box-shadow:
    0 2px 4px rgba(0, 0, 0, 0.1),
    0 0 0 0 rgba(var(--primary-rgb), 0.2);
  transition: all 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
  cursor: grab;
}

input[type='range']:active::-webkit-slider-thumb {
  transform: scale(1.2);
  box-shadow:
    0 4px 8px rgba(0, 0, 0, 0.15),
    0 0 0 6px rgba(var(--primary-rgb), 0.15);
  cursor: grabbing;
}

/* Firefox 适配 */
input[type='range']::-moz-range-thumb {
  width: 16px;
  height: 16px;
  background: white;
  border: 2px solid theme('colors.primary.DEFAULT');
  border-radius: 50%;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
  transition: all 0.2s;
  cursor: grab;
}

input[type='range']:active::-moz-range-thumb {
  transform: scale(1.2);
}
</style>
