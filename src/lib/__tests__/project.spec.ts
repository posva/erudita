import { existsSync, lstatSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { _setCacheDir } from '../cache.ts'
import {
  buildPackageKey,
  createPackageLink,
  ensureGitignore,
  getOrCreateProjectConfig,
  isInGitignore,
  parsePackageKey,
  pruneProjectLinks,
  readProjectConfig,
  removePackageLink,
  writeProjectConfig,
} from '../project.ts'

const testDir = join(
  tmpdir(),
  'erudita-test-project-' + Date.now() + '-' + Math.random().toString(36).slice(2),
)
const testCacheDir = join(
  tmpdir(),
  'erudita-test-cache-' + Date.now() + '-' + Math.random().toString(36).slice(2),
)

describe('project', () => {
  beforeEach(() => {
    _setCacheDir(testCacheDir)
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
    if (existsSync(testCacheDir)) {
      rmSync(testCacheDir, { recursive: true, force: true })
    }
    mkdirSync(testDir, { recursive: true })
    mkdirSync(testCacheDir, { recursive: true })
  })

  afterEach(() => {
    _setCacheDir(null)
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
    if (existsSync(testCacheDir)) {
      rmSync(testCacheDir, { recursive: true, force: true })
    }
  })

  describe('parsePackageKey', () => {
    it('parses simple package name', () => {
      const result = parsePackageKey('pinia')
      expect(result).toEqual({ name: 'pinia', version: null })
    })

    it('parses versioned package', () => {
      const result = parsePackageKey('vue@3.4.0')
      expect(result).toEqual({ name: 'vue', version: '3.4.0' })
    })

    it('parses scoped package', () => {
      const result = parsePackageKey('@vue/test-utils')
      expect(result).toEqual({ name: '@vue/test-utils', version: null })
    })

    it('parses scoped versioned package', () => {
      const result = parsePackageKey('@vue/test-utils@2.0.0')
      expect(result).toEqual({ name: '@vue/test-utils', version: '2.0.0' })
    })
  })

  describe('buildPackageKey', () => {
    it('builds key without version', () => {
      expect(buildPackageKey('pinia', null)).toBe('pinia')
    })

    it('builds key with version', () => {
      expect(buildPackageKey('vue', '3.4.0')).toBe('vue@3.4.0')
    })
  })

  describe('readProjectConfig / writeProjectConfig', () => {
    it('returns null for missing config', () => {
      expect(readProjectConfig(testDir)).toBeNull()
    })

    it('reads existing config', () => {
      const config = { packages: { vue: { url: 'https://vuejs.org/llms.txt' } } }
      writeFileSync(join(testDir, 'erudita.json'), JSON.stringify(config))

      expect(readProjectConfig(testDir)).toEqual(config)
    })

    it('writes config with trailing newline', () => {
      const config = { packages: { pinia: { url: 'https://pinia.vuejs.org/llms.txt' } } }
      writeProjectConfig(testDir, config)

      const content = readFileSync(join(testDir, 'erudita.json'), 'utf-8')
      expect(content.endsWith('\n')).toBe(true)
      expect(JSON.parse(content)).toEqual(config)
    })

    it('returns null for invalid JSON', () => {
      writeFileSync(join(testDir, 'erudita.json'), 'not valid json')
      expect(readProjectConfig(testDir)).toBeNull()
    })
  })

  describe('getOrCreateProjectConfig', () => {
    it('returns existing config', () => {
      const config = { packages: { vue: { url: 'https://vuejs.org/llms.txt' } } }
      writeFileSync(join(testDir, 'erudita.json'), JSON.stringify(config))

      expect(getOrCreateProjectConfig(testDir)).toEqual(config)
    })

    it('returns empty config when missing', () => {
      expect(getOrCreateProjectConfig(testDir)).toEqual({ packages: {} })
    })
  })

  describe('createPackageLink', () => {
    it('creates symlink to cache dir', () => {
      const packageKey = 'vue'
      const cacheDir = join(testCacheDir, 'packages', packageKey)
      mkdirSync(cacheDir, { recursive: true })

      createPackageLink(testDir, packageKey)

      const linkPath = join(testDir, '.erudita', packageKey)
      expect(existsSync(linkPath)).toBe(true)
      expect(lstatSync(linkPath).isSymbolicLink()).toBe(true)
    })

    it('replaces existing symlink', () => {
      const packageKey = 'pinia'
      const cacheDir = join(testCacheDir, 'packages', packageKey)
      mkdirSync(cacheDir, { recursive: true })

      createPackageLink(testDir, packageKey)
      createPackageLink(testDir, packageKey)

      const linkPath = join(testDir, '.erudita', packageKey)
      expect(existsSync(linkPath)).toBe(true)
      expect(lstatSync(linkPath).isSymbolicLink()).toBe(true)
    })

    it('handles scoped packages', () => {
      const packageKey = '@vue/test-utils'
      const cacheDir = join(testCacheDir, 'packages', '@vue__test-utils')
      mkdirSync(cacheDir, { recursive: true })

      createPackageLink(testDir, packageKey)

      const linkPath = join(testDir, '.erudita', '@vue__test-utils')
      expect(existsSync(linkPath)).toBe(true)
      expect(lstatSync(linkPath).isSymbolicLink()).toBe(true)
    })

    it('copies cache dir when mode is copy', () => {
      const packageKey = 'vite'
      const cacheDir = join(testCacheDir, 'packages', packageKey)
      mkdirSync(cacheDir, { recursive: true })
      writeFileSync(join(cacheDir, 'llms.txt'), 'docs')

      createPackageLink(testDir, packageKey, 'copy')

      const linkPath = join(testDir, '.erudita', packageKey)
      expect(existsSync(linkPath)).toBe(true)
      expect(lstatSync(linkPath).isSymbolicLink()).toBe(false)
      expect(lstatSync(linkPath).isDirectory()).toBe(true)
      expect(readFileSync(join(linkPath, 'llms.txt'), 'utf-8')).toBe('docs')
    })

    it('replaces existing symlink with a copy', () => {
      const packageKey = 'nuxt'
      const cacheDir = join(testCacheDir, 'packages', packageKey)
      mkdirSync(cacheDir, { recursive: true })

      createPackageLink(testDir, packageKey)
      createPackageLink(testDir, packageKey, 'copy')

      const linkPath = join(testDir, '.erudita', packageKey)
      expect(existsSync(linkPath)).toBe(true)
      expect(lstatSync(linkPath).isSymbolicLink()).toBe(false)
      expect(lstatSync(linkPath).isDirectory()).toBe(true)
    })

    it('replaces existing copy with a symlink', () => {
      const packageKey = 'vue-demi'
      const cacheDir = join(testCacheDir, 'packages', packageKey)
      mkdirSync(cacheDir, { recursive: true })

      createPackageLink(testDir, packageKey, 'copy')
      createPackageLink(testDir, packageKey)

      const linkPath = join(testDir, '.erudita', packageKey)
      expect(existsSync(linkPath)).toBe(true)
      expect(lstatSync(linkPath).isSymbolicLink()).toBe(true)
    })
  })

  describe('removePackageLink', () => {
    it('removes an existing symlink', () => {
      const packageKey = 'vue'
      const cacheDir = join(testCacheDir, 'packages', packageKey)
      mkdirSync(cacheDir, { recursive: true })

      createPackageLink(testDir, packageKey)
      const removed = removePackageLink(testDir, packageKey)

      const linkPath = join(testDir, '.erudita', packageKey)
      expect(removed).toBe(true)
      expect(existsSync(linkPath)).toBe(false)
    })

    it('removes an existing copied directory', () => {
      const packageKey = 'vite'
      const cacheDir = join(testCacheDir, 'packages', packageKey)
      mkdirSync(cacheDir, { recursive: true })

      createPackageLink(testDir, packageKey, 'copy')
      const removed = removePackageLink(testDir, packageKey)

      const linkPath = join(testDir, '.erudita', packageKey)
      expect(removed).toBe(true)
      expect(existsSync(linkPath)).toBe(false)
    })

    it('returns false for missing links', () => {
      expect(removePackageLink(testDir, 'pinia')).toBe(false)
    })
  })

  describe('pruneProjectLinks', () => {
    it('removes links not present in config', () => {
      const vueKey = 'vue'
      const scopedKey = '@vue/test-utils'
      mkdirSync(join(testCacheDir, 'packages', vueKey), { recursive: true })
      mkdirSync(join(testCacheDir, 'packages', '@vue__test-utils'), { recursive: true })

      createPackageLink(testDir, vueKey)
      createPackageLink(testDir, scopedKey)

      const removed = pruneProjectLinks(testDir, new Set([scopedKey]))

      expect(removed).toEqual([vueKey])
      expect(existsSync(join(testDir, '.erudita', vueKey))).toBe(false)
      expect(existsSync(join(testDir, '.erudita', '@vue__test-utils'))).toBe(true)
    })

    it('removes copied directories not present in config', () => {
      const vueKey = 'vue'
      const piniaKey = 'pinia'
      mkdirSync(join(testCacheDir, 'packages', vueKey), { recursive: true })
      mkdirSync(join(testCacheDir, 'packages', piniaKey), { recursive: true })

      createPackageLink(testDir, vueKey, 'copy')
      createPackageLink(testDir, piniaKey, 'copy')

      const removed = pruneProjectLinks(testDir, new Set([piniaKey]))

      expect(removed).toEqual([vueKey])
      expect(existsSync(join(testDir, '.erudita', vueKey))).toBe(false)
      expect(existsSync(join(testDir, '.erudita', piniaKey))).toBe(true)
    })
  })

  describe('isInGitignore', () => {
    it('returns false when .gitignore missing', () => {
      expect(isInGitignore(testDir)).toBe(false)
    })

    it('returns false when .erudita not in gitignore', () => {
      writeFileSync(join(testDir, '.gitignore'), 'node_modules\n')
      expect(isInGitignore(testDir)).toBe(false)
    })

    it('detects .erudita in gitignore', () => {
      writeFileSync(join(testDir, '.gitignore'), 'node_modules\n.erudita\n')
      expect(isInGitignore(testDir)).toBe(true)
    })

    it('detects .erudita/ in gitignore', () => {
      writeFileSync(join(testDir, '.gitignore'), '.erudita/\n')
      expect(isInGitignore(testDir)).toBe(true)
    })

    it('detects /.erudita in gitignore', () => {
      writeFileSync(join(testDir, '.gitignore'), '/.erudita\n')
      expect(isInGitignore(testDir)).toBe(true)
    })
  })

  describe('ensureGitignore', () => {
    it('creates .gitignore if missing', () => {
      ensureGitignore(testDir)

      const content = readFileSync(join(testDir, '.gitignore'), 'utf-8')
      expect(content).toBe('.erudita\n')
    })

    it('appends to existing .gitignore', () => {
      writeFileSync(join(testDir, '.gitignore'), 'node_modules\n')

      ensureGitignore(testDir)

      const content = readFileSync(join(testDir, '.gitignore'), 'utf-8')
      expect(content).toBe('node_modules\n.erudita\n')
    })

    it('appends newline if missing', () => {
      writeFileSync(join(testDir, '.gitignore'), 'node_modules')

      ensureGitignore(testDir)

      const content = readFileSync(join(testDir, '.gitignore'), 'utf-8')
      expect(content).toBe('node_modules\n.erudita\n')
    })

    it('skips if already present', () => {
      writeFileSync(join(testDir, '.gitignore'), 'node_modules\n.erudita\n')

      ensureGitignore(testDir)

      const content = readFileSync(join(testDir, '.gitignore'), 'utf-8')
      expect(content).toBe('node_modules\n.erudita\n')
    })

    it('skips if .erudita/ already present', () => {
      writeFileSync(join(testDir, '.gitignore'), '.erudita/\n')

      ensureGitignore(testDir)

      const content = readFileSync(join(testDir, '.gitignore'), 'utf-8')
      expect(content).toBe('.erudita/\n')
    })
  })
})
