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
import { exec } from 'child_process';
import { promisify } from 'util';
import chalk from 'chalk';
import ora from 'ora';
import figlet from 'figlet';

const execAsync = promisify(exec);

// Display ASCII art banner
console.log(
  chalk.cyan(
    figlet.textSync('OpenAPI to MCP', { 
      font: 'Standard',
      horizontalLayout: 'default',
      verticalLayout: 'default' 
    })
  )
);
console.log(chalk.blue('Convert any OpenAPI spec to an MCP server for Claude Desktop 🤖\n'));

const program = new Command();

// Define the CLI version
program
  .name(chalk.cyan('openapi-to-mcp'))
  .description('CLI tool to convert OpenAPI specs to MCP servers')
  .version('1.0.0');

// Define the main command
program
  .argument('[spec]', 'Path or URL to the OpenAPI specification file')
  .option('-n, --name <n>', 'Name of the MCP server')
  .option('-v, --version <version>', 'Version of the MCP server')
  .option('-u, --base-url <url>', 'Base URL for the API')
  .option('-k, --api-key <key>', 'API key for authentication')
  .option('-H, --header <header>', 'HTTP header(s) to include with requests (format: "Name: Value")', collectHeaders, {})
  .option('-r, --register', 'Register this API with Claude Desktop')
  .option('-s, --server-name <name>', 'Name to use for the server in Claude Desktop (defaults to spec title)')
  .option('-R, --restart-claude', 'Automatically restart Claude Desktop after registration')
  .option('-i, --interactive', 'Run in interactive mode with prompts for all options')
  .action(async (specPath: string | undefined, options: {
    name?: string;
    version?: string;
    baseUrl?: string;
    apiKey?: string;
    header: Record<string, string>;
    register?: boolean;
    serverName?: string;
    restartClaude?: boolean;
    interactive?: boolean;
  }) => {
    try {
      // If no spec path is provided or interactive mode is enabled, prompt for inputs
      if (!specPath || options.interactive) {
        const answers = await promptForMissingOptions(specPath, options);
        specPath = answers.specPath;
        options = { ...options, ...answers.options };
      }

      // Load the OpenAPI spec
      const spinner = ora(chalk.blue(`Loading OpenAPI spec from ${chalk.cyan(specPath)}...`)).start();
      const spec = await loadOpenAPISpec(specPath);
      spinner.succeed(chalk.green(`Successfully loaded OpenAPI spec from ${chalk.cyan(specPath)}`));
      
      // Check if API requires authentication
      const requiresAuth = checkIfAuthRequired(spec);
      
      // If auth is required but no API key provided, prompt for it
      if (requiresAuth && !options.apiKey && !hasAuthHeader(options.header)) {
        console.log(chalk.yellow('⚠️  API requires authentication'));
        options.apiKey = await promptForApiKey();
      }
      
      // Add API key to headers if provided
      if (options.apiKey) {
        // Determine the authentication type from the spec
        const authType = getAuthType(spec);
        
        if (authType === 'bearer') {
          spinner.start(chalk.blue('Setting up Bearer authentication...'));
          options.header['Authorization'] = `Bearer ${options.apiKey}`;
          spinner.succeed(chalk.green('Bearer authentication configured'));
        } else if (authType === 'apiKey') {
          const { name, in: location } = getApiKeyDetails(spec);
          if (location === 'header') {
            spinner.start(chalk.blue(`Setting up API Key authentication in header '${name}'...`));
            options.header[name] = options.apiKey;
            spinner.succeed(chalk.green('API Key authentication configured'));
          } else {
            spinner.info(chalk.blue(`API Key will be sent as a ${location} parameter`));
          }
        }
      }

      // If register option is set, update Claude Desktop config
      if (options.register) {
        const serverName = options.serverName || 
          options.name || 
          spec.info.title?.toLowerCase().replace(/[^a-z0-9]/g, '_') || 
          path.basename(specPath, path.extname(specPath));
        
        spinner.start(chalk.blue(`Registering API as "${chalk.cyan(serverName)}" with Claude Desktop...`));
        await registerWithClaudeDesktop(
          serverName,
          specPath,
          options.apiKey,
          options.name,
          options.version,
          options.baseUrl,
          options.header
        );
        spinner.succeed(chalk.green(`Successfully registered API as "${chalk.cyan(serverName)}" with Claude Desktop!`));

        // If restart option is set, restart Claude Desktop
        if (options.restartClaude) {
          spinner.start(chalk.blue('Restarting Claude Desktop...'));
          await restartClaudeDesktop();
          spinner.succeed(chalk.green('Claude Desktop has been restarted!'));
        } else {
          console.log(chalk.yellow('ℹ️  Remember to restart Claude Desktop for the changes to take effect.'));
        }
      }
      
      // Create the server generator
      spinner.start(chalk.blue('Generating MCP server...'));
      const generator = new MCPServerGenerator(spec, {
        name: options.name,
        version: options.version,
        baseUrl: options.baseUrl,
        headers: options.header,
        apiKey: options.apiKey,
      });
      
      // Generate the MCP server
      const server = generator.generateServer();
      spinner.succeed(chalk.green('MCP server generated successfully'));
      
      // Start the server using stdio transport
      spinner.start(chalk.blue('Starting MCP server via stdio...'));
      const transport = new StdioServerTransport();
      await server.connect(transport);
      
      spinner.succeed(chalk.green('MCP server is running'));
      console.log(chalk.cyan('┌─────────────────────────────────────────────────────────┐'));
      console.log(chalk.cyan('│                                                         │'));
      console.log(chalk.cyan('│  ') + chalk.yellow('MCP server is running and ready to use with Claude') + chalk.cyan('  │'));
      console.log(chalk.cyan('│  ') + chalk.yellow('Press Ctrl+C to stop the server') + chalk.cyan('                    │'));
      console.log(chalk.cyan('│                                                         │'));
      console.log(chalk.cyan('└─────────────────────────────────────────────────────────┘'));
    } catch (error: unknown) {
      ora().fail(chalk.red(`Error: ${error instanceof Error ? error.message : String(error)}`));
      process.exit(1);
    }
  });

