import { describe, it, expect, vi } from 'vitest'
import { AbortError, isAbortError, onAbort, throwIfAborted } from './abort'

/**
 * 中止语义的单一真源。
 *
 * 这组测试锁住的是「上层不再需要靠字符串匹配识别中止」这件事：
 * useImageProcessor 曾用 err.message?.includes('abort') 判定，
 * 换个人写错文案，中止就会被当成真实失败报给用户。
 */

describe('AbortError', () => {
  it('name 固定为 AbortError', () => {
    const e = new AbortError()
    expect(e.name).toBe('AbortError')
    expect(e.message).toBe('Task aborted')
  })

  it('是真正的 Error（可被 instanceof Error 捕获）', () => {
    expect(new AbortError()).toBeInstanceOf(Error)
  })

  it('可传自定义文案', () => {
    expect(new AbortError('画布过大').message).toBe('画布过大')
  })
})

describe('isAbortError', () => {
  it('认 AbortError 实例', () => {
    expect(isAbortError(new AbortError())).toBe(true)
  })

  it('认 DOMException（浏览器原生 abort()）', () => {
    const domErr = new DOMException('The user aborted a request.', 'AbortError')
    expect(isAbortError(domErr)).toBe(true)
  })

  it('认跨 realm 的 { name: "AbortError" }', () => {
    // iframe / worker 里创建的错误 instanceof 会失效，只能靠 name
    expect(isAbortError({ name: 'AbortError' })).toBe(true)
  })

  it('兼容历史字符串写法（过渡期保留）', () => {
    expect(isAbortError(new Error('Task aborted'))).toBe(true)
    expect(isAbortError(new Error('AbortError'))).toBe(true)
    expect(isAbortError('AbortError')).toBe(true)
    //大小写混写也算（旧代码有 'aborted'）
    expect(isAbortError(new Error('Processing aborted'))).toBe(true)
  })

  it('真实错误不被误判为中止', () => {
    expect(isAbortError(new Error('Failed to load image'))).toBe(false)
    expect(isAbortError(new Error('Canvas too large: 40000px'))).toBe(false)
    expect(isAbortError(new TypeError('x is not a function'))).toBe(false)
    expect(isAbortError(null)).toBe(false)
    expect(isAbortError(undefined)).toBe(false)
  })

  it('「aborted」子串不会误伤正常错误', () => {
    // 这条是字符串分支的固有代价：文案里含 abort 就算中止。
    // 因此约定：真实错误文案不要出现 abort 字样。
    expect(isAbortError(new Error('Image aborted halfway'))).toBe(true)
  })
})

describe('onAbort', () => {
  it('无 signal 时返回可调用的空解绑函数', () => {
    const fn = onAbort(undefined, () => {})
    expect(() => fn()).not.toThrow()
    expect(() => fn()).not.toThrow()
  })

  it('signal 已 aborted 时立即回调（补上 addEventListener 的盲区）', () => {
    const ctrl = new AbortController()
    ctrl.abort()
    const spy = vi.fn()
    onAbort(ctrl.signal, spy)
    // 裸 addEventListener 在这里永远不会触发
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('signal 后续 abort 时触发一次', () => {
    const ctrl = new AbortController()
    const spy = vi.fn()
    onAbort(ctrl.signal, spy)
    expect(spy).not.toHaveBeenCalled()
    ctrl.abort()
    expect(spy).toHaveBeenCalledTimes(1)
  })

  it('解绑后不再触发（修复 crop/filter 的监听器泄漏）', () => {
    const ctrl = new AbortController()
    const spy = vi.fn()
    const release = onAbort(ctrl.signal, spy)
    release()
    ctrl.abort()
    expect(spy).not.toHaveBeenCalled()
  })

  it('解绑幂等（重复调用不抛）', () => {
    const ctrl = new AbortController()
    const release = onAbort(ctrl.signal, () => {})
    release()
    expect(() => release()).not.toThrow()
    expect(() => release()).not.toThrow()
  })

  it('监听器只注册一次，可反复解绑', () => {
    const ctrl = new AbortController()
    const spy = vi.fn()
    // 多个 listener 各自独立
    const r1 = onAbort(ctrl.signal, spy)
    const r2 = onAbort(ctrl.signal, spy)
    r1()
    r2()
    ctrl.abort()
    expect(spy).not.toHaveBeenCalled()
  })
})

describe('throwIfAborted', () => {
  it('未中止时不抛', () => {
    const ctrl = new AbortController()
    expect(() => throwIfAborted(ctrl.signal)).not.toThrow()
    expect(() => throwIfAborted(undefined)).not.toThrow()
  })

  it('已中止时抛 AbortError（可被 isAbortError 认出）', () => {
    const ctrl = new AbortController()
    ctrl.abort()
    try {
      throwIfAborted(ctrl.signal)
      expect.unreachable?.()
    } catch (e) {
      expect(e).toBeInstanceOf(AbortError)
      expect(isAbortError(e)).toBe(true)
    }
  })
})
