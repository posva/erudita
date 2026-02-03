import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import {
  extractRootUrl,
  fetchLlmsTxt,
  fetchPackageDocs,
  getFilenameFromUrl,
  getUrlPath,
} from '../fetcher.ts'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('fetchLlmsTxt', () => {
  it('fetches llms.txt from base URL', async () => {
    server.use(
      http.get('https://example.com/llms.txt', () => {
        return HttpResponse.text('# Documentation\n\n- [Guide](./guide.md)')
      }),
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
      }),
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
      }),
    )

    const result = await fetchLlmsTxt('https://example.com')
    expect(result).toBeNull()
  })

  it('handles trailing slash in base URL', async () => {
    server.use(
      http.get('https://example.com/llms.txt', () => {
        return HttpResponse.text('# Docs')
      }),
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
      }),
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
      }),
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
      }),
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

describe('extractRootUrl', () => {
  it('extracts root URL from full URL', () => {
    expect(extractRootUrl('https://oxc.rs/docs/guide/usage/formatter')).toBe('https://oxc.rs')
  })

  it('handles URLs with port', () => {
    expect(extractRootUrl('https://example.com:8080/docs')).toBe('https://example.com:8080')
  })

  it('handles root URLs', () => {
    expect(extractRootUrl('https://example.com')).toBe('https://example.com')
  })

  it('handles URLs with trailing slash', () => {
    expect(extractRootUrl('https://example.com/')).toBe('https://example.com')
  })
})

describe('getUrlPath', () => {
  it('extracts path from URL', () => {
    expect(getUrlPath('https://oxc.rs/docs/guide/usage/formatter')).toBe(
      '/docs/guide/usage/formatter',
    )
  })

  it('returns / for root URL', () => {
    expect(getUrlPath('https://example.com')).toBe('/')
  })

  it('returns / for root URL with trailing slash', () => {
    expect(getUrlPath('https://example.com/')).toBe('/')
  })
})

describe('fetchLlmsTxt root domain fallback', () => {
  it('falls back to root domain when subdoc URL fails', async () => {
    server.use(
      // Subdoc URL fails
      http.get('https://example.com/docs/section/llms.txt', () => {
        return new HttpResponse(null, { status: 404 })
      }),
      http.get('https://example.com/docs/section/llms-full.txt', () => {
        return new HttpResponse(null, { status: 404 })
      }),
      // Root domain succeeds
      http.get('https://example.com/llms.txt', () => {
        return HttpResponse.text(`# Root Docs

- [Section A](/docs/section/a.md)
- [Section B](/docs/section/b.md)
- [Other](/docs/other/c.md)`)
      }),
    )

    const result = await fetchLlmsTxt('https://example.com/docs/section')
    expect(result).not.toBeNull()
    expect(result?.content).toContain('# Root Docs')
    expect(result?.url).toBe('https://example.com/llms.txt')
    expect(result?.pathPrefix).toBe('/docs/section')
  })

  it('does not use fallback when direct fetch succeeds', async () => {
    server.use(
      http.get('https://example.com/docs/section/llms.txt', () => {
        return HttpResponse.text('# Section Docs')
      }),
    )

    const result = await fetchLlmsTxt('https://example.com/docs/section')
    expect(result?.content).toContain('# Section Docs')
    expect(result?.pathPrefix).toBeUndefined()
  })

  it('does not use fallback for root URLs', async () => {
    server.use(
      http.get('https://example.com/llms.txt', () => {
        return new HttpResponse(null, { status: 404 })
      }),
      http.get('https://example.com/llms-full.txt', () => {
        return new HttpResponse(null, { status: 404 })
      }),
    )

    const result = await fetchLlmsTxt('https://example.com')
    expect(result).toBeNull()
  })

  it('returns null when both subdoc and root fail', async () => {
    server.use(
      http.get('https://example.com/docs/section/llms.txt', () => {
        return new HttpResponse(null, { status: 404 })
      }),
      http.get('https://example.com/docs/section/llms-full.txt', () => {
        return new HttpResponse(null, { status: 404 })
      }),
      http.get('https://example.com/llms.txt', () => {
        return new HttpResponse(null, { status: 404 })
      }),
      http.get('https://example.com/llms-full.txt', () => {
        return new HttpResponse(null, { status: 404 })
      }),
    )

    const result = await fetchLlmsTxt('https://example.com/docs/section')
    expect(result).toBeNull()
  })
})

describe('fetchPackageDocs with path filtering', () => {
  it('filters entries by path prefix when using root domain fallback', async () => {
    server.use(
      // Subdoc URL fails
      http.get('https://example.com/docs/section/llms.txt', () => {
        return new HttpResponse(null, { status: 404 })
      }),
      http.get('https://example.com/docs/section/llms-full.txt', () => {
        return new HttpResponse(null, { status: 404 })
      }),
      // Root domain succeeds with mixed entries
      http.get('https://example.com/llms.txt', () => {
        return HttpResponse.text(`# Root Docs

- [Section A](/docs/section/a.md)
- [Section B](/docs/section/b.md)
- [Other](/docs/other/c.md)`)
      }),
      // Doc files
      http.get('https://example.com/docs/section/a.md', () => {
        return HttpResponse.text('# Section A content')
      }),
      http.get('https://example.com/docs/section/b.md', () => {
        return HttpResponse.text('# Section B content')
      }),
    )

    const result = await fetchPackageDocs('https://example.com/docs/section')
    expect(result.success).toBe(true)
    // Only section docs should be included, not "other"
    expect(result.doc?.entries).toHaveLength(2)
    expect(result.doc?.entries.map((e) => e.url)).toEqual([
      '/docs/section/a.md',
      '/docs/section/b.md',
    ])
    expect(result.docFiles?.size).toBe(2)
  })

  it('returns error when no entries match path prefix', async () => {
    server.use(
      http.get('https://example.com/docs/section/llms.txt', () => {
        return new HttpResponse(null, { status: 404 })
      }),
      http.get('https://example.com/docs/section/llms-full.txt', () => {
        return new HttpResponse(null, { status: 404 })
      }),
      http.get('https://example.com/llms.txt', () => {
        return HttpResponse.text(`# Root Docs

- [Other](/docs/other/c.md)`)
      }),
    )

    const result = await fetchPackageDocs('https://example.com/docs/section')
    expect(result.success).toBe(false)
    expect(result.error).toBe('No documentation found for path /docs/section')
  })
})
