import { describe, it, expect, vi, beforeEach } from 'vitest'
import { useStampBasket } from './useStampBasket'
import { MAX_BASKET } from '../lib/moldCut'

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => 'blob:mock') as unknown as typeof URL.createObjectURL
  URL.revokeObjectURL = vi.fn()
})

function blob(): Blob {
  return new Blob(['x'], { type: 'image/png' })
}

describe('useStampBasket 收集篮', () => {
  it('盖章落篮并按坐标命名', () => {
    const basket = useStampBasket()
    const item = basket.addStamp(blob(), 'sprite.png', { x: 128, y: 64, w: 32, h: 32 })
    expect(item?.name).toBe('sprite_128_64_32x32')
    expect(basket.count.value).toBe(1)
    expect(basket.isFull.value).toBe(false)
  })

  it('满 100 拒绝并返回 null', () => {
    const basket = useStampBasket()
    for (let i = 0; i < MAX_BASKET; i++) {
      basket.addStamp(blob(), 's.png', { x: i, y: 0, w: 32, h: 32 })
    }
    expect(basket.isFull.value).toBe(true)
    expect(basket.addStamp(blob(), 's.png', { x: 0, y: 0, w: 32, h: 32 })).toBeNull()
    expect(basket.count.value).toBe(MAX_BASKET)
  })

  it('删除释放预览 URL', () => {
    const basket = useStampBasket()
    const item = basket.addStamp(blob(), 's.png', { x: 0, y: 0, w: 32, h: 32 })!
    basket.removeStamp(item.id)
    expect(basket.count.value).toBe(0)
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock')
  })

  it('切图清空旧篮', () => {
    const basket = useStampBasket()
    basket.bindSource('a')
    basket.addStamp(blob(), 's.png', { x: 0, y: 0, w: 32, h: 32 })
    basket.bindSource('b')
    expect(basket.count.value).toBe(0)
    expect(basket.sourceId.value).toBe('b')
  })
})
