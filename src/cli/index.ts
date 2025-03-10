#!/usr/bin/env node
import { Command } from 'commander';
import { loadOpenAPISpec } from '../openapi/loader.js';
import { MCPServerGenerator } from '../mcp/server-generator.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const program = new Command();

// Define the CLI version
program
  .name('openapi-to-mcp')
  .description('CLI tool to convert OpenAPI specs to MCP servers')
  .version('1.0.0');

// Define the main command
program
  .argument('<spec>', 'Path or URL to the OpenAPI specification file')
  .option('-n, --name <n>', 'Name of the MCP server')
  .option('-v, --version <version>', 'Version of the MCP server')
  .option('-u, --base-url <url>', 'Base URL for the API')
  .option('-H, --header <header>', 'HTTP header(s) to include with requests (format: "Name: Value")', collectHeaders, {})
  .action(async (specPath: string, options: {
    name?: string;
    version?: string;
    baseUrl?: string;
    header: Record<string, string>;
  }) => {
    try {
      // Load the OpenAPI spec
      console.error(`Loading OpenAPI spec from ${specPath}...`);
      const spec = await loadOpenAPISpec(specPath);
      
      // Create the server generator
      const generator = new MCPServerGenerator(spec, {
        name: options.name,
        version: options.version,
        baseUrl: options.baseUrl,
        headers: options.header,
      });
      
      // Generate the MCP server
      console.error('Generating MCP server...');
      const server = generator.generateServer();
      
      // Start the server using stdio transport
      console.error('Starting MCP server via stdio...');
      const transport = new StdioServerTransport();
      await server.connect(transport);
      
      console.error('MCP server is running. You can now use it with Claude Desktop or any MCP-compatible client.');
    } catch (error: unknown) {
      console.error('Error:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

// Helper function to collect HTTP headers
function collectHeaders(value: string, previous: Record<string, string>): Record<string, string> {
  const [name, ...valueParts] = value.split(':');
  const headerValue = valueParts.join(':').trim();
  return {
    ...previous,
    [name.trim()]: headerValue,
  };
}

// Parse the command line arguments
program.parse(); 