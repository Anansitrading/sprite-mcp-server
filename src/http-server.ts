#!/usr/bin/env node
/**
 * Sprite MCP Server - HTTP/SSE Transport
 *
 * This version can be deployed and connected to from claude.ai
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { exec } from "child_process";
import { promisify } from "util";
import express from "express";
import type { Request, Response } from "express";

const execAsync = promisify(exec);
const app = express();
const PORT = parseInt(process.env.PORT || "3847");

// CORS for claude.ai
app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
  if (req.method === "OPTIONS") {
    return res.sendStatus(200);
  }
  next();
});

app.use(express.json());

// Store active transports
const transports = new Map<string, SSEServerTransport>();

// Embedded UI HTML (same as stdio version)
const DASHBOARD_UI = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sprite Dashboard</title>
  <script src="https://cdn.jsdelivr.net/npm/@modelcontextprotocol/ext-apps@1.0.1/dist/app.umd.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      color: #e4e4e7;
      padding: 20px;
      min-height: 100vh;
    }
    .container { max-width: 900px; margin: 0 auto; }
    h1 {
      font-size: 24px;
      margin-bottom: 20px;
      background: linear-gradient(90deg, #00d4ff, #7c3aed);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .sprite-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .sprite-card {
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 12px;
      padding: 16px;
      transition: all 0.2s;
      cursor: pointer;
    }
    .sprite-card:hover {
      background: rgba(255,255,255,0.1);
      border-color: #7c3aed;
      transform: translateY(-2px);
    }
    .sprite-card.selected {
      border-color: #00d4ff;
      box-shadow: 0 0 20px rgba(0,212,255,0.2);
    }
    .sprite-name {
      font-size: 16px;
      font-weight: 600;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .status-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: #22c55e;
    }
    .status-dot.stopped { background: #ef4444; }
    .sprite-info {
      font-size: 13px;
      color: #a1a1aa;
    }
    .actions {
      display: flex;
      gap: 8px;
      margin-top: 24px;
      flex-wrap: wrap;
    }
    .btn {
      padding: 10px 20px;
      border: none;
      border-radius: 8px;
      font-size: 14px;
      font-weight: 500;
      cursor: pointer;
      transition: all 0.2s;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .btn-primary {
      background: linear-gradient(90deg, #7c3aed, #00d4ff);
      color: white;
    }
    .btn-primary:hover { opacity: 0.9; transform: scale(1.02); }
    .btn-secondary {
      background: rgba(255,255,255,0.1);
      color: #e4e4e7;
      border: 1px solid rgba(255,255,255,0.2);
    }
    .btn-secondary:hover { background: rgba(255,255,255,0.15); }
    .terminal {
      background: #0f0f0f;
      border-radius: 8px;
      padding: 16px;
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 13px;
      max-height: 300px;
      overflow-y: auto;
      margin-top: 16px;
      border: 1px solid rgba(255,255,255,0.1);
    }
    .terminal-line { line-height: 1.6; }
    .terminal-prompt { color: #22c55e; }
    .terminal-output { color: #a1a1aa; }
    .terminal-error { color: #ef4444; }
    .command-input {
      display: flex;
      gap: 8px;
      margin-top: 16px;
    }
    .command-input input {
      flex: 1;
      background: rgba(255,255,255,0.05);
      border: 1px solid rgba(255,255,255,0.2);
      border-radius: 8px;
      padding: 12px 16px;
      color: #e4e4e7;
      font-family: 'Monaco', 'Menlo', monospace;
      font-size: 14px;
    }
    .command-input input:focus {
      outline: none;
      border-color: #7c3aed;
    }
    .checkpoints {
      margin-top: 24px;
      padding: 16px;
      background: rgba(255,255,255,0.03);
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,0.1);
    }
    .checkpoint-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 12px;
      background: rgba(255,255,255,0.02);
      border-radius: 8px;
      margin-top: 8px;
    }
    .checkpoint-item:hover { background: rgba(255,255,255,0.05); }
    .loading {
      text-align: center;
      padding: 40px;
      color: #a1a1aa;
    }
    .spinner {
      width: 32px;
      height: 32px;
      border: 3px solid rgba(255,255,255,0.1);
      border-top-color: #7c3aed;
      border-radius: 50%;
      animation: spin 1s linear infinite;
      margin: 0 auto 16px;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .notification {
      position: fixed;
      bottom: 20px;
      right: 20px;
      padding: 12px 20px;
      background: #22c55e;
      color: white;
      border-radius: 8px;
      animation: slideIn 0.3s ease;
    }
    .notification.error { background: #ef4444; }
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>Sprite Dashboard</h1>
    <div id="content">
      <div class="loading">
        <div class="spinner"></div>
        <p>Loading sprites...</p>
      </div>
    </div>
  </div>

  <script>
    const { App } = window.MCPExtApps;

    let app;
    let selectedSprite = null;
    let sprites = [];
    let checkpoints = [];

    async function init() {
      app = new App();
      await app.connect();

      app.ontoolresult = (result) => {
        if (result.sprites) {
          sprites = result.sprites;
          renderDashboard();
        }
        if (result.checkpoints) {
          checkpoints = result.checkpoints;
          renderCheckpoints();
        }
        if (result.output) {
          addTerminalOutput(result.output, result.error);
        }
      };
    }

    function renderDashboard() {
      const content = document.getElementById('content');
      content.innerHTML = \`
        <div class="sprite-grid">
          \${sprites.map(s => \`
            <div class="sprite-card \${selectedSprite === s.name ? 'selected' : ''}"
                 onclick="selectSprite('\${s.name}')">
              <div class="sprite-name">
                <span class="status-dot \${s.status === 'running' ? '' : 'stopped'}"></span>
                \${s.name}
              </div>
              <div class="sprite-info">
                \${s.org || 'default org'} &bull; \${s.status || 'unknown'}
              </div>
            </div>
          \`).join('')}
        </div>

        <div class="actions">
          <button class="btn btn-primary" onclick="refreshSprites()">Refresh</button>
          <button class="btn btn-secondary" onclick="executeCommand()" \${!selectedSprite ? 'disabled' : ''}>Execute Command</button>
          <button class="btn btn-secondary" onclick="createCheckpoint()" \${!selectedSprite ? 'disabled' : ''}>Create Checkpoint</button>
          <button class="btn btn-secondary" onclick="listCheckpoints()" \${!selectedSprite ? 'disabled' : ''}>View Checkpoints</button>
        </div>

        <div class="command-input" \${!selectedSprite ? 'style="display:none"' : ''}>
          <input type="text" id="cmdInput" placeholder="Enter command to execute..."
                 onkeydown="if(event.key==='Enter')runCommand()">
          <button class="btn btn-primary" onclick="runCommand()">Run</button>
        </div>

        <div class="terminal" id="terminal" style="display:none"></div>
        <div class="checkpoints" id="checkpoints" style="display:none"></div>
      \`;
    }

    function selectSprite(name) {
      selectedSprite = name;
      renderDashboard();
      showNotification('Selected: ' + name);
      app.updateModelContext({
        content: [{ type: 'text', text: 'User selected sprite: ' + name }]
      });
    }

    async function refreshSprites() {
      showNotification('Refreshing...');
      const result = await app.callServerTool({ name: 'list_sprites', arguments: {} });
      if (result.sprites) {
        sprites = result.sprites;
        renderDashboard();
        showNotification('Sprites refreshed');
      }
    }

    async function runCommand() {
      const input = document.getElementById('cmdInput');
      const cmd = input.value.trim();
      if (!cmd || !selectedSprite) return;

      input.value = '';
      addTerminalOutput('$ ' + cmd, false, true);

      const result = await app.callServerTool({
        name: 'exec_command',
        arguments: { sprite: selectedSprite, command: cmd }
      });

      addTerminalOutput(result.output || result.error, !!result.error);
    }

    async function createCheckpoint() {
      if (!selectedSprite) return;
      showNotification('Creating checkpoint...');
      const result = await app.callServerTool({
        name: 'create_checkpoint',
        arguments: { sprite: selectedSprite }
      });
      showNotification(result.success ? 'Checkpoint created!' : 'Failed', !result.success);
    }

    async function listCheckpoints() {
      if (!selectedSprite) return;
      const result = await app.callServerTool({
        name: 'list_checkpoints',
        arguments: { sprite: selectedSprite }
      });
      if (result.checkpoints) {
        checkpoints = result.checkpoints;
        renderCheckpoints();
      }
    }

    function renderCheckpoints() {
      const el = document.getElementById('checkpoints');
      if (!el) return;
      el.style.display = 'block';
      el.innerHTML = '<h3 style="margin-bottom:12px;font-size:16px;">Checkpoints for ' + selectedSprite + '</h3>' +
        (checkpoints.length === 0 ? '<p style="color:#a1a1aa;">No checkpoints</p>' : '') +
        checkpoints.map(cp => '<div class="checkpoint-item"><div><div style="font-weight:500">' + (cp.id || cp.name) + '</div><div style="font-size:12px;color:#a1a1aa">' + (cp.created || '') + '</div></div><button class="btn btn-secondary" onclick="restoreCheckpoint(\\'' + cp.id + '\\')">Restore</button></div>').join('');
    }

    async function restoreCheckpoint(id) {
      showNotification('Restoring...');
      const result = await app.callServerTool({
        name: 'restore_checkpoint',
        arguments: { sprite: selectedSprite, checkpoint_id: id }
      });
      showNotification(result.success ? 'Restored!' : 'Failed', !result.success);
    }

    function addTerminalOutput(text, isError = false, isPrompt = false) {
      const terminal = document.getElementById('terminal');
      if (!terminal) return;
      terminal.style.display = 'block';
      const className = isPrompt ? 'terminal-prompt' : (isError ? 'terminal-error' : 'terminal-output');
      terminal.innerHTML += '<div class="terminal-line ' + className + '">' + escapeHtml(text) + '</div>';
      terminal.scrollTop = terminal.scrollHeight;
    }

    function escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }

    function showNotification(msg, isError = false) {
      const existing = document.querySelector('.notification');
      if (existing) existing.remove();
      const el = document.createElement('div');
      el.className = 'notification' + (isError ? ' error' : '');
      el.textContent = msg;
      document.body.appendChild(el);
      setTimeout(() => el.remove(), 3000);
    }

    function executeCommand() {
      document.getElementById('cmdInput')?.focus();
    }

    init();
  </script>
</body>
</html>
`;

const TERMINAL_UI = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Sprite Terminal</title>
  <script src="https://cdn.jsdelivr.net/npm/@modelcontextprotocol/ext-apps@1.0.1/dist/app.umd.min.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
      background: #0a0a0a;
      color: #00ff00;
      padding: 0;
      min-height: 100vh;
    }
    .terminal { padding: 16px; min-height: 100vh; }
    .terminal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding-bottom: 12px;
      border-bottom: 1px solid #333;
      margin-bottom: 12px;
    }
    .sprite-name { color: #00d4ff; font-weight: bold; }
    .output {
      white-space: pre-wrap;
      word-wrap: break-word;
      line-height: 1.5;
      max-height: 60vh;
      overflow-y: auto;
    }
    .output .stdout { color: #e4e4e7; }
    .output .stderr { color: #ef4444; }
    .output .system { color: #a1a1aa; font-style: italic; }
    .input-line { display: flex; align-items: center; margin-top: 12px; gap: 8px; }
    .prompt { color: #22c55e; }
    input {
      flex: 1;
      background: transparent;
      border: none;
      color: #00ff00;
      font-family: inherit;
      font-size: 14px;
      outline: none;
    }
    .status {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      padding: 8px 16px;
      background: #1a1a1a;
      border-top: 1px solid #333;
      font-size: 12px;
      color: #666;
    }
  </style>
</head>
<body>
  <div class="terminal">
    <div class="terminal-header">
      <span>Sprite Terminal - <span class="sprite-name" id="spriteName">connecting...</span></span>
    </div>
    <div class="output" id="output"></div>
    <div class="input-line">
      <span class="prompt">$</span>
      <input type="text" id="input" autofocus placeholder="Enter command...">
    </div>
  </div>
  <div class="status"><span id="status">Initializing...</span></div>

  <script>
    const { App } = window.MCPExtApps;
    let app, spriteName = '', history = [], historyIndex = -1;

    async function init() {
      app = new App();
      await app.connect();

      app.ontoolresult = (result) => {
        if (result.sprite) {
          spriteName = result.sprite;
          document.getElementById('spriteName').textContent = spriteName;
          setStatus('Connected to ' + spriteName);
        }
        if (result.output !== undefined) appendOutput(result.output, 'stdout');
        if (result.error) appendOutput(result.error, 'stderr');
      };
    }

    function appendOutput(text, type = 'stdout') {
      const output = document.getElementById('output');
      const div = document.createElement('div');
      div.className = type;
      div.textContent = text;
      output.appendChild(div);
      output.scrollTop = output.scrollHeight;
    }

    function setStatus(text) {
      document.getElementById('status').textContent = text;
    }

    document.getElementById('input').addEventListener('keydown', async (e) => {
      if (e.key === 'Enter') {
        const cmd = e.target.value.trim();
        if (!cmd) return;
        history.push(cmd);
        historyIndex = history.length;
        e.target.value = '';
        appendOutput('$ ' + cmd, 'system');
        setStatus('Executing...');
        try {
          const result = await app.callServerTool({
            name: 'exec_command',
            arguments: { sprite: spriteName, command: cmd }
          });
          if (result.output) appendOutput(result.output, 'stdout');
          if (result.error) appendOutput(result.error, 'stderr');
          setStatus('Ready');
        } catch (err) {
          appendOutput('Error: ' + err.message, 'stderr');
          setStatus('Error');
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (historyIndex > 0) { historyIndex--; e.target.value = history[historyIndex]; }
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (historyIndex < history.length - 1) { historyIndex++; e.target.value = history[historyIndex]; }
        else { historyIndex = history.length; e.target.value = ''; }
      }
    });

    init();
  </script>
</body>
</html>
`;

// Helper function to execute sprite CLI commands
async function spriteExec(args: string[], timeout = 30000): Promise<{ stdout: string; stderr: string }> {
  const spriteBin = process.env.SPRITE_BIN || "/home/sprite/.local/bin/sprite";
  const cmd = `${spriteBin} ${args.join(" ")}`;

  try {
    const { stdout, stderr } = await execAsync(cmd, { timeout, env: { ...process.env } });
    return { stdout: stdout.trim(), stderr: stderr.trim() };
  } catch (error: any) {
    return { stdout: error.stdout?.trim() || "", stderr: error.stderr?.trim() || error.message };
  }
}

function parseSprites(output: string): Array<{ name: string; org: string; status: string }> {
  const sprites: Array<{ name: string; org: string; status: string }> = [];
  const lines = output.split("\n").filter((l) => l.trim());
  for (const line of lines) {
    if (line.includes("NAME") || line.startsWith("-")) continue;
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 1) {
      sprites.push({ name: parts[0], status: parts[1] || "unknown", org: parts[2] || "default" });
    }
  }
  return sprites;
}

function parseCheckpoints(output: string): Array<{ id: string; created: string; comment: string }> {
  const checkpoints: Array<{ id: string; created: string; comment: string }> = [];
  const lines = output.split("\n").filter((l) => l.trim());
  for (const line of lines) {
    if (line.includes("ID") || line.startsWith("-")) continue;
    const parts = line.trim().split(/\s+/);
    if (parts.length >= 1) {
      checkpoints.push({ id: parts[0], created: parts[1] || "", comment: parts.slice(2).join(" ") || "" });
    }
  }
  return checkpoints;
}

// Create MCP server instance
function createServer(): Server {
  const server = new Server(
    { name: "sprite-mcp-server", version: "1.0.0" },
    { capabilities: { tools: {}, resources: {} } }
  );

  // Register tools
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: "list_sprites",
        description: "List all available Sprite VMs. Returns an interactive dashboard.",
        inputSchema: { type: "object", properties: { org: { type: "string", description: "Organization (optional)" } } },
        _meta: { ui: { resourceUri: "ui://sprite/dashboard" } },
      },
      {
        name: "exec_command",
        description: "Execute a command on a remote Sprite VM",
        inputSchema: {
          type: "object",
          properties: {
            sprite: { type: "string", description: "Sprite name" },
            command: { type: "string", description: "Command to execute" },
            org: { type: "string", description: "Organization (optional)" },
            timeout: { type: "number", description: "Timeout in ms (default: 30000)" },
          },
          required: ["sprite", "command"],
        },
        _meta: { ui: { resourceUri: "ui://sprite/terminal" } },
      },
      {
        name: "create_checkpoint",
        description: "Create a filesystem checkpoint of a Sprite VM",
        inputSchema: {
          type: "object",
          properties: {
            sprite: { type: "string", description: "Sprite name" },
            comment: { type: "string", description: "Checkpoint comment (optional)" },
            org: { type: "string", description: "Organization (optional)" },
          },
          required: ["sprite"],
        },
      },
      {
        name: "list_checkpoints",
        description: "List checkpoints for a Sprite VM",
        inputSchema: {
          type: "object",
          properties: {
            sprite: { type: "string", description: "Sprite name" },
            org: { type: "string", description: "Organization (optional)" },
          },
          required: ["sprite"],
        },
      },
      {
        name: "restore_checkpoint",
        description: "Restore a Sprite VM to a checkpoint",
        inputSchema: {
          type: "object",
          properties: {
            sprite: { type: "string", description: "Sprite name" },
            checkpoint_id: { type: "string", description: "Checkpoint ID" },
            org: { type: "string", description: "Organization (optional)" },
          },
          required: ["sprite", "checkpoint_id"],
        },
      },
      {
        name: "get_sprite_url",
        description: "Get public URL for a Sprite VM",
        inputSchema: {
          type: "object",
          properties: {
            sprite: { type: "string", description: "Sprite name" },
            org: { type: "string", description: "Organization (optional)" },
          },
          required: ["sprite"],
        },
      },
    ],
  }));

  // Handle tool calls
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      switch (name) {
        case "list_sprites": {
          const orgArgs = args?.org ? ["-o", args.org as string] : [];
          const { stdout, stderr } = await spriteExec(["list", ...orgArgs]);
          if (stderr && !stdout) return { content: [{ type: "text", text: `Error: ${stderr}` }] };
          const sprites = parseSprites(stdout);
          return { content: [{ type: "text", text: JSON.stringify({ sprites, raw: stdout }) }] };
        }

        case "exec_command": {
          const sprite = args?.sprite as string;
          const command = args?.command as string;
          const timeout = (args?.timeout as number) || 30000;
          const orgArgs = args?.org ? ["-o", args.org as string] : [];
          const { stdout, stderr } = await spriteExec(["exec", "-s", sprite, ...orgArgs, command], timeout);
          return { content: [{ type: "text", text: JSON.stringify({ sprite, command, output: stdout, error: stderr || undefined }) }] };
        }

        case "create_checkpoint": {
          const sprite = args?.sprite as string;
          const comment = args?.comment as string;
          const orgArgs = args?.org ? ["-o", args.org as string] : [];
          const commentArgs = comment ? ["--comment", comment] : [];
          const { stdout, stderr } = await spriteExec(["checkpoint", "create", "-s", sprite, ...orgArgs, ...commentArgs]);
          return { content: [{ type: "text", text: JSON.stringify({ success: !stderr, output: stdout, error: stderr || undefined }) }] };
        }

        case "list_checkpoints": {
          const sprite = args?.sprite as string;
          const orgArgs = args?.org ? ["-o", args.org as string] : [];
          const { stdout, stderr } = await spriteExec(["checkpoint", "list", "-s", sprite, ...orgArgs]);
          const checkpoints = parseCheckpoints(stdout);
          return { content: [{ type: "text", text: JSON.stringify({ checkpoints, raw: stdout }) }] };
        }

        case "restore_checkpoint": {
          const sprite = args?.sprite as string;
          const checkpointId = args?.checkpoint_id as string;
          const orgArgs = args?.org ? ["-o", args.org as string] : [];
          const { stdout, stderr } = await spriteExec(["restore", checkpointId, "-s", sprite, ...orgArgs]);
          return { content: [{ type: "text", text: JSON.stringify({ success: !stderr, output: stdout, error: stderr || undefined }) }] };
        }

        case "get_sprite_url": {
          const sprite = args?.sprite as string;
          const orgArgs = args?.org ? ["-o", args.org as string] : [];
          const { stdout, stderr } = await spriteExec(["url", "-s", sprite, ...orgArgs]);
          return { content: [{ type: "text", text: JSON.stringify({ sprite, url: stdout, error: stderr || undefined }) }] };
        }

        default:
          return { content: [{ type: "text", text: `Unknown tool: ${name}` }], isError: true };
      }
    } catch (error: any) {
      return { content: [{ type: "text", text: `Error: ${error.message}` }], isError: true };
    }
  });

  // Register UI resources
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [
      { uri: "ui://sprite/dashboard", name: "Sprite Dashboard", description: "Interactive sprite management dashboard", mimeType: "text/html" },
      { uri: "ui://sprite/terminal", name: "Sprite Terminal", description: "Interactive terminal for sprite commands", mimeType: "text/html" },
    ],
  }));

  // Serve UI resources
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;
    switch (uri) {
      case "ui://sprite/dashboard":
        return { contents: [{ uri, mimeType: "text/html", text: DASHBOARD_UI }] };
      case "ui://sprite/terminal":
        return { contents: [{ uri, mimeType: "text/html", text: TERMINAL_UI }] };
      default:
        throw new Error(`Unknown resource: ${uri}`);
    }
  });

  return server;
}

// SSE endpoint for MCP
app.get("/sse", async (req: Request, res: Response) => {
  console.log("New SSE connection");

  const server = createServer();
  const transport = new SSEServerTransport("/message", res);

  const sessionId = Math.random().toString(36).substring(7);
  transports.set(sessionId, transport);

  res.on("close", () => {
    console.log("SSE connection closed:", sessionId);
    transports.delete(sessionId);
  });

  await server.connect(transport);
});

// Message endpoint for SSE
app.post("/message", async (req: Request, res: Response) => {
  const sessionId = req.query.sessionId as string;
  const transport = transports.get(sessionId);

  if (!transport) {
    return res.status(404).json({ error: "Session not found" });
  }

  try {
    await transport.handlePostMessage(req, res);
  } catch (error: any) {
    console.error("Message handling error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Health check
app.get("/health", (req: Request, res: Response) => {
  res.json({ status: "ok", server: "sprite-mcp", version: "1.0.0" });
});

// MCP endpoint info
app.get("/mcp", (req: Request, res: Response) => {
  res.json({
    name: "sprite-mcp-server",
    version: "1.0.0",
    description: "Sprite VM management with interactive UI (MCP Apps)",
    endpoints: {
      sse: "/sse",
      message: "/message",
    },
  });
});

// Start server
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Sprite MCP Server (HTTP/SSE) running on http://0.0.0.0:${PORT}`);
  console.log(`  SSE endpoint: http://localhost:${PORT}/sse`);
  console.log(`  Health check: http://localhost:${PORT}/health`);
});
