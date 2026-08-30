import { describe, it, expect, beforeEach, afterEach, vi, type Mock } from 'vitest'
import { setActivePinia } from 'pinia'
import { createTestingPinia } from '@pinia/testing'
import JSZip from 'jszip'
import { useFileHelpers } from './useFileHelpers'

/**
 * useFileHelpers 回归测试（ZIP 同名去重 / 空结果静默返回 / getNewFileName 后缀注入）
 *
 * Mock 策略：vue-i18n 替换为透传 key 的空实例；createTestingPinia(stubActions) 提供
 * store（handleFileChange 断言 addImages 被调用）；document.createElement('a') 捕获下载锚点，
 * URL.createObjectURL 记录实际 Blob，测试用 JSZip.loadAsync 回读 ZIP 条目做端到端断言。
 */

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

type MockFn = Mock

interface AnchorMock {
  click: MockFn
  href: string
  download: string
}

const anchors: AnchorMock[] = []
const capturedBlobs: Blob[] = []

beforeEach(() => {
  anchors.length = 0
  capturedBlobs.length = 0
  setActivePinia(createTestingPinia({ createSpy: vi.fn, stubActions: true }))

  const originalCreateElement = document.createElement.bind(document)
  vi.spyOn(document, 'createElement').mockImplementation((tag: string, options?: object) => {
    if (tag === 'a') {
      const anchor: AnchorMock = { click: vi.fn(), href: '', download: '' }
      anchors.push(anchor)
      return anchor as unknown as HTMLAnchorElement
    }
    return originalCreateElement(tag, options)
  })
  vi.spyOn(URL, 'createObjectURL').mockImplementation((obj: Blob | MediaSource) => {
    capturedBlobs.push(obj as Blob)
    return `blob:mock-${capturedBlobs.length}`
  })
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

/** 回读下载产生的 ZIP Blob 中的条目名 */
async function zipEntryNames(): Promise<string[]> {
  const buffer = await capturedBlobs[0]!.arrayBuffer()
  const zip = await JSZip.loadAsync(buffer)
  return Object.keys(zip.files).filter((n) => !zip.files[n]!.dir)
}

function item(name: string, blob: Blob, blobs?: Blob[]) {
  return {
    file: new File(['x'], name, { type: 'image/png' }),
    processedBlob: blob,
    processedBlobs: blobs,
    status: 'done' as const
  }
}

/** getNewFileName 未导出，通过 downloadImage 的下载文件名间接断言其行为 */
async function downloadedName(blob: Blob, original: string, tag?: string) {
  const { downloadImage } = useFileHelpers()
  await downloadImage(blob, original, tag)
  return anchors[anchors.length - 1]!.download
}

describe('getNewFileName 后缀注入（经 downloadImage 间接验证）', () => {
  it('按 MIME 映射扩展名', async () => {
    expect(await downloadedName(new Blob(['x'], { type: 'image/jpeg' }), 'a.jpg', 'r')).toBe(
      'ar.jpg'
    )
    expect(await downloadedName(new Blob(['x'], { type: 'image/png' }), 'a.png', 'r')).toBe(
      'ar.png'
    )
    expect(await downloadedName(new Blob(['x'], { type: 'image/webp' }), 'a.webp', 'r')).toBe(
      'ar.webp'
    )
    expect(await downloadedName(new Blob(['x'], { type: 'image/avif' }), 'a.avif', 'r')).toBe(
      'ar.avif'
    )
  })

  it('未知 MIME 回退 .jpg', async () => {
    expect(await downloadedName(new Blob(['x'], { type: 'image/tiff' }), 'a.png', 'r')).toBe(
      'ar.jpg'
    )
  })

  it('无扩展名文件名直接追加', async () => {
    expect(await downloadedName(new Blob(['x'], { type: 'image/png' }), 'photo', 'r')).toBe(
      'photor.png'
    )
  })

  it('tag 注入到扩展名之前', async () => {
    expect(
      await downloadedName(new Blob(['x'], { type: 'image/png' }), 'photo.png', 'resized')
    ).toBe('photoresized.png')
  })

  it('tag 已存在于 baseName 时不重复注入', async () => {
    expect(
      await downloadedName(new Blob(['x'], { type: 'image/png' }), 'photoresized.png', 'resized')
    ).toBe('photoresized.png')
  })

  it('多段扩展名只替换最后一段', async () => {
    expect(await downloadedName(new Blob(['x'], { type: 'image/png' }), 'a.b.png', 'croped')).toBe(
      'a.bcroped.png'
    )
  })
})

describe('formatSize', () => {
  it('0 字节', () => {
    expect(useFileHelpers().formatSize(0)).toBe('0 B')
  })

  it('B / KB / MB / GB 单位换算', () => {
    const { formatSize } = useFileHelpers()
    expect(formatSize(1023)).toBe('1023 B')
    expect(formatSize(1024)).toBe('1 KB')
    expect(formatSize(1536)).toBe('1.5 KB')
    expect(formatSize(1048576)).toBe('1 MB')
    expect(formatSize(1073741824)).toBe('1 GB')
  })
})

describe('downloadImage', () => {
  it('单 Blob：文件名注入后缀并触发点击', async () => {
    const { downloadImage } = useFileHelpers()
    const blob = new Blob(['x'], { type: 'image/png' })
    await downloadImage(blob, 'photo.png', 'resized')
    expect(capturedBlobs[0]).toBe(blob)
    expect(anchors).toHaveLength(1)
    expect(anchors[0]!.download).toBe('photoresized.png')
    expect(anchors[0]!.click).toHaveBeenCalledTimes(1)
  })

  it('多 Blob：打包为 ZIP 并使用 tile 命名', async () => {
    const { downloadImage } = useFileHelpers()
    const blobs = [new Blob(['a'], { type: 'image/png' }), new Blob(['b'], { type: 'image/png' })]
    await downloadImage(blobs, 'photo.png', 'resized')
    expect(anchors[0]!.download).toBe('photoresized.zip')
    expect(await zipEntryNames()).toEqual(['photo_tile_1resized.png', 'photo_tile_2resized.png'])
  })
})

describe('downloadAllAsZip 去重与空结果', () => {
  it('无有效结果时静默返回：不创建 ZIP 不下载', async () => {
    const { downloadAllAsZip, isDownloadingAll } = useFileHelpers()
    await downloadAllAsZip('resized', [])
    expect(capturedBlobs).toHaveLength(0)
    expect(anchors).toHaveLength(0)
    expect(isDownloadingAll.value).toBe(false)
  })

  it('单张图直接触发单图下载而不打包', async () => {
    const { downloadAllAsZip } = useFileHelpers()
    const blob = new Blob(['x'], { type: 'image/png' })
    await downloadAllAsZip('resized', [item('photo.png', blob)])
    expect(capturedBlobs[0]).toBe(blob)
    expect(anchors[0]!.download).toBe('photoresized.png')
  })

  it('同名条目不互相覆盖：photo (2).png / photo (3).png 后缀递增', async () => {
    const { downloadAllAsZip } = useFileHelpers()
    await downloadAllAsZip('resized', [
      item('photo.png', new Blob(['a'], { type: 'image/png' })),
      item('photo.png', new Blob(['b'], { type: 'image/png' })),
      item('photo.png', new Blob(['c'], { type: 'image/png' }))
    ])
    expect(await zipEntryNames()).toEqual([
      'photoresized.png',
      'photoresized (2).png',
      'photoresized.png (3)'
    ])
  })

  it('切片条目以文件夹去重：photo 与 photo (2)', async () => {
    const { downloadAllAsZip } = useFileHelpers()
    await downloadAllAsZip('resized', [
      item('photo.png', undefined as unknown as Blob, [new Blob(['a'], { type: 'image/png' })]),
      item('photo.png', undefined as unknown as Blob, [new Blob(['b'], { type: 'image/png' })])
    ])
    expect(await zipEntryNames()).toEqual([
      'photo/photo_tile_1resized.png',
      'photo (2)/photo_tile_1resized.png'
    ])
  })
})

describe('输入与全局交互', () => {
  it('handleFileChange 转发文件到 store.addImages', async () => {
    const { useImageStore } = await import('../stores/imageStore')
    const store = useImageStore()
    vi.mocked(store.addImages).mockResolvedValue([])
    const { handleFileChange } = useFileHelpers()
    const file = new File(['x'], 'a.png', { type: 'image/png' })
    await handleFileChange({ target: { files: [file] } } as unknown as Event)
    expect(store.addImages).toHaveBeenCalledWith([file])
  })

  it('triggerFileInput 点击全局输入框', () => {
    const { triggerFileInput } = useFileHelpers()
    const input = { click: vi.fn() }
    vi.spyOn(document, 'getElementById').mockReturnValue(input as unknown as HTMLElement)
    triggerFileInput()
    expect(input.click).toHaveBeenCalledTimes(1)
  })

  it('无全局输入框时回退到本地 ref', () => {
    const { triggerFileInput, fileInput } = useFileHelpers()
    vi.spyOn(document, 'getElementById').mockReturnValue(null)
    const local = { click: vi.fn() }
    fileInput.value = local as unknown as HTMLInputElement
    triggerFileInput()
    expect(local.click).toHaveBeenCalledTimes(1)
  })
})
