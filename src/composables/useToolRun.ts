import { computed, isRef, onUnmounted, ref, watch, type ComputedRef, type Ref } from 'vue'
import { useImageStore, type ImageItem } from '../stores/imageStore'
import { useImageProcessor } from './useImageProcessor'
import { useFileHelpers, type ZipResultItem } from './useFileHelpers'
import type { ImageProcessor } from '../lib/engines/types'
import { normalizeEngineOutput, normalizeProgress } from '../lib/toolRun/normalize'
import { resolveCta, type CtaAction } from '../lib/toolRun/resolveCta'

/**
 * 一个工具视图的完整「处理 → 结果 → 导出」生命周期。
 *
 * 视图只声明两件事：引擎是什么、参数长什么样。其余全部收在这里——
 * 结果容器、预览 URL 的所有权、脏标记、CTA 判定、ZIP 组装、卸载清理。
 * 这些逻辑过去在七个视图里各有一份近乎逐行的副本（合计约 989 行，零测试覆盖）。
 */

export type RunScope = 'selected' | 'active'

export interface ResultMeta {
  /** 压缩未减小、保留原图 */
  skipped?: boolean
  width?: number
  height?: number
}

export interface ToolResult {
  readonly id: string
  /** 恒为长度 >= 1。单图结果长度 1，切图结果长度 N */
  readonly outputs: readonly Blob[]
  /** === outputs[0]，供对比弹窗与单图下载使用 */
  readonly primary: Blob
  /** 仅 outputs.length === 1 时非空。生命周期由本 module 独占 */
  readonly preview: string
  readonly size: number
  readonly dirty: boolean
  readonly meta: ResultMeta
}

export interface ToolSpec<O extends object> {
  /** 工具 id，同时是导出后缀词条的键（useFileHelpers.SUFFIX_MAP） */
  id: string
  scope: RunScope
  /**
   * 引擎。BgRemove 需要按 engineMode 在 match/pro 间切换时用 resolveEngine。
   *
   * 不要用 typeof 区分二者：ImageProcessor 本身就是函数，typeof 恒为 'function'，
   * 会把裸引擎误当工厂调用并拿到 undefined。
   */
  processor?: ImageProcessor<O>
  /** 需要按响应式状态切换引擎时用这个（与 processor 二选一） */
  resolveEngine?: () => ImageProcessor<O> | undefined
  /** 视图 ref → 引擎选项。module 深 watch 它以标记脏结果 */
  options: () => O
  /**
   * 额外参与脏标记的响应式源。用于不在 options() 返回值里的状态——
   * Split 的分割线数组（SplitView:719 的 watch 曾漏掉 linesX/linesY，
   * 导致自定义模式拖线不标脏、导出旧切片）。
   */
  dirtySources?: unknown[]
  /** 脏标记防抖毫秒。Resize 的滑杆需要 150ms */
  dirtyDebounceMs?: number
  /** 前置条件不满足时 CTA 进入 blocked，act() 永不调引擎 */
  blocked?: () => boolean
  /** 结果写入后的副作用。status 由 module 独占，这里只做领域数据回填 */
  onResult?: (id: string, result: ToolResult) => void | Promise<void>
  /** 图片列表清空后的领域复位（预设参数、历史、线集合…） */
  onEmpty?: () => void
  /** 处理中 CTA 是否可中止。默认 true；历史上有三处不一致 */
  abortWhileBusy?: boolean
  /** 单张卡片是否提供下载按钮 */
  downloadOne?: boolean
}

export interface ToolRun {
  readonly isRunning: Ref<boolean>
  /** 已归一到 0..1（与引擎上报的量纲无关） */
  readonly progress: ComputedRef<number>
  readonly cta: Ref<{
    action: CtaAction
    disabled: boolean
    badge: string
  }>
  /** 读一条结果。故意不暴露 Map：调用方无法写入、无法持有过期引用 */
  result(id: string): ToolResult | undefined
  /** 释放预览并把图片打回未处理。省略 id = 全部 */
  reset(id?: string): void
  /** CTA 的唯一入口。返回本次写入结果的图片 id 列表 */
  act(): Promise<string[]>
  /** 带外提交一条结果（交互式去背景的合成产物，未经引擎） */
  commitResult(id: string, outputs: Blob[], meta?: ResultMeta): void
  download(id: string): Promise<void>
  exportAll(): Promise<void>
}

