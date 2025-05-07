import { z } from 'zod'
import fs from 'node:fs/promises'
import path from 'node:path'
import { DocumentationManager } from './documentation-manager'
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

interface EruditaMetadata {
  /**
   * Date when the package was last updated
   */
  lastUpdatedAt?: string

  /**
   * Description used to describe the package that can be consumed by the LLM
   */
  description?: string

  /**
   * Name of the package
   */
  name: string
}

async function ensureCacheDir(projectRootDir: string, packageList: string[] = []) {
  const NODE_MODULES_DIR = path.join(projectRootDir, 'node_modules')
  const CACHE_DIR = path.join(projectRootDir, 'node_modules', '.erudita/cache')

  await fs.mkdir(CACHE_DIR, { recursive: true }).catch((error) => {
    if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
      throw error
    }
  })

  const packageDirList = await Promise.all(
    packageList.map(async (pkg) => {
      const pkgDir = path.join(CACHE_DIR, pkg)
      await fs.mkdir(pkgDir, { recursive: true }).catch((error) => {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
          throw error
        }
      })
      return pkgDir
    }),
  )

  return {
    NODE_MODULES_DIR,
    CACHE_DIR,
    packageDirList,
  }
}

const projectRootDir = z
  .string()
  .describe(
    'Project root directory where the node_modules folder is located. If the project is a monorepo, this should be the root of the mono repo.',
  )

export class EruditaMcpServer extends McpServer {
  private docManagerMap: Map<string, DocumentationManager> = new Map()

  constructor() {
    super(
      {
        name: 'erudita',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      },
    )

    this.#setupTools()
  }

