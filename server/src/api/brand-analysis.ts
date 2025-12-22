import { executeQuery, toCSV, validateQuery } from "./bigquery.js";
import { uploadCSV } from "./gcs.js";

/**
 * Common result interface for brand analysis
 */
export interface BrandAnalysisResult {
  success: boolean;
  data: Record<string, unknown>[];
  totalRows: number;
  downloadUrl: string;
  query: string;
  error?: string;
}

/**
 * Escape string for SQL
 */
function escapeSQL(value: string): string {
  return value.replace(/'/g, "''");
}

// ============================================================================
// 1. analyze_brand_mentions
// ============================================================================

export interface BrandMentionParams {
  brand_names: string[];
  country?: string[];
  interests?: string[];
  period_days?: number;
  limit?: number;
}

/**
 * Build SQL query for brand mention analysis
 * Searches for brand mentions in captions and hashtags
 */
function buildBrandMentionQuery(params: BrandMentionParams): string {
  const periodDays = params.period_days || 90;
  const limit = params.limit || 50;

  // Build influencer filter conditions
  const influencerConditions: string[] = ["1=1"];
  if (params.country?.length) {
    const countryConditions = params.country
      .map((c) => `'${escapeSQL(c)}' IN UNNEST(country)`)
      .join(" OR ");
    influencerConditions.push(`(${countryConditions})`);
  }
  if (params.interests?.length) {
    const interestConditions = params.interests
      .map((i) => `'${escapeSQL(i)}' IN UNNEST(interests)`)
      .join(" OR ");
    influencerConditions.push(`(${interestConditions})`);
  }
  const influencerWhere = influencerConditions.join(" AND ");

  // Build brand search patterns (case-insensitive)
  const brandPatterns = params.brand_names
    .map((brand) => {
      const escaped = escapeSQL(brand.toLowerCase());
      return `LOWER(search_text) LIKE '%${escaped}%'`;
    })
    .join(" OR ");

  // Build brand name extraction CASE statements
  const brandCases = params.brand_names
    .map((brand) => {
      const escaped = escapeSQL(brand.toLowerCase());
      return `WHEN LOWER(search_text) LIKE '%${escaped}%' THEN '${escapeSQL(brand)}'`;
    })
    .join("\n      ");

  const sql = `
WITH target_influencers AS (
  SELECT user_id
  FROM \`mmm-lab.gpt_profile.insta_general_profiles\`
  WHERE ${influencerWhere}
),

-- Combine media and reels with deduplication
all_content AS (
  SELECT DISTINCT media_id, user_id, search_text, like_count, comment_count, is_paid_partnership
  FROM (
    SELECT
      m.media_id,
      m.user_id,
      CONCAT(COALESCE(m.caption, ''), ' ', ARRAY_TO_STRING(m.hashtags, ' ')) as search_text,
      m.like_count,
      m.comment_count,
      m.is_paid_partnership
    FROM \`mmm-lab.sns.insta_media_mmm_v3\` m
    WHERE m.user_id IN (SELECT user_id FROM target_influencers)
      AND m.publish_date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${periodDays} DAY)
    UNION ALL
    SELECT
      r.media_id,
      r.user_id,
      CONCAT(COALESCE(r.caption, ''), ' ', ARRAY_TO_STRING(r.hashtags, ' ')) as search_text,
      r.like_count,
      r.comment_count,
      r.is_paid_partnership
    FROM \`mmm-lab.sns.insta_reels_mmm_v3\` r
    WHERE r.user_id IN (SELECT user_id FROM target_influencers)
      AND r.publish_date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${periodDays} DAY)
  )
),

-- Filter content containing brand mentions
brand_content AS (
  SELECT
    *,
    CASE
      ${brandCases}
      ELSE 'Unknown'
    END as brand_name
  FROM all_content
  WHERE (${brandPatterns})
)

SELECT
  brand_name,
  COUNT(DISTINCT media_id) as mention_count,
  COUNT(DISTINCT user_id) as unique_influencers,
  SUM(CASE WHEN is_paid_partnership = TRUE THEN 1 ELSE 0 END) as sponsored_count,
  ROUND(AVG(like_count), 1) as avg_likes,
  ROUND(AVG(comment_count), 1) as avg_comments,
  ROUND(AVG(like_count + comment_count), 1) as avg_engagement
FROM brand_content
GROUP BY brand_name
ORDER BY mention_count DESC
LIMIT ${limit}
`.trim();

  return sql;
}

/**
 * Analyze brand mentions in influencer content
 */
export async function analyzeBrandMentions(
  params: BrandMentionParams
): Promise<BrandAnalysisResult> {
  console.error("\n=== analyzeBrandMentions ===");
  console.error("Params:", JSON.stringify(params, null, 2));

  if (!params.brand_names || params.brand_names.length === 0) {
    return {
      success: false,
      data: [],
      totalRows: 0,
      downloadUrl: "",
      query: "",
      error: "At least one brand name is required",
    };
  }

  try {
    const sql = buildBrandMentionQuery(params);
    console.error("Generated SQL:", sql.substring(0, 500) + "...");

    const validation = validateQuery(sql);
    if (!validation.valid) {
      return {
        success: false,
        data: [],
        totalRows: 0,
        downloadUrl: "",
        query: sql,
        error: validation.error,
      };
    }

    const result = await executeQuery(sql);
    const csv = toCSV(result);
    const { publicUrl } = await uploadCSV(csv, "brand-mentions");

    return {
      success: true,
      data: result.rows,
      totalRows: result.totalRows,
      downloadUrl: publicUrl,
      query: sql,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Brand mention analysis error:", errorMessage);

    return {
      success: false,
      data: [],
      totalRows: 0,
      downloadUrl: "",
      query: "",
      error: errorMessage,
    };
  }
}

// ============================================================================
// 2. find_brand_collaborators
// ============================================================================

export interface BrandCollaboratorParams {
  brand_name: string;
  country?: string[];
  collaboration_tier?: string[];
  min_followers?: number;
  limit?: number;
}

/**
 * Build SQL query for finding brand collaborators
 * Uses collaborate_brand field from insta_general_profiles
 */
function buildBrandCollaboratorQuery(params: BrandCollaboratorParams): string {
  const limit = params.limit || 50;
  const minFollowers = params.min_followers || 0;
  const brandName = escapeSQL(params.brand_name.toLowerCase());

  // Build filter conditions
  const conditions: string[] = [
    `LOWER(ARRAY_TO_STRING(g.collaborate_brand, ',')) LIKE '%${brandName}%'`,
  ];

  if (params.country?.length) {
    const countryConditions = params.country
      .map((c) => `'${escapeSQL(c)}' IN UNNEST(g.country)`)
      .join(" OR ");
    conditions.push(`(${countryConditions})`);
  }

  if (params.collaboration_tier?.length) {
    const tierConditions = params.collaboration_tier
      .map((t) => `g.collaboration_tier = '${escapeSQL(t)}'`)
      .join(" OR ");
    conditions.push(`(${tierConditions})`);
  }

  if (minFollowers > 0) {
    conditions.push(`p.follower >= ${minFollowers}`);
  }

  const whereClause = conditions.join(" AND ");

  const sql = `
SELECT
  g.user_id,
  p.username,
  p.followed_by as follower_count,
  g.collaboration_tier,
  g.gender,
  g.age_range,
  ARRAY_TO_STRING(g.country, ', ') as country,
  ARRAY_TO_STRING(g.interests, ', ') as interests,
  ARRAY_TO_STRING(g.collaborate_brand, ', ') as collaborate_brands,
  g.short_bio as bio
FROM \`mmm-lab.gpt_profile.insta_general_profiles\` g
LEFT JOIN \`mmm-lab.sns.insta_profile_mmm_v3\` p ON g.user_id = p.user_id
WHERE ${whereClause}
ORDER BY p.followed_by DESC
LIMIT ${limit}
`.trim();

  return sql;
}

/**
 * Find influencers who have collaborated with a specific brand
 */
export async function findBrandCollaborators(
  params: BrandCollaboratorParams
): Promise<BrandAnalysisResult> {
  console.error("\n=== findBrandCollaborators ===");
  console.error("Params:", JSON.stringify(params, null, 2));

  if (!params.brand_name) {
    return {
      success: false,
      data: [],
      totalRows: 0,
      downloadUrl: "",
      query: "",
      error: "Brand name is required",
    };
  }

  try {
    const sql = buildBrandCollaboratorQuery(params);
    console.error("Generated SQL:", sql.substring(0, 500) + "...");

    const validation = validateQuery(sql);
    if (!validation.valid) {
      return {
        success: false,
        data: [],
        totalRows: 0,
        downloadUrl: "",
        query: sql,
        error: validation.error,
      };
    }

    const result = await executeQuery(sql);
    const csv = toCSV(result);
    const { publicUrl } = await uploadCSV(csv, "brand-collaborators");

    return {
      success: true,
      data: result.rows,
      totalRows: result.totalRows,
      downloadUrl: publicUrl,
      query: sql,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Brand collaborator search error:", errorMessage);

    return {
      success: false,
      data: [],
      totalRows: 0,
      downloadUrl: "",
      query: "",
      error: errorMessage,
    };
  }
}

// ============================================================================
// 3. analyze_sponsored_content_performance
// ============================================================================

export interface SponsoredContentParams {
  brand_name?: string;
  country?: string[];
  interests?: string[];
  period_days?: number;
  content_type?: "all" | "media" | "reels";
}

/**
 * Build SQL query for sponsored content performance analysis
 */
function buildSponsoredContentQuery(params: SponsoredContentParams): string {
  const periodDays = params.period_days || 90;
  const contentType = params.content_type || "all";

  // Build influencer filter conditions
  const influencerConditions: string[] = ["1=1"];
  if (params.country?.length) {
    const countryConditions = params.country
      .map((c) => `'${escapeSQL(c)}' IN UNNEST(country)`)
      .join(" OR ");
    influencerConditions.push(`(${countryConditions})`);
  }
  if (params.interests?.length) {
    const interestConditions = params.interests
      .map((i) => `'${escapeSQL(i)}' IN UNNEST(interests)`)
      .join(" OR ");
    influencerConditions.push(`(${interestConditions})`);
  }
  const influencerWhere = influencerConditions.join(" AND ");

  // Build brand filter if provided
  let brandFilter = "";
  if (params.brand_name) {
    const brandName = escapeSQL(params.brand_name.toLowerCase());
    brandFilter = `AND LOWER(CONCAT(COALESCE(caption, ''), ' ', ARRAY_TO_STRING(hashtags, ' '))) LIKE '%${brandName}%'`;
  }

  // Build content query based on type
  let contentQuery = "";
  if (contentType === "media") {
    contentQuery = `
    SELECT
      m.media_id,
      m.user_id,
      m.like_count,
      m.comment_count,
      m.is_paid_partnership,
      'media' as content_type
    FROM \`mmm-lab.sns.insta_media_mmm_v3\` m
    WHERE m.user_id IN (SELECT user_id FROM target_influencers)
      AND m.publish_date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${periodDays} DAY)
      AND m.is_video = FALSE
      ${brandFilter}`;
  } else if (contentType === "reels") {
    contentQuery = `
    SELECT DISTINCT media_id, user_id, like_count, comment_count, is_paid_partnership, content_type
    FROM (
      SELECT
        m.media_id,
        m.user_id,
        m.like_count,
        m.comment_count,
        m.is_paid_partnership,
        'reels' as content_type
      FROM \`mmm-lab.sns.insta_media_mmm_v3\` m
      WHERE m.user_id IN (SELECT user_id FROM target_influencers)
        AND m.publish_date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${periodDays} DAY)
        AND m.is_video = TRUE
        ${brandFilter}
      UNION ALL
      SELECT
        r.media_id,
        r.user_id,
        r.like_count,
        r.comment_count,
        r.is_paid_partnership,
        'reels' as content_type
      FROM \`mmm-lab.sns.insta_reels_mmm_v3\` r
      WHERE r.user_id IN (SELECT user_id FROM target_influencers)
        AND r.publish_date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${periodDays} DAY)
        ${brandFilter}
    )`;
  } else {
    contentQuery = `
    SELECT DISTINCT media_id, user_id, like_count, comment_count, is_paid_partnership, content_type
    FROM (
      SELECT
        m.media_id,
        m.user_id,
        m.like_count,
        m.comment_count,
        m.is_paid_partnership,
        CASE WHEN m.is_video THEN 'reels' ELSE 'media' END as content_type
      FROM \`mmm-lab.sns.insta_media_mmm_v3\` m
      WHERE m.user_id IN (SELECT user_id FROM target_influencers)
        AND m.publish_date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${periodDays} DAY)
        ${brandFilter}
      UNION ALL
      SELECT
        r.media_id,
        r.user_id,
        r.like_count,
        r.comment_count,
        r.is_paid_partnership,
        'reels' as content_type
      FROM \`mmm-lab.sns.insta_reels_mmm_v3\` r
      WHERE r.user_id IN (SELECT user_id FROM target_influencers)
        AND r.publish_date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${periodDays} DAY)
        ${brandFilter}
    )`;
  }

  const sql = `
WITH target_influencers AS (
  SELECT user_id
  FROM \`mmm-lab.gpt_profile.insta_general_profiles\`
  WHERE ${influencerWhere}
),

all_content AS (${contentQuery}
)

SELECT
  CASE WHEN is_paid_partnership THEN 'Sponsored' ELSE 'Organic' END as content_category,
  COUNT(DISTINCT media_id) as content_count,
  COUNT(DISTINCT user_id) as unique_influencers,
  ROUND(AVG(like_count), 1) as avg_likes,
  ROUND(AVG(comment_count), 1) as avg_comments,
  ROUND(AVG(like_count + comment_count), 1) as avg_engagement,
  ROUND(STDDEV(like_count + comment_count), 1) as engagement_stddev
FROM all_content
GROUP BY 1
ORDER BY 1
`.trim();

  return sql;
}

/**
 * Analyze sponsored vs organic content performance
 */
export async function analyzeSponsoredContentPerformance(
  params: SponsoredContentParams
): Promise<BrandAnalysisResult> {
  console.error("\n=== analyzeSponsoredContentPerformance ===");
  console.error("Params:", JSON.stringify(params, null, 2));

  try {
    const sql = buildSponsoredContentQuery(params);
    console.error("Generated SQL:", sql.substring(0, 500) + "...");

    const validation = validateQuery(sql);
    if (!validation.valid) {
      return {
        success: false,
        data: [],
        totalRows: 0,
        downloadUrl: "",
        query: sql,
        error: validation.error,
      };
    }

    const result = await executeQuery(sql);
    const csv = toCSV(result);
    const { publicUrl } = await uploadCSV(csv, "sponsored-content");

    return {
      success: true,
      data: result.rows,
      totalRows: result.totalRows,
      downloadUrl: publicUrl,
      query: sql,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Sponsored content analysis error:", errorMessage);

    return {
      success: false,
      data: [],
      totalRows: 0,
      downloadUrl: "",
      query: "",
      error: errorMessage,
    };
  }
}

// ============================================================================
// 4. compare_competitor_brands
// ============================================================================

export interface CompetitorBrandParams {
  brands: string[];
  country?: string[];
  period_days?: number;
}

/**
 * Build SQL query for competitor brand comparison
 */
function buildCompetitorBrandQuery(params: CompetitorBrandParams): string {
  const periodDays = params.period_days || 90;

  // Build country filter
  let countryFilter = "";
  if (params.country?.length) {
    const countryConditions = params.country
      .map((c) => `'${escapeSQL(c)}' IN UNNEST(g.country)`)
      .join(" OR ");
    countryFilter = `AND (${countryConditions})`;
  }

  // Build brand CTEs
  const brandCTEs = params.brands
    .map((brand) => {
      const brandName = escapeSQL(brand);
      const brandNameLower = escapeSQL(brand.toLowerCase());
      const brandAlias = brand.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();

      return `
${brandAlias}_collaborators AS (
  SELECT
    '${brandName}' as brand,
    g.user_id,
    g.collaboration_tier,
    ARRAY_TO_STRING(g.country, ', ') as country,
    p.followed_by as follower_count
  FROM \`mmm-lab.gpt_profile.insta_general_profiles\` g
  LEFT JOIN \`mmm-lab.sns.insta_profile_mmm_v3\` p ON g.user_id = p.user_id
  WHERE LOWER(ARRAY_TO_STRING(g.collaborate_brand, ',')) LIKE '%${brandNameLower}%'
    ${countryFilter}
),

${brandAlias}_content AS (
  SELECT
    '${brandName}' as brand,
    c.media_id,
    c.like_count,
    c.comment_count,
    c.is_paid_partnership
  FROM (
    SELECT DISTINCT media_id, user_id, like_count, comment_count, is_paid_partnership
    FROM (
      SELECT m.media_id, m.user_id, m.like_count, m.comment_count, m.is_paid_partnership
      FROM \`mmm-lab.sns.insta_media_mmm_v3\` m
      WHERE m.user_id IN (SELECT user_id FROM ${brandAlias}_collaborators)
        AND m.publish_date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${periodDays} DAY)
      UNION ALL
      SELECT r.media_id, r.user_id, r.like_count, r.comment_count, r.is_paid_partnership
      FROM \`mmm-lab.sns.insta_reels_mmm_v3\` r
      WHERE r.user_id IN (SELECT user_id FROM ${brandAlias}_collaborators)
        AND r.publish_date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${periodDays} DAY)
    )
  ) c
),

${brandAlias}_stats AS (
  SELECT
    '${brandName}' as brand,
    (SELECT COUNT(DISTINCT user_id) FROM ${brandAlias}_collaborators) as collaborator_count,
    (SELECT COUNT(DISTINCT media_id) FROM ${brandAlias}_content WHERE is_paid_partnership = TRUE) as sponsored_posts,
    (SELECT ROUND(AVG(like_count + comment_count), 1) FROM ${brandAlias}_content) as avg_engagement,
    (SELECT STRING_AGG(DISTINCT collaboration_tier, ', ') FROM ${brandAlias}_collaborators) as tier_distribution
)`;
    })
    .join(",\n");

  // Build UNION ALL for all brands
  const unionAll = params.brands
    .map((brand) => {
      const brandAlias = brand.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase();
      return `SELECT * FROM ${brandAlias}_stats`;
    })
    .join("\n  UNION ALL\n  ");

  const sql = `
WITH ${brandCTEs}

SELECT
  brand,
  collaborator_count,
  sponsored_posts,
  avg_engagement,
  tier_distribution
FROM (
  ${unionAll}
)
ORDER BY collaborator_count DESC
`.trim();

  return sql;
}

/**
 * Compare competitor brands' influencer marketing
 */
export async function compareCompetitorBrands(
  params: CompetitorBrandParams
): Promise<BrandAnalysisResult> {
  console.error("\n=== compareCompetitorBrands ===");
  console.error("Params:", JSON.stringify(params, null, 2));

  if (!params.brands || params.brands.length < 2) {
    return {
      success: false,
      data: [],
      totalRows: 0,
      downloadUrl: "",
      query: "",
      error: "At least 2 brands are required for comparison",
    };
  }

  try {
    const sql = buildCompetitorBrandQuery(params);
    console.error("Generated SQL:", sql.substring(0, 500) + "...");

    const validation = validateQuery(sql);
    if (!validation.valid) {
      return {
        success: false,
        data: [],
        totalRows: 0,
        downloadUrl: "",
        query: sql,
        error: validation.error,
      };
    }

    const result = await executeQuery(sql);
    const csv = toCSV(result);
    const { publicUrl } = await uploadCSV(csv, "competitor-brands");

    return {
      success: true,
      data: result.rows,
      totalRows: result.totalRows,
      downloadUrl: publicUrl,
      query: sql,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Competitor brand comparison error:", errorMessage);

    return {
      success: false,
      data: [],
      totalRows: 0,
      downloadUrl: "",
      query: "",
      error: errorMessage,
    };
  }
}

// ============================================================================
// Helper functions for descriptions
// ============================================================================

export function getBrandMentionDescription(params: BrandMentionParams): string {
  const parts: string[] = [];
  parts.push(`브랜드: ${params.brand_names.join(", ")}`);
  if (params.country?.length) {
    parts.push(`국가: ${params.country.join(", ")}`);
  }
  if (params.interests?.length) {
    parts.push(`관심사: ${params.interests.join(", ")}`);
  }
  parts.push(`기간: ${params.period_days || 90}일`);
  return parts.join(" | ");
}

export function getBrandCollaboratorDescription(params: BrandCollaboratorParams): string {
  const parts: string[] = [];
  parts.push(`브랜드: ${params.brand_name}`);
  if (params.country?.length) {
    parts.push(`국가: ${params.country.join(", ")}`);
  }
  if (params.collaboration_tier?.length) {
    parts.push(`티어: ${params.collaboration_tier.join(", ")}`);
  }
  if (params.min_followers) {
    parts.push(`최소 팔로워: ${params.min_followers.toLocaleString()}`);
  }
  return parts.join(" | ");
}

export function getSponsoredContentDescription(params: SponsoredContentParams): string {
  const parts: string[] = [];
  if (params.brand_name) {
    parts.push(`브랜드: ${params.brand_name}`);
  }
  if (params.country?.length) {
    parts.push(`국가: ${params.country.join(", ")}`);
  }
  if (params.interests?.length) {
    parts.push(`관심사: ${params.interests.join(", ")}`);
  }
  parts.push(`기간: ${params.period_days || 90}일`);
  if (params.content_type && params.content_type !== "all") {
    parts.push(`콘텐츠: ${params.content_type}`);
  }
  return parts.length > 0 ? parts.join(" | ") : "스폰서 콘텐츠 성과 분석";
}

export function getCompetitorBrandDescription(params: CompetitorBrandParams): string {
  const parts: string[] = [];
  parts.push(`브랜드: ${params.brands.join(" vs ")}`);
  if (params.country?.length) {
    parts.push(`국가: ${params.country.join(", ")}`);
  }
  parts.push(`기간: ${params.period_days || 90}일`);
  return parts.join(" | ");
}
