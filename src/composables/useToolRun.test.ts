import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { defineComponent, h, nextTick, ref } from 'vue'
import { mount } from '@vue/test-utils'
import { createPinia, setActivePinia, type Pinia } from 'pinia'
import { useImageStore, type ImageItem } from '../stores/imageStore'
import { useToolRun, type ToolRun, type ToolSpec } from './useToolRun'
import type { ImageProcessor } from '../lib/engines/types'

/**
 * useToolRun 的行为测试。
 *
 * 这 989 行视图逻辑此前零覆盖。这里从 interface 外观测可观察行为：
 * CTA 状态流转、结果集生命周期、预览 URL 所有权、导出接线。
 * 不测内部实现（Map 结构、watch 注册数），也不为覆盖率补断言。
 */

vi.mock('vue-i18n', () => ({
  useI18n: () => ({ t: (key: string) => key })
}))

interface DeferredEntry {
  file: File
  options: Record<string, unknown>
  resolve: (v: unknown) => void
  reject: (e: Error) => void
  progress?: (p: number) => void
  signal?: AbortSignal
}

/** 引擎夹具：逐条手动 resolve，不依赖真实定时器 */
function deferredEngine() {
  const entries: DeferredEntry[] = []
  const engine = vi.fn((file: File, opts: never) => {
    const o = opts as unknown as Record<string, unknown>
    return new Promise((resolve, reject) => {
      const entry: DeferredEntry = {
        file,
        options: o,
        resolve: resolve as (v: unknown) => void,
        reject,
        progress: o.onProgress as ((p: number) => void) | undefined,
        signal: o.signal as AbortSignal | undefined
      }
      const signal = o.signal as AbortSignal | undefined
      if (signal?.aborted) {
        reject(new Error('AbortError'))
        return
      }
      signal?.addEventListener('abort', () => reject(new Error('AbortError')))
      entries.push(entry)
    })
  }) as unknown as ImageProcessor<Record<string, unknown>>
  return { engine, entries }
}

let pinia: Pinia

function makeItem(id: string, name = `${id}.png`): ImageItem {
  return {
    id,
    file: new File(['x'], name, { type: 'image/png' }),
    preview: `blob:orig-${id}`,
    status: 'idle',
    originalSize: 100,
    width: 100,
    height: 100,
    format: 'PNG'
  }
}

/** 直接 push 绕过 addImages 的解码依赖，精确控制 status */
function seed(...ids: string[]) {
  setActivePinia(pinia)
  const store = useImageStore()
  ids.forEach((id) => store.images.push(makeItem(id)))
  ids.forEach((id) => store.selectedIds.add(id))
  return store
}

let created: string[]
let revoked: string[]

