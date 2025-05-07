# Erudite MCP Server

A Model Context Protocol (MCP) server for managing and serving documentation for JavaScript/TypeScript packages.

## Features

- Download and cache documentation for npm packages
- List available documentation packages
- Update documentation for specific packages
- Serve documentation content to LLMs

## Usage

### Starting the server

```bash
# From the root of the repository
pnpm mcp:start
```

### Available Tools

The server provides the following tools:

1. **list_documentation**
   - Description: List all available documentation packages and their versions
   - Input: `{}`
   - Output: `{ docs: Array<{name: string, version: string, lastUpdated: string, paths: string[]}> }`

2. **update_documentation**
   - Description: Update documentation for a specific package
   - Input: `{ packageName: string, version?: string }`
   - Output: `{ success: boolean, message: string }`

3. **get_documentation**
   - Description: Get documentation content for a specific package and path
   - Input: `{ packageName: string, version?: string, path?: string }`
   - Output: `{ content: string }`

## Configuration

The server can be configured with the following environment variables:

- `PORT`: Port to run the server on (default: 3000)
- `CACHE_DIR`: Directory to store cached documentation (default: `./.erudita/cache`)

## Development

```bash
# Install dependencies
pnpm install

# Build the package
pnpm build

# Start in development mode
pnpm dev
```

## License

MIT
