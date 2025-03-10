declare module '@modelcontextprotocol/sdk/server/mcp.js' {
  export interface McpServerConfig {
    name: string;
    version: string;
  }

  export class McpServer {
    constructor(config: McpServerConfig);
    tool(
      name: string,
      schema: Record<string, any>,
      handler: (params: Record<string, any>) => Promise<{ content: Array<{ type: string; text: string }> }>,
      options?: { description: string }
    ): void;
    connect(transport: any): Promise<void>;
  }
}

declare module '@modelcontextprotocol/sdk/server/stdio.js' {
  export class StdioServerTransport {
    constructor();
  }
} 