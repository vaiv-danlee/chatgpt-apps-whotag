import express from "express";
import cors from "cors";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import * as dotenv from "dotenv";

import {
  searchInfluencers,
  getInfluencerBatch,
  getRepresentativeImages,
  getGridImages,
} from "./api/influencer.js";
import {
  analyzeHashtagTrends,
  analyzeContentStats,
  findTrendingTopics,
} from "./api/analytics.js";

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
  const protocol = req.get("x-forwarded-proto") || req.protocol;
  const host = req.get("x-forwarded-host") || req.get("host");

  if (host) {
    return `${protocol}://${host}`;
  }

  // 3. Default for local development environment
  return `http://localhost:${PORT}`;
}

// Middleware
app.use(
  cors({
    origin: ["https://chatgpt.com", "https://chat.openai.com"],
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());

// Request logging with host detection info
app.use((req, _res, next) => {
  console.error(`\n========== REQUEST ==========`);
  console.error(`${req.method} ${req.path}`);
  console.error(`--- Headers for host detection ---`);
  console.error(`Origin: ${req.get("origin") || "(none)"}`);
  console.error(`Referer: ${req.get("referer") || "(none)"}`);
  console.error(`User-Agent: ${req.get("user-agent") || "(none)"}`);
  console.error(`X-Forwarded-Host: ${req.get("x-forwarded-host") || "(none)"}`);
  console.error(`Host: ${req.get("host") || "(none)"}`);
  // ChatGPT specific headers (if any)
  console.error(`X-OpenAI-*: ${JSON.stringify(
    Object.fromEntries(
      Object.entries(req.headers).filter(([k]) => k.toLowerCase().startsWith("x-openai"))
    )
  )}`);
  // All custom headers (x-* headers)
  console.error(`All X-* headers: ${JSON.stringify(
    Object.fromEntries(
      Object.entries(req.headers).filter(([k]) => k.toLowerCase().startsWith("x-"))
    )
  )}`);
  console.error(`================================\n`);
  next();
});

// Load React component
let COMPONENT_JS = "";
let COMPONENT_CSS = "";

try {
  COMPONENT_JS = readFileSync(
    join(__dirname, "../../web/dist/component.js"),
    "utf8"
  );
  COMPONENT_CSS = readFileSync(
    join(__dirname, "../../web/dist/style.css"),
    "utf8"
  );
  console.error("Component files loaded successfully");
} catch (error) {
  console.error(
    "Warning: Component files not found. Run pnpm run build in web directory."
  );
}

// Create MCP server
const server = new McpServer({
  name: "influencer-search",
  version: "1.0.0",
});

// Session management
const transports: Record<string, SSEServerTransport> = {};

// Host type detection and session tracking
type HostType = "chatgpt" | "standard";

interface SessionInfo {
  transport: SSEServerTransport;
  hostType: HostType;
}

const sessions: Record<string, SessionInfo> = {};

// Current session context (set during request handling)
let currentSessionHostType: HostType = "standard";

function detectHostType(req: express.Request): HostType {
  const userAgent = req.get("user-agent") || "";
  const origin = req.get("origin") || "";

  // ChatGPT uses "openai-mcp" in User-Agent
  if (userAgent.includes("openai-mcp") ||
      origin.includes("chatgpt.com") ||
      origin.includes("chat.openai.com")) {
    return "chatgpt";
  }

  return "standard";
}

// Helper to format profiles as markdown for non-ChatGPT hosts
function formatProfilesAsMarkdown(profiles: any[], query: string, totalCount: number, summary: string): string {
  let markdown = `## Influencer Search Results\n\n`;
  markdown += `**Query:** ${query}\n`;
  markdown += `**Total Found:** ${totalCount}\n`;
  markdown += `**Summary:** ${summary}\n\n`;
  markdown += `---\n\n`;

  profiles.forEach((profile, index) => {
    markdown += `### ${index + 1}. ${profile.full_name || profile.username}\n`;
    markdown += `- **Username:** @${profile.username}\n`;
    markdown += `- **Followers:** ${profile.followed_by?.toLocaleString() || "N/A"}\n`;
    markdown += `- **Engagement Rate:** ${profile.engagement_rate || "N/A"}${profile.engagement_rate_tag ? ` (${profile.engagement_rate_tag})` : ""}\n`;

    // Profile image
    if (profile.profile_pic_url) {
      markdown += `- **Profile Image:** ${profile.profile_pic_url}\n`;
    }

    // Marketing core information
    if (profile.collaboration_tier) {
      markdown += `- **Collaboration Tier:** ${profile.collaboration_tier}\n`;
    }
    if (profile.account_type) {
      markdown += `- **Account Type:** ${profile.account_type}\n`;
    }
    if (profile.willing_to_collaborate !== undefined) {
      markdown += `- **Willing to Collaborate:** ${profile.willing_to_collaborate ? "Yes" : "No"}\n`;
    }
    if (profile.collaborate_brand?.length > 0) {
      markdown += `- **Past Brand Collaborations:** ${profile.collaborate_brand.slice(0, 5).join(", ")}${profile.collaborate_brand.length > 5 ? "..." : ""}\n`;
    }
    if (profile.tag_brand?.length > 0) {
      markdown += `- **Tagged Brands:** ${profile.tag_brand.slice(0, 5).join(", ")}${profile.tag_brand.length > 5 ? "..." : ""}\n`;
    }
    if (profile.note_for_brand_collaborate_point?.length > 0) {
      markdown += `- **Collaboration Strengths:** ${profile.note_for_brand_collaborate_point.join(", ")}\n`;
    }
    if (profile.note_for_brand_weak_point?.length > 0) {
      markdown += `- **Collaboration Weaknesses:** ${profile.note_for_brand_weak_point.join(", ")}\n`;
    }

    // Demographics & target
    if (profile.country?.length > 0) {
      markdown += `- **Country:** ${profile.country.join(", ")}\n`;
    }
    if (profile.language?.length > 0) {
      markdown += `- **Language:** ${profile.language.join(", ")}\n`;
    }
    if (profile.age_range) {
      markdown += `- **Age Range:** ${profile.age_range}\n`;
    }
    if (profile.field_of_creator?.length > 0) {
      markdown += `- **Field:** ${profile.field_of_creator.join(", ")}\n`;
    }
    if (profile.interests?.length > 0) {
      markdown += `- **Interests:** ${profile.interests.slice(0, 10).join(", ")}${profile.interests.length > 10 ? "..." : ""}\n`;
    }
    if (profile.demo_short) {
      markdown += `- **Summary:** ${profile.demo_short}\n`;
    }

    // Biography (at the end)
    if (profile.biography) {
      markdown += `- **Bio:** ${profile.biography.substring(0, 200)}${profile.biography.length > 200 ? "..." : ""}\n`;
    }

    markdown += `\n`;
  });

  return markdown;
}

// Tool usage guidelines for ChatGPT
const TOOL_USAGE_GUIDELINES = `## Tool Usage Guidelines
When the user asks you to search for influencers:

### CRITICAL: Single vs Multiple Searches
When the user asks for influencers from MULTIPLE countries/regions/categories that need to be COMPARED or ANALYZED SEPARATELY:
- ⚠️ **YOU MUST MAKE SEPARATE TOOL CALLS** - one for each country/region/category
- ⚠️ **DO NOT combine them into one search query**
- ⚠️ **Each tool call should target ONE specific country/region/category**

This applies to:
  - **Geographic regions**: "Vietnam and Malaysia", "Thailand and Vietnam", "6 Southeast Asian countries"
  - **Multiple platforms**: "Instagram and TikTok influencers separately"
  - **Different categories**: "beauty and fashion influencers" (when user wants separate comparison)
  - **Multiple audience segments**: "Gen Z and Millennial influencers"
  - **Different tiers**: "micro and macro influencers" (when user wants distinction)

**MANDATORY: Examples of Multiple Tool Calls**:
- "태국과 베트남의 뷰티 인플루언서" → MUST call TWICE:
  1. search_influencers(query="beauty influencers in Thailand with 50k-100k followers")
  2. search_influencers(query="beauty influencers in Vietnam with 50k-100k followers")

- "동남아 주요 6개국가의 뷰티 인플루언서" → MUST call 6 TIMES (Thailand, Vietnam, Indonesia, Philippines, Malaysia, Singapore)

- "Instagram과 TikTok 패션 인플루언서" → MUST call TWICE (Instagram, then TikTok)

**Single Search (Only When User Wants Combined Results)**:
- "베트남 또는 말레이시아의 뷰티 인플루언서" → Call once: "beauty influencers in Vietnam or Malaysia"
- "동남아시아 지역의 패션 인플루언서" (not asking to compare countries) → Call once

**Why Separate Tool Calls Are REQUIRED**:
- Each search appears in a separate carousel for easy comparison
- Better organized results per country/category
- More accurate filtering and analysis

### Query Formatting
- Use the user's EXACT wording and intent for each search
- Do NOT add criteria the user didn't explicitly request (like "top creators", "include follower count", "platform tags", etc.)
- Only add search terms that the user specifically mentioned
- Keep queries simple and focused`;

// Register UI resource
server.registerResource(
  "widget",
  "ui://widget/carousel.html",
  {},
  async () => ({
    contents: [
      {
        uri: "ui://widget/carousel.html",
        mimeType: "text/html+skybridge",
        text: `
<div id="root"></div>
<style>${COMPONENT_CSS}</style>
<script type="module">${COMPONENT_JS}</script>
      `.trim(),
        _meta: {
          "openai/widgetDescription":
            "Displays influencer profiles in carousel format",
          "openai/widgetPrefersBorder": true,
          "openai/widgetDomain": "https://whotag.ai",
          "openai/widgetCSP": {
            connect_domains: ["https://dev.whotag.ai", "https://cdn.whotag.ai"],
            resource_domains: [
              "https://cdn.whotag.ai",
              "https://*.oaistatic.com",
            ],
          },
        },
      },
    ],
  })
);

// Register tool usage guidelines resource
server.registerResource(
  "instructions",
  "ui://instructions/tool-guidelines.txt",
  {},
  async () => ({
    contents: [
      {
        uri: "ui://instructions/tool-guidelines.txt",
        mimeType: "text/plain",
        text: TOOL_USAGE_GUIDELINES,
      },
    ],
  })
);

// Tool description with usage guidelines
const SEARCH_TOOL_DESCRIPTION = `Search influencers using natural language query.

CRITICAL: When user wants to COMPARE or ANALYZE influencers from MULTIPLE distinct groups SEPARATELY, you MUST make SEPARATE tool calls for each:
- "베트남과 태국 뷰티 인플루언서" → Call TWICE: once for Vietnam, once for Thailand
- "동남아 6개국 인플루언서" → Call 6 TIMES (one per country)
- "Instagram과 TikTok 인플루언서" → Call TWICE (one per platform)
- "20대와 40대 인플루언서" → Call TWICE (one per age group)
- "뷰티와 패션 인플루언서" → Call TWICE (one per category)

Only combine into ONE call when user explicitly wants mixed results (e.g., "베트남 또는 태국" with "또는/or").

Each separate call creates its own carousel for easy comparison.`;

// Register search tool
server.registerTool(
  "search_influencers",
  {
    title: "Search Influencers",
    description: SEARCH_TOOL_DESCRIPTION,
    inputSchema: {
      query: z
        .string()
        .describe(
          "Natural language search query for ONE specific country/region/category (e.g., 'beauty influencers in Vietnam')"
        ),
      limit: z
        .number()
        .min(1)
        .max(100)
        .default(100)
        .optional()
        .describe("Maximum number of results (max 100)"),
    },
    _meta: {
      "openai/outputTemplate": "ui://widget/carousel.html",
      "openai/widgetAccessible": true,
      "openai/toolInvocation/invoking": "Searching for influencers...",
      "openai/toolInvocation/invoked": "Loaded influencer profiles",
    },
  },
  async (args) => {
    try {
      console.error(`\n\n========================================`);
      console.error(`🔍 NEW SEARCH REQUEST: "${args.query}"`);
      console.error(`Limit: ${args.limit || 100}`);
      console.error(`========================================\n`);

      // 1. Natural language search
      const searchResults = await searchInfluencers(args.query);

      // When no search results found
      if (
        !searchResults.item.influencers ||
        searchResults.item.influencers.length === 0
      ) {
        return {
          content: [
            {
              type: "text",
              text: "No search results found. Please try a different query.",
            },
          ],
        };
      }

      // 2. Fetch details (apply limit - max 100)
      const limitValue = Math.min(args.limit || 100, 100);
      const userIds = searchResults.item.influencers.slice(0, limitValue);
      const profiles = await getInfluencerBatch(userIds);

      // 3. Fetch representative and grid images in parallel
      const profilesWithImages = await Promise.all(
        profiles.map(async (profile) => {
          try {
            console.error(
              `\n=== FETCHING IMAGES FOR ${profile.profile.username} ===`
            );
            const [representativeImages, gridImages] = await Promise.all([
              getRepresentativeImages(profile.profile.user_id),
              getGridImages(profile.profile.user_id),
            ]);

            console.error(`Representative images:`, representativeImages);
            console.error(`Grid images:`, gridImages);
            console.error(
              `Grid images URLs:`,
              gridImages.map((img) => img.image_url)
            );

            const result = {
              user_id: profile.profile.user_id,
              username: profile.profile.username,
              full_name: profile.profile.full_name,
              title:
                profile.general?.title || profile.general?.demo_short || "",
              followed_by: profile.profile.followed_by,
              follows: profile.profile.follows,
              media_count: profile.profile.media_count,
              primaryImage:
                representativeImages[0]?.image_url ||
                profile.profile.profile_pic_url,
              gridImages: gridImages.map((img) => img.image_url),
              links: profile.links?.links || [],
              country: profile.general?.country || [],
              // Additional marketing information
              biography: profile.profile.biography,
              engagement_rate: profile.profile.engagement_rate,
              engagement_rate_tag: profile.profile.engagement_rate_tag,
              collaboration_tier: profile.general?.collaboration_tier,
              collaborate_brand: profile.general?.collaborate_brand || [],
              account_type: profile.general?.account_type,
              willing_to_collaborate: profile.general?.willing_to_collaborate,
              note_for_brand_collaborate_point:
                profile.general?.note_for_brand_collaborate_point || [],
              note_for_brand_weak_point:
                profile.general?.note_for_brand_weak_point || [],
              tag_brand: profile.general?.tag_brand || [],
              language: profile.general?.language || [],
              age_range: profile.general?.age_range,
              interests: profile.general?.interests || [],
              field_of_creator: profile.general?.field_of_creator || [],
              demo_short: profile.general?.demo_short,
              profile_pic_url: profile.profile.profile_pic_url,
            };

            console.error(
              `Final profile result:`,
              JSON.stringify(result, null, 2)
            );
            console.error(`===================================\n`);

            return result;
          } catch (error) {
            console.error(
              `Failed to fetch images for ${profile.profile.username}:`,
              error
            );
            return {
              user_id: profile.profile.user_id,
              username: profile.profile.username,
              full_name: profile.profile.full_name,
              title:
                profile.general?.title || profile.general?.demo_short || "",
              followed_by: profile.profile.followed_by,
              follows: profile.profile.follows,
              media_count: profile.profile.media_count,
              primaryImage: profile.profile.profile_pic_url,
              gridImages: [],
              links: profile.links?.links || [],
              country: profile.general?.country || [],
              // Additional marketing information
              biography: profile.profile.biography,
              engagement_rate: profile.profile.engagement_rate,
              engagement_rate_tag: profile.profile.engagement_rate_tag,
              collaboration_tier: profile.general?.collaboration_tier,
              collaborate_brand: profile.general?.collaborate_brand || [],
              account_type: profile.general?.account_type,
              willing_to_collaborate: profile.general?.willing_to_collaborate,
              note_for_brand_collaborate_point:
                profile.general?.note_for_brand_collaborate_point || [],
              note_for_brand_weak_point:
                profile.general?.note_for_brand_weak_point || [],
              tag_brand: profile.general?.tag_brand || [],
              language: profile.general?.language || [],
              age_range: profile.general?.age_range,
              interests: profile.general?.interests || [],
              field_of_creator: profile.general?.field_of_creator || [],
              demo_short: profile.general?.demo_short,
              profile_pic_url: profile.profile.profile_pic_url,
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
        note_for_brand_collaborate_point:
          profile.general?.note_for_brand_collaborate_point || [],
        note_for_brand_weak_point:
          profile.general?.note_for_brand_weak_point || [],
        tag_brand: profile.general?.tag_brand || [],

        // Demographics & target (6 items)
        country: profile.general?.country || [],
        language: profile.general?.language || [],
        age_range: profile.general?.age_range,
        interests: profile.general?.interests || [],
        field_of_creator: profile.general?.field_of_creator || [],
        demo_short: profile.general?.demo_short,
      }));

      // 4. Return results based on host type
      console.error(`Returning results for host type: ${currentSessionHostType}`);

      if (currentSessionHostType === "chatgpt") {
        // ChatGPT: Return rich response with UI widget
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
              type: "text",
              text: `Found ${searchResults.item.total_count} influencers for "${args.query}".`,
            },
          ],
          _meta: {
            "openai/outputTemplate": "ui://widget/carousel.html",
            "openai/widgetAccessible": true,
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
      } else {
        // Standard MCP hosts (Claude, Cursor, etc.): Return markdown content only
        const markdownContent = formatProfilesAsMarkdown(
          detailedProfiles,
          args.query,
          searchResults.item.total_count,
          searchResults.item.search_summary
        );

        return {
          content: [
            {
              type: "text",
              text: markdownContent,
            },
          ],
        };
      }
    } catch (error) {
      console.error("Search error:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text",
            text: `An error occurred during search: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Register analyze_hashtag_trends tool
server.registerTool(
  "analyze_hashtag_trends",
  {
    title: "Analyze Hashtag Trends",
    description:
      "Analyze hashtag trends used by influencers. Returns trending hashtags with usage counts and a downloadable CSV file. Example: 'What are the trending hashtags among Vietnamese beauty influencers?'",
    inputSchema: {
      country: z
        .string()
        .optional()
        .describe(
          "Country code (ISO 3166-1 Alpha-2). Examples: KR (Korea), US (USA), VN (Vietnam), JP (Japan), TH (Thailand), ID (Indonesia)"
        ),
      interests: z
        .array(z.enum([
          "Fashion & Style", "Accessories & Jewelry", "Beauty", "Hair Care",
          "Food Culture", "Meals", "Beverages", "Alcoholic Beverages", "Snacks & Desserts",
          "Travel & Leisure", "Relationships & Emotions",
          "Fitness", "Ball Sports", "Outdoor Sports", "Indoor Sports", "Sports Events",
          "Wellness", "Healthcare", "Child Care & Parenting", "Pets",
          "Household Management", "Interior & Decor",
          "Photography", "Visual Arts", "Performing Arts", "Music", "Literature & Writing",
          "Media & Entertainment", "New Media", "Crafts", "Fan Culture", "Games",
          "Personal Development", "Academic Studies", "Student Life",
          "Business & Marketing", "Startups & Small Business", "Personal Finance",
          "Automotive", "Technology & Innovation", "Consumer Electronics",
          "Values & Human Rights", "Environment & Sustainability", "Community Engagement",
          "Religion & Politics", "Shopping & Deals", "Other"
        ]))
        .optional()
        .describe(
          "Interest categories to filter (multiple selection allowed)"
        ),
      days: z
        .number()
        .min(1)
        .max(365)
        .default(30)
        .optional()
        .describe("Number of days to analyze (default: 30, max: 365)"),
      limit: z
        .number()
        .min(1)
        .max(500)
        .default(100)
        .optional()
        .describe("Maximum number of hashtags to return (default: 100)"),
      gender: z
        .enum(["Male", "Female", "Unknown"])
        .optional()
        .describe("Filter by gender"),
      age_range: z
        .array(z.enum([
          "0~4", "5~9", "10~14", "15~19", "20~24", "25~29", "30~34", "35~39",
          "40~44", "45~49", "50~54", "55~59", "60~64", "65~69", "70+", "Unknown"
        ]))
        .optional()
        .describe(
          "Filter by age range(s). Example for 20s: [\"20~24\", \"25~29\"]"
        ),
      ethnic_category: z
        .enum([
          "Asian", "East Asian", "Southeast Asian", "South Asian",
          "Caucasian", "African", "Hispanic/Latino",
          "Middle Eastern/North African (MENA)", "Pacific Islander",
          "Indigenous Peoples", "Mixed Race", "Unknown"
        ])
        .optional()
        .describe("Filter by ethnic category"),
    },
    _meta: {
      "openai/toolInvocation/invoking": "Analyzing hashtag trends...",
      "openai/toolInvocation/invoked": "Hashtag trend analysis complete",
    },
  },
  async (args) => {
    try {
      console.error("=== ANALYZE_HASHTAG_TRENDS (SSE) ===");
      const result = await analyzeHashtagTrends({
        country: args.country,
        interests: args.interests,
        days: args.days || 30,
        limit: args.limit || 100,
        gender: args.gender,
        age_range: args.age_range,
        ethnic_category: args.ethnic_category,
      });

      if (!result.success) {
        return {
          content: [
            {
              type: "text",
              text: `Analysis failed: ${result.error}`,
            },
          ],
          isError: true,
        };
      }

      // Format as markdown for standard MCP clients
      let markdown = `## Hashtag Trend Analysis\n\n`;
      markdown += `**Description:** ${result.description}\n`;
      markdown += `**Total Hashtags:** ${result.totalRows}\n`;
      markdown += `**Download CSV:** ${result.downloadUrl}\n\n`;
      markdown += `---\n\n`;
      markdown += `### Top 50 Hashtags\n\n`;

      const topData = result.data.slice(0, 50);
      topData.forEach((row: any, index: number) => {
        markdown += `${index + 1}. **#${row.hashtag || row.tag}** - ${row.count || row.usage_count || "N/A"} uses\n`;
      });

      if (currentSessionHostType === "chatgpt") {
        return {
          structuredContent: {
            analysis: {
              type: "hashtag_trends",
              description: result.description,
              totalHashtags: result.totalRows,
              queryExecuted: result.query,
            },
            data: topData,
            downloadUrl: result.downloadUrl,
          },
          content: [
            {
              type: "text",
              text: `Hashtag trend analysis complete. Found ${result.totalRows} hashtags.\n\n**📥 Download Full Data (CSV):** ${result.downloadUrl}`,
            },
          ],
          _meta: {
            downloadUrl: result.downloadUrl,
            totalRows: result.totalRows,
          },
        };
      } else {
        return {
          content: [
            {
              type: "text",
              text: markdown,
            },
          ],
        };
      }
    } catch (error) {
      console.error("Hashtag analysis error:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text",
            text: `An error occurred during analysis: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Register analyze_content_stats tool
server.registerTool(
  "analyze_content_stats",
  {
    title: "Analyze Content Stats",
    description:
      "Get engagement statistics (likes, comments, posts) for influencer groups. Returns aggregated metrics and a downloadable CSV. Example: 'What is the average engagement for Korean fashion influencers?'",
    inputSchema: {
      country: z
        .string()
        .optional()
        .describe(
          "Country code (ISO 3166-1 Alpha-2). Examples: KR, US, VN, JP, TH, ID"
        ),
      interests: z
        .array(z.enum([
          "Fashion & Style", "Accessories & Jewelry", "Beauty", "Hair Care",
          "Food Culture", "Meals", "Beverages", "Alcoholic Beverages", "Snacks & Desserts",
          "Travel & Leisure", "Relationships & Emotions",
          "Fitness", "Ball Sports", "Outdoor Sports", "Indoor Sports", "Sports Events",
          "Wellness", "Healthcare", "Child Care & Parenting", "Pets",
          "Household Management", "Interior & Decor",
          "Photography", "Visual Arts", "Performing Arts", "Music", "Literature & Writing",
          "Media & Entertainment", "New Media", "Crafts", "Fan Culture", "Games",
          "Personal Development", "Academic Studies", "Student Life",
          "Business & Marketing", "Startups & Small Business", "Personal Finance",
          "Automotive", "Technology & Innovation", "Consumer Electronics",
          "Values & Human Rights", "Environment & Sustainability", "Community Engagement",
          "Religion & Politics", "Shopping & Deals", "Other"
        ]))
        .optional()
        .describe(
          "Interest categories to filter (multiple selection allowed)"
        ),
      days: z
        .number()
        .min(1)
        .max(365)
        .default(30)
        .optional()
        .describe("Number of days to analyze (default: 30, max: 365)"),
      gender: z
        .enum(["Male", "Female", "Unknown"])
        .optional()
        .describe("Filter by gender"),
      age_range: z
        .array(z.enum([
          "0~4", "5~9", "10~14", "15~19", "20~24", "25~29", "30~34", "35~39",
          "40~44", "45~49", "50~54", "55~59", "60~64", "65~69", "70+", "Unknown"
        ]))
        .optional()
        .describe(
          "Filter by age range(s). Example for 20s: [\"20~24\", \"25~29\"]"
        ),
      ethnic_category: z
        .enum([
          "Asian", "East Asian", "Southeast Asian", "South Asian",
          "Caucasian", "African", "Hispanic/Latino",
          "Middle Eastern/North African (MENA)", "Pacific Islander",
          "Indigenous Peoples", "Mixed Race", "Unknown"
        ])
        .optional()
        .describe("Filter by ethnic category"),
    },
    _meta: {
      "openai/toolInvocation/invoking": "Analyzing content statistics...",
      "openai/toolInvocation/invoked": "Content statistics ready",
    },
  },
  async (args) => {
    try {
      console.error("=== ANALYZE_CONTENT_STATS (SSE) ===");
      const result = await analyzeContentStats({
        country: args.country,
        interests: args.interests,
        days: args.days || 30,
        gender: args.gender,
        age_range: args.age_range,
        ethnic_category: args.ethnic_category,
      });

      if (!result.success) {
        return {
          content: [
            {
              type: "text",
              text: `Analysis failed: ${result.error}`,
            },
          ],
          isError: true,
        };
      }

      // Format as markdown for standard MCP clients
      let markdown = `## Content Statistics Analysis\n\n`;
      markdown += `**Description:** ${result.description}\n`;
      markdown += `**Download CSV:** ${result.downloadUrl}\n\n`;
      markdown += `---\n\n`;
      markdown += `### Statistics\n\n`;

      result.data.forEach((row: any) => {
        Object.entries(row).forEach(([key, value]) => {
          markdown += `- **${key}:** ${value}\n`;
        });
        markdown += `\n`;
      });

      if (currentSessionHostType === "chatgpt") {
        return {
          structuredContent: {
            analysis: {
              type: "content_stats",
              description: result.description,
              queryExecuted: result.query,
            },
            data: result.data,
            downloadUrl: result.downloadUrl,
          },
          content: [
            {
              type: "text",
              text: `Content statistics analysis complete.\n\n**📥 Download Full Data (CSV):** ${result.downloadUrl}`,
            },
          ],
          _meta: {
            downloadUrl: result.downloadUrl,
            totalRows: result.totalRows,
          },
        };
      } else {
        return {
          content: [
            {
              type: "text",
              text: markdown,
            },
          ],
        };
      }
    } catch (error) {
      console.error("Content stats error:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text",
            text: `An error occurred during analysis: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Register find_trending_topics tool
server.registerTool(
  "find_trending_topics",
  {
    title: "Find Trending Topics",
    description:
      "Discover trending/rising topics in a specific field. Identifies hashtags with significant growth. Example: 'What topics are trending in the beauty industry this month?'",
    inputSchema: {
      field: z
        .enum([
          "Fashion & Style", "Accessories & Jewelry", "Beauty", "Hair Care",
          "Food Culture", "Meals", "Beverages", "Alcoholic Beverages", "Snacks & Desserts",
          "Travel & Leisure", "Relationships & Emotions",
          "Fitness", "Ball Sports", "Outdoor Sports", "Indoor Sports", "Sports Events",
          "Wellness", "Healthcare", "Child Care & Parenting", "Pets",
          "Household Management", "Interior & Decor",
          "Photography", "Visual Arts", "Performing Arts", "Music", "Literature & Writing",
          "Media & Entertainment", "New Media", "Crafts", "Fan Culture", "Games",
          "Personal Development", "Academic Studies", "Student Life",
          "Business & Marketing", "Startups & Small Business", "Personal Finance",
          "Automotive", "Technology & Innovation", "Consumer Electronics",
          "Values & Human Rights", "Environment & Sustainability", "Community Engagement",
          "Religion & Politics", "Shopping & Deals", "Other"
        ])
        .default("Beauty")
        .optional()
        .describe("Field/category to analyze"),
      days: z
        .number()
        .min(1)
        .max(365)
        .default(30)
        .optional()
        .describe("Number of days to analyze (default: 30, max: 365)"),
      limit: z
        .number()
        .min(1)
        .max(200)
        .default(50)
        .optional()
        .describe("Number of trending topics to return (default: 50)"),
      gender: z
        .enum(["Male", "Female", "Unknown"])
        .optional()
        .describe("Filter by gender"),
      age_range: z
        .array(z.enum([
          "0~4", "5~9", "10~14", "15~19", "20~24", "25~29", "30~34", "35~39",
          "40~44", "45~49", "50~54", "55~59", "60~64", "65~69", "70+", "Unknown"
        ]))
        .optional()
        .describe(
          "Filter by age range(s). Example for 20s: [\"20~24\", \"25~29\"]"
        ),
      ethnic_category: z
        .enum([
          "Asian", "East Asian", "Southeast Asian", "South Asian",
          "Caucasian", "African", "Hispanic/Latino",
          "Middle Eastern/North African (MENA)", "Pacific Islander",
          "Indigenous Peoples", "Mixed Race", "Unknown"
        ])
        .optional()
        .describe("Filter by ethnic category"),
    },
    _meta: {
      "openai/toolInvocation/invoking": "Finding trending topics...",
      "openai/toolInvocation/invoked": "Trending topics identified",
    },
  },
  async (args) => {
    try {
      console.error("=== FIND_TRENDING_TOPICS (SSE) ===");
      const result = await findTrendingTopics({
        field: args.field || "Beauty",
        days: args.days || 30,
        limit: args.limit || 50,
        gender: args.gender,
        age_range: args.age_range,
        ethnic_category: args.ethnic_category,
      });

      if (!result.success) {
        return {
          content: [
            {
              type: "text",
              text: `Analysis failed: ${result.error}`,
            },
          ],
          isError: true,
        };
      }

      // Format as markdown for standard MCP clients
      let markdown = `## Trending Topics Analysis\n\n`;
      markdown += `**Field:** ${args.field || "Beauty"}\n`;
      markdown += `**Description:** ${result.description}\n`;
      markdown += `**Total Topics:** ${result.totalRows}\n`;
      markdown += `**Download CSV:** ${result.downloadUrl}\n\n`;
      markdown += `---\n\n`;
      markdown += `### Trending Topics\n\n`;

      result.data.forEach((row: any, index: number) => {
        const growth = row.growth_rate ? ` (↑${row.growth_rate}%)` : "";
        markdown += `${index + 1}. **#${row.hashtag || row.topic}**${growth}\n`;
      });

      if (currentSessionHostType === "chatgpt") {
        return {
          structuredContent: {
            analysis: {
              type: "trending_topics",
              description: result.description,
              field: args.field || "Beauty",
              queryExecuted: result.query,
            },
            data: result.data,
            downloadUrl: result.downloadUrl,
          },
          content: [
            {
              type: "text",
              text: `Trending topics analysis complete. Found ${result.totalRows} trending topics.\n\n**📥 Download Full Data (CSV):** ${result.downloadUrl}`,
            },
          ],
          _meta: {
            downloadUrl: result.downloadUrl,
            totalRows: result.totalRows,
          },
        };
      } else {
        return {
          content: [
            {
              type: "text",
              text: markdown,
            },
          ],
        };
      }
    } catch (error) {
      console.error("Trending topics error:", error);
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: "text",
            text: `An error occurred during analysis: ${errorMessage}`,
          },
        ],
        isError: true,
      };
    }
  }
);

// Health check
app.get("/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// MCP manifest endpoint (GET) - ChatGPT Apps discovery
app.get("/mcp", (req, res) => {
  const serverUrl = getServerUrl(req);
  console.error("GET /mcp - returning discovery document");
  console.error(`Server URL: ${serverUrl}`);
  res.json({
    openapi: "3.1.0",
    info: {
      title: "Influencer Search MCP",
      version: "1.0.0",
      description: "MCP server for influencer search",
    },
    servers: [
      {
        url: serverUrl,
      },
    ],
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

// MCP manifest endpoint (POST) - ChatGPT sends JSON-RPC requests
app.post("/mcp", async (req, res) => {
  console.error("POST /mcp body:", JSON.stringify(req.body, null, 2));

  const { method, id, params } = req.body;

  try {
    switch (method) {
      case "initialize":
        console.error("Received initialize request");
        res.json({
          jsonrpc: "2.0",
          id: id,
          result: {
            protocolVersion: params?.protocolVersion || "2025-03-26",
            serverInfo: {
              name: "influencer-search",
              version: "1.0.0",
            },
            capabilities: {
              tools: {},
              resources: {},
            },
          },
        });
        break;

      case "notifications/initialized":
        console.error("Received initialized notification");
        // Notifications don't require a response
        res.status(200).end();
        break;

      case "tools/list":
        console.error("Received tools/list request");
        res.json({
          jsonrpc: "2.0",
          id: id,
          result: {
            tools: [
              {
                name: "search_influencers",
                description: SEARCH_TOOL_DESCRIPTION,
                inputSchema: {
                  type: "object",
                  properties: {
                    query: {
                      type: "string",
                      description:
                        "Natural language search query for ONE specific country/region/category (e.g., 'beauty influencers in Vietnam')",
                    },
                    limit: {
                      type: "number",
                      description: "Maximum number of results (max 100)",
                      default: 100,
                      minimum: 0,
                      maximum: 100,
                    },
                  },
                  required: ["query"],
                },
                _meta: {
                  "openai/outputTemplate": "ui://widget/carousel.html",
                  "openai/widgetAccessible": true,
                  "openai/toolInvocation/invoking":
                    "Searching for influencers...",
                  "openai/toolInvocation/invoked": "Loaded influencer profiles",
                },
              },
              {
                name: "analyze_hashtag_trends",
                description:
                  "Analyze hashtag trends used by influencers. Returns trending hashtags with usage counts and a downloadable CSV file. Example: 'What are the trending hashtags among Vietnamese beauty influencers?'",
                inputSchema: {
                  type: "object",
                  properties: {
                    country: {
                      type: "string",
                      description:
                        "Country code (ISO 3166-1 Alpha-2). Examples: KR (Korea), US (USA), VN (Vietnam), JP (Japan), TH (Thailand), ID (Indonesia)",
                    },
                    interests: {
                      type: "array",
                      items: {
                        type: "string",
                        enum: [
                          "Fashion & Style", "Accessories & Jewelry", "Beauty", "Hair Care",
                          "Food Culture", "Meals", "Beverages", "Alcoholic Beverages", "Snacks & Desserts",
                          "Travel & Leisure", "Relationships & Emotions",
                          "Fitness", "Ball Sports", "Outdoor Sports", "Indoor Sports", "Sports Events",
                          "Wellness", "Healthcare", "Child Care & Parenting", "Pets",
                          "Household Management", "Interior & Decor",
                          "Photography", "Visual Arts", "Performing Arts", "Music", "Literature & Writing",
                          "Media & Entertainment", "New Media", "Crafts", "Fan Culture", "Games",
                          "Personal Development", "Academic Studies", "Student Life",
                          "Business & Marketing", "Startups & Small Business", "Personal Finance",
                          "Automotive", "Technology & Innovation", "Consumer Electronics",
                          "Values & Human Rights", "Environment & Sustainability", "Community Engagement",
                          "Religion & Politics", "Shopping & Deals", "Other"
                        ],
                      },
                      description:
                        "Interest categories to filter (multiple selection allowed)",
                    },
                    days: {
                      type: "number",
                      description: "Number of days to analyze (default: 30, max: 365)",
                      default: 30,
                    },
                    limit: {
                      type: "number",
                      description: "Maximum number of hashtags to return (default: 100)",
                      default: 100,
                    },
                    gender: {
                      type: "string",
                      description: "Filter by gender. Values: Male, Female, Unknown",
                      enum: ["Male", "Female", "Unknown"],
                    },
                    age_range: {
                      type: "array",
                      items: {
                        type: "string",
                        enum: [
                          "0~4", "5~9", "10~14", "15~19", "20~24", "25~29", "30~34", "35~39",
                          "40~44", "45~49", "50~54", "55~59", "60~64", "65~69", "70+", "Unknown"
                        ],
                      },
                      description: "Filter by age range(s). Example for 20s: [\"20~24\", \"25~29\"]",
                    },
                    ethnic_category: {
                      type: "string",
                      description: "Filter by ethnic category",
                      enum: [
                        "Asian", "East Asian", "Southeast Asian", "South Asian",
                        "Caucasian", "African", "Hispanic/Latino",
                        "Middle Eastern/North African (MENA)", "Pacific Islander",
                        "Indigenous Peoples", "Mixed Race", "Unknown"
                      ],
                    },
                  },
                },
                _meta: {
                  "openai/toolInvocation/invoking": "Analyzing hashtag trends...",
                  "openai/toolInvocation/invoked": "Hashtag trend analysis complete",
                },
              },
              {
                name: "analyze_content_stats",
                description:
                  "Get engagement statistics (likes, comments, posts) for influencer groups. Returns aggregated metrics and a downloadable CSV. Example: 'What is the average engagement for Korean fashion influencers?'",
                inputSchema: {
                  type: "object",
                  properties: {
                    country: {
                      type: "string",
                      description:
                        "Country code (ISO 3166-1 Alpha-2). Examples: KR, US, VN, JP, TH, ID",
                    },
                    interests: {
                      type: "array",
                      items: {
                        type: "string",
                        enum: [
                          "Fashion & Style", "Accessories & Jewelry", "Beauty", "Hair Care",
                          "Food Culture", "Meals", "Beverages", "Alcoholic Beverages", "Snacks & Desserts",
                          "Travel & Leisure", "Relationships & Emotions",
                          "Fitness", "Ball Sports", "Outdoor Sports", "Indoor Sports", "Sports Events",
                          "Wellness", "Healthcare", "Child Care & Parenting", "Pets",
                          "Household Management", "Interior & Decor",
                          "Photography", "Visual Arts", "Performing Arts", "Music", "Literature & Writing",
                          "Media & Entertainment", "New Media", "Crafts", "Fan Culture", "Games",
                          "Personal Development", "Academic Studies", "Student Life",
                          "Business & Marketing", "Startups & Small Business", "Personal Finance",
                          "Automotive", "Technology & Innovation", "Consumer Electronics",
                          "Values & Human Rights", "Environment & Sustainability", "Community Engagement",
                          "Religion & Politics", "Shopping & Deals", "Other"
                        ],
                      },
                      description:
                        "Interest categories to filter (multiple selection allowed)",
                    },
                    days: {
                      type: "number",
                      description: "Number of days to analyze (default: 30, max: 365)",
                      default: 30,
                    },
                    gender: {
                      type: "string",
                      description: "Filter by gender. Values: Male, Female, Unknown",
                      enum: ["Male", "Female", "Unknown"],
                    },
                    age_range: {
                      type: "array",
                      items: {
                        type: "string",
                        enum: [
                          "0~4", "5~9", "10~14", "15~19", "20~24", "25~29", "30~34", "35~39",
                          "40~44", "45~49", "50~54", "55~59", "60~64", "65~69", "70+", "Unknown"
                        ],
                      },
                      description: "Filter by age range(s). Example for 20s: [\"20~24\", \"25~29\"]",
                    },
                    ethnic_category: {
                      type: "string",
                      description: "Filter by ethnic category",
                      enum: [
                        "Asian", "East Asian", "Southeast Asian", "South Asian",
                        "Caucasian", "African", "Hispanic/Latino",
                        "Middle Eastern/North African (MENA)", "Pacific Islander",
                        "Indigenous Peoples", "Mixed Race", "Unknown"
                      ],
                    },
                  },
                },
                _meta: {
                  "openai/toolInvocation/invoking": "Analyzing content statistics...",
                  "openai/toolInvocation/invoked": "Content statistics ready",
                },
              },
              {
                name: "find_trending_topics",
                description:
                  "Discover trending/rising topics in a specific field. Identifies hashtags with significant growth. Example: 'What topics are trending in the beauty industry this month?'",
                inputSchema: {
                  type: "object",
                  properties: {
                    field: {
                      type: "string",
                      description: "Field/category to analyze",
                      default: "Beauty",
                      enum: [
                        "Fashion & Style", "Accessories & Jewelry", "Beauty", "Hair Care",
                        "Food Culture", "Meals", "Beverages", "Alcoholic Beverages", "Snacks & Desserts",
                        "Travel & Leisure", "Relationships & Emotions",
                        "Fitness", "Ball Sports", "Outdoor Sports", "Indoor Sports", "Sports Events",
                        "Wellness", "Healthcare", "Child Care & Parenting", "Pets",
                        "Household Management", "Interior & Decor",
                        "Photography", "Visual Arts", "Performing Arts", "Music", "Literature & Writing",
                        "Media & Entertainment", "New Media", "Crafts", "Fan Culture", "Games",
                        "Personal Development", "Academic Studies", "Student Life",
                        "Business & Marketing", "Startups & Small Business", "Personal Finance",
                        "Automotive", "Technology & Innovation", "Consumer Electronics",
                        "Values & Human Rights", "Environment & Sustainability", "Community Engagement",
                        "Religion & Politics", "Shopping & Deals", "Other"
                      ],
                    },
                    days: {
                      type: "number",
                      description: "Number of days to analyze (default: 30, max: 365)",
                      default: 30,
                    },
                    limit: {
                      type: "number",
                      description: "Number of trending topics to return (default: 50)",
                      default: 50,
                    },
                    gender: {
                      type: "string",
                      description: "Filter by gender. Values: Male, Female, Unknown",
                      enum: ["Male", "Female", "Unknown"],
                    },
                    age_range: {
                      type: "array",
                      items: {
                        type: "string",
                        enum: [
                          "0~4", "5~9", "10~14", "15~19", "20~24", "25~29", "30~34", "35~39",
                          "40~44", "45~49", "50~54", "55~59", "60~64", "65~69", "70+", "Unknown"
                        ],
                      },
                      description: "Filter by age range(s). Example for 20s: [\"20~24\", \"25~29\"]",
                    },
                    ethnic_category: {
                      type: "string",
                      description: "Filter by ethnic category",
                      enum: [
                        "Asian", "East Asian", "Southeast Asian", "South Asian",
                        "Caucasian", "African", "Hispanic/Latino",
                        "Middle Eastern/North African (MENA)", "Pacific Islander",
                        "Indigenous Peoples", "Mixed Race", "Unknown"
                      ],
                    },
                  },
                },
                _meta: {
                  "openai/toolInvocation/invoking": "Finding trending topics...",
                  "openai/toolInvocation/invoked": "Trending topics identified",
                },
              },
            ],
          },
        });
        break;

      case "resources/list":
        console.error("Received resources/list request");
        res.json({
          jsonrpc: "2.0",
          id: id,
          result: {
            resources: [
              {
                uri: "ui://widget/carousel.html",
                name: "Influencer Carousel Widget",
                description: "Displays influencer profiles in carousel format",
                mimeType: "text/html+skybridge",
              },
              {
                uri: "ui://instructions/tool-guidelines.txt",
                name: "Tool Usage Guidelines",
                description: "Guidelines for using the search_influencers tool effectively",
                mimeType: "text/plain",
              },
            ],
          },
        });
        break;

      case "resources/read":
        console.error("=== RESOURCES/READ RECEIVED ===");
        console.error("Resource URI:", params?.uri);
        const resourceUri = params?.uri;

        if (resourceUri === "ui://widget/carousel.html") {
          res.json({
            jsonrpc: "2.0",
            id: id,
            result: {
              contents: [
                {
                  uri: "ui://widget/carousel.html",
                  mimeType: "text/html+skybridge",
                  text: `
<div id="root"></div>
<style>${COMPONENT_CSS}</style>
<script type="module">${COMPONENT_JS}</script>
                `.trim(),
                  _meta: {
                    "openai/widgetDescription":
                      "Displays influencer profiles in carousel format",
                    "openai/widgetPrefersBorder": true,
                    "openai/widgetDomain": "https://whotag.ai",
                    "openai/widgetCSP": {
                      connect_domains: [
                        "https://dev.whotag.ai",
                        "https://cdn.whotag.ai",
                      ],
                      resource_domains: [
                        "https://cdn.whotag.ai",
                        "https://*.oaistatic.com",
                      ],
                    },
                  },
                },
              ],
            },
          });
        } else if (resourceUri === "ui://instructions/tool-guidelines.txt") {
          res.json({
            jsonrpc: "2.0",
            id: id,
            result: {
              contents: [
                {
                  uri: "ui://instructions/tool-guidelines.txt",
                  mimeType: "text/plain",
                  text: TOOL_USAGE_GUIDELINES,
                },
              ],
            },
          });
        } else {
          res.json({
            jsonrpc: "2.0",
            id: id,
            error: {
              code: -32602,
              message: `Unknown resource: ${resourceUri}`,
            },
          });
        }
        break;

      case "tools/call":
        console.error("=== TOOLS/CALL RECEIVED ===");
        console.error("Tool name:", params?.name);
        console.error("Arguments:", JSON.stringify(params?.arguments, null, 2));
        const toolName = params?.name;
        const toolArgs = params?.arguments || {};

        if (toolName === "search_influencers") {
          // Call the actual search function
          try {
            const searchResults = await searchInfluencers(toolArgs.query);
            // Limit to max 100 for testing
            const limitValue = Math.min(toolArgs.limit || 100, 100);
            console.error(`Limit value: ${limitValue}`);
            console.error(
              `Total influencers found: ${searchResults.item.influencers.length}`
            );
            const userIds = searchResults.item.influencers.slice(0, limitValue);
            console.error(`User IDs to fetch: ${userIds.length}`);
            const profiles = await getInfluencerBatch(userIds);
            console.error(`Profiles fetched: ${profiles.length}`);

            const profilesWithImages = await Promise.all(
              profiles.map(async (profile) => {
                try {
                  console.error(
                    `\n>>> Fetching images for ${profile.profile.username}`
                  );
                  const [representativeImages, gridImages] = await Promise.all([
                    getRepresentativeImages(profile.profile.user_id),
                    getGridImages(profile.profile.user_id),
                  ]);
                  console.error(
                    `Representative images count: ${representativeImages.length}`
                  );
                  console.error(`Grid images count: ${gridImages.length}`);

                  const gridImageUrls = gridImages.map((img) => img.image_url);
                  console.error(`Grid image URLs:`, gridImageUrls);

                  return {
                    user_id: profile.profile.user_id,
                    username: profile.profile.username,
                    full_name: profile.profile.full_name,
                    title:
                      profile.general?.title ||
                      profile.general?.demo_short ||
                      "",
                    followed_by: profile.profile.followed_by,
                    follows: profile.profile.follows,
                    media_count: profile.profile.media_count,
                    primaryImage:
                      representativeImages[0]?.image_url ||
                      profile.profile.profile_pic_url,
                    gridImages: gridImageUrls,
                    links: profile.links?.links || [],
                    country: profile.general?.country || [],
                    // Additional marketing information
                    biography: profile.profile.biography,
                    engagement_rate: profile.profile.engagement_rate,
                    engagement_rate_tag: profile.profile.engagement_rate_tag,
                    collaboration_tier: profile.general?.collaboration_tier,
                    collaborate_brand: profile.general?.collaborate_brand || [],
                    account_type: profile.general?.account_type,
                    willing_to_collaborate:
                      profile.general?.willing_to_collaborate,
                    note_for_brand_collaborate_point:
                      profile.general?.note_for_brand_collaborate_point || [],
                    note_for_brand_weak_point:
                      profile.general?.note_for_brand_weak_point || [],
                    tag_brand: profile.general?.tag_brand || [],
                    language: profile.general?.language || [],
                    age_range: profile.general?.age_range,
                    interests: profile.general?.interests || [],
                    field_of_creator: profile.general?.field_of_creator || [],
                    demo_short: profile.general?.demo_short,
                    profile_pic_url: profile.profile.profile_pic_url,
                  };
                } catch (error) {
                  console.error(
                    `Failed to fetch images for ${profile.profile.username}:`,
                    error
                  );
                  return {
                    user_id: profile.profile.user_id,
                    username: profile.profile.username,
                    full_name: profile.profile.full_name,
                    title:
                      profile.general?.title ||
                      profile.general?.demo_short ||
                      "",
                    followed_by: profile.profile.followed_by,
                    follows: profile.profile.follows,
                    media_count: profile.profile.media_count,
                    primaryImage: profile.profile.profile_pic_url,
                    gridImages: [],
                    links: profile.links?.links || [],
                    country: profile.general?.country || [],
                    // Additional marketing information
                    biography: profile.profile.biography,
                    engagement_rate: profile.profile.engagement_rate,
                    engagement_rate_tag: profile.profile.engagement_rate_tag,
                    collaboration_tier: profile.general?.collaboration_tier,
                    collaborate_brand: profile.general?.collaborate_brand || [],
                    account_type: profile.general?.account_type,
                    willing_to_collaborate:
                      profile.general?.willing_to_collaborate,
                    note_for_brand_collaborate_point:
                      profile.general?.note_for_brand_collaborate_point || [],
                    note_for_brand_weak_point:
                      profile.general?.note_for_brand_weak_point || [],
                    tag_brand: profile.general?.tag_brand || [],
                    language: profile.general?.language || [],
                    age_range: profile.general?.age_range,
                    interests: profile.general?.interests || [],
                    field_of_creator: profile.general?.field_of_creator || [],
                    demo_short: profile.general?.demo_short,
                    profile_pic_url: profile.profile.profile_pic_url,
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
              note_for_brand_collaborate_point:
                profile.general?.note_for_brand_collaborate_point || [],
              note_for_brand_weak_point:
                profile.general?.note_for_brand_weak_point || [],
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
              jsonrpc: "2.0",
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
                    type: "text",
                    text: `Found ${searchResults.item.total_count} influencers. Search results for "${toolArgs.query}".`,
                  },
                ],
                _meta: {
                  "openai/outputTemplate": "ui://widget/carousel.html",
                  "openai/widgetAccessible": true,
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

            console.error("=== RESPONSE DEBUG ===");
            console.error(
              "Response structure:",
              JSON.stringify(
                {
                  hasContent: !!response.result.content,
                  contentLength: response.result.content.length,
                  contentTypes: response.result.content.map((c: any) => c.type),
                  hasMeta: !!response.result._meta,
                  hasOutputTemplate:
                    !!response.result._meta?.["openai/outputTemplate"],
                  outputTemplate:
                    response.result._meta?.["openai/outputTemplate"],
                  profilesCount:
                    response.result._meta?.allProfiles?.length || 0,
                },
                null,
                2
              )
            );
            console.error("=== END DEBUG ===");

            res.json(response);
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            res.json({
              jsonrpc: "2.0",
              id: id,
              error: {
                code: -32000,
                message: errorMessage,
              },
            });
          }
        } else if (toolName === "analyze_hashtag_trends") {
          // Hashtag trend analysis tool
          try {
            console.error("=== ANALYZE_HASHTAG_TRENDS ===");
            const result = await analyzeHashtagTrends({
              country: toolArgs.country,
              interests: toolArgs.interests,
              days: toolArgs.days || 30,
              limit: toolArgs.limit || 100,
            });

            if (!result.success) {
              res.json({
                jsonrpc: "2.0",
                id: id,
                error: {
                  code: -32000,
                  message: result.error || "Analysis failed",
                },
              });
              return;
            }

            // Limit data for GPT (top 50 for analysis)
            const topData = result.data.slice(0, 50);

            res.json({
              jsonrpc: "2.0",
              id: id,
              result: {
                structuredContent: {
                  analysis: {
                    type: "hashtag_trends",
                    description: result.description,
                    totalHashtags: result.totalRows,
                    queryExecuted: result.query,
                  },
                  data: topData,
                  downloadUrl: result.downloadUrl,
                },
                content: [
                  {
                    type: "text",
                    text: `Hashtag trend analysis complete. Found ${result.totalRows} hashtags.\n\n**📥 Download Full Data (CSV):** ${result.downloadUrl}`,
                  },
                ],
                _meta: {
                  downloadUrl: result.downloadUrl,
                  totalRows: result.totalRows,
                },
              },
            });
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            res.json({
              jsonrpc: "2.0",
              id: id,
              error: {
                code: -32000,
                message: errorMessage,
              },
            });
          }
        } else if (toolName === "analyze_content_stats") {
          // Content statistics analysis tool
          try {
            console.error("=== ANALYZE_CONTENT_STATS ===");
            const result = await analyzeContentStats({
              country: toolArgs.country,
              interests: toolArgs.interests,
              days: toolArgs.days || 30,
            });

            if (!result.success) {
              res.json({
                jsonrpc: "2.0",
                id: id,
                error: {
                  code: -32000,
                  message: result.error || "Analysis failed",
                },
              });
              return;
            }

            res.json({
              jsonrpc: "2.0",
              id: id,
              result: {
                structuredContent: {
                  analysis: {
                    type: "content_stats",
                    description: result.description,
                    queryExecuted: result.query,
                  },
                  data: result.data,
                  downloadUrl: result.downloadUrl,
                },
                content: [
                  {
                    type: "text",
                    text: `Content statistics analysis complete.\n\n**📥 Download Full Data (CSV):** ${result.downloadUrl}`,
                  },
                ],
                _meta: {
                  downloadUrl: result.downloadUrl,
                  totalRows: result.totalRows,
                },
              },
            });
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            res.json({
              jsonrpc: "2.0",
              id: id,
              error: {
                code: -32000,
                message: errorMessage,
              },
            });
          }
        } else if (toolName === "find_trending_topics") {
          // Trending topics analysis tool
          try {
            console.error("=== FIND_TRENDING_TOPICS ===");
            const result = await findTrendingTopics({
              field: toolArgs.field || "Beauty",
              days: toolArgs.days || 30,
              limit: toolArgs.limit || 50,
            });

            if (!result.success) {
              res.json({
                jsonrpc: "2.0",
                id: id,
                error: {
                  code: -32000,
                  message: result.error || "Analysis failed",
                },
              });
              return;
            }

            res.json({
              jsonrpc: "2.0",
              id: id,
              result: {
                structuredContent: {
                  analysis: {
                    type: "trending_topics",
                    description: result.description,
                    field: toolArgs.field || "Beauty",
                    queryExecuted: result.query,
                  },
                  data: result.data,
                  downloadUrl: result.downloadUrl,
                },
                content: [
                  {
                    type: "text",
                    text: `Trending topics analysis complete. Found ${result.totalRows} trending topics.\n\n**📥 Download Full Data (CSV):** ${result.downloadUrl}`,
                  },
                ],
                _meta: {
                  downloadUrl: result.downloadUrl,
                  totalRows: result.totalRows,
                },
              },
            });
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            res.json({
              jsonrpc: "2.0",
              id: id,
              error: {
                code: -32000,
                message: errorMessage,
              },
            });
          }
        } else {
          res.json({
            jsonrpc: "2.0",
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
          jsonrpc: "2.0",
          id: id,
          error: {
            code: -32601,
            message: `Method not found: ${method}`,
          },
        });
    }
  } catch (error) {
    console.error("Error handling MCP request:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    res.json({
      jsonrpc: "2.0",
      id: id,
      error: {
        code: -32603,
        message: errorMessage,
      },
    });
  }
});

// OAuth discovery endpoints (return empty for no auth)
app.get("/.well-known/oauth-authorization-server", (_req, res) => {
  res.status(404).json({ error: "OAuth not configured" });
});

app.get("/.well-known/openid-configuration", (_req, res) => {
  res.status(404).json({ error: "OpenID not configured" });
});

// SSE endpoint
app.get("/mcp/sse", async (req, res) => {
  const transport = new SSEServerTransport("/mcp/message", res);
  const sessionId = (transport as any)._sessionId;
  const hostType = detectHostType(req);

  if (sessionId) {
    transports[sessionId] = transport;
    sessions[sessionId] = { transport, hostType };
    console.error(`New SSE connection: ${sessionId} (host: ${hostType})`);
  }

  res.on("close", () => {
    if (sessionId) {
      delete transports[sessionId];
      delete sessions[sessionId];
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

  // Set current session host type for tool handlers
  const sessionInfo = sessions[sessionId];
  if (sessionInfo) {
    currentSessionHostType = sessionInfo.hostType;
    console.error(`Processing message for session ${sessionId} (host: ${currentSessionHostType})`);
  } else {
    // Fallback: detect from current request
    currentSessionHostType = detectHostType(req);
    console.error(`Session info not found, detected host: ${currentSessionHostType}`);
  }

  await transport.handlePostMessage(req, res, req.body);
});

// Start server
app.listen(PORT, () => {
  console.error(`✅ Server running on http://localhost:${PORT}`);
  console.error(`📋 Health check: http://localhost:${PORT}/health`);
  console.error(`🔌 MCP endpoint: http://localhost:${PORT}/mcp`);
});
