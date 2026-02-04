import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { _setCacheDir } from '../../lib/cache.ts'
import { getOrCreateProjectConfig, readProjectConfig } from '../../lib/project.ts'
import installCmd from '../install.ts'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

const testDir = join(
  tmpdir(),
  'erudita-test-install-' + Date.now() + '-' + Math.random().toString(36).slice(2),
)
const testCacheDir = join(
  tmpdir(),
  'erudita-test-cache-install-' + Date.now() + '-' + Math.random().toString(36).slice(2),
)

describe('install command --homepage flag', () => {
  beforeEach(() => {
    _setCacheDir(testCacheDir)
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
    if (existsSync(testCacheDir)) {
      rmSync(testCacheDir, { recursive: true, force: true })
    }
    mkdirSync(testDir, { recursive: true })
    mkdirSync(testCacheDir, { recursive: true })
  })

  afterEach(() => {
    _setCacheDir(null)
    if (existsSync(testDir)) {
      rmSync(testDir, { recursive: true, force: true })
    }
    if (existsSync(testCacheDir)) {
      rmSync(testCacheDir, { recursive: true, force: true })
    }
  })

  it('installs single package with --homepage flag', async () => {
    server.use(
      http.get('https://example.com/llms.txt', () => {
        return HttpResponse.text('# Example Package\n\n- [Docs](./docs.md)')
      }),
      http.get('https://example.com/docs.md', () => {
        return HttpResponse.text('# Documentation\n\nExample content')
      }),
    )

    const originalCwd = process.cwd()
    try {
      process.chdir(testDir)
      await installCmd.run({
        positionals: ['install', 'example-pkg'],
        values: {
          homepage: 'https://example.com',
        },
      } as any)

      // Verify erudita.json contains URL
      const config = readProjectConfig(testDir)
      expect(config.packages['example-pkg']).toBeDefined()
      expect(config.packages['example-pkg'].url).toBe('https://example.com')
    } finally {
      process.chdir(originalCwd)
    }
  })

  it('normalizes http to https in --homepage', async () => {
    server.use(
      http.get('https://example.com/llms.txt', () => {
        return HttpResponse.text('# Example Package')
      }),
    )

    const originalCwd = process.cwd()
    try {
      process.chdir(testDir)
      await installCmd.run({
        positionals: ['install', 'example-pkg'],
        values: {
          homepage: 'http://example.com',
        },
      } as any)

      const config = readProjectConfig(testDir)
      expect(config.packages['example-pkg'].url).toBe('https://example.com')
    } finally {
      process.chdir(originalCwd)
    }
  })

  it('removes trailing slash from --homepage', async () => {
    server.use(
      http.get('https://example.com/llms.txt', () => {
        return HttpResponse.text('# Example Package')
      }),
    )

    const originalCwd = process.cwd()
    try {
      process.chdir(testDir)
      await installCmd.run({
        positionals: ['install', 'example-pkg'],
        values: {
          homepage: 'https://example.com/',
        },
      } as any)

      const config = readProjectConfig(testDir)
      expect(config.packages['example-pkg'].url).toBe('https://example.com')
    } finally {
      process.chdir(originalCwd)
    }
  })

  it('errors when --homepage used with --deps flag', async () => {
    const originalCwd = process.cwd()
    const consoleLog = console.log
    const logs: string[] = []
    console.log = (...args: any[]) => logs.push(args.join(' '))

    try {
      process.chdir(testDir)
      await installCmd.run({
        positionals: ['install'],
        values: {
          deps: 'all',
          homepage: 'https://example.com',
        },
      } as any)

      expect(logs.join('\n')).toContain('--homepage cannot be used with --deps flag')
    } finally {
      process.chdir(originalCwd)
      console.log = consoleLog
    }
  })

  it('errors when --homepage used with multiple packages', async () => {
    const originalCwd = process.cwd()
    const consoleLog = console.log
    const logs: string[] = []
    console.log = (...args: any[]) => logs.push(args.join(' '))

    try {
      process.chdir(testDir)
      await installCmd.run({
        positionals: ['install', 'pkg1', 'pkg2'],
        values: {
          homepage: 'https://example.com',
        },
      } as any)

      expect(logs.join('\n')).toContain(
        '--homepage can only be used when installing exactly one package',
      )
    } finally {
      process.chdir(originalCwd)
      console.log = consoleLog
    }
  })

  it('errors when --homepage has invalid URL format', async () => {
    const originalCwd = process.cwd()
    const consoleLog = console.log
    const logs: string[] = []
    console.log = (...args: any[]) => logs.push(args.join(' '))

    try {
      process.chdir(testDir)
      await installCmd.run({
        positionals: ['install', 'example-pkg'],
        values: {
          homepage: 'not-a-valid-url',
        },
      } as any)

      expect(logs.join('\n')).toContain('Invalid URL format')
    } finally {
      process.chdir(originalCwd)
      console.log = consoleLog
    }
  })

  it('errors when --homepage URL lacks protocol', async () => {
    const originalCwd = process.cwd()
    const consoleLog = console.log
    const logs: string[] = []
    console.log = (...args: any[]) => logs.push(args.join(' '))

    try {
      process.chdir(testDir)
      await installCmd.run({
        positionals: ['install', 'example-pkg'],
        values: {
          homepage: 'example.com',
        },
      } as any)

      expect(logs.join('\n')).toContain('Invalid URL format')
    } finally {
      process.chdir(originalCwd)
      console.log = consoleLog
    }
  })

  it('handles scoped packages with --homepage', async () => {
    server.use(
      http.get('https://example.com/llms.txt', () => {
        return HttpResponse.text('# Scoped Package')
      }),
    )

    const originalCwd = process.cwd()
    try {
      process.chdir(testDir)
      await installCmd.run({
        positionals: ['install', '@scope/pkg'],
        values: {
          homepage: 'https://example.com',
        },
      } as any)

      const config = readProjectConfig(testDir)
      expect(config.packages['@scope/pkg']).toBeDefined()
      expect(config.packages['@scope/pkg'].url).toBe('https://example.com')
    } finally {
      process.chdir(originalCwd)
    }
  })

  it('handles versioned packages with --homepage', async () => {
    server.use(
      http.get('https://example.com/llms.txt', () => {
        return HttpResponse.text('# Versioned Package')
      }),
    )

    const originalCwd = process.cwd()
    try {
      process.chdir(testDir)
      await installCmd.run({
        positionals: ['install', 'pkg@1.0.0'],
        values: {
          homepage: 'https://example.com',
        },
      } as any)

      const config = readProjectConfig(testDir)
      expect(config.packages['pkg@1.0.0']).toBeDefined()
      expect(config.packages['pkg@1.0.0'].url).toBe('https://example.com')
    } finally {
      process.chdir(originalCwd)
    }
  })
})