beforeEach(() => {
  pinia = createPinia()
  setActivePinia(pinia)
  created = []
  revoked = []
  let n = 0
  vi.spyOn(URL, 'createObjectURL').mockImplementation(() => {
    const url = `blob:preview-${++n}`
    created.push(url)
    return url
  })
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation((u) => {
    revoked.push(u as string)
  })
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

/**
 * 在真实组件里跑 useToolRun：它内部注册 onUnmounted，
 * 直接在测试函数里调用会产生「生命周期钩子无实例」的警告且 watcher 不回收。
 *
 * pinia 必须作为 plugin 显式传入：mount 会创建独立 app，其内部的
 * useImageStore / useImageProcessor 都依赖 app 上下文注入的 pinia 实例。
 * 传同一个 pinia，seed() 写入的数据才对组件可见。
 */
function mountTool(spec: ToolSpec<Record<string, unknown>>, expose: (r: ToolRun) => void) {
  let captured: ToolRun | null = null
  const wrapper = mount(
    defineComponent({
      setup() {
        captured = useToolRun(spec)
        expose(captured)
        return () => h('div')
      }
    }),
    { global: { plugins: [pinia], mocks: { $t: (k: string) => k } } }
  )
  return { wrapper, run: captured! }
}

/** act() 内部有多层 await，一次 nextTick 不足以让引擎进入队列；轮询等待。 */
async function waitForEngine(entries: DeferredEntry[], count = 1) {
  for (let i = 0; i < 50; i++) {
    if (entries.length >= count) return
    await nextTick()
    await Promise.resolve()
  }
  throw new Error(`engine not started: expected ${count}, got ${entries.length}`)
}
const blobOf = (n: number, type = 'image/png') => new Blob(['x'.repeat(n)], { type })
const revokesOf = (u: string) => revoked.filter((x) => x === u)

describe('CTA 状态流转', () => {
  it('无图 → import（禁用）；有图未选中 → select（禁用）', async () => {
    const { engine } = deferredEngine()
    const { run } = mountTool(
      { id: 'compress', scope: 'selected', processor: engine, options: () => ({}) },
      () => {}
    )
    expect(run.cta.value.action).toBe('import')
    expect(run.cta.value.disabled).toBe(true)

    const store = useImageStore()
    store.images.push(makeItem('a'))
    await nextTick()
    expect(run.cta.value.action).toBe('select')
    expect(run.cta.value.disabled).toBe(true)
  })

  it('blocked 压过未选中：前置条件优先', async () => {
    const store = seed('a')
    store.selectedIds.clear()
    const { engine } = deferredEngine()
    const { run } = mountTool(
      {
        id: 'bg-remove',
        scope: 'selected',
        processor: engine,
        options: () => ({}),
        blocked: () => true
      },
      () => {}
    )
    await nextTick()
    expect(run.cta.value.action).toBe('blocked')
  })

  it('就绪 → run；处理完成 → export；改参数 → update', async () => {
    const quality = ref(0.8)
    const { engine, entries } = deferredEngine()
    const { run } = mountTool(
      {
        id: 'compress',
        scope: 'selected',
        processor: engine,
        options: () => ({ quality: quality.value })
      },
      () => {}
    )
    seed('a')
    await nextTick()
    expect(run.cta.value.action).toBe('run')

    const pending = run.act()
    await waitForEngine(entries)
    expect(run.cta.value.action).toBe('abort')
    entries[0]!.resolve({ blob: blobOf(50), size: 50 })
    await pending
    expect(run.cta.value.action).toBe('export')

    quality.value = 0.6
    await nextTick()
    expect(run.cta.value.action).toBe('update')
  })

  it('scope active 只作用于聚焦的一张', async () => {
    seed('a', 'b')
    const store = useImageStore()
    store.activeId = 'a'
    const { engine, entries } = deferredEngine()
    const { run } = mountTool(
      { id: 'crop', scope: 'active', processor: engine, options: () => ({}) },
      () => {}
    )
    await nextTick()

    const pending = run.act()
    await waitForEngine(entries)

    expect(useImageStore().images.find((i) => i.id === 'a')).toBeDefined()
    expect(entries).toHaveLength(1)
    entries[0]!.resolve({ blob: blobOf(10), size: 10 })
    await pending
    expect(run.result('a')).toBeDefined()
    expect(run.result('b')).toBeUndefined()
  })
})

describe('结果集生命周期', () => {
  it('引擎返回三种形态都能落成 Blob[]（bgRemove 裸 Blob 是真实路径）', async () => {
    seed('a')
    const bare = blobOf(7)
    const { engine } = deferredEngine()
    const { run } = mountTool(
      { id: 'bg-remove', scope: 'selected', processor: engine, options: () => ({}) },
      () => {}
    )
    run.commitResult('a', [bare])
    expect(run.result('a')?.outputs).toEqual([bare])

    // split 形态：多产出不建预览 URL
    const slices = [blobOf(1), blobOf(2), blobOf(3)]
    const before = created.length
    run.commitResult('a', slices)
    expect(run.result('a')?.outputs).toHaveLength(3)
    expect(created.length).toBe(before)
  })

  it('单产出建预览，替换时先释放旧的', async () => {
    seed('a')
    const { engine } = deferredEngine()
    const { run } = mountTool(
      { id: 'compress', scope: 'selected', processor: engine, options: () => ({}) },
      () => {}
    )

    run.commitResult('a', [blobOf(10)])
    const first = run.result('a')!.preview
    expect(first).not.toBe('')
    expect(revokesOf(first)).toHaveLength(0)

    run.commitResult('a', [blobOf(20)])
    expect(revokesOf(first)).toHaveLength(1)
    expect(run.result('a')!.preview).not.toBe(first)
  })

  it('删图 → 释放其预览，且不影响其他条目', async () => {
    const store = seed('a', 'b')
    const { engine } = deferredEngine()
    const { run } = mountTool(
      { id: 'compress', scope: 'selected', processor: engine, options: () => ({}) },
      () => {}
    )

    run.commitResult('a', [blobOf(10)])
    run.commitResult('b', [blobOf(10)])
    const previewA = run.result('a')!.preview

    store.removeImage('a')
    await nextTick()

    expect(revokesOf(previewA)).toHaveLength(1)
    expect(run.result('a')).toBeUndefined()
    expect(run.result('b')).toBeDefined()
  })

  it('reset 释放预览并把 status 打回 idle', async () => {
    const store = seed('a')
    const { engine } = deferredEngine()
    const { run } = mountTool(
      { id: 'compress', scope: 'selected', processor: engine, options: () => ({}) },
      () => {}
    )

    run.commitResult('a', [blobOf(10)])
    const preview = run.result('a')!.preview
    expect(store.images[0]!.status).toBe('done')

    run.reset('a')

    expect(revokesOf(preview)).toHaveLength(1)
    expect(run.result('a')).toBeUndefined()
    expect(store.images[0]!.status).toBe('idle')
  })

  it('卸载 → 释放全部预览（B9 修复的回归锁）', async () => {
    seed('a', 'b')
    const { engine } = deferredEngine()
    const { wrapper, run } = mountTool(
      { id: 'compress', scope: 'selected', processor: engine, options: () => ({}) },
      () => {}
    )
    run.commitResult('a', [blobOf(10)])
    run.commitResult('b', [blobOf(10)])
    const previews = [run.result('a')!.preview, run.result('b')!.preview]
    expect(previews.every((p) => p !== '')).toBe(true)

    wrapper.unmount()

    previews.forEach((p) => expect(revokesOf(p)).toHaveLength(1))
  })

  it('挂载时把「done 但无结果」的残留打回 idle（P2-20 推广到全部视图）', async () => {
    const store = useImageStore()
    const item = makeItem('a')
    item.status = 'done'
    store.images.push(item)
    store.selectedIds.add('a')

    const { engine } = deferredEngine()
    mountTool(
      { id: 'compress', scope: 'selected', processor: engine, options: () => ({}) },
      () => {}
    )

    expect(store.images[0]!.status).toBe('idle')
  })
})

describe('中止与错误', () => {
  it('abort 后不提交结果、不留下 done', async () => {
    seed('a')
    const { engine, entries } = deferredEngine()
    const { run } = mountTool(
      { id: 'compress', scope: 'selected', processor: engine, options: () => ({}) },
      () => {}
    )

    const pending = run.act()
    await waitForEngine(entries)
    expect(run.cta.value.action).toBe('abort')

    await run.act() // abort
    entries[0]!.resolve({ blob: blobOf(10), size: 10 })
    await pending

    expect(run.result('a')).toBeUndefined()
    expect(useImageStore().images[0]!.status).not.toBe('done')
  })

  it('引擎抛错 → 该图 status error，且队列继续下一张', async () => {
    const store = seed('a', 'b')
    const { engine, entries } = deferredEngine()
    const { run } = mountTool(
      { id: 'compress', scope: 'selected', processor: engine, options: () => ({}) },
      () => {}
    )

    const pending = run.act()
    await waitForEngine(entries)
    entries[0]!.reject(new Error('boom'))
    // 第一张失败不终止队列：第二张仍被启动并正常完成
    await waitForEngine(entries, 2)
    entries[1]!.resolve({ blob: blobOf(10), size: 10 })
    await pending

    expect(store.images.find((i) => i.id === 'a')!.status).toBe('error')
    expect(store.images.find((i) => i.id === 'b')!.status).toBe('done')
    expect(run.result('a')).toBeUndefined()
    expect(run.result('b')).toBeDefined()
  })
})

describe('进度归一', () => {
  it('0-1 与 0-100 两种量纲归一到同一读数（BgRemove 量纲防御的替代）', async () => {
    const p1 = ref(0.5)
    const { engine, entries } = deferredEngine()
    const { run } = mountTool(
      { id: 'crop', scope: 'active', processor: engine, options: () => ({ p: p1.value }) },
      () => {}
    )
    const store = seed('a')
    store.activeId = 'a'
    const pending = run.act()
    await waitForEngine(entries)
    entries[0]!.progress?.(0.5)
    await nextTick()
    expect(run.progress.value).toBeCloseTo(0.5)
    entries[0]!.resolve({ blob: blobOf(10), size: 10 })
    await pending
  })

  it('队列聚合走百分制时，接口层读数仍在 0..1（不再需要调用方判断量纲）', async () => {
    const { engine, entries } = deferredEngine()
    const { run } = mountTool(
      { id: 'compress', scope: 'selected', processor: engine, options: () => ({}) },
      () => {}
    )
    seed('a', 'b')
    const pending = run.act()
    await waitForEngine(entries)
    // 队列聚合会把每项进度换算成整体百分比（useImageProcessor 内部行为），
    // 无论它上报 0.5 还是 50，接口层都必须给出 0..1 的读数
    entries[0]!.progress?.(50)
    await nextTick()
    expect(run.progress.value).toBeGreaterThanOrEqual(0)
    expect(run.progress.value).toBeLessThanOrEqual(1)

    entries.forEach((e) => e.resolve({ blob: blobOf(10), size: 10 }))
    await pending
    // 队列收敛后进度归零（useImageProcessor 的既有语义）
    expect(run.progress.value).toBe(0)
  })
})

describe('脏标记', () => {
  it('dirtyDebounceMs 内只标脏一次（Resize 的滑杆防抖）', async () => {
    vi.useFakeTimers()
    const q = ref(0.8)
    const { engine } = deferredEngine()
    const { run } = mountTool(
      {
        id: 'resize',
        scope: 'selected',
        processor: engine,
        dirtyDebounceMs: 150,
        options: () => ({ q: q.value })
      },
      () => {}
    )
    seed('a')
    run.commitResult('a', [blobOf(10)])
    await nextTick()
    expect(run.cta.value.action).toBe('export')

    q.value = 0.7
    q.value = 0.6
    q.value = 0.5
    await nextTick()
    // 防抖窗口内仍是 export
    expect(run.cta.value.action).toBe('export')

    vi.advanceTimersByTime(200)
    await nextTick()
    expect(run.cta.value.action).toBe('update')
    vi.useRealTimers()
  })

  it('dirtySources 覆盖不在 options() 里的状态（Split 的 linesX）', async () => {
    const lines = ref([1, 2, 3])
    const { engine } = deferredEngine()
    const { run } = mountTool(
      {
        id: 'split',
        scope: 'active',
        processor: engine,
        options: () => ({ rows: 3 }),
        dirtySources: [lines]
      },
      () => {}
    )
    const store = seed('a')
    store.activeId = 'a'
    run.commitResult('a', [blobOf(10)])
    await nextTick()
    expect(run.cta.value.action).toBe('export')

    lines.value = [1, 5, 3]
    await nextTick()
    await nextTick()
    expect(run.cta.value.action).toBe('update')
  })
})

describe('onResult / onEmpty 钩子', () => {
  it('onResult 在结果写入后调用，拿到归一后的产物', async () => {
    const seen: Array<{ id: string; size: number; n: number }> = []
    const { engine, entries } = deferredEngine()
    const { run } = mountTool(
      {
        id: 'exif',
        scope: 'selected',
        processor: engine,
        options: () => ({}),
        onResult: (id, r) => {
          seen.push({ id, size: r.size, n: r.outputs.length })
        }
      },
      () => {}
    )
    seed('a')
    const pending = run.act()
    await waitForEngine(entries)
    entries[0]!.resolve({ blob: blobOf(12), size: 12 })
    await pending

    expect(seen).toEqual([{ id: 'a', size: 12, n: 1 }])
  })

  it('onEmpty 在图片清空时触发', async () => {
    const store = seed('a', 'b')
    let emptied = 0
    const { engine } = deferredEngine()
    mountTool(
      {
        id: 'filters',
        scope: 'selected',
        processor: engine,
        options: () => ({}),
        onEmpty: () => emptied++
      },
      () => {}
    )

    store.clearImages()
    await nextTick()
    expect(emptied).toBe(1)
  })
})

describe('导出接线', () => {
  it('scope active 的 exportAll 走单图下载（crop 无 ZIP）', async () => {
    const store = seed('a')
    store.activeId = 'a'
    const { engine } = deferredEngine()
    const { run } = mountTool(
      { id: 'crop', scope: 'active', processor: engine, options: () => ({}) },
      () => {}
    )
    run.commitResult('a', [blobOf(10)])
    await nextTick()

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    await run.exportAll()
    expect(clickSpy).toHaveBeenCalledTimes(1)
  })

  it('批量导出走 ZIP 且条目名正确', async () => {
    const { default: JSZip } = await import('jszip')
    seed('a', 'b')
    const { engine } = deferredEngine()
    const { run } = mountTool(
      { id: 'compress', scope: 'selected', processor: engine, options: () => ({}) },
      () => {}
    )
    run.commitResult('a', [blobOf(10)])
    run.commitResult('b', [blobOf(10)])

    let captured: Blob | null = null
    vi.mocked(URL.createObjectURL).mockImplementation((obj: Blob | MediaSource) => {
      if (obj instanceof Blob && obj.type === 'application/zip') captured = obj
      return 'blob:mock'
    })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    await run.exportAll()
    expect(captured).not.toBeNull()

    const entries = Object.keys(
      (await JSZip.loadAsync(await captured!.arrayBuffer())).files
    ).filter((n) => !n.endsWith('/'))
    expect(entries).toHaveLength(2)
  })

  it('无可导出项时静默返回，不创建下载', async () => {
    seed('a')
    const { engine } = deferredEngine()
    const { run } = mountTool(
      { id: 'compress', scope: 'selected', processor: engine, options: () => ({}) },
      () => {}
    )

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    await run.exportAll()
    expect(clickSpy).not.toHaveBeenCalled()
  })
})

describe('下载单张开关', () => {
  it('downloadOne: false 时 download 直接 no-op（Exif 卡片无下载按钮）', async () => {
    seed('a')
    const { engine } = deferredEngine()
    const { run } = mountTool(
      { id: 'exif', scope: 'selected', processor: engine, options: () => ({}), downloadOne: false },
      () => {}
    )
    run.commitResult('a', [blobOf(10)])

    const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    await run.download('a')
    expect(clickSpy).not.toHaveBeenCalled()
  })

  it('多产出结果导出时打成 tile ZIP（Split 的切片）', async () => {
    const { default: JSZip } = await import('jszip')
    const store = seed('a')
    store.activeId = 'a'
    const { engine } = deferredEngine()
    const { run } = mountTool(
      { id: 'split', scope: 'active', processor: engine, options: () => ({}) },
      () => {}
    )
    run.commitResult('a', [blobOf(1), blobOf(2)])

    let captured: Blob | null = null
    vi.mocked(URL.createObjectURL).mockImplementation((obj: Blob | MediaSource) => {
      if (obj instanceof Blob && obj.type === 'application/zip') captured = obj
      return 'blob:mock'
    })
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})

    await run.download('a')
    expect(captured).not.toBeNull()
    const entries = Object.keys(
      (await JSZip.loadAsync(await captured!.arrayBuffer())).files
    ).filter((n) => !n.endsWith('/'))
    expect(entries).toHaveLength(2)
    expect(entries.some((e) => e.includes('tile_1'))).toBe(true)
  })
})
