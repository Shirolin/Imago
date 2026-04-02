<template>
  <img
    :width="size"
    :height="size"
    src="@/assets/Imago-logo.svg"
    alt="Imago Logo"
    class="imago-logo shrink-0"
  />
</template>

<script setup lang="ts">
defineProps({
  size: {
    type: [Number, String],
    default: 40
  }
})
</script>

<style scoped>
.imago-logo {
  filter: drop-shadow(0 4px 12px rgba(12, 201, 160, 0.3));
  transition:
    transform 0.35s cubic-bezier(0.34, 1.56, 0.64, 1),
    filter 0.35s ease;
}
.imago-logo:hover {
  transform: scale(1.1) rotate(-4deg);
  filter: drop-shadow(0 8px 20px rgba(12, 201, 160, 0.45));
}
</style>
