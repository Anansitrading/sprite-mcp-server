# Sprite MCP Server

MCP server for managing Sprite VMs with **interactive UI dashboards** (MCP Apps).

Works with Claude.ai, Claude Desktop, Claude Code, VS Code, and any MCP-compatible client.

## Features

- **List & manage Sprite VMs** - Interactive dashboard with status indicators
- **Execute commands** - Terminal UI with command history
- **Checkpoints** - Create, list, restore filesystem snapshots
- **File transfer** - Push/pull files to/from remote sprites
- **Session management** - List, attach, kill sessions

---

## Windows Setup (Claude Desktop / Claude Code)

### Prerequisites

- **Node.js 20+** - Download from [nodejs.org](https://nodejs.org/)
- **Git** - Download from [git-scm.com](https://git-scm.com/download/win)
- **Sprite CLI** - Get your token from [sprites.dev](https://sprites.dev)

### Step 1: Install Sprite CLI

Download and install the Sprite CLI for Windows:

```powershell
# Using PowerShell (run as Administrator)
irm https://sprites.dev/install.ps1 | iex
```

Or download manually from [sprites.dev/downloads](https://sprites.dev/downloads).

### Step 2: Authenticate with Sprite

Get your API token from the Sprites dashboard, then:

```powershell
# Authenticate with your token
sprite auth setup --token "your-org/org-id/token-id/token-value"

# Or use interactive login (opens browser)
sprite login
```

Verify it works:

```powershell
sprite list
```

### Step 3: Clone and Build the MCP Server

```powershell
# Clone the repository
git clone https://github.com/Anansitrading/sprite-mcp-server.git
cd sprite-mcp-server

# Install dependencies
npm install

# Build the server
npm run build
```

### Step 4: Find Your Sprite CLI Path

```powershell
# Find where sprite is installed
where sprite
```

This typically returns something like:
- `C:\Users\YourName\.local\bin\sprite.exe`
- `C:\Users\YourName\AppData\Local\Programs\sprite\sprite.exe`

**Note this path** - you'll need it for configuration.

### Step 5: Configure Claude Desktop

Edit your Claude Desktop config file:

**Location:** `%APPDATA%\Claude\claude_desktop_config.json`

Open it with:
```powershell
notepad "$env:APPDATA\Claude\claude_desktop_config.json"
```

Add this configuration (replace paths with your actual paths):

```json
{
  "mcpServers": {
    "sprite": {
      "command": "node",
      "args": ["C:\\Users\\YourName\\sprite-mcp-server\\dist\\index.js"],
      "env": {
        "SPRITE_BIN": "C:\\Users\\YourName\\.local\\bin\\sprite.exe"
      }
    }
  }
}
```

**Important:** Use double backslashes (`\\`) in paths or forward slashes (`/`).

### Step 6: Restart Claude Desktop

1. Fully quit Claude Desktop (check system tray)
2. Reopen Claude Desktop
3. Look for the hammer icon (🔨) indicating MCP tools are available

### Step 7: Test It

Ask Claude:
- "List my sprites"
- "Execute `ls -la` on my sprite"
- "Create a checkpoint"

---

## Claude Code Setup (Windows)

For Claude Code CLI, add to your settings:

```powershell
# Open Claude Code settings
claude mcp add sprite -- node "C:\Users\YourName\sprite-mcp-server\dist\index.js"
```

Or edit `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "sprite": {
      "command": "node",
      "args": ["C:\\Users\\YourName\\sprite-mcp-server\\dist\\index.js"],
      "env": {
        "SPRITE_BIN": "C:\\Users\\YourName\\.local\\bin\\sprite.exe"
      }
    }
  }
}
```

---

## Linux/macOS Setup

### Prerequisites

- Node.js 20+
- Sprite CLI configured with credentials

### Quick Start

```bash
# Clone & build
git clone https://github.com/Anansitrading/sprite-mcp-server.git
cd sprite-mcp-server
npm install
npm run build

# Authenticate with Sprite
sprite login
# or
sprite auth setup --token "your-token"

# Test
sprite list
```

### Claude Desktop Configuration

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Linux:** `~/.config/Claude/claude_desktop_config.json`

```json
{
  "mcpServers": {
    "sprite": {
      "command": "node",
      "args": ["/path/to/sprite-mcp-server/dist/index.js"],
      "env": {
        "SPRITE_BIN": "/home/youruser/.local/bin/sprite"
      }
    }
  }
}
```

### Claude Code Configuration

```bash
claude mcp add sprite -- node /path/to/sprite-mcp-server/dist/index.js
```

---

## Server Deployment (for Claude.ai web)

For hosting your own MCP server accessible from claude.ai:

### Prerequisites

- Node.js 20+
- A domain pointing to your server (for HTTPS)
- Caddy or nginx for reverse proxy

### Deploy

```bash
# Clone & build
git clone https://github.com/Anansitrading/sprite-mcp-server.git
cd sprite-mcp-server
npm install
npm run build

# Configure
cp .env.example .env
# Edit .env:
#   PORT=3847
#   SPRITE_BIN=/home/sprite/.local/bin/sprite

# Run with systemd
sudo cp sprite-mcp.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable sprite-mcp
sudo systemctl start sprite-mcp
```

### Caddy Reverse Proxy

```caddyfile
mcp.yourdomain.com {
    reverse_proxy localhost:3847
}
```

### Connect to Claude.ai

1. Go to [claude.ai/settings/integrations](https://claude.ai/settings/integrations)
2. Add MCP Server:
   - **Name**: `sprite-mcp`
   - **URL**: `https://mcp.yourdomain.com/sse`
3. Test by asking Claude: "List my sprites"

---

## MCP Tools

| Tool | Description |
|------|-------------|
| `list_sprites` | List all Sprite VMs (with interactive dashboard) |
| `exec_command` | Execute command on a sprite (with terminal UI) |
| `create_checkpoint` | Create filesystem snapshot |
| `list_checkpoints` | List available checkpoints |
| `restore_checkpoint` | Restore to a checkpoint |
| `get_sprite_url` | Get sprite's public URL |
| `fetch_file` | Download file from sprite |
| `push_file` | Upload file to sprite |
| `list_sessions` | List active sessions |
| `create_sprite` | Create new sprite VM |
| `destroy_sprite` | Delete a sprite VM |

## Interactive UIs (MCP Apps)

This server uses **MCP Apps** to provide interactive interfaces:

- **Dashboard** (`ui://sprite/dashboard`) - Visual sprite management
- **Terminal** (`ui://sprite/terminal`) - Command execution interface

These render directly in the Claude conversation when using supported clients.

## Troubleshooting

### Windows: "sprite is not recognized"

Add Sprite to your PATH or use the full path in `SPRITE_BIN`:

```powershell
# Find sprite location
where sprite

# Add to PATH (PowerShell, run as admin)
$env:Path += ";C:\Users\YourName\.local\bin"
[Environment]::SetEnvironmentVariable("Path", $env:Path, [EnvironmentVariableTarget]::User)
```

### Windows: "ENOENT" or "spawn error"

- Ensure all paths use double backslashes or forward slashes
- Verify the `dist/index.js` file exists (run `npm run build` first)
- Check that `SPRITE_BIN` points to the actual `.exe` file

### "Sprite CLI not authenticated"

```bash
# Re-authenticate
sprite login

# Or with token
sprite auth setup --token "your-token"

# Verify
sprite list
```

### Check server health

```bash
# If running HTTP server
curl http://localhost:3847/health
```

### Test MCP handshake

```bash
echo '{"jsonrpc":"2.0","method":"tools/list","params":{},"id":1}' | npm start
```

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Claude.ai / Desktop                   │
├─────────────────────────────────────────────────────────┤
│                    MCP Protocol                          │
│              (stdio or HTTP/SSE transport)               │
├─────────────────────────────────────────────────────────┤
│                  sprite-mcp-server                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────┐  │
│  │ MCP Tools   │  │ UI Resources│  │ Sprite CLI      │  │
│  │ (11 tools)  │  │ (Dashboard) │  │ Integration     │  │
│  └─────────────┘  └─────────────┘  └─────────────────┘  │
├─────────────────────────────────────────────────────────┤
│                    Sprite CLI                            │
│              (sprite list, exec, checkpoint...)          │
├─────────────────────────────────────────────────────────┤
│                 Sprites API / VMs                        │
└─────────────────────────────────────────────────────────┘
```

## License

MIT
