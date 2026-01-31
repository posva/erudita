import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, platform } from 'node:os'
import { join } from 'node:path'
import type { CachedPackageMeta, CacheIndex, LlmsDoc } from '../types.ts'

const APP_NAME = 'erudita'

// Allow overriding for tests
let _customCacheDir: string | null = null

/**
 * Set a custom cache directory (for testing)
 */
export function _setCacheDir(dir: string | null): void {
  _customCacheDir = dir
}

/**
 * Get the XDG cache directory for the current platform
 */
export function getCacheDir(): string {
  if (_customCacheDir) {
    return _customCacheDir
  }

  const home = homedir()

  if (platform() === 'darwin') {
    return join(home, 'Library', 'Caches', APP_NAME)
  }

  if (platform() === 'win32') {
    return join(process.env.LOCALAPPDATA || join(home, 'AppData', 'Local'), APP_NAME, 'Cache')
  }

  // Linux/Unix: follow XDG spec
  return join(process.env.XDG_CACHE_HOME || join(home, '.cache'), APP_NAME)
}

/**
 * Ensure the cache directory exists
 */
export function ensureCacheDir(): string {
  const cacheDir = getCacheDir()
  if (!existsSync(cacheDir)) {
    mkdirSync(cacheDir, { recursive: true })
  }
  return cacheDir
}

/**
 * Get path to the cache index file
 */
function getIndexPath(): string {
  return join(getCacheDir(), 'meta.json')
}

/**
 * Get path to a package's cache directory
 */
function getPackageDir(packageName: string): string {
  // Handle scoped packages: @scope/name -> @scope__name
  const safeName = packageName.replace('/', '__')
  return join(getCacheDir(), 'packages', safeName)
}

/**
 * Read the cache index
 */
export function readIndex(): CacheIndex {
  const indexPath = getIndexPath()
  if (!existsSync(indexPath)) {
    return { packages: {} }
  }
  try {
    return JSON.parse(readFileSync(indexPath, 'utf-8'))
  } catch {
    return { packages: {} }
  }
}

/**
 * Write the cache index
 */
export function writeIndex(index: CacheIndex): void {
  ensureCacheDir()
  writeFileSync(getIndexPath(), JSON.stringify(index, null, 2))
}

/**
 * Check if a package is cached
 */
export function isCached(packageName: string): boolean {
  const index = readIndex()
  return packageName in index.packages
}

/**
 * Get cached package metadata
 */
export function getCachedMeta(packageName: string): CachedPackageMeta | null {
  const index = readIndex()
  return index.packages[packageName] ?? null
}

/**
 * List all cached packages
 */
export function listCached(): CachedPackageMeta[] {
  const index = readIndex()
  return Object.values(index.packages)
}

/**
 * Cache a package's documentation
 */
export function cachePackage(
  packageName: string,
  sourceUrl: string,
  doc: LlmsDoc,
  rawLlmsTxt: string,
  docFiles: Map<string, string>
): void {
  const packageDir = getPackageDir(packageName)
  const docsDir = join(packageDir, 'docs')

  // Create directories
  mkdirSync(docsDir, { recursive: true })

  // Write raw llms.txt
  writeFileSync(join(packageDir, 'llms.txt'), rawLlmsTxt)

  // Write individual doc files
  for (const [filename, content] of docFiles) {
    const safeName = filename.replace(/[/\\]/g, '_')
    writeFileSync(join(docsDir, safeName), content)
  }

  // Write package metadata
  const meta: CachedPackageMeta = {
    name: packageName,
    sourceUrl,
    fetchedAt: Date.now(),
    doc,
  }
  writeFileSync(join(packageDir, 'meta.json'), JSON.stringify(meta, null, 2))

  // Update index
  const index = readIndex()
  index.packages[packageName] = meta
  writeIndex(index)
}

/**
 * Get the raw llms.txt content for a package
 */
export function getCachedLlmsTxt(packageName: string): string | null {
  const packageDir = getPackageDir(packageName)
  const llmsPath = join(packageDir, 'llms.txt')
  if (!existsSync(llmsPath)) {
    return null
  }
  return readFileSync(llmsPath, 'utf-8')
}

/**
 * Get a cached doc file for a package
 */
export function getCachedDocFile(packageName: string, filename: string): string | null {
  const packageDir = getPackageDir(packageName)
  const safeName = filename.replace(/[/\\]/g, '_')
  const docPath = join(packageDir, 'docs', safeName)
  if (!existsSync(docPath)) {
    return null
  }
  return readFileSync(docPath, 'utf-8')
}

/**
 * Remove a package from cache
 */
export function removeFromCache(packageName: string): boolean {
  const packageDir = getPackageDir(packageName)
  if (!existsSync(packageDir)) {
    return false
  }

  rmSync(packageDir, { recursive: true, force: true })

  // Update index
  const index = readIndex()
  delete index.packages[packageName]
  writeIndex(index)

  return true
}

/**
 * Clear all cached packages
 */
export function clearCache(): void {
  const cacheDir = getCacheDir()
  if (existsSync(cacheDir)) {
    rmSync(cacheDir, { recursive: true, force: true })
  }
}
