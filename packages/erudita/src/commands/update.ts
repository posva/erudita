import { define } from 'gunshi'
import { cachePackage, getCachedMeta, listCached } from '../lib/cache.ts'
import { fetchPackageDocs } from '../lib/fetcher.ts'

export default define({
  name: 'update',
  description: 'Refresh cached documentation for packages',
  args: {
    all: {
      type: 'boolean',
      short: 'a',
      description: 'Update all cached packages',
    },
  },
  run: async (ctx) => {
    const { all = false } = ctx.values
    let packagesToUpdate = (ctx.positionals as string[]).filter((p) => p !== 'update')

    // If --all flag, update all cached packages
    if (all) {
      const cached = listCached()
      packagesToUpdate = cached.map((p) => p.name)
    }

    // If no packages and no --all, default to showing usage
    if (packagesToUpdate.length === 0) {
      const cached = listCached()
      if (cached.length === 0) {
        console.log('No cached packages to update.')
        console.log('Use `erudita fetch <package>` to cache documentation first.')
      } else {
        console.log('Usage: erudita update <packages...> or erudita update --all')
        console.log(`\nCached packages (${cached.length}):`)
        cached.forEach((p) => console.log(`  ${p.name}`))
      }
      return
    }

    console.log(`Updating documentation for ${packagesToUpdate.length} package(s)...\n`)

    let successCount = 0
    let failCount = 0

    for (const pkg of packagesToUpdate) {
      const meta = getCachedMeta(pkg)
      if (!meta) {
        console.log(`  [skip] ${pkg} - not cached`)
        continue
      }

      process.stdout.write(`  [....] ${pkg}`)

      // Fetch fresh docs using the stored source URL
      const result = await fetchPackageDocs(meta.sourceUrl)
      if (!result.success) {
        process.stdout.write(`\r  [fail] ${pkg} - ${result.error}\n`)
        failCount++
        continue
      }

      // Update cache
      cachePackage(pkg, meta.sourceUrl, result.doc!, result.rawLlmsTxt!, result.docFiles!)

      const docCount = result.docFiles?.size || 0
      process.stdout.write(`\r  [ ok ] ${pkg} (${docCount} docs)\n`)
      successCount++
    }

    console.log(`\nDone: ${successCount} updated, ${failCount} failed`)
  },
})
