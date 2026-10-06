import { describe, it, expect } from 'vitest'
import { resolveCta } from './resolveCta'

/**
 * CTA 判定顺序本身就是行为。七个视图过去各写一份，顺序已经漂移过
 * （处理中能否中止在三处不一致；BgRemove 把「模型未就绪」放在「未选中」之前，
 * 而别的视图没有这类前置态）。这里把顺序钉死成可测的纯函数。
 */

const READY = {
  blocked: false,
  noImages: false,
  noSelection: false,
  running: false,
  allClean: false,
  anyDirty: false
}

const cta = (patch: Partial<typeof READY>, badge = '') => resolveCta({ ...READY, ...patch }, badge)

describe('resolveCta', () => {
  it('就绪态 → run，可点', () => {
    const out = cta({})
    expect(out.action).toBe('run')
    expect(out.disabled).toBe(false)
  })

  it('blocked 优先级最高，压过任何其他信号', () => {
    // 模型未就绪时即使一张图都没选，也应显示「先激活模型」而非「请选择图片」
    const out = cta({ blocked: true, noImages: true, noSelection: true })
    expect(out.action).toBe('blocked')
    expect(out.disabled).toBe(true)
  })

  it('空态与未选中是两个不同的 disabled 态', () => {
    expect(cta({ noImages: true }).action).toBe('import')
    expect(cta({ noSelection: true }).action).toBe('select')
    expect(cta({ noImages: true }).disabled).toBe(true)
    expect(cta({ noSelection: true }).disabled).toBe(true)
  })

  it('处理中 → abort；即使结果已齐也不显示导出', () => {
    const out = cta({ running: true, allClean: true })
    expect(out.action).toBe('abort')
    expect(out.disabled).toBe(false)
  })

  it('全部完成且干净 → export', () => {
    expect(cta({ allClean: true }).action).toBe('export')
  })

  it('有脏结果 → update（与 run 必须是两个不同的态）', () => {
    expect(cta({ anyDirty: true }).action).toBe('update')
  })

  it('allClean 与 anyDirty 同时为真时 export 优先', () => {
    // 这在「部分脏、部分干净」时不会同真，但状态机必须给出确定的答案
    expect(cta({ allClean: true, anyDirty: true }).action).toBe('export')
  })

  it('disabled 完全由 action 派生，不存在「处理中却可点」的组合', () => {
    const states = [
      { blocked: true },
      { noImages: true },
      { noSelection: true },
      { running: true },
      { allClean: true },
      { anyDirty: true },
      {}
    ]
    for (const patch of states) {
      const out = cta(patch)
      const shouldDisable = ['blocked', 'import', 'select'].includes(out.action)
      expect(out.disabled).toBe(shouldDisable)
    }
  })

  it('badge 原样透传，空串表示不显示', () => {
    expect(cta({}, '(3)').badge).toBe('(3)')
    expect(cta({}, '').badge).toBe('')
  })
})
