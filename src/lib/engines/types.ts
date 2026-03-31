export interface ProcessResult {
  blob?: Blob
  blobs?: Blob[] // 用于分割功能
  size: number
  width?: number
  height?: number
  format?: string
}

export interface ProcessingOptions {
  signal?: AbortSignal
  onProgress?: (progress: number) => void // 0 to 1
  [key: string]: unknown
}

export interface SplitOptions {
  rows: number
  cols: number
  mode: 'grid' | 'custom'
  customLines?: { x: number[]; y: number[] }
  centerMode?: 'none' | 'center' | 'square'
  shave?: number
  format?: string
  quality?: number
}

export type ImageProcessor<T = unknown> = (
  file: File,
  options: T & ProcessingOptions
) => Promise<ProcessResult>

export type MultiImageProcessor<T = unknown> = (
  files: File[],
  options: T & ProcessingOptions
) => Promise<ProcessResult>