  #setupTools() {
    // List available documentation (no parameters)
    this.tool(
      'list_documentation',
      `
Retrieve a list of resources available locally in the Erudita documentation cache directory.
This tool should be used to retrieve up to date documentation for a package.
If the user wants to implement a feature, this tool should always be checked to retrieve the full list of available documentes, then choose what documentation resources to use and update them if missing or outdated.
`.trim(),
      {
        projectRootDir,
      },
      {
        title: 'List available documentation folders',
        readOnlyHint: true,
      },
      async ({ projectRootDir }) => {
        try {
          const { CACHE_DIR } = await ensureCacheDir(projectRootDir)
          const dirs = await fs.readdir(CACHE_DIR, { recursive: false })
          const packagesDirs = (
            await Promise.all(
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
          ).flat()

          const asResources = packagesDirs.map((dir) => ({
            type: 'resource' as const,
            resource: {
              uri: `file://${path.join(CACHE_DIR, dir)}/`,
              text: dir,
            },
          }))

          return {
            content: [
              ...asResources,
              // {
              //   type: 'text',
              //   text: JSON.stringify({
              //     missing: [],
              //   }),
              // },
            ],
          }
        } catch (error) {
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: error instanceof Error ? error.message : String(error),
              },
            ],
          }
        }
      },
    )

    // Update documentation for a package
    this.tool(
      'update_packages_documentation',
      `
Updates the documentation for a set of packages in the Erudita documentation cache directory.
This tool should be used to keep the documentation up to date. It will check if existing documentation must be updated or not so it can be run often to keep the documentation up to date.
It should be automatically called if new packages are installed or updated.
It should also be called if the user says things are out of date.
`.trim(),
      {
        packageList: z
          .array(z.string())
          .describe(
            'List of package names to update (example: `["@pinia/colada", "vue", "vue-router"]`)',
          ),
        projectRootDir,
        force: z
          .boolean()
          .optional()
          .default(false)
          .describe('Force update ignoring the last updated date'),
      },
      {
        title: 'Updates the documentation for a specific package',
        idempotentHint: true,
        destructiveHint: false,
      },
      async ({ packageList, projectRootDir, force }) => {
        try {
          const { CACHE_DIR, NODE_MODULES_DIR, packageDirList } = await ensureCacheDir(
            projectRootDir,
            packageList,
          )

          const skipped: string[] = []
          const updated: string[] = []
          const failed = new Map<string, string[]>()

          for (const pkgDir of packageDirList) {
            const name = path.relative(CACHE_DIR, pkgDir)
            // read the metadata from the cache erudita.json file
            // ensure the file exists first
            const metadataPath = path.join(pkgDir, 'erudita.json')
            await fs.access(metadataPath).catch(() => {
              // if the file does not exist, create it
              return fs.writeFile(
                metadataPath,
                JSON.stringify({ name } satisfies EruditaMetadata),
                'utf-8',
              )
            })
            let metadata: EruditaMetadata | undefined
            try {
              metadata = JSON.parse(await fs.readFile(metadataPath, 'utf-8'))
            } catch (error) {
              console.error('Failed to parse metadata file:', error)
            }

            metadata ??= { name }

            const lastUpdatedAt = metadata.lastUpdatedAt
              ? new Date(metadata.lastUpdatedAt)
              : new Date(0)

            // if the last updated date is less than 2 hours ago, skip the update
            if (!force && lastUpdatedAt.getTime() < Date.now() - 2 * 60 * 60 * 1000) {
              console.error(`Skipping update for ${name} (${lastUpdatedAt})`)
              skipped.push(name)
              continue
            }

            // read the website from the package.json file of the package
            const packageJsonPath = path.join(NODE_MODULES_DIR, name, 'package.json')
            const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'))
            let homepage = packageJson?.homepage

            if (!homepage || homepage.includes('//github.com/')) {
              const githubUrl = homepage || packageJson?.repository?.url
              if (typeof githubUrl === 'string' && githubUrl.length > 0) {
                const url = new URL(githubUrl)
                if (url.hostname === 'github.com') {
                  const data = await fetch('https://api.github.com/repos' + url.pathname).then(
                    (res) => res.json(),
                  )
                  homepage = data?.homepage
                }
              }
            }

            if (typeof homepage === 'string' && homepage.startsWith('https://')) {
              const url = new URL('llms-full.txt', homepage)
              const content = await fetch(url.toString()).then((res) => res.text())

              await fs.writeFile(path.join(pkgDir, 'llms-full.txt'), content, 'utf-8')
              updated.push(name)
            } else {
              // TODO: cumulate errors
              let errors = failed.get(name)
              if (!errors) {
                errors = []
                failed.set(name, errors)
              }
              errors.push('No valid homepage found')
            }

            // write back the file
            await fs.writeFile(
              metadataPath,
              JSON.stringify({
                ...metadata,
                lastUpdatedAt: new Date().toISOString(),
              } satisfies EruditaMetadata),
              'utf-8',
            )
          }

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  skipped,
                  updated,
                  failed: Array.from(failed.entries()).map(([name, errors]) => ({ name, errors })),
                  packages: packageDirList,
                }),
              },
            ],
          }
        } catch (error) {
          return {
            isError: true,
            content: [
              {
                type: 'text',
                text: error instanceof Error ? error.message : String(error),
              },
            ],
          }
        }
      },
    )

    // Get documentation content
    this.tool(
      'get_package_documentation_full',
      `
Get the whole documentation of a specific package from the Erudita documentation cache directory, usually in the format of "llms-full.txt".
This operation is heavy and should be used when it's not possible to query the documentation for a specific file or if such operation has failed.
`.trim(),
      {
        projectRootDir,
        packageName: z.string().describe('Name of the package to get the documentation for'),
        path: z
          .array(z.string())
          .optional()
          .describe(
            'Paths of files to get the documentation for (example: `["/getting-started/index.md", "/api/interfaces.md"]`)',
          ),
      },
      {
        title: 'Get Documentation',
      },
      async ({ packageName, version, path = 'index.md', projectRootDir }) => {
        try {
          const docManager = await this.docManager(projectRootDir)
          const content = await docManager.getDocumentation(packageName, version, path)
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
}
