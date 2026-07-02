import { describe, expect, it, vi } from 'vitest'

import type { ShelfAssetRetrievalPointer } from '@/lib/shelves/retrieval/contracts'
import {
  buildRawSourceUrl,
  fetchPinnedSourceFile,
  SourceRetrievalError,
} from '@/lib/shelves/retrieval/github-source-client'

const pointer: ShelfAssetRetrievalPointer = {
  id: '123e4567-e89b-42d3-a456-426614174010',
  sourceOwner: 'owner',
  sourceRepository: 'repository',
  sourceCommitSha: 'a'.repeat(40),
  relativePath: 'lib/utils.ts',
  lineStart: 1,
  lineEnd: 4,
  symbolName: 'cn',
}

function textResponse(body: string, init: ResponseInit = {}): Response {
  return new Response(body, { status: 200, ...init })
}

async function expectCode(
  promise: Promise<unknown>,
  code: string
): Promise<void> {
  await expect(promise).rejects.toSatisfy(
    (error) => error instanceof SourceRetrievalError && error.code === code
  )
}

describe('buildRawSourceUrl', () => {
  it('builds a pinned raw URL with encoded path segments', () => {
    expect(
      buildRawSourceUrl({ ...pointer, relativePath: 'a b/c#d.ts' })
    ).toBe(
      `https://raw.githubusercontent.com/owner/repository/${'a'.repeat(40)}/a%20b/c%23d.ts`
    )
  })
})

describe('fetchPinnedSourceFile', () => {
  it('returns the decoded text on success', async () => {
    const fetcher = vi.fn(async () => textResponse('export const x = 1\n'))
    await expect(
      fetchPinnedSourceFile(pointer, { fetcher: fetcher as unknown as typeof fetch })
    ).resolves.toBe('export const x = 1\n')
    const [url, init] = fetcher.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toContain('raw.githubusercontent.com')
    expect(init.redirect).toBe('error')
  })

  it('rejects an invalid pointer before any network call', async () => {
    const fetcher = vi.fn()
    await expectCode(
      fetchPinnedSourceFile(
        { ...pointer, relativePath: '../escape.ts' },
        { fetcher: fetcher as unknown as typeof fetch }
      ),
      'not_found'
    )
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('maps 404 to not_found', async () => {
    const fetcher = vi.fn(async () => new Response('missing', { status: 404 }))
    await expectCode(
      fetchPinnedSourceFile(pointer, { fetcher: fetcher as unknown as typeof fetch }),
      'not_found'
    )
  })

  it('maps 429 to github_rate_limited and 500 to github_unavailable', async () => {
    const limited = vi.fn(async () => new Response('slow down', { status: 429 }))
    await expectCode(
      fetchPinnedSourceFile(pointer, { fetcher: limited as unknown as typeof fetch }),
      'github_rate_limited'
    )
    const broken = vi.fn(async () => new Response('boom', { status: 500 }))
    await expectCode(
      fetchPinnedSourceFile(pointer, { fetcher: broken as unknown as typeof fetch }),
      'github_unavailable'
    )
  })

  it('rejects oversized declared content-length without reading the body', async () => {
    const fetcher = vi.fn(async () =>
      textResponse('x', { headers: { 'content-length': '999999999' } })
    )
    await expectCode(
      fetchPinnedSourceFile(pointer, { fetcher: fetcher as unknown as typeof fetch }),
      'file_too_large'
    )
  })

  it('rejects streamed bodies that exceed the byte cap', async () => {
    const fetcher = vi.fn(async () => textResponse('y'.repeat(64)))
    await expectCode(
      fetchPinnedSourceFile(pointer, {
        fetcher: fetcher as unknown as typeof fetch,
        maxFileBytes: 16,
      }),
      'file_too_large'
    )
  })

  it('rejects binary contents', async () => {
    const fetcher = vi.fn(
      async () => new Response(new Uint8Array([104, 105, 0, 104, 105]))
    )
    await expectCode(
      fetchPinnedSourceFile(pointer, { fetcher: fetcher as unknown as typeof fetch }),
      'binary_file'
    )
  })

  it('maps network failures to github_unavailable', async () => {
    const fetcher = vi.fn(async () => {
      throw new TypeError('fetch failed')
    })
    await expectCode(
      fetchPinnedSourceFile(pointer, { fetcher: fetcher as unknown as typeof fetch }),
      'github_unavailable'
    )
  })

  it('maps an exceeded deadline to timeout', async () => {
    const fetcher = vi.fn(
      (_url: unknown, init?: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener('abort', () =>
            reject(new DOMException('aborted', 'AbortError'))
          )
        })
    )
    await expectCode(
      fetchPinnedSourceFile(pointer, {
        fetcher: fetcher as unknown as typeof fetch,
        timeoutMs: 20,
      }),
      'timeout'
    )
  })
})
