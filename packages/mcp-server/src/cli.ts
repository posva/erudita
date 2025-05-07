#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { EruditaMcpServer } from './index'

async function main() {
  const server = new EruditaMcpServer()

  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((error) => {
  console.error('Error starting server:', error)
  process.exit(1)
})
