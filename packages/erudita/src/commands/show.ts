import { define } from 'gunshi'
import { getCachedDocFile, getCachedLlmsTxt, getCachedMeta } from '../lib/cache.js'

export default define({
  name: 'show',
  description: 'Display cached documentation for a package',
  args: {
    package: {
      type: 'string',
      description: 'Package name to show docs for',
    },
    entry: {
      type: 'string',
      short: 'e',
      description: 'Show a specific doc entry by index or name',
    },
    raw: {
      type: 'boolean',
      short: 'r',
      description: 'Show raw llms.txt content',
    },
  },
  run: async (ctx) => {
    const { entry, raw = false } = ctx.values
    // Get package from positionals
    const packageName = ctx.positionals[0] || (ctx.values.package as string)

    if (!packageName) {
      console.log('Usage: erudita show <package> [--entry <index>] [--raw]')
      return
    }

    const meta = getCachedMeta(packageName)
    if (!meta) {
      console.log(`Package "${packageName}" is not cached.`)
      console.log(`Run: erudita fetch ${packageName}`)
      return
    }

    // Show raw llms.txt
    if (raw) {
      const content = getCachedLlmsTxt(packageName)
      if (content) {
        console.log(content)
      }
      return
    }

    // Show specific entry
    if (entry) {
      const index = parseInt(entry as string, 10)
      let docEntry

      if (!isNaN(index)) {
        docEntry = meta.doc.entries[index]
      } else {
        // Try to match by title
        docEntry = meta.doc.entries.find(
          (e) => e.title.toLowerCase().includes((entry as string).toLowerCase())
        )
      }

      if (!docEntry) {
        console.log(`Entry "${entry}" not found.`)
        console.log('\nAvailable entries:')
        meta.doc.entries.forEach((e, i) => {
          console.log(`  ${i}: ${e.title}`)
        })
        return
      }

      // Try to get cached content
      const urlPath = new URL(docEntry.url, meta.sourceUrl).pathname
      const filename = urlPath.split('/').pop() || 'doc.md'
      const content = getCachedDocFile(packageName, filename)

      if (content) {
        console.log(content)
      } else {
        console.log(`# ${docEntry.title}\n`)
        console.log(`URL: ${docEntry.url}`)
        if (docEntry.description) {
          console.log(`\n${docEntry.description}`)
        }
        console.log('\n(Content not cached, fetch with --force to update)')
      }
      return
    }

    // Show overview
    console.log(`# ${meta.doc.title || packageName}\n`)
    if (meta.doc.description) {
      console.log(`> ${meta.doc.description}\n`)
    }
    console.log(`Source: ${meta.sourceUrl}`)
    console.log(`Fetched: ${new Date(meta.fetchedAt).toLocaleString()}`)
    console.log(`\n## Documentation Entries (${meta.doc.entries.length})\n`)

    meta.doc.entries.forEach((entry, i) => {
      console.log(`  ${i}: ${entry.title}`)
      if (entry.description) {
        console.log(`     ${entry.description}`)
      }
    })

    console.log('\nUse --entry <index> to view a specific entry.')
  },
})
