import { extractDocUrls, parseLlmsTxt, resolveUrl } from './llms-parser.ts'
import type { LlmsDoc } from '../types.ts'

export interface FetchResult {
  success: boolean
  doc?: LlmsDoc
  rawLlmsTxt?: string
  docFiles?: Map<string, string>
  error?: string
}

const LLMS_TXT_PATHS = ['/llms.txt', '/llms-full.txt']
const DEFAULT_TIMEOUT = 10000
const MAX_RETRIES = 3

/**
 * Fetch with timeout and retries
 */
async function fetchWithRetry(
  url: string,
  options: { timeout?: number; retries?: number } = {}
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
 * Try to fetch llms.txt from a base URL
 * Tries multiple paths: /llms.txt, /llms-full.txt
 */
export async function fetchLlmsTxt(baseUrl: string): Promise<{ content: string; url: string } | null> {
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
export async function fetchPackageDocs(baseUrl: string): Promise<FetchResult> {
  // Fetch llms.txt
  const llmsResult = await fetchLlmsTxt(baseUrl)
  if (!llmsResult) {
    return {
      success: false,
      error: `Could not find llms.txt at ${baseUrl}`,
    }
  }

  // Parse the content
  const doc = parseLlmsTxt(llmsResult.content)
  if (!doc.title && doc.entries.length === 0) {
    return {
      success: false,
      error: 'Invalid llms.txt format',
    }
  }

  // Fetch all linked documentation files
  const docUrls = extractDocUrls(doc, llmsResult.url)
  const docFiles = new Map<string, string>()

  await Promise.all(
    docUrls.map(async (url) => {
      const content = await fetchDocFile(url)
      if (content) {
        // Use the path part of the URL as the filename
        const urlObj = new URL(url)
        const filename = urlObj.pathname.split('/').pop() || 'doc.md'
        docFiles.set(filename, content)
      }
    })
  )

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
