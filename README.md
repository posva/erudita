# Vite Erudite

A Vite plugin that runs an MCP server to retrieve and cache documentation from your dependencies, giving LLMs up-to-date knowledge of the packages they need to use.

## Features

- **Documentation Caching**: Automatically downloads and caches documentation for your project's dependencies
- **MCP Integration**: Exposes documentation through the Model Context Protocol (MCP) for easy integration with LLMs
- **On-Demand Updates**: Update documentation for specific packages as needed
- **TypeScript Support**: Built with TypeScript for type safety and better developer experience

## Installation

```bash
# Using pnpm (recommended)
pnpm add -D vite-erudite

# Or using npm
npm install --save-dev vite-erudite

# Or using yarn
yarn add -D vite-erudite
```

## Usage

### Vite Configuration

Add the plugin to your `vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import { erudite } from 'vite-erudite';

export default defineConfig({
  plugins: [
    erudite({
      // Optional: Custom cache directory (default: './.erudite/cache')
      cacheDir: './.erudite/cache',
      // Optional: Port for the MCP server (default: 3000)
      port: 3000,
    })
  ]
});
```

### MCP Server

The plugin starts an MCP server that provides the following tools:

1. **list_documentation**: List all available documentation packages and versions
2. **update_documentation**: Update documentation for a specific package
3. **get_documentation**: Get documentation content for a specific package and path

### Example Usage with MCP Client

```typescript
// Example using the MCP client to interact with the server
const client = new McpClient('http://localhost:3000');

// List available documentation
const { docs } = await client.callTool('list_documentation', {});

// Update documentation for a package
await client.callTool('update_documentation', {
  packageName: 'react',
  version: '18.2.0'
});

// Get documentation content
const { content } = await client.callTool('get_documentation', {
  packageName: 'react',
  version: '18.2.0',
  path: 'index.md'
});
```

## Development

### Project Structure

- `packages/mcp-server`: MCP server implementation for managing documentation cache
- `packages/vite-plugin`: Vite plugin implementation (coming soon)

### Setup

1. Clone the repository
2. Install dependencies:
   ```bash
   pnpm install
   ```
3. Build the packages:
   ```bash
   pnpm build
   ```
4. Start the development server:
   ```bash
   pnpm dev
   ```

## License

MIT