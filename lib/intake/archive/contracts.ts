export interface ArchivePolicy {
  readonly compressedDownloadMaxBytes: number
  readonly extractedContentMaxBytes: number
  readonly archiveEntriesMax: number
  readonly parsedTextFileMaxBytes: number
  readonly pathMaxCharacters: number
  readonly directoryDepthMax: number
  readonly scanDurationMaxMinutes: number
}

export type FileCategory =
  | 'test'
  | 'docs'
  | 'config'
  | 'asset'
  | 'source'
  | 'other'

export interface ScanFileInventory {
  readonly relativePath: string
  readonly name: string
  readonly extension: string | null
  readonly language: string | null
  readonly category: FileCategory
  readonly sizeBytes: number
  readonly depth: number
  readonly isText: boolean
  readonly contentHash: string
}

export interface ScanStatistics {
  readonly filesDiscovered: number
  readonly textFiles: number
  readonly binaryFiles: number
  readonly totalExtractedBytes: number
  readonly oversizedTextFiles: number
  readonly languageCounts: Readonly<Record<string, number>>
  readonly categoryCounts: Readonly<Record<FileCategory, number>>
}

export interface ArchiveInventoryResult {
  readonly files: readonly ScanFileInventory[]
  readonly statistics: ScanStatistics
  readonly warnings: readonly string[]
}
