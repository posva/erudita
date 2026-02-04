import { describe, expect, it } from 'vitest'
import { validateUrl } from '../url-utils.ts'

describe('validateUrl', () => {
  it('accepts valid https URLs', () => {
    expect(validateUrl('https://example.com')).toBe('https://example.com')
  })

  it('accepts valid http URLs', () => {
    expect(validateUrl('http://example.com')).toBe('https://example.com')
  })

  it('upgrades http to https', () => {
    expect(validateUrl('http://vuejs.org')).toBe('https://vuejs.org')
  })

  it('removes trailing slashes', () => {
    expect(validateUrl('https://example.com/')).toBe('https://example.com')
  })

  it('removes trailing slashes from http URLs', () => {
    expect(validateUrl('http://example.com/')).toBe('https://example.com')
  })

  it('trims whitespace', () => {
    expect(validateUrl('  https://example.com  ')).toBe('https://example.com')
  })

  it('rejects URLs without protocol', () => {
    expect(validateUrl('example.com')).toBeNull()
  })

  it('rejects URLs with invalid protocol', () => {
    expect(validateUrl('ftp://example.com')).toBeNull()
  })

  it('rejects empty strings', () => {
    expect(validateUrl('')).toBeNull()
  })

  it('rejects whitespace-only strings', () => {
    expect(validateUrl('   ')).toBeNull()
  })

  it('rejects null/undefined', () => {
    expect(validateUrl(null as any)).toBeNull()
    expect(validateUrl(undefined as any)).toBeNull()
  })

  it('rejects malformed URLs', () => {
    expect(validateUrl('https://')).toBeNull()
    expect(validateUrl('https:// invalid')).toBeNull()
  })

  it('handles complex URLs with paths', () => {
    expect(validateUrl('https://github.com/user/repo')).toBe('https://github.com/user/repo')
  })

  it('handles URLs with query parameters', () => {
    expect(validateUrl('https://example.com?foo=bar')).toBe('https://example.com?foo=bar')
  })

  it('handles URLs with ports', () => {
    expect(validateUrl('https://example.com:8080')).toBe('https://example.com:8080')
  })

  it('handles URLs with authentication', () => {
    expect(validateUrl('https://user:pass@example.com')).toBe('https://user:pass@example.com')
  })
})
