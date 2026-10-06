/**
 * 拆出 stem 与扩展名，供卡片把「主名 + 后缀」分两段渲染
 * （ImageCard:462-463 用 truncate 处理溢出）。
 */
export function splitFileName(name: string): { stem: string; ext: string } {
  const lastDot = name.lastIndexOf('.')
  const hasExt = lastDot > 0 && lastDot < name.length - 1
  if (!hasExt) return { stem: name, ext: '' }
  return { stem: name.slice(0, lastDot), ext: name.slice(lastDot) }
}
