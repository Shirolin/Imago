<script setup lang="ts">
import { ArrowRight } from 'lucide-vue-next'

interface Props {
  beforeLabel: string
  beforeValue: string | number
  afterLabel: string
  afterValue: string | number
  status?: 'idle' | 'processing' | 'done' | 'error' | 'pending'
  compact?: boolean
}

withDefaults(defineProps<Props>(), {
  status: 'idle',
  compact: false
})
</script>

<template>
  <div
    class="flex items-center bg-muted/50 dark:bg-muted border border-[var(--hairline)] transition-colors group-hover:border-primary/20 overflow-hidden"
    :class="[
      compact
        ? 'gap-1.5 p-1.5 rounded-[var(--radius-ctrl)]'
        : 'gap-3 p-3 rounded-[var(--radius-ctrl)]'
    ]"
  >
    <div class="flex-1 flex flex-col gap-0.5 min-w-0">
      <span
        class="font-medium text-muted-foreground mt-0.5"
        :class="compact ? 'text-[0.5rem]' : 'text-[0.6rem]'"
        >{{ beforeLabel }}</span
      >
      <span
        class="font-bold text-foreground transition-all truncate tabular-nums"
        :class="compact ? 'text-[0.65rem]' : 'text-[0.75rem]'"
        >{{ beforeValue }}</span
      >
    </div>
    <div class="text-muted-foreground flex shrink-0">
      <ArrowRight :size="compact ? 10 : 12" />
    </div>
    <div class="flex-1 flex flex-col gap-0.5 min-w-0">
      <span
        class="font-medium text-muted-foreground mt-0.5"
        :class="compact ? 'text-[0.5rem]' : 'text-[0.6rem]'"
        >{{ afterLabel }}</span
      >
      <span
        class="font-bold transition-all truncate tabular-nums"
        :class="[
          status === 'done' ? 'text-primary' : 'text-foreground',
          compact ? 'text-[0.65rem]' : 'text-[0.75rem]'
        ]"
      >
        <slot name="after">
          {{ status === 'done' ? afterValue : '--' }}
        </slot>
      </span>
    </div>
  </div>
</template>
