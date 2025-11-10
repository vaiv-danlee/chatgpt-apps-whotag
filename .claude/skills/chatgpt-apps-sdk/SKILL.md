---
name: chatgpt-apps-sdk
description: Build ChatGPT apps using the Apps SDK framework with MCP (Model Context Protocol). Use when creating MCP servers, defining tools, building React UI components, implementing OAuth 2.1 authentication, or deploying ChatGPT apps. Covers server setup, component development, authentication, state management, and deployment workflows.
---

# ChatGPT Apps SDK

Build apps for ChatGPT using the Apps SDK framework based on Model Context Protocol (MCP).

## Quick Start

### When to Use This Skill

- Creating MCP servers with tool definitions
- Building React components for ChatGPT UI
- Implementing OAuth 2.1 authentication
- Setting up widget state management
- Deploying apps to production

### Basic Workflow

1. **Plan**: Define use cases and tools
2. **Build MCP Server**: Set up server with tool definitions
3. **Build UI Component**: Create React component with `window.openai` API
4. **Add Authentication**: Implement OAuth 2.1 (if needed)
5. **Deploy**: Host on HTTPS endpoint and connect to ChatGPT

## MCP Server Setup

### Choose SDK

**TypeScript (Recommended for ChatGPT apps with UI)**
```bash
npm install @modelcontextprotocol/sdk
```

**Python (For backend-only tools)**
```bash
pip install mcp --break-system-packages
```

> **⚠️ Python SDK Limitation for ChatGPT Apps**
>
> **Current Status (October 2025):**
> - ✅ Tool Definitions support `_meta` fields
> - ✅ Tool Call payloads support `_meta` fields
> - ❌ **Resource Definitions DO NOT support `_meta` fields**
>
> **Impact:**
> - Cannot add ChatGPT-specific widget metadata to Resources
> - UI components cannot be properly registered for ChatGPT
> - Widget descriptions, CSP policies, and other metadata cannot be passed
>
> **Recommendation:**
> - **Use Node.js/TypeScript SDK for ChatGPT apps** with UI components
> - Python SDK is suitable for backend tools without UI
> - Wait for Resource `_meta` support in Python SDK (tracked in GitHub Issue #1465)
>
> **Why Node.js?**
> 1. Full Resource `_meta` support for widget metadata
> 2. Complete ChatGPT compatibility
> 3. Production-ready for UI components
> 4. All official MCP examples use TypeScript/Node.js

### Create Basic Server (TypeScript)

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

const server = new McpServer({
  name: "my-app",
  version: "1.0.0"
});
```

### Complete Server Setup Example

```typescript
import express from "express";
import cors from "cors";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { readFileSync } from "node:fs";

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Load component
const COMPONENT_JS = readFileSync("web/dist/component.js", "utf8");

// Create MCP server
const server = new McpServer({
  name: "my-app",
  version: "1.0.0"
});

// Session management
const transports: Record<string, SSEServerTransport> = {};

// Register UI resource
server.registerResource(
  "widget",
  "ui://widget/component.html",
  {},
  async () => ({
    contents: [{
      uri: "ui://widget/component.html",
      mimeType: "text/html+skybridge",
      text: `
<div id="root"></div>
<script type="module">${COMPONENT_JS}</script>
      `.trim(),
      _meta: {
        "openai/widgetDescription": "Interactive dashboard",
        "openai/widgetPrefersBorder": true,
        "openai/widgetDomain": "https://chatgpt.com",
        "openai/widgetCSP": {
          connect_domains: ["https://api.example.com"],
          resource_domains: ["https://*.oaistatic.com"]
        }
      }
    }]
  })
);

// Register tool
server.registerTool(
  "get_data",
  {
    title: "Get Data",
    description: "Fetch data from API",
    inputSchema: {
      type: "object",
      properties: {
        userId: { type: "string" }
      },
      required: ["userId"]
    },
    _meta: {
      "openai/outputTemplate": "ui://widget/component.html",
      "openai/widgetAccessible": true,
      "openai/toolInvocation/invoking": "Fetching data…",
      "openai/toolInvocation/invoked": "Data loaded"
    }
  },
  async ({ userId }) => {
    const data = await fetchData(userId);
    return {
      structuredContent: { items: data.items.slice(0, 10) },
      content: [{ type: "text", text: `Loaded ${data.items.length} items` }],
      _meta: { allItems: data.items }
    };
  }
);

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});

