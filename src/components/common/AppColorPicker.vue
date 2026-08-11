<script setup lang="ts">
import { computed } from 'vue'
import { Pipette } from 'lucide-vue-next'
import { useI18n } from 'vue-i18n'

interface Props {
  modelValue: string // 格式如 '#ffffff' 或 'transparent'
  label?: string
  showTransparent?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  showTransparent: true
})

const emit = defineEmits(['update:modelValue'])
const { t } = useI18n()

const isTransparent = computed(() => props.modelValue === 'transparent')

// 如果是透明，则拾取器的默认值为白色
const pickerValue = computed({
  get: () => (isTransparent.value ? '#ffffff' : props.modelValue),
  set: (val) => emit('update:modelValue', val)
})

const setFillColor = (color: string) => {
  emit('update:modelValue', color)
}

// 亮度检测工具 (用于 Pipette 图标反色)
const getBrightness = (hex: string) => {
  if (hex === 'transparent') return 255
  const rgb = hex
    .replace('#', '')
    .match(/.{2}/g)
    ?.map((x) => parseInt(x, 16)) || [255, 255, 255]
  return (rgb[0]! * 299 + rgb[1]! * 587 + rgb[2]! * 114) / 1000
}

const isColorLight = computed(() => getBrightness(props.modelValue) > 180)
</script>

<template>
  <div class="space-y-3">
    <div
      v-if="label"
      class="text-[10px] font-black text-muted-foreground uppercase ml-1 tracking-widest"
    >
      {{ label }}
    </div>
    <div class="flex items-center gap-2">
      <!-- 透明选项 -->
      <button
        v-if="showTransparent"
        @click="setFillColor('transparent')"
        class="relative w-10 h-10 rounded-xl border-2 transition-all overflow-hidden hover:scale-110 active:scale-95 group shrink-0"
        :class="
          isTransparent
            ? 'border-primary ring-2 ring-primary/10'
            : 'border-border grayscale opacity-60'
        "
        :title="t('common.colorPicker.transparent')"
        :aria-label="t('common.colorPicker.transparent')"
      >
        <div class="absolute inset-0 app-transparency-grid-sm"></div>
      </button>

      <!-- 纯白 -->
      <button
        @click="setFillColor('#ffffff')"
        class="w-10 h-10 rounded-xl border-2 transition-all bg-white hover:scale-110 active:scale-95 shrink-0"
        :class="
          !isTransparent && modelValue.toLowerCase() === '#ffffff'
            ? 'border-primary shadow-[0_0_12px_hsla(var(--primary)/0.3)]'
            : 'border-border'
        "
        :title="t('common.colorPicker.white')"
        :aria-label="t('common.colorPicker.white')"
      ></button>

      <!-- 纯黑 -->
      <button
        @click="setFillColor('#000000')"
        class="w-10 h-10 rounded-xl border-2 transition-all bg-black hover:scale-110 active:scale-95 shrink-0"
        :class="
          !isTransparent && modelValue.toLowerCase() === '#000000'
            ? 'border-primary shadow-[0_0_12px_hsla(var(--primary)/0.3)]'
            : 'border-border'
        "
        :title="t('common.colorPicker.black')"
        :aria-label="t('common.colorPicker.black')"
      ></button>

      <!-- 颜色拾取器 -->
      <div class="relative w-10 h-10 group shrink-0">
        <input
          type="color"
          v-model="pickerValue"
          :aria-label="label || t('common.colorPicker.picker')"
          class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        />
        <div
          class="w-full h-full rounded-xl border-2 flex items-center justify-center transition-all group-hover:scale-110 active:scale-95 overflow-hidden"
          :style="{
            background:
              !isTransparent &&
              modelValue.toLowerCase() !== '#ffffff' &&
              modelValue.toLowerCase() !== '#000000'
                ? modelValue
                : 'conic-gradient(from 0deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)'
          }"
          :class="
            !isTransparent &&
            modelValue.toLowerCase() !== '#ffffff' &&
            modelValue.toLowerCase() !== '#000000'
              ? 'border-primary shadow-[0_0_15px_hsla(var(--primary)/0.4)]'
              : 'border-border opacity-80'
          "
        >
          <Pipette
            :size="14"
            class="drop-shadow-sm transition-colors duration-300"
            :class="
              !isTransparent &&
              modelValue.toLowerCase() !== '#ffffff' &&
              modelValue.toLowerCase() !== '#000000' &&
              isColorLight
                ? 'text-black/70'
                : 'text-white'
            "
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 移除内联 hardcoded 网格，使用 style.css 全局定义 */
</style>
