import express from "express";
import cors from "cors";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
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
  searchInfluencersBigQuery,
  getSearchDescription,
  searchByBrandCollaboration,
  getBrandSearchDescription,
  type SearchInfluencersParams,
  type SearchByBrandParams,
} from "./api/influencer-search.js";
import {
  analyzeHashtagTrends as analyzeHashtagTrendsBQ,
  detectEmergingHashtags,
  compareRegionalHashtags,
  analyzeBeautyIngredientTrends,
  getHashtagTrendDescription,
  getEmergingHashtagDescription,
  getRegionalHashtagDescription,
  getBeautyIngredientTrendDescription,
  type HashtagTrendParams,
  type EmergingHashtagParams,
  type RegionalHashtagParams,
  type BeautyIngredientTrendParams,
} from "./api/trend-analysis.js";
import {
  analyzeBrandMentions,
  findBrandCollaborators,
  analyzeSponsoredContentPerformance,
  compareCompetitorBrands,
  getBrandMentionDescription,
  getBrandCollaboratorDescription,
  getSponsoredContentDescription,
  getCompetitorBrandDescription,
  type BrandMentionParams,
  type BrandCollaboratorParams,
  type SponsoredContentParams,
  type CompetitorBrandParams,
} from "./api/brand-analysis.js";
import {
  analyzeMarketDemographics,
  findKCultureInfluencers,
  analyzeLifestageSegments,
  analyzeBeautyPersonaSegments,
  getMarketDemographicsDescription,
  getKCultureInfluencerDescription,
  getLifestageSegmentDescription,
  getBeautyPersonaDescription,
  type MarketDemographicsParams,
  type KCultureInfluencerParams,
  type LifestageSegmentParams,
  type BeautyPersonaParams,
} from "./api/market-insights.js";
import {
  analyzeEngagementMetrics,
  compareContentFormats,
  findOptimalPostingTime,
  analyzeViralContentPatterns,
  analyzeBeautyContentPerformance,
  getEngagementMetricsDescription,
  getContentFormatsDescription,
  getOptimalPostingTimeDescription,
  getViralContentDescription,
  getBeautyContentDescription,
  type EngagementMetricsParams,
  type ContentFormatsParams,
  type OptimalPostingTimeParams,
  type ViralContentParams,
  type BeautyContentParams,
} from "./api/content-analysis.js";
import {
  searchMultiplatformInfluencers,
  findInfluencersWithShoppingLinks,
  findContactableInfluencers,
  analyzePlatformDistribution,
  comparePlatformPresence,
  getMultiplatformInfluencersDescription,
  getShoppingLinksDescription,
  getContactableInfluencersDescription,
  getPlatformDistributionDescription,
  getPlatformPresenceDescription,
  type MultiplatformInfluencersParams,
  type ShoppingLinksParams,
  type ContactableInfluencersParams,
  type PlatformDistributionParams,
  type PlatformPresenceParams,
} from "./api/multiplatform.js";

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
// General tool usage guidelines for ChatGPT
const TOOL_USAGE_GUIDELINES = `## WHOTAG Tools Usage Guidelines

This MCP server provides 25 tools for influencer marketing analysis. Use the appropriate tool combination patterns for each task.

---

## Tool Combination Patterns

### Pattern A: Market Entry Analysis (시장 진출 분석)

When user asks about entering a new market or analyzing market opportunities:

\`\`\`
1. analyze_market_demographics → Understand market size & characteristics
2. analyze_hashtag_trends_bigquery → Identify local trends
3. find_k_culture_influencers → Find K-culture interested influencers
4. search_influencers_bigquery → Search target influencers
5. compare_regional_hashtags → Compare local vs home market differences
\`\`\`

Example: "베트남 시장 진출을 위한 뷰티 인플루언서 분석"

---

### Pattern B: Competitor Benchmarking (경쟁사 벤치마킹)

When user asks about competitor analysis or benchmarking:

\`\`\`
1. compare_competitor_brands → Compare competitor status
2. find_brand_collaborators → Analyze competitor's collaborating influencers
3. analyze_sponsored_content_performance → Compare sponsored content performance
4. analyze_market_demographics → Identify untapped market opportunities
\`\`\`

Example: "Fwee와 Rom&nd의 인플루언서 마케팅 비교 분석"

---

### Pattern C: Trend Forecasting (트렌드 예측)

When user asks about trend analysis or predictions:

\`\`\`
1. detect_emerging_hashtags → Detect rapidly growing trends
2. compare_regional_hashtags → Analyze regional differences
3. analyze_beauty_ingredient_trends → Analyze ingredient trends
4. analyze_viral_content_patterns → Analyze viral patterns
\`\`\`

Example: "2026년 K-뷰티 트렌드 예측"

---

### Pattern D: Influencer Casting (인플루언서 캐스팅)

When user asks to find or select influencers for campaigns:

\`\`\`
1. search_influencers_bigquery → Condition-based search
2. search_by_brand_collaboration → Check similar brand collaboration history
3. analyze_engagement_metrics → Verify performance metrics
4. Present final selection to user
\`\`\`

Example: "한국 스킨케어 캠페인을 위한 마이크로 인플루언서 추천"

---

### Pattern E: Multi-Platform / Affiliate Marketing (멀티 플랫폼 / 제휴 마케팅)

When user asks about cross-platform or affiliate marketing:

\`\`\`
1. search_multiplatform_influencers → Find multi-platform influencers
2. find_influencers_with_shopping_links → Check shopping link ownership
3. analyze_platform_distribution → Analyze platform distribution
4. find_contactable_influencers → Filter contactable influencers
5. Generate outreach list
\`\`\`

Example: "YouTube와 Instagram 동시 활동하는 뷰티 인플루언서 중 쇼핑 링크 보유자"

---

### Pattern F: Global Campaign Localization (글로벌 캠페인 현지화)

When user asks about localizing campaigns for different markets:

\`\`\`
1. analyze_platform_distribution → Check platform ownership by country
2. compare_regional_hashtags → Analyze country-specific trend differences
3. analyze_beauty_content_performance → Compare content type performance
4. find_influencers_with_shopping_links → Check local affiliate channel ownership
5. Develop country-specific differentiation strategy
\`\`\`

Example: "동남아 5개국 K-뷰티 캠페인 현지화 전략"

---

## Tool Categories Reference

| Category | Tools | Use For |
|----------|-------|---------|
| Influencer Search | search_influencers, search_influencers_bigquery, search_by_brand_collaboration | Finding influencers |
| Trend Analysis | analyze_hashtag_trends_bigquery, detect_emerging_hashtags, compare_regional_hashtags, analyze_beauty_ingredient_trends | Trend insights |
| Brand Analysis | analyze_brand_mentions, find_brand_collaborators, analyze_sponsored_content_performance, compare_competitor_brands | Brand intelligence |
| Market Insights | analyze_market_demographics, find_k_culture_influencers, analyze_lifestage_segments, analyze_beauty_persona_segments | Market understanding |
| Content Analysis | analyze_engagement_metrics, compare_content_formats, find_optimal_posting_time, analyze_viral_content_patterns, analyze_beauty_content_performance | Content optimization |
| Multi-Platform | search_multiplatform_influencers, find_influencers_with_shopping_links, find_contactable_influencers, analyze_platform_distribution, compare_platform_presence | Cross-platform analysis |

---

## General Guidelines

1. **Match pattern to user intent** - Identify which pattern best fits the user's request
2. **Execute tools sequentially** - Follow the pattern order for best results
3. **Combine insights** - Synthesize results from multiple tools for comprehensive analysis
4. **Adapt as needed** - Skip or add tools based on specific requirements`;

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

// Tool description with usage guidelines for search_influencers
const SEARCH_TOOL_DESCRIPTION = `Search influencers using natural language query via whotag.ai API.

## CRITICAL: Single vs Multiple Searches

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

## MANDATORY: Examples of Multiple Tool Calls

- "태국과 베트남의 뷰티 인플루언서" → MUST call TWICE:
  1. search_influencers(query="beauty influencers in Thailand with 50k-100k followers")
  2. search_influencers(query="beauty influencers in Vietnam with 50k-100k followers")

- "동남아 주요 6개국가의 뷰티 인플루언서" → MUST call 6 TIMES (Thailand, Vietnam, Indonesia, Philippines, Malaysia, Singapore)

- "Instagram과 TikTok 패션 인플루언서" → MUST call TWICE (Instagram, then TikTok)

## Single Search (Only When User Wants Combined Results)

- "베트남 또는 말레이시아의 뷰티 인플루언서" → Call once: "beauty influencers in Vietnam or Malaysia"
- "동남아시아 지역의 패션 인플루언서" (not asking to compare countries) → Call once

## Why Separate Tool Calls Are REQUIRED

- Each search appears in a separate carousel for easy comparison
- Better organized results per country/category
- More accurate filtering and analysis

## Query Formatting

- Use the user's EXACT wording and intent for each search
- Do NOT add criteria the user didn't explicitly request
- Only add search terms that the user specifically mentioned
- Keep queries simple and focused`;

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

// Register search_influencers_bigquery tool
const BIGQUERY_SEARCH_DESCRIPTION = `Search influencers using BigQuery with structured filters.

This tool searches influencers directly from BigQuery tables with specific filter parameters.
Supports both general influencer filters and beauty-specific filters.

When beauty filters are provided (skin_type, beauty_interest_areas, etc.), the search
automatically includes beauty profile data.

Examples:
- General search: {"country": ["KR"], "interests": ["Beauty"], "limit": 50}
- Beauty search: {"country": ["KR"], "skin_type": ["Oily"], "beauty_interest_areas": ["Skincare"]}`;

// Enum definitions for Zod schema
const INTERESTS_ENUM = [
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
] as const;

const AGE_RANGE_ENUM = [
  "0~4", "5~9", "10~14", "15~19", "20~24", "25~29", "30~34", "35~39",
  "40~44", "45~49", "50~54", "55~59", "60~64", "65~69", "70+", "Unknown"
] as const;

const COLLABORATION_TIER_ENUM = [
  "Ready - Premium", "Ready - Professional", "Potential - High", "Potential - Basic", "Personal Only"
] as const;

const BEAUTY_INTEREST_AREAS_ENUM = [
  "Makeup", "Skincare", "K Beauty", "Clean Beauty", "Vegan Beauty",
  "Anti Aging", "Sun Care", "Hair Care", "Nail Care", "Fragrance"
] as const;

const BEAUTY_CONTENT_TYPES_ENUM = [
  "Makeup Tutorial", "Product Review", "Skincare Routine", "GRWM",
  "Unboxing", "Before After", "Haul", "Look Recreation"
] as const;

const SKIN_TYPE_ENUM = ["Oily", "Dry", "Combination", "Normal", "Sensitive"] as const;

const SKIN_CONCERNS_ENUM = [
  "Acne", "Anti Aging", "Hydration", "Brightening", "Sensitive Skin",
  "Pore Care", "Dark Circles", "Pigmentation", "Oil Control"
] as const;

const PERSONAL_COLOR_ENUM = ["Warm", "Cool", "Neutral", "Unknown"] as const;

const BRAND_TIER_ENUM = ["Ultra Luxury", "Luxury", "Premium", "Drugstore", "Budget", "Mixed", "Unknown"] as const;