// SSE endpoint - NO manual headers!
app.get("/mcp/sse", async (req, res) => {
  const transport = new SSEServerTransport("/mcp/message", res);
  const sessionId = (transport as any)._sessionId;
  
  if (sessionId) {
    transports[sessionId] = transport;
    console.error(`New SSE connection: ${sessionId}`);
  }
  
  res.on("close", () => {
    if (sessionId) {
      delete transports[sessionId];
      console.error(`SSE connection closed: ${sessionId}`);
    }
  });
  
  await server.connect(transport);
});

// Message endpoint
app.post("/mcp/message", async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const transport = transports[sessionId];
  
  if (!transport) {
    console.error(`No transport found for session: ${sessionId}`);
    res.status(400).send("No transport found");
    return;
  }
  
  await transport.handlePostMessage(req, res, req.body);
});

app.listen(PORT, () => {
  console.error(`Server running on http://localhost:${PORT}`);
  console.error(`Health: http://localhost:${PORT}/health`);
  console.error(`MCP: http://localhost:${PORT}/mcp`);
});
```

### Register UI Resource

```typescript
import { readFileSync } from "node:fs";

const COMPONENT_JS = readFileSync("web/dist/component.js", "utf8");
const COMPONENT_CSS = readFileSync("web/dist/component.css", "utf8");

server.registerResource(
  "widget",
  "ui://widget/component.html",
  {},
  async () => ({
    contents: [{
      uri: "ui://widget/component.html",
      mimeType: "text/html+skybridge",
      text: `
<div id="root"></div>
${COMPONENT_CSS ? `<style>${COMPONENT_CSS}</style>` : ""}
<script type="module">${COMPONENT_JS}</script>
      `.trim(),
      _meta: {
        "openai/widgetPrefersBorder": true,
        "openai/widgetDomain": "https://chatgpt.com",
        "openai/widgetCSP": {
          connect_domains: ["https://api.example.com"],
          resource_domains: ["https://*.oaistatic.com"]
        }
      }
    }]
  })
);
```

### Register Tool

```typescript
server.registerTool(
  "get_data",
  {
    title: "Get Data",
    description: "Fetch user data from the API",
    inputSchema: {
      type: "object",
      properties: {
        userId: { type: "string" }
      },
      required: ["userId"]
    },
    _meta: {
      "openai/outputTemplate": "ui://widget/component.html",
      "openai/widgetAccessible": true,
      "openai/toolInvocation/invoking": "Fetching data…",
      "openai/toolInvocation/invoked": "Data loaded"
    }
  },
  async ({ userId }) => {
    const data = await fetchData(userId);
    
    return {
      // Visible to model and component
      structuredContent: {
        items: data.items.slice(0, 10)
      },
      // Optional text for model
      content: [{
        type: "text",
        text: `Loaded ${data.items.length} items`
      }],
      // Only visible to component
      _meta: {
        allItems: data.items,
        timestamp: new Date().toISOString()
      }
    };
  }
);
```

### Tool Result Structure

| Field | Model Sees | Component Sees | Purpose |
|-------|-----------|----------------|---------|
| `structuredContent` | ✅ | ✅ | Primary data (keep concise) |
| `content` | ✅ | ✅ | Optional text/markdown |
| `_meta` | ❌ | ✅ | Component-only metadata |

## React Component Development

### Project Structure

```
app/
  server/            # MCP server
  web/               # Component source
    src/
      component.tsx
    package.json
    tsconfig.json
    dist/
      component.js   # Build output
```

### Install Dependencies

```bash
cd web
npm install react@^18 react-dom@^18 react-router-dom
npm install -D typescript esbuild
```

### Use window.openai API

```typescript
// Read tool data
const toolInput = window.openai.toolInput;
const toolOutput = window.openai.toolOutput;
const toolMeta = window.openai.toolResponseMetadata;

// Call MCP tool
await window.openai.callTool("refresh_data", { filter: "recent" });

// Send conversational follow-up
await window.openai.sendFollowUpMessage({
  prompt: "Show me the top 5 items"
});

// Request layout change
await window.openai.requestDisplayMode({ mode: "fullscreen" });

// Persist widget state (shown to model)
await window.openai.setWidgetState({ favorites: ["id1", "id2"] });

// Open external link
window.openai.openExternal({ href: "https://example.com" });
```

### React Hooks

```typescript
import { useSyncExternalStore, useState, useEffect, useCallback } from "react";

// Subscribe to window.openai globals
export function useOpenAiGlobal<K extends keyof OpenAiGlobals>(
  key: K
): OpenAiGlobals[K] {
  return useSyncExternalStore(
    (onChange) => {
      const handleSetGlobal = (event: SetGlobalsEvent) => {
        if (event.detail.globals[key] !== undefined) {
          onChange();
        }
      };
      window.addEventListener("openai:set_globals", handleSetGlobal);
      return () => {
        window.removeEventListener("openai:set_globals", handleSetGlobal);
      };
    },
    () => window.openai[key]
  );
}

// Widget state with persistence
export function useWidgetState<T>(defaultState: T) {
  const widgetStateFromWindow = useOpenAiGlobal("widgetState") as T;
  const [widgetState, _setWidgetState] = useState<T>(() => {
    return widgetStateFromWindow ?? (
      typeof defaultState === "function" ? defaultState() : defaultState
    );
  });

  useEffect(() => {
    _setWidgetState(widgetStateFromWindow);
  }, [widgetStateFromWindow]);

  const setWidgetState = useCallback((state: T) => {
    _setWidgetState((prev) => {
      const newState = typeof state === "function" ? state(prev) : state;
      window.openai.setWidgetState(newState);
      return newState;
    });
  }, []);

  return [widgetState, setWidgetState] as const;
}
```

### Component Template

```typescript
import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route, useNavigate } from "react-router-dom";

function App() {
  const toolOutput = useOpenAiGlobal("toolOutput");
  const theme = useOpenAiGlobal("theme");
  const [widgetState, setWidgetState] = useWidgetState({ favorites: [] });

  const handleRefresh = async () => {
    await window.openai.callTool("refresh_data", {});
  };

  return (
    <div className={theme}>
      <h1>My App</h1>
      {toolOutput?.items.map(item => (
        <div key={item.id}>{item.name}</div>
      ))}
      <button onClick={handleRefresh}>Refresh</button>
    </div>
  );
}

// Mount with router
const root = createRoot(document.getElementById("root")!);
root.render(
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<App />} />
    </Routes>
  </BrowserRouter>
);
```

### Component Best Practices

#### 1. Null-Safe Widget State Access

**Problem:** `widgetState` can be `null` during initialization, causing crashes.

```typescript
// ❌ WRONG - Crashes if widgetState is null
function App() {
  const [widgetState, setWidgetState] = useWidgetState<{ favorites: string[] }>({
    favorites: [],
  });

  return (
    <div>
      {widgetState.favorites.map(item => (  // TypeError: Cannot read properties of null
        <div key={item}>{item}</div>
      ))}
    </div>
  );
}
```

```typescript
// ✅ CORRECT - Null-safe with optional chaining and fallback
function App() {
  const [widgetState, setWidgetState] = useWidgetState<{ favorites: string[] }>({
    favorites: [],
  });

  // Create safe accessor
  const safeFavorites = widgetState?.favorites || [];

  const handleAddFavorite = async (item: string) => {
    if (!safeFavorites.includes(item)) {
      setWidgetState({
        favorites: [...safeFavorites, item],
      });
    }
  };

  return (
    <div>
      {safeFavorites.map(item => (
        <div key={item}>{item}</div>
      ))}
    </div>
  );
}
```

#### 2. Proper Height Constraints

**Problem:** Using `100vh` in ChatGPT widgets causes infinite expansion.

```typescript
// ❌ WRONG - Causes infinite vertical expansion
const styles = {
  container: {
    minHeight: "100vh",  // Viewport height in iframe causes loop
    padding: "20px",
  }
};
```

```typescript
// ✅ CORRECT - Constrained height with scroll
const styles = {
  container: {
    fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    padding: "20px",
    maxWidth: "1200px",
    margin: "0 auto",
    backgroundColor: "#f5f5f5",
    minHeight: "auto",        // Use auto instead of 100vh
    height: "100%",           // Fit parent container
    maxHeight: "800px",       // Limit maximum height
    overflowY: "auto" as const, // Scroll when content overflows
  } as React.CSSProperties,
};
```

**Why it matters:**
- ChatGPT widgets run in iframes
- `100vh` in iframe causes parent container to expand infinitely
- Use `maxHeight` + `overflowY: "auto"` for proper containment

### Build Configuration

```json
{
  "scripts": {
    "build": "esbuild src/component.tsx --bundle --format=esm --outfile=dist/component.js"
  }
}
```

```bash
npm run build
```

## Authentication

### OAuth 2.1 Setup (Python)

```python
from mcp.server.fastmcp import FastMCP
from mcp.server.auth.settings import AuthSettings
from mcp.server.auth.provider import TokenVerifier, AccessToken

class MyVerifier(TokenVerifier):
    async def verify_token(self, token: str) -> AccessToken | None:
        payload = validate_jwt(token, jwks_url)
        if "user" not in payload.get("permissions", []):
            return None
        return AccessToken(
            token=token,
            client_id=payload["azp"],
            subject=payload["sub"],
            scopes=payload.get("permissions", []),
            claims=payload
        )

mcp = FastMCP(
    name="my-app",
    stateless_http=True,
    token_verifier=MyVerifier(),
    auth=AuthSettings(
        issuer_url="https://tenant.auth0.com",
        resource_server_url="https://example.com/mcp",
        required_scopes=["user"]
    )
)
```

### Per-Tool Auth (TypeScript)

```typescript
// Public tool (no auth required)
server.registerTool("search", {
  title: "Public Search",
  securitySchemes: [
    { type: "noauth" },
    { type: "oauth2", scopes: ["search.read"] }
  ],
  // ...
});

// Auth required
server.registerTool("create_doc", {
  title: "Create Document",
  securitySchemes: [
    { type: "oauth2", scopes: ["docs.write"] }
  ],
  // ...
});
```

## Deployment

### SSE Transport Setup (Critical)

**Common Pitfall: Header Conflict Error**

```typescript
// ❌ WRONG - Causes "Cannot write headers after they are sent" error
app.get("/mcp/sse", async (req, res) => {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive",
  });
  
  // SSEServerTransport internally calls writeHead() again → CONFLICT!
  const transport = new SSEServerTransport("/mcp/message", res);
  await server.connect(transport);
});
```

```typescript
// ✅ CORRECT - Let SSEServerTransport handle headers
app.get("/mcp/sse", async (req, res) => {
  // No manual header setting
  const transport = new SSEServerTransport("/mcp/message", res);
  await server.connect(transport);
});
```

**Why?** SSEServerTransport's `start()` method automatically sets headers:
```javascript
// Inside SSEServerTransport.start()
this.res.writeHead(200, {
  'Content-Type': 'text/event-stream',
  'Cache-Control': 'no-cache, no-transform',
  Connection: 'keep-alive'
});
```

### Session Management (Essential)

**Problem:** Without session management, messages get mixed up between clients.

**MCP Standard Pattern:**
```typescript
import express from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";

// Session store for transport instances
const transports: Record<string, SSEServerTransport> = {};

// SSE endpoint
app.get("/mcp/sse", async (req, res) => {
  const transport = new SSEServerTransport("/mcp/message", res);
  
  // Extract sessionId from transport
  const sessionId = (transport as any)._sessionId;
  
  if (sessionId) {
    transports[sessionId] = transport;  // Store transport by sessionId
  }
  
  // Clean up on disconnect
  res.on("close", () => {
    if (sessionId) {
      delete transports[sessionId];
    }
  });
  
  await server.connect(transport);
});

// Message endpoint
app.post("/mcp/message", async (req, res) => {
  // Get sessionId from query parameter
  const sessionId = req.query.sessionId as string;
  const transport = transports[sessionId];
  
  if (!transport) {
    res.status(400).send("No transport found for session");
    return;
  }
  
  // Route message to correct transport
  await transport.handlePostMessage(req, res, req.body);
});
```

**Why Session Management Matters:**

```
Without session management:
Client A → /mcp/sse (sessionId: abc)
Client B → /mcp/sse (sessionId: xyz)
Client A → POST /mcp/message
Server: "Which transport??" ❌

With session management:
Client A → /mcp/sse → transports["abc"] = transport_A
Client B → /mcp/sse → transports["xyz"] = transport_B
Client A → POST /mcp/message?sessionId=abc
Server: transports["abc"].handlePostMessage() ✅
```

### Local Testing with ngrok

```bash
# Start MCP server
npm start  # or python server.py

# In another terminal
ngrok http 3000
# Use https://<subdomain>.ngrok.app/mcp in ChatGPT dev mode
```

### Production Deployment

**Recommended Platforms:**
- Fly.io (fast, managed TLS)
- Render (easy setup)
- Railway (simple deploy)
- Google Cloud Run (serverless)

**Requirements:**
- HTTPS endpoint
- `/mcp` path accessible
- Low cold-start latency
- Support for streaming HTTP

### Connect to ChatGPT

1. Go to ChatGPT Settings → Developer Mode
2. Add new connector with your HTTPS endpoint
3. Test with MCP Inspector first
4. Refresh actions in ChatGPT after changes

## Advanced Features

### Component Description

```typescript
server.registerResource("html", "ui://widget/widget.html", {}, async () => ({
  contents: [{
    uri: "ui://widget/widget.html",
    mimeType: "text/html",
    text: componentHtml,
    _meta: {
      "openai/widgetDescription": "Interactive UI showing zoo animals with photos and facts"
    }
  }]
}));
```

### Localization

```typescript
// Server receives locale in initialize
{
  "_meta": {
    "openai/locale": "en-GB"  // or "fr-FR", "es-419", etc.
  }
}

// Server responds with resolved locale
"_meta": {
  "openai/locale": "en"
}
```

### Read-Only Tool Annotation

```typescript
server.registerTool("list_items", {
  title: "List Items",
  annotations: {
    readOnlyHint: true  // Helps model planning
  },
  // ...
});
```

## Metadata Reference

### Tool Descriptor `_meta`

| Key | Type | Purpose |
|-----|------|---------|
| `openai/outputTemplate` | string (URI) | Component template URI |
| `openai/widgetAccessible` | boolean | Allow component→tool calls |
| `openai/toolInvocation/invoking` | string | Status text during execution |
| `openai/toolInvocation/invoked` | string | Status text after completion |

### Resource `_meta`

| Key | Type | Purpose |
|-----|------|---------|
| `openai/widgetDescription` | string | Component description for model |
| `openai/widgetPrefersBorder` | boolean | Render in bordered card |
| `openai/widgetCSP` | object | CSP domains config |
| `openai/widgetDomain` | string | Custom subdomain |

### Client-Provided `_meta`

| Key | When | Purpose |
|-----|------|---------|
| `openai/locale` | Initialize + tool calls | User's locale (BCP 47) |
| `openai/userAgent` | Tool calls | Client identifier |
| `openai/userLocation` | Tool calls | Coarse location hint |

## Discovery Optimization

Write action-oriented tool descriptions:
- ✅ "Use this when user wants to view their kanban board"
- ❌ "A tool for kanban boards"

Keep tool metadata rich:
- Clear parameter descriptions
- Examples in documentation
- Consistent naming patterns

## Common Patterns

### Data Refresh Flow
1. User asks question
2. Model calls tool
3. Tool returns data + component
4. Component renders with actions
5. User clicks action
6. Component calls tool via `window.openai.callTool`
7. New data updates component

### Fullscreen Flow
1. Component starts inline
2. User needs more space
3. Component calls `requestDisplayMode({ mode: "fullscreen" })`
4. Host grants fullscreen
5. Component renders in expanded view

### Follow-up Conversation
1. User interacts with component
2. Component triggers `sendFollowUpMessage({ prompt: "..." })`
3. ChatGPT starts new turn with prompt
4. Model processes and may call more tools

## Testing Checklist

- [ ] Tool metadata is clear and action-oriented
- [ ] Component renders in light and dark themes
- [ ] Component handles missing/null data gracefully
- [ ] Authentication flow works end-to-end
- [ ] CSP domains are correctly configured
- [ ] Tool calls from component work (if enabled)
- [ ] Widget state persists across sessions
- [ ] External links open correctly
- [ ] Component works on mobile (test with narrow viewport)
- [ ] Error states display helpful messages

## Troubleshooting Guide

Common issues and their solutions are documented in detail in the separate troubleshooting guide.

**Quick Reference:**

| Problem | Quick Fix |
|---------|-----------|
| UI not showing | Add `mimeType: "text/html+skybridge"` and `_meta` to resource |
| Header conflict | Remove `res.writeHead()` calls |
| Message routing | Implement session store with `transports` object |
| Component crash | Use `widgetState?.field \|\| defaultValue` |
| Infinite height | Set `maxHeight: "800px"` and `overflowY: "auto"` |
| Build missing | Run `cd web && npm run build` |
| GPT can't analyze data | Move data from `content` to `structuredContent` |

**For detailed troubleshooting:**
- See `references/troubleshooting.md` for comprehensive issue diagnosis and solutions

## Additional Resources

### Pre-Deployment Checklist

**Server Code:**
- [ ] TypeScript compiles without errors
- [ ] All `_meta` fields properly set in resources
- [ ] All `_meta` fields properly set in tools
- [ ] Session management implemented
- [ ] No manual SSE header writes
- [ ] CORS enabled
- [ ] `express.json()` middleware added
- [ ] Tool returns use `structuredContent` for data GPT should analyze
- [ ] Tool returns use `content` only for user-facing summaries
- [ ] Tool returns use `_meta` for component-only data

**React Component:**
- [ ] Component builds successfully (`dist/component.js` exists)
- [ ] Null-safe access for `widgetState`
- [ ] Null-safe access for `toolOutput`
- [ ] Proper height constraints (`maxHeight` set)
- [ ] No `100vh` in styles
- [ ] Theme support (light/dark)

**Environment:**
- [ ] `.env` file created with API keys
- [ ] API keys loaded and verified
- [ ] Port configuration correct

**Endpoints:**
- [ ] `/health` returns 200
- [ ] `/mcp/sse` accepts GET
- [ ] `/mcp/message` accepts POST
- [ ] Endpoints accessible via ngrok/HTTPS

**Testing:**
- [ ] Health check works: `curl http://localhost:3000/health`
- [ ] SSE connects properly
- [ ] Tool execution succeeds
- [ ] UI renders in ChatGPT
- [ ] Component interactions work
- [ ] State persists correctly

For detailed protocol specs and advanced patterns:
- See `references/mcp-protocol.md` for MCP specification details
- See `references/api-reference.md` for complete window.openai API
- See `references/authentication.md` for OAuth 2.1 implementation guide
- See `references/troubleshooting.md` for comprehensive troubleshooting guide
- See `scripts/` for helper scripts

For React component templates:
- See `assets/react-component-template/` for boilerplate code
