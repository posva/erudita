import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { setupServer } from 'msw/node'
import { extractWebsiteUrl, fetchNpmMeta, resolvePackageUrl } from '../npm-resolver.js'

const server = setupServer()

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => server.resetHandlers())
afterAll(() => server.close())

describe('fetchNpmMeta', () => {
  it('fetches package metadata from npm registry', async () => {
    server.use(
      http.get('https://registry.npmjs.org/vue', () => {
        return HttpResponse.json({
          name: 'vue',
          homepage: 'https://vuejs.org',
          repository: {
            type: 'git',
            url: 'git+https://github.com/vuejs/core.git',
          },
        })
      })
    )

    const meta = await fetchNpmMeta('vue')
    expect(meta).toEqual({
      name: 'vue',
      homepage: 'https://vuejs.org',
      repository: {
        type: 'git',
        url: 'git+https://github.com/vuejs/core.git',
      },
    })
  })

  it('returns null for non-existent packages', async () => {
    server.use(
      http.get('https://registry.npmjs.org/nonexistent-package-xyz', () => {
        return new HttpResponse(null, { status: 404 })
      })
    )

    const meta = await fetchNpmMeta('nonexistent-package-xyz')
    expect(meta).toBeNull()
  })

  it('handles scoped packages', async () => {
    server.use(
      http.get('https://registry.npmjs.org/%40vue%2Fcompiler-sfc', () => {
        return HttpResponse.json({
          name: '@vue/compiler-sfc',
          homepage: 'https://vuejs.org',
        })
      })
    )

    const meta = await fetchNpmMeta('@vue/compiler-sfc')
    expect(meta?.name).toBe('@vue/compiler-sfc')
  })
})

describe('extractWebsiteUrl', () => {
  it('prefers homepage over repository', () => {
    const meta = {
      name: 'test',
      homepage: 'https://test.com',
      repository: { url: 'git+https://github.com/user/repo.git' },
    }
    expect(extractWebsiteUrl(meta)).toBe('https://test.com')
  })

  it('falls back to repository URL', () => {
    const meta = {
      name: 'test',
      repository: { url: 'git+https://github.com/user/repo.git' },
    }
    expect(extractWebsiteUrl(meta)).toBe('https://github.com/user/repo')
  })

  it('handles git:// protocol', () => {
    const meta = {
      name: 'test',
      repository: { url: 'git://github.com/user/repo.git' },
    }
    expect(extractWebsiteUrl(meta)).toBe('https://github.com/user/repo')
  })

  it('handles ssh URLs', () => {
    const meta = {
      name: 'test',
      repository: { url: 'git@github.com:user/repo.git' },
    }
    expect(extractWebsiteUrl(meta)).toBe('https://github.com/user/repo')
  })

  it('returns null when no URL available', () => {
    const meta = { name: 'test' }
    expect(extractWebsiteUrl(meta)).toBeNull()
  })

  it('removes trailing slashes', () => {
    const meta = { name: 'test', homepage: 'https://test.com/' }
    expect(extractWebsiteUrl(meta)).toBe('https://test.com')
  })
})

describe('resolvePackageUrl', () => {
  it('resolves package name to website URL', async () => {
    server.use(
      http.get('https://registry.npmjs.org/pinia', () => {
        return HttpResponse.json({
          name: 'pinia',
          homepage: 'https://pinia.vuejs.org',
        })
      })
    )

    const url = await resolvePackageUrl('pinia')
    expect(url).toBe('https://pinia.vuejs.org')
  })

  it('returns null for packages without URLs', async () => {
    server.use(
      http.get('https://registry.npmjs.org/no-url-pkg', () => {
        return HttpResponse.json({
          name: 'no-url-pkg',
        })
      })
    )

    const url = await resolvePackageUrl('no-url-pkg')
    expect(url).toBeNull()
  })
})
