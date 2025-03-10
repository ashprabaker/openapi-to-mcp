#!/usr/bin/env node
import { Command } from 'commander';
import { OpenAPIV3 } from 'openapi-types';
import { loadOpenAPISpec } from '../openapi/loader.js';
import { MCPServerGenerator } from '../mcp/server-generator.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import readline from 'readline';

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
  .option('-k, --api-key <key>', 'API key for authentication')
  .option('-H, --header <header>', 'HTTP header(s) to include with requests (format: "Name: Value")', collectHeaders, {})
  .action(async (specPath: string, options: {
    name?: string;
    version?: string;
    baseUrl?: string;
    apiKey?: string;
    header: Record<string, string>;
  }) => {
    try {
      // Load the OpenAPI spec
      console.error(`Loading OpenAPI spec from ${specPath}...`);
      const spec = await loadOpenAPISpec(specPath);
      
      // Check if API requires authentication
      const requiresAuth = checkIfAuthRequired(spec);
      
      // If auth is required but no API key provided, prompt for it
      if (requiresAuth && !options.apiKey && !hasAuthHeader(options.header)) {
        options.apiKey = await promptForApiKey();
      }
      
      // Add API key to headers if provided
      if (options.apiKey) {
        // Determine the authentication type from the spec
        const authType = getAuthType(spec);
        
        if (authType === 'bearer') {
          options.header['Authorization'] = `Bearer ${options.apiKey}`;
        } else if (authType === 'apiKey') {
          const { name, in: location } = getApiKeyDetails(spec);
          if (location === 'header') {
            options.header[name] = options.apiKey;
          }
          // For query parameters, we'll handle it when making the request
        }
      }
      
      // Create the server generator
      const generator = new MCPServerGenerator(spec, {
        name: options.name,
        version: options.version,
        baseUrl: options.baseUrl,
        headers: options.header,
        apiKey: options.apiKey,
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

// Helper function to check if API requires authentication
function checkIfAuthRequired(spec: OpenAPIV3.Document): boolean {
  // Check global security requirement
  if (spec.security && spec.security.length > 0) {
    return true;
  }
  
  // Check path-level security
  const paths = spec.paths || {};
  for (const pathKey in paths) {
    const path = paths[pathKey];
    if (!path) continue;
    
    for (const method of ['get', 'post', 'put', 'delete', 'patch'] as const) {
      const operation = path[method] as OpenAPIV3.OperationObject | undefined;
      if (operation?.security && operation.security.length > 0) {
        return true;
      }
    }
  }
  
  return false;
}

// Helper function to get the authentication type
function getAuthType(spec: OpenAPIV3.Document): 'bearer' | 'apiKey' | 'oauth2' | 'unknown' {
  const securitySchemes = spec.components?.securitySchemes || {};
  
  for (const scheme of Object.values(securitySchemes)) {
    const securityScheme = scheme as OpenAPIV3.SecuritySchemeObject;
    
    if (securityScheme.type === 'http' && securityScheme.scheme === 'bearer') {
      return 'bearer';
    } else if (securityScheme.type === 'apiKey') {
      return 'apiKey';
    } else if (securityScheme.type === 'oauth2') {
      return 'oauth2';
    }
  }
  
  return 'unknown';
}

// Helper function to get API key details
function getApiKeyDetails(spec: OpenAPIV3.Document): { name: string; in: string } {
  const securitySchemes = spec.components?.securitySchemes || {};
  
  for (const scheme of Object.values(securitySchemes)) {
    const securityScheme = scheme as OpenAPIV3.SecuritySchemeObject;
    
    if (securityScheme.type === 'apiKey') {
      return {
        name: securityScheme.name || 'api_key',
        in: securityScheme.in || 'header'
      };
    }
  }
  
  return { name: 'Authorization', in: 'header' };
}

// Helper function to check if authentication header is already provided
function hasAuthHeader(headers: Record<string, string>): boolean {
  const authHeaders = ['authorization', 'x-api-key', 'api-key'];
  return Object.keys(headers).some(header => 
    authHeaders.includes(header.toLowerCase()));
}

// Helper function to prompt for API key
function promptForApiKey(): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stderr
  });
  
  return new Promise(resolve => {
    rl.question('Enter API key: ', (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

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