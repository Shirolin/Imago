<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import ImageUpload from '../components/common/ImageUpload.vue'
import { useImageStore } from '../stores/imageStore'
import { useRouter } from 'vue-router'

const { t } = useI18n()
const store = useImageStore()
const router = useRouter()

const onUpload = (files: File[]) => {
  store.addImages(files)
  router.push('/compress')
}
</script>

<template>
  <div class="h-full w-full flex flex-col min-h-0 bg-[var(--room)] p-3">
    <div class="imago-well flex-1 min-h-0 flex items-center justify-center">
      <ImageUpload @upload="onUpload" />
    </div>
    <p class="sr-only">{{ t('common.image.upload.title') }}</p>
  </div>
</template>
