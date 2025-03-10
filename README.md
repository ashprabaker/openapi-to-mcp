# 🔌 OpenAPI to MCP 🤖

```
 ___                 ___  ___  _     _         __ __  ___  ___ 
| . | ___  ___ ._ _ | . || . \| |  _| |_ ___  |  \  \|  _>| . \
| | || . \/ ._>| ' ||   ||  _/| |   | | / . \ |     || <__|  _/
`___'|  _/\___.|_|_||_|_||_|  |_|   |_| \___/ |_|_|_|`___/|_|  
     |_|                                                       
```

A CLI tool that converts any OpenAPI specification into an MCP server for seamless integration with Claude Desktop. Instantly add API access to Claude through a simple one-line command.

## ✨ Key Features

- 🔄 **Instant Claude Desktop Integration**: Add any API to Claude with a single command
- ⚙️ **Auto-Configuration**: Automatically updates Claude Desktop's config file
- 🔄 **Auto-Restart**: Can automatically restart Claude Desktop after registration
- 🔐 **Authentication Support**: Handles API keys, Bearer tokens, and OAuth (coming soon)
- 💻 **Cross-Platform**: Works on macOS, Windows, and Linux
- 📚 **Full OpenAPI Support**: Compatible with OpenAPI 3.0 specifications
- 🧙‍♂️ **Interactive Mode**: Guided setup with no command line arguments needed

## 🔧 Installation

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

## 🚀 Quick Start for Claude Desktop

### Interactive Mode (Easiest)

```bash
# Start in fully guided interactive mode
npm run interactive

# Or if installed globally:
openapi-to-mcp -i
```

This will guide you through setting up an API with minimal prompts:
1. Enter your OpenAPI spec URL or file path
2. Optionally provide an API key if needed
3. Choose whether to register with Claude Desktop
4. Decide if you want to automatically restart Claude Desktop

### Command Line Mode

```bash
# Add an API to Claude Desktop with one command and auto-restart
openapi-to-mcp https://raw.githubusercontent.com/OAI/OpenAPI-Specification/main/examples/v3.0/petstore.yaml -r -R

# Add an API with authentication and auto-restart
openapi-to-mcp https://your-api-spec-url.json -k your-api-key -r -R
```

## 📋 Usage

```bash
# Run in interactive mode
openapi-to-mcp -i

# Basic usage
openapi-to-mcp <path-or-url-to-openapi-spec>

# Example with a local file
openapi-to-mcp ./your-api.yaml

# Example with a URL
openapi-to-mcp https://your-api-spec-url.json

# With API key authentication
openapi-to-mcp ./your-api.yaml -k "your-api-key-here"

# Auto-register with Claude Desktop (will update Claude Desktop's config file)
openapi-to-mcp ./your-api.yaml -r

# Auto-register and automatically restart Claude Desktop
openapi-to-mcp ./your-api.yaml -r -R

# Auto-register with a custom server name
openapi-to-mcp ./your-api.yaml -r -s "my-custom-api"

# Custom server name and version
openapi-to-mcp ./your-api.yaml -n "My API" -v "1.0.0"

# Custom base URL
openapi-to-mcp ./your-api.yaml -u "https://api.example.com"

# With custom headers
openapi-to-mcp ./your-api.yaml -H "Authorization: Bearer token123"