interface InternalRecord extends ToolResult {
  /** dirty 会就地变更，不走 reactive 的 readonly 视图 */
  dirty: boolean
}

export function useToolRun<O extends object>(spec: ToolSpec<O>): ToolRun {
  if (!spec.processor && !spec.resolveEngine) {
    throw new Error(`useToolRun("${spec.id}"): 需要 processor 或 resolveEngine 之一`)
  }

  const store = useImageStore()
  const { downloadImage, downloadAllAsZip } = useFileHelpers()

  const records = new Map<string, InternalRecord>()
  /** 响应式版本号：Map 的增删本身不触发 computed，靠它通知 */
  const revision = ref(0)

  const resolveProcessor = (): ImageProcessor<O> | undefined =>
    spec.resolveEngine ? spec.resolveEngine() : spec.processor

  /**
   * 引擎 trampoline：让 useImageProcessor 始终只看到同一个函数。
   * 这样 BgRemove 的 match/pro 双实例塌成一次查表，isProcessing 与 abort 都只有一个。
   */
  const trampoline: ImageProcessor<O> = (file, options) => {
    const engine = resolveProcessor()
    if (!engine) {
      return Promise.reject(new Error(`useToolRun: no engine for tool "${spec.id}"`))
    }
    return engine(file, options)
  }

  const processor = useImageProcessor<O>(trampoline)

  /** scope 解析出的目标集合。所有下游行为都从这一份派生 */
  const targets = computed<ImageItem[]>(() => {
    const all = store.images
    if (spec.scope === 'active') {
      const active = all.find((img) => img.id === store.activeId)
      return active ? [active] : []
    }
    return all.filter((img) => store.selectedIds.has(img.id))
  })

  const releasePreview = (record: InternalRecord) => {
    if (record.preview) URL.revokeObjectURL(record.preview)
  }

  const writeResult = (
    id: string,
    outputs: Blob[],
    size: number,
    meta: ResultMeta,
    dirty: boolean
  ): ToolResult | null => {
    if (outputs.length === 0) return null
    const existing = records.get(id)
    if (existing) releasePreview(existing)

    const record: InternalRecord = {
      id,
      outputs,
      primary: outputs[0]!,
      // 多产出不建预览：切图结果没有单一代表图，建了也只是浪费一条 URL
      preview: outputs.length === 1 ? URL.createObjectURL(outputs[0]!) : '',
      size,
      dirty,
      meta
    }
    records.set(id, record)
    revision.value++
    return record
  }

  const markAllDirty = () => {
    let changed = false
    records.forEach((record) => {
      if (!record.dirty) {
        record.dirty = true
        changed = true
      }
    })
    if (changed) revision.value++
  }

  const resetOne = (id: string) => {
    const record = records.get(id)
    if (record) {
      releasePreview(record)
      records.delete(id)
    }
    const item = store.images.find((img) => img.id === id)
    if (item && item.status !== 'idle') {
      store.updateImage(id, { status: 'idle', error: undefined, progress: 0 })
    }
  }

  const reset = (id?: string) => {
    // 重置期间产出的结果一律丢弃，先中止正在跑的队列
    processor.abortProcessing()
    if (id === undefined) {
      const ids = Array.from(records.keys())
      ids.forEach(resetOne)
      // 没有结果记录、但状态卡在 processing/done 的图片也要复位
      store.images.forEach((img) => {
        if (img.status !== 'idle') resetOne(img.id)
      })
    } else {
      resetOne(id)
    }
    revision.value++
  }

  const result = (id: string): ToolResult | undefined => {
    void revision.value
    return records.get(id)
  }

  // ── 脏标记 ────────────────────────────────────────────────────────
  // untrack：options() 会读十个 ref，若让 watch 追踪它，这些 ref 就成了
  // module 内部 computed 的依赖，CTA 文案会随滑杆抖动。
  let dirtyTimer: ReturnType<typeof setTimeout> | null = null
  const scheduleDirty = () => {
    if (dirtyTimer) clearTimeout(dirtyTimer)
    const delay = spec.dirtyDebounceMs ?? 0
    if (delay <= 0) {
      markAllDirty()
      return
    }
    dirtyTimer = setTimeout(markAllDirty, delay)
  }

  /**
   * 脏标记的触发源：options() 的序列化快照 + 显式声明的额外响应式源。
   *
   * 用 JSON 快照而非引用比较，是因为 Split 的 options() 每次调用都会新建
   * customLines 数组，按引用比较会永久判定为「已变脏」。JSON.stringify
   * 在读取过程中会把这些 ref 登记为 watch 的依赖，因此不需要额外的 untrack
   * （Vue 的 untrack 与 pauseTracking 均未从 vue 根导出，不依赖内部 API）。
   */
  const optionsFingerprint = () => {
    try {
      return JSON.stringify(spec.options())
    } catch {
      // 循环引用等异常不应让整个工具失效，退化为只看显式源
      return ''
    }
  }

  const stopDirtyWatch = watch(
    () => [
      optionsFingerprint(),
      // 显式解包 ref：JSON.stringify 不会自动读 ref 的 .value，直接 stringify
      // 得到的是内部实现字段且不建立依赖，watch 永远不会触发
      ...(spec.dirtySources ?? []).map((s) => {
        const raw = isRef(s) ? s.value : s
        try {
          return JSON.stringify(raw)
        } catch {
          return ''
        }
      })
    ],
    scheduleDirty,
    { deep: true }
  )

  // ── CTA ───────────────────────────────────────────────────────────
  const anyDirty = computed(() => {
    void revision.value
    const ids = new Set(targets.value.map((img) => img.id))
    return Array.from(records.values()).some((r) => r.dirty && ids.has(r.id))
  })

  const allClean = computed(() => {
    void revision.value
    const list = targets.value
    if (list.length === 0) return false
    return list.every((img) => {
      const record = records.get(img.id)
      return img.status === 'done' && !!record && !record.dirty
    })
  })

  const badge = computed(() => {
    const total = targets.value.length
    if (processor.isProcessing.value) {
      const done = targets.value.filter((img) => img.status === 'done').length
      const pct = Math.round(normalizeProgress(processor.progress.value) * 100)
      // 队列刚起、进度还是 0 时不显示 0%，避免闪烁
      return pct > 0 ? `(${done}/${total} · ${pct}%)` : `(${done}/${total})`
    }
    return total > 0 ? `(${total})` : ''
  })

  const cta = computed(() =>
    resolveCta(
      {
        blocked: spec.blocked ? spec.blocked() : false,
        noImages: store.images.length === 0,
        noSelection: targets.value.length === 0,
        running: processor.isProcessing.value,
        allClean: allClean.value,
        anyDirty: anyDirty.value
      },
      badge.value
    )
  )

  // ── 处理 ──────────────────────────────────────────────────────────
  const act = async (): Promise<string[]> => {
    const current = cta.value.action

    if (current === 'abort') {
      processor.abortProcessing()
      return []
    }
    if (current === 'blocked' || current === 'import' || current === 'select') {
      return []
    }
    if (current === 'export') {
      await exportAll()
      return []
    }

    // 就绪 / 有脏：发起处理。作用域为空时不启动队列。
    const list = targets.value
    if (list.length === 0) return []
    if (spec.blocked?.()) return []

    const options = spec.options()
    const written: string[] = []

    const onResult = (id: string, raw: unknown) => {
      const normalized = normalizeEngineOutput(raw)
      if (!normalized) return
      const record = writeResult(
        id,
        normalized.outputs,
        normalized.size,
        {
          skipped: normalized.skipped,
          width: normalized.width,
          height: normalized.height
        },
        false
      )
      if (!record) return
      written.push(id)
      void spec.onResult?.(id, record)
    }

    if (spec.scope === 'active') {
      const only = list[0]!
      const resultValue = await processor.processSingle(
        only.id,
        options as O & Record<string, unknown>
      )
      onResult(only.id, resultValue)
    } else {
      await processor.processSelected(options as O & Record<string, unknown>, (id, value) =>
        onResult(id, value)
      )
    }

    return written
  }

  // ── 导出 ──────────────────────────────────────────────────────────
  const download = async (id: string) => {
    if (spec.downloadOne === false) return
    const record = records.get(id)
    const item = store.images.find((img) => img.id === id)
    if (!record || !item) return
    // 多产出（切图）时 useFileHelpers 内部会打成 _tile_N.zip
    await downloadImage(
      record.outputs.length === 1 ? record.primary : (record.outputs as Blob[]),
      item.file.name,
      spec.id
    )
  }

  const exportAll = async () => {
    if (spec.scope === 'active') {
      const only = targets.value[0]
      if (only) await download(only.id)
      return
    }

    const zipItems = store.images
      .filter((img) => store.selectedIds.has(img.id))
      .map((img) => {
        const record = records.get(img.id)
        return {
          file: img.file,
          processedBlob: record && record.outputs.length === 1 ? record.primary : undefined,
          processedBlobs: record && record.outputs.length > 1 ? [...record.outputs] : undefined,
          status: img.status
        }
      })
      .filter(
        (r) => r.status === 'done' && (r.processedBlob || r.processedBlobs)
      ) as ZipResultItem[]

    if (zipItems.length === 0) return
    await downloadAllAsZip(spec.id, zipItems)
  }

  const commitResult = (id: string, outputs: Blob[], meta: ResultMeta = {}) => {
    if (outputs.length === 0) return
    const size = outputs.reduce((sum, b) => sum + b.size, 0)
    const record = writeResult(id, outputs, size, meta, false)
    if (!record) return
    store.updateImage(id, { status: 'done', progress: 1, error: undefined })
    void spec.onResult?.(id, record)
  }

  // ── 生命周期 ──────────────────────────────────────────────────────
  // 删图联动：结果集不得出现 store 之外的孤儿键
  const stopImageWatch = watch(
    () => store.images.map((img) => img.id),
    (ids) => {
      const alive = new Set(ids)
      let changed = false
      records.forEach((record, id) => {
        if (!alive.has(id)) {
          releasePreview(record)
          records.delete(id)
          changed = true
        }
      })
      if (changed) revision.value++
    }
  )

  // 图片列表清空 → 领域复位
  const stopEmptyWatch = watch(
    () => store.images.length,
    (len, prev) => {
      if (prev > 0 && len === 0) spec.onEmpty?.()
    }
  )

  // 挂载时把「done 但无结果」的残留打回 idle（BgRemoveView:71-77 此前只做它自己）
  store.images.forEach((img) => {
    if (img.status === 'done' && !records.has(img.id)) {
      store.updateImage(img.id, { status: 'idle', progress: 0 })
    }
  })

  const dispose = () => {
    if (dirtyTimer) {
      clearTimeout(dirtyTimer)
      dirtyTimer = null
    }
    stopDirtyWatch()
    stopImageWatch()
    stopEmptyWatch()
  }

  onUnmounted(() => {
    // 顺序固定：先中止队列（可能让 promise 结算并尝试写回），再回收预览
    processor.abortProcessing()
    records.forEach(releasePreview)
    records.clear()
    dispose()
  })

  return {
    isRunning: processor.isProcessing,
    // useImageProcessor 的两条路径量纲不同（单图 0-1、队列 0-100），
    // 这里统一归一到 0..1，调用方不必再做量纲判断
    progress: computed(() => normalizeProgress(processor.progress.value)),
    cta,
    result,
    reset,
    act,
    commitResult,
    download,
    exportAll
  }
}
