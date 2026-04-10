<script setup lang="ts">
import { ref } from 'vue'
import AppModal from './common/AppModal.vue'
import AppButton from './common/AppButton.vue'
import { Download, Cpu, ShieldCheck } from 'lucide-vue-next'

defineProps<{
  show: boolean
}>()

const emit = defineEmits(['confirm', 'cancel'])

const isDownloading = ref(false)

const handleConfirm = () => {
  isDownloading.value = true
  emit('confirm')
}
</script>

<template>
  <AppModal :show="show" title="确认启用高级交互编辑" variant="dialog" @close="emit('cancel')">
    <div class="p-6 space-y-6">
      <div class="flex items-start gap-4 mb-2">
        <div class="p-3.5 bg-primary/10 rounded-2xl text-primary shrink-0">
          <Download :size="24" />
        </div>
        <div>
          <h3 class="text-lg font-bold text-foreground mb-1">即将下载 AI 模型资产</h3>
          <p class="text-muted-foreground text-sm leading-relaxed">
            该功能需要下载由 Meta AI 开发的高性能分割模型 (SAM2)，预计占用约
            <span class="text-primary font-bold">45MB</span> 存储空间。
          </p>
        </div>
      </div>

      <dl class="grid grid-cols-1 md:grid-cols-2 gap-3" role="region" aria-label="核心功能特性">
        <div class="p-4 bg-muted/30 border border-border/20 rounded-xl flex items-center gap-3">
          <Cpu :size="18" class="text-muted-foreground/60" />
          <div class="text-xs">
            <dt class="text-foreground font-semibold">硬件加速</dt>
            <dd class="text-muted-foreground mt-0.5">支持 WebGPU 毫秒级反馈</dd>
          </div>
        </div>
        <div class="p-4 bg-muted/30 border border-border/20 rounded-xl flex items-center gap-3">
          <ShieldCheck :size="18" class="text-muted-foreground/60" />
          <div class="text-xs">
            <dt class="text-foreground font-semibold">隐私保护</dt>
            <dd class="text-muted-foreground mt-0.5">本地机密运算，无需上传</dd>
          </div>
        </div>
      </dl>

      <div class="pt-2 flex gap-3">
        <AppButton variant="ghost" class="flex-1" @click="emit('cancel')"> 暂时取消 </AppButton>
        <AppButton variant="primary" class="flex-1" :loading="isDownloading" @click="handleConfirm">
          同意并下载
        </AppButton>
      </div>
    </div>
  </AppModal>
</template>
