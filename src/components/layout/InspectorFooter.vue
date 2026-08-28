<script setup lang="ts">
/**
 * InspectorFooter — pinned action row. Opaque chrome, no glass.
 */
interface Props {
  showBorder?: boolean
  glass?: boolean
  padding?: string
}

withDefaults(defineProps<Props>(), {
  showBorder: true,
  glass: false,
  padding: 'p-3'
})
</script>

<template>
  <div class="relative shrink-0 z-30">
    <footer
      class="relative bg-[var(--chrome)]"
      :class="[
        showBorder ? 'border-t border-[color-mix(in_srgb,var(--ink)_8%,transparent)]' : '',
        padding
      ]"
    >
      <div class="flex items-center gap-2 w-full">
        <slot></slot>
      </div>
    </footer>
  </div>
</template>
