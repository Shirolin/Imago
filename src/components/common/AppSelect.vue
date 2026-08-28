<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronDown, Check } from 'lucide-vue-next'

const props = defineProps<{
  modelValue: string
  options: { label: string; value: string; description?: string }[]
  placeholder?: string
  label?: string
}>()

const emit = defineEmits(['update:modelValue', 'change'])
const { t } = useI18n()

const isOpen = ref(false)
const selectRef = ref<HTMLElement | null>(null)

const toggleDropdown = () => {
  isOpen.value = !isOpen.value
}

const selectOption = (value: string) => {
  emit('update:modelValue', value)
  emit('change', value)
  isOpen.value = false
}

const handleClickOutside = (event: MouseEvent) => {
  if (selectRef.value && !selectRef.value.contains(event.target as Node)) {
    isOpen.value = false
  }
}

const selectedLabel = computed(() => {
  const option = props.options.find((opt) => opt.value === props.modelValue)
  return option ? option.label : props.placeholder || t('common.ui.select')
})

import { computed } from 'vue'

onMounted(() => {
  document.addEventListener('click', handleClickOutside)
})

onUnmounted(() => {
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <div class="space-y-1.5" ref="selectRef">
    <label v-if="label" class="text-[11px] font-medium text-muted-foreground ml-1">{{
      label
    }}</label>
    <div class="relative">
      <button
        type="button"
        @click="toggleDropdown"
        class="w-full h-10 px-3 flex items-center justify-between bg-background border border-[var(--hairline)] rounded-xl text-xs font-medium hover:border-primary/30 transition-all active:scale-[0.99] outline-none focus-visible:ring-2 focus-visible:ring-primary/20"
        :class="{ 'border-primary/40 ring-2 ring-primary/10': isOpen }"
      >
        <span class="truncate" :class="{ 'text-muted-foreground/50': !modelValue }">{{
          selectedLabel
        }}</span>
        <ChevronDown
          :size="14"
          class="text-muted-foreground/40 transition-transform duration-300"
          :class="{ 'rotate-180': isOpen }"
        />
      </button>

      <transition
        enter-active-class="transition duration-200 ease-out"
        enter-from-class="opacity-0 translate-y-1 scale-95"
        enter-to-class="opacity-100 translate-y-0 scale-100"
        leave-active-class="transition duration-150 ease-in"
        leave-from-class="opacity-100 translate-y-0 scale-100"
        leave-to-class="opacity-0 translate-y-1 scale-95"
      >
        <div
          v-if="isOpen"
          class="absolute z-[100] mt-2 w-full bg-card border border-[var(--hairline)] rounded-xl overflow-hidden py-1 animate-in fade-in zoom-in-95 duration-200"
        >
          <div class="max-h-60 overflow-y-auto custom-scrollbar">
            <button
              v-for="option in options"
              :key="option.value"
              type="button"
              @click="selectOption(option.value)"
              class="w-full px-3 py-2.5 text-left text-xs transition-colors flex flex-col gap-0.5 hover:bg-primary/5 group"
              :class="
                modelValue === option.value
                  ? 'bg-primary/10 text-primary'
                  : 'text-foreground/70 hover:text-primary'
              "
            >
              <div class="flex items-center justify-between">
                <span class="font-medium">{{ option.label }}</span>
                <Check v-if="modelValue === option.value" :size="12" />
              </div>
              <span
                v-if="option.description"
                class="text-[10px] opacity-50 group-hover:opacity-70 transition-opacity"
                >{{ option.description }}</span
              >
            </button>
          </div>
        </div>
      </transition>
    </div>
  </div>
</template>
