import { OpenAPIV3 } from 'openapi-types';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { OpenAPIToMCPConverter } from '../converter/index.js';
import { HttpClient } from '../client/http-client.js';

export interface ServerOptions {
  name?: string;
  version?: string;
  baseUrl?: string;
  headers?: Record<string, string>;
}

export class MCPServerGenerator {
  private openApiSpec: OpenAPIV3.Document;
  private options: ServerOptions;
  private converter: OpenAPIToMCPConverter;
  private httpClient: HttpClient;

  constructor(openApiSpec: OpenAPIV3.Document, options: ServerOptions = {}) {
    this.openApiSpec = openApiSpec;
    this.options = {
      name: options.name || this.openApiSpec.info.title || 'OpenAPI MCP Server',
      version: options.version || this.openApiSpec.info.version || '1.0.0',
      baseUrl: options.baseUrl,
      headers: options.headers || {},
    };
    
    this.converter = new OpenAPIToMCPConverter(this.openApiSpec);
    this.httpClient = new HttpClient({
      baseUrl: this.options.baseUrl,
      headers: this.options.headers,
    }, this.openApiSpec);
  }

  /**
   * Generate the MCP server
   */
  generateServer(): McpServer {
    const server = new McpServer({
      name: this.options.name || 'OpenAPI MCP Server',
      version: this.options.version || '1.0.0',
    });

    // Convert OpenAPI to MCP tools
    const { tools, openApiLookup } = this.converter.convertToMCPTools();

    // Register each tool with the MCP server
    Object.entries(tools).forEach(([name, tool]) => {
      const { parameters, description } = tool as { 
        parameters: Record<string, any>;
        description: string;
      };

      // Convert the tool parameters to Zod schemas to a schema object
      const schema: Record<string, any> = {};
      Object.entries(parameters).forEach(([paramName, paramSchema]) => {
        schema[paramName] = paramSchema;
      });

      // Register the tool with the server
      server.tool(
        name,
        schema,
        async (params: Record<string, any>) => {
          try {
            // Execute the API call
            const operation = openApiLookup[name];
            const result = await this.httpClient.executeOperation(operation, params);
            
            // Format the result for MCP
            return {
              content: [
                {
                  type: 'text',
                  text: typeof result === 'string' 
                    ? result 
                    : JSON.stringify(result, null, 2)
                }
              ]
            };
          } catch (error: unknown) {
            return {
              content: [
                {
                  type: 'text',
                  text: `Error: ${error instanceof Error ? error.message : String(error)}`
                }
              ]
            };
          }
        },
        { 
          description
        }
      );
    });

    return server;
  }
} 