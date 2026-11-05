/**
 * 构建标识：版本 + 提交 + 构建时间，由 vite.config.ts 的 define 注入。
 * 排查线上问题时先看侧栏底部，能直接对应到具体提交。
 */
declare const __BUILD_INFO__: {
  version: string
  commit: string
  date: string
}

const info = __BUILD_INFO__

export const buildInfo = {
  /** 生产 v0.0.0+abc1234；本地 dev+abc1234 */
  label: `${import.meta.env.DEV ? 'dev' : `v${info.version}`}+${info.commit}`,
  /** hover 展示完整构建时间 */
  title: `${info.commit} · ${info.date}`
}
