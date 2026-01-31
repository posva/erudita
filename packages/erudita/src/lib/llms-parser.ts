import type { LlmsDoc, LlmsEntry } from '../types.js'

/**
 * Parse llms.txt markdown content into structured format
 *
 * Expected format:
 * # Title
 *
 * > Description (optional blockquote)
 *
 * ## Section Title
 *
 * - [Link Text](url): Description
 * - [Another Link](url)
 */
export function parseLlmsTxt(content: string): LlmsDoc {
  const lines = content.split('\n')
  let title = ''
  let description: string | undefined
  const entries: LlmsEntry[] = []

  let currentSection = ''
  let inBlockquote = false
  const blockquoteLines: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()

    // H1: Document title
    if (trimmed.startsWith('# ')) {
      title = trimmed.slice(2).trim()
      continue
    }

    // Blockquote: Description (after title)
    if (trimmed.startsWith('>')) {
      inBlockquote = true
      blockquoteLines.push(trimmed.slice(1).trim())
      continue
    }

    // End of blockquote
    if (inBlockquote && trimmed === '') {
      if (blockquoteLines.length > 0 && !description) {
        description = blockquoteLines.join(' ')
      }
      inBlockquote = false
      blockquoteLines.length = 0
      continue
    }

    // H2: Section header
    if (trimmed.startsWith('## ')) {
      currentSection = trimmed.slice(3).trim()
      continue
    }

    // List item with link: - [Text](url) or - [Text](url): description
    const linkMatch = trimmed.match(/^[-*]\s*\[([^\]]+)\]\(([^)]+)\)(?::\s*(.+))?$/)
    if (linkMatch) {
      entries.push({
        title: currentSection ? `${currentSection} - ${linkMatch[1]}` : linkMatch[1],
        url: linkMatch[2],
        description: linkMatch[3]?.trim(),
      })
      continue
    }

    // Plain link on its own line: [Text](url)
    const plainLinkMatch = trimmed.match(/^\[([^\]]+)\]\(([^)]+)\)$/)
    if (plainLinkMatch) {
      entries.push({
        title: currentSection ? `${currentSection} - ${plainLinkMatch[1]}` : plainLinkMatch[1],
        url: plainLinkMatch[2],
      })
    }
  }

  // Handle blockquote at end of file
  if (inBlockquote && blockquoteLines.length > 0 && !description) {
    description = blockquoteLines.join(' ')
  }

  return {
    title,
    description,
    entries,
  }
}

/**
 * Resolve a relative URL against a base URL
 */
export function resolveUrl(baseUrl: string, relativeUrl: string): string {
  // Already absolute
  if (relativeUrl.startsWith('http://') || relativeUrl.startsWith('https://')) {
    return relativeUrl
  }

  try {
    return new URL(relativeUrl, baseUrl).href
  } catch {
    return relativeUrl
  }
}

/**
 * Extract all documentation URLs from parsed llms.txt
 */
export function extractDocUrls(doc: LlmsDoc, baseUrl: string): string[] {
  return doc.entries.map((entry) => resolveUrl(baseUrl, entry.url))
}
