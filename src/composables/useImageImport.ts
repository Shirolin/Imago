import { useI18n } from 'vue-i18n'
import { useImageStore } from '../stores/imageStore'
import { alertImportRejections } from '../lib/importRejections'

export function useImageImport() {
  const store = useImageStore()
  const { t } = useI18n()

  const importImages = async (files: FileList | File[]) => {
    const list = Array.from(files)
    if (list.length === 0) return
    const rejected = await store.addImages(list)
    alertImportRejections(rejected, t)
  }

  return { importImages }
}
