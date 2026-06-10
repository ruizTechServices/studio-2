import { describe, expect, it } from 'vitest'

import {
  buildGitHubApiRepositoryUrl,
  buildGitHubArchiveUrl,
} from '@/lib/intake/github-url'

const repository = {
  owner: 'ruiztechservices',
  repository: 'studio-2',
  canonicalUrl: 'https://github.com/ruiztechservices/studio-2',
}

describe('GitHub URL builders', () => {
  it('constructs only known GitHub API and archive hosts', () => {
    expect(buildGitHubApiRepositoryUrl(repository)).toBe(
      'https://api.github.com/repos/ruiztechservices/studio-2'
    )
    expect(buildGitHubArchiveUrl(repository, 'feature/intake')).toBe(
      'https://codeload.github.com/ruiztechservices/studio-2/tar.gz/feature%2Fintake'
    )
  })
})
