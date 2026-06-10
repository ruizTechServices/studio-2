import { describe, expect, it } from 'vitest'

import {
  isUuid,
  validateGitHubRepositoryUrl,
  validateGitRef,
  validateProjectImportRequest,
} from '@/lib/intake/validation'

describe('validateGitHubRepositoryUrl', () => {
  it('accepts and normalizes exact HTTPS GitHub repository URLs', () => {
    expect(
      validateGitHubRepositoryUrl('https://github.com/RuizTechServices/Studio-2')
    ).toEqual({
      ok: true,
      value: {
        owner: 'ruiztechservices',
        repository: 'studio-2',
        canonicalUrl: 'https://github.com/ruiztechservices/studio-2',
      },
    })
  })

  it.each([
    'http://github.com/owner/repository',
    'ssh://git@github.com/owner/repository',
    'git@github.com:owner/repository.git',
    'file:///owner/repository',
    'https://gitlab.com/owner/repository',
    'https://github.example.com/owner/repository',
    'https://github.com/owner/repository/',
    'https://github.com/owner/repository.git',
    'https://github.com/owner/repository/tree/main',
    'https://github.com/owner/repository?ref=main',
    'https://github.com/owner/repository#readme',
    'https://user@github.com/owner/repository',
    'https://github.com:443/owner/repository',
    'https://github.com/-owner/repository',
    'https://github.com/owner-/repository',
    'https://github.com/owner--name/repository',
    'https://github.com/owner/..',
  ])('rejects unsupported or malformed URL %s', (repositoryUrl) => {
    expect(validateGitHubRepositoryUrl(repositoryUrl).ok).toBe(false)
  })
})

describe('validateGitRef', () => {
  it.each(['main', 'feature/intake', 'v1.2.3', 'abc1234', 'refs/tags/v1'])(
    'accepts valid ref %s',
    (ref) => {
      expect(validateGitRef(ref)).toEqual({ ok: true, value: ref })
    }
  )

  it('accepts an omitted ref', () => {
    expect(validateGitRef(undefined)).toEqual({ ok: true, value: null })
  })

  it.each([
    ' feature/intake',
    'feature/intake ',
    'feature//intake',
    'feature/../intake',
    'feature/@{intake',
    'feature\\intake',
    'feature:intake',
    '.hidden',
    'feature/.hidden',
    'feature.lock',
    '@',
  ])('rejects malformed ref %s', (ref) => {
    expect(validateGitRef(ref).ok).toBe(false)
  })
})

describe('validateProjectImportRequest', () => {
  it('rejects unknown fields', () => {
    expect(
      validateProjectImportRequest({
        repositoryUrl: 'https://github.com/owner/repository',
        token: 'secret',
      }).ok
    ).toBe(false)
  })
})

describe('isUuid', () => {
  it('accepts UUIDs and rejects arbitrary IDs', () => {
    expect(isUuid('123e4567-e89b-42d3-a456-426614174000')).toBe(true)
    expect(isUuid('scan-123')).toBe(false)
  })
})
