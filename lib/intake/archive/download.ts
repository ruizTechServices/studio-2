import { createWriteStream } from 'node:fs'
import { Readable, Transform } from 'node:stream'
import { pipeline } from 'node:stream/promises'

import { WorkerFailure } from '@/lib/intake/worker/failures'

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308])

function validateUrl(url: URL, allowedHosts: ReadonlySet<string>): void {
  if (url.protocol !== 'https:' || !allowedHosts.has(url.hostname)) {
    throw new WorkerFailure(
      'unsafe_redirect',
      'Archive download redirected to an untrusted destination.',
      false
    )
  }
}

export async function downloadBoundedArchive(
  initialUrl: string,
  destination: string,
  maxBytes: number,
  signal: AbortSignal,
  dependencies: {
    readonly fetcher?: typeof fetch
    readonly allowedHosts?: ReadonlySet<string>
  } = {}
): Promise<number> {
  const fetcher = dependencies.fetcher ?? fetch
  const allowedHosts =
    dependencies.allowedHosts ?? new Set(['codeload.github.com'])
  let current = new URL(initialUrl)
  let redirects = 0

  while (true) {
    validateUrl(current, allowedHosts)
    let response: Response
    try {
      response = await fetcher(current, { redirect: 'manual', signal })
    } catch (error) {
      if (signal.aborted) throw error
      throw new WorkerFailure(
        'github_network_failure',
        'GitHub archive download is temporarily unavailable.',
        true
      )
    }

    if (REDIRECT_STATUSES.has(response.status)) {
      const location = response.headers.get('location')
      if (!location || redirects >= 3) {
        throw new WorkerFailure(
          'unsafe_redirect',
          'Archive download exceeded the trusted redirect policy.',
          false
        )
      }
      await response.body?.cancel()
      current = new URL(location, current)
      redirects += 1
      continue
    }
    if (response.status === 403 || response.status === 429) {
      throw new WorkerFailure('github_rate_limited', 'GitHub request limits were reached.', true)
    }
    if (response.status >= 500) {
      throw new WorkerFailure('github_unavailable', 'GitHub is temporarily unavailable.', true)
    }
    if (!response.ok || !response.body) {
      throw new WorkerFailure('archive_unavailable', 'Repository archive is unavailable.', false)
    }

    const declaredLength = response.headers.get('content-length')
    if (declaredLength !== null) {
      const parsed = Number(declaredLength)
      if (!Number.isSafeInteger(parsed) || parsed < 0 || parsed > maxBytes) {
        throw new WorkerFailure(
          'compressed_archive_limit_exceeded',
          'Repository archive exceeds the compressed download limit.',
          false
        )
      }
    }

    let bytes = 0
    const counter = new Transform({
      transform(chunk: Buffer, _encoding, callback) {
        bytes += chunk.length
        if (bytes > maxBytes) {
          callback(
            new WorkerFailure(
              'compressed_archive_limit_exceeded',
              'Repository archive exceeds the compressed download limit.',
              false
            )
          )
          return
        }
        callback(null, chunk)
      },
    })

    await pipeline(
      Readable.fromWeb(response.body as import('node:stream/web').ReadableStream),
      counter,
      createWriteStream(destination, { flags: 'wx', mode: 0o600 }),
      { signal }
    )
    return bytes
  }
}
