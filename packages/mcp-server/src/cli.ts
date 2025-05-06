#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { EruditeMcpServer } from './index'

const DEFAULT_CACHE_DIR = './node_modules/.erudite/cache'

async function main() {
  const server = new EruditeMcpServer({
    cacheDir: process.env.CACHE_DIR || DEFAULT_CACHE_DIR,
  })

  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((error) => {
  console.error('Error starting server:', error)
  process.exit(1)
})
