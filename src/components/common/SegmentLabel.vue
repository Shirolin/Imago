<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, ref, watch } from 'vue'

const props = defineProps<{
  label: string
}>()

const el = ref<HTMLElement | null>(null)
const title = ref<string | undefined>()

function updateTitle() {
  const node = el.value
  title.value = node && node.scrollWidth > node.clientWidth + 1 ? props.label : undefined
}

let resizeObserver: ResizeObserver | undefined

onMounted(() => {
  nextTick(() => {
    updateTitle()
    resizeObserver = new ResizeObserver(() => updateTitle())
    if (el.value) resizeObserver.observe(el.value)
  })
})

onUnmounted(() => {
  resizeObserver?.disconnect()
})

watch(
  () => props.label,
  () => nextTick(updateTitle)
)
</script>

<template>
  <span class="segment-label text-[11px] font-medium">
    <span ref="el" class="segment-label-inner" :title="title">{{ label }}</span>
  </span>
</template>