# Running in headless mode (no UI, for Claude Desktop to use)
openapi-to-mcp ./your-api.yaml --no-ui
```

## ⚙️ Options

- `-i, --interactive`: Run in interactive mode with guided prompts
- `-n, --name <name>`: Set a custom name for the MCP server (defaults to the title from the OpenAPI spec)
- `-v, --version <version>`: Set a custom version for the server (defaults to the version from the OpenAPI spec)
- `-u, --base-url <url>`: Set a custom base URL for API requests (defaults to the first server URL in the OpenAPI spec)
- `-k, --api-key <key>`: API key for authentication (if the API requires it)
- `-H, --header <header>`: Add a custom HTTP header to include with requests (format: "Name: Value")
- `-r, --register`: Automatically register the API with Claude Desktop
- `-s, --server-name <name>`: Custom name for the registered server in Claude Desktop
- `-R, --restart-claude`: Automatically restart Claude Desktop after registration (cross-platform)
- `--no-ui`: Disable all UI elements (ASCII art, colors, etc.) for clean JSON output (used by Claude Desktop)

## 🤖 Claude Desktop Integration

This tool is specifically designed to work seamlessly with Claude Desktop:

```bash
# Register any API with Claude Desktop in one step and auto-restart
openapi-to-mcp https://your-api-spec-url.json -k your-api-key -r -R

# Or use interactive mode for guided setup
openapi-to-mcp -i
```

This will:
1. 🔍 Find the Claude Desktop config file on your system
2. ➕ Add or update the server configuration
3. 💾 Preserve any existing configurations
4. 🏷️ Auto-generate a server name based on the API title
5. 🔄 Automatically restart Claude Desktop (if -R flag is used)

When registering an API with Claude Desktop, the tool automatically adds the `--no-ui` flag to ensure clean JSON communication between Claude and the server. This prevents the ASCII art and colorful output from interfering with the MCP protocol.

The auto-restart feature works on macOS, Windows, and Linux, allowing you to immediately use your new API without manually restarting Claude.

## 🌐 Supported API Platforms

You can use this tool with any OpenAPI-compliant API, including:

- 🐙 GitHub API
- 💳 Stripe API
- 🛒 Shopify API
- 🔥 Firebase API
- 🏢 Custom internal APIs
- ✨ And many more!

## 🔑 Authentication Support

The tool automatically detects authentication requirements from the OpenAPI specification:

- 🔐 **Bearer authentication**: When detected, the provided API key is used as a Bearer token
- 🔑 **API Key authentication**: Either added as a header or query parameter as specified in the spec
- 💬 For APIs requiring authentication but no key is provided, the tool will prompt for an API key

## 🔍 How It Works

1. 📥 The tool loads and parses the OpenAPI spec from a file or URL
2. 🔐 It automatically detects authentication requirements and handles them appropriately
3. 🛠️ It converts each OpenAPI operation into an MCP tool
4. ✅ Parameters are converted to Zod schemas for validation
5. 🌐 When a tool is called, the corresponding API request is made
6. 📤 The response is returned to the MCP client

## 🔌 Use with Claude Desktop

There are three ways to use this tool with Claude Desktop:

### Method 1: Interactive Mode (Recommended for Beginners) ✨
```bash
# Start the interactive wizard
npm run interactive
# Or if globally installed:
openapi-to-mcp -i
```
You'll be guided through the entire process with simple prompts!

### Method 2: Auto-registration (Recommended for Command Line) ✨
```bash
# One-time registration with auto-restart
openapi-to-mcp your-api-spec.yaml -k your-api-key -r -R
```
Claude Desktop will automatically restart and the API will appear in your sidebar!

### Method 3: Manual connection 🔧
1. Run the tool with your OpenAPI spec: `openapi-to-mcp ./spec.yaml -k your-api-key`
2. In Claude Desktop, add the MCP Server via the "Add Tool" button
3. Use the "Connect to local server" option and follow the prompts

## 🔧 Troubleshooting

### JSON Parsing Errors in Claude Desktop
If you see errors like `MCP firecrawl: Unexpected token '/'...` or other JSON-related errors:

1. Make sure you're using the latest version of this tool
2. Try running with the `--no-ui` flag: `openapi-to-mcp your-api.yaml --no-ui`
3. When registering with Claude Desktop, the tool automatically adds this flag

The `--no-ui` flag ensures clean JSON communication by:
- Disabling the ASCII art banner
- Removing colorful output
- Redirecting all UI elements to stderr instead of stdout
- Keeping the MCP communication channel clean

## 📝 License

MIT 