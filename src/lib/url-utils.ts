/**
 * Validate and normalize a URL for package homepage
 * Validates http/https protocol and removes trailing slashes
 * @param url - The URL to validate
 * @returns Normalized URL string or null if invalid
 */
export function validateUrl(url: string): string | null {
  if (!url || typeof url !== 'string') {
    return null
  }

  let normalized = url.trim()

  // Must be http or https
  if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
    return null
  }

  // Upgrade http to https
  if (normalized.startsWith('http://')) {
    normalized = normalized.replace('http://', 'https://')
  }

  // Remove trailing slash
  if (normalized.endsWith('/')) {
    normalized = normalized.slice(0, -1)
  }

  // Validate URL structure
  try {
    new URL(normalized)
    return normalized
  } catch {
    return null
  }
}
