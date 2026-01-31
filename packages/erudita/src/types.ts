/**
 * Parsed entry from llms.txt
 */
export interface LlmsEntry {
  /** Section title (H2 header) */
  title: string
  /** URL to the documentation file */
  url: string
  /** Optional description text */
  description?: string
}

/**
 * Parsed llms.txt structure
 */
export interface LlmsDoc {
  /** Document title (H1 header) */
  title: string
  /** Document description (blockquote after H1) */
  description?: string
  /** List of documentation entries */
  entries: LlmsEntry[]
}

/**
 * Metadata for a cached package
 */
export interface CachedPackageMeta {
  /** Package name */
  name: string
  /** Source URL where llms.txt was fetched from */
  sourceUrl: string
  /** Unix timestamp of when the cache was created */
  fetchedAt: number
}

/**
 * npm registry package metadata (subset)
 */
export interface NpmPackageMeta {
  name: string
  homepage?: string
  repository?: {
    type?: string
    url?: string
  }
}
