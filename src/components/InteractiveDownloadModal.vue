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
      <div class="flex items-start gap-4">
        <div class="p-3 bg-primary/10 rounded-xl text-primary">
          <Download :size="24" />
        </div>
        <div>
          <h3 class="text-lg font-bold text-foreground mb-1">即将下载 AI 模型资产</h3>
          <p class="text-muted-foreground text-sm leading-relaxed">
            该功能需要下载额外的高性能分割模型 (SAM2-Hiera-Tiny)，预计占用约
            <span class="text-primary font-bold">45MB</span> 存储空间。
          </p>
        </div>
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div class="p-4 bg-muted/40 border border-border/40 rounded-xl flex items-center gap-3">
          <Cpu :size="18" class="text-muted-foreground" />
          <div class="text-xs">
            <div class="text-foreground font-medium">硬件加速</div>
            <div class="text-muted-foreground">支持 WebGPU 毫秒级反馈</div>
          </div>
        </div>
        <div class="p-4 bg-muted/40 border border-border/40 rounded-xl flex items-center gap-3">
          <ShieldCheck :size="18" class="text-muted-foreground" />
          <div class="text-xs">
            <div class="text-foreground font-medium">隐私保护</div>
            <div class="text-muted-foreground">本地机密运算，无需上传</div>
          </div>
        </div>
      </div>

      <div class="pt-2 flex gap-3">
        <AppButton variant="ghost" class="flex-1" @click="emit('cancel')"> 暂时取消 </AppButton>
        <AppButton variant="primary" class="flex-1" :loading="isDownloading" @click="handleConfirm">
          同意并下载
        </AppButton>
      </div>

      <p class="text-center text-[10px] text-muted-foreground/30 uppercase tracking-widest">
        Model by Meta AI • Running via Transformers.js v3
      </p>
    </div>
  </AppModal>
</template>
