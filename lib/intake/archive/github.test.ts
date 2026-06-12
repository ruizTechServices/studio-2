import { describe, expect, it, vi } from 'vitest'

import { resolveGitHubSource } from '@/lib/intake/archive/github'

const repository = {
  owner: 'owner',
  repository: 'repository',
  canonicalUrl: 'https://github.com/owner/repository',
}
const sha = 'a'.repeat(40)

describe('resolveGitHubSource', () => {
  it('resolves a default branch to an immutable commit', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ private: false, default_branch: 'main' }))
      .mockResolvedValueOnce(Response.json({ commit: { sha } }))

    await expect(
      resolveGitHubSource(repository, null, new AbortController().signal, { fetcher })
    ).resolves.toEqual({ defaultBranch: 'main', resolvedRef: 'main', commitSha: sha })
    expect(fetcher.mock.calls[1][0]).toContain('/branches/main')
  })

  it('resolves a full commit SHA without calling tag endpoints', async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ private: false, default_branch: 'main' }))
      .mockResolvedValueOnce(Response.json({ sha }))

    await resolveGitHubSource(repository, sha, new AbortController().signal, { fetcher })
    expect(fetcher.mock.calls[1][0]).toContain(`/commits/${sha}`)
    expect(fetcher.mock.calls.flat().join(' ')).not.toContain('/tags/')
  })

  it('rejects a SHA-shaped ref that resolves to a different commit', async () => {
    await expect(
      resolveGitHubSource(repository, sha, new AbortController().signal, {
        fetcher: vi
          .fn<typeof fetch>()
          .mockResolvedValueOnce(Response.json({ private: false, default_branch: 'main' }))
          .mockResolvedValueOnce(Response.json({ sha: 'b'.repeat(40) })),
      })
    ).rejects.toMatchObject({ code: 'invalid_ref', retryable: false })
  })

  it('rejects private repositories and unsupported refs safely', async () => {
    await expect(
      resolveGitHubSource(repository, null, new AbortController().signal, {
        fetcher: vi.fn<typeof fetch>().mockResolvedValue(
          Response.json({ private: true, default_branch: 'main' })
        ),
      })
    ).rejects.toMatchObject({ code: 'private_repository', retryable: false })

    await expect(
      resolveGitHubSource(repository, 'v1.0.0', new AbortController().signal, {
        fetcher: vi
          .fn<typeof fetch>()
          .mockResolvedValueOnce(Response.json({ private: false, default_branch: 'main' }))
          .mockResolvedValueOnce(new Response(null, { status: 404 })),
      })
    ).rejects.toMatchObject({ code: 'unsupported_ref_type', retryable: false })
  })

  it('classifies GitHub rate limits as retryable', async () => {
    await expect(
      resolveGitHubSource(repository, null, new AbortController().signal, {
        fetcher: vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 429 })),
      })
    ).rejects.toMatchObject({ code: 'github_rate_limited', retryable: true })
  })
})
