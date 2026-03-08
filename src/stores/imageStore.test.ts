import { setActivePinia, createPinia } from 'pinia'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useImageStore } from './imageStore'

describe('Image Store', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    // 使用 spyOn 模拟 URL 方法，避免直接修改 readonly 属性导致的类型错误
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('mock-url')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  })

  it('应该能正确添加图片', () => {
    const store = useImageStore()
    const mockFile = new File(['test'], 'test.png', { type: 'image/png' })

    store.addImages([mockFile])

    expect(store.images.length).toBe(1)
    expect(store.images[0]!.file.name).toBe('test.png')
    expect(store.images[0]!.status).toBe('idle')
  })

  it('不应添加完全重复的文件', () => {
    const store = useImageStore()
    const mockFile = new File(['test'], 'test.png', { type: 'image/png' })

    store.addImages([mockFile])
    store.addImages([mockFile]) // 重复添加

    expect(store.images.length).toBe(1)
  })

  it('应该能正确切换选择状态', () => {
    const store = useImageStore()
    const mockFile = new File(['test'], 'test.png', { type: 'image/png' })
    store.addImages([mockFile])
    const id = store.images[0]!.id

    store.toggleSelection(id)
    expect(store.selectedIds.has(id)).toBe(true)
    expect(store.selectedCount).toBe(1)

    store.toggleSelection(id)
    expect(store.selectedIds.has(id)).toBe(false)
  })

  it('应该能全选和取消全选', () => {
    const store = useImageStore()
    store.addImages([
      new File(['1'], '1.png', { type: 'image/png' }),
      new File(['2'], '2.png', { type: 'image/png' })
    ])

    store.selectAll()
    expect(store.selectedCount).toBe(2)
    expect(store.isAllSelected).toBe(true)

    store.deselectAll()
    expect(store.selectedCount).toBe(0)
    expect(store.isAllSelected).toBe(false)
  })

  it('移除图片时应清理资源', () => {
    const store = useImageStore()
    const mockFile = new File(['test'], 'test.png', { type: 'image/png' })
    store.addImages([mockFile])
    const id = store.images[0]!.id

    store.removeImage(id)

    expect(store.images.length).toBe(0)
    expect(vi.mocked(URL.revokeObjectURL)).toHaveBeenCalledWith('mock-url')
  })
})
