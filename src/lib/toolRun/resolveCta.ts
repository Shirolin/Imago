/**
 * CTA 决策树：实现内唯一的顺序真源。
 *
 * 七个视图过去各写一份 ctaState，判定顺序略有漂移（处理中能否中止在三处不一致、
 * BgRemove 把模型未就绪放在未选中之前而别的视图没有这类态）。顺序本身就是行为，
 * 所以它必须是可单测的纯函数，而不是散在 computed 里的一串 if。
 *
 * 判定顺序固定，任何工具都不得重排：
 *   blocked > 空态 > 未选中 > 处理中 > 全部完成 > 有脏 > 就绪
 */

export type CtaAction = 'blocked' | 'import' | 'select' | 'abort' | 'export' | 'update' | 'run'

export interface CtaInput {
  /** 前置条件未满足（裁剪越界 / 切片零宽 / 模型未就绪）。永不走引擎。 */
  blocked: boolean
  /** store 里一张图都没有 */
  noImages: boolean
  /** scope 解析出 0 张 */
  noSelection: boolean
  running: boolean
  /** 范围内每张都有非脏结果且 status === 'done' */
  allClean: boolean
  /** 范围内至少一条脏结果 */
  anyDirty: boolean
}

export interface CtaOutcome {
  action: CtaAction
  /** 派生字段：恒等于 action 不属于 disabled 集合，杜绝「处理中却可点」这类漂移 */
  disabled: boolean
  /** CTA 附加的计数/百分比尾巴，空串表示不显示 */
  badge: string
}

/** 这些状态下按钮不可点：没图、没选中、被前置条件挡住。 */
const DISABLED_ACTIONS: ReadonlySet<CtaAction> = new Set<CtaAction>(['blocked', 'import', 'select'])

export function resolveCta(input: CtaInput, badge: string): CtaOutcome {
  let action: CtaAction

  if (input.blocked) {
    action = 'blocked'
  } else if (input.noImages) {
    action = 'import'
  } else if (input.noSelection) {
    action = 'select'
  } else if (input.running) {
    action = 'abort'
  } else if (input.allClean) {
    action = 'export'
  } else if (input.anyDirty) {
    action = 'update'
  } else {
    action = 'run'
  }

  return {
    action,
    disabled: DISABLED_ACTIONS.has(action),
    // 处理中与就绪态展示计数；导出态也要（"(3)" 是用户预期的一部分）
    badge
  }
}
