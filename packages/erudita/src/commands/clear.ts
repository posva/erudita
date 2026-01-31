import { define } from 'gunshi'
import { clearCache, listCached, removeFromCache } from '../lib/cache.js'

export default define({
  name: 'clear',
  description: 'Remove cached documentation',
  args: {
    all: {
      type: 'boolean',
      short: 'a',
      description: 'Clear all cached packages',
    },
  },
  run: async (ctx) => {
    const { all = false } = ctx.values
    const packagesToRemove = (ctx.positionals as string[]).filter((p) => p !== 'clear')

    // If --all flag, clear everything
    if (all) {
      const cached = listCached()
      if (cached.length === 0) {
        console.log('Cache is already empty.')
        return
      }

      clearCache()
      console.log(`Cleared ${cached.length} cached package(s).`)
      return
    }

    // If no packages specified, show usage
    if (packagesToRemove.length === 0) {
      const cached = listCached()
      if (cached.length === 0) {
        console.log('Cache is already empty.')
      } else {
        console.log('Usage: erudita clear <packages...> or erudita clear --all')
        console.log(`\nCached packages (${cached.length}):`)
        cached.forEach((p) => console.log(`  ${p.name}`))
      }
      return
    }

    // Remove specific packages
    let removedCount = 0
    for (const pkg of packagesToRemove) {
      const removed = removeFromCache(pkg)
      if (removed) {
        console.log(`  Removed: ${pkg}`)
        removedCount++
      } else {
        console.log(`  Not cached: ${pkg}`)
      }
    }

    console.log(`\nRemoved ${removedCount} package(s).`)
  },
})
