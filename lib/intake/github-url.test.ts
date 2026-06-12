import { describe, expect, it } from 'vitest'

import {
  buildGitHubApiBranchUrl,
  buildGitHubApiCommitUrl,
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
    expect(buildGitHubApiBranchUrl(repository, 'feature/intake')).toBe(
      'https://api.github.com/repos/ruiztechservices/studio-2/branches/feature%2Fintake'
    )
    expect(buildGitHubApiCommitUrl(repository, 'a'.repeat(40))).toBe(
      `https://api.github.com/repos/ruiztechservices/studio-2/commits/${'a'.repeat(40)}`
    )
  })
})
