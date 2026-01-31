import { define } from 'gunshi'
import { getCachedDoc, listCached } from '../lib/cache.ts'

export default define({
  name: 'list',
  description: 'List all cached package documentation',
  args: {
    verbose: {
      type: 'boolean',
      short: 'v',
      description: 'Show detailed information',
    },
  },
  run: async (ctx) => {
    const { verbose = false } = ctx.values
    const packages = listCached()

    if (packages.length === 0) {
      console.log('No cached packages. Use `erudita fetch <package>` to cache documentation.')
      return
    }

    console.log(`Cached packages (${packages.length}):\n`)

    for (const pkg of packages) {
      const doc = getCachedDoc(pkg.name)
      const entriesCount = doc?.entries.length ?? 0
      if (verbose) {
        const date = new Date(pkg.fetchedAt).toLocaleString()
        console.log(`  ${pkg.name}`)
        console.log(`    Source: ${pkg.sourceUrl}`)
        console.log(`    Fetched: ${date}`)
        console.log(`    Entries: ${entriesCount}`)
        console.log()
      } else {
        console.log(`  ${pkg.name} (${entriesCount} docs)`)
      }
    }
  },
})
