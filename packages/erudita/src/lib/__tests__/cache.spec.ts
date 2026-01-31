import { existsSync, mkdirSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  _setCacheDir,
  cachePackage,
  clearCache,
  getCachedDoc,
  getCachedLlmsTxt,
  getCachedMeta,
  getCacheDir,
  isCached,
  listCached,
  removeFromCache,
} from '../cache.ts'

const testCacheDir = join(tmpdir(), 'erudita-test-cache-' + Date.now() + '-' + Math.random().toString(36).slice(2))

describe('cache', () => {
  beforeEach(() => {
    // Set custom cache dir for this test
    _setCacheDir(testCacheDir)
    if (existsSync(testCacheDir)) {
      rmSync(testCacheDir, { recursive: true, force: true })
    }
    mkdirSync(testCacheDir, { recursive: true })
  })

  afterEach(() => {
    _setCacheDir(null)
    if (existsSync(testCacheDir)) {
      rmSync(testCacheDir, { recursive: true, force: true })
    }
  })

  describe('getCacheDir', () => {
    it('returns the test cache directory', () => {
      expect(getCacheDir()).toBe(testCacheDir)
    })
  })

  describe('cachePackage', () => {
    it('caches package documentation', () => {
      const doc = {
        title: 'Test Package',
        description: 'A test',
        entries: [{ title: 'Guide', url: './guide.md' }],
      }
      const docFiles = new Map([['guide.md', '# Guide']])

      cachePackage('test-pkg', 'https://example.com', doc, '# llms.txt content', docFiles)

      expect(isCached('test-pkg')).toBe(true)
    })

    it('stores llms.txt raw content', () => {
      const doc = { title: 'Test', entries: [] }
      const rawContent = '# Raw llms.txt\n\n- [Link](./doc.md)'

      cachePackage('test-pkg', 'https://example.com', doc, rawContent, new Map())

      const cached = getCachedLlmsTxt('test-pkg')
      expect(cached).toBe(rawContent)
    })

    it('handles scoped packages', () => {
      const doc = { title: 'Scoped', entries: [] }
      cachePackage('@scope/pkg', 'https://example.com', doc, '# content', new Map())

      expect(isCached('@scope/pkg')).toBe(true)
      expect(getCachedMeta('@scope/pkg')).not.toBeNull()
    })
  })

  describe('getCachedMeta', () => {
    it('returns null for uncached packages', () => {
      expect(getCachedMeta('not-cached')).toBeNull()
    })

    it('returns metadata for cached packages', () => {
      const doc = {
        title: 'Test',
        entries: [{ title: 'API', url: './api.md' }],
      }
      cachePackage('meta-test', 'https://test.com', doc, '# Test\n\n- [API](./api.md)', new Map())

      const meta = getCachedMeta('meta-test')
      expect(meta).not.toBeNull()
      expect(meta?.name).toBe('meta-test')
      expect(meta?.sourceUrl).toBe('https://test.com')
      expect(meta?.fetchedAt).toBeGreaterThan(0)
    })
  })

  describe('getCachedDoc', () => {
    it('returns null for uncached packages', () => {
      expect(getCachedDoc('not-cached')).toBeNull()
    })

    it('parses llms.txt on demand', () => {
      const doc = {
        title: 'Test',
        entries: [{ title: 'API', url: './api.md' }],
      }
      cachePackage('doc-test', 'https://test.com', doc, '# Test Doc\n\n- [API Reference](./api.md)', new Map())

      const cachedDoc = getCachedDoc('doc-test')
      expect(cachedDoc).not.toBeNull()
      expect(cachedDoc?.title).toBe('Test Doc')
      expect(cachedDoc?.entries).toHaveLength(1)
      expect(cachedDoc?.entries[0].title).toBe('API Reference')
    })
  })

  describe('listCached', () => {
    it('returns empty array when no packages cached', () => {
      expect(listCached()).toEqual([])
    })

    it('returns all cached packages', () => {
      cachePackage('pkg1', 'https://a.com', { title: 'A', entries: [] }, '# A', new Map())
      cachePackage('pkg2', 'https://b.com', { title: 'B', entries: [] }, '# B', new Map())

      const cached = listCached()
      expect(cached).toHaveLength(2)
      expect(cached.map((p) => p.name).sort()).toEqual(['pkg1', 'pkg2'])
    })
  })

  describe('removeFromCache', () => {
    it('removes cached package', () => {
      cachePackage('to-remove', 'https://x.com', { title: 'X', entries: [] }, '# X', new Map())
      expect(isCached('to-remove')).toBe(true)

      const removed = removeFromCache('to-remove')
      expect(removed).toBe(true)
      expect(isCached('to-remove')).toBe(false)
    })

    it('returns false for non-existent package', () => {
      expect(removeFromCache('not-there')).toBe(false)
    })
  })

  describe('clearCache', () => {
    it('removes all cached packages', () => {
      cachePackage('pkg1', 'https://a.com', { title: 'A', entries: [] }, '# A', new Map())
      cachePackage('pkg2', 'https://b.com', { title: 'B', entries: [] }, '# B', new Map())

      clearCache()

      expect(listCached()).toEqual([])
      expect(existsSync(testCacheDir)).toBe(false)
    })
  })
})
