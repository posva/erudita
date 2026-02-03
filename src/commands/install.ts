import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { define } from 'gunshi'
import { cachePackage, isCached, getPackageCacheDir } from '../lib/cache.ts'
import { fetchPackageDocs } from '../lib/fetcher.ts'
import { resolvePackageUrl } from '../lib/npm-resolver.ts'
import {
  parsePackageKey,
  getOrCreateProjectConfig,
  writeProjectConfig,
  createPackageLink,
  ensureGitignore,
  pruneProjectLinks,
} from '../lib/project.ts'

type DepsFilter = 'all' | 'dev' | 'prod'

/**
 * Read package.json dependencies from cwd
 */
function readPackageJsonDeps(cwd: string, filter: DepsFilter): string[] {
  const pkgPath = join(cwd, 'package.json')
  if (!existsSync(pkgPath)) {
    return []
  }

  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
    const deps = Object.keys(pkg.dependencies || {})
    const devDeps = Object.keys(pkg.devDependencies || {})
    switch (filter) {
      case 'prod':
        return deps
      case 'dev':
        return devDeps
      case 'all':
        return [...new Set([...deps, ...devDeps])]
    }
  } catch {
    return []
  }
}

export default define({
  name: 'install',
  description: 'Install llms.txt docs and link to project',
  args: {
    deps: {
      type: 'string',
      short: 'd',
      description: 'Install from package.json: dev, prod, or all',
    },
    force: {
      type: 'boolean',
      short: 'f',
      description: 'Force refetch even if cached',
    },
    concurrency: {
      type: 'string',
      short: 'c',
      description: 'Number of concurrent downloads (default: 5)',
    },
  },
  run: async (ctx) => {
    const { deps, force = false, concurrency: concurrencyStr } = ctx.values
    const concurrency = concurrencyStr ? parseInt(concurrencyStr, 10) : undefined
    const cwd = process.cwd()

    // Positional args are package names
    let packagesToInstall = (ctx.positionals as string[]).filter(
      (p) => p !== 'install' && p !== 'i',
    )

    // --deps: read from package.json
    if (deps) {
      const pkgDeps = readPackageJsonDeps(cwd, deps as DepsFilter)
      if (pkgDeps.length === 0) {
        console.log('No dependencies found in package.json')
        return
      }
      packagesToInstall = pkgDeps
    }

    // No args: install from erudita.json
    if (packagesToInstall.length === 0 && !deps) {
      const config = getOrCreateProjectConfig(cwd)
      const keys = Object.keys(config.packages)
      const removedLinks = pruneProjectLinks(cwd, new Set(keys))

      if (keys.length === 0) {
        if (removedLinks.length > 0) {
          console.log(`Removed ${removedLinks.length} package link(s) not in erudita.json.`)
        }
        console.log('Usage: erudita install <packages...>')
        console.log('       erudita install --deps <dev|prod|all> (from package.json)')
        console.log('\nNo packages in erudita.json yet.')
        return
      }

      if (removedLinks.length > 0) {
        console.log(`Removed ${removedLinks.length} package link(s) not in erudita.json.\n`)
      }

      console.log(`Installing ${keys.length} package(s) from erudita.json...\n`)

      let successCount = 0
      let failCount = 0

      for (const packageKey of keys) {
        const { url } = config.packages[packageKey]
        const cached = isCached(packageKey)

        if (cached && !force) {
          // Already cached, just create symlink
          createPackageLink(cwd, packageKey)
          console.log(`  [link] ${packageKey}`)
          successCount++
          continue
        }

        // Fetch and cache
        process.stdout.write(`  [....] ${packageKey}`)

        let lastErrors = 0
        const result = await fetchPackageDocs(url, {
          concurrency,
          onProgress(event) {
            if (event.phase === 'docs') {
              lastErrors = event.errors
              const errStr =
                event.errors > 0 ? ` (${event.errors} error${event.errors > 1 ? 's' : ''})` : ''
              const line = `  [${event.completed}/${event.total}] ${packageKey}${errStr}`
              process.stdout.write(`\r\x1b[K${line}`)
            }
          },
        })

        if (!result.success) {
          process.stdout.write(`\r\x1b[K  [fail] ${packageKey} - ${result.error}\n`)
          failCount++
          continue
        }

        cachePackage(packageKey, url, result.doc!, result.rawLlmsTxt!, result.docFiles!)
        createPackageLink(cwd, packageKey)

        const docCount = result.docFiles?.size || 0
        const errStr = lastErrors > 0 ? `, ${lastErrors} error${lastErrors > 1 ? 's' : ''}` : ''
        process.stdout.write(`\r\x1b[K  [ ok ] ${packageKey} (${docCount} docs${errStr})\n`)
        successCount++
      }

      ensureGitignore(cwd)
      console.log(`\nDone: ${successCount} installed, ${failCount} failed`)
      return
    }

    // Installing specific packages
    console.log(`Installing ${packagesToInstall.length} package(s)...\n`)

    const config = getOrCreateProjectConfig(cwd)
    let successCount = 0
    let failCount = 0

    for (const pkg of packagesToInstall) {
      const { name, version } = parsePackageKey(pkg)
      const packageKey = pkg // Use full key including version

      // Check if already cached
      if (!force && isCached(packageKey)) {
        // Already cached - ensure in config and create symlink
        if (!config.packages[packageKey]) {
          // Need to resolve URL for config
          const url = await resolvePackageUrl(name)
          if (url) {
            config.packages[packageKey] = { url }
          }
        }
        createPackageLink(cwd, packageKey)
        console.log(`  [link] ${packageKey} (already cached)`)
        successCount++
        continue
      }

      process.stdout.write(`  [....] ${packageKey}`)

      // Resolve URL from npm if not in config
      let url = config.packages[packageKey]?.url
      if (!url) {
        url = await resolvePackageUrl(name)
        if (!url) {
          process.stdout.write(`\r\x1b[K  [fail] ${packageKey} - could not find website URL\n`)
          failCount++
          continue
        }
      }

      // Fetch docs with progress
      let lastErrors = 0
      const result = await fetchPackageDocs(url, {
        concurrency,
        onProgress(event) {
          if (event.phase === 'docs') {
            lastErrors = event.errors
            const errStr =
              event.errors > 0 ? ` (${event.errors} error${event.errors > 1 ? 's' : ''})` : ''
            const line = `  [${event.completed}/${event.total}] ${packageKey}${errStr}`
            process.stdout.write(`\r\x1b[K${line}`)
          }
        },
      })

      if (!result.success) {
        process.stdout.write(`\r\x1b[K  [fail] ${packageKey} - ${result.error}\n`)
        failCount++
        continue
      }

      // Cache and link
      cachePackage(packageKey, url, result.doc!, result.rawLlmsTxt!, result.docFiles!)
      config.packages[packageKey] = { url }
      createPackageLink(cwd, packageKey)

      const docCount = result.docFiles?.size || 0
      const errStr = lastErrors > 0 ? `, ${lastErrors} error${lastErrors > 1 ? 's' : ''}` : ''
      process.stdout.write(`\r\x1b[K  [ ok ] ${packageKey} (${docCount} docs${errStr})\n`)
      successCount++
    }

    // Save config and ensure gitignore
    writeProjectConfig(cwd, config)
    ensureGitignore(cwd)

    console.log(`\nDone: ${successCount} installed, ${failCount} failed`)
  },
})