server.registerTool(
  "search_influencers_bigquery",
  {
    title: "Search Influencers (BigQuery)",
    description: BIGQUERY_SEARCH_DESCRIPTION,
    inputSchema: {
      // General filters
      country: z
        .array(z.string())
        .optional()
        .describe("Country codes (ISO 3166-1 Alpha-2). Examples: ['KR', 'JP', 'US', 'VN', 'TH', 'ID']"),
      gender: z
        .enum(["Male", "Female", "Unknown"])
        .optional()
        .describe("Filter by gender"),
      age_range: z
        .array(z.enum(AGE_RANGE_ENUM))
        .optional()
        .describe("Age range(s) to filter. Example: ['20~24', '25~29'] for 20s"),
      interests: z
        .array(z.enum(INTERESTS_ENUM))
        .optional()
        .describe("Interest categories to filter (OR logic)"),
      collaboration_tier: z
        .array(z.enum(COLLABORATION_TIER_ENUM))
        .optional()
        .describe("Collaboration readiness tier(s)"),
      follower_min: z
        .number()
        .optional()
        .describe("Minimum follower count"),
      follower_max: z
        .number()
        .optional()
        .describe("Maximum follower count"),
      k_interest: z
        .boolean()
        .optional()
        .describe("Filter for K-culture interested influencers"),

      // Beauty-specific filters
      beauty_interest_areas: z
        .array(z.enum(BEAUTY_INTEREST_AREAS_ENUM))
        .optional()
        .describe("Beauty interest areas (triggers beauty profile join)"),
      beauty_content_types: z
        .array(z.enum(BEAUTY_CONTENT_TYPES_ENUM))
        .optional()
        .describe("Types of beauty content created"),
      skin_type: z
        .array(z.enum(SKIN_TYPE_ENUM))
        .optional()
        .describe("Skin type filter"),
      skin_concerns: z
        .array(z.enum(SKIN_CONCERNS_ENUM))
        .optional()
        .describe("Skin concerns filter"),
      personal_color: z
        .enum(PERSONAL_COLOR_ENUM)
        .optional()
        .describe("Personal color season"),
      brand_tier_segments: z
        .enum(BRAND_TIER_ENUM)
        .optional()
        .describe("Brand tier preference"),

      // Result options
      limit: z
        .number()
        .min(1)
        .max(500)
        .default(50)
        .optional()
        .describe("Maximum results (default: 50, max: 500)"),
    },
    _meta: {
      "openai/toolInvocation/invoking": "Searching influencers in BigQuery...",
      "openai/toolInvocation/invoked": "BigQuery search complete",
    },
  },
  async (args) => {
    try {
      console.error("=== SEARCH_INFLUENCERS_BIGQUERY ===");
      console.error("Args:", JSON.stringify(args, null, 2));

      const params: SearchInfluencersParams = {
        country: args.country,
        gender: args.gender,
        age_range: args.age_range,
        interests: args.interests,
        collaboration_tier: args.collaboration_tier,
        follower_min: args.follower_min,
        follower_max: args.follower_max,
        k_interest: args.k_interest,
        beauty_interest_areas: args.beauty_interest_areas,
        beauty_content_types: args.beauty_content_types,
        skin_type: args.skin_type,
        skin_concerns: args.skin_concerns,
        personal_color: args.personal_color,
        brand_tier_segments: args.brand_tier_segments,
        limit: args.limit || 50,
      };

      const result = await searchInfluencersBigQuery(params);

      if (!result.success) {
        return {
          content: [
            {
              type: "text",
              text: `Search failed: ${result.error}`,
            },
          ],
          isError: true,
        };
      }

      const searchDesc = getSearchDescription(params);

      // Format as markdown for display
      let markdown = `## BigQuery Influencer Search Results\n\n`;
      markdown += `**Search Criteria:** ${searchDesc}\n`;
      markdown += `**Total Found:** ${result.totalRows}\n`;
      markdown += `**Download CSV:** ${result.downloadUrl}\n\n`;
      markdown += `---\n\n`;

      // Show top 20 results
      const topResults = result.data.slice(0, 20);
      topResults.forEach((row: any, index: number) => {
        markdown += `### ${index + 1}. ${row.full_name || row.username}\n`;
        markdown += `- **Username:** @${row.username}\n`;
        markdown += `- **Followers:** ${row.follower_count?.toLocaleString() || "N/A"}\n`;
        if (row.collaboration_tier) {
          markdown += `- **Collaboration Tier:** ${row.collaboration_tier}\n`;
        }
        if (row.country?.length) {
          markdown += `- **Country:** ${Array.isArray(row.country) ? row.country.join(", ") : row.country}\n`;
        }
        if (row.interests?.length) {
          const interests = Array.isArray(row.interests) ? row.interests.slice(0, 5).join(", ") : row.interests;
          markdown += `- **Interests:** ${interests}\n`;
        }
        // Beauty fields if present
        if (row.skin_type?.length) {
          markdown += `- **Skin Type:** ${Array.isArray(row.skin_type) ? row.skin_type.join(", ") : row.skin_type}\n`;
        }
        if (row.personal_color) {
          markdown += `- **Personal Color:** ${row.personal_color}\n`;
        }
        markdown += `\n`;
      });

      if (result.totalRows > 20) {
        markdown += `\n*... and ${result.totalRows - 20} more results. Download the CSV for full data.*\n`;
      }

      if (currentSessionHostType === "chatgpt") {
        return {
          structuredContent: {
            search: {
              type: "bigquery_influencer_search",
              criteria: searchDesc,
              totalResults: result.totalRows,
              queryExecuted: result.query,
            },
            data: result.data.slice(0, 50), // Top 50 for GPT
            downloadUrl: result.downloadUrl,
          },
          content: [
            {
              type: "text",
              text: `BigQuery search complete. Found ${result.totalRows} influencers matching: ${searchDesc}\n\n**📥 Download Full Data (CSV):** ${result.downloadUrl}`,
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
      console.error("BigQuery search error:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
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

// Register search_by_brand_collaboration tool
const BRAND_COLLAB_DESCRIPTION = `Search influencers by brand collaboration history.

Find influencers who have previously collaborated with specific brands.
Uses case-insensitive matching for brand names.

Examples:
- Find Nike collaborators: {"brand_name": "Nike", "country": ["KR"]}
- Find Innisfree collaborators excluding competitors: {"brand_name": "Innisfree", "exclude_brand": ["Etude House"]}`;

server.registerTool(
  "search_by_brand_collaboration",
  {
    title: "Search by Brand Collaboration",
    description: BRAND_COLLAB_DESCRIPTION,
    inputSchema: {
      brand_name: z
        .string()
        .describe("Brand name to search for (case-insensitive)"),
      country: z
        .array(z.string())
        .optional()
        .describe("Country codes (ISO 3166-1 Alpha-2). Examples: ['KR', 'JP', 'US']"),
      exclude_brand: z
        .array(z.string())
        .optional()
        .describe("Brands to exclude from results (case-insensitive)"),
      collaboration_tier: z
        .array(z.enum(COLLABORATION_TIER_ENUM))
        .optional()
        .describe("Filter by collaboration tier"),
      follower_min: z
        .number()
        .optional()
        .describe("Minimum follower count"),
      follower_max: z
        .number()
        .optional()
        .describe("Maximum follower count"),
      limit: z
        .number()
        .min(1)
        .max(500)
        .default(50)
        .optional()
        .describe("Maximum results (default: 50, max: 500)"),
    },
    _meta: {
      "openai/toolInvocation/invoking": "Searching brand collaborators...",
      "openai/toolInvocation/invoked": "Brand collaboration search complete",
    },
  },
  async (args) => {
    try {
      console.error("=== SEARCH_BY_BRAND_COLLABORATION ===");
      console.error("Args:", JSON.stringify(args, null, 2));

      const params: SearchByBrandParams = {
        brand_name: args.brand_name as string,
        country: args.country as string[] | undefined,
        exclude_brand: args.exclude_brand as string[] | undefined,
        collaboration_tier: args.collaboration_tier as string[] | undefined,
        follower_min: args.follower_min as number | undefined,
        follower_max: args.follower_max as number | undefined,
        limit: (args.limit as number) || 50,
      };

      const result = await searchByBrandCollaboration(params);

      if (!result.success) {
        return {
          content: [
            {
              type: "text",
              text: `Search failed: ${result.error}`,
            },
          ],
          isError: true,
        };
      }

      const searchDesc = getBrandSearchDescription(params);

      // Format as markdown for display
      let markdown = `## Brand Collaboration Search Results\n\n`;
      markdown += `**Search Criteria:** ${searchDesc}\n`;
      markdown += `**Total Found:** ${result.totalRows}\n`;
      markdown += `**Download CSV:** ${result.downloadUrl}\n\n`;
      markdown += `---\n\n`;

      // Show top 20 results
      const topResults = result.data.slice(0, 20);
      topResults.forEach((row: any, index: number) => {
        markdown += `### ${index + 1}. ${row.full_name || row.username}\n`;
        markdown += `- **Username:** @${row.username}\n`;
        markdown += `- **Followers:** ${row.follower_count?.toLocaleString() || "N/A"}\n`;
        if (row.collaborate_brand?.length) {
          const brands = Array.isArray(row.collaborate_brand)
            ? row.collaborate_brand.slice(0, 10).join(", ")
            : row.collaborate_brand;
          markdown += `- **Collaborated Brands:** ${brands}\n`;
        }
        if (row.collaboration_tier) {
          markdown += `- **Collaboration Tier:** ${row.collaboration_tier}\n`;
        }
        if (row.country?.length) {
          markdown += `- **Country:** ${Array.isArray(row.country) ? row.country.join(", ") : row.country}\n`;
        }
        if (row.interests?.length) {
          const interests = Array.isArray(row.interests) ? row.interests.slice(0, 5).join(", ") : row.interests;
          markdown += `- **Interests:** ${interests}\n`;
        }
        markdown += `\n`;
      });

      if (result.totalRows > 20) {
        markdown += `\n*... and ${result.totalRows - 20} more results. Download the CSV for full data.*\n`;
      }

      if (currentSessionHostType === "chatgpt") {
        return {
          structuredContent: {
            search: {
              type: "brand_collaboration_search",
              criteria: searchDesc,
              brandName: params.brand_name,
              totalResults: result.totalRows,
              queryExecuted: result.query,
            },
            data: result.data.slice(0, 50), // Top 50 for GPT
            downloadUrl: result.downloadUrl,
          },
          content: [
            {
              type: "text",
              text: `Brand collaboration search complete. Found ${result.totalRows} influencers who collaborated with "${params.brand_name}".\n\n**📥 Download Full Data (CSV):** ${result.downloadUrl}`,
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
      console.error("Brand collaboration search error:", error);
      const errorMessage = error instanceof Error ? error.message : String(error);
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

// ============================================================================
// Trend Analysis Tools
// ============================================================================

// Content type enum for trend analysis
const CONTENT_TYPE_ENUM = ["all", "media", "reels"] as const;
const COMPARE_PERIOD_ENUM = ["2weeks", "1month", "3months"] as const;

// Register analyze_hashtag_trends_bigquery tool
const HASHTAG_TRENDS_DESCRIPTION = `Analyze popular hashtags among influencer groups using BigQuery.

Analyzes hashtag usage patterns from Instagram posts and reels.
Returns hashtag usage count, unique users, and average engagement.

Examples:
- Korean beauty influencers: {"country": ["KR"], "interests": ["Beauty"], "period_days": 30}
- Reels only analysis: {"country": ["VN"], "content_type": "reels", "limit": 100}`;

server.registerTool(
  "analyze_hashtag_trends_bigquery",
  {
    title: "Analyze Hashtag Trends (BigQuery)",
    description: HASHTAG_TRENDS_DESCRIPTION,
    inputSchema: {
      country: z
        .array(z.string())
        .optional()
        .describe("Country codes (ISO 3166-1 Alpha-2)"),
      interests: z
        .array(z.enum(INTERESTS_ENUM))
        .optional()
        .describe("Interest categories to filter influencers"),
      period_days: z
        .number()
        .min(1)
        .max(365)
        .default(30)
        .optional()
        .describe("Analysis period in days (default: 30)"),
      content_type: z
        .enum(CONTENT_TYPE_ENUM)
        .default("all")
        .optional()
        .describe("Content type: all, media (feed posts), or reels"),
      limit: z
        .number()
        .min(1)
        .max(500)
        .default(50)
        .optional()
        .describe("Maximum hashtags to return (default: 50)"),
    },
    _meta: {
      "openai/toolInvocation/invoking": "Analyzing hashtag trends...",
      "openai/toolInvocation/invoked": "Hashtag trend analysis complete",
    },
  },
  async (args) => {
    try {
      console.error("=== ANALYZE_HASHTAG_TRENDS_BIGQUERY ===");
      console.error("Args:", JSON.stringify(args, null, 2));

      const params: HashtagTrendParams = {
        country: args.country as string[] | undefined,
        interests: args.interests as string[] | undefined,
        period_days: (args.period_days as number) || 30,
        content_type: (args.content_type as "all" | "media" | "reels") || "all",
        limit: (args.limit as number) || 50,
      };

      const result = await analyzeHashtagTrendsBQ(params);

      if (!result.success) {
        return {
          content: [{ type: "text", text: `Analysis failed: ${result.error}` }],
          isError: true,
        };
      }

      const searchDesc = getHashtagTrendDescription(params);

      let markdown = `## Hashtag Trend Analysis\n\n`;
      markdown += `**Criteria:** ${searchDesc}\n`;
      markdown += `**Total Hashtags:** ${result.totalRows}\n`;
      markdown += `**Download CSV:** ${result.downloadUrl}\n\n`;
      markdown += `| Rank | Hashtag | Usage | Users | Avg Engagement |\n`;
      markdown += `|------|---------|-------|-------|----------------|\n`;

      result.data.slice(0, 30).forEach((row: any, idx: number) => {
        markdown += `| ${idx + 1} | #${row.hashtag} | ${row.usage_count} | ${row.unique_users} | ${row.avg_engagement?.toFixed(1) || "N/A"} |\n`;
      });

      if (currentSessionHostType === "chatgpt") {
        return {
          structuredContent: {
            analysis: { type: "hashtag_trends", criteria: searchDesc },
            data: result.data.slice(0, 100),
            downloadUrl: result.downloadUrl,
          },
          content: [{ type: "text", text: `Hashtag analysis complete. Found ${result.totalRows} trending hashtags.\n\n**Download:** ${result.downloadUrl}` }],
          _meta: { downloadUrl: result.downloadUrl, totalRows: result.totalRows },
        };
      }
      return { content: [{ type: "text", text: markdown }] };
    } catch (error) {
      console.error("Hashtag trend analysis error:", error);
      return {
        content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  }
);

// Register detect_emerging_hashtags tool
const EMERGING_HASHTAGS_DESCRIPTION = `Detect rapidly growing hashtags by comparing usage between periods.

Identifies hashtags that have significantly increased in usage.
Compares current period with previous period to calculate growth rate.

Examples:
- Fast-growing in Korea: {"country": ["KR"], "interests": ["Beauty"], "min_growth_rate": 2.0}
- 3-month comparison: {"country": ["JP"], "compare_period": "3months"}`;

server.registerTool(
  "detect_emerging_hashtags",
  {
    title: "Detect Emerging Hashtags",
    description: EMERGING_HASHTAGS_DESCRIPTION,
    inputSchema: {
      country: z
        .array(z.string())
        .optional()
        .describe("Country codes (ISO 3166-1 Alpha-2)"),
      interests: z
        .array(z.enum(INTERESTS_ENUM))
        .optional()
        .describe("Interest categories to filter"),
      compare_period: z
        .enum(COMPARE_PERIOD_ENUM)
        .default("1month")
        .optional()
        .describe("Comparison period: 2weeks, 1month, or 3months"),
      min_growth_rate: z
        .number()
        .min(1)
        .default(1.5)
        .optional()
        .describe("Minimum growth rate (1.5 = 150% of previous, default: 1.5)"),
      min_current_count: z
        .number()
        .min(1)
        .default(10)
        .optional()
        .describe("Minimum current usage count (default: 10)"),
      limit: z
        .number()
        .min(1)
        .max(100)
        .default(30)
        .optional()
        .describe("Maximum results (default: 30)"),
    },
    _meta: {
      "openai/toolInvocation/invoking": "Detecting emerging hashtags...",
      "openai/toolInvocation/invoked": "Emerging hashtag detection complete",
    },
  },
  async (args) => {
    try {
      console.error("=== DETECT_EMERGING_HASHTAGS ===");
      console.error("Args:", JSON.stringify(args, null, 2));

      const params: EmergingHashtagParams = {
        country: args.country as string[] | undefined,
        interests: args.interests as string[] | undefined,
        compare_period: (args.compare_period as "2weeks" | "1month" | "3months") || "1month",
        min_growth_rate: (args.min_growth_rate as number) || 1.5,
        min_current_count: (args.min_current_count as number) || 10,
        limit: (args.limit as number) || 30,
      };

      const result = await detectEmergingHashtags(params);

      if (!result.success) {
        return {
          content: [{ type: "text", text: `Detection failed: ${result.error}` }],
          isError: true,
        };
      }

      const searchDesc = getEmergingHashtagDescription(params);

      let markdown = `## Emerging Hashtags Detection\n\n`;
      markdown += `**Criteria:** ${searchDesc}\n`;
      markdown += `**Found:** ${result.totalRows} emerging hashtags\n`;
      markdown += `**Download CSV:** ${result.downloadUrl}\n\n`;
      markdown += `| Hashtag | Previous | Current | Growth Rate |\n`;
      markdown += `|---------|----------|---------|-------------|\n`;

      result.data.slice(0, 20).forEach((row: any) => {
        const growthDisplay = row.previous_count === 0 ? "NEW" : `${(row.growth_rate * 100).toFixed(0)}%`;
        markdown += `| #${row.hashtag} | ${row.previous_count} | ${row.current_count} | ${growthDisplay} |\n`;
      });

      if (currentSessionHostType === "chatgpt") {
        return {
          structuredContent: {
            analysis: { type: "emerging_hashtags", criteria: searchDesc },
            data: result.data,
            downloadUrl: result.downloadUrl,
          },
          content: [{ type: "text", text: `Detected ${result.totalRows} emerging hashtags.\n\n**Download:** ${result.downloadUrl}` }],
          _meta: { downloadUrl: result.downloadUrl, totalRows: result.totalRows },
        };
      }
      return { content: [{ type: "text", text: markdown }] };
    } catch (error) {
      console.error("Emerging hashtag detection error:", error);
      return {
        content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  }
);

// Register compare_regional_hashtags tool
const REGIONAL_HASHTAGS_DESCRIPTION = `Compare hashtag usage across different countries/regions.

Analyzes and compares top hashtags by country to identify regional trends.
Requires at least 2 countries for comparison.

Examples:
- Korea vs Japan: {"countries": ["KR", "JP"], "interests": ["Beauty"], "period_days": 30}
- Asia comparison: {"countries": ["KR", "JP", "VN", "TH"], "limit": 10}`;

server.registerTool(
  "compare_regional_hashtags",
  {
    title: "Compare Regional Hashtags",
    description: REGIONAL_HASHTAGS_DESCRIPTION,
    inputSchema: {
      countries: z
        .array(z.string())
        .min(2)
        .max(5)
        .describe("Countries to compare (2-5 countries, ISO 3166-1 Alpha-2)"),
      interests: z
        .array(z.enum(INTERESTS_ENUM))
        .optional()
        .describe("Interest categories to filter"),
      period_days: z
        .number()
        .min(1)
        .max(365)
        .default(30)
        .optional()
        .describe("Analysis period in days (default: 30)"),
      limit: z
        .number()
        .min(5)
        .max(50)
        .default(20)
        .optional()
        .describe("Top N hashtags per country (default: 20)"),
    },
    _meta: {
      "openai/toolInvocation/invoking": "Comparing regional hashtags...",
      "openai/toolInvocation/invoked": "Regional comparison complete",
    },
  },
  async (args) => {
    try {
      console.error("=== COMPARE_REGIONAL_HASHTAGS ===");
      console.error("Args:", JSON.stringify(args, null, 2));

      const params: RegionalHashtagParams = {
        countries: args.countries as string[],
        interests: args.interests as string[] | undefined,
        period_days: (args.period_days as number) || 30,
        limit: (args.limit as number) || 20,
      };

      const result = await compareRegionalHashtags(params);

      if (!result.success) {
        return {
          content: [{ type: "text", text: `Comparison failed: ${result.error}` }],
          isError: true,
        };
      }

      const searchDesc = getRegionalHashtagDescription(params);

      let markdown = `## Regional Hashtag Comparison\n\n`;
      markdown += `**Criteria:** ${searchDesc}\n`;
      markdown += `**Download CSV:** ${result.downloadUrl}\n\n`;

      // Group by country
      const byCountry: Record<string, any[]> = {};
      result.data.forEach((row: any) => {
        if (!byCountry[row.country]) byCountry[row.country] = [];
        byCountry[row.country].push(row);
      });

      for (const [country, hashtags] of Object.entries(byCountry)) {
        markdown += `### ${country}\n`;
        markdown += `| Rank | Hashtag | Usage |\n`;
        markdown += `|------|---------|-------|\n`;
        hashtags.slice(0, 10).forEach((row: any) => {
          markdown += `| ${row.rank} | #${row.hashtag} | ${row.usage_count} |\n`;
        });
        markdown += `\n`;
      }

      if (currentSessionHostType === "chatgpt") {
        return {
          structuredContent: {
            analysis: { type: "regional_comparison", criteria: searchDesc, countries: params.countries },
            data: result.data,
            downloadUrl: result.downloadUrl,
          },
          content: [{ type: "text", text: `Regional comparison complete for ${params.countries.join(", ")}.\n\n**Download:** ${result.downloadUrl}` }],
          _meta: { downloadUrl: result.downloadUrl, totalRows: result.totalRows },
        };
      }
      return { content: [{ type: "text", text: markdown }] };
    } catch (error) {
      console.error("Regional comparison error:", error);
      return {
        content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  }
);

// Register analyze_beauty_ingredient_trends tool
const BEAUTY_INGREDIENT_DESCRIPTION = `Analyze trending beauty ingredients among influencers.

Identifies popular skincare ingredients, makeup items, or haircare products with growth rates.
Useful for product development, trend forecasting, and marketing strategy.

Examples:
- Skincare ingredients in Korea: {"country": ["KR"], "category": "skincare", "period_days": 90}
- Makeup trends in Japan: {"country": ["JP"], "category": "makeup", "period_days": 60}
- Haircare in Southeast Asia: {"country": ["VN", "TH", "ID"], "category": "haircare"}`;

server.registerTool(
  "analyze_beauty_ingredient_trends",
  {
    title: "Analyze Beauty Ingredient Trends",
    description: BEAUTY_INGREDIENT_DESCRIPTION,
    inputSchema: {
      country: z
        .array(z.string())
        .optional()
        .describe("Countries to analyze (ISO 3166-1 Alpha-2)"),
      category: z
        .enum(["skincare", "makeup", "haircare"])
        .default("skincare")
        .optional()
        .describe("Beauty category: skincare (ingredients), makeup (items), or haircare (items)"),
      period_days: z
        .number()
        .min(30)
        .max(365)
        .default(90)
        .optional()
        .describe("Analysis period in days (default: 90)"),
      limit: z
        .number()
        .min(10)
        .max(100)
        .default(30)
        .optional()
        .describe("Number of results to return (default: 30)"),
    },
    _meta: {
      "openai/toolInvocation/invoking": "Analyzing beauty ingredient trends...",
      "openai/toolInvocation/invoked": "Ingredient analysis complete",
    },
  },
  async (args) => {
    try {
      console.error("=== ANALYZE_BEAUTY_INGREDIENT_TRENDS ===");
      console.error("Args:", JSON.stringify(args, null, 2));

      const params: BeautyIngredientTrendParams = {
        country: args.country as string[] | undefined,
        category: (args.category as "skincare" | "makeup" | "haircare") || "skincare",
        period_days: (args.period_days as number) || 90,
        limit: (args.limit as number) || 30,
      };

      const result = await analyzeBeautyIngredientTrends(params);

      if (!result.success) {
        return {
          content: [{ type: "text", text: `Analysis failed: ${result.error}` }],
          isError: true,
        };
      }

      const searchDesc = getBeautyIngredientTrendDescription(params);

      let markdown = `## Beauty Ingredient Trends\n\n`;
      markdown += `**Criteria:** ${searchDesc}\n`;
      markdown += `**Download CSV:** ${result.downloadUrl}\n\n`;
      markdown += `| Ingredient | Count | Previous | Growth | Related Products | Related Concerns |\n`;
      markdown += `|------------|-------|----------|--------|------------------|------------------|\n`;

      result.data.slice(0, 15).forEach((row: any) => {
        const growthPct = ((row.growth_rate - 1) * 100).toFixed(0);
        const growthStr = row.growth_rate >= 1 ? `+${growthPct}%` : `${growthPct}%`;
        markdown += `| ${row.ingredient} | ${row.current_count} | ${row.previous_count} | ${growthStr} | ${row.related_products || '-'} | ${row.related_concerns || '-'} |\n`;
      });

      if (currentSessionHostType === "chatgpt") {
        return {
          structuredContent: {
            analysis: { type: "beauty_ingredient_trends", criteria: searchDesc, category: params.category },
            data: result.data,
            downloadUrl: result.downloadUrl,
          },
          content: [{ type: "text", text: `Beauty ingredient analysis complete.\n\n**Category:** ${params.category}\n**Download:** ${result.downloadUrl}` }],
          _meta: { downloadUrl: result.downloadUrl, totalRows: result.totalRows },
        };
      }
      return { content: [{ type: "text", text: markdown }] };
    } catch (error) {
      console.error("Beauty ingredient analysis error:", error);
      return {
        content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  }
);

// ============================================================================
// BRAND ANALYSIS TOOLS
// ============================================================================

// Register analyze_brand_mentions tool
const BRAND_MENTION_DESCRIPTION = `Analyze brand mentions in influencer content.

Searches for brand mentions in captions and hashtags across media and reels.
Returns mention count, unique influencers, sponsored content count, and engagement metrics.

Example: Analyze how often "Innisfree" and "Laneige" are mentioned by Korean beauty influencers.`;

server.registerTool(
  "analyze_brand_mentions",
  {
    title: "Analyze Brand Mentions",
    description: BRAND_MENTION_DESCRIPTION,
    inputSchema: {
      brand_names: z
        .array(z.string())
        .min(1)
        .max(10)
        .describe("Brand names to analyze (1-10 brands). Example: ['Innisfree', 'Laneige']"),
      country: z
        .array(z.string())
        .optional()
        .describe("ISO 3166-1 Alpha-2 country codes. Example: ['KR', 'JP']"),
      interests: z
        .array(z.string())
        .optional()
        .describe("Interest categories. Example: ['Beauty', 'Skincare']"),
      period_days: z
        .number()
        .min(7)
        .max(365)
        .default(90)
        .optional()
        .describe("Analysis period in days (default: 90)"),
      limit: z
        .number()
        .min(1)
        .max(100)
        .default(50)
        .optional()
        .describe("Maximum results (default: 50)"),
    },
    _meta: {
      "openai/toolInvocation/invoking": "Analyzing brand mentions...",
      "openai/toolInvocation/invoked": "Brand mention analysis complete",
    },
  },
  async (args) => {
    try {
      console.error("=== ANALYZE_BRAND_MENTIONS ===");
      console.error("Args:", JSON.stringify(args, null, 2));

      const params: BrandMentionParams = {
        brand_names: args.brand_names as string[],
        country: args.country as string[] | undefined,
        interests: args.interests as string[] | undefined,
        period_days: (args.period_days as number) || 90,
        limit: (args.limit as number) || 50,
      };

      const result = await analyzeBrandMentions(params);

      if (!result.success) {
        return {
          content: [{ type: "text", text: `Analysis failed: ${result.error}` }],
          isError: true,
        };
      }

      const searchDesc = getBrandMentionDescription(params);

      let markdown = `## Brand Mention Analysis\n\n`;
      markdown += `**Criteria:** ${searchDesc}\n`;
      markdown += `**Download CSV:** ${result.downloadUrl}\n\n`;
      markdown += `| Brand | Mentions | Influencers | Sponsored | Avg Engagement |\n`;
      markdown += `|-------|----------|-------------|-----------|----------------|\n`;
      result.data.forEach((row: any) => {
        markdown += `| ${row.brand_name} | ${row.mention_count} | ${row.unique_influencers} | ${row.sponsored_count} | ${row.avg_engagement} |\n`;
      });

      if (currentSessionHostType === "chatgpt") {
        return {
          structuredContent: {
            analysis: { type: "brand_mentions", criteria: searchDesc },
            data: result.data,
            downloadUrl: result.downloadUrl,
          },
          content: [{ type: "text", text: `Brand mention analysis complete.\n\n**Download:** ${result.downloadUrl}` }],
          _meta: { downloadUrl: result.downloadUrl, totalRows: result.totalRows },
        };
      }
      return { content: [{ type: "text", text: markdown }] };
    } catch (error) {
      console.error("Brand mention analysis error:", error);
      return {
        content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  }
);

// Register find_brand_collaborators tool
const BRAND_COLLABORATOR_DESCRIPTION = `Find influencers who have collaborated with a specific brand.

Searches the collaborate_brand field in influencer profiles.
Use beauty brand names like Innisfree, Laneige, COSRX, etc.

Example: Find Korean influencers who have worked with "Innisfree".`;

server.registerTool(
  "find_brand_collaborators",
  {
    title: "Find Brand Collaborators",
    description: BRAND_COLLABORATOR_DESCRIPTION,
    inputSchema: {
      brand_name: z
        .string()
        .min(1)
        .describe("Brand name to search. Example: 'Innisfree'"),
      country: z
        .array(z.string())
        .optional()
        .describe("ISO 3166-1 Alpha-2 country codes. Example: ['KR', 'JP']"),
      collaboration_tier: z
        .array(z.enum([
          "Ready - Premium",
          "Ready - Professional",
          "Potential - High",
          "Potential - Basic",
          "Personal Only",
        ]))
        .optional()
        .describe("Filter by collaboration tier"),
      min_followers: z
        .number()
        .min(0)
        .optional()
        .describe("Minimum follower count. Example: 10000"),
      limit: z
        .number()
        .min(1)
        .max(200)
        .default(50)
        .optional()
        .describe("Maximum results (default: 50)"),
    },
    _meta: {
      "openai/toolInvocation/invoking": "Finding brand collaborators...",
      "openai/toolInvocation/invoked": "Brand collaborator search complete",
    },
  },
  async (args) => {
    try {
      console.error("=== FIND_BRAND_COLLABORATORS ===");
      console.error("Args:", JSON.stringify(args, null, 2));

      const params: BrandCollaboratorParams = {
        brand_name: args.brand_name as string,
        country: args.country as string[] | undefined,
        collaboration_tier: args.collaboration_tier as string[] | undefined,
        min_followers: args.min_followers as number | undefined,
        limit: (args.limit as number) || 50,
      };

      const result = await findBrandCollaborators(params);

      if (!result.success) {
        return {
          content: [{ type: "text", text: `Search failed: ${result.error}` }],
          isError: true,
        };
      }

      const searchDesc = getBrandCollaboratorDescription(params);

      let markdown = `## Brand Collaborators: ${params.brand_name}\n\n`;
      markdown += `**Criteria:** ${searchDesc}\n`;
      markdown += `**Found:** ${result.totalRows} influencers\n`;
      markdown += `**Download CSV:** ${result.downloadUrl}\n\n`;
      markdown += `| Username | Followers | Tier | Country |\n`;
      markdown += `|----------|-----------|------|----------|\n`;
      result.data.slice(0, 20).forEach((row: any) => {
        markdown += `| @${row.username} | ${row.follower_count?.toLocaleString() || 'N/A'} | ${row.collaboration_tier} | ${row.country} |\n`;
      });

      if (currentSessionHostType === "chatgpt") {
        return {
          structuredContent: {
            analysis: { type: "brand_collaborators", brand: params.brand_name, criteria: searchDesc },
            data: result.data,
            downloadUrl: result.downloadUrl,
          },
          content: [{ type: "text", text: `Found ${result.totalRows} collaborators for ${params.brand_name}.\n\n**Download:** ${result.downloadUrl}` }],
          _meta: { downloadUrl: result.downloadUrl, totalRows: result.totalRows },
        };
      }
      return { content: [{ type: "text", text: markdown }] };
    } catch (error) {
      console.error("Brand collaborator search error:", error);
      return {
        content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  }
);

// Register analyze_sponsored_content_performance tool
const SPONSORED_CONTENT_DESCRIPTION = `Analyze sponsored vs organic content performance.

Compares engagement metrics between sponsored (paid partnership) and organic content.
Optionally filter by specific brand mentions.

Example: Compare sponsored vs organic content performance for Korean beauty influencers.`;

server.registerTool(
  "analyze_sponsored_content_performance",
  {
    title: "Analyze Sponsored Content Performance",
    description: SPONSORED_CONTENT_DESCRIPTION,
    inputSchema: {
      brand_name: z
        .string()
        .optional()
        .describe("Optional brand name filter. Example: 'Laneige'"),
      country: z
        .array(z.string())
        .optional()
        .describe("ISO 3166-1 Alpha-2 country codes. Example: ['KR']"),
      interests: z
        .array(z.string())
        .optional()
        .describe("Interest categories. Example: ['Beauty']"),
      period_days: z
        .number()
        .min(7)
        .max(365)
        .default(90)
        .optional()
        .describe("Analysis period in days (default: 90)"),
      content_type: z
        .enum(["all", "media", "reels"])
        .default("all")
        .optional()
        .describe("Content type: all (default), media (feed posts), or reels"),
    },
    _meta: {
      "openai/toolInvocation/invoking": "Analyzing sponsored content performance...",
      "openai/toolInvocation/invoked": "Sponsored content analysis complete",
    },
  },
  async (args) => {
    try {
      console.error("=== ANALYZE_SPONSORED_CONTENT_PERFORMANCE ===");
      console.error("Args:", JSON.stringify(args, null, 2));

      const params: SponsoredContentParams = {
        brand_name: args.brand_name as string | undefined,
        country: args.country as string[] | undefined,
        interests: args.interests as string[] | undefined,
        period_days: (args.period_days as number) || 90,
        content_type: (args.content_type as "all" | "media" | "reels") || "all",
      };

      const result = await analyzeSponsoredContentPerformance(params);

      if (!result.success) {
        return {
          content: [{ type: "text", text: `Analysis failed: ${result.error}` }],
          isError: true,
        };
      }

      const searchDesc = getSponsoredContentDescription(params);

      let markdown = `## Sponsored vs Organic Content Performance\n\n`;
      markdown += `**Criteria:** ${searchDesc}\n`;
      markdown += `**Download CSV:** ${result.downloadUrl}\n\n`;
      markdown += `| Type | Content Count | Influencers | Avg Likes | Avg Comments | Avg Engagement |\n`;
      markdown += `|------|---------------|-------------|-----------|--------------|----------------|\n`;
      result.data.forEach((row: any) => {
        markdown += `| ${row.content_category} | ${row.content_count} | ${row.unique_influencers} | ${row.avg_likes} | ${row.avg_comments} | ${row.avg_engagement} |\n`;
      });

      if (currentSessionHostType === "chatgpt") {
        return {
          structuredContent: {
            analysis: { type: "sponsored_content", criteria: searchDesc },
            data: result.data,
            downloadUrl: result.downloadUrl,
          },
          content: [{ type: "text", text: `Sponsored content analysis complete.\n\n**Download:** ${result.downloadUrl}` }],
          _meta: { downloadUrl: result.downloadUrl, totalRows: result.totalRows },
        };
      }
      return { content: [{ type: "text", text: markdown }] };
    } catch (error) {
      console.error("Sponsored content analysis error:", error);
      return {
        content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  }
);

// Register compare_competitor_brands tool
const COMPETITOR_BRAND_DESCRIPTION = `Compare competitor brands' influencer marketing metrics.

Compares collaborator count, sponsored posts, and engagement across brands.
Requires at least 2 brands for comparison.

Example: Compare Fwee, Rom&nd, and Peripera in Korean and Japanese markets.`;

server.registerTool(
  "compare_competitor_brands",
  {
    title: "Compare Competitor Brands",
    description: COMPETITOR_BRAND_DESCRIPTION,
    inputSchema: {
      brands: z
        .array(z.string())
        .min(2)
        .max(5)
        .describe("Brand names to compare (2-5 brands). Example: ['Fwee', 'Rom&nd', 'Peripera']"),
      country: z
        .array(z.string())
        .optional()
        .describe("ISO 3166-1 Alpha-2 country codes. Example: ['KR', 'JP']"),
      period_days: z
        .number()
        .min(7)
        .max(365)
        .default(90)
        .optional()
        .describe("Analysis period in days (default: 90)"),
    },
    _meta: {
      "openai/toolInvocation/invoking": "Comparing competitor brands...",
      "openai/toolInvocation/invoked": "Competitor comparison complete",
    },
  },
  async (args) => {
    try {
      console.error("=== COMPARE_COMPETITOR_BRANDS ===");
      console.error("Args:", JSON.stringify(args, null, 2));

      const params: CompetitorBrandParams = {
        brands: args.brands as string[],
        country: args.country as string[] | undefined,
        period_days: (args.period_days as number) || 90,
      };

      const result = await compareCompetitorBrands(params);

      if (!result.success) {
        return {
          content: [{ type: "text", text: `Comparison failed: ${result.error}` }],
          isError: true,
        };
      }

      const searchDesc = getCompetitorBrandDescription(params);

      let markdown = `## Competitor Brand Comparison\n\n`;
      markdown += `**Criteria:** ${searchDesc}\n`;
      markdown += `**Download CSV:** ${result.downloadUrl}\n\n`;
      markdown += `| Brand | Collaborators | Sponsored Posts | Avg Engagement | Tier Distribution |\n`;
      markdown += `|-------|---------------|-----------------|----------------|-------------------|\n`;
      result.data.forEach((row: any) => {
        markdown += `| ${row.brand} | ${row.collaborator_count} | ${row.sponsored_posts} | ${row.avg_engagement || 'N/A'} | ${row.tier_distribution || 'N/A'} |\n`;
      });

      if (currentSessionHostType === "chatgpt") {
        return {
          structuredContent: {
            analysis: { type: "competitor_brands", criteria: searchDesc, brands: params.brands },
            data: result.data,
            downloadUrl: result.downloadUrl,
          },
          content: [{ type: "text", text: `Competitor comparison complete for ${params.brands.join(", ")}.\n\n**Download:** ${result.downloadUrl}` }],
          _meta: { downloadUrl: result.downloadUrl, totalRows: result.totalRows },
        };
      }
      return { content: [{ type: "text", text: markdown }] };
    } catch (error) {
      console.error("Competitor brand comparison error:", error);
      return {
        content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  }
);

// ============================================================================
// MARKET INSIGHTS TOOLS
// ============================================================================

// Register analyze_market_demographics tool
const MARKET_DEMOGRAPHICS_DESCRIPTION = `Analyze influencer demographics by market/country.

Returns distribution of influencers by gender, age range, collaboration tier, and occupation.
Useful for understanding market composition before campaign planning.

Example: Analyze the demographics of beauty influencers in Southeast Asia.`;

server.registerTool(
  "analyze_market_demographics",
  {
    title: "Analyze Market Demographics",
    description: MARKET_DEMOGRAPHICS_DESCRIPTION,
    inputSchema: {
      country: z
        .array(z.string())
        .min(1)
        .describe("ISO 3166-1 Alpha-2 country codes (required). Example: ['ID', 'TH', 'VN']"),
      interests: z
        .array(z.string())
        .optional()
        .describe("Interest categories. Example: ['Beauty', 'Fashion & Style']"),
      group_by: z
        .array(z.enum(["gender", "age_range", "collaboration_tier", "occupation"]))
        .optional()
        .describe("Grouping dimensions (default: ['gender', 'age_range'])"),
    },
    _meta: {
      "openai/toolInvocation/invoking": "Analyzing market demographics...",
      "openai/toolInvocation/invoked": "Demographics analysis complete",
    },
  },
  async (args) => {
    try {
      console.error("=== ANALYZE_MARKET_DEMOGRAPHICS ===");
      console.error("Args:", JSON.stringify(args, null, 2));

      const params: MarketDemographicsParams = {
        country: args.country as string[],
        interests: args.interests as string[] | undefined,
        group_by: args.group_by as ("gender" | "age_range" | "collaboration_tier" | "occupation")[] | undefined,
      };

      const result = await analyzeMarketDemographics(params);

      if (!result.success) {
        return {
          content: [{ type: "text", text: `Analysis failed: ${result.error}` }],
          isError: true,
        };
      }

      const searchDesc = getMarketDemographicsDescription(params);

      let markdown = `## Market Demographics Analysis\n\n`;
      markdown += `**Criteria:** ${searchDesc}\n`;
      markdown += `**Download CSV:** ${result.downloadUrl}\n\n`;

      // Build table header based on group_by
      const groupBy = params.group_by || ["gender", "age_range"];
      markdown += `| ${groupBy.join(" | ")} | Count | Avg Followers |\n`;
      markdown += `|${groupBy.map(() => "------").join("|")}|-------|---------------|\n`;
      result.data.slice(0, 20).forEach((row: any) => {
        const values = groupBy.map((g) => row[g] || "N/A");
        markdown += `| ${values.join(" | ")} | ${row.influencer_count} | ${row.avg_followers?.toLocaleString() || "N/A"} |\n`;
      });

      if (currentSessionHostType === "chatgpt") {
        return {
          structuredContent: {
            analysis: { type: "market_demographics", criteria: searchDesc },
            data: result.data,
            downloadUrl: result.downloadUrl,
          },
          content: [{ type: "text", text: `Market demographics analysis complete.\n\n**Download:** ${result.downloadUrl}` }],
          _meta: { downloadUrl: result.downloadUrl, totalRows: result.totalRows },
        };
      }
      return { content: [{ type: "text", text: markdown }] };
    } catch (error) {
      console.error("Market demographics error:", error);
      return {
        content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  }
);

// Register find_k_culture_influencers tool
const K_CULTURE_DESCRIPTION = `Find overseas influencers interested in K-culture (K-pop, K-beauty, K-drama, etc.).

Searches for influencers with k_interest=TRUE in specified countries.
Excludes Korea - focuses on international K-culture fans.

Example: Find Japanese and Vietnamese influencers interested in K-beauty.`;

server.registerTool(
  "find_k_culture_influencers",
  {
    title: "Find K-Culture Influencers",
    description: K_CULTURE_DESCRIPTION,
    inputSchema: {
      country: z
        .array(z.string())
        .min(1)
        .describe("ISO 3166-1 Alpha-2 country codes (excluding KR). Example: ['JP', 'VN', 'ID']"),
      interests: z
        .array(z.string())
        .optional()
        .describe("Interest categories. Example: ['Beauty', 'Fashion & Style']"),
      collaboration_tier: z
        .array(z.enum([
          "Ready - Premium",
          "Ready - Professional",
          "Potential - High",
          "Potential - Basic",
          "Personal Only",
        ]))
        .optional()
        .describe("Filter by collaboration tier"),
      min_followers: z
        .number()
        .min(0)
        .optional()
        .describe("Minimum follower count. Example: 10000"),
      limit: z
        .number()
        .min(1)
        .max(200)
        .default(50)
        .optional()
        .describe("Maximum results (default: 50)"),
    },
    _meta: {
      "openai/toolInvocation/invoking": "Finding K-culture influencers...",
      "openai/toolInvocation/invoked": "K-culture search complete",
    },
  },
  async (args) => {
    try {
      console.error("=== FIND_K_CULTURE_INFLUENCERS ===");
      console.error("Args:", JSON.stringify(args, null, 2));

      const params: KCultureInfluencerParams = {
        country: args.country as string[],
        interests: args.interests as string[] | undefined,
        collaboration_tier: args.collaboration_tier as string[] | undefined,
        min_followers: args.min_followers as number | undefined,
        limit: (args.limit as number) || 50,
      };

      const result = await findKCultureInfluencers(params);

      if (!result.success) {
        return {
          content: [{ type: "text", text: `Search failed: ${result.error}` }],
          isError: true,
        };
      }

      const searchDesc = getKCultureInfluencerDescription(params);

      let markdown = `## K-Culture Influencers\n\n`;
      markdown += `**Criteria:** ${searchDesc}\n`;
      markdown += `**Found:** ${result.totalRows} influencers\n`;
      markdown += `**Download CSV:** ${result.downloadUrl}\n\n`;
      markdown += `| Username | Followers | Country | K-Interest Reason |\n`;
      markdown += `|----------|-----------|---------|-------------------|\n`;
      result.data.slice(0, 15).forEach((row: any) => {
        const reason = row.k_interest_reason?.substring(0, 50) + (row.k_interest_reason?.length > 50 ? "..." : "") || "N/A";
        markdown += `| @${row.username} | ${row.follower_count?.toLocaleString() || "N/A"} | ${row.country} | ${reason} |\n`;
      });

      if (currentSessionHostType === "chatgpt") {
        return {
          structuredContent: {
            analysis: { type: "k_culture_influencers", criteria: searchDesc },
            data: result.data,
            downloadUrl: result.downloadUrl,
          },
          content: [{ type: "text", text: `Found ${result.totalRows} K-culture influencers.\n\n**Download:** ${result.downloadUrl}` }],
          _meta: { downloadUrl: result.downloadUrl, totalRows: result.totalRows },
        };
      }
      return { content: [{ type: "text", text: markdown }] };
    } catch (error) {
      console.error("K-culture search error:", error);
      return {
        content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  }
);

// Register analyze_lifestage_segments tool
const LIFESTAGE_DESCRIPTION = `Analyze influencer segments by lifestage (life stage).

Returns distribution and stats for lifestages like: Single, Married Without Child,
Married With Infant/Toddler, Married With Young Children, etc.

Example: Analyze parenting influencers by lifestage in Korea.`;

server.registerTool(
  "analyze_lifestage_segments",
  {
    title: "Analyze Lifestage Segments",
    description: LIFESTAGE_DESCRIPTION,
    inputSchema: {
      country: z
        .array(z.string())
        .optional()
        .describe("ISO 3166-1 Alpha-2 country codes. Example: ['KR']"),
      interests: z
        .array(z.string())
        .optional()
        .describe("Interest categories. Example: ['Child Care & Parenting', 'Beauty']"),
      lifestage: z
        .array(z.enum([
          "Single",
          "Married Without Child",
          "Married With Infant/Toddler",
          "Married With Young Children",
          "Married With Teenager",
          "Married With Child Over 18",
          "Single With Child",
          "Others",
          "Unknown",
        ]))
        .optional()
        .describe("Filter by specific lifestages"),
    },
    _meta: {
      "openai/toolInvocation/invoking": "Analyzing lifestage segments...",
      "openai/toolInvocation/invoked": "Lifestage analysis complete",
    },
  },
  async (args) => {
    try {
      console.error("=== ANALYZE_LIFESTAGE_SEGMENTS ===");
      console.error("Args:", JSON.stringify(args, null, 2));

      const params: LifestageSegmentParams = {
        country: args.country as string[] | undefined,
        interests: args.interests as string[] | undefined,
        lifestage: args.lifestage as string[] | undefined,
      };

      const result = await analyzeLifestageSegments(params);

      if (!result.success) {
        return {
          content: [{ type: "text", text: `Analysis failed: ${result.error}` }],
          isError: true,
        };
      }

      const searchDesc = getLifestageSegmentDescription(params);

      let markdown = `## Lifestage Segment Analysis\n\n`;
      markdown += `**Criteria:** ${searchDesc}\n`;
      markdown += `**Download CSV:** ${result.downloadUrl}\n\n`;
      markdown += `| Lifestage | Count | Avg Followers | Ready Tier % |\n`;
      markdown += `|-----------|-------|---------------|---------------|\n`;
      result.data.forEach((row: any) => {
        markdown += `| ${row.lifestage} | ${row.influencer_count} | ${row.avg_followers?.toLocaleString() || "N/A"} | ${row.ready_tier_pct}% |\n`;
      });

      if (currentSessionHostType === "chatgpt") {
        return {
          structuredContent: {
            analysis: { type: "lifestage_segments", criteria: searchDesc },
            data: result.data,
            downloadUrl: result.downloadUrl,
          },
          content: [{ type: "text", text: `Lifestage analysis complete.\n\n**Download:** ${result.downloadUrl}` }],
          _meta: { downloadUrl: result.downloadUrl, totalRows: result.totalRows },
        };
      }
      return { content: [{ type: "text", text: markdown }] };
    } catch (error) {
      console.error("Lifestage analysis error:", error);
      return {
        content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  }
);

// Register analyze_beauty_persona_segments tool
const BEAUTY_PERSONA_DESCRIPTION = `Analyze beauty influencer segments by skin type, concerns, and preferences.

Groups influencers by beauty persona characteristics for targeted campaigns.
Uses beauty profile data including skin type, concerns, personal color, and brand preferences.

Example: Find segments of Korean influencers with oily skin concerned about acne.`;

server.registerTool(
  "analyze_beauty_persona_segments",
  {
    title: "Analyze Beauty Persona Segments",
    description: BEAUTY_PERSONA_DESCRIPTION,
    inputSchema: {
      country: z
        .array(z.string())
        .optional()
        .describe("ISO 3166-1 Alpha-2 country codes. Example: ['KR', 'JP']"),
      skin_type: z
        .array(z.enum(["Oily", "Dry", "Combination", "Normal", "Sensitive"]))
        .optional()
        .describe("Filter by skin type"),
      skin_concerns: z
        .array(z.enum([
          "Acne",
          "Anti Aging",
          "Hydration",
          "Brightening",
          "Sensitive Skin",
          "Pore Care",
          "Dark Circles",
          "Pigmentation",
          "Oil Control",
        ]))
        .optional()
        .describe("Filter by skin concerns"),
      personal_color: z
        .enum(["Warm", "Cool", "Neutral", "Unknown"])
        .optional()
        .describe("Filter by personal color"),
      brand_tier_segments: z
        .enum(["Ultra Luxury", "Luxury", "Premium", "Drugstore", "Budget", "Mixed", "Unknown"])
        .optional()
        .describe("Filter by preferred brand tier"),
    },
    _meta: {
      "openai/toolInvocation/invoking": "Analyzing beauty persona segments...",
      "openai/toolInvocation/invoked": "Beauty persona analysis complete",
    },
  },
  async (args) => {
    try {
      console.error("=== ANALYZE_BEAUTY_PERSONA_SEGMENTS ===");
      console.error("Args:", JSON.stringify(args, null, 2));

      const params: BeautyPersonaParams = {
        country: args.country as string[] | undefined,
        skin_type: args.skin_type as string[] | undefined,
        skin_concerns: args.skin_concerns as string[] | undefined,
        personal_color: args.personal_color as string | undefined,
        brand_tier_segments: args.brand_tier_segments as string | undefined,
      };

      const result = await analyzeBeautyPersonaSegments(params);

      if (!result.success) {
        return {
          content: [{ type: "text", text: `Analysis failed: ${result.error}` }],
          isError: true,
        };
      }

      const searchDesc = getBeautyPersonaDescription(params);

      let markdown = `## Beauty Persona Segments\n\n`;
      markdown += `**Criteria:** ${searchDesc}\n`;
      markdown += `**Download CSV:** ${result.downloadUrl}\n\n`;
      markdown += `| Skin Type | Personal Color | Brand Tier | Count | Avg Followers |\n`;
      markdown += `|-----------|----------------|------------|-------|---------------|\n`;
      result.data.slice(0, 20).forEach((row: any) => {
        markdown += `| ${row.skin_type || "N/A"} | ${row.personal_color || "N/A"} | ${row.brand_tier_segments || "N/A"} | ${row.influencer_count} | ${row.avg_followers?.toLocaleString() || "N/A"} |\n`;
      });

      if (currentSessionHostType === "chatgpt") {
        return {
          structuredContent: {
            analysis: { type: "beauty_persona_segments", criteria: searchDesc },
            data: result.data,
            downloadUrl: result.downloadUrl,
          },
          content: [{ type: "text", text: `Beauty persona analysis complete.\n\n**Download:** ${result.downloadUrl}` }],
          _meta: { downloadUrl: result.downloadUrl, totalRows: result.totalRows },
        };
      }
      return { content: [{ type: "text", text: markdown }] };
    } catch (error) {
      console.error("Beauty persona analysis error:", error);
      return {
        content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  }
);

// ============================================================================
// CONTENT ANALYSIS TOOLS
// ============================================================================

// 1. analyze_engagement_metrics
server.tool(
  "analyze_engagement_metrics",
  getEngagementMetricsDescription(),
  {
    country: z
      .array(z.string())
      .optional()
      .describe("Country filter (ISO 3166-1 Alpha-2 codes)"),
    interests: z
      .array(z.string())
      .optional()
      .describe("Interest category filter"),
    collaboration_tier: z
      .array(z.enum([
        "Ready - Premium",
        "Ready - Professional",
        "Potential - High",
        "Potential - Basic",
        "Personal Only",
      ]))
      .optional()
      .describe("Collaboration tier filter"),
    period_days: z
      .number()
      .min(1)
      .max(365)
      .optional()
      .describe("Analysis period in days (default: 30)"),
    content_type: z
      .enum(["all", "media", "reels"])
      .optional()
      .describe("Content type filter (default: all)"),
  },
  async (params) => {
    try {
      const result = await analyzeEngagementMetrics(params as EngagementMetricsParams);

      if (!result.success) {
        return {
          content: [{ type: "text", text: `Analysis failed: ${result.error}` }],
          isError: true,
        };
      }

      let markdown = `## Engagement Metrics Analysis\n\n`;
      markdown += `**Download CSV:** ${result.downloadUrl}\n\n`;

      if (result.data.length > 0) {
        const row: any = result.data[0];
        markdown += `| Metric | Value |\n`;
        markdown += `|--------|-------|\n`;
        markdown += `| Total Content | ${row.total_content?.toLocaleString() || "N/A"} |\n`;
        markdown += `| Unique Influencers | ${row.unique_influencers?.toLocaleString() || "N/A"} |\n`;
        markdown += `| Avg Likes | ${row.avg_likes?.toLocaleString() || "N/A"} |\n`;
        markdown += `| Median Likes | ${row.median_likes?.toLocaleString() || "N/A"} |\n`;
        markdown += `| Avg Comments | ${row.avg_comments?.toLocaleString() || "N/A"} |\n`;
        markdown += `| Median Comments | ${row.median_comments?.toLocaleString() || "N/A"} |\n`;
        markdown += `| Avg Engagement Rate | ${row.avg_engagement_rate}% |\n`;
        markdown += `| P90 Likes | ${row.p90_likes?.toLocaleString() || "N/A"} |\n`;
        markdown += `| P95 Likes | ${row.p95_likes?.toLocaleString() || "N/A"} |\n`;
      }

      if (currentSessionHostType === "chatgpt") {
        return {
          structuredContent: {
            analysis: { type: "engagement_metrics", params },
            data: result.data,
            downloadUrl: result.downloadUrl,
          },
          content: [{ type: "text", text: `Engagement metrics analysis complete.\n\n**Download:** ${result.downloadUrl}` }],
          _meta: { downloadUrl: result.downloadUrl, totalRows: result.totalRows },
        };
      }
      return { content: [{ type: "text", text: markdown }] };
    } catch (error) {
      console.error("Engagement metrics analysis error:", error);
      return {
        content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  }
);

// 2. compare_content_formats
server.tool(
  "compare_content_formats",
  getContentFormatsDescription(),
  {
    country: z
      .array(z.string())
      .optional()
      .describe("Country filter (ISO 3166-1 Alpha-2 codes)"),
    interests: z
      .array(z.string())
      .optional()
      .describe("Interest category filter"),
    period_days: z
      .number()
      .min(1)
      .max(365)
      .optional()
      .describe("Analysis period in days (default: 90)"),
  },
  async (params) => {
    try {
      const result = await compareContentFormats(params as ContentFormatsParams);

      if (!result.success) {
        return {
          content: [{ type: "text", text: `Analysis failed: ${result.error}` }],
          isError: true,
        };
      }

      let markdown = `## Content Format Comparison\n\n`;
      markdown += `**Download CSV:** ${result.downloadUrl}\n\n`;
      markdown += `| Format | Count | Influencers | Avg Likes | Avg Comments | Engagement Rate |\n`;
      markdown += `|--------|-------|-------------|-----------|--------------|----------------|\n`;
      result.data.forEach((row: any) => {
        markdown += `| ${row.content_type} | ${row.content_count?.toLocaleString()} | ${row.unique_influencers?.toLocaleString()} | ${row.avg_likes?.toLocaleString()} | ${row.avg_comments?.toLocaleString()} | ${row.avg_engagement_rate}% |\n`;
      });

      if (currentSessionHostType === "chatgpt") {
        return {
          structuredContent: {
            analysis: { type: "content_format_comparison", params },
            data: result.data,
            downloadUrl: result.downloadUrl,
          },
          content: [{ type: "text", text: `Content format comparison complete.\n\n**Download:** ${result.downloadUrl}` }],
          _meta: { downloadUrl: result.downloadUrl, totalRows: result.totalRows },
        };
      }
      return { content: [{ type: "text", text: markdown }] };
    } catch (error) {
      console.error("Content format comparison error:", error);
      return {
        content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  }
);

// 3. find_optimal_posting_time
server.tool(
  "find_optimal_posting_time",
  getOptimalPostingTimeDescription(),
  {
    country: z
      .array(z.string())
      .optional()
      .describe("Country filter (ISO 3166-1 Alpha-2 codes)"),
    interests: z
      .array(z.string())
      .optional()
      .describe("Interest category filter"),
    period_days: z
      .number()
      .min(1)
      .max(365)
      .optional()
      .describe("Analysis period in days (default: 90)"),
  },
  async (params) => {
    try {
      const result = await findOptimalPostingTime(params as OptimalPostingTimeParams);

      if (!result.success) {
        return {
          content: [{ type: "text", text: `Analysis failed: ${result.error}` }],
          isError: true,
        };
      }

      const dayNames = ["", "Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

      let markdown = `## Optimal Posting Time Analysis\n\n`;
      markdown += `**Download CSV:** ${result.downloadUrl}\n\n`;
      markdown += `| Day | Hour | Posts | Avg Likes | Engagement Rate |\n`;
      markdown += `|-----|------|-------|-----------|----------------|\n`;
      result.data.slice(0, 20).forEach((row: any) => {
        const dayName = dayNames[row.day_of_week] || row.day_of_week;
        markdown += `| ${dayName} | ${row.hour}:00 | ${row.post_count?.toLocaleString()} | ${row.avg_likes?.toLocaleString()} | ${row.avg_engagement_rate}% |\n`;
      });

      if (currentSessionHostType === "chatgpt") {
        return {
          structuredContent: {
            analysis: { type: "optimal_posting_time", params },
            data: result.data,
            downloadUrl: result.downloadUrl,
          },
          content: [{ type: "text", text: `Optimal posting time analysis complete.\n\n**Download:** ${result.downloadUrl}` }],
          _meta: { downloadUrl: result.downloadUrl, totalRows: result.totalRows },
        };
      }
      return { content: [{ type: "text", text: markdown }] };
    } catch (error) {
      console.error("Optimal posting time analysis error:", error);
      return {
        content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  }
);

// 4. analyze_viral_content_patterns
server.tool(
  "analyze_viral_content_patterns",
  getViralContentDescription(),
  {
    country: z
      .array(z.string())
      .optional()
      .describe("Country filter (ISO 3166-1 Alpha-2 codes)"),
    interests: z
      .array(z.string())
      .optional()
      .describe("Interest category filter"),
    viral_threshold: z
      .number()
      .min(1000)
      .optional()
      .describe("Minimum likes to be considered viral (default: 100000)"),
    period_days: z
      .number()
      .min(1)
      .max(365)
      .optional()
      .describe("Analysis period in days (default: 180)"),
  },
  async (params) => {
    try {
      const result = await analyzeViralContentPatterns(params as ViralContentParams);

      if (!result.success) {
        return {
          content: [{ type: "text", text: `Analysis failed: ${result.error}` }],
          isError: true,
        };
      }

      let markdown = `## Viral Content Pattern Analysis\n\n`;
      markdown += `**Download CSV:** ${result.downloadUrl}\n\n`;

      if (result.data.length > 0) {
        const row: any = result.data[0];
        markdown += `| Metric | Value |\n`;
        markdown += `|--------|-------|\n`;
        markdown += `| Viral Content Count | ${row.viral_content_count?.toLocaleString() || "N/A"} |\n`;
        markdown += `| Unique Creators | ${row.unique_creators?.toLocaleString() || "N/A"} |\n`;
        markdown += `| Avg Likes | ${row.avg_likes?.toLocaleString() || "N/A"} |\n`;
        markdown += `| Avg Comments | ${row.avg_comments?.toLocaleString() || "N/A"} |\n`;
        markdown += `| Avg Caption Length | ${row.avg_caption_length?.toLocaleString() || "N/A"} chars |\n`;
      }

      if (currentSessionHostType === "chatgpt") {
        return {
          structuredContent: {
            analysis: { type: "viral_content_patterns", params },
            data: result.data,
            downloadUrl: result.downloadUrl,
          },
          content: [{ type: "text", text: `Viral content pattern analysis complete.\n\n**Download:** ${result.downloadUrl}` }],
          _meta: { downloadUrl: result.downloadUrl, totalRows: result.totalRows },
        };
      }
      return { content: [{ type: "text", text: markdown }] };
    } catch (error) {
      console.error("Viral content pattern analysis error:", error);
      return {
        content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  }
);

// 5. analyze_beauty_content_performance
server.tool(
  "analyze_beauty_content_performance",
  getBeautyContentDescription(),
  {
    country: z
      .array(z.string())
      .optional()
      .describe("Country filter (ISO 3166-1 Alpha-2 codes)"),
    beauty_content_types: z
      .array(z.enum([
        "Makeup Tutorial",
        "Product Review",
        "Skincare Routine",
        "GRWM",
        "Unboxing",
        "Before After",
        "Haul",
        "Look Recreation",
      ]))
      .optional()
      .describe("Beauty content type filter"),
    period_days: z
      .number()
      .min(1)
      .max(365)
      .optional()
      .describe("Analysis period in days (default: 90)"),
  },
  async (params) => {
    try {
      const result = await analyzeBeautyContentPerformance(params as BeautyContentParams);

      if (!result.success) {
        return {
          content: [{ type: "text", text: `Analysis failed: ${result.error}` }],
          isError: true,
        };
      }

      let markdown = `## Beauty Content Performance Analysis\n\n`;
      markdown += `**Download CSV:** ${result.downloadUrl}\n\n`;
      markdown += `| Content Type | Influencers | Content Count | Avg Likes | Engagement Rate |\n`;
      markdown += `|--------------|-------------|---------------|-----------|----------------|\n`;
      result.data.forEach((row: any) => {
        markdown += `| ${row.beauty_content_type} | ${row.influencer_count?.toLocaleString()} | ${row.content_count?.toLocaleString()} | ${row.avg_likes?.toLocaleString()} | ${row.avg_engagement_rate}% |\n`;
      });

      if (currentSessionHostType === "chatgpt") {
        return {
          structuredContent: {
            analysis: { type: "beauty_content_performance", params },
            data: result.data,
            downloadUrl: result.downloadUrl,
          },
          content: [{ type: "text", text: `Beauty content performance analysis complete.\n\n**Download:** ${result.downloadUrl}` }],
          _meta: { downloadUrl: result.downloadUrl, totalRows: result.totalRows },
        };
      }
      return { content: [{ type: "text", text: markdown }] };
    } catch (error) {
      console.error("Beauty content performance analysis error:", error);
      return {
        content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  }
);

// ============================================================================
// MULTI-PLATFORM/LINK ANALYSIS TOOLS
// ============================================================================

// 1. search_multiplatform_influencers
server.tool(
  "search_multiplatform_influencers",
  getMultiplatformInfluencersDescription(),
  {
    country: z
      .array(z.string())
      .optional()
      .describe("Country filter (ISO 3166-1 Alpha-2 codes)"),
    interests: z
      .array(z.string())
      .optional()
      .describe("Interest category filter"),
    required_channels: z
      .array(z.enum([
        "youtube",
        "tiktok",
        "twitter",
        "facebook",
        "linkedin",
        "snapchat",
        "telegram",
        "whatsapp",
      ]))
      .optional()
      .describe("Required SNS channels (influencer MUST have all)"),
    optional_channels: z
      .array(z.enum([
        "youtube",
        "tiktok",
        "twitter",
        "facebook",
        "linkedin",
        "snapchat",
        "telegram",
        "whatsapp",
      ]))
      .optional()
      .describe("Optional SNS channels to include"),
    collaboration_tier: z
      .array(z.enum([
        "Ready - Premium",
        "Ready - Professional",
        "Potential - High",
        "Potential - Basic",
        "Personal Only",
      ]))
      .optional()
      .describe("Collaboration tier filter"),
    limit: z
      .number()
      .min(1)
      .max(1000)
      .optional()
      .describe("Maximum results (default: 100)"),
  },
  async (params) => {
    try {
      const result = await searchMultiplatformInfluencers(params as MultiplatformInfluencersParams);

      if (!result.success) {
        return {
          content: [{ type: "text", text: `Search failed: ${result.error}` }],
          isError: true,
        };
      }

      let markdown = `## Multi-platform Influencer Search Results\n\n`;
      markdown += `**Total:** ${result.totalRows} influencers\n`;
      markdown += `**Download CSV:** ${result.downloadUrl}\n\n`;
      markdown += `| Username | Followers | Channels | Tier |\n`;
      markdown += `|----------|-----------|----------|------|\n`;
      result.data.slice(0, 20).forEach((row: any) => {
        const channels = Array.isArray(row.channels) ? row.channels.join(", ") : row.channels;
        markdown += `| ${row.username} | ${row.followed_by?.toLocaleString() || "N/A"} | ${channels} | ${row.collaboration_tier} |\n`;
      });
      if (result.totalRows > 20) {
        markdown += `\n_...and ${result.totalRows - 20} more. Download CSV for full list._\n`;
      }

      if (currentSessionHostType === "chatgpt") {
        return {
          structuredContent: {
            search: { type: "multiplatform_influencers", params },
            data: result.data,
            downloadUrl: result.downloadUrl,
          },
          content: [{ type: "text", text: `Found ${result.totalRows} multi-platform influencers.\n\n**Download:** ${result.downloadUrl}` }],
          _meta: { downloadUrl: result.downloadUrl, totalRows: result.totalRows },
        };
      }
      return { content: [{ type: "text", text: markdown }] };
    } catch (error) {
      console.error("Multi-platform influencer search error:", error);
      return {
        content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  }
);

// 2. find_influencers_with_shopping_links
server.tool(
  "find_influencers_with_shopping_links",
  getShoppingLinksDescription(),
  {
    country: z
      .array(z.string())
      .optional()
      .describe("Country filter (ISO 3166-1 Alpha-2 codes)"),
    interests: z
      .array(z.string())
      .optional()
      .describe("Interest category filter"),
    shopping_channels: z
      .array(z.enum([
        "amazon",
        "coupang",
        "rakuten",
        "sephora",
        "shopee",
        "shopltk",
      ]))
      .optional()
      .describe("Shopping platform filter"),
    collaboration_tier: z
      .array(z.enum([
        "Ready - Premium",
        "Ready - Professional",
        "Potential - High",
        "Potential - Basic",
        "Personal Only",
      ]))
      .optional()
      .describe("Collaboration tier filter"),
    limit: z
      .number()
      .min(1)
      .max(1000)
      .optional()
      .describe("Maximum results (default: 100)"),
  },
  async (params) => {
    try {
      const result = await findInfluencersWithShoppingLinks(params as ShoppingLinksParams);

      if (!result.success) {
        return {
          content: [{ type: "text", text: `Search failed: ${result.error}` }],
          isError: true,
        };
      }

      let markdown = `## Influencers with Shopping Links\n\n`;
      markdown += `**Total:** ${result.totalRows} influencers\n`;
      markdown += `**Download CSV:** ${result.downloadUrl}\n\n`;
      markdown += `| Username | Followers | Shopping Channels | Tier |\n`;
      markdown += `|----------|-----------|-------------------|------|\n`;
      result.data.slice(0, 20).forEach((row: any) => {
        const channels = Array.isArray(row.shopping_channels) ? row.shopping_channels.join(", ") : row.shopping_channels;
        markdown += `| ${row.username} | ${row.followed_by?.toLocaleString() || "N/A"} | ${channels} | ${row.collaboration_tier} |\n`;
      });
      if (result.totalRows > 20) {
        markdown += `\n_...and ${result.totalRows - 20} more. Download CSV for full list._\n`;
      }

      if (currentSessionHostType === "chatgpt") {
        return {
          structuredContent: {
            search: { type: "shopping_links_influencers", params },
            data: result.data,
            downloadUrl: result.downloadUrl,
          },
          content: [{ type: "text", text: `Found ${result.totalRows} influencers with shopping links.\n\n**Download:** ${result.downloadUrl}` }],
          _meta: { downloadUrl: result.downloadUrl, totalRows: result.totalRows },
        };
      }
      return { content: [{ type: "text", text: markdown }] };
    } catch (error) {
      console.error("Shopping links influencer search error:", error);
      return {
        content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  }
);

// 3. find_contactable_influencers
server.tool(
  "find_contactable_influencers",
  getContactableInfluencersDescription(),
  {
    country: z
      .array(z.string())
      .optional()
      .describe("Country filter (ISO 3166-1 Alpha-2 codes)"),
    interests: z
      .array(z.string())
      .optional()
      .describe("Interest category filter"),
    contact_channels: z
      .array(z.enum([
        "email",
        "blog",
        "kakaotalk",
      ]))
      .optional()
      .describe("Contact channel filter"),
    collaboration_tier: z
      .array(z.enum([
        "Ready - Premium",
        "Ready - Professional",
        "Potential - High",
        "Potential - Basic",
        "Personal Only",
      ]))
      .optional()
      .describe("Collaboration tier filter"),
    limit: z
      .number()
      .min(1)
      .max(1000)
      .optional()
      .describe("Maximum results (default: 100)"),
  },
  async (params) => {
    try {
      const result = await findContactableInfluencers(params as ContactableInfluencersParams);

      if (!result.success) {
        return {
          content: [{ type: "text", text: `Search failed: ${result.error}` }],
          isError: true,
        };
      }

      let markdown = `## Contactable Influencers\n\n`;
      markdown += `**Total:** ${result.totalRows} influencers\n`;
      markdown += `**Download CSV:** ${result.downloadUrl}\n\n`;
      markdown += `| Username | Followers | Contact Channels | Tier |\n`;
      markdown += `|----------|-----------|------------------|------|\n`;
      result.data.slice(0, 20).forEach((row: any) => {
        const channels = Array.isArray(row.contact_channels) ? row.contact_channels.join(", ") : row.contact_channels;
        markdown += `| ${row.username} | ${row.followed_by?.toLocaleString() || "N/A"} | ${channels} | ${row.collaboration_tier} |\n`;
      });
      if (result.totalRows > 20) {
        markdown += `\n_...and ${result.totalRows - 20} more. Download CSV for full list._\n`;
      }

      if (currentSessionHostType === "chatgpt") {
        return {
          structuredContent: {
            search: { type: "contactable_influencers", params },
            data: result.data,
            downloadUrl: result.downloadUrl,
          },
          content: [{ type: "text", text: `Found ${result.totalRows} contactable influencers.\n\n**Download:** ${result.downloadUrl}` }],
          _meta: { downloadUrl: result.downloadUrl, totalRows: result.totalRows },
        };
      }
      return { content: [{ type: "text", text: markdown }] };
    } catch (error) {
      console.error("Contactable influencer search error:", error);
      return {
        content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  }
);

// 4. analyze_platform_distribution
server.tool(
  "analyze_platform_distribution",
  getPlatformDistributionDescription(),
  {
    country: z
      .array(z.string())
      .optional()
      .describe("Country filter (ISO 3166-1 Alpha-2 codes)"),
    interests: z
      .array(z.string())
      .optional()
      .describe("Interest category filter"),
    collaboration_tier: z
      .array(z.enum([
        "Ready - Premium",
        "Ready - Professional",
        "Potential - High",
        "Potential - Basic",
        "Personal Only",
      ]))
      .optional()
      .describe("Collaboration tier filter"),
    link_type: z
      .enum(["all", "sns", "shopping", "contact"])
      .optional()
      .describe("Link type filter (default: all)"),
  },
  async (params) => {
    try {
      const result = await analyzePlatformDistribution(params as PlatformDistributionParams);

      if (!result.success) {
        return {
          content: [{ type: "text", text: `Analysis failed: ${result.error}` }],
          isError: true,
        };
      }

      let markdown = `## Platform Distribution Analysis\n\n`;
      markdown += `**Download CSV:** ${result.downloadUrl}\n\n`;
      markdown += `| Type | Channel | Influencers | Percentage |\n`;
      markdown += `|------|---------|-------------|------------|\n`;
      result.data.forEach((row: any) => {
        markdown += `| ${row.link_type} | ${row.channel} | ${row.influencer_count?.toLocaleString()} | ${row.percentage}% |\n`;
      });

      if (currentSessionHostType === "chatgpt") {
        return {
          structuredContent: {
            analysis: { type: "platform_distribution", params },
            data: result.data,
            downloadUrl: result.downloadUrl,
          },
          content: [{ type: "text", text: `Platform distribution analysis complete.\n\n**Download:** ${result.downloadUrl}` }],
          _meta: { downloadUrl: result.downloadUrl, totalRows: result.totalRows },
        };
      }
      return { content: [{ type: "text", text: markdown }] };
    } catch (error) {
      console.error("Platform distribution analysis error:", error);
      return {
        content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
        isError: true,
      };
    }
  }
);

// 5. compare_platform_presence
server.tool(
  "compare_platform_presence",
  getPlatformPresenceDescription(),
  {
    brands: z
      .array(z.string())
      .min(1)
      .describe("Brand names to compare (required)"),
    channels: z
      .array(z.string())
      .optional()
      .describe("Specific channels to analyze (optional)"),
  },
  async (params) => {
    try {
      const result = await comparePlatformPresence(params as PlatformPresenceParams);

      if (!result.success) {
        return {
          content: [{ type: "text", text: `Analysis failed: ${result.error}` }],
          isError: true,
        };
      }

      let markdown = `## Brand Platform Presence Comparison\n\n`;
      markdown += `**Download CSV:** ${result.downloadUrl}\n\n`;
      markdown += `| Brand | Type | Channel | Influencers | Total | Percentage |\n`;
      markdown += `|-------|------|---------|-------------|-------|------------|\n`;
      result.data.forEach((row: any) => {
        markdown += `| ${row.brand} | ${row.link_type} | ${row.channel} | ${row.influencer_count?.toLocaleString()} | ${row.total_collaborators?.toLocaleString()} | ${row.percentage}% |\n`;
      });

      if (currentSessionHostType === "chatgpt") {
        return {
          structuredContent: {
            analysis: { type: "platform_presence_comparison", params },
            data: result.data,
            downloadUrl: result.downloadUrl,
          },
          content: [{ type: "text", text: `Brand platform presence comparison complete.\n\n**Download:** ${result.downloadUrl}` }],
          _meta: { downloadUrl: result.downloadUrl, totalRows: result.totalRows },
        };
      }
      return { content: [{ type: "text", text: markdown }] };
    } catch (error) {
      console.error("Platform presence comparison error:", error);
      return {
        content: [{ type: "text", text: `Error: ${error instanceof Error ? error.message : String(error)}` }],
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

  // Detect host type for POST /mcp (ChatGPT Apps uses POST)
  currentSessionHostType = detectHostType(req);
  console.error(`Detected host type: ${currentSessionHostType}`);

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
        // Access MCP server's registered tools
        const registeredTools = (server as any)._registeredTools || {};
        const toolsList = Object.entries(registeredTools).map(([name, tool]: [string, any]) => {
          // Convert Zod schema to JSON Schema for ChatGPT compatibility
          let jsonSchema: any = { type: "object", properties: {} };
          try {
            if (tool.inputSchema && typeof tool.inputSchema === "object") {
              // Check if it's a Zod schema (has _def property)
              if (tool.inputSchema._def) {
                jsonSchema = zodToJsonSchema(tool.inputSchema, { target: "openApi3" });
              } else {
                // Already JSON Schema
                jsonSchema = tool.inputSchema;
              }
            }
          } catch (e) {
            console.error(`Failed to convert schema for ${name}:`, e);
          }
          return {
            name,
            description: tool.description,
            inputSchema: jsonSchema,
            _meta: tool.annotations?._meta || {},
          };
        });
        console.error(`Returning ${toolsList.length} tools`);
        res.json({
          jsonrpc: "2.0",
          id: id,
          result: {
            tools: toolsList,
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
        } else {
          // Delegate to MCP server's registered tools
          const registeredToolsForCall = (server as any)._registeredTools || {};
          console.error(`=== REGISTERED TOOLS DEBUG ===`);
          console.error(`Available tools: ${Object.keys(registeredToolsForCall).join(', ')}`);
          console.error(`Looking for: ${toolName}`);
          const registeredTool = registeredToolsForCall[toolName];
          console.error(`Found tool: ${!!registeredTool}, Has callback: ${!!(registeredTool?.callback)}`);

          if (registeredTool && registeredTool.callback) {
            try {
              console.error(`Delegating to registered tool: ${toolName}`);
              const result = await registeredTool.callback(toolArgs, {});
              res.json({
                jsonrpc: "2.0",
                id: id,
                result: result,
              });
            } catch (toolError) {
              const errorMessage = toolError instanceof Error ? toolError.message : String(toolError);
              console.error(`Tool ${toolName} error:`, errorMessage);
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
