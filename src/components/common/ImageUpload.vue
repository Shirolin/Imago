<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'

const { t } = useI18n()
const emit = defineEmits(['upload'])
const fileInput = ref<HTMLInputElement | null>(null)

const handleFiles = (files: FileList | File[]) => {
  const MAX_SIZE = 50 * 1024 * 1024 // 50MB
  const validTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/avif',
    'image/gif',
    'image/svg+xml'
  ]

  const validFiles = Array.from(files).filter((file) => {
    if (!file.type.startsWith('image/') && !validTypes.includes(file.type)) {
      return false
    }
    if (file.size > MAX_SIZE) {
      alert(
        t('common.image.upload.errorSize', {
          name: file.name,
          size: (file.size / 1024 / 1024).toFixed(1)
        })
      )
      return false
    }
    return true
  })

  if (validFiles.length > 0) {
    emit('upload', validFiles)
  }
}

const onFileSelect = (e: Event) => {
  const target = e.target as HTMLInputElement
  if (target.files) {
    handleFiles(target.files)
  }
  target.value = ''
}

const triggerSelect = () => {
  fileInput.value?.click()
}
</script>

<template>
  <div
    class="relative w-full h-full min-h-[240px] flex items-center justify-center cursor-pointer outline-none rounded-[var(--radius)] text-center px-6 focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--room)]"
    role="button"
    tabindex="0"
    @click="triggerSelect"
    @keydown.enter.space.prevent="triggerSelect"
  >
    <input
      type="file"
      ref="fileInput"
      multiple
      accept="image/*"
      class="hidden"
      @change="onFileSelect"
    />

    <div class="flex flex-col items-center gap-2">
      <p class="text-[var(--ink-well)] text-base font-medium leading-snug">
        {{ $t('common.image.upload.title') }}
      </p>
      <p class="text-[var(--muted)] text-sm leading-snug">
        {{ $t('common.image.upload.subtitle') }}
      </p>
    </div>
  </div>
</template>
