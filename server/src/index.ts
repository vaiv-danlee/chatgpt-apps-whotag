import express from 'express';
import cors from 'cors';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { z } from 'zod';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import * as dotenv from 'dotenv';

import { searchInfluencers, getInfluencerBatch, getRepresentativeImages } from './api/influencer.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Helper function to get server URL from request
function getServerUrl(req: express.Request): string {
  // 1. Use environment variable if set
  if (process.env.SERVER_URL) {
    return process.env.SERVER_URL;
  }
  
  // 2. When behind Cloud Run or proxy (use X-Forwarded-* headers)
  const protocol = req.get('x-forwarded-proto') || req.protocol;
  const host = req.get('x-forwarded-host') || req.get('host');
  
  if (host) {
    return `${protocol}://${host}`;
  }
  
  // 3. Default for local development environment
  return `http://localhost:${PORT}`;
}

// Middleware
app.use(cors({
  origin: ['https://chatgpt.com', 'https://chat.openai.com'],
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());

// Request logging
app.use((req, _res, next) => {
  console.error(`${req.method} ${req.path}`);
  next();
});

// Load React component
let COMPONENT_JS = '';
let COMPONENT_CSS = '';

try {
  COMPONENT_JS = readFileSync(join(__dirname, '../../web/dist/component.js'), 'utf8');
  COMPONENT_CSS = readFileSync(join(__dirname, '../../web/dist/style.css'), 'utf8');
  console.error('Component files loaded successfully');
} catch (error) {
  console.error('Warning: Component files not found. Run pnpm run build in web directory.');
}

// Create MCP server
const server = new McpServer({
  name: 'influencer-search',
  version: '1.0.0',
});

// Session management
const transports: Record<string, SSEServerTransport> = {};

// Register UI resource
server.registerResource(
  'widget',
  'ui://widget/carousel.html',
  {},
  async () => ({
    contents: [{
      uri: 'ui://widget/carousel.html',
      mimeType: 'text/html+skybridge',
      text: `
<div id="root"></div>
<style>${COMPONENT_CSS}</style>
<script type="module">${COMPONENT_JS}</script>
      `.trim(),
      _meta: {
        'openai/widgetDescription': 'Displays influencer profiles in carousel format',
        'openai/widgetPrefersBorder': true,
        'openai/widgetDomain': 'https://chatgpt.com',
        'openai/widgetCSP': {
          connect_domains: [
            'https://dev.whotag.ai',
            'https://cdn.whotag.ai',
          ],
          resource_domains: [
            'https://cdn.whotag.ai',
            'https://*.oaistatic.com',
          ],
        },
      },
    }],
  })
);

// Register search tool
server.registerTool(
  'search_influencers',
  {
    title: 'Search Influencers',
    description: 'Search influencers using natural language query',
    inputSchema: {
      query: z.string().describe('Natural language search query (e.g., parenting influencers in South Korea)'),
      limit: z.number().min(1).max(6).default(6).optional().describe('Maximum number of results (max 6)'),
    },
    _meta: {
      'openai/outputTemplate': 'ui://widget/carousel.html',
      'openai/widgetAccessible': true,
      'openai/toolInvocation/invoking': 'Searching for influencers...',
      'openai/toolInvocation/invoked': 'Loaded influencer profiles',
    },
  },
  async (args) => {
    try {
      console.error(`Searching for: ${args.query}`);
      
      // 1. Natural language search
      const searchResults = await searchInfluencers(args.query);
      
      // When no search results found
      if (!searchResults.item.influencers || searchResults.item.influencers.length === 0) {
        return {
          content: [{
            type: 'text',
            text: 'No search results found. Please try a different query.',
          }],
        };
      }
      
      // 2. Fetch details (apply limit - max 6)
      const limitValue = Math.min(args.limit || 6, 6);
      const userIds = searchResults.item.influencers.slice(0, limitValue);
      const profiles = await getInfluencerBatch(userIds);
      
      // 3. Fetch representative images in parallel
      const profilesWithImages = await Promise.all(
        profiles.map(async (profile) => {
          try {
            const images = await getRepresentativeImages(profile.profile.user_id);
            return {
              user_id: profile.profile.user_id,
              username: profile.profile.username,
              full_name: profile.profile.full_name,
              title: profile.general?.title || profile.general?.demo_short || '',
              followed_by: profile.profile.followed_by,
              primaryImage: images[0]?.image_url || profile.profile.profile_pic_url,
              links: profile.links?.links || [],
              country: profile.general?.country || [],
            };
          } catch (error) {
            console.error(`Failed to fetch images for ${profile.profile.username}:`, error);
            return {
              user_id: profile.profile.user_id,
              username: profile.profile.username,
              full_name: profile.profile.full_name,
              title: profile.general?.title || profile.general?.demo_short || '',
              followed_by: profile.profile.followed_by,
              primaryImage: profile.profile.profile_pic_url,
              links: profile.links?.links || [],
              country: profile.general?.country || [],
            };
          }
        })
      );

      // Detailed information to pass to GPT (20 fields for beauty marketers)
      const detailedProfiles = profiles.map((profile) => ({
        // Basic profile information (6 items)
        username: profile.profile.username,
        full_name: profile.profile.full_name,
        followed_by: profile.profile.followed_by,
        engagement_rate: profile.profile.engagement_rate,
        profile_pic_url: profile.profile.profile_pic_url,
        biography: profile.profile.biography,

        // Core marketing information (8 items)
        collaboration_tier: profile.general?.collaboration_tier,
        collaborate_brand: profile.general?.collaborate_brand || [],
        engagement_rate_tag: profile.profile.engagement_rate_tag,
        account_type: profile.general?.account_type,
        willing_to_collaborate: profile.general?.willing_to_collaborate,
        note_for_brand_collaborate_point: profile.general?.note_for_brand_collaborate_point || [],
        note_for_brand_weak_point: profile.general?.note_for_brand_weak_point || [],
        tag_brand: profile.general?.tag_brand || [],

        // Demographics & target (6 items)
        country: profile.general?.country || [],
        language: profile.general?.language || [],
        age_range: profile.general?.age_range,
        interests: profile.general?.interests || [],
        field_of_creator: profile.general?.field_of_creator || [],
        demo_short: profile.general?.demo_short,
      }));

      // 4. Return results
      return {
        structuredContent: {
          summary: {
            totalCount: searchResults.item.total_count,
            query: args.query,
            searchSummary: searchResults.item.search_summary,
          },
          influencers: detailedProfiles,
        },
        content: [
          {
            type: 'text',
            text: `Found ${searchResults.item.total_count} influencers. Search results for "${args.query}".`,
          },
        ],
        _meta: {
          'openai/outputTemplate': 'ui://widget/carousel.html',
          'openai/widgetAccessible': true,
          allProfiles: profilesWithImages,
          searchMetadata: {
            query: args.query,
            timestamp: new Date().toISOString(),
            conversationId: searchResults.item.conversation_id,
            totalCount: searchResults.item.total_count,
            summary: searchResults.item.search_summary,
          },
        },
      };
    } catch (error) {
      console.error('Search error:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      return {
        content: [{
          type: 'text',
          text: `An error occurred during search: ${errorMessage}`,
        }],
        isError: true,
      };
    }
  }
);

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// MCP manifest endpoint (GET) - ChatGPT Apps discovery
app.get('/mcp', (req, res) => {
  const serverUrl = getServerUrl(req);
  console.error('GET /mcp - returning discovery document');
  console.error(`Server URL: ${serverUrl}`);
  res.json({
    openapi: '3.1.0',
    info: {
      title: 'Influencer Search MCP',
      version: '1.0.0',
      description: 'MCP server for influencer search',
    },
    servers: [
      {
        url: serverUrl,
      },
    ],
    'x-mcp': {
      protocolVersion: '2025-03-26',
      capabilities: {
        tools: {},
        resources: {},
      },
      transport: {
        type: 'sse',
        url: '/mcp/sse',
      },
    },
  });
});

// MCP manifest endpoint (POST) - ChatGPT sends JSON-RPC requests
app.post('/mcp', async (req, res) => {
  console.error('POST /mcp body:', JSON.stringify(req.body, null, 2));

  const { method, id, params } = req.body;

  try {
    switch (method) {
      case 'initialize':
        console.error('Received initialize request');
        res.json({
          jsonrpc: '2.0',
          id: id,
          result: {
            protocolVersion: params?.protocolVersion || '2025-03-26',
            serverInfo: {
              name: 'influencer-search',
              version: '1.0.0',
            },
            capabilities: {
              tools: {},
              resources: {},
            },
          },
        });
        break;

      case 'notifications/initialized':
        console.error('Received initialized notification');
        // Notifications don't require a response
        res.status(200).end();
        break;

      case 'tools/list':
        console.error('Received tools/list request');
        res.json({
          jsonrpc: '2.0',
          id: id,
          result: {
            tools: [
              {
                name: 'search_influencers',
                description: 'Search influencers using natural language query',
                inputSchema: {
                  type: 'object',
                  properties: {
                    query: {
                      type: 'string',
                      description: 'Natural language search query (e.g., parenting influencers in South Korea)',
                    },
                    limit: {
                      type: 'number',
                      description: 'Maximum number of results (max 6)',
                      default: 6,
                      minimum: 0,
                      maximum: 6,
                    },
                  },
                  required: ['query'],
                },
                _meta: {
                  'openai/outputTemplate': 'ui://widget/carousel.html',
                  'openai/widgetAccessible': true,
                  'openai/toolInvocation/invoking': 'Searching for influencers...',
                  'openai/toolInvocation/invoked': 'Loaded influencer profiles',
                },
              },
            ],
          },
        });
        break;

      case 'resources/list':
        console.error('Received resources/list request');
        res.json({
          jsonrpc: '2.0',
          id: id,
          result: {
            resources: [
              {
                uri: 'ui://widget/carousel.html',
                name: 'Influencer Carousel Widget',
                description: 'Displays influencer profiles in carousel format',
                mimeType: 'text/html+skybridge',
              },
            ],
          },
        });
        break;

      case 'resources/read':
        console.error('=== RESOURCES/READ RECEIVED ===');
        console.error('Resource URI:', params?.uri);
        const resourceUri = params?.uri;

        if (resourceUri === 'ui://widget/carousel.html') {
          res.json({
            jsonrpc: '2.0',
            id: id,
            result: {
              contents: [{
                uri: 'ui://widget/carousel.html',
                mimeType: 'text/html+skybridge',
                text: `
<div id="root"></div>
<style>${COMPONENT_CSS}</style>
<script type="module">${COMPONENT_JS}</script>
                `.trim(),
                _meta: {
                  'openai/widgetDescription': 'Displays influencer profiles in carousel format',
                  'openai/widgetPrefersBorder': true,
                  'openai/widgetDomain': 'https://chatgpt.com',
                  'openai/widgetCSP': {
                    connect_domains: [
                      'https://dev.whotag.ai',
                      'https://cdn.whotag.ai',
                    ],
                    resource_domains: [
                      'https://cdn.whotag.ai',
                      'https://*.oaistatic.com',
                    ],
                  },
                },
              }],
            },
          });
        } else {
          res.json({
            jsonrpc: '2.0',
            id: id,
            error: {
              code: -32602,
              message: `Unknown resource: ${resourceUri}`,
            },
          });
        }
        break;

      case 'tools/call':
        console.error('=== TOOLS/CALL RECEIVED ===');
        console.error('Tool name:', params?.name);
        console.error('Arguments:', JSON.stringify(params?.arguments, null, 2));
        const toolName = params?.name;
        const toolArgs = params?.arguments || {};

        if (toolName === 'search_influencers') {
          // Call the actual search function
          try {
            const searchResults = await searchInfluencers(toolArgs.query);
            // Limit to max 6 (PRD requirement)
            const limitValue = Math.min(toolArgs.limit || 6, 6);
            console.error(`Limit value: ${limitValue}`);
            console.error(`Total influencers found: ${searchResults.item.influencers.length}`);
            const userIds = searchResults.item.influencers.slice(0, limitValue);
            console.error(`User IDs to fetch: ${userIds.length}`);
            const profiles = await getInfluencerBatch(userIds);
            console.error(`Profiles fetched: ${profiles.length}`);

            const profilesWithImages = await Promise.all(
              profiles.map(async (profile) => {
                try {
                  const images = await getRepresentativeImages(profile.profile.user_id);
                  return {
                    user_id: profile.profile.user_id,
                    username: profile.profile.username,
                    full_name: profile.profile.full_name,
                    title: profile.general?.title || profile.general?.demo_short || '',
                    followed_by: profile.profile.followed_by,
                    primaryImage: images[0]?.image_url || profile.profile.profile_pic_url,
                    links: profile.links?.links || [],
                    country: profile.general?.country || [],
                  };
                } catch (error) {
                  console.error(`Failed to fetch images for ${profile.profile.username}:`, error);
                  return {
                    user_id: profile.profile.user_id,
                    username: profile.profile.username,
                    full_name: profile.profile.full_name,
                    title: profile.general?.title || profile.general?.demo_short || '',
                    followed_by: profile.profile.followed_by,
                    primaryImage: profile.profile.profile_pic_url,
                    links: profile.links?.links || [],
                    country: profile.general?.country || [],
                  };
                }
              })
            );

            // GPT에 전달할 상세 정보 (뷰티 마케터용 20개 필드)
            const detailedProfiles = profiles.map((profile) => ({
              // 프로필 기본 정보 (6개)
              username: profile.profile.username,
              full_name: profile.profile.full_name,
              followed_by: profile.profile.followed_by,
              engagement_rate: profile.profile.engagement_rate,
              profile_pic_url: profile.profile.profile_pic_url,
              biography: profile.profile.biography,

              // 마케팅 핵심 정보 (8개)
              collaboration_tier: profile.general?.collaboration_tier,
              collaborate_brand: profile.general?.collaborate_brand || [],
              engagement_rate_tag: profile.profile.engagement_rate_tag,
              account_type: profile.general?.account_type,
              willing_to_collaborate: profile.general?.willing_to_collaborate,
              note_for_brand_collaborate_point: profile.general?.note_for_brand_collaborate_point || [],
              note_for_brand_weak_point: profile.general?.note_for_brand_weak_point || [],
              tag_brand: profile.general?.tag_brand || [],

              // 인구통계 & 타겟 (6개)
              country: profile.general?.country || [],
              language: profile.general?.language || [],
              age_range: profile.general?.age_range,
              interests: profile.general?.interests || [],
              field_of_creator: profile.general?.field_of_creator || [],
              demo_short: profile.general?.demo_short,
            }));

            const response = {
              jsonrpc: '2.0',
              id: id,
              result: {
                structuredContent: {
                  summary: {
                    totalCount: searchResults.item.total_count,
                    query: toolArgs.query,
                    searchSummary: searchResults.item.search_summary,
                  },
                  influencers: detailedProfiles,
                },
                content: [
                  {
                    type: 'text',
                    text: `Found ${searchResults.item.total_count} influencers. Search results for "${toolArgs.query}".`,
                  },
                ],
                _meta: {
                  'openai/outputTemplate': 'ui://widget/carousel.html',
                  'openai/widgetAccessible': true,
                  allProfiles: profilesWithImages,
                  searchMetadata: {
                    query: toolArgs.query,
                    timestamp: new Date().toISOString(),
                    conversationId: searchResults.item.conversation_id,
                    totalCount: searchResults.item.total_count,
                    summary: searchResults.item.search_summary,
                  },
                },
              },
            };

            console.error('=== RESPONSE DEBUG ===');
            console.error('Response structure:', JSON.stringify({
              hasContent: !!response.result.content,
              contentLength: response.result.content.length,
              contentTypes: response.result.content.map((c: any) => c.type),
              hasMeta: !!response.result._meta,
              hasOutputTemplate: !!response.result._meta?.['openai/outputTemplate'],
              outputTemplate: response.result._meta?.['openai/outputTemplate'],
              profilesCount: response.result._meta?.allProfiles?.length || 0,
            }, null, 2));
            console.error('=== END DEBUG ===');

            res.json(response);
          } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            res.json({
              jsonrpc: '2.0',
              id: id,
              error: {
                code: -32000,
                message: errorMessage,
              },
            });
          }
        } else {
          res.json({
            jsonrpc: '2.0',
            id: id,
            error: {
              code: -32601,
              message: `Unknown tool: ${toolName}`,
            },
          });
        }
        break;

      default:
        console.error(`Unknown method: ${method}`);
        res.json({
          jsonrpc: '2.0',
          id: id,
          error: {
            code: -32601,
            message: `Method not found: ${method}`,
          },
        });
    }
  } catch (error) {
    console.error('Error handling MCP request:', error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.json({
      jsonrpc: '2.0',
      id: id,
      error: {
        code: -32603,
        message: errorMessage,
      },
    });
  }
});

// OAuth discovery endpoints (return empty for no auth)
app.get('/.well-known/oauth-authorization-server', (_req, res) => {
  res.status(404).json({ error: 'OAuth not configured' });
});

app.get('/.well-known/openid-configuration', (_req, res) => {
  res.status(404).json({ error: 'OpenID not configured' });
});

// SSE endpoint
app.get('/mcp/sse', async (_req, res) => {
  const transport = new SSEServerTransport('/mcp/message', res);
  const sessionId = (transport as any)._sessionId;
  
  if (sessionId) {
    transports[sessionId] = transport;
    console.error(`New SSE connection: ${sessionId}`);
  }
  
  res.on('close', () => {
    if (sessionId) {
      delete transports[sessionId];
      console.error(`SSE connection closed: ${sessionId}`);
    }
  });
  
  await server.connect(transport);
});

// Message endpoint
app.post('/mcp/message', async (req, res) => {
  const sessionId = req.query.sessionId as string;
  const transport = transports[sessionId];
  
  if (!transport) {
    console.error(`No transport found for session: ${sessionId}`);
    res.status(400).send('No transport found');
    return;
  }
  
  await transport.handlePostMessage(req, res, req.body);
});

// Start server
app.listen(PORT, () => {
  console.error(`✅ Server running on http://localhost:${PORT}`);
  console.error(`📋 Health check: http://localhost:${PORT}/health`);
  console.error(`🔌 MCP endpoint: http://localhost:${PORT}/mcp`);
});
