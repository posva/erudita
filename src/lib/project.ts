import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  lstatSync,
  rmSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs'
import { join } from 'node:path'
import type { EruditaProject, ParsedPackageKey, ProjectLinkMode } from '../types.ts'
import { getPackageCacheDir } from './cache.ts'

const PROJECT_CONFIG_FILE = 'erudita.json'
const PROJECT_LINK_DIR = '.erudita'

/**
 * Parse package key into name and optional version
 * "vue@3.4.0" -> { name: "vue", version: "3.4.0" }
 * "pinia" -> { name: "pinia", version: null }
 * "@vue/test-utils@2.0.0" -> { name: "@vue/test-utils", version: "2.0.0" }
 */
export function parsePackageKey(key: string): ParsedPackageKey {
  // Handle scoped packages: @scope/name@version
  if (key.startsWith('@')) {
    const slashIndex = key.indexOf('/')
    if (slashIndex !== -1) {
      const afterSlash = key.slice(slashIndex + 1)
      const atIndex = afterSlash.indexOf('@')
      if (atIndex !== -1) {
        return {
          name: key.slice(0, slashIndex + 1 + atIndex),
          version: afterSlash.slice(atIndex + 1),
        }
      }
    }
    return { name: key, version: null }
  }

  // Regular packages: name@version
  const atIndex = key.indexOf('@')
  if (atIndex !== -1) {
    return {
      name: key.slice(0, atIndex),
      version: key.slice(atIndex + 1),
    }
  }

  return { name: key, version: null }
}

/**
 * Build package key from name and optional version
 */
export function buildPackageKey(name: string, version: string | null): string {
  return version ? `${name}@${version}` : name
}

/**
 * Read erudita.json from project directory
 */
export function readProjectConfig(cwd: string): EruditaProject | null {
  const configPath = join(cwd, PROJECT_CONFIG_FILE)
  if (!existsSync(configPath)) {
    return null
  }
  try {
    return JSON.parse(readFileSync(configPath, 'utf-8'))
  } catch {
    return null
  }
}

/**
 * Write erudita.json to project directory
 */
export function writeProjectConfig(cwd: string, config: EruditaProject): void {
  const configPath = join(cwd, PROJECT_CONFIG_FILE)
  writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n')
}

/**
 * Get or create project config
 */
export function getOrCreateProjectConfig(cwd: string): EruditaProject {
  const existing = readProjectConfig(cwd)
  if (existing) {
    return existing
  }
  return { packages: {} }
}

/**
 * Get path to project .erudita directory
 */
export function getProjectLinkDir(cwd: string): string {
  return join(cwd, PROJECT_LINK_DIR)
}

/**
 * Ensure .erudita directory exists
 */
export function ensureProjectLinkDir(cwd: string): string {
  const linkDir = getProjectLinkDir(cwd)
  if (!existsSync(linkDir)) {
    mkdirSync(linkDir, { recursive: true })
  }
  return linkDir
}

/**
 * Create a symlink or a copy from .erudita/<key> to the global cache
 */
export function createPackageLink(
  cwd: string,
  packageKey: string,
  mode: ProjectLinkMode = 'link',
): void {
  const linkDir = ensureProjectLinkDir(cwd)
  const linkPath = join(linkDir, packageKey.replace('/', '__'))
  const targetPath = getPackageCacheDir(packageKey)

  // Remove existing entry if present
  if (existsSync(linkPath)) {
    const stats = lstatSync(linkPath)
    if (stats.isDirectory()) {
      rmSync(linkPath, { recursive: true, force: true })
    } else {
      unlinkSync(linkPath)
    }
  }

  if (mode === 'copy') {
    cpSync(targetPath, linkPath, { recursive: true })
    return
  }

  symlinkSync(targetPath, linkPath, 'dir')
}

/**
 * Remove symlink from .erudita/<key>
 */
export function removePackageLink(cwd: string, packageKey: string): boolean {
  const linkDir = getProjectLinkDir(cwd)
  const linkPath = join(linkDir, packageKey.replace('/', '__'))
  if (!existsSync(linkPath)) {
    return false
  }

  const stats = lstatSync(linkPath)
  if (stats.isDirectory()) {
    rmSync(linkPath, { recursive: true, force: true })
  } else {
    unlinkSync(linkPath)
  }
  return true
}

/**
 * Remove .erudita links not present in the provided set of keys
 */
export function pruneProjectLinks(cwd: string, keepKeys: Set<string>): string[] {
  const linkDir = getProjectLinkDir(cwd)
  if (!existsSync(linkDir)) {
    return []
  }

  const removed: string[] = []
  const entries = readdirSync(linkDir)
  for (const entry of entries) {
    const packageKey = entry.replace('__', '/')
    if (keepKeys.has(packageKey)) {
      continue
    }

    const linkPath = join(linkDir, entry)
    const stats = lstatSync(linkPath)
    if (stats.isDirectory()) {
      rmSync(linkPath, { recursive: true, force: true })
    } else {
      unlinkSync(linkPath)
    }
    removed.push(packageKey)
  }

  return removed
}

/**
 * Check if .erudita is in .gitignore
 */
export function isInGitignore(cwd: string): boolean {
  const gitignorePath = join(cwd, '.gitignore')
  if (!existsSync(gitignorePath)) {
    return false
  }

  const content = readFileSync(gitignorePath, 'utf-8')
  const lines = content.split('\n')
  return lines.some((line) => {
    const trimmed = line.trim()
    return trimmed === '.erudita' || trimmed === '.erudita/' || trimmed === '/.erudita'
  })
}

/**
 * Add .erudita to .gitignore if not already present
 */
export function ensureGitignore(cwd: string): void {
  if (isInGitignore(cwd)) {
    return
  }

  const gitignorePath = join(cwd, '.gitignore')

  if (existsSync(gitignorePath)) {
    const content = readFileSync(gitignorePath, 'utf-8')
    const newContent = content.endsWith('\n') ? content + '.erudita\n' : content + '\n.erudita\n'
    writeFileSync(gitignorePath, newContent)
  } else {
    writeFileSync(gitignorePath, '.erudita\n')
  }
}
