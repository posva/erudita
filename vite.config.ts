import { defineConfig } from 'vite'
import { ViteMcp } from 'vite-plugin-mcp'
import { EruditaMcpServer } from './packages/mcp-server/src'

export default defineConfig({
  plugins: [
    ViteMcp({
      mcpServer: () => new EruditaMcpServer({}),
    }),
  ],
})