/**
 * Prompt for missing required options in interactive mode
 */
async function promptForMissingOptions(specPath?: string, options?: any): Promise<{ specPath: string, options: any }> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  const prompt = (question: string): Promise<string> => {
    return new Promise((resolve) => {
      rl.question(chalk.cyan(`💬 ${question}`), (answer) => {
        resolve(answer.trim());
      });
    });
  };

  const promptYesNo = async (question: string, defaultYes = true): Promise<boolean> => {
    const suffix = defaultYes ? '[Y/n]' : '[y/N]';
    const answer = await prompt(`${question} ${suffix} `);
    if (!answer) return defaultYes;
    return answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes';
  };

  try {
    const updatedOptions: any = { ...options };
    
    // Prompt for OpenAPI spec path if not provided
    if (!specPath) {
      console.log(chalk.blue('\n📋 Interactive Mode - Enter the required information:'));
      specPath = await prompt('Enter the URL or file path to your OpenAPI spec: ');
    }
    
    // If interactive mode, only prompt for essential options
    if (options.interactive) {
      // API Key (optional but common)
      if (!updatedOptions.apiKey) {
        const apiKey = await prompt('Enter API key (optional, press Enter to skip): ');
        if (apiKey) updatedOptions.apiKey = apiKey;
      }
      
      // Register with Claude Desktop
      if (updatedOptions.register === undefined) {
        updatedOptions.register = await promptYesNo('Register with Claude Desktop?');
      }
      
      // Restart Claude Desktop (if registering)
      if (updatedOptions.register && updatedOptions.restartClaude === undefined) {
        updatedOptions.restartClaude = await promptYesNo('Automatically restart Claude Desktop?');
      }
    }
    
    return { specPath, options: updatedOptions };
    
  } finally {
    rl.close();
  }
}

/**
 * Restart Claude Desktop application
 */
async function restartClaudeDesktop(): Promise<void> {
  const platform = process.platform;

  try {
    if (platform === 'darwin') {
      // macOS
      await execAsync('pkill -x "Claude"');
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for app to close
      await execAsync('open -a "Claude"');
    } else if (platform === 'win32') {
      // Windows
      await execAsync('taskkill /IM "Claude.exe" /F');
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for app to close
      await execAsync('start "" "Claude.exe"');
    } else if (platform === 'linux') {
      // Linux - this is more complex and might not work for all distributions
      await execAsync('pkill -f "claude-desktop"');
      await new Promise(resolve => setTimeout(resolve, 1000)); // Wait for app to close
      await execAsync('claude-desktop &');
    } else {
      console.log(chalk.yellow(`⚠️  Automatic restart not supported on platform: ${platform}`));
      console.log(chalk.yellow('⚠️  Please restart Claude Desktop manually.'));
      return;
    }
  } catch (error) {
    console.log(chalk.yellow('⚠️  Failed to restart Claude Desktop:'), error instanceof Error ? error.message : String(error));
    console.log(chalk.yellow('⚠️  Please restart Claude Desktop manually.'));
  }
}

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
      console.log(chalk.yellow('⚠️  Could not find Claude Desktop config file. Continuing without registration.'));
      return;
    }
    
    console.log(chalk.blue(`Found Claude Desktop config at: ${chalk.cyan(configPath)}`));
    
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
  } catch (err) {
    console.log(chalk.yellow('⚠️  Failed to register with Claude Desktop:'), err instanceof Error ? err.message : String(err));
    console.log(chalk.yellow('⚠️  Continuing without registration.'));
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
    rl.question(chalk.cyan('💬 Enter API key: '), (answer) => {
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