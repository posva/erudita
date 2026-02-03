import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { homedir, platform } from 'node:os'
import { join } from 'node:path'
import type { CachedPackageMeta, LlmsDoc } from '../types.ts'
import { parseLlmsTxt } from './llms-parser.ts'

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
 * Get path to a package's cache directory
 * Supports versioned keys like "vue@3.4.0" and scoped packages "@scope/name"
 */
export function getPackageCacheDir(packageKey: string): string {
  // Handle scoped packages: @scope/name -> @scope__name
  // The full key (including version) becomes the folder name
  const safeName = packageKey.replace('/', '__')
  return join(getCacheDir(), 'packages', safeName)
}

// Internal alias for backwards compatibility
function getPackageDir(packageName: string): string {
  return getPackageCacheDir(packageName)
}

/**
 * Check if a package is cached
 */
export function isCached(packageName: string): boolean {
  return existsSync(getPackageDir(packageName))
}

/**
 * Get cached package metadata
 */
export function getCachedMeta(packageName: string): CachedPackageMeta | null {
  const packageDir = getPackageDir(packageName)
  const metaPath = join(packageDir, 'meta.json')
  if (!existsSync(metaPath)) {
    return null
  }
  try {
    return JSON.parse(readFileSync(metaPath, 'utf-8'))
  } catch {
    return null
  }
}

/**
 * Get cached parsed doc (parses llms.txt on demand)
 */
export function getCachedDoc(packageName: string): LlmsDoc | null {
  const content = getCachedLlmsTxt(packageName)
  if (!content) {
    return null
  }
  return parseLlmsTxt(content)
}

/**
 * List all cached packages
 */
export function listCached(): CachedPackageMeta[] {
  const packagesDir = join(getCacheDir(), 'packages')
  if (!existsSync(packagesDir)) {
    return []
  }
  const dirs = readdirSync(packagesDir, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)

  const result: CachedPackageMeta[] = []
  for (const dir of dirs) {
    // Convert back: @scope__name -> @scope/name
    const packageName = dir.replace('__', '/')
    const meta = getCachedMeta(packageName)
    if (meta) {
      result.push(meta)
    }
  }
  return result
}

/**
 * Cache a package's documentation
 */
export function cachePackage(
  packageName: string,
  sourceUrl: string,
  _doc: LlmsDoc,
  rawLlmsTxt: string,
  docFiles: Map<string, string>,
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

  // Write package metadata (minimal - doc is parsed on demand from llms.txt)
  const meta: CachedPackageMeta = {
    name: packageName,
    sourceUrl,
    fetchedAt: Date.now(),
  }
  writeFileSync(join(packageDir, 'meta.json'), JSON.stringify(meta, null, 2))
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
