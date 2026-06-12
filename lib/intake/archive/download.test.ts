import { mkdtemp, readFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

import { afterEach, describe, expect, it, vi } from 'vitest'

import { downloadBoundedArchive } from '@/lib/intake/archive/download'

const directories: string[] = []
async function destination(): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), 'studio-2-download-'))
  directories.push(directory)
  return join(directory, 'archive.tar.gz')
}
afterEach(async () => {
  await Promise.all(directories.splice(0).map((path) => rm(path, { recursive: true, force: true })))
})

describe('downloadBoundedArchive', () => {
  it('downloads a bounded trusted archive', async () => {
    const path = await destination()
    await expect(
      downloadBoundedArchive(
        'https://codeload.github.com/owner/repo/tar.gz/sha',
        path,
        10,
        new AbortController().signal,
        { fetcher: vi.fn<typeof fetch>().mockResolvedValue(new Response('data')) }
      )
    ).resolves.toBe(4)
    expect(await readFile(path, 'utf8')).toBe('data')
  })

  it('rejects declared and streamed compressed sizes over the limit', async () => {
    await expect(
      downloadBoundedArchive(
        'https://codeload.github.com/owner/repo/tar.gz/sha',
        await destination(),
        3,
        new AbortController().signal,
        {
          fetcher: vi.fn<typeof fetch>().mockResolvedValue(
            new Response('data', { headers: { 'content-length': '4' } })
          ),
        }
      )
    ).rejects.toMatchObject({ code: 'compressed_archive_limit_exceeded' })

    await expect(
      downloadBoundedArchive(
        'https://codeload.github.com/owner/repo/tar.gz/sha',
        await destination(),
        3,
        new AbortController().signal,
        { fetcher: vi.fn<typeof fetch>().mockResolvedValue(new Response('data')) }
      )
    ).rejects.toMatchObject({ code: 'compressed_archive_limit_exceeded' })
  })

  it('rejects redirects to untrusted hosts', async () => {
    await expect(
      downloadBoundedArchive(
        'https://codeload.github.com/owner/repo/tar.gz/sha',
        await destination(),
        10,
        new AbortController().signal,
        {
          fetcher: vi.fn<typeof fetch>().mockResolvedValue(
            new Response(null, { status: 302, headers: { location: 'https://example.com/archive' } })
          ),
        }
      )
    ).rejects.toMatchObject({ code: 'unsafe_redirect' })
  })

  it('rejects non-HTTPS targets and more than three redirects', async () => {
    await expect(
      downloadBoundedArchive(
        'http://codeload.github.com/owner/repo/tar.gz/sha',
        await destination(),
        10,
        new AbortController().signal
      )
    ).rejects.toMatchObject({ code: 'unsafe_redirect' })

    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(null, {
        status: 302,
        headers: { location: 'https://codeload.github.com/next' },
      })
    )
    await expect(
      downloadBoundedArchive(
        'https://codeload.github.com/owner/repo/tar.gz/sha',
        await destination(),
        10,
        new AbortController().signal,
        { fetcher }
      )
    ).rejects.toMatchObject({ code: 'unsafe_redirect' })
    expect(fetcher).toHaveBeenCalledTimes(4)
  })
})
