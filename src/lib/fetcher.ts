import { extractDocUrls, filterEntriesByPath, parseLlmsTxt, resolveUrl } from './llms-parser.ts'
import { asyncPool } from './async-pool.ts'
import type { LlmsDoc, FetchProgressCallback } from '../types.ts'

export interface FetchResult {
  success: boolean
  doc?: LlmsDoc
  rawLlmsTxt?: string
  docFiles?: Map<string, string>
  error?: string
}

export interface FetchOptions {
  onProgress?: FetchProgressCallback
  concurrency?: number
}

const DEFAULT_CONCURRENCY = 5

const LLMS_TXT_PATHS = ['/llms.txt', '/llms-full.txt']
const DEFAULT_TIMEOUT = 10000
const MAX_RETRIES = 3

/**
 * Extract root domain URL from a full URL
 * e.g., https://oxc.rs/docs/guide/usage/formatter → https://oxc.rs
 */
export function extractRootUrl(url: string): string {
  const parsed = new URL(url)
  return `${parsed.protocol}//${parsed.host}`
}

/**
 * Get path from URL
 * e.g., https://oxc.rs/docs/guide/usage/formatter → /docs/guide/usage/formatter
 */
export function getUrlPath(url: string): string {
  return new URL(url).pathname
}

/**
 * Fetch with timeout and retries
 */
async function fetchWithRetry(
  url: string,
  options: { timeout?: number; retries?: number } = {},
): Promise<Response | null> {
  const { timeout = DEFAULT_TIMEOUT, retries = MAX_RETRIES } = options

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'erudita-cli/0.0.0',
          Accept: 'text/markdown, text/plain;q=0.9, */*;q=0.8',
        },
      })

      clearTimeout(timeoutId)

      if (response.ok) {
        return response
      }

      // Don't retry 4xx errors
      if (response.status >= 400 && response.status < 500) {
        return null
      }
    } catch (error) {
      // Only retry on network/timeout errors
      if (attempt === retries - 1) {
        return null
      }
    }

    // Wait before retry (exponential backoff)
    await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 100))
  }

  return null
}

/**
 * Try to fetch llms.txt from a URL, trying multiple paths
 */
async function tryFetchLlmsTxt(baseUrl: string): Promise<{ content: string; url: string } | null> {
  for (const path of LLMS_TXT_PATHS) {
    const url = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) + path : baseUrl + path

    const response = await fetchWithRetry(url)
    if (response) {
      const content = await response.text()
      // Basic validation: should contain markdown headers
      if (content.includes('#')) {
        return { content, url }
      }
    }
  }

  return null
}

/**
 * Try to fetch llms.txt from a base URL
 * Tries multiple paths: /llms.txt, /llms-full.txt
 * If baseUrl has a path and direct fetch fails, tries root domain with path filtering
 */
export async function fetchLlmsTxt(
  baseUrl: string,
): Promise<{ content: string; url: string; pathPrefix?: string } | null> {
  // Try direct fetch first (existing behavior)
  const directResult = await tryFetchLlmsTxt(baseUrl)
  if (directResult) {
    return directResult
  }

  // If baseUrl has a path, try root domain fallback
  const urlPath = getUrlPath(baseUrl)
  if (urlPath && urlPath !== '/') {
    const rootUrl = extractRootUrl(baseUrl)
    const rootResult = await tryFetchLlmsTxt(rootUrl)
    if (rootResult) {
      // Return with pathPrefix so caller can filter entries
      return { ...rootResult, pathPrefix: urlPath }
    }
  }

  return null
}

/**
 * Fetch a single documentation file
 */
export async function fetchDocFile(url: string): Promise<string | null> {
  const response = await fetchWithRetry(url)
  if (!response) {
    return null
  }
  return response.text()
}

/**
 * Fetch llms.txt and all linked documentation files
 */
export async function fetchPackageDocs(
  baseUrl: string,
  options?: FetchOptions,
): Promise<FetchResult> {
  const { onProgress, concurrency = DEFAULT_CONCURRENCY } = options || {}

  // Fetch llms.txt
  onProgress?.({ phase: 'llms-txt', total: 1, completed: 0, errors: 0 })
  const llmsResult = await fetchLlmsTxt(baseUrl)
  if (!llmsResult) {
    return {
      success: false,
      error: `Could not find llms.txt at ${baseUrl}`,
    }
  }

  // Parse the content
  const doc = parseLlmsTxt(llmsResult.content)

  // Filter entries by path prefix if fetched from root domain
  if (llmsResult.pathPrefix) {
    doc.entries = filterEntriesByPath(doc.entries, llmsResult.pathPrefix)
    // If no entries match the path prefix, report error
    if (doc.entries.length === 0) {
      return {
        success: false,
        error: `No documentation found for path ${llmsResult.pathPrefix}`,
      }
    }
  }

  if (!doc.title && doc.entries.length === 0) {
    return {
      success: false,
      error: 'Invalid llms.txt format',
    }
  }

  // Fetch all linked documentation files
  const docUrls = extractDocUrls(doc, llmsResult.url)
  const docFiles = new Map<string, string>()

  let completed = 0
  let errors = 0
  const total = docUrls.length

  await asyncPool(concurrency, docUrls, async (url) => {
    const content = await fetchDocFile(url)
    if (content) {
      // Use the path part of the URL as the filename
      const urlObj = new URL(url)
      const filename = urlObj.pathname.split('/').pop() || 'doc.md'
      docFiles.set(filename, content)
      completed++
    } else {
      errors++
    }
    onProgress?.({ phase: 'docs', total, completed, errors, url })
  })

  return {
    success: true,
    doc,
    rawLlmsTxt: llmsResult.content,
    docFiles,
  }
}

/**
 * Get the filename from a URL
 */
export function getFilenameFromUrl(url: string): string {
  try {
    const urlObj = new URL(url)
    return urlObj.pathname.split('/').pop() || 'doc.md'
  } catch {
    return 'doc.md'
  }
}
