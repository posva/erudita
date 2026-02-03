import { define } from 'gunshi'
import {
  parsePackageKey,
  readProjectConfig,
  removePackageLink,
  writeProjectConfig,
} from '../lib/project.ts'

export default define({
  name: 'uninstall',
  description: 'Remove docs links from the project',
  run: async (ctx) => {
    const cwd = process.cwd()
    const packagesToRemove = (ctx.positionals as string[]).filter(
      (p) => p !== 'uninstall' && p !== 'u',
    )

    const config = readProjectConfig(cwd)
    if (!config) {
      console.log('No erudita.json found in this project.')
      return
    }

    const configKeys = Object.keys(config.packages)
    if (packagesToRemove.length === 0) {
      if (configKeys.length === 0) {
        console.log('No packages in erudita.json.')
      } else {
        console.log('Usage: erudita uninstall <packages...>')
        console.log(`\nPackages in erudita.json (${configKeys.length}):`)
        configKeys.forEach((key) => console.log(`  ${key}`))
      }
      return
    }

    const keysToRemove = new Set<string>()
    const missingInputs: string[] = []

    for (const pkg of packagesToRemove) {
      const { name, version } = parsePackageKey(pkg)
      const matched = configKeys.filter((key) => {
        const parsed = parsePackageKey(key)
        if (parsed.name !== name) {
          return false
        }
        if (version && parsed.version !== version) {
          return false
        }
        return true
      })

      if (matched.length === 0) {
        missingInputs.push(pkg)
        continue
      }

      matched.forEach((key) => keysToRemove.add(key))
    }

    let removedCount = 0
    for (const key of keysToRemove) {
      delete config.packages[key]
      removePackageLink(cwd, key)
      console.log(`  Removed: ${key}`)
      removedCount++
    }

    missingInputs.forEach((pkg) => {
      console.log(`  Not in erudita.json: ${pkg}`)
    })

    if (removedCount > 0) {
      writeProjectConfig(cwd, config)
    }

    console.log(`\nRemoved ${removedCount} package(s).`)
  },
})
