<script setup lang="ts" generic="T">
import { ref, onMounted, onUnmounted, computed } from 'vue'
import { ChevronDown, Check } from 'lucide-vue-next'

interface Option<V> {
  label: string
  value: V
}

interface Props<V> {
  modelValue: V
  options: Option<V>[]
  placeholder?: string
}

const props = defineProps<Props<T>>()
const emit = defineEmits<{
  (e: 'update:modelValue', value: T): void
}>()

const isOpen = ref(false)
const containerRef = ref<HTMLElement | null>(null)

const toggle = () => {
  isOpen.value = !isOpen.value
}

const select = (value: T) => {
  emit('update:modelValue', value)
  isOpen.value = false
}

const selectedLabel = computed(() => {
  const option = props.options.find((opt) => opt.value === props.modelValue)
  return option ? option.label : props.placeholder || '请选择'
})

const handleClickOutside = (event: MouseEvent) => {
  if (containerRef.value && !containerRef.value.contains(event.target as Node)) {
    isOpen.value = false
  }
}

onMounted(() => {
  window.addEventListener('mousedown', handleClickOutside)
})

onUnmounted(() => {
  window.removeEventListener('mousedown', handleClickOutside)
})
</script>

<template>
  <div class="relative w-full" ref="containerRef">
    <!-- 触发器 -->
    <button
      type="button"
      @click="toggle"
      class="w-full flex items-center justify-between p-3 bg-muted/40 border border-border/50 rounded-xl text-sm font-bold hover:bg-muted/60 transition-all focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none group"
      :class="{ 'border-primary ring-2 ring-primary/10': isOpen }"
    >
      <span class="truncate">{{ selectedLabel }}</span>
      <ChevronDown
        class="text-muted-foreground transition-transform duration-300 shrink-0"
        :class="{ 'rotate-180 text-primary': isOpen }"
        :size="18"
      />
    </button>

    <!-- 下拉列表 -->
    <transition
      enter-active-class="transition ease-out duration-200"
      enter-from-class="opacity-0 translate-y-1"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition ease-in duration-150"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 translate-y-1"
    >
      <div
        v-if="isOpen"
        class="absolute z-[100] mt-2 w-full bg-card border border-border rounded-xl shadow-2xl overflow-hidden backdrop-blur-xl"
      >
        <div class="max-h-60 overflow-y-auto custom-scrollbar p-1.5 flex flex-col gap-0.5">
          <button
            v-for="option in options"
            :key="String(option.value)"
            type="button"
            @click="select(option.value)"
            class="flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-bold transition-all text-left"
            :class="
              modelValue === option.value
                ? 'bg-primary text-primary-foreground'
                : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
            "
          >
            <span class="truncate">{{ option.label }}</span>
            <Check v-if="modelValue === option.value" :size="16" />
          </button>
        </div>
      </div>
    </transition>
  </div>
</template>

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 4px;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background: hsl(var(--border));
  border-radius: 10px;
}
</style>
