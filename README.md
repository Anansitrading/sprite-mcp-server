# Sprite MCP Server

MCP server for managing Sprite VMs with **interactive UI dashboards** (MCP Apps).

Works with Claude.ai, Claude Desktop, Claude Code, VS Code, and any MCP-compatible client.

## Features

- **List & manage Sprite VMs** - Interactive dashboard with status indicators
- **Execute commands** - Terminal UI with command history
- **Checkpoints** - Create, list, restore filesystem snapshots
- **File transfer** - Push/pull files to/from remote sprites
- **Session management** - List, attach, kill sessions

## Quick Deploy to Your Server

### Prerequisites

- Node.js 20+
- A domain pointing to your server (for HTTPS)
- Sprite CLI configured with credentials

### 1. Clone & Install

```bash
git clone https://github.com/davidkiama/sprite-mcp-server.git
cd sprite-mcp-server
npm install
npm run build
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your settings
```

```env
PORT=3847
SPRITE_BIN=/path/to/sprite  # Usually ~/.local/bin/sprite
```

### 3. Run with systemd (Recommended)

```bash
# Copy service file
sudo cp sprite-mcp.service /etc/systemd/system/

# Edit the service file to set your paths
sudo nano /etc/systemd/system/sprite-mcp.service

# Enable and start
sudo systemctl daemon-reload
sudo systemctl enable sprite-mcp
sudo systemctl start sprite-mcp

# Check status
sudo systemctl status sprite-mcp
```

### 4. Set Up Reverse Proxy (Caddy)

```bash
# Install Caddy if needed
sudo apt install -y caddy

# Add to /etc/caddy/Caddyfile
echo '
mcp.yourdomain.com {
    reverse_proxy localhost:3847
}
' | sudo tee -a /etc/caddy/Caddyfile

# Reload Caddy
sudo systemctl reload caddy
```

### 5. Connect to Claude.ai

1. Go to [claude.ai/settings/integrations](https://claude.ai/settings/integrations)
2. Add MCP Server:
   - **Name**: `sprite-mcp`
   - **URL**: `https://mcp.yourdomain.com/sse`
3. Test by asking Claude: "List my sprites"

## Local Development

```bash
# Run stdio server (for Claude Code/Desktop)
npm start

# Run HTTP/SSE server (for claude.ai)
npm run start:http

# Development mode with hot reload
npm run dev
```

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

## Troubleshooting

### Check if server is running
```bash
curl http://localhost:3847/health
# Should return: {"status":"ok","server":"sprite-mcp","version":"1.0.0"}
```

### Check logs
```bash
# If using systemd
journalctl -u sprite-mcp -f

# If running directly
npm run start:http 2>&1 | tee mcp.log
```

### Test MCP handshake
```bash
echo '{"jsonrpc":"2.0","method":"tools/list","params":{},"id":1}' | npm start
```

### Sprite CLI not found
```bash
# Find sprite binary
which sprite

# Set in .env
SPRITE_BIN=$(which sprite)
```

## License

MIT
