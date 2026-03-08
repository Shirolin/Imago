<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { Upload, Clipboard, Image as ImageIcon, FileImage, MousePointer2 } from 'lucide-vue-next'
import AppButton from './AppButton.vue'

const emit = defineEmits(['upload'])
const isGlobalDragging = ref(false)
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
        `图片 [${file.name}] 体积过大 (${(file.size / 1024 / 1024).toFixed(1)}MB)，已被拦截以免导致浏览器崩溃。最大支持 50MB。`
      )
      return false
    }
    return true
  })

  if (validFiles.length > 0) {
    emit('upload', validFiles)
  }
}

let dragTarget: EventTarget | null = null

const onGlobalDragEnter = (e: DragEvent) => {
  e.preventDefault()
  dragTarget = e.target
  isGlobalDragging.value = true
}

const onGlobalDragOver = (e: DragEvent) => {
  e.preventDefault()
}

const onGlobalDragLeave = (e: DragEvent) => {
  // Only hide if we leave the outer window/document
  if (e.target === dragTarget || e.target === document) {
    isGlobalDragging.value = false
  }
}

const onGlobalDrop = (e: DragEvent) => {
  e.preventDefault()
  isGlobalDragging.value = false
  if (e.dataTransfer?.files) {
    handleFiles(e.dataTransfer.files)
  }
}

const onFileSelect = (e: Event) => {
  const target = e.target as HTMLInputElement
  if (target.files) {
    handleFiles(target.files)
  }
}

const onPaste = (e: ClipboardEvent) => {
  if (e.clipboardData?.files) {
    handleFiles(e.clipboardData.files)
  }
}

const triggerSelect = () => {
  fileInput.value?.click()
}

onMounted(() => {
  window.addEventListener('paste', onPaste)
  document.addEventListener('dragenter', onGlobalDragEnter)
  document.addEventListener('dragover', onGlobalDragOver)
  document.addEventListener('dragleave', onGlobalDragLeave)
  document.addEventListener('drop', onGlobalDrop)
})

onUnmounted(() => {
  window.removeEventListener('paste', onPaste)
  document.removeEventListener('dragenter', onGlobalDragEnter)
  document.removeEventListener('dragover', onGlobalDragOver)
  document.removeEventListener('dragleave', onGlobalDragLeave)
  document.removeEventListener('drop', onGlobalDrop)
})
</script>

<template>
  <div
    class="relative w-full min-h-[480px] bg-card border-2 border-dashed border-border rounded-[40px] flex items-center justify-center cursor-pointer overflow-hidden p-8 outline-none transition-all duration-400 focus-visible:border-primary focus-visible:ring-4 focus-visible:ring-primary/20 hover:border-primary hover:bg-muted hover:-translate-y-1 hover:shadow-2xl hover:shadow-black/10 group"
    :class="{ 'border-primary bg-primary/10 scale-[0.985]': isGlobalDragging }"
    @click="triggerSelect"
  >
    <Teleport to="body">
      <div
        v-if="isGlobalDragging"
        class="fixed inset-3 bg-primary/15 backdrop-blur-md z-[9999] flex items-center justify-center border-4 border-dashed border-primary rounded-[38px] pointer-events-none animate-in fade-in zoom-in-95 duration-200"
      >
        <div
          class="flex flex-col items-center gap-6 text-primary font-extrabold text-3xl drop-shadow-md"
        >
          <MousePointer2 :size="64" class="animate-bounce" />
          <span>松开鼠标，将图片放入 Imago</span>
        </div>
      </div>
    </Teleport>

    <input
      type="file"
      ref="fileInput"
      multiple
      accept="image/*"
      class="hidden"
      @change="onFileSelect"
    />

    <div class="relative z-10 flex flex-col items-center text-center">
      <div class="relative mb-12 w-[120px] h-[100px] flex justify-center">
        <div
          class="w-[84px] h-[84px] rounded-3xl bg-background border-2 border-border text-primary flex items-center justify-center relative z-10 transition-all duration-400 group-hover:border-primary group-hover:scale-110 shadow-sm"
        >
          <Upload :size="32" />
        </div>
        <div
          class="absolute bottom-0 left-0 w-[44px] h-[44px] rounded-2xl bg-card border-2 border-border text-muted-foreground z-0 -rotate-12 flex items-center justify-center transition-all duration-400 group-hover:border-primary group-hover:text-primary group-hover:-translate-x-2.5 group-hover:translate-y-1 group-hover:-rotate-[20deg]"
        >
          <ImageIcon :size="16" />
        </div>
        <div
          class="absolute top-0 right-0 w-[44px] h-[44px] rounded-2xl bg-card border-2 border-border text-muted-foreground z-0 rotate-12 flex items-center justify-center transition-all duration-400 group-hover:border-primary group-hover:text-primary group-hover:translate-x-2.5 group-hover:-translate-y-1 group-hover:rotate-[20deg]"
        >
          <FileImage :size="16" />
        </div>
      </div>

      <div class="mb-10 flex flex-col items-center">
        <h2 class="text-3xl font-extrabold text-foreground mb-4 tracking-tight">
          点击、拖拽或粘贴图片到这里
        </h2>
        <p class="text-base text-muted-foreground">
          支持 JPG, PNG, WebP, AVIF 等格式 · 100% 本地处理
        </p>
      </div>

      <div class="flex items-center gap-5 mb-12">
        <div class="flex items-center gap-2 text-sm text-muted-foreground font-semibold">
          <kbd
            class="bg-background border border-border rounded-md px-1.5 py-0.5 shadow-[0_2px_0_var(--border)] font-sans"
            >Ctrl</kbd
          >
          +
          <kbd
            class="bg-background border border-border rounded-md px-1.5 py-0.5 shadow-[0_2px_0_var(--border)] font-sans"
            >V</kbd
          >
          粘贴
        </div>
        <div class="w-px h-4 bg-border"></div>
        <div class="flex items-center gap-2 text-sm text-muted-foreground font-medium">
          <span class="w-1.5 h-1.5 bg-primary rounded-full"></span>
          浏览器原生支持的所有图片格式
        </div>
      </div>

      <AppButton size="lg" @click.stop="triggerSelect" class="!px-8 !h-14 !text-base !rounded-2xl"
        >选择图片文件</AppButton
      >
    </div>

    <!-- Background Pattern -->
    <div
      class="absolute inset-0 opacity-5 pointer-events-none"
      style="
        background-image: radial-gradient(var(--border) 1px, transparent 1px);
        background-size: 32px 32px;
      "
    ></div>
  </div>
</template>
