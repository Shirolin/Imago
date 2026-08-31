const ELLIPSIS = '…'

export function splitFileName(name: string): { stem: string; ext: string } {
  const lastDot = name.lastIndexOf('.')
  const hasExt = lastDot > 0 && lastDot < name.length - 1
  if (!hasExt) return { stem: name, ext: '' }
  return { stem: name.slice(0, lastDot), ext: name.slice(lastDot) }
}

export function ellipsisFileName(name: string, max: number): string {
  const chars = Array.from(name)
  if (max <= 0) return ''
  if (chars.length <= max) return name

  const lastDot = name.lastIndexOf('.')
  const hasExt = lastDot > 0 && lastDot < name.length - 1
  const ext = hasExt ? name.slice(lastDot) : ''
  const stem = hasExt ? name.slice(0, lastDot) : name
  const extChars = Array.from(ext)
  const stemChars = Array.from(stem)

  const budget = max - extChars.length
  if (budget < 1) return ELLIPSIS + ext
  if (stemChars.length <= budget) return name

  const inner = budget - ELLIPSIS.length
  if (inner <= 0) return ELLIPSIS + ext

  const frontLen = Math.ceil(inner / 2)
  const backLen = Math.floor(inner / 2)
  const front = stemChars.slice(0, frontLen).join('')
  const back = backLen > 0 ? stemChars.slice(-backLen).join('') : ''
  return front + ELLIPSIS + back + ext
}
