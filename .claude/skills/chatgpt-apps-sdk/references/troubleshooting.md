# Troubleshooting Guide

## Table of Contents

- [UI Not Rendering in ChatGPT](#ui-not-rendering-in-chatgpt)
- [SSE Transport Errors](#sse-transport-errors)
- [Message Routing Failures](#message-routing-failures)
- [React Component Crashes](#react-component-crashes)
- [UI Infinite Vertical Expansion](#ui-infinite-vertical-expansion)
- [Component Build Failures](#component-build-failures)
- [GPT Cannot Analyze Tool Data](#gpt-cannot-analyze-tool-data)
- [Common Express Setup Issues](#common-express-setup-issues)
- [Debugging Checklist](#debugging-checklist)
- [Production Deployment Issues](#production-deployment-issues)
- [Quick Reference Tables](#quick-reference-tables)

---

## UI Not Rendering in ChatGPT

**Symptoms:**
- Tool executes but no UI appears
- Only text response shown
- MCP Inspector works but ChatGPT doesn't render widget

**Causes & Solutions:**

### 1. Missing MCP Discovery Document and JSON-RPC Handler (CRITICAL)

**This is the most common cause of UI not rendering!**

ChatGPT requires specific endpoint patterns that differ from standard MCP:

```typescript
// ❌ WRONG - Only SSE endpoint (works with MCP Inspector but NOT ChatGPT)
app.get("/mcp", async (req, res) => {
  const transport = new SSEServerTransport("/mcp/message", res);
  await server.connect(transport);
});

// ✅ CORRECT - Full ChatGPT-compatible endpoint structure
// 1. GET /mcp - Returns OpenAPI discovery document
app.get("/mcp", (req, res) => {
  const serverUrl = getServerUrl(req);
  res.json({
    openapi: "3.1.0",
    info: {
      title: "My App MCP",
      version: "1.0.0",
      description: "MCP server description",
    },
    servers: [{ url: serverUrl }],
    "x-mcp": {
      protocolVersion: "2025-03-26",
      capabilities: {
        tools: {},
        resources: {},
      },
      transport: {
        type: "sse",
        url: "/mcp/sse",
      },
    },
  });
});

// 2. POST /mcp - JSON-RPC request handler
app.post("/mcp", async (req, res) => {
  const { method, id, params } = req.body;

  switch (method) {
    case "initialize":
      res.json({
        jsonrpc: "2.0",
        id,
        result: {
          protocolVersion: params?.protocolVersion || "2025-03-26",
          serverInfo: { name: "my-app", version: "1.0.0" },
          capabilities: { tools: {}, resources: {} },
        },
      });
      break;

    case "tools/list":
      res.json({
        jsonrpc: "2.0",
        id,
        result: {
          tools: [
            {
              name: "my_tool",
              description: "Tool description",
              inputSchema: { /* ... */ },
              _meta: {
                "openai/outputTemplate": "ui://widget/component.html",
                "openai/widgetAccessible": true,
              },
            },
          ],
        },
      });
      break;

    case "resources/list":
      res.json({
        jsonrpc: "2.0",
        id,
        result: {
          resources: [
            {
              uri: "ui://widget/component.html",
              name: "Widget",
              description: "Interactive widget",
              mimeType: "text/html+skybridge",
            },
          ],
        },
      });
      break;

    case "resources/read":
      if (params?.uri === "ui://widget/component.html") {
        res.json({
          jsonrpc: "2.0",
          id,
          result: {
            contents: [{
              uri: "ui://widget/component.html",
              mimeType: "text/html+skybridge",
              text: `<div id="root"></div><script type="module">${COMPONENT_JS}</script>`,
              _meta: {
                "openai/widgetDescription": "Widget description",
                "openai/widgetPrefersBorder": true,
                "openai/widgetDomain": "https://chatgpt.com",
                "openai/widgetCSP": {
                  connect_domains: [],
                  resource_domains: ["https://*.oaistatic.com"],
                },
              },
            }],
          },
        });
      }
      break;

    case "tools/call":
      // Handle tool execution and return results
      res.json({
        jsonrpc: "2.0",
        id,
        result: {
          structuredContent: { /* data */ },
          content: [{ type: "text", text: "Result" }],
          _meta: {
            "openai/outputTemplate": "ui://widget/component.html",
            "openai/widgetAccessible": true,
          },
        },
      });
      break;

    default:
      res.json({
        jsonrpc: "2.0",
        id,
        error: { code: -32601, message: `Method not found: ${method}` },
      });
  }
});

// 3. GET /mcp/sse - SSE connection endpoint
app.get("/mcp/sse", async (req, res) => {
  const transport = new SSEServerTransport("/mcp/message", res);
  // ... session management
  await server.connect(transport);
});

// 4. POST /mcp/message - SSE message handler
app.post("/mcp/message", async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const transport = transports[sessionId];
  await transport.handlePostMessage(req, res, req.body);
});
```

**Why this matters:**
- ChatGPT first calls `GET /mcp` to discover the server capabilities
- ChatGPT uses `POST /mcp` with JSON-RPC for tool/resource operations
- SSE (`/mcp/sse`) is only used for streaming connections
- MCP Inspector may work with SSE-only, but ChatGPT requires all endpoints

**Quick diagnostic:**
```bash
# Test discovery endpoint
curl http://localhost:3000/mcp
# Should return JSON with "x-mcp" field, NOT hang/stream

# Test JSON-RPC
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'
# Should return tools array
```

### 2. Missing OpenAI metadata in Resource

```typescript
// ❌ Missing _meta
server.registerResource("widget", "ui://widget/component.html", {}, async () => ({
  contents: [{
    uri: "ui://widget/component.html",
    mimeType: "text/html",  // Wrong MIME type
    text: componentHtml
  }]
}));

// ✅ Complete metadata
server.registerResource("widget", "ui://widget/component.html", {}, async () => ({
  contents: [{
    uri: "ui://widget/component.html",
    mimeType: "text/html+skybridge",  // Correct MIME type
    text: componentHtml,
    _meta: {
      "openai/widgetDescription": "Interactive dashboard...",
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

### 2. Missing outputTemplate in Tool

```typescript
// ❌ No UI connection
server.registerTool("get_data", {
  title: "Get Data",
  // Missing _meta
}, handler);

// ✅ Connected to UI
server.registerTool("get_data", {
  title: "Get Data",
  _meta: {
    "openai/outputTemplate": "ui://widget/component.html",
    "openai/widgetAccessible": true,
  },
}, handler);
```

## SSE Transport Errors

**Error:** `Cannot write headers after they are sent to the client`

**Cause:** Manual header setting conflicts with SSEServerTransport

**Solution:** Remove all manual header writes:

```typescript
// ❌ Don't do this
app.get("/mcp/sse", async (req, res) => {
  res.writeHead(200, { /* ... */ });  // Remove this!
  const transport = new SSEServerTransport("/mcp/message", res);
  await server.connect(transport);
});

// ✅ Let SSEServerTransport handle it
app.get("/mcp/sse", async (req, res) => {
  const transport = new SSEServerTransport("/mcp/message", res);
  await server.connect(transport);
});
```

## Message Routing Failures

**Symptoms:**
- Messages not reaching correct client
- Multiple clients interfere with each other
- "No transport found" errors

**Cause:** Missing session management

**Solution:** Implement session store pattern:

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

## React Component Crashes

**Error:** `TypeError: Cannot read properties of null`

**Cause:** Unsafe access to `widgetState` or `toolOutput`

**Solution:** Use null-safe patterns:

```typescript
// ❌ Unsafe
const items = widgetState.items;

// ✅ Safe
const items = widgetState?.items || [];
```

**Best Practice Example:**

```typescript
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

## UI Infinite Vertical Expansion

**Symptoms:**
- Component keeps growing vertically
- Endless scrolling
- Layout breaks

**Cause:** Using `100vh` or `minHeight: "100vh"` in styles

**Why it happens:**
- ChatGPT widgets run in iframes
- `100vh` in iframe causes parent container to expand infinitely
- Creates an infinite loop of height calculation

**Solution:**

```typescript
// ❌ Causes infinite expansion
const styles = {
  container: {
    minHeight: "100vh",  // Viewport height in iframe causes loop
    padding: "20px",
  }
};

// ✅ Proper constraints
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

## Component Build Failures

**Error:** `Component JS not found` in server logs

**Cause:** React component not built

**Solution:**

```bash
cd web
npm run build
# Verify dist/component.js exists
ls -lh dist/
```

**Check build output:**
- `dist/component.js` should exist
- `dist/component.css` may exist (optional)
- Files should have non-zero size

## GPT Cannot Analyze Tool Data

**Symptoms:**
- Tool returns data successfully
- UI component displays data
- GPT says "I only have basic information" or cannot answer detailed questions
- User asks "Do you have detailed information?" and GPT says no

**Root Cause:**
The `content` field is meant for **user-facing text summaries**, not structured data for GPT to analyze. GPT treats `content` as "text to display" rather than "data to analyze."

**Solution:** Use `structuredContent` for data GPT needs to analyze:

```typescript
// ❌ WRONG - GPT ignores the JSON data in content
server.registerTool("search_influencers", {
  // ...
}, async (args) => {
  const detailedData = await fetchDetailedProfiles(args.query);

  return {
    content: [
      { type: "text", text: "Found 6 influencers" },
      { type: "text", text: JSON.stringify(detailedData) }  // GPT ignores this!
    ]
  };
});

// ✅ CORRECT - GPT can analyze structuredContent
server.registerTool("search_influencers", {
  // ...
}, async (args) => {
  const detailedData = await fetchDetailedProfiles(args.query);

  return {
    structuredContent: {
      summary: { totalCount: detailedData.length },
      influencers: detailedData  // GPT analyzes this!
    },
    content: [
      { type: "text", text: "Found 6 influencers" }  // User-facing summary
    ],
    _meta: {
      allData: detailedData  // Component-only data
    }
  };
});
```

**Data Flow Reminder:**

| Field | Model Sees | Component Sees | Use For |
|-------|-----------|----------------|---------|
| `structuredContent` | ✅ | ✅ | Data for GPT to analyze |
| `content` | ✅ | ✅ | User-facing text summary |
| `_meta` | ❌ | ✅ | Component-only metadata |

**Real-World Example:**

```typescript
// Influencer search tool
return {
  structuredContent: {
    summary: {
      totalCount: searchResults.item.total_count,
      query: args.query,
      searchSummary: searchResults.item.search_summary,
    },
    influencers: profiles.map(p => ({
      username: p.profile.username,
      followed_by: p.profile.followed_by,
      engagement_rate: p.profile.engagement_rate,
      collaboration_tier: p.general.collaboration_tier,
      collaborate_brand: p.general.collaborate_brand,
      willing_to_collaborate: p.general.willing_to_collaborate,
      note_for_brand_collaborate_point: p.general.note_for_brand_collaborate_point,
      // ... 20 marketing-relevant fields
    }))
  },
  content: [
    {
      type: "text",
      text: `Found ${searchResults.item.total_count} influencers matching "${args.query}"`
    }
  ],
  _meta: {
    allProfiles: profilesForUI  // Only for carousel component
  }
};
```

Now GPT can answer:
- "Who has the highest engagement rate?" ✅
- "Which influencers have brand collaboration experience?" ✅
- "Show me influencers willing to collaborate" ✅
- "What are the strengths of these influencers for brand partnerships?" ✅

## Common Express Setup Issues

**Missing Middleware:**

```typescript
import express from "express";
import cors from "cors";

const app = express();

// ✅ Required middleware
app.use(cors());  // Enable CORS
app.use(express.json());  // Parse JSON bodies

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "ok" });
});
```

## Debugging Checklist

When things go wrong:

### 1. Check Server Logs
- Look for "Component JS loaded successfully"
- Verify API keys are loaded
- Check for connection messages

### 2. Verify Endpoints

```bash
# Health check
curl http://localhost:3000/health

# SSE endpoint (should hang)
curl http://localhost:3000/mcp/sse
```

### 3. Test with MCP Inspector
- Use official MCP Inspector tool
- Verify tools are listed
- Check resource availability

### 4. Browser Console
- Open ChatGPT dev tools
- Check for component errors
- Verify network requests

### 5. Common Fixes
- Rebuild React component: `cd web && npm run build`
- Rebuild server: `cd server && npm run build`
- Restart server: `npm start`
- Clear ChatGPT cache: Refresh actions list

## Production Deployment Issues

### Cold Starts
- Use platforms with fast cold starts (Fly.io, Railway)
- Consider serverless warm-up strategies

### HTTPS Requirements
- ChatGPT requires HTTPS endpoints
- Use platforms with managed TLS (Render, Fly.io)
- Or configure Let's Encrypt

### CORS Configuration

```typescript
app.use(cors({
  origin: ["https://chatgpt.com", "https://chat.openai.com"],
  credentials: true
}));
```

### MCP SDK Version Mismatch

**Symptoms:**
- Tool works locally but fails on production with "Unknown tool" error
- `tools/call` receives request but doesn't execute handler
- Works with Claude (SSE) but not with ChatGPT (POST /mcp)

**Cause:** MCP SDK internal API changed between versions:
- **1.21 and earlier**: Uses `callback` property for tool handlers
- **1.22 and later**: Uses `handler` property for tool handlers

**Why it happens:**
- Dockerfile uses `pnpm install --frozen-lockfile || pnpm install` (fallback installs latest)
- Lock file missing in subdirectory causes fallback to trigger
- Local has cached older version, production gets latest

**Solution:**

1. **Pin SDK version in package.json:**
```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.25.0"
  }
}
```

2. **Use pnpm workspace with single lock file:**
```dockerfile
# Copy workspace config
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY server/package.json server/

# Install with frozen lockfile (no fallback!)
RUN pnpm install --frozen-lockfile
```

3. **When delegating tools in POST /mcp, use `handler`:**
```typescript
// MCP SDK 1.22+ uses 'handler' instead of 'callback'
const registeredTool = registeredTools[toolName];
if (registeredTool?.handler) {
  const result = await registeredTool.handler(args, {});
  // ...
}
```

**Verification:**
```bash
# Check installed version
cat node_modules/@modelcontextprotocol/sdk/package.json | grep '"version"'

# Check tool structure (add debug log)
console.log('Tool keys:', Object.keys(registeredTool).join(', '));
// 1.21: title, description, inputSchema, callback, enabled, ...
// 1.22+: title, description, inputSchema, handler, enabled, ...
```

## Quick Reference Tables

### Common Fixes

| Problem | Quick Fix |
|---------|-----------|
| UI not showing (MCP Inspector works) | Add `GET /mcp` discovery doc + `POST /mcp` JSON-RPC handler |
| UI not showing | Add `mimeType: "text/html+skybridge"` and `_meta` to resource |
| Header conflict | Remove `res.writeHead()` calls |
| Message routing | Implement session store with `transports` object |
| Component crash | Use `widgetState?.field \|\| defaultValue` |
| Infinite height | Set `maxHeight: "800px"` and `overflowY: "auto"` |
| Build missing | Run `cd web && npm run build` |
| GPT can't analyze data | Move data from `content` to `structuredContent` |
| Tool works locally but not on production | Check MCP SDK version - use `handler` property (1.22+) instead of `callback` (1.21-) |
| Unknown tool error on `tools/call` | Use `pnpm-lock.yaml` with `--frozen-lockfile` to ensure consistent SDK versions |

### Pre-Deployment Checklist

**Server Code:**
- [ ] TypeScript compiles without errors
- [ ] `GET /mcp` returns OpenAPI discovery document with `x-mcp` field
- [ ] `POST /mcp` handles JSON-RPC methods (initialize, tools/list, resources/list, resources/read, tools/call)
- [ ] `GET /mcp/sse` sets up SSE connection
- [ ] `POST /mcp/message` routes messages to correct transport
- [ ] All `_meta` fields properly set in resources
- [ ] All `_meta` fields properly set in tools
- [ ] Session management implemented
- [ ] No manual SSE header writes
- [ ] CORS enabled for ChatGPT domains
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

## Development Process Summary

| Step | Task | Common Issues | Solution |
|------|------|---------------|----------|
| 1. Server Setup | Create MCP server | UI not rendering | Add discovery doc (`GET /mcp`) + JSON-RPC handler (`POST /mcp`) |
| 2. Endpoints | Configure all 4 endpoints | MCP Inspector works, ChatGPT doesn't | Add `GET /mcp`, `POST /mcp`, `GET /mcp/sse`, `POST /mcp/message` |
| 3. Metadata | Add OpenAI metadata | Widget not displayed | Add `_meta` fields to resources and tools |
| 4. SSE Transport | Configure SSE | Header conflict error | Don't set headers manually |
| 5. Session Mgmt | Implement routing | Messages mixed up | Use session store pattern |
| 6. React Component | Build UI | Component crashes | Null-safe access (`?.` operator) |
| 7. Styling | Set dimensions | Infinite expansion | Use `maxHeight` + `overflowY` |
| 8. Data Structure | Return tool results | GPT can't analyze data | Use `structuredContent` for data |
