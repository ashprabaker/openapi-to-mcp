# OpenAPI to MCP

A CLI tool that converts any OpenAPI specification into an MCP server for seamless integration with Claude Desktop. Instantly add API access to Claude through a simple one-line command.

## Key Features

- **Instant Claude Desktop Integration**: Add any API to Claude with a single command
- **Auto-Configuration**: Automatically updates Claude Desktop's config file
- **Auto-Restart**: Can automatically restart Claude Desktop after registration
- **Authentication Support**: Handles API keys, Bearer tokens, and OAuth (coming soon)
- **Cross-Platform**: Works on macOS, Windows, and Linux
- **Full OpenAPI Support**: Compatible with OpenAPI 3.0 specifications

## Installation

```bash
# Clone the repository
git clone https://github.com/ashprabaker/openapi-to-mcp.git
cd openapi-to-mcp

# Install dependencies
npm install

# Build the project
npm run build

# Link the CLI tool globally
npm link
```

## Quick Start for Claude Desktop

```bash
# Add an API to Claude Desktop with one command and auto-restart
openapi-to-mcp https://raw.githubusercontent.com/OAI/OpenAPI-Specification/main/examples/v3.0/petstore.yaml -r -R

# Add FireCrawl API with authentication and auto-restart
openapi-to-mcp https://raw.githubusercontent.com/devflowinc/firecrawl-simple/main/apps/api/v1-openapi.json -k your-api-key -r -R
```

## Usage

```bash
# Basic usage
openapi-to-mcp <path-or-url-to-openapi-spec>

# Example with a local file
openapi-to-mcp ./petstore.yaml

# Example with a URL
openapi-to-mcp https://raw.githubusercontent.com/OAI/OpenAPI-Specification/main/examples/v3.0/petstore.yaml

# With API key authentication
openapi-to-mcp ./petstore.yaml -k "your-api-key-here"

# Auto-register with Claude Desktop (will update Claude Desktop's config file)
openapi-to-mcp ./petstore.yaml -r

# Auto-register and automatically restart Claude Desktop
openapi-to-mcp ./petstore.yaml -r -R

# Auto-register with a custom server name
openapi-to-mcp ./petstore.yaml -r -s "my-custom-api"

# Custom server name and version
openapi-to-mcp ./petstore.yaml -n "Pet Store API" -v "1.0.0"

# Custom base URL
openapi-to-mcp ./petstore.yaml -u "https://api.example.com"

# With custom headers
openapi-to-mcp ./petstore.yaml -H "Authorization: Bearer token123"
```

## Options

- `-n, --name <name>`: Set a custom name for the MCP server (defaults to the title from the OpenAPI spec)
- `-v, --version <version>`: Set a custom version for the server (defaults to the version from the OpenAPI spec)
- `-u, --base-url <url>`: Set a custom base URL for API requests (defaults to the first server URL in the OpenAPI spec)
- `-k, --api-key <key>`: API key for authentication (if the API requires it)
- `-H, --header <header>`: Add a custom HTTP header to include with requests (format: "Name: Value")
- `-r, --register`: Automatically register the API with Claude Desktop
- `-s, --server-name <name>`: Custom name for the registered server in Claude Desktop
- `-R, --restart-claude`: Automatically restart Claude Desktop after registration (cross-platform)

## Claude Desktop Integration

This tool is specifically designed to work seamlessly with Claude Desktop:

```bash
# Register any API with Claude Desktop in one step and auto-restart
openapi-to-mcp https://api.example.com/openapi.json -k your-api-key -r -R
```

This will:
1. Find the Claude Desktop config file on your system
2. Add or update the server configuration
3. Preserve any existing configurations
4. Auto-generate a server name based on the API title
5. Automatically restart Claude Desktop (if -R flag is used)

The auto-restart feature works on macOS, Windows, and Linux, allowing you to immediately use your new API without manually restarting Claude.

## Supported API Platforms

You can use this tool with any OpenAPI-compliant API, including:

- GitHub API
- Stripe API
- Shopify API
- Firebase API
- Custom internal APIs
- And many more!

## Authentication Support

The tool automatically detects authentication requirements from the OpenAPI specification:

- Bearer authentication: When detected, the provided API key is used as a Bearer token
- API Key authentication: Either added as a header or query parameter as specified in the spec
- For APIs requiring authentication but no key is provided, the tool will prompt for an API key

## How It Works

1. The tool loads and parses the OpenAPI spec from a file or URL
2. It automatically detects authentication requirements and handles them appropriately
3. It converts each OpenAPI operation into an MCP tool
4. Parameters are converted to Zod schemas for validation
5. When a tool is called, the corresponding API request is made
6. The response is returned to the MCP client

## Use with Claude Desktop

There are two ways to use this tool with Claude Desktop:

### Method 1: Auto-registration (recommended)
```bash
# One-time registration
openapi-to-mcp your-api-spec.yaml -k your-api-key -r
```
Then restart Claude Desktop, and the API will appear in your sidebar.

### Method 2: Manual connection
1. Run the tool with your OpenAPI spec: `openapi-to-mcp ./spec.yaml -k your-api-key`
2. In Claude Desktop, add the MCP Server via the "Add Tool" button
3. Use the "Connect to local server" option and follow the prompts

## License

MIT 