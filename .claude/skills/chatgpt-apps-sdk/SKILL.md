---
name: chatgpt-apps-sdk
description: Build ChatGPT apps using the Apps SDK framework with MCP (Model Context Protocol). Use when (1) creating MCP servers with tool definitions for ChatGPT, (2) building React UI components that render inside ChatGPT, (3) implementing OAuth 2.1 authentication, (4) connecting tools to UI widgets via outputTemplate, (5) troubleshooting ChatGPT app issues like UI not rendering or session management problems, (6) user asks about window.openai API, widgetState, or tool result structure.
---

# ChatGPT Apps SDK

Build apps for ChatGPT using the Apps SDK framework based on Model Context Protocol (MCP).

## Development Workflow

Building a ChatGPT app involves these steps:

1. **Create MCP Server** → Set up Express server with 4 required endpoints
2. **Register Resources** → Define UI widgets with `text/html+skybridge` MIME type
3. **Register Tools** → Connect tools to widgets via `outputTemplate`
4. **Build React Component** → Use `window.openai` API for state and actions
5. **Test Locally** → Use ngrok + MCP Inspector
6. **Deploy** → Host on HTTPS endpoint

## MCP Server Setup

### Dependencies

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.25.0",
    "express": "^4.18.0",
    "cors": "^2.8.5",
    "zod": "^3.25.0"
  }
}
```

> **Note:** MCP SDK 1.22+ uses `handler` property for tool callbacks (1.21 and earlier used `callback`).

### Required Endpoints (Critical)

ChatGPT requires **4 endpoints** for full compatibility:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/mcp` | GET | Discovery document (OpenAPI + x-mcp) |
| `/mcp` | POST | JSON-RPC handler |
| `/mcp/sse` | GET | SSE connection |
| `/mcp/message` | POST | SSE message routing |

### Minimal Server Template

```typescript
import express from "express";
import cors from "cors";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: ["https://chatgpt.com", "https://chat.openai.com"],
  credentials: true,
}));
app.use(express.json());

// MCP server instance
const server = new McpServer({ name: "my-app", version: "1.0.0" });

// Session management (essential)
const transports: Record<string, SSEServerTransport> = {};

// 1. GET /mcp - Discovery document
app.get("/mcp", (req, res) => {
  res.json({
    openapi: "3.1.0",
    info: { title: "My App MCP", version: "1.0.0" },
    servers: [{ url: getServerUrl(req) }],
    "x-mcp": {
      protocolVersion: "2025-11-25",
      capabilities: { tools: {}, resources: {} },
      transport: { type: "sse", url: "/mcp/sse" },
    },
  });
});

// 2. POST /mcp - JSON-RPC handler (see references/mcp-protocol.md)
app.post("/mcp", async (req, res) => { /* ... */ });

// 3. GET /mcp/sse - SSE connection
app.get("/mcp/sse", async (req, res) => {
  const transport = new SSEServerTransport("/mcp/message", res);
  const sessionId = (transport as any)._sessionId;
  if (sessionId) transports[sessionId] = transport;
  res.on("close", () => { if (sessionId) delete transports[sessionId]; });
  await server.connect(transport);
});

// 4. POST /mcp/message - SSE message routing
app.post("/mcp/message", async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const transport = transports[sessionId];
  if (!transport) return res.status(400).send("No transport");
  await transport.handlePostMessage(req, res, req.body);
});

app.listen(PORT);
```

**For complete server implementation:** See `references/mcp-protocol.md`

## Register UI Resource

```typescript
import { readFileSync } from "node:fs";

const COMPONENT_JS = readFileSync("web/dist/component.js", "utf8");

server.registerResource("widget", "ui://widget/component.html", {}, async () => ({
  contents: [{
    uri: "ui://widget/component.html",
    mimeType: "text/html+skybridge",  // Required for ChatGPT widgets
    text: `<div id="root"></div><script type="module">${COMPONENT_JS}</script>`,
    _meta: {
      "openai/widgetDescription": "Interactive dashboard",
      "openai/widgetPrefersBorder": true,
      "openai/widgetDomain": "https://chatgpt.com",
      "openai/widgetCSP": {
        connect_domains: ["https://api.example.com"],
        resource_domains: ["https://*.oaistatic.com"],
      },
    },
  }],
}));
```

## Register Tool

```typescript
server.registerTool(
  "get_data",
  {
    title: "Get Data",
    description: "Fetch user data from API",
    inputSchema: {
      type: "object",
      properties: { userId: { type: "string" } },
      required: ["userId"],
    },
    _meta: {
      "openai/outputTemplate": "ui://widget/component.html",
      "openai/widgetAccessible": true,
      "openai/toolInvocation/invoking": "Fetching data…",
      "openai/toolInvocation/invoked": "Data loaded",
    },
  },
  async ({ userId }) => {
    const data = await fetchData(userId);
    return {
      structuredContent: { items: data.items.slice(0, 10) },  // GPT analyzes this
      content: [{ type: "text", text: `Loaded ${data.items.length} items` }],  // User summary
      _meta: { allItems: data.items },  // Component-only data
    };
  }
);
```

### Tool Result Data Flow

| Field | Model Sees | Component Sees | Use For |
|-------|-----------|----------------|---------|
| `structuredContent` | ✅ | ✅ | Data for GPT to analyze |
| `content` | ✅ | ✅ | User-facing text summary |
| `_meta` | ❌ | ✅ | Component-only metadata |

