# MCP Protocol Reference

Model Context Protocol (MCP) specification details for Apps SDK.

**Protocol Version:** 2025-11-25 (Latest)

## Table of Contents

- [Protocol Overview](#protocol-overview)
- [Protocol Version History](#protocol-version-history)
- [Tool Specification](#tool-specification)
- [Resource Specification](#resource-specification)
- [Lifecycle](#lifecycle)
- [Authorization](#authorization)
- [Content Security Policy](#content-security-policy)
- [Locale Negotiation](#locale-negotiation)
- [Client Hints](#client-hints)
- [Performance Optimization](#performance-optimization)

---

## Protocol Overview

MCP is an open specification connecting LLM clients to external tools and resources. Apps SDK uses MCP to keep server, model, and UI in sync.

### SDK Version

Recommended: `@modelcontextprotocol/sdk` version **1.25.0** or later.

> **Breaking Change:** SDK 1.22+ uses `handler` property for tool callbacks (1.21 and earlier used `callback`). See troubleshooting guide for details.

## Protocol Version History

| Version | Release Date | Key Changes |
|---------|--------------|-------------|
| 2025-11-25 | Nov 2025 | Tool calling in sampling, JSON Schema 2020-12 default, schema decoupling |
| 2025-06-18 | Jun 2025 | **`structuredContent` introduced**, `outputSchema` for tools, OAuth security enhancements |
| 2025-03-26 | Mar 2025 | OAuth 2.1, Streamable HTTP transport, Audio content, Tool annotations |
| 2024-11-05 | Nov 2024 | Initial stable specification |

### structuredContent Compatibility

| Protocol Version | structuredContent Support |
|-----------------|---------------------------|
| 2024-11-05 | ❌ Not supported |
| 2025-03-26 | ❌ Not supported |
| 2025-06-18+ | ✅ Supported (standard) |


### Transport Options

**Streamable HTTP (Recommended)**
- Best for production deployments
- Simpler infrastructure
- Standard HTTP/HTTPS

**Server-Sent Events (SSE)**
- Real-time streaming
- Requires persistent connections

## Tool Specification

### Tool Definition Structure

```typescript
interface Tool {
  name: string;              // Machine name (unique identifier)
  title?: string;            // Human-readable name
  description: string;       // Action-oriented description
  inputSchema: JSONSchema;   // Input parameters (JSON Schema 2020-12)

  // Output schema for structured results (2025-06-18+)
  outputSchema?: JSONSchema;

  // Tool behavior hints (2025-03-26+)
  annotations?: {
    readOnlyHint?: boolean;     // Tool only reads data
    destructiveHint?: boolean;  // Tool may modify/delete data
    idempotentHint?: boolean;   // Safe to retry
    openWorldHint?: boolean;    // May interact with external world
  };

  // Tool icons (2025-11-25+)
  icons?: Array<{
    src: string;           // Icon URL
    mimeType: string;      // e.g., "image/png"
    sizes?: string[];      // e.g., ["48x48", "96x96"]
  }>;

  // Security schemes
  securitySchemes?: Array<{
    type: "noauth" | "oauth2";
    scopes?: string[];
  }>;

  // OpenAI/ChatGPT-specific metadata
  _meta?: {
    "openai/outputTemplate"?: string;           // Widget ID for rendering
    "openai/widgetAccessible"?: boolean;        // Widget can access tool output
    "openai/toolInvocation/invoking"?: string;  // Message while executing
    "openai/toolInvocation/invoked"?: string;   // Message after completion
  };
}
```

### Tool Result Structure (CallToolResult)

```typescript
interface CallToolResult {
  // Required: Unstructured content for display/backwards compatibility
  content: Array<{
    type: "text" | "image" | "audio" | "resource";
    text?: string;           // For type: "text"
    data?: string;           // Base64 for image/audio
    mimeType?: string;       // MIME type for binary content
    resource?: {             // For type: "resource"
      uri: string;
      mimeType: string;
      text?: string;
    };
    annotations?: {          // Optional content annotations
      audience?: ("user" | "assistant")[];
      priority?: number;
      lastModified?: string; // ISO 8601 timestamp
    };
  }>;

  // Optional: Structured JSON data (2025-06-18+)
  structuredContent?: Record<string, unknown>;

  // Optional: Metadata (used by ChatGPT for widget data)
  _meta?: Record<string, unknown>;

  // Optional: Error flag
  isError?: boolean;

  // Index signature for additional properties
  [key: string]: unknown;
}
```

### structuredContent Usage

**Standard MCP (2025-06-18+):**
```typescript
// Both content and structuredContent for compatibility
return {
  content: [{
    type: "text",
    text: JSON.stringify({ temperature: 22.5, conditions: "Sunny" })
  }],
  structuredContent: {
    temperature: 22.5,
    conditions: "Sunny",
    humidity: 65
  }
};
```

**With outputSchema validation:**
```typescript
// Define outputSchema in tool definition
{
  name: "get_weather",
  outputSchema: {
    type: "object",
    properties: {
      temperature: { type: "number" },
      conditions: { type: "string" }
    },
    required: ["temperature", "conditions"]
  }
}
// Server MUST return structuredContent matching schema
// Client SHOULD validate against schema
```

### Error Handling

Return errors with `_meta["mcp/www_authenticate"]`:

```typescript
{
  isError: true,
  content: [{
    type: "text",
    text: "Authentication required"
  }],
  _meta: {
    "mcp/www_authenticate": "Bearer realm=\"example.com\""
  }
}
```

## Resource Specification

### Resource Types

**HTML Components** (`text/html+skybridge`)
- UI templates rendered in iframe
- Includes JS/CSS bundles
- Security sandboxed

**Data Resources**
- JSON, text, binary data
- Cached by client
- Version managed via URI

### Resource Definition

```typescript
{
  uri: string;              // Unique identifier
  name: string;             // Human-readable name
  description?: string;     // Optional description
  mimeType: string;         // Content type
  _meta?: {
    "openai/widgetDescription"?: string;
    "openai/widgetPrefersBorder"?: boolean;
    "openai/widgetCSP"?: {
      connect_domains: string[];
      resource_domains: string[];
    };
    "openai/widgetDomain"?: string;
  };
}
```

## Lifecycle

### Initialize Handshake

**Client Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "initialize",
  "params": {
    "protocolVersion": "2025-11-25",
    "capabilities": {
      "roots": { "listChanged": true },
      "sampling": {},
      "elicitation": { "form": {}, "url": {} },
      "tasks": {
        "requests": {
          "elicitation": { "create": {} },
          "sampling": { "createMessage": {} }
        }
      }
    },
    "_meta": {
      "openai/locale": "en-US"
    },
    "clientInfo": {
      "name": "ChatGPT",
      "version": "1.0.0"
    }
  }
}
```

**Server Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2025-11-25",
    "capabilities": {
      "tools": { "listChanged": true },
      "resources": { "subscribe": true, "listChanged": true },
      "prompts": { "listChanged": true },
      "logging": {}
    },
    "serverInfo": {
      "name": "my-server",
      "version": "1.0.0"
    },
    "_meta": {
      "openai/locale": "en"
    }
  }
}
```

### Version Negotiation

- Client sends the latest protocol version it supports
- Server responds with the same version if supported, or proposes an alternative
- If versions don't match, client SHOULD disconnect
- For HTTP transport, client must include `MCP-Protocol-Version` header on all requests

### List Tools

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "method": "tools/list"
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 2,
  "result": {
    "tools": [
      {
        "name": "get_data",
        "title": "Get Data",
        "description": "Fetch user data",
        "inputSchema": {
          "type": "object",
          "properties": {
            "userId": { "type": "string" }
          },
          "required": ["userId"]
        }
      }
    ]
  }
}
```

### Call Tool

**Request:**
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "method": "tools/call",
  "params": {
    "name": "get_data",
    "arguments": {
      "userId": "123"
    },
    "_meta": {
      "openai/locale": "en-US",
      "openai/userAgent": "ChatGPT/1.0",
      "openai/userLocation": {
        "city": "San Francisco",
        "country": "US"
      }
    }
  }
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "id": 3,
  "result": {
    "content": [{
      "type": "text",
      "text": "Found 5 items"
    }],
    "structuredContent": {
      "items": [...]
    },
    "_meta": {
      "timestamp": "2025-01-01T00:00:00Z"
    }
  }
}
```

## Authorization

### Protected Resource Metadata

**Endpoint:** `/.well-known/oauth-protected-resource`

```json
{
  "resource_servers": [{
    "resource": "https://example.com/mcp",
    "authorization_servers": [
      "https://auth.example.com"
    ],
    "scopes_supported": ["read", "write"],
    "bearer_methods_supported": ["header"]
  }]
}
```

### OpenID Configuration

**Endpoint:** `/.well-known/openid-configuration`

```json
{
  "issuer": "https://auth.example.com",
  "authorization_endpoint": "https://auth.example.com/authorize",
  "token_endpoint": "https://auth.example.com/token",
  "jwks_uri": "https://auth.example.com/.well-known/jwks.json",
  "registration_endpoint": "https://auth.example.com/register",
  "scopes_supported": ["read", "write"],
  "response_types_supported": ["code"],
  "grant_types_supported": ["authorization_code"],
  "code_challenge_methods_supported": ["S256"]
}
```

## Content Security Policy

### CSP Mapping

Apps SDK CSP configuration maps to iframe CSP directives:

```typescript
{
  "openai/widgetCSP": {
    connect_domains: ["https://api.example.com"],
    resource_domains: ["https://cdn.example.com"]
  }
}
```

**Resulting CSP:**
```
script-src 'self' https://cdn.example.com;
img-src 'self' data: https://cdn.example.com;
font-src 'self' https://cdn.example.com;
connect-src 'self' https://api.example.com;
style-src 'self' 'unsafe-inline';
default-src 'none';
```

### Best Practices

- Minimize `connect_domains` (API endpoints only)
- Use `resource_domains` for CDN assets
- Avoid wildcards when possible
- Test CSP thoroughly before production

## Locale Negotiation

### Supported Locales

Follow IETF BCP 47 tags:
- `en-US` (English, United States)
- `en-GB` (English, United Kingdom)
- `fr-FR` (French, France)
- `es-419` (Spanish, Latin America)
- `ja-JP` (Japanese, Japan)
- `ko-KR` (Korean, Korea)
- `zh-CN` (Chinese, Simplified)

### Locale Fallback

Use RFC 4647 lookup rules:
1. Exact match: `en-GB` → `en-GB`
2. Language match: `en-GB` → `en`
3. Default: `en-GB` → `en` (if `en-GB` unavailable)

### Implementation

```typescript
const supportedLocales = ["en", "fr", "es"];

function negotiateLocale(requested: string): string {
  // Exact match
  if (supportedLocales.includes(requested)) {
    return requested;
  }
  
  // Language-only match
  const lang = requested.split("-")[0];
  if (supportedLocales.includes(lang)) {
    return lang;
  }
  
  // Default fallback
  return "en";
}
```

## Client Hints

### User Agent

```typescript
"openai/userAgent": "ChatGPT/1.2025.012"
```

Parse for analytics, feature detection, or formatting.

### User Location

```typescript
"openai/userLocation": {
  "city": "San Francisco",
  "region": "California",
  "country": "US",
  "timezone": "America/Los_Angeles",
  "longitude": -122.4194,
  "latitude": 37.7749
}
```

**Advisory only** - never use for authorization. Use for:
- Regional content
- Timezone formatting
- Map defaults
- Analytics

## Performance Optimization

### Response Size Limits

- Keep `structuredContent` under 10KB
- Use pagination for large datasets
- Store full data in `_meta` (component-only)
- Return references/IDs instead of full objects

### Caching Strategy

- Use stable URIs for resources
- Set appropriate cache headers
- Version assets in URI path
- Leverage CDN for static assets

### Cold Start Mitigation

- Keep server warm with health checks
- Use connection pooling
- Cache frequently-used data
- Optimize initialization time
