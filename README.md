# OpenAPI to MCP

A CLI tool that converts any OpenAPI specification into an MCP (Model Context Protocol) server. This allows you to expose any OpenAPI-defined API as a tool to Claude Desktop or any MCP-compatible client.

## Installation

```bash
# Clone the repository
git clone https://github.com/ashprabaker/openapi-to-mcp.git
cd openapi-to-mcp

# Install dependencies
npm install

# Build the project
npm run build

# Link the CLI tool
npm link
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

1. Run the tool with your OpenAPI spec: `openapi-to-mcp ./spec.yaml -k your-api-key`
2. In Claude Desktop, add the MCP Server via the "Add Tool" button
3. Use the "Connect to local server" option and follow the prompts

## License

MIT 