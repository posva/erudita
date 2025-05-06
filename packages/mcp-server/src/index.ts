import { z } from "zod";
import { DocumentationManager } from "./documentation-manager";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

type ServerOptions = {
  /**
   * Directory where documentation will be cached
   * @default './.erudite/cache'
   */
  cacheDir?: string;
};

export class EruditeMcpServer extends McpServer {
  private docManager: DocumentationManager;

  constructor(options: ServerOptions = {}) {
    super(
      {
        name: "erudite",
        version: "0.1.0",
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
      },
    );
    this.docManager = new DocumentationManager({
      cacheDir: options.cacheDir || "./.erudite/cache",
    });

    this.#setupTools();
  }

  #setupTools() {
    // List available documentation (no parameters)
    this.tool("list_documentation", {}, async () => {
      const docs = await this.docManager.listDocumentation();
      return { content: [{ type: "text", text: JSON.stringify({ docs }) }] };
    });

    // Update documentation for a package
    this.tool(
      "update_documentation",
      {
        packageName: z.string(),
        version: z.string().optional(),
      },
      async ({ packageName, version }) => {
        await this.docManager.updateDocumentation(packageName, version);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: true,
                message: `Documentation updated for ${packageName}${version ? `@${version}` : ""}`,
              }),
            },
          ],
        };
      },
    );

    // Get documentation content
    this.tool(
      "get_documentation",
      {
        packageName: z.string(),
        version: z.string().optional(),
        path: z.string().optional(),
      },
      async ({ packageName, version, path = "index.md" }) => {
        const content = await this.docManager.getDocumentation(
          packageName,
          version,
          path,
        );
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({ content }),
            },
          ],
        };
      },
    );
  }
}
