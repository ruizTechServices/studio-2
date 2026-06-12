import {
  buildGitHubApiBranchUrl,
  buildGitHubApiCommitUrl,
  buildGitHubApiRepositoryUrl,
} from '@/lib/intake/github-url'
import { WorkerFailure } from '@/lib/intake/worker/failures'

const COMMIT_SHA = /^[0-9a-f]{40}$/i

interface GitHubRepository {
  readonly owner: string
  readonly repository: string
  readonly canonicalUrl: string
}

export interface ResolvedGitHubSource {
  readonly defaultBranch: string
  readonly resolvedRef: string
  readonly commitSha: string
}

function githubHeaders(token: string | undefined): HeadersInit {
  return {
    accept: 'application/vnd.github+json',
    'user-agent': 'studio-2-intake-worker',
    'x-github-api-version': '2022-11-28',
    ...(token ? { authorization: `Bearer ${token}` } : {}),
  }
}

async function fetchGitHubJson(
  url: string,
  signal: AbortSignal,
  token: string | undefined,
  fetcher: typeof fetch,
  notFoundCode: 'invalid_repository_metadata' | 'invalid_ref'
): Promise<Record<string, unknown>> {
  let response: Response

  try {
    response = await fetcher(url, {
      headers: githubHeaders(token),
      redirect: 'error',
      signal,
    })
  } catch (error) {
    if (signal.aborted) {
      throw error
    }
    throw new WorkerFailure(
      'github_network_failure',
      'GitHub is temporarily unavailable.',
      true
    )
  }

  if (response.status === 403 || response.status === 429) {
    throw new WorkerFailure(
      'github_rate_limited',
      'GitHub request limits were reached.',
      true
    )
  }
  if (response.status >= 500) {
    throw new WorkerFailure(
      'github_unavailable',
      'GitHub is temporarily unavailable.',
      true
    )
  }
  if (!response.ok) {
    throw new WorkerFailure(
      notFoundCode,
      notFoundCode === 'invalid_ref'
        ? 'The requested Git ref is unavailable.'
        : 'The public repository is unavailable.',
      false
    )
  }

  let data: unknown
  try {
    data = await response.json()
  } catch {
    throw new WorkerFailure(
      'invalid_repository_metadata',
      'GitHub returned invalid repository metadata.',
      false
    )
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new WorkerFailure(
      'invalid_repository_metadata',
      'GitHub returned invalid repository metadata.',
      false
    )
  }
  return data as Record<string, unknown>
}

function parseCommitSha(data: Record<string, unknown>): string {
  const direct = data.sha
  const nested =
    typeof data.commit === 'object' && data.commit !== null && !Array.isArray(data.commit)
      ? (data.commit as Record<string, unknown>).sha
      : undefined
  const sha = typeof direct === 'string' ? direct : nested

  if (typeof sha !== 'string' || !COMMIT_SHA.test(sha)) {
    throw new WorkerFailure(
      'invalid_repository_metadata',
      'GitHub returned invalid repository metadata.',
      false
    )
  }
  return sha.toLowerCase()
}

export async function resolveGitHubSource(
  repository: GitHubRepository,
  requestedRef: string | null,
  signal: AbortSignal,
  dependencies: {
    readonly fetcher?: typeof fetch
    readonly token?: string
  } = {}
): Promise<ResolvedGitHubSource> {
  const fetcher = dependencies.fetcher ?? fetch
  const token = dependencies.token ?? process.env.GITHUB_TOKEN
  const metadata = await fetchGitHubJson(
    buildGitHubApiRepositoryUrl(repository),
    signal,
    token,
    fetcher,
    'invalid_repository_metadata'
  )

  if (metadata.private !== false || typeof metadata.default_branch !== 'string') {
    throw new WorkerFailure(
      metadata.private === true ? 'private_repository' : 'invalid_repository_metadata',
      metadata.private === true
        ? 'Private repositories are not supported.'
        : 'GitHub returned invalid repository metadata.',
      false
    )
  }

  const defaultBranch = metadata.default_branch
  const ref = requestedRef ?? defaultBranch
  const isCommit = COMMIT_SHA.test(ref)
  const endpoint = isCommit
    ? buildGitHubApiCommitUrl(repository, ref)
    : buildGitHubApiBranchUrl(repository, ref)

  try {
    const resolved = await fetchGitHubJson(endpoint, signal, token, fetcher, 'invalid_ref')
    const commitSha = parseCommitSha(resolved)
    if (isCommit && commitSha !== ref.toLowerCase()) {
      throw new WorkerFailure(
        'invalid_ref',
        'The requested Git ref is unavailable.',
        false
      )
    }
    return {
      defaultBranch,
      resolvedRef: ref,
      commitSha,
    }
  } catch (error) {
    if (
      !isCommit &&
      error instanceof WorkerFailure &&
      error.code === 'invalid_ref'
    ) {
      throw new WorkerFailure(
        'unsupported_ref_type',
        'Only branches and full commit SHAs are supported.',
        false
      )
    }
    throw error
  }
}
