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

const pickerValue = computed({
  get: () => (isTransparent.value ? '#ffffff' : props.modelValue),
  set: (val) => emit('update:modelValue', val)
})

const setFillColor = (color: string) => {
  emit('update:modelValue', color)
}

const isCustomColor = computed(
  () =>
    !isTransparent.value &&
    props.modelValue.toLowerCase() !== '#ffffff' &&
    props.modelValue.toLowerCase() !== '#000000'
)

const swatchSelected = 'border-[var(--ink)] ring-1 ring-[var(--ink)]/20'
const swatchRest = 'border-[var(--hairline)]'
</script>

<template>
  <div class="space-y-3">
    <div v-if="label" class="text-[11px] font-medium text-muted-foreground ml-1">
      {{ label }}
    </div>
    <div class="flex items-center gap-2">
      <button
        v-if="showTransparent"
        @click="setFillColor('transparent')"
        class="relative w-10 h-10 rounded-[var(--radius-ctrl)] border transition-colors overflow-hidden shrink-0"
        :class="isTransparent ? swatchSelected : swatchRest"
        :title="t('common.colorPicker.transparent')"
        :aria-label="t('common.colorPicker.transparent')"
      >
        <div class="absolute inset-0 app-transparency-grid-sm"></div>
      </button>

      <button
        @click="setFillColor('#ffffff')"
        class="w-10 h-10 rounded-[var(--radius-ctrl)] border bg-white transition-colors shrink-0"
        :class="
          !isTransparent && modelValue.toLowerCase() === '#ffffff' ? swatchSelected : swatchRest
        "
        :title="t('common.colorPicker.white')"
        :aria-label="t('common.colorPicker.white')"
      ></button>

      <button
        @click="setFillColor('#000000')"
        class="w-10 h-10 rounded-[var(--radius-ctrl)] border bg-black transition-colors shrink-0"
        :class="
          !isTransparent && modelValue.toLowerCase() === '#000000' ? swatchSelected : swatchRest
        "
        :title="t('common.colorPicker.black')"
        :aria-label="t('common.colorPicker.black')"
      ></button>

      <div class="relative w-10 h-10 shrink-0">
        <input
          type="color"
          v-model="pickerValue"
          :aria-label="label || t('common.colorPicker.picker')"
          class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        />
        <div
          class="w-full h-full rounded-[var(--radius-ctrl)] border flex items-center justify-center transition-colors overflow-hidden bg-[var(--well)]"
          :class="isCustomColor ? swatchSelected : swatchRest"
          :style="isCustomColor ? { backgroundColor: modelValue } : undefined"
        >
          <Pipette v-if="!isCustomColor" :size="14" class="text-[var(--muted)]" />
        </div>
      </div>
    </div>
  </div>
</template>
