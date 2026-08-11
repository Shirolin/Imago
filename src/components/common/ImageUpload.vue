<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Upload, Image as ImageIcon, FileImage } from 'lucide-vue-next'
import AppButton from './AppButton.vue'

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
  // 重置 value，使重复选择同一文件仍能触发 change 事件
  target.value = ''
}

const triggerSelect = () => {
  fileInput.value?.click()
}
</script>

<template>
  <div
    class="relative w-full min-h-[320px] md:min-h-[480px] bg-card border-2 border-dashed border-border rounded-3xl md:rounded-[40px] flex items-center justify-center cursor-pointer overflow-hidden p-6 md:p-8 outline-none transition-all duration-500 focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/20 hover:border-primary hover:bg-muted md:hover:-translate-y-1 shadow-elevated hover:shadow-2xl hover:shadow-primary/5 group @container"
    @click="triggerSelect"
  >
    <input
      type="file"
      ref="fileInput"
      multiple
      accept="image/*"
      class="hidden"
      @change="onFileSelect"
    />

    <div
      class="relative z-10 flex flex-col items-center text-center w-full max-w-[min(90%,600px)] mx-auto py-4"
    >
      <!-- 插画图标区域 (Delightful Float) -->
      <div
        class="relative mb-10 md:mb-16 w-[clamp(120px,30cqw,160px)] aspect-[1.2/1] flex justify-center perspective-1000"
      >
        <div
          class="w-[60%] h-[80%] rounded-[24%] bg-card border-2 border-border text-primary flex items-center justify-center relative z-10 transition-all duration-500 group-hover:border-primary group-hover:scale-110 group-hover:-rotate-3 shadow-lg group-hover:shadow-primary/20"
        >
          <Upload class="w-1/2 h-1/2 transition-transform duration-500 group-hover:scale-110" />
        </div>
        <div
          class="absolute bottom-2 left-0 w-[35%] h-[45%] rounded-[22%] bg-muted/80 border-2 border-border text-muted-foreground/60 z-0 -rotate-12 flex items-center justify-center transition-all duration-700 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)] group-hover:border-primary/40 group-hover:text-primary group-hover:-translate-x-6 group-hover:translate-y-2 group-hover:-rotate-[25deg] shadow-sm"
        >
          <ImageIcon class="w-1/2 h-1/2" />
        </div>
        <div
          class="absolute top-2 right-0 w-[35%] h-[45%] rounded-[22%] bg-muted/80 border-2 border-border text-muted-foreground/60 z-0 rotate-12 flex items-center justify-center transition-all duration-700 [transition-timing-function:cubic-bezier(0.34,1.56,0.64,1)] group-hover:border-primary/40 group-hover:text-primary group-hover:translate-x-6 group-hover:-translate-y-2 group-hover:rotate-[25deg] shadow-sm"
        >
          <FileImage class="w-1/2 h-1/2" />
        </div>
      </div>

      <!-- 文字内容区域 -->
      <div class="mb-10 md:mb-14 flex flex-col items-center w-full">
        <h2
          class="font-black text-foreground mb-4 md:mb-5 tracking-tight px-2 leading-[1.1] [text-wrap:balance]"
          style="font-size: clamp(1.5rem, 6cqw, 2.25rem)"
        >
          {{ $t('common.image.upload.title') }}
        </h2>
        <p
          class="text-muted-foreground font-medium leading-relaxed px-4 [text-wrap:balance] opacity-80"
          style="font-size: clamp(0.9rem, 3cqw, 1.05rem)"
        >
          {{ $t('common.image.upload.subtitle') }}
        </p>
      </div>

      <!-- 快捷键提示 (Polished) -->
      <div
        class="hidden @[35rem]:flex items-center gap-6 mb-12 shrink-0 bg-muted/50 px-6 py-2.5 rounded-full border border-border/40"
      >
        <div
          class="flex items-center gap-2 text-[0.7rem] text-muted-foreground font-bold uppercase tracking-widest"
        >
          <kbd
            class="bg-background border-b-2 border-border/80 rounded px-2 py-0.5 text-[0.6rem] font-black"
            >Ctrl + V</kbd
          >
          {{ $t('common.image.upload.quickPaste') }}
        </div>
        <div class="w-px h-3 bg-border/60"></div>
        <div
          class="flex items-center gap-2 text-[0.7rem] text-muted-foreground font-bold uppercase tracking-widest"
        >
          <span class="w-1.5 h-1.5 bg-success rounded-full animate-pulse"></span>
          {{ $t('common.image.upload.pureOffline') }}
        </div>
      </div>

      <AppButton
        size="lg"
        variant="cta"
        @click.stop="triggerSelect"
        class="!px-10 !h-14 !text-sm md:!text-base !rounded-2xl shrink-0 transition-all duration-300"
      >
        <template #icon><Upload class="mr-2.5 w-5 h-5" /></template>
        {{ $t('common.image.upload.button') }}
      </AppButton>
    </div>

    <!-- Background Pattern (Delightful Mesh) -->
    <div
      class="absolute inset-0 opacity-[0.03] dark:opacity-[0.07] pointer-events-none transition-opacity duration-500 group-hover:opacity-[0.05] dark:group-hover:opacity-[0.1]"
      style="
        background-image: radial-gradient(circle at 2px 2px, var(--foreground) 1px, transparent 0);
        background-size: 32px 32px;
      "
    ></div>
  </div>
</template>
