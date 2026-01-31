import type { NpmPackageMeta } from '../types.ts'

const NPM_REGISTRY = 'https://registry.npmjs.org'

/**
 * Fetch package metadata from npm registry
 */
export async function fetchNpmMeta(packageName: string): Promise<NpmPackageMeta | null> {
  const url = `${NPM_REGISTRY}/${encodeURIComponent(packageName)}`

  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
      },
    })

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    return {
      name: data.name,
      homepage: data.homepage,
      repository: data.repository,
    }
  } catch {
    return null
  }
}

/**
 * Extract website URL from npm package metadata
 * Prefers homepage, falls back to repository URL
 */
export function extractWebsiteUrl(meta: NpmPackageMeta): string | null {
  // Prefer homepage if available
  if (meta.homepage) {
    return normalizeUrl(meta.homepage)
  }

  // Try to extract from repository
  if (meta.repository?.url) {
    return repoUrlToWebsite(meta.repository.url)
  }

  return null
}

/**
 * Normalize a URL (ensure https, remove trailing slash)
 */
function normalizeUrl(url: string): string {
  let normalized = url.trim()

  // Upgrade http to https
  if (normalized.startsWith('http://')) {
    normalized = normalized.replace('http://', 'https://')
  }

  // Remove trailing slash
  if (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1)
  }

  return normalized
}

/**
 * Convert repository URL to website URL
 * git+https://github.com/user/repo.git -> https://github.com/user/repo
 * git://github.com/user/repo.git -> https://github.com/user/repo
 */
function repoUrlToWebsite(repoUrl: string): string | null {
  let url = repoUrl.trim()

  // Handle git+ prefix
  if (url.startsWith('git+')) {
    url = url.slice(4)
  }

  // Handle git:// protocol
  if (url.startsWith('git://')) {
    url = url.replace('git://', 'https://')
  }

  // Handle ssh URLs like git@github.com:user/repo.git
  if (url.startsWith('git@')) {
    const match = url.match(/git@([^:]+):(.+)/)
    if (match) {
      url = `https://${match[1]}/${match[2]}`
    }
  }

  // Remove .git suffix
  if (url.endsWith('.git')) {
    url = url.slice(0, -4)
  }

  // Validate it's a proper URL
  try {
    new URL(url)
    return normalizeUrl(url)
  } catch {
    return null
  }
}

/**
 * Resolve a package name to its website URL
 */
export async function resolvePackageUrl(packageName: string): Promise<string | null> {
  const meta = await fetchNpmMeta(packageName)
  if (!meta) {
    return null
  }
  return extractWebsiteUrl(meta)
}
