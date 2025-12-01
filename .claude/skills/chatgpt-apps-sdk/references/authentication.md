# OAuth 2.1 Authentication Guide

Complete guide for implementing OAuth 2.1 authentication in ChatGPT Apps SDK.

## Table of Contents

- [Overview](#overview)
- [When to Use Authentication](#when-to-use-authentication)
- [Architecture](#architecture)
- [Implementation](#implementation)
- [Token Management](#token-management)
- [Scopes](#scopes)
- [Testing](#testing)
- [Security Best Practices](#security-best-practices)
- [Troubleshooting](#troubleshooting)
- [Migration](#migration)

---

## Overview

ChatGPT Apps SDK supports OAuth 2.1 with PKCE (Proof Key for Code Exchange) for secure user authentication. This enables apps to access user-specific data and perform write operations.

## When to Use Authentication

**Use OAuth when:**
- Accessing user-specific data (CRM records, documents, accounts)
- Performing write operations (create, update, delete)
- Integrating with third-party APIs requiring user consent
- Implementing multi-tenant applications

**Anonymous access when:**
- Providing public data or read-only information
- Building discovery or search tools
- Creating calculators or utilities

## Architecture

### Components

```
┌─────────────┐
│   ChatGPT   │  (Client)
│  (OAuth     │  - Manages auth flow
│   Client)   │  - Stores tokens
└─────┬───────┘  - Sends Bearer tokens
      │
      │ HTTPS + Bearer token
      │
┌─────▼────────────┐
│   MCP Server     │  (Resource Server)
│ (Your Backend)   │  - Validates tokens
│                  │  - Enforces scopes
│                  │  - Executes tools
└─────┬────────────┘
      │
      │ Token validation
      │
┌─────▼─────────────┐
│ Authorization     │  (Auth Server)
│     Server        │  - Issues tokens
│ (Auth0, Okta,     │  - Manages users
│  Azure AD, etc.)  │  - Handles consent
└───────────────────┘
```

### Flow Sequence

1. **Discovery**: ChatGPT queries MCP server for protected resource metadata
2. **Registration**: ChatGPT registers with auth server, gets `client_id`
3. **Authorization**: User authenticates and consents to scopes
4. **Token Exchange**: ChatGPT exchanges auth code for access token (with PKCE)
5. **API Calls**: ChatGPT attaches token to MCP requests
6. **Validation**: MCP server validates token on each request

## Implementation

### Step 1: Set Up Authorization Server

#### Auth0 Configuration

1. **Create API:**
   - Go to Auth0 Dashboard → APIs → Create API
   - Set identifier (e.g., `https://example.com/mcp`)
   - This identifier becomes token audience

2. **Enable RBAC:**
   - Settings → RBAC Settings → Enable RBAC
   - Add Permissions to Access Tokens → On
   - Define permissions: `read`, `write`, `admin`, etc.

3. **Enable Dynamic Registration:**
   - Applications → Advanced → OAuth → Enable Dynamic Client Registration
   - Configure registration endpoint
   - Set token endpoint authentication to `none` for PKCE

4. **Configure Login:**
   - Ensure at least one connection is enabled
   - Enable for dynamically registered clients
   - Configure consent screen with app info

#### Required Endpoints

Your auth server must expose:

```
/.well-known/oauth-protected-resource
/.well-known/openid-configuration
/oauth/authorize
/oauth/token
/oauth/register
/.well-known/jwks.json
```

### Step 2: Configure MCP Server

#### Python Implementation

```python
from mcp.server.fastmcp import FastMCP
from mcp.server.auth.settings import AuthSettings
from mcp.server.auth.provider import TokenVerifier, AccessToken
import jwt
from jwt import PyJWKClient

class MyTokenVerifier(TokenVerifier):
    def __init__(self, jwks_url: str, audience: str, issuer: str):
        self.jwks_client = PyJWKClient(jwks_url)
        self.audience = audience
        self.issuer = issuer
    
    async def verify_token(self, token: str) -> AccessToken | None:
        try:
            # Get signing key
            signing_key = self.jwks_client.get_signing_key_from_jwt(token)
            
            # Decode and validate
            payload = jwt.decode(
                token,
                signing_key.key,
                algorithms=["RS256"],
                audience=self.audience,
                issuer=self.issuer
            )
            
            # Check required permissions
            permissions = payload.get("permissions", [])
            if "user" not in permissions:
                return None
            
            # Return AccessToken
            return AccessToken(
                token=token,
                client_id=payload.get("azp"),
                subject=payload["sub"],
                scopes=permissions,
                claims=payload
            )
        except Exception as e:
            print(f"Token verification failed: {e}")
            return None

# Create MCP server with auth
mcp = FastMCP(
    name="my-app",
    stateless_http=True,
    token_verifier=MyTokenVerifier(
        jwks_url="https://your-tenant.auth0.com/.well-known/jwks.json",
        audience="https://example.com/mcp",
        issuer="https://your-tenant.auth0.com/"
    ),
    auth=AuthSettings(
        issuer_url="https://your-tenant.auth0.com",
        resource_server_url="https://example.com/mcp",
        required_scopes=["user"]
    )
)
```

#### TypeScript Implementation

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";

const client = jwksClient({
  jwksUri: "https://your-tenant.auth0.com/.well-known/jwks.json"
});

function getKey(header: any, callback: any) {
  client.getSigningKey(header.kid, (err, key) => {
    const signingKey = key?.getPublicKey();
    callback(null, signingKey);
  });
}

async function verifyToken(token: string): Promise<any> {
  return new Promise((resolve, reject) => {
    jwt.verify(
      token,
      getKey,
      {
        audience: "https://example.com/mcp",
        issuer: "https://your-tenant.auth0.com/",
        algorithms: ["RS256"]
      },
      (err, decoded) => {
        if (err) reject(err);
        else resolve(decoded);
      }
    );
  });
}

// Middleware to verify token
server.use(async (req, context, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Error("Missing or invalid authorization header");
  }
  
  const token = authHeader.substring(7);
  
  try {
    const payload = await verifyToken(token);
    
    // Check permissions
    const permissions = payload.permissions || [];
    if (!permissions.includes("user")) {
      throw new Error("Insufficient permissions");
    }
    
    // Store user info in context
    context.user = {
      sub: payload.sub,
      permissions: permissions
    };
    
    await next();
  } catch (error) {
    throw new Error("Token verification failed");
  }
});
```

### Step 3: Protect Resource Metadata

Create `/.well-known/oauth-protected-resource` endpoint:

```json
{
  "resource_servers": [
    {
      "resource": "https://example.com/mcp",
      "authorization_servers": [
        "https://your-tenant.auth0.com"
      ],
      "scopes_supported": [
        "read",
        "write",
        "admin"
      ],
      "bearer_methods_supported": [
        "header"
      ]
    }
  ]
}
```

### Step 4: Per-Tool Authentication

#### Tool-Level Security Schemes

```typescript
// Public tool (anonymous + authenticated)
server.registerTool("search", {
  title: "Search",
  description: "Search public data",
  securitySchemes: [
    { type: "noauth" },
    { type: "oauth2", scopes: ["read"] }
  ],
  inputSchema: { /* ... */ }
}, async (args, context) => {
  // Works with or without auth
  // Authenticated users might see more results
  const isAuthenticated = !!context.user;
  return fetchResults(args, isAuthenticated);
});

// Auth required tool
server.registerTool("create_doc", {
  title: "Create Document",
  description: "Create a new document",
  securitySchemes: [
    { type: "oauth2", scopes: ["write"] }
  ],
  inputSchema: { /* ... */ }
}, async (args, context) => {
  // Requires authentication
  if (!context.user) {
    throw new Error("Authentication required");
  }
  
  // Check specific scope
  if (!context.user.permissions.includes("write")) {
    throw new Error("Insufficient permissions");
  }
  
  return createDocument(args, context.user);
});

// Admin-only tool
server.registerTool("delete_user", {
  title: "Delete User",
  description: "Delete a user account",
  securitySchemes: [
    { type: "oauth2", scopes: ["admin"] }
  ],
  inputSchema: { /* ... */ }
}, async (args, context) => {
  if (!context.user?.permissions.includes("admin")) {
    throw new Error("Admin access required");
  }
  
  return deleteUser(args.userId);
});
```

### Step 5: Handle Auth Errors

Return proper error responses:

```typescript
server.registerTool("protected_tool", {
  title: "Protected Tool",
  securitySchemes: [{ type: "oauth2", scopes: ["read"] }],
  inputSchema: { /* ... */ }
}, async (args, context) => {
  if (!context.user) {
    // Return auth challenge
    return {
      isError: true,
      content: [{
        type: "text",
        text: "Authentication required. Please sign in."
      }],
      _meta: {
        "mcp/www_authenticate": 'Bearer realm="example.com", scope="read write"'
      }
    };
  }
  
  // Proceed with authenticated request
  return performAction(args, context.user);
});
```

## Token Management

### Token Lifecycle

```typescript
interface TokenInfo {
  access_token: string;
  token_type: "Bearer";
  expires_in: number;       // Seconds until expiration
  refresh_token?: string;   // Optional
  scope: string;            // Space-separated scopes
}
```

### Token Validation

```typescript
async function validateToken(token: string): Promise<boolean> {
  try {
    const payload = await verifyToken(token);
    
    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      return false;
    }
    
    // Check audience
    if (payload.aud !== "https://example.com/mcp") {
      return false;
    }
    
    // Check issuer
    if (payload.iss !== "https://your-tenant.auth0.com/") {
      return false;
    }
    
    return true;
  } catch {
    return false;
  }
}
```

### Token Refresh

ChatGPT handles refresh automatically. Server should:

1. Return `401 Unauthorized` for expired tokens
2. Include `WWW-Authenticate` header
3. ChatGPT will refresh and retry

```typescript
if (isTokenExpired(token)) {
  res.status(401);
  res.header("WWW-Authenticate", 'Bearer realm="example.com", error="invalid_token"');
  return { error: "Token expired" };
}
```

## Scopes

### Defining Scopes

Scopes control access to different operations:

```typescript
const SCOPES = {
  READ: "read",           // View data
  WRITE: "write",         // Create/update data
  DELETE: "delete",       // Delete data
  ADMIN: "admin",         // Administrative actions
  SHARE: "share",         // Share with others
  EXPORT: "export"        // Export data
};
```

### Checking Scopes

```typescript
function requireScope(required: string) {
  return (args: any, context: any) => {
    const userScopes = context.user?.permissions || [];
    
    if (!userScopes.includes(required)) {
      throw new Error(`Scope '${required}' required`);
    }
  };
}

// Use as middleware
server.registerTool("write_tool", {
  title: "Write Tool",
  securitySchemes: [{ type: "oauth2", scopes: ["write"] }],
  // ...
}, requireScope("write"), async (args, context) => {
  // Scope verified, proceed
});
```

### Requesting Scopes

In `AuthSettings`, specify required scopes:

```python
auth=AuthSettings(
    issuer_url="https://your-tenant.auth0.com",
    resource_server_url="https://example.com/mcp",
    required_scopes=["read", "write"]  # Request both scopes
)
```

## Testing

### Local Testing

1. **Start auth server** (or use Auth0/Okta)
2. **Configure MCP server** with auth settings
3. **Test with MCP Inspector:**
   ```bash
   mcp inspect http://localhost:3000/mcp
   ```
4. **Verify token flow:**
   - Inspector should prompt for OAuth
   - Complete login in browser
   - Inspector receives token
   - Tool calls include Bearer token

### Manual Token Testing

```bash
# Get token (Auth0 example)
curl --request POST \
  --url https://your-tenant.auth0.com/oauth/token \
  --header 'content-type: application/json' \
  --data '{
    "client_id":"YOUR_CLIENT_ID",
    "client_secret":"YOUR_CLIENT_SECRET",
    "audience":"https://example.com/mcp",
    "grant_type":"client_credentials"
  }'

# Use token
curl --request POST \
  --url https://example.com/mcp \
  --header 'authorization: Bearer YOUR_TOKEN' \
  --header 'content-type: application/json' \
  --data '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/list"
  }'
```

## Security Best Practices

### Token Security

- ✅ Use short-lived access tokens (15-60 minutes)
- ✅ Implement refresh tokens for long sessions
- ✅ Validate tokens on every request
- ✅ Check audience and issuer claims
- ✅ Verify token signatures with JWKS
- ❌ Never log tokens
- ❌ Never expose tokens in URLs or error messages

### Scope Management

- ✅ Follow principle of least privilege
- ✅ Use fine-grained scopes
- ✅ Document scope requirements clearly
- ✅ Implement scope checking in code
- ❌ Don't grant admin scopes by default

### Error Handling

- ✅ Return generic error messages to users
- ✅ Log detailed errors server-side
- ✅ Use proper HTTP status codes
- ✅ Include WWW-Authenticate headers
- ❌ Don't expose internal details in errors

### HTTPS

- ✅ Always use HTTPS in production
- ✅ Use valid TLS certificates
- ✅ Enforce HTTPS redirects
- ❌ Never use HTTP for OAuth endpoints

## Troubleshooting

### Token Validation Fails

**Symptoms:** 401 Unauthorized, "Invalid token"

**Solutions:**
1. Verify JWKS URL is accessible
2. Check token hasn't expired
3. Confirm audience matches
4. Verify issuer matches
5. Ensure clock sync (allow ±60s skew)

### User Can't Authenticate

**Symptoms:** Auth flow doesn't complete, no token received

**Solutions:**
1. Check redirect URIs match
2. Verify connection is enabled
3. Confirm scopes are valid
4. Check user has required permissions
5. Review auth server logs

### Scope Errors

**Symptoms:** "Insufficient permissions", scope check fails

**Solutions:**
1. Verify scopes in access token
2. Check scope configuration in auth settings
3. Ensure API permissions are enabled
4. Confirm user was granted scopes
5. Check scope string format (space-separated)

### CORS Issues

**Symptoms:** Browser blocks requests, CORS errors

**Solutions:**
1. Add proper CORS headers to auth endpoints
2. Include ChatGPT origins in allowed origins
3. Allow Authorization header
4. Support preflight OPTIONS requests

## Migration

### From No Auth to OAuth

1. **Phase 1: Prepare**
   - Set up auth server
   - Implement token verification
   - Mark tools with security schemes
   - Keep anonymous access working

2. **Phase 2: Test**
   - Test auth flow in dev mode
   - Verify scopes work correctly
   - Ensure error handling is smooth

3. **Phase 3: Launch**
   - Announce auth requirement
   - Guide users through linking
   - Monitor for auth issues
   - Provide support documentation

### From OAuth 2.0 to 2.1

OAuth 2.1 requires PKCE. Changes needed:

1. **Auth Server:**
   - Enable PKCE support
   - Require code_challenge
   - Support S256 method

2. **MCP Server:**
   - No changes needed
   - PKCE is client-side

3. **Testing:**
   - Verify PKCE flow works
   - Test with ChatGPT client
