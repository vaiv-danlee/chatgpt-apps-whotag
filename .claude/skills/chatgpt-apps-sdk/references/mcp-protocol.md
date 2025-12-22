# MCP Protocol Reference

Model Context Protocol (MCP) specification details for Apps SDK.

## Table of Contents

- [Protocol Overview](#protocol-overview)
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
{
  name: string;              // Machine name
  title: string;             // Human-readable name
  description: string;       // Action-oriented description
  inputSchema: JSONSchema;   // Input parameters
  outputSchema?: JSONSchema; // Optional output schema
  annotations?: {
    readOnlyHint?: boolean;
  };
  securitySchemes?: Array<{
    type: "noauth" | "oauth2";
    scopes?: string[];
  }>;
  _meta?: {
    "openai/outputTemplate"?: string;
    "openai/widgetAccessible"?: boolean;
    "openai/toolInvocation/invoking"?: string;
    "openai/toolInvocation/invoked"?: string;
  };
}
```

### Tool Result Structure

```typescript
{
  content?: Array<{
    type: "text" | "image" | "resource";
    text?: string;
    data?: string;
    mimeType?: string;
  }>;
  structuredContent?: Record<string, any>;
  _meta?: Record<string, any>;
  isError?: boolean;
}
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
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "roots": { "listChanged": true },
      "sampling": {},
      "elicitation": {}
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
    "protocolVersion": "2024-11-05",
    "capabilities": {
      "tools": { "listChanged": true }
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
