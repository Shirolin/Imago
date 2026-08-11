<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import AppModal from './common/AppModal.vue'
import AppButton from './common/AppButton.vue'
import { Download, Cpu, ShieldCheck } from 'lucide-vue-next'

const props = defineProps<{
  show: boolean
}>()

const emit = defineEmits(['confirm', 'cancel'])
const { t } = useI18n()

const isDownloading = ref(false)

// P2: 父级 confirm 流程是同步的（立即关闭模态框），isDownloading 此前置 true 后永不复位，
// 下次打开时按钮仍是 loading 态。改为随模态框关闭自动复位，并防止重复触发。
watch(
  () => props.show,
  (show) => {
    if (!show) isDownloading.value = false
  }
)

const handleConfirm = () => {
  if (isDownloading.value) return
  isDownloading.value = true
  emit('confirm')
}
</script>

<template>
  <AppModal
    :show="show"
    :title="t('common.modal.interactive.confirmTitle')"
    variant="dialog"
    @close="emit('cancel')"
  >
    <div class="p-6 space-y-6">
      <div class="flex items-start gap-4 mb-2">
        <div class="p-3.5 bg-primary/10 rounded-2xl text-primary shrink-0">
          <Download :size="24" />
        </div>
        <div>
          <h3 class="text-lg font-bold text-foreground mb-1">
            {{ t('common.modal.interactive.downloadTitle') }}
          </h3>
          <p class="text-muted-foreground text-sm leading-relaxed">
            {{ t('common.modal.interactive.downloadDesc1') }}
            <span class="text-primary font-bold">{{
              t('common.modal.interactive.downloadSize')
            }}</span>
            {{ t('common.modal.interactive.downloadDesc2') }}
          </p>
        </div>
      </div>

      <dl
        class="grid grid-cols-1 md:grid-cols-2 gap-3"
        role="region"
        :aria-label="t('common.modal.interactive.featuresAria')"
      >
        <div class="p-4 bg-muted/30 border border-border/20 rounded-xl flex items-center gap-3">
          <Cpu :size="18" class="text-muted-foreground/60" />
          <div class="text-xs">
            <dt class="text-foreground font-semibold">
              {{ t('common.modal.interactive.gpuAccel') }}
            </dt>
            <dd class="text-muted-foreground mt-0.5">
              {{ t('common.modal.interactive.gpuAccelDesc') }}
            </dd>
          </div>
        </div>
        <div class="p-4 bg-muted/30 border border-border/20 rounded-xl flex items-center gap-3">
          <ShieldCheck :size="18" class="text-muted-foreground/60" />
          <div class="text-xs">
            <dt class="text-foreground font-semibold">
              {{ t('common.modal.interactive.privacy') }}
            </dt>
            <dd class="text-muted-foreground mt-0.5">
              {{ t('common.modal.interactive.privacyDesc') }}
            </dd>
          </div>
        </div>
      </dl>

      <div class="pt-2 flex gap-3">
        <AppButton variant="ghost" class="flex-1" @click="emit('cancel')">
          {{ t('common.modal.interactive.later') }}
        </AppButton>
        <AppButton variant="primary" class="flex-1" :loading="isDownloading" @click="handleConfirm">
          {{ t('common.modal.interactive.agreeDownload') }}
        </AppButton>
      </div>
    </div>
  </AppModal>
</template>
