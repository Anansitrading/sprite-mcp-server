#!/bin/bash
set -e

# Sprite MCP Server - Quick Deploy Script
# Run this after cloning the repo

echo "🚀 Deploying Sprite MCP Server..."

# Check Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js not found. Please install Node.js 20+"
    exit 1
fi

NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 20 ]; then
    echo "❌ Node.js 20+ required. Found: $(node -v)"
    exit 1
fi
echo "✅ Node.js $(node -v)"

# Check sprite CLI
SPRITE_BIN=$(which sprite 2>/dev/null || echo "")
if [ -z "$SPRITE_BIN" ]; then
    echo "⚠️  Sprite CLI not found in PATH"
    echo "   Looking in common locations..."

    for path in ~/.local/bin/sprite /usr/local/bin/sprite; do
        if [ -x "$path" ]; then
            SPRITE_BIN="$path"
            break
        fi
    done
fi

if [ -z "$SPRITE_BIN" ]; then
    echo "❌ Sprite CLI not found. Please install it first."
    exit 1
fi
echo "✅ Sprite CLI: $SPRITE_BIN"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build
echo "🔨 Building..."
npm run build

# Create .env if not exists
if [ ! -f .env ]; then
    echo "📝 Creating .env file..."
    cat > .env << EOF
PORT=3847
SPRITE_BIN=$SPRITE_BIN
EOF
    echo "✅ Created .env"
fi

# Test the server
echo "🧪 Testing server..."
timeout 3 node dist/http-server.js &
SERVER_PID=$!
sleep 2

if curl -s http://localhost:3847/health | grep -q "ok"; then
    echo "✅ Server health check passed"
else
    echo "❌ Server health check failed"
fi

kill $SERVER_PID 2>/dev/null || true

echo ""
echo "=========================================="
echo "✅ Deployment ready!"
echo "=========================================="
echo ""
echo "Next steps:"
echo ""
echo "1. Start the server:"
echo "   npm run start:http"
echo ""
echo "2. Or install as systemd service:"
echo "   sudo cp sprite-mcp.service /etc/systemd/system/"
echo "   sudo systemctl daemon-reload"
echo "   sudo systemctl enable --now sprite-mcp"
echo ""
echo "3. Set up reverse proxy (Caddy example):"
echo "   mcp.yourdomain.com {"
echo "       reverse_proxy localhost:3847"
echo "   }"
echo ""
echo "4. Add to claude.ai:"
echo "   URL: https://mcp.yourdomain.com/sse"
echo ""
