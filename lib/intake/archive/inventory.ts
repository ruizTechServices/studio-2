import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import type { Readable } from 'node:stream'
import { createGunzip } from 'node:zlib'

import { extract, type Headers } from 'tar-stream'

import {
  getCategory,
  getExtension,
  getLanguage,
} from '@/lib/intake/archive/classification'
import type {
  ArchiveInventoryResult,
  ArchivePolicy,
  FileCategory,
  ScanFileInventory,
} from '@/lib/intake/archive/contracts'
import { WorkerFailure } from '@/lib/intake/worker/failures'

const SAMPLE_BYTES = 8 * 1024
const DRIVE_PATH = /^[A-Za-z]:/

function unsafeArchive(message: string): WorkerFailure {
  return new WorkerFailure('unsafe_archive', message, false)
}

function parsePath(
  name: string,
  root: string | null,
  policy: ArchivePolicy
): { root: string; relativePath: string; segments: readonly string[] } {
  if (
    name.includes('\0') ||
    name.includes('\\') ||
    name.startsWith('/') ||
    name.startsWith('//') ||
    DRIVE_PATH.test(name)
  ) {
    throw unsafeArchive('Repository archive contains an unsafe path.')
  }

  const trimmed = name.endsWith('/') ? name.slice(0, -1) : name
  const segments = trimmed.split('/')
  if (
    segments.length === 0 ||
    segments.some((segment) => segment === '' || segment === '.' || segment === '..')
  ) {
    throw unsafeArchive('Repository archive contains an unsafe path.')
  }

  const nextRoot = root ?? segments[0]
  if (segments[0] !== nextRoot) {
    throw unsafeArchive('Repository archive contains inconsistent roots.')
  }

  const relativeSegments = segments.slice(1)
  const relativePath = relativeSegments.join('/')
  if (
    relativePath.length > policy.pathMaxCharacters ||
    relativeSegments.length > policy.directoryDepthMax
  ) {
    throw new WorkerFailure(
      'archive_path_limit_exceeded',
      'Repository archive exceeds a path safety limit.',
      false
    )
  }

  return { root: nextRoot, relativePath, segments: relativeSegments }
}

function detectText(sample: Buffer, size: number): boolean {
  if (size === 0) return true
  if (sample.includes(0)) return false
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(sample)
    return true
  } catch {
    return false
  }
}

function processFileEntry(
  stream: Readable,
  header: Headers,
  relativePath: string,
  segments: readonly string[],
  policy: ArchivePolicy,
  getTotalBytes: () => number,
  addTotalBytes: (bytes: number) => void
): Promise<ScanFileInventory> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const samples: Buffer[] = []
    let sampleLength = 0
    let size = 0

    stream.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (getTotalBytes() + size > policy.extractedContentMaxBytes) {
        stream.destroy(
          new WorkerFailure(
            'extracted_content_limit_exceeded',
            'Repository archive exceeds the extracted content limit.',
            false
          )
        )
        return
      }
      hash.update(chunk)
      if (sampleLength < SAMPLE_BYTES) {
        const sample = chunk.subarray(0, SAMPLE_BYTES - sampleLength)
        samples.push(sample)
        sampleLength += sample.length
      }
    })
    stream.once('error', reject)
    stream.once('end', () => {
      if (header.size !== undefined && header.size !== size) {
        reject(unsafeArchive('Repository archive contains a malformed file entry.'))
        return
      }
      addTotalBytes(size)
      const name = segments.at(-1)
      if (!name) {
        reject(unsafeArchive('Repository archive contains a malformed file entry.'))
        return
      }
      const extension = getExtension(name)
      const language = getLanguage(extension)
      resolve({
        relativePath,
        name,
        extension,
        language,
        category: getCategory(relativePath, name, extension, language),
        sizeBytes: size,
        depth: segments.length,
        isText: detectText(Buffer.concat(samples), size),
        contentHash: hash.digest('hex'),
      })
    })
  })
}

export async function inventoryArchive(
  archivePath: string,
  policy: ArchivePolicy,
  signal: AbortSignal
): Promise<ArchiveInventoryResult> {
  const parser = extract()
  const gunzip = createGunzip()
  const input = createReadStream(archivePath)
  const files: ScanFileInventory[] = []
  const seen = new Set<string>()
  let root: string | null = null
  let entries = 0
  let totalBytes = 0
  let processing = Promise.resolve()

  const abort = () => {
    const error = signal.reason instanceof Error ? signal.reason : new Error('Aborted')
    input.destroy(error)
    gunzip.destroy(error)
    parser.destroy(error)
  }
  signal.addEventListener('abort', abort, { once: true })

  parser.on('entry', (header, stream, next) => {
    processing = processing
      .then(async () => {
        entries += 1
        if (entries > policy.archiveEntriesMax) {
          throw new WorkerFailure(
            'archive_entry_limit_exceeded',
            'Repository archive exceeds the entry limit.',
            false
          )
        }
        if (header.type !== 'file' && header.type !== 'directory') {
          throw unsafeArchive('Repository archive contains an unsupported entry type.')
        }

        const parsed = parsePath(header.name, root, policy)
        root = parsed.root
        if (parsed.relativePath === '') {
          if (header.type !== 'directory') {
            throw unsafeArchive('Repository archive root is malformed.')
          }
          stream.resume()
          return
        }
        if (seen.has(parsed.relativePath)) {
          throw unsafeArchive('Repository archive contains duplicate paths.')
        }
        seen.add(parsed.relativePath)

        if (header.type === 'directory') {
          stream.resume()
          return
        }
        files.push(
          await processFileEntry(
            stream,
            header,
            parsed.relativePath,
            parsed.segments,
            policy,
            () => totalBytes,
            (bytes) => {
              totalBytes += bytes
            }
          )
        )
      })
      .then(() => next())
      .catch((error: unknown) => {
        parser.destroy(error as Error)
      })
  })

  try {
    await new Promise<void>((resolve, reject) => {
      input.once('error', reject)
      gunzip.once('error', () =>
        reject(new WorkerFailure('malformed_archive', 'Repository archive is malformed.', false))
      )
      parser.once('error', reject)
      parser.once('finish', resolve)
      input.pipe(gunzip).pipe(parser)
    })
    await processing
  } catch (error) {
    input.destroy()
    gunzip.destroy()
    parser.destroy()
    throw error
  } finally {
    signal.removeEventListener('abort', abort)
  }

  if (!root) {
    throw unsafeArchive('Repository archive root is missing.')
  }

  const languageCounts: Record<string, number> = {}
  const categoryCounts: Record<FileCategory, number> = {
    test: 0,
    docs: 0,
    config: 0,
    asset: 0,
    source: 0,
    other: 0,
  }
  let textFiles = 0
  let oversizedTextFiles = 0
  for (const file of files) {
    categoryCounts[file.category] += 1
    if (file.language) languageCounts[file.language] = (languageCounts[file.language] ?? 0) + 1
    if (file.isText) {
      textFiles += 1
      if (file.sizeBytes > policy.parsedTextFileMaxBytes) oversizedTextFiles += 1
    }
  }

  return {
    files,
    statistics: {
      filesDiscovered: files.length,
      textFiles,
      binaryFiles: files.length - textFiles,
      totalExtractedBytes: totalBytes,
      oversizedTextFiles,
      languageCounts,
      categoryCounts,
    },
    warnings:
      oversizedTextFiles > 0
        ? ['Some text files exceed the parsing size limit and were inventoried only.']
        : [],
  }
}
