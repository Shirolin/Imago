export function toDisplay(value: number, scale: number, decimals: number): number {
  const places = Math.max(0, decimals)
  const factor = 10 ** places
  return Math.round(value * scale * factor) / factor
}

export function fromDisplay(
  raw: string,
  scale: number,
  min: number,
  max: number,
  step: number
): number {
  const parsed = Number.parseFloat(raw)
  if (!Number.isFinite(parsed) || scale === 0) return Number.NaN
  let value = parsed / scale
  value = Math.min(max, Math.max(min, value))
  if (step > 0) {
    const inv = 1 / step
    value = Math.round(value * inv) / inv
    value = Math.min(max, Math.max(min, value))
  }
  return value
}
