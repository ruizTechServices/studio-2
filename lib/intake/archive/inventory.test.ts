import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { gzipSync } from 'node:zlib'

import { pack, type Headers } from 'tar-stream'
import { afterEach, describe, expect, it } from 'vitest'

import { inventoryArchive } from '@/lib/intake/archive/inventory'
import { INTAKE_RESOURCE_LIMITS } from '@/lib/intake/policy'

const directories: string[] = []
const policy = {
  compressedDownloadMaxBytes: INTAKE_RESOURCE_LIMITS.compressedDownloadMaxBytes,
  extractedContentMaxBytes: INTAKE_RESOURCE_LIMITS.extractedContentMaxBytes,
  archiveEntriesMax: INTAKE_RESOURCE_LIMITS.archiveEntriesMax,
  parsedTextFileMaxBytes: INTAKE_RESOURCE_LIMITS.parsedTextFileMaxBytes,
  pathMaxCharacters: INTAKE_RESOURCE_LIMITS.pathMaxCharacters,
  directoryDepthMax: INTAKE_RESOURCE_LIMITS.directoryDepthMax,
  scanDurationMaxMinutes: INTAKE_RESOURCE_LIMITS.scanDurationMaxMinutes,
}

async function archive(
  entries: readonly { header: Headers; content?: string | Buffer }[]
): Promise<string> {
  const stream = pack()
  const chunks: Buffer[] = []
  stream.on('data', (chunk: Buffer) => chunks.push(chunk))
  for (const entry of entries) {
    stream.entry(entry.header, entry.content ?? '')
  }
  stream.finalize()
  await new Promise<void>((resolve, reject) => {
    stream.once('end', resolve)
    stream.once('error', reject)
  })
  const directory = await mkdtemp(join(tmpdir(), 'studio-2-test-'))
  directories.push(directory)
  const path = join(directory, 'archive.tar.gz')
  await writeFile(path, gzipSync(Buffer.concat(chunks)))
  return path
}

afterEach(async () => {
  await Promise.all(
    directories.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true })
    )
  )
})

describe('inventoryArchive', () => {
  it('streams a metadata-only inventory with hashes and classifications', async () => {
    const path = await archive([
      { header: { name: 'repo-sha/', type: 'directory' } },
      { header: { name: 'repo-sha/src/index.ts' }, content: 'export const value = 1\n' },
      { header: { name: 'repo-sha/public/logo.png' }, content: Buffer.from([0, 1, 2]) },
    ])

    const result = await inventoryArchive(path, policy, new AbortController().signal)

    expect(result.statistics).toMatchObject({
      filesDiscovered: 2,
      textFiles: 1,
      binaryFiles: 1,
      languageCounts: { TypeScript: 1 },
      categoryCounts: { source: 1, asset: 1 },
    })
    expect(result.files[0]).toMatchObject({
      relativePath: 'src/index.ts',
      name: 'index.ts',
      extension: 'ts',
      language: 'TypeScript',
      category: 'source',
      depth: 2,
      isText: true,
    })
    expect(result.files[0].contentHash).toMatch(/^[0-9a-f]{64}$/)
  })

  it.each([
    ['path traversal', 'repo-sha/../secret'],
    ['absolute path', '/etc/passwd'],
    ['Windows path', 'C:/Users/secret'],
    ['backslash path', 'repo-sha\\secret'],
    ['dot segment', 'repo-sha/./secret'],
  ])('rejects %s entries', async (_label, name) => {
    const path = await archive([{ header: { name }, content: 'secret' }])
    await expect(
      inventoryArchive(path, policy, new AbortController().signal)
    ).rejects.toMatchObject({ code: 'unsafe_archive' })
  })

  it('rejects links and duplicate paths', async () => {
    const link = await archive([
      { header: { name: 'repo-sha/link', type: 'symlink', linkname: 'target' } },
    ])
    await expect(
      inventoryArchive(link, policy, new AbortController().signal)
    ).rejects.toMatchObject({ code: 'unsafe_archive' })

    const duplicate = await archive([
      { header: { name: 'repo-sha/file.txt' }, content: 'one' },
      { header: { name: 'repo-sha/file.txt' }, content: 'two' },
    ])
    await expect(
      inventoryArchive(duplicate, policy, new AbortController().signal)
    ).rejects.toMatchObject({ code: 'unsafe_archive' })
  })

  it.each(['link', 'block-device', 'character-device', 'fifo'] as const)(
    'rejects unsupported %s entries',
    async (type) => {
      const path = await archive([
        { header: { name: 'repo-sha/unsafe', type, linkname: 'target' } },
      ])
      await expect(
        inventoryArchive(path, policy, new AbortController().signal)
      ).rejects.toMatchObject({ code: 'unsafe_archive' })
    }
  )

  it('rejects inconsistent roots and extracted content over the limit', async () => {
    const roots = await archive([
      { header: { name: 'first/file.txt' }, content: 'one' },
      { header: { name: 'second/file.txt' }, content: 'two' },
    ])
    await expect(
      inventoryArchive(roots, policy, new AbortController().signal)
    ).rejects.toMatchObject({ code: 'unsafe_archive' })

    const oversized = await archive([
      { header: { name: 'repo-sha/file.txt' }, content: '1234' },
    ])
    await expect(
      inventoryArchive(
        oversized,
        { ...policy, extractedContentMaxBytes: 3 },
        new AbortController().signal
      )
    ).rejects.toMatchObject({ code: 'extracted_content_limit_exceeded' })
  })

  it('adds one aggregate warning for oversized text files', async () => {
    const path = await archive([
      { header: { name: 'repo-sha/a.txt' }, content: '1234' },
      { header: { name: 'repo-sha/b.txt' }, content: '5678' },
    ])
    const result = await inventoryArchive(
      path,
      { ...policy, parsedTextFileMaxBytes: 3 },
      new AbortController().signal
    )
    expect(result.statistics.oversizedTextFiles).toBe(2)
    expect(result.warnings).toHaveLength(1)
    expect(result.warnings[0]).not.toContain('a.txt')
  })

  it('enforces entry, path-length, and path-segment limits', async () => {
    const path = await archive([
      { header: { name: 'repo-sha/a/b.txt' }, content: 'one' },
      { header: { name: 'repo-sha/c.txt' }, content: 'two' },
    ])
    await expect(
      inventoryArchive(
        path,
        { ...policy, archiveEntriesMax: 1 },
        new AbortController().signal
      )
    ).rejects.toMatchObject({ code: 'archive_entry_limit_exceeded' })
    await expect(
      inventoryArchive(
        path,
        { ...policy, directoryDepthMax: 1 },
        new AbortController().signal
      )
    ).rejects.toMatchObject({ code: 'archive_path_limit_exceeded' })
    await expect(
      inventoryArchive(
        path,
        { ...policy, pathMaxCharacters: 3 },
        new AbortController().signal
      )
    ).rejects.toMatchObject({ code: 'archive_path_limit_exceeded' })
  })

  it('treats empty files as text and invalid UTF-8 samples as binary', async () => {
    const path = await archive([
      { header: { name: 'repo-sha/empty.txt' }, content: '' },
      {
        header: { name: 'repo-sha/invalid.txt' },
        content: Buffer.from([0xc3, 0x28]),
      },
    ])
    const result = await inventoryArchive(path, policy, new AbortController().signal)
    expect(result.files.map((file) => file.isText)).toEqual([true, false])
  })
})
