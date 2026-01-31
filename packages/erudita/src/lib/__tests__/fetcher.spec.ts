import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { fetchLlmsTxt, fetchPackageDocs, getFilenameFromUrl } from '../fetcher.js'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('fetchLlmsTxt', () => {
  it('fetches llms.txt from base URL', async () => {
    server.use(
      http.get('https://example.com/llms.txt', () => {
        return HttpResponse.text('# Documentation\n\n- [Guide](./guide.md)')
      })
    )

    const result = await fetchLlmsTxt('https://example.com')
    expect(result).not.toBeNull()
    expect(result?.content).toContain('# Documentation')
    expect(result?.url).toBe('https://example.com/llms.txt')
  })

  it('tries llms-full.txt as fallback', async () => {
    server.use(
      http.get('https://example.com/llms.txt', () => {
        return new HttpResponse(null, { status: 404 })
      }),
      http.get('https://example.com/llms-full.txt', () => {
        return HttpResponse.text('# Full Docs')
      })
    )

    const result = await fetchLlmsTxt('https://example.com')
    expect(result?.content).toContain('# Full Docs')
  })

  it('returns null if no llms.txt found', async () => {
    server.use(
      http.get('https://example.com/llms.txt', () => {
        return new HttpResponse(null, { status: 404 })
      }),
      http.get('https://example.com/llms-full.txt', () => {
        return new HttpResponse(null, { status: 404 })
      })
    )

    const result = await fetchLlmsTxt('https://example.com')
    expect(result).toBeNull()
  })

  it('handles trailing slash in base URL', async () => {
    server.use(
      http.get('https://example.com/llms.txt', () => {
        return HttpResponse.text('# Docs')
      })
    )

    const result = await fetchLlmsTxt('https://example.com/')
    expect(result).not.toBeNull()
  })
})

describe('fetchPackageDocs', () => {
  it('fetches llms.txt and linked docs', async () => {
    server.use(
      http.get('https://example.com/llms.txt', () => {
        return HttpResponse.text(`# Package Docs

## Guide

- [Introduction](./intro.md)
- [API](./api.md)`)
      }),
      http.get('https://example.com/intro.md', () => {
        return HttpResponse.text('# Introduction\n\nWelcome!')
      }),
      http.get('https://example.com/api.md', () => {
        return HttpResponse.text('# API\n\n## Functions')
      })
    )

    const result = await fetchPackageDocs('https://example.com')
    expect(result.success).toBe(true)
    expect(result.doc?.title).toBe('Package Docs')
    expect(result.doc?.entries).toHaveLength(2)
    expect(result.docFiles?.size).toBe(2)
    expect(result.docFiles?.get('intro.md')).toContain('Welcome!')
    expect(result.docFiles?.get('api.md')).toContain('Functions')
  })

  it('returns error when llms.txt not found', async () => {
    server.use(
      http.get('https://example.com/llms.txt', () => {
        return new HttpResponse(null, { status: 404 })
      }),
      http.get('https://example.com/llms-full.txt', () => {
        return new HttpResponse(null, { status: 404 })
      })
    )

    const result = await fetchPackageDocs('https://example.com')
    expect(result.success).toBe(false)
    expect(result.error).toContain('Could not find llms.txt')
  })

  it('handles partial doc fetching gracefully', async () => {
    server.use(
      http.get('https://example.com/llms.txt', () => {
        return HttpResponse.text(`# Docs

- [Exists](./exists.md)
- [Missing](./missing.md)`)
      }),
      http.get('https://example.com/exists.md', () => {
        return HttpResponse.text('# Exists')
      }),
      http.get('https://example.com/missing.md', () => {
        return new HttpResponse(null, { status: 404 })
      })
    )

    const result = await fetchPackageDocs('https://example.com')
    expect(result.success).toBe(true)
    expect(result.docFiles?.size).toBe(1)
    expect(result.docFiles?.has('exists.md')).toBe(true)
  })
})

describe('getFilenameFromUrl', () => {
  it('extracts filename from URL path', () => {
    expect(getFilenameFromUrl('https://example.com/docs/guide.md')).toBe('guide.md')
  })

  it('handles URLs without path', () => {
    expect(getFilenameFromUrl('https://example.com')).toBe('doc.md')
  })

  it('handles invalid URLs gracefully', () => {
    expect(getFilenameFromUrl('not-a-url')).toBe('doc.md')
  })
})
