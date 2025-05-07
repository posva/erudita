import { z } from 'zod'
import fs from 'node:fs/promises'
import path from 'node:path'
import { DocumentationManager } from './documentation-manager'
import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js'

interface ServerOptions {
  /**
   * Directory where documentation will be cached
   * @default './.erudita/cache'
   */
  cacheDir?: string
}

const ROOT_NODE_MODULES = path.join(process.cwd(), 'node_modules')
const CACHE_DIR = path.join(ROOT_NODE_MODULES, '.erudita/cache')
// ensure the cache
fs.mkdir(CACHE_DIR, { recursive: true })

export class EruditeMcpServer extends McpServer {
  private docManager: DocumentationManager

  constructor(options: ServerOptions = {}) {
    super(
      {
        name: 'erudita',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      },
    )

    this.docManager = new DocumentationManager({
      cacheDir: options.cacheDir || './.erudita/cache',
    })

    this.#setupTools()
    this.#setupResources()
  }

  #setupTools() {
    // List available documentation (no parameters)
    this.tool(
      'list_documentation',
      'List all available documentation packages and their versions',
      {},
      {
        title: 'List Documentation',
      },
      async () => {
        try {
          const docs = await this.docManager.listDocumentation()
          return { content: [{ type: 'text', text: JSON.stringify({ docs }) }] }
        } catch (error) {
          throw new Error(
            `Failed to list documentation: ${error instanceof Error ? error.message : String(error)}`,
          )
        }
      },
    )

    // Update documentation for a package
    this.tool(
      'update_documentation',
      'Update documentation for a specific package and version',
      {
        packageName: z.string().describe('Name of the package to update'),
        version: z.string().optional().describe('Specific version to update (defaults to latest)'),
      },
      {
        title: 'Update Documentation',
      },
      async ({ packageName, version }) => {
        try {
          await this.docManager.updateDocumentation(packageName, version)
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  message: `Documentation updated for ${packageName}${version ? `@${version}` : ''}`,
                }),
              },
            ],
          }
        } catch (error) {
          throw new Error(
            `Failed to update documentation: ${error instanceof Error ? error.message : String(error)}`,
          )
        }
      },
    )

    // Get documentation content
    this.tool(
      'get_documentation',
      'Get documentation content for a specific package and path',
      {
        packageName: z.string().describe('Name of the package'),
        version: z.string().optional().describe('Version of the package (defaults to latest)'),
        path: z
          .string()
          .optional()
          .describe('Path to the documentation file (defaults to index.md)')
          .default('index.md'),
      },
      {
        title: 'Get Documentation',
      },
      async ({ packageName, version, path = 'index.md' }) => {
        try {
          const content = await this.docManager.getDocumentation(packageName, version, path)
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ content }),
              },
            ],
          }
        } catch (error) {
          throw new Error(
            `Failed to get documentation: ${error instanceof Error ? error.message : String(error)}`,
          )
        }
      },
    )
  }

  #setupResources() {
    // Resource to list available packages
    this.resource(
      'list-package-doc-files',
      // erudita://colada.pinia.pkg -> @pinia/colada
      // works with erudita://pinia.pkg -> pinia
      new ResourceTemplate('erudita://{pkgDomain}.pkg', {
        list: async ({}) => {
          // find existing folders created in the cache folder
          const dirs = await fs.readdir(CACHE_DIR, {
            recursive: false,
          })

          const packagesDirs = await Promise.all(
            dirs.map(async (dir) => {
              if (dir.startsWith('@')) {
                return fs
                  .readdir(path.join(CACHE_DIR, dir), { recursive: false })
                  .then((subDirs) => subDirs.map((subDir) => `${dir}/${subDir}`))
              } else {
                return dir
              }
            }),
          )

          return {
            resources: packagesDirs.flat().map((name) => ({
              uri: `erudita://${name.startsWith('@') ? name.slice(1).split('/').reverse().join('.') : name}.pkg`,
              name,
              // mimeType: 'text/plain',
            })),
          }
        },
      }),

      async (uri, vars) => {
        const { pkgDomain: _pkgDomain } = vars
        const pkgDomain = (_pkgDomain as string).split('.')

        try {
          if (pkgDomain.length > 2)
            throw new Error(
              'Invalid package name format. Must be either a simple name or @scope/name',
            )

          const packageName =
            pkgDomain.length === 1 ? pkgDomain[0] : `@${pkgDomain[1]}/${pkgDomain[0]}`

          // get all possible files recursively
          const files = await fs.readdir(path.join(CACHE_DIR, packageName), {
            recursive: true,
          })

          return {
            contents: files.map((file) => ({
              uri: uri.href + '/' + file,
              text: '',
              mimeType: 'text/plain',
            })),
          }
        } catch (error) {
          return {
            contents: [
              {
                uri: uri.href,
                text: `Error: ${error instanceof Error ? error.message : String(error)}`,
                mimeType: 'text/plain',
              },
            ],
          }
        }
      },
    )

    // Resource to get package documentation
    this.resource(
      'package-docs',
      // erudita://colada.pinia.pkg/api/index.md -> @pinia/colada ; /api/index.md
      // works with erudita://pinia.pkg/api/index.md -> pinia ; /api/index.md
      new ResourceTemplate('erudita://{pkgDomain}.pkg{+path}', {
        // if we need version:
        // new ResourceTemplate('erudita://{pkgDomain}.pkg{+path}{?v}', {
        list: undefined,
      }),
      async (uri, vars) => {
        const { path, pkgDomain: _pkgDomain, version } = vars
        const pkgDomain = (_pkgDomain as string).split('.')

        try {
          if (pkgDomain.length > 2)
            throw new Error(
              'Invalid package name format. Must be either a simple name or @scope/name',
            )

          const packageName =
            pkgDomain.length === 1 ? pkgDomain[0] : `@${pkgDomain[1]}/${pkgDomain[0]}`

          if (path.length === 0) {
            throw new Error('Path cannot be empty')
          }
          const content = await this.docManager.getDocumentation(
            packageName as string,
            version as string,
            path as string[],
          )
          return {
            contents: [
              {
                uri: uri.href,
                text: content,
                mimeType: path.at(-1)!.endsWith('.md') ? 'text/markdown' : 'text/plain',
              },
            ],
          }
        } catch (error) {
          return {
            contents: [
              {
                uri: uri.href,
                vars,
                text: `Error: ${error instanceof Error ? error.message : String(error)}`,
                mimeType: 'text/plain',
              },
            ],
          }
        }
      },
    )
  }
}
