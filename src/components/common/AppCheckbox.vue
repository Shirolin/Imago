<script setup lang="ts">
import { Check } from 'lucide-vue-next'

interface Props {
  modelValue: boolean
  label?: string
  description?: string
}

defineProps<Props>()
const emit = defineEmits(['update:modelValue'])
</script>

<template>
  <label class="flex items-start gap-3 cursor-pointer group select-none">
    <div
      class="relative w-5 h-5 rounded-md border-2 transition-all duration-200 flex items-center justify-center shadow-sm shrink-0"
      :class="[
        modelValue
          ? 'bg-primary border-primary scale-105 shadow-[0_2px_10px_hsla(var(--primary),var(--button-shadow-opacity))]'
          : 'bg-muted/30 border-border group-hover:border-primary/40 group-hover:bg-primary/5'
      ]"
    >
      <input
        type="checkbox"
        :checked="modelValue"
        @change="emit('update:modelValue', ($event.target as HTMLInputElement).checked)"
        class="absolute opacity-0 w-full h-full cursor-pointer z-10"
      />
      <div
        class="transition-all duration-300 transform"
        :class="modelValue ? 'scale-100 opacity-100' : 'scale-50 opacity-0'"
      >
        <Check :size="12" class="text-primary-foreground stroke-[4px]" />
      </div>
    </div>
    <div class="flex flex-col gap-1">
      <span
        v-if="label"
        class="text-xs font-bold text-muted-foreground group-hover:text-primary transition-colors leading-5"
      >
        {{ label }}
      </span>
      <span
        v-if="description"
        class="text-[11px] font-medium text-muted-foreground/60 leading-relaxed"
      >
        {{ description }}
      </span>
    </div>
  </label>
</template>
