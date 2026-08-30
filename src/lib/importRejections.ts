import type { RejectedImage } from '../stores/imageStore'

type TranslateFn = (key: string, params?: Record<string, unknown>) => string

export function alertImportRejections(rejected: RejectedImage[] | void, t: TranslateFn) {
  if (!rejected?.length) return
  for (const item of rejected) {
    if (item.reason === 'size') {
      alert(
        t('common.image.upload.errorSize', {
          name: item.file.name,
          size: (item.file.size / 1024 / 1024).toFixed(1)
        })
      )
    } else if (item.reason === 'dimensions') {
      alert(
        t('common.image.upload.errorDimensions', {
          name: item.file.name,
          width: item.width,
          height: item.height
        })
      )
    } else if (item.reason === 'decode') {
      alert(
        t('common.image.upload.errorDecode', {
          name: item.file.name
        })
      )
    } else if (item.reason === 'type') {
      alert(
        t('common.image.upload.errorType', {
          name: item.file.name
        })
      )
    }
  }
}
