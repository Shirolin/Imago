<script setup lang="ts">
import { Check } from 'lucide-vue-next'

interface Props {
  modelValue: boolean
  label?: string
}

defineProps<Props>()
const emit = defineEmits(['update:modelValue'])
</script>

<template>
  <label class="flex items-center gap-3 cursor-pointer group select-none">
    <div
      class="relative w-5 h-5 rounded-md border-2 transition-all duration-200 flex items-center justify-center shadow-sm"
      :class="[
        modelValue
          ? 'bg-primary border-primary scale-105 shadow-primary/20'
          : 'bg-muted/30 border-border/80 group-hover:border-primary/50'
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
        <Check :size="12" class="text-white stroke-[4px]" />
      </div>
    </div>
    <span
      v-if="label"
      class="text-xs font-bold text-muted-foreground group-hover:text-foreground transition-colors"
    >
      {{ label }}
    </span>
  </label>
</template>
