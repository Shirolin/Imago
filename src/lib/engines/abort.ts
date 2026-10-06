/**
 * 任务中止的单一语义。
 *
 * 此前 8 个引擎有三种中止写法并存：
 *   - 匿名 abort 监听器（crop / filter）：从不 removeEventListener，
 *     每次处理泄漏一个监听器，且闭包捕获整个 promise 作用域
 *   - 具名监听器 + { once: true }（bgRemove / matchBgRemove）
 *   - 轮询 signal.aborted（combine / split / resize）
 * 错误文案也三套：'AbortError' / 'Task aborted' / 'AbortError'。
 *
 * 上层因此只能靠字符串匹配识别中止（useImageProcessor 的
 * err.message?.includes('abort')）—— 换个人写错一个字，
 * 中止就会被当成真实失败报给用户。
 *
 * 这里给出唯一形态：一个具名错误类型 + 判定函数。身份靠 instanceof，
 * 不靠字符串。文案集中在此，其它地方不再各写各的。
 */

/** 中止错误。名字固定为 AbortError，与 DOMException 里的同类对齐 */
export class AbortError extends Error {
  override readonly name = 'AbortError'

  constructor(message = 'Task aborted') {
    super(message)
  }
}

/**
 * 判定一个错误是否为中止。
 *
 * 覆盖三类来源：AbortError 实例、DOMException（浏览器原生 abort()）、
 * 以及历史上散落各处的字符串写法（仍在跑的老路径会抛这些）。
 * 字符串分支是过渡兼容，不应新增——新代码一律 throw new AbortError()。
 */
export function isAbortError(error: unknown): boolean {
  if (error instanceof AbortError) return true
  // DOMException.name 是只读属性，跨 realm 比较用字符串
  if (typeof error === 'object' && error !== null) {
    const name = (error as { name?: unknown }).name
    if (name === 'AbortError') return true
  }
  const message = error instanceof Error ? error.message : typeof error === 'string' ? error : ''
  return typeof message === 'string' && message.toLowerCase().includes('abort')
}

/**
 * 在 signal 上挂一个一次性中止回调，返回解绑函数。
 *
 * 与直接 addEventListener 的区别有三：
 *   1. signal 已经 aborted 时立即回调（补上 addEventListener 的盲区：
 *      已中止的 signal 不会再触发事件，裸监听器会永远等下去）
 *   2. 自动 { once: true }，且解绑幂等
 *   3. 强制传 AbortError，别再各写各的文案
 */
export function onAbort(signal: AbortSignal | undefined, handler: () => void): () => void {
  if (!signal) return () => {}

  if (signal.aborted) {
    handler()
    return () => {}
  }

  const listener = (): void => {
    handler()
  }
  signal.addEventListener('abort', listener, { once: true })

  let released = false
  return () => {
    if (released) return
    released = true
    signal.removeEventListener('abort', listener)
  }
}

/**
 * 在长循环里插入中止检查点。
 * combine / split / resize 原先各自轮询 signal.aborted，
 * 换成了各自的判断点与文案；这里统一为抛 AbortError。
 */
export function throwIfAborted(signal: AbortSignal | undefined): void {
  if (signal?.aborted) throw new AbortError()
}
