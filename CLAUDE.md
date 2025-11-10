# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a ChatGPT Apps SDK-based influencer search application that integrates with the whotag.ai API. The project is a monorepo with two main components:
- **server/**: TypeScript MCP (Model Context Protocol) server that handles API integration
- **web/**: React-based UI component rendered inside ChatGPT as a carousel widget

The application allows natural language searches for influencers (e.g., "대한민국의 육아 인플루언서") and displays results in a carousel format within ChatGPT.

## Commands

**Note: Always use `pnpm` instead of `npm` for this project.**

### Installation
```bash
pnpm run install:all  # Install all dependencies (root, server, and web)
```

### Development
```bash
# Terminal 1: Build React UI (must be done before running server)
cd web
pnpm run build

# Terminal 2: Run server in watch mode
cd server
pnpm run dev
```

### Building
```bash
pnpm run build         # Build both web and server
pnpm run build:web     # Build only React UI
pnpm run build:server  # Build only server
```

### Production
```bash
pnpm start  # Start production server (assumes web is already built)
```

### Testing
```bash
pnpm test  # Health check: curl http://localhost:3000/health
```

## Architecture

### MCP Server Pattern
The server uses the MCP (Model Context Protocol) SDK to expose tools and resources to ChatGPT:
- **Resource**: `ui://widget/carousel.html` - Embeds the React component with CSP configuration
- **Tool**: `search_influencers` - Exposes the search functionality to ChatGPT

The MCP server uses SSE (Server-Sent Events) for bidirectional communication:
- `GET /mcp/sse` - Establishes SSE connection
- `POST /mcp/message` - Handles client messages via session ID

### API Integration Flow
1. **Authentication** (`server/src/api/auth.ts`): Token caching with auto-refresh before expiration
2. **Search** (`server/src/api/influencer.ts`): Natural language query → whotag.ai API
3. **Batch Fetch**: Retrieve detailed profiles for returned user IDs
4. **Image Fetch**: Parallel fetch of representative images for each profile
5. **Return**: Two data structures - `structuredContent` (5 profiles for model) and `_meta.allProfiles` (full list for UI)

### Component Loading
The server loads pre-built React components from `web/dist/`:
- `component.js` - Bundled React app
- `component.css` - Component styles

These are injected into the HTML resource with `text/html+skybridge` MIME type for ChatGPT rendering.

### Environment Configuration
Required in `server/.env`:
```
WHOTAG_USERNAME=your_username
WHOTAG_PASSWORD=your_password
PORT=3000
```

### CORS Configuration
The server only accepts requests from:
- `https://chatgpt.com`
- `https://chat.openai.com`

### ChatGPT Integration
Connect via ngrok for local development:
1. Run `ngrok http 3000`
2. Configure ChatGPT Actions with:
   - Authentication: None
   - Schema URL: `https://your-ngrok-url.ngrok.io/mcp`
   - Actions Type: MCP

## Key Technical Details

- **ESM Only**: Both server and web use `"type": "module"` in package.json
- **TypeScript**: `tsx watch` for server development, `tsc` for production builds
- **Widget Metadata**: `_meta` field in tool responses carries full data to React component via `toolOutput` props
- **Session Management**: Each SSE connection maintains its own transport in memory (`transports` object keyed by session ID)
