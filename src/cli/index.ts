#!/usr/bin/env node
import { Command } from 'commander';
import { OpenAPIV3 } from 'openapi-types';
import { loadOpenAPISpec } from '../openapi/loader.js';
import { MCPServerGenerator } from '../mcp/server-generator.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import readline from 'readline';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';

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
  .option('-r, --register', 'Register this API with Claude Desktop')
  .option('-s, --server-name <name>', 'Name to use for the server in Claude Desktop (defaults to spec title)')
  .action(async (specPath: string, options: {
    name?: string;
    version?: string;
    baseUrl?: string;
    apiKey?: string;
    header: Record<string, string>;
    register?: boolean;
    serverName?: string;
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

      // If register option is set, update Claude Desktop config
      if (options.register) {
        const serverName = options.serverName || 
          options.name || 
          spec.info.title?.toLowerCase().replace(/[^a-z0-9]/g, '_') || 
          path.basename(specPath, path.extname(specPath));
        
        await registerWithClaudeDesktop(
          serverName,
          specPath,
          options.apiKey,
          options.name,
          options.version,
          options.baseUrl,
          options.header
        );
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

/**
 * Register the API with Claude Desktop by updating its config file
 */
async function registerWithClaudeDesktop(
  serverName: string,
  specPath: string,
  apiKey?: string,
  name?: string,
  version?: string,
  baseUrl?: string,
  headers?: Record<string, string>
): Promise<void> {
  try {
    // Find the Claude Desktop config file
    const configPath = await findClaudeDesktopConfig();
    
    if (!configPath) {
      console.error('Could not find Claude Desktop config file. Continuing without registration.');
      return;
    }
    
    console.error(`Found Claude Desktop config at: ${configPath}`);
    
    // Read the current config
    let config: any = {};
    try {
      const configData = await fs.readFile(configPath, 'utf-8');
      config = JSON.parse(configData);
    } catch (err) {
      // If file doesn't exist or is invalid JSON, start with an empty config
      config = {};
    }
    
    // Ensure mcpServers property exists
    if (!config.mcpServers) {
      config.mcpServers = {};
    }
    
    // Build the arguments array
    const args = [specPath];
    
    if (apiKey) {
      args.push('-k', apiKey);
    }
    
    if (name) {
      args.push('-n', name);
    }
    
    if (version) {
      args.push('-v', version);
    }
    
    if (baseUrl) {
      args.push('-u', baseUrl);
    }
    
    // Add headers
    if (headers) {
      Object.entries(headers).forEach(([key, value]) => {
        args.push('-H', `${key}: ${value}`);
      });
    }
    
    // Add or update the server configuration
    config.mcpServers[serverName] = {
      command: 'openapi-to-mcp',
      args
    };
    
    // Write the updated config
    await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
    
    console.error(`Successfully registered API as "${serverName}" with Claude Desktop!`);
    console.error('Restart Claude Desktop for the changes to take effect.');
    
  } catch (err) {
    console.error('Failed to register with Claude Desktop:', err instanceof Error ? err.message : String(err));
    console.error('Continuing without registration.');
  }
}

/**
 * Find the Claude Desktop config file
 */
async function findClaudeDesktopConfig(): Promise<string | null> {
  const homeDir = os.homedir();
  
  // Common locations by platform
  const configPaths = {
    darwin: [
      path.join(homeDir, 'Library', 'Application Support', 'Claude', 'claude_desktop_config.json'),
    ],
    win32: [
      path.join(homeDir, 'AppData', 'Roaming', 'Claude', 'claude_desktop_config.json'),
    ],
    linux: [
      path.join(homeDir, '.config', 'Claude', 'claude_desktop_config.json'),
      path.join(homeDir, '.claude', 'claude_desktop_config.json'),
    ]
  };
  
  // Get paths for current platform
  const platform = process.platform as 'darwin' | 'win32' | 'linux';
  const possiblePaths = configPaths[platform] || [];
  
  // Also check XDG_CONFIG_HOME on Linux
  if (platform === 'linux' && process.env.XDG_CONFIG_HOME) {
    possiblePaths.unshift(path.join(process.env.XDG_CONFIG_HOME, 'Claude', 'claude_desktop_config.json'));
  }
  
  // Try each path
  for (const configPath of possiblePaths) {
    try {
      await fs.access(configPath);
      return configPath;
    } catch {
      // File doesn't exist, try next one
    }
  }
  
  // If we can't find an existing file, return the most likely location
  return possiblePaths[0] || null;
}

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