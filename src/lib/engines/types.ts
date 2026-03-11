export interface ProcessResult {
  blob?: Blob
  blobs?: Blob[] // 用于分割功能
  size: number
  width?: number
  height?: number
}

export interface ProcessingOptions {
  signal?: AbortSignal
  [key: string]: unknown
}

export type ImageProcessor<T = unknown> = (
  file: File,
  options: T & ProcessingOptions
) => Promise<ProcessResult>

export type MultiImageProcessor<T = unknown> = (
  files: File[],
  options: T & ProcessingOptions
) => Promise<ProcessResult>
