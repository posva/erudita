import { existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { define } from 'gunshi'
import { cachePackage, isCached } from '../lib/cache.ts'
import { fetchPackageDocs } from '../lib/fetcher.ts'
import { resolvePackageUrl } from '../lib/npm-resolver.ts'

/**
 * Read package.json dependencies from cwd
 */
function readPackageJsonDeps(cwd: string): string[] {
  const pkgPath = join(cwd, 'package.json')
  if (!existsSync(pkgPath)) {
    return []
  }

  try {
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
    const deps = Object.keys(pkg.dependencies || {})
    const devDeps = Object.keys(pkg.devDependencies || {})
    return [...new Set([...deps, ...devDeps])]
  } catch {
    return []
  }
}

export default define({
  name: 'fetch',
  description: 'Fetch llms.txt documentation for packages',
  args: {
    all: {
      type: 'boolean',
      short: 'a',
      description: 'Fetch docs for all dependencies in package.json',
    },
    force: {
      type: 'boolean',
      short: 'f',
      description: 'Force refetch even if already cached',
    },
  },
  run: async (ctx) => {
    const { all = false, force = false } = ctx.values
    // Positional args are the package names (filter out the command name itself)
    let packagesToFetch = (ctx.positionals as string[]).filter((p) => p !== 'fetch')

    // If --all flag, read from package.json
    if (all) {
      const deps = readPackageJsonDeps(process.cwd())
      if (deps.length === 0) {
        console.log('No dependencies found in package.json')
        return
      }
      packagesToFetch = deps
    }

    // If no packages specified, show help
    if (packagesToFetch.length === 0) {
      console.log('Usage: erudita fetch <packages...> or erudita fetch --all')
      console.log('  Specify package names or use --all to fetch from package.json')
      return
    }

    console.log(`Fetching documentation for ${packagesToFetch.length} package(s)...\n`)

    let successCount = 0
    let skipCount = 0
    let failCount = 0

    for (const pkg of packagesToFetch) {
      // Check if already cached
      if (!force && isCached(pkg)) {
        console.log(`  [skip] ${pkg} (already cached, use --force to refetch)`)
        skipCount++
        continue
      }

      process.stdout.write(`  [....] ${pkg}`)

      // Resolve package URL
      const baseUrl = await resolvePackageUrl(pkg)
      if (!baseUrl) {
        process.stdout.write(`\r\x1b[K  [fail] ${pkg} - could not find website URL\n`)
        failCount++
        continue
      }

      // Fetch docs with progress
      let lastErrors = 0
      const result = await fetchPackageDocs(baseUrl, (event) => {
        if (event.phase === 'docs') {
          lastErrors = event.errors
          const errStr = event.errors > 0 ? ` (${event.errors} error${event.errors > 1 ? 's' : ''})` : ''
          const line = `  [${event.completed}/${event.total}] ${pkg}${errStr}`
          process.stdout.write(`\r\x1b[K${line}`)
        }
      })
      if (!result.success) {
        process.stdout.write(`\r\x1b[K  [fail] ${pkg} - ${result.error}\n`)
        failCount++
        continue
      }

      // Cache the docs
      cachePackage(pkg, baseUrl, result.doc!, result.rawLlmsTxt!, result.docFiles!)

      const docCount = result.docFiles?.size || 0
      const errStr = lastErrors > 0 ? `, ${lastErrors} error${lastErrors > 1 ? 's' : ''}` : ''
      process.stdout.write(`\r\x1b[K  [ ok ] ${pkg} (${docCount} docs${errStr})\n`)
      successCount++
    }

    console.log(`\nDone: ${successCount} fetched, ${skipCount} skipped, ${failCount} failed`)
  },
})
