/**
 * Multi-platform/Link Analysis API Module
 *
 * Provides tools for analyzing influencer multi-platform presence:
 * 1. search_multiplatform_influencers - Search multi-platform influencers
 * 2. find_influencers_with_shopping_links - Find influencers with shopping links
 * 3. find_contactable_influencers - Find contactable influencers
 * 4. analyze_platform_distribution - Analyze platform distribution
 * 5. compare_platform_presence - Compare brand platform presence
 */

import { executeQuery, validateQuery, toCSV } from "./bigquery.js";
import { uploadCSV } from "./gcs.js";

// ============================================================================
// Common Types
// ============================================================================

export interface MultiplatformResult {
  success: boolean;
  data: Record<string, unknown>[];
  totalRows: number;
  downloadUrl: string;
  query: string;
  error?: string;
}

// Helper function to escape SQL strings
function escapeSQL(str: string): string {
  return str.replace(/'/g, "\\'");
}

// ============================================================================
// 1. search_multiplatform_influencers
// ============================================================================

export interface MultiplatformInfluencersParams {
  country?: string[];
  interests?: string[];
  required_channels?: string[];
  optional_channels?: string[];
  collaboration_tier?: string[];
  limit?: number;
}

/**
 * Build SQL query for multi-platform influencer search
 */
function buildMultiplatformInfluencersQuery(
  params: MultiplatformInfluencersParams
): string {
  const limit = params.limit || 100;

  // Build profile filter conditions
  const profileConditions: string[] = [];

  if (params.country?.length) {
    const countryConditions = params.country
      .map((c) => `'${escapeSQL(c)}' IN UNNEST(g.country)`)
      .join(" OR ");
    profileConditions.push(`(${countryConditions})`);
  }

  if (params.interests?.length) {
    const interestConditions = params.interests
      .map((i) => `'${escapeSQL(i)}' IN UNNEST(g.interests)`)
      .join(" OR ");
    profileConditions.push(`(${interestConditions})`);
  }

  if (params.collaboration_tier?.length) {
    const tierConditions = params.collaboration_tier
      .map((t) => `g.collaboration_tier = '${escapeSQL(t)}'`)
      .join(" OR ");
    profileConditions.push(`(${tierConditions})`);
  }

  const profileWhereClause =
    profileConditions.length > 0 ? profileConditions.join(" AND ") : "1=1";

  // Build required channels condition
  let requiredChannelsCondition = "";
  if (params.required_channels?.length) {
    const channelChecks = params.required_channels
      .map((ch) => `'${escapeSQL(ch)}' IN UNNEST(ic.channels)`)
      .join(" AND ");
    requiredChannelsCondition = `AND ${channelChecks}`;
  }

  const sql = `
WITH influencer_channels AS (
  SELECT
    l.user_id,
    ARRAY_AGG(DISTINCT l.channel) as channels,
    COUNT(DISTINCT l.channel) as channel_count
  FROM \`mmm-lab.sns.insta_user_links_v3\` l
  WHERE l.type = 'sns'
  GROUP BY l.user_id
),
filtered_influencers AS (
  SELECT
    g.user_id,
    p.username,
    p.followed_by,
    g.collaboration_tier,
    ic.channels,
    ic.channel_count
  FROM \`mmm-lab.gpt_profile.insta_general_profiles\` g
  JOIN influencer_channels ic ON g.user_id = ic.user_id
  LEFT JOIN \`mmm-lab.sns.insta_profile_mmm_v3\` p ON g.user_id = p.user_id
  WHERE ${profileWhereClause}
    ${requiredChannelsCondition}
),
channel_urls AS (
  SELECT
    l.user_id,
    ARRAY_AGG(STRUCT(l.channel as channel, l.urls as urls)) as channel_details
  FROM \`mmm-lab.sns.insta_user_links_v3\` l
  WHERE l.type = 'sns'
  GROUP BY l.user_id
)
SELECT
  f.user_id,
  f.username,
  f.followed_by,
  f.collaboration_tier,
  f.channels,
  f.channel_count,
  cu.channel_details
FROM filtered_influencers f
LEFT JOIN channel_urls cu ON f.user_id = cu.user_id
ORDER BY f.followed_by DESC NULLS LAST
LIMIT ${limit}
`;

  return sql;
}

export async function searchMultiplatformInfluencers(
  params: MultiplatformInfluencersParams
): Promise<MultiplatformResult> {
  try {
    const query = buildMultiplatformInfluencersQuery(params);

    // Validate query first
    const validation = await validateQuery(query);
    if (!validation.valid) {
      return {
        success: false,
        data: [],
        totalRows: 0,
        downloadUrl: "",
        query,
        error: `Query validation failed: ${validation.error}`,
      };
    }

    // Execute query
    const result = await executeQuery(query);

    // Generate CSV and upload
    const csv = toCSV(result);
    const { publicUrl } = await uploadCSV(csv, "multiplatform_influencers");

    return {
      success: true,
      data: result.rows,
      totalRows: result.totalRows,
      downloadUrl: publicUrl,
      query,
    };
  } catch (error) {
    return {
      success: false,
      data: [],
      totalRows: 0,
      downloadUrl: "",
      query: "",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function getMultiplatformInfluencersDescription(): string {
  return `Search for influencers active on multiple platforms (YouTube, TikTok, etc.)

## Parameters
- **country** (optional): Array of country codes (ISO 3166-1 Alpha-2)
- **interests** (optional): Array of interest categories
- **required_channels** (optional): Array of channels the influencer MUST have (e.g., ["youtube", "tiktok"])
- **optional_channels** (optional): Array of additional channels to include
- **collaboration_tier** (optional): Array of collaboration tiers
- **limit** (optional): Maximum results (default: 100)

## Available SNS Channels
youtube, tiktok, twitter, facebook, linkedin, snapchat, telegram, whatsapp

## Output
- user_id, username, followed_by
- channels: Array of owned channels
- channel_count: Number of platforms
- channel_details: URLs for each channel

## Use Cases
- "Find Beauty influencers with both YouTube and Instagram"
- "Search for Korean creators active on TikTok + Instagram"`;
}

// ============================================================================
// 2. find_influencers_with_shopping_links
// ============================================================================

export interface ShoppingLinksParams {
  country?: string[];
  interests?: string[];
  shopping_channels?: string[];
  collaboration_tier?: string[];
  limit?: number;
}

function buildShoppingLinksQuery(params: ShoppingLinksParams): string {
  const limit = params.limit || 100;

  // Build profile filter conditions
  const profileConditions: string[] = [];

  if (params.country?.length) {
    const countryConditions = params.country
      .map((c) => `'${escapeSQL(c)}' IN UNNEST(g.country)`)
      .join(" OR ");
    profileConditions.push(`(${countryConditions})`);
  }

  if (params.interests?.length) {
    const interestConditions = params.interests
      .map((i) => `'${escapeSQL(i)}' IN UNNEST(g.interests)`)
      .join(" OR ");
    profileConditions.push(`(${interestConditions})`);
  }

  if (params.collaboration_tier?.length) {
    const tierConditions = params.collaboration_tier
      .map((t) => `g.collaboration_tier = '${escapeSQL(t)}'`)
      .join(" OR ");
    profileConditions.push(`(${tierConditions})`);
  }

  const profileWhereClause =
    profileConditions.length > 0 ? profileConditions.join(" AND ") : "1=1";

  // Build shopping channel filter
  let shoppingChannelCondition = "";
  if (params.shopping_channels?.length) {
    const channels = params.shopping_channels
      .map((ch) => `'${escapeSQL(ch)}'`)
      .join(", ");
    shoppingChannelCondition = `AND l.channel IN (${channels})`;
  }

  const sql = `
WITH shopping_links AS (
  SELECT
    l.user_id,
    ARRAY_AGG(DISTINCT l.channel) as shopping_channels,
    ARRAY_AGG(STRUCT(l.channel as channel, l.urls as urls)) as shopping_details,
    COUNT(DISTINCT l.channel) as shopping_channel_count
  FROM \`mmm-lab.sns.insta_user_links_v3\` l
  WHERE l.type = 'shopping'
    ${shoppingChannelCondition}
  GROUP BY l.user_id
)
SELECT
  g.user_id,
  p.username,
  p.followed_by,
  g.collaboration_tier,
  sl.shopping_channels,
  sl.shopping_channel_count,
  sl.shopping_details
FROM \`mmm-lab.gpt_profile.insta_general_profiles\` g
JOIN shopping_links sl ON g.user_id = sl.user_id
LEFT JOIN \`mmm-lab.sns.insta_profile_mmm_v3\` p ON g.user_id = p.user_id
WHERE ${profileWhereClause}
ORDER BY p.followed_by DESC NULLS LAST
LIMIT ${limit}
`;

  return sql;
}

export async function findInfluencersWithShoppingLinks(
  params: ShoppingLinksParams
): Promise<MultiplatformResult> {
  try {
    const query = buildShoppingLinksQuery(params);

    const validation = await validateQuery(query);
    if (!validation.valid) {
      return {
        success: false,
        data: [],
        totalRows: 0,
        downloadUrl: "",
        query,
        error: `Query validation failed: ${validation.error}`,
      };
    }

    const result = await executeQuery(query);

    const csv = toCSV(result);
    const { publicUrl } = await uploadCSV(csv, "shopping_links_influencers");

    return {
      success: true,
      data: result.rows,
      totalRows: result.totalRows,
      downloadUrl: publicUrl,
      query,
    };
  } catch (error) {
    return {
      success: false,
      data: [],
      totalRows: 0,
      downloadUrl: "",
      query: "",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function getShoppingLinksDescription(): string {
  return `Find influencers with shopping/affiliate links (suitable for affiliate marketing)

## Parameters
- **country** (optional): Array of country codes
- **interests** (optional): Array of interest categories
- **shopping_channels** (optional): Filter by specific shopping platforms
- **collaboration_tier** (optional): Array of collaboration tiers
- **limit** (optional): Maximum results (default: 100)

## Available Shopping Channels
| Channel | Description | Primary Market |
|---------|-------------|----------------|
| amazon | Amazon Associates/Storefront | US, Global |
| shopltk | LTK (LikeToKnow.it) | US |
| sephora | Sephora Squad/Affiliate | US, Global |
| shopee | Shopee Affiliate | SEA |
| coupang | Coupang Partners | KR |
| rakuten | Rakuten Affiliate | JP |

## Output
- user_id, username, followed_by
- shopping_channels: Array of shopping platforms
- shopping_details: URLs for each platform

## Use Cases
- "Find US Beauty influencers with Amazon storefronts"
- "Search for Korean influencers with Coupang affiliate links"`;
}

// ============================================================================
// 3. find_contactable_influencers
// ============================================================================

export interface ContactableInfluencersParams {
  country?: string[];
  interests?: string[];
  contact_channels?: string[];
  collaboration_tier?: string[];
  limit?: number;
}

function buildContactableInfluencersQuery(
  params: ContactableInfluencersParams
): string {
  const limit = params.limit || 100;

  // Build profile filter conditions
  const profileConditions: string[] = [];

  if (params.country?.length) {
    const countryConditions = params.country
      .map((c) => `'${escapeSQL(c)}' IN UNNEST(g.country)`)
      .join(" OR ");
    profileConditions.push(`(${countryConditions})`);
  }

  if (params.interests?.length) {
    const interestConditions = params.interests
      .map((i) => `'${escapeSQL(i)}' IN UNNEST(g.interests)`)
      .join(" OR ");
    profileConditions.push(`(${interestConditions})`);
  }

  if (params.collaboration_tier?.length) {
    const tierConditions = params.collaboration_tier
      .map((t) => `g.collaboration_tier = '${escapeSQL(t)}'`)
      .join(" OR ");
    profileConditions.push(`(${tierConditions})`);
  }

  const profileWhereClause =
    profileConditions.length > 0 ? profileConditions.join(" AND ") : "1=1";

  // Build contact channel filter
  let contactChannelCondition = "";
  if (params.contact_channels?.length) {
    const channels = params.contact_channels
      .map((ch) => `'${escapeSQL(ch)}'`)
      .join(", ");
    contactChannelCondition = `AND l.channel IN (${channels})`;
  }

  const sql = `
WITH contact_links AS (
  SELECT
    l.user_id,
    ARRAY_AGG(DISTINCT l.channel) as contact_channels,
    ARRAY_AGG(STRUCT(l.channel as channel, l.urls as urls)) as contact_details,
    COUNT(DISTINCT l.channel) as contact_channel_count
  FROM \`mmm-lab.sns.insta_user_links_v3\` l
  WHERE l.type = 'contact'
    ${contactChannelCondition}
  GROUP BY l.user_id
)
SELECT
  g.user_id,
  p.username,
  p.followed_by,
  g.collaboration_tier,
  cl.contact_channels,
  cl.contact_channel_count,
  cl.contact_details
FROM \`mmm-lab.gpt_profile.insta_general_profiles\` g
JOIN contact_links cl ON g.user_id = cl.user_id
LEFT JOIN \`mmm-lab.sns.insta_profile_mmm_v3\` p ON g.user_id = p.user_id
WHERE ${profileWhereClause}
ORDER BY p.followed_by DESC NULLS LAST
LIMIT ${limit}
`;

  return sql;
}

export async function findContactableInfluencers(
  params: ContactableInfluencersParams
): Promise<MultiplatformResult> {
  try {
    const query = buildContactableInfluencersQuery(params);

    const validation = await validateQuery(query);
    if (!validation.valid) {
      return {
        success: false,
        data: [],
        totalRows: 0,
        downloadUrl: "",
        query,
        error: `Query validation failed: ${validation.error}`,
      };
    }

    const result = await executeQuery(query);

    const csv = toCSV(result);
    const { publicUrl } = await uploadCSV(csv, "contactable_influencers");

    return {
      success: true,
      data: result.rows,
      totalRows: result.totalRows,
      downloadUrl: publicUrl,
      query,
    };
  } catch (error) {
    return {
      success: false,
      data: [],
      totalRows: 0,
      downloadUrl: "",
      query: "",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function getContactableInfluencersDescription(): string {
  return `Find influencers with contact information (email, blog, etc.)

## Parameters
- **country** (optional): Array of country codes
- **interests** (optional): Array of interest categories
- **contact_channels** (optional): Filter by contact type
- **collaboration_tier** (optional): Array of collaboration tiers
- **limit** (optional): Maximum results (default: 100)

## Available Contact Channels
| Channel | Description |
|---------|-------------|
| email | Email address (business inquiries) |
| blog | Blog URL (Naver Blog, etc.) |
| kakaotalk | KakaoTalk open chat/channel |

## Output
- user_id, username, followed_by
- contact_channels: Array of contact methods
- contact_details: Contact information for each channel

## Use Cases
- "Find Korean Beauty influencers with email for business inquiries"
- "Search for influencers with blog presence"`;
}

// ============================================================================
// 4. analyze_platform_distribution
// ============================================================================

export interface PlatformDistributionParams {
  country?: string[];
  interests?: string[];
  collaboration_tier?: string[];
  link_type?: "all" | "sns" | "shopping" | "contact";
}

function buildPlatformDistributionQuery(
  params: PlatformDistributionParams
): string {
  const linkType = params.link_type || "all";

  // Build profile filter conditions
  const profileConditions: string[] = [];

  if (params.country?.length) {
    const countryConditions = params.country
      .map((c) => `'${escapeSQL(c)}' IN UNNEST(g.country)`)
      .join(" OR ");
    profileConditions.push(`(${countryConditions})`);
  }

  if (params.interests?.length) {
    const interestConditions = params.interests
      .map((i) => `'${escapeSQL(i)}' IN UNNEST(g.interests)`)
      .join(" OR ");
    profileConditions.push(`(${interestConditions})`);
  }

  if (params.collaboration_tier?.length) {
    const tierConditions = params.collaboration_tier
      .map((t) => `g.collaboration_tier = '${escapeSQL(t)}'`)
      .join(" OR ");
    profileConditions.push(`(${tierConditions})`);
  }

  const profileWhereClause =
    profileConditions.length > 0 ? profileConditions.join(" AND ") : "1=1";

  // Build link type condition
  let linkTypeCondition = "";
  if (linkType !== "all") {
    linkTypeCondition = `AND l.type = '${escapeSQL(linkType)}'`;
  }

  const sql = `
WITH base_influencers AS (
  SELECT g.user_id
  FROM \`mmm-lab.gpt_profile.insta_general_profiles\` g
  WHERE ${profileWhereClause}
),
total_influencers AS (
  SELECT COUNT(DISTINCT user_id) as total
  FROM base_influencers
),
platform_counts AS (
  SELECT
    l.type as link_type,
    l.channel,
    COUNT(DISTINCT l.user_id) as influencer_count
  FROM \`mmm-lab.sns.insta_user_links_v3\` l
  JOIN base_influencers b ON l.user_id = b.user_id
  WHERE 1=1 ${linkTypeCondition}
  GROUP BY l.type, l.channel
)
SELECT
  pc.link_type,
  pc.channel,
  pc.influencer_count,
  ROUND(pc.influencer_count * 100.0 / ti.total, 2) as percentage
FROM platform_counts pc
CROSS JOIN total_influencers ti
ORDER BY pc.link_type, pc.influencer_count DESC
`;

  return sql;
}

export async function analyzePlatformDistribution(
  params: PlatformDistributionParams
): Promise<MultiplatformResult> {
  try {
    const query = buildPlatformDistributionQuery(params);

    const validation = await validateQuery(query);
    if (!validation.valid) {
      return {
        success: false,
        data: [],
        totalRows: 0,
        downloadUrl: "",
        query,
        error: `Query validation failed: ${validation.error}`,
      };
    }

    const result = await executeQuery(query);

    const csv = toCSV(result);
    const { publicUrl } = await uploadCSV(csv, "platform_distribution");

    return {
      success: true,
      data: result.rows,
      totalRows: result.totalRows,
      downloadUrl: publicUrl,
      query,
    };
  } catch (error) {
    return {
      success: false,
      data: [],
      totalRows: 0,
      downloadUrl: "",
      query: "",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function getPlatformDistributionDescription(): string {
  return `Analyze platform distribution within an influencer segment

## Parameters
- **country** (optional): Array of country codes
- **interests** (optional): Array of interest categories
- **collaboration_tier** (optional): Array of collaboration tiers
- **link_type** (optional): Filter by link type - "all", "sns", "shopping", or "contact"

## Output
- link_type: Type of link (sns, shopping, contact)
- channel: Platform/channel name
- influencer_count: Number of influencers with this channel
- percentage: Percentage of total influencers

## Use Cases
- "What percentage of Korean Beauty influencers have YouTube?"
- "Analyze shopping platform distribution among SEA influencers"
- "Compare SNS platform usage across countries"`;
}

// ============================================================================
// 5. compare_platform_presence
// ============================================================================

export interface PlatformPresenceParams {
  brands: string[];
  channels?: string[];
}

function buildPlatformPresenceQuery(params: PlatformPresenceParams): string {
  if (!params.brands?.length) {
    throw new Error("At least one brand is required");
  }

  const brands = params.brands.map((b) => `'${escapeSQL(b.toLowerCase())}'`).join(", ");

  // Build channel filter
  let channelCondition = "";
  if (params.channels?.length) {
    const channels = params.channels
      .map((ch) => `'${escapeSQL(ch)}'`)
      .join(", ");
    channelCondition = `AND l.channel IN (${channels})`;
  }

  const sql = `
WITH brand_collaborators AS (
  SELECT
    g.user_id,
    LOWER(brand) as brand
  FROM \`mmm-lab.gpt_profile.insta_general_profiles\` g,
  UNNEST(g.collaborate_brand) as brand
  WHERE LOWER(brand) IN (${brands})
),
brand_totals AS (
  SELECT
    brand,
    COUNT(DISTINCT user_id) as total_collaborators
  FROM brand_collaborators
  GROUP BY brand
),
brand_platform AS (
  SELECT
    bc.brand,
    l.type as link_type,
    l.channel,
    COUNT(DISTINCT bc.user_id) as influencer_count
  FROM brand_collaborators bc
  JOIN \`mmm-lab.sns.insta_user_links_v3\` l ON bc.user_id = l.user_id
  WHERE 1=1 ${channelCondition}
  GROUP BY bc.brand, l.type, l.channel
)
SELECT
  bp.brand,
  bp.link_type,
  bp.channel,
  bp.influencer_count,
  bt.total_collaborators,
  ROUND(bp.influencer_count * 100.0 / bt.total_collaborators, 2) as percentage
FROM brand_platform bp
JOIN brand_totals bt ON bp.brand = bt.brand
ORDER BY bp.brand, bp.influencer_count DESC
`;

  return sql;
}

export async function comparePlatformPresence(
  params: PlatformPresenceParams
): Promise<MultiplatformResult> {
  try {
    const query = buildPlatformPresenceQuery(params);

    const validation = await validateQuery(query);
    if (!validation.valid) {
      return {
        success: false,
        data: [],
        totalRows: 0,
        downloadUrl: "",
        query,
        error: `Query validation failed: ${validation.error}`,
      };
    }

    const result = await executeQuery(query);

    const csv = toCSV(result);
    const { publicUrl } = await uploadCSV(csv, "platform_presence_comparison");

    return {
      success: true,
      data: result.rows,
      totalRows: result.totalRows,
      downloadUrl: publicUrl,
      query,
    };
  } catch (error) {
    return {
      success: false,
      data: [],
      totalRows: 0,
      downloadUrl: "",
      query: "",
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function getPlatformPresenceDescription(): string {
  return `Compare platform presence among brand collaborators

## Parameters
- **brands** (required): Array of brand names to compare
- **channels** (optional): Filter by specific channels

## Output
- brand: Brand name
- link_type: Type of link (sns, shopping, contact)
- channel: Platform/channel name
- influencer_count: Number of collaborators with this channel
- total_collaborators: Total collaborators for this brand
- percentage: Percentage with this channel

## Use Cases
- "Compare YouTube presence between Fwee and Rom&nd collaborators"
- "Analyze TikTok usage among competitor brand ambassadors"
- "Which brand has more blog-owning influencers?"`;
}
