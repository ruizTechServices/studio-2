import type { ValidatedGitHubRepository } from '@/lib/intake/validation'

export function buildGitHubApiRepositoryUrl(
  repository: ValidatedGitHubRepository
): string {
  return `https://api.github.com/repos/${repository.owner}/${repository.repository}`
}

export function buildGitHubArchiveUrl(
  repository: ValidatedGitHubRepository,
  ref: string
): string {
  return `https://codeload.github.com/${repository.owner}/${repository.repository}/tar.gz/${encodeURIComponent(ref)}`
}

export function buildGitHubApiBranchUrl(
  repository: ValidatedGitHubRepository,
  branch: string
): string {
  return `${buildGitHubApiRepositoryUrl(repository)}/branches/${encodeURIComponent(branch)}`
}

export function buildGitHubApiCommitUrl(
  repository: ValidatedGitHubRepository,
  commitSha: string
): string {
  return `${buildGitHubApiRepositoryUrl(repository)}/commits/${encodeURIComponent(commitSha)}`
}
