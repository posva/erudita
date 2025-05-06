import { defineConfig } from "vite";
import { ViteMcp } from "vite-plugin-mcp";
import { EruditeMcpServer } from "./packages/mcp-server/src";

export default defineConfig({
  plugins: [
    ViteMcp({
      mcpServer: () => new EruditeMcpServer({}),
    }),
  ],
});
