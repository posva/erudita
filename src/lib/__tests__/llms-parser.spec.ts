import { describe, expect, it } from 'vitest'
import { extractDocUrls, parseLlmsTxt, resolveUrl } from '../llms-parser.ts'

describe('parseLlmsTxt', () => {
  it('parses title from H1', () => {
    const content = '# My Package Documentation'
    const result = parseLlmsTxt(content)
    expect(result.title).toBe('My Package Documentation')
  })

  it('parses description from blockquote', () => {
    const content = `# Title

> This is the description
> spanning multiple lines`
    const result = parseLlmsTxt(content)
    expect(result.description).toBe('This is the description spanning multiple lines')
  })

  it('parses entries from list items with links', () => {
    const content = `# Docs

## Getting Started

- [Quick Start](./quick-start.md): Get up and running
- [Installation](./install.md)

## API

- [Core API](./api/core.md): Main API reference`

    const result = parseLlmsTxt(content)
    expect(result.entries).toHaveLength(3)
    expect(result.entries[0]).toEqual({
      title: 'Getting Started - Quick Start',
      url: './quick-start.md',
      description: 'Get up and running',
    })
    expect(result.entries[1]).toEqual({
      title: 'Getting Started - Installation',
      url: './install.md',
      description: undefined,
    })
    expect(result.entries[2]).toEqual({
      title: 'API - Core API',
      url: './api/core.md',
      description: 'Main API reference',
    })
  })

  it('handles entries without section headers', () => {
    const content = `# Docs

- [Overview](./overview.md)`

    const result = parseLlmsTxt(content)
    expect(result.entries[0].title).toBe('Overview')
  })

  it('handles plain links on their own line', () => {
    const content = `# Docs

## Links

[Documentation](https://example.com/docs.md)`

    const result = parseLlmsTxt(content)
    expect(result.entries).toHaveLength(1)
    expect(result.entries[0].url).toBe('https://example.com/docs.md')
  })

  it('parses full llms.txt example', () => {
    const content = `# Vue.js Documentation

> The Progressive JavaScript Framework

## Essentials

- [Getting Started](./getting-started.md): Learn the basics
- [Components](./components.md): Build with components

## Advanced

- [Composition API](./composition-api.md)`

    const result = parseLlmsTxt(content)
    expect(result.title).toBe('Vue.js Documentation')
    expect(result.description).toBe('The Progressive JavaScript Framework')
    expect(result.entries).toHaveLength(3)
  })
})

describe('resolveUrl', () => {
  it('returns absolute URLs unchanged', () => {
    expect(resolveUrl('https://base.com', 'https://other.com/doc.md')).toBe(
      'https://other.com/doc.md',
    )
  })

  it('resolves relative URLs against base', () => {
    expect(resolveUrl('https://example.com/llms.txt', './docs/guide.md')).toBe(
      'https://example.com/docs/guide.md',
    )
  })

  it('resolves root-relative URLs', () => {
    expect(resolveUrl('https://example.com/path/llms.txt', '/docs/guide.md')).toBe(
      'https://example.com/docs/guide.md',
    )
  })
})

describe('extractDocUrls', () => {
  it('extracts and resolves all entry URLs', () => {
    const doc = {
      title: 'Test',
      entries: [
        { title: 'A', url: './a.md' },
        { title: 'B', url: 'https://other.com/b.md' },
        { title: 'C', url: '/c.md' },
      ],
    }
    const urls = extractDocUrls(doc, 'https://example.com/llms.txt')
    expect(urls).toEqual([
      'https://example.com/a.md',
      'https://other.com/b.md',
      'https://example.com/c.md',
    ])
  })
})