> **Note:** `structuredContent` is standard MCP since protocol version 2025-06-18. For backwards compatibility with older MCP clients (< 2025-06-18), also include serialized JSON in `content[].text`. See `references/mcp-protocol.md` for version details.

## React Component Development

### Component Template

```typescript
import React from "react";
import { createRoot } from "react-dom/client";
import { useOpenAiGlobal, useWidgetState } from "./hooks";

function App() {
  const toolOutput = useOpenAiGlobal("toolOutput");
  const theme = useOpenAiGlobal("theme");
  const [widgetState, setWidgetState] = useWidgetState({ favorites: [] });

  // Null-safe access (widgetState can be null!)
  const safeFavorites = widgetState?.favorites || [];

  const handleRefresh = async () => {
    await window.openai.callTool("refresh_data", {});
  };

  if (!toolOutput) return <div>Loading...</div>;

  return (
    <div className={theme} style={{ maxHeight: "800px", overflowY: "auto" }}>
      {toolOutput.items.map(item => <div key={item.id}>{item.name}</div>)}
      <button onClick={handleRefresh}>Refresh</button>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
```

### Key window.openai Methods

```typescript
// Read tool data
const toolInput = window.openai.toolInput;
const toolOutput = window.openai.toolOutput;
const toolMeta = window.openai.toolResponseMetadata;

// Call MCP tool (requires openai/widgetAccessible: true)
await window.openai.callTool("tool_name", { arg: "value" });

// Send conversational follow-up
await window.openai.sendFollowUpMessage({ prompt: "Show top 5 items" });

// Request layout change
await window.openai.requestDisplayMode({ mode: "fullscreen" });

// Persist widget state (shared with model)
await window.openai.setWidgetState({ favorites: ["id1"] });

// Open external link
window.openai.openExternal({ href: "https://example.com" });
```

**For complete API reference:** See `references/api-reference.md`

### Critical Component Rules

1. **Null-safe access**: Always use `widgetState?.field || defaultValue`
2. **No `100vh`**: Use `maxHeight: "800px"` + `overflowY: "auto"` to prevent infinite expansion
3. **Build before run**: Execute `cd web && pnpm run build` before starting server

## Build Configuration

```json
{
  "scripts": {
    "build": "esbuild src/component.tsx --bundle --format=esm --outfile=dist/component.js"
  }
}
```

## Deployment

### Local Testing

```bash
# Terminal 1: Build and watch React
cd web && pnpm run build

# Terminal 2: Run server
cd server && pnpm run dev

# Terminal 3: Expose via ngrok
ngrok http 3000
```

### Connect to ChatGPT

1. ChatGPT Settings → Developer Mode
2. Add connector: `https://<subdomain>.ngrok.app/mcp`
3. Refresh actions after code changes

### Quick Diagnostic

```bash
# Test discovery (should return JSON immediately)
curl http://localhost:3000/mcp

# Test JSON-RPC
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
```

## Metadata Reference

### Tool `_meta` Keys

| Key | Type | Purpose |
|-----|------|---------|
| `openai/outputTemplate` | string | Widget URI to render |
| `openai/widgetAccessible` | boolean | Allow component→tool calls |
| `openai/toolInvocation/invoking` | string | Status during execution |
| `openai/toolInvocation/invoked` | string | Status after completion |

### Resource `_meta` Keys

| Key | Type | Purpose |
|-----|------|---------|
| `openai/widgetDescription` | string | Component description for model |
| `openai/widgetPrefersBorder` | boolean | Render in bordered card |
| `openai/widgetCSP` | object | CSP domains config |
| `openai/widgetDomain` | string | Custom subdomain |

## Common Issues Quick Reference

| Problem | Quick Fix |
|---------|-----------|
| UI not showing (MCP Inspector works) | Add `GET /mcp` + `POST /mcp` handlers |
| UI not rendering | Add `mimeType: "text/html+skybridge"` and `_meta` |
| Header conflict error | Remove manual `res.writeHead()` calls |
| Messages mixed up | Implement session store with `transports` object |
| Component crash | Use `widgetState?.field \|\| defaultValue` |
| Infinite height | Set `maxHeight` + `overflowY: "auto"` |
| GPT can't analyze data | Move data from `content` to `structuredContent` |

**For detailed troubleshooting:** See `references/troubleshooting.md`

## Additional Resources

| Topic | Reference File |
|-------|---------------|
| MCP Protocol & JSON-RPC | `references/mcp-protocol.md` |
| window.openai API | `references/api-reference.md` |
| OAuth 2.1 Authentication | `references/authentication.md` |
| Troubleshooting Guide | `references/troubleshooting.md` |
| React Component Template | `assets/react-component-template/` |

## Pre-Deployment Checklist

**Server:**
- [ ] `GET /mcp` returns discovery document with `x-mcp` (protocolVersion: 2025-11-25)
- [ ] `POST /mcp` handles initialize, tools/list, resources/list, resources/read, tools/call
- [ ] Session management implemented
- [ ] CORS enabled for ChatGPT domains
- [ ] `structuredContent` used for data GPT should analyze
- [ ] `content` includes text fallback for older MCP clients

**Component:**
- [ ] `dist/component.js` exists
- [ ] Null-safe `widgetState` and `toolOutput` access
- [ ] `maxHeight` set (no `100vh`)

**Testing:**
- [ ] `curl http://localhost:3000/mcp` returns JSON immediately
- [ ] Tool execution succeeds
- [ ] UI renders in ChatGPT
