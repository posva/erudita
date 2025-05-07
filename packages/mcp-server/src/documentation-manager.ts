import fs from 'node:fs/promises'
import path from 'node:path'

type ErrorWithCode = Error & {
  code?: string
}

interface DocumentationInfo {
  name: string
  version: string
  lastUpdated: string
  paths: string[]
}

type CacheEntry = {
  info: DocumentationInfo
  content: Record<string, string>
}

export class DocumentationManager {
  readonly cacheDir: string
  private cache: Map<string, CacheEntry> = new Map()

  constructor(options: { cacheDir: string }) {
    this.cacheDir = options.cacheDir
  }

  async initialize() {
    try {
      await fs.mkdir(this.cacheDir, { recursive: true })
      await this.loadCache()
    } catch (error) {
      console.error('Failed to initialize DocumentationManager:', error)
      throw error
    }
  }

  private getPackageKey(packageName: string, version?: string): string {
    return version ? `${packageName}@${version}` : packageName
  }

  private getPackageDir(packageName: string, version?: string): string {
    const packageKey = this.getPackageKey(packageName, version)
    return path.join(this.cacheDir, packageKey)
  }

  private async loadCache(): Promise<void> {
    try {
      const entries = await fs.readdir(this.cacheDir, { withFileTypes: true })

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const cachePath = path.join(this.cacheDir, entry.name, 'cache.json')
          try {
            const data = await fs.readFile(cachePath, 'utf-8')
            const cacheEntry = JSON.parse(data) as CacheEntry
            this.cache.set(entry.name, cacheEntry)
          } catch (error) {
            console.warn(`Failed to load cache for ${entry.name}:`, error)
          }
        }
      }
    } catch (error) {
      const err = error as ErrorWithCode
      if (err.code !== 'ENOENT') {
        throw error
      }
    }
  }

  private async saveToCache(
    packageName: string,
    version: string,
    info: DocumentationInfo,
    content: Record<string, string>,
  ) {
    const packageKey = this.getPackageKey(packageName, version)
    const packageDir = this.getPackageDir(packageName, version)
    const cacheEntry: CacheEntry = { info, content }

    await fs.mkdir(packageDir, { recursive: true })
    await fs.writeFile(
      path.join(packageDir, 'cache.json'),
      JSON.stringify(cacheEntry, null, 2),
      'utf-8',
    )

    this.cache.set(packageKey, cacheEntry)
  }

  async listDocumentation(): Promise<
    Array<{
      name: string
      version: string
      lastUpdated: string
      paths: string[]
    }>
  > {
    return Array.from(this.cache.values()).map((entry) => entry.info)
  }

  async updateDocumentation(packageName: string, version?: string): Promise<void> {
    const packageKey = this.getPackageKey(packageName, version)
    const packageDir = this.getPackageDir(packageName, version)

    try {
      // In a real implementation, this would fetch documentation from the package
      // For now, we'll just create a mock implementation
      const docInfo: DocumentationInfo = {
        name: packageName,
        version: version || 'latest',
        lastUpdated: new Date().toISOString(),
        paths: ['index.md', 'api.md'], // Mock paths
      }

      const content: Record<string, string> = {
        'index.md': `# ${packageName} Documentation\n\nThis is the documentation for ${packageName}${version ? `@${version}` : ''}.`,
        'api.md': `# ${packageName} API Reference\n\nAPI documentation for ${packageName}.`,
      }

      await this.saveToCache(packageName, version || 'latest', docInfo, content)
    } catch (error) {
      console.error(`Failed to update documentation for ${packageKey}:`, error)
      throw error
    }
  }

  async getDocumentation(
    packageName: string,
    version: string | undefined,
    docPath: string,
  ): Promise<string> {
    const packageKey = this.getPackageKey(packageName, version)
    const cacheEntry = this.cache.get(packageKey)

    if (!cacheEntry) {
      throw new Error(
        `Documentation for ${packageKey} not found. Please update documentation first.`,
      )
    }

    const content = cacheEntry.content[docPath]
    if (content === undefined) {
      throw new Error(`Documentation path ${docPath} not found in ${packageKey}`)
    }

    return content
  }
}
