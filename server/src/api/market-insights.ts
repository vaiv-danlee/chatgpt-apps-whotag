import { executeQuery, toCSV, validateQuery } from "./bigquery.js";
import { uploadCSV } from "./gcs.js";

/**
 * Common result interface for market insights
 */
export interface MarketInsightsResult {
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
// 1. analyze_market_demographics
// ============================================================================

export interface MarketDemographicsParams {
  country: string[];
  interests?: string[];
  group_by?: ("gender" | "age_range" | "collaboration_tier" | "occupation")[];
}

/**
 * Build SQL query for market demographics analysis
 */
function buildMarketDemographicsQuery(params: MarketDemographicsParams): string {
  const groupBy = params.group_by || ["gender", "age_range"];

  // Build filter conditions
  const conditions: string[] = [];

  if (params.country?.length) {
    const countryConditions = params.country
      .map((c) => `'${escapeSQL(c)}' IN UNNEST(country)`)
      .join(" OR ");
    conditions.push(`(${countryConditions})`);
  }

  if (params.interests?.length) {
    const interestConditions = params.interests
      .map((i) => `'${escapeSQL(i)}' IN UNNEST(interests)`)
      .join(" OR ");
    conditions.push(`(${interestConditions})`);
  }

  const whereClause = conditions.length > 0 ? conditions.join(" AND ") : "1=1";

  // Build SELECT and GROUP BY clauses based on group_by parameter
  const selectFields: string[] = [];
  const groupByFields: string[] = [];

  groupBy.forEach((field) => {
    if (field === "age_range") {
      selectFields.push("g.age_range");
      groupByFields.push("g.age_range");
    } else {
      selectFields.push(`g.${field}`);
      groupByFields.push(`g.${field}`);
    }
  });

  const sql = `
SELECT
  ${selectFields.join(",\n  ")},
  COUNT(DISTINCT g.user_id) as influencer_count,
  ROUND(AVG(p.followed_by), 0) as avg_followers,
  ROUND(STDDEV(p.followed_by), 0) as stddev_followers
FROM \`mmm-lab.gpt_profile.insta_general_profiles\` g
LEFT JOIN \`mmm-lab.sns.insta_profile_mmm_v3\` p ON g.user_id = p.user_id
WHERE ${whereClause}
GROUP BY ${groupByFields.join(", ")}
ORDER BY influencer_count DESC
LIMIT 100
`.trim();

  return sql;
}

/**
 * Analyze market demographics for influencer segments
 */
export async function analyzeMarketDemographics(
  params: MarketDemographicsParams
): Promise<MarketInsightsResult> {
  console.error("\n=== analyzeMarketDemographics ===");
  console.error("Params:", JSON.stringify(params, null, 2));

  if (!params.country || params.country.length === 0) {
    return {
      success: false,
      data: [],
      totalRows: 0,
      downloadUrl: "",
      query: "",
      error: "At least one country is required",
    };
  }

  try {
    const sql = buildMarketDemographicsQuery(params);
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
    const { publicUrl } = await uploadCSV(csv, "market-demographics");

    return {
      success: true,
      data: result.rows,
      totalRows: result.totalRows,
      downloadUrl: publicUrl,
      query: sql,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Market demographics analysis error:", errorMessage);

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
// 2. find_k_culture_influencers
// ============================================================================

export interface KCultureInfluencerParams {
  country: string[];
  interests?: string[];
  collaboration_tier?: string[];
  min_followers?: number;
  limit?: number;
}

/**
 * Build SQL query for K-culture interested influencers
 */
function buildKCultureInfluencerQuery(params: KCultureInfluencerParams): string {
  const limit = params.limit || 50;
  const minFollowers = params.min_followers || 0;

  // Build filter conditions
  const conditions: string[] = [
    "g.k_interest = TRUE",
  ];

  // Exclude Korea from results (looking for overseas K-culture fans)
  if (params.country?.length) {
    const countryConditions = params.country
      .map((c) => `'${escapeSQL(c)}' IN UNNEST(g.country)`)
      .join(" OR ");
    conditions.push(`(${countryConditions})`);
  }

  if (params.interests?.length) {
    const interestConditions = params.interests
      .map((i) => `'${escapeSQL(i)}' IN UNNEST(g.interests)`)
      .join(" OR ");
    conditions.push(`(${interestConditions})`);
  }

  if (params.collaboration_tier?.length) {
    const tierConditions = params.collaboration_tier
      .map((t) => `g.collaboration_tier = '${escapeSQL(t)}'`)
      .join(" OR ");
    conditions.push(`(${tierConditions})`);
  }

  if (minFollowers > 0) {
    conditions.push(`p.followed_by >= ${minFollowers}`);
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
  g.k_interest_reason,
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
 * Find K-culture interested influencers outside Korea
 */
export async function findKCultureInfluencers(
  params: KCultureInfluencerParams
): Promise<MarketInsightsResult> {
  console.error("\n=== findKCultureInfluencers ===");
  console.error("Params:", JSON.stringify(params, null, 2));

  if (!params.country || params.country.length === 0) {
    return {
      success: false,
      data: [],
      totalRows: 0,
      downloadUrl: "",
      query: "",
      error: "At least one country is required (excluding KR)",
    };
  }

  try {
    const sql = buildKCultureInfluencerQuery(params);
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
    const { publicUrl } = await uploadCSV(csv, "k-culture-influencers");

    return {
      success: true,
      data: result.rows,
      totalRows: result.totalRows,
      downloadUrl: publicUrl,
      query: sql,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("K-culture influencer search error:", errorMessage);

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
// 3. analyze_lifestage_segments
// ============================================================================

export interface LifestageSegmentParams {
  country?: string[];
  interests?: string[];
  lifestage?: string[];
}

/**
 * Build SQL query for lifestage segment analysis
 */
function buildLifestageSegmentQuery(params: LifestageSegmentParams): string {
  // Build filter conditions
  const conditions: string[] = ["g.lifestage IS NOT NULL"];

  if (params.country?.length) {
    const countryConditions = params.country
      .map((c) => `'${escapeSQL(c)}' IN UNNEST(g.country)`)
      .join(" OR ");
    conditions.push(`(${countryConditions})`);
  }

  if (params.interests?.length) {
    const interestConditions = params.interests
      .map((i) => `'${escapeSQL(i)}' IN UNNEST(g.interests)`)
      .join(" OR ");
    conditions.push(`(${interestConditions})`);
  }

  if (params.lifestage?.length) {
    const lifestageConditions = params.lifestage
      .map((l) => `g.lifestage = '${escapeSQL(l)}'`)
      .join(" OR ");
    conditions.push(`(${lifestageConditions})`);
  }

  const whereClause = conditions.join(" AND ");

  const sql = `
WITH lifestage_stats AS (
  SELECT
    g.lifestage,
    COUNT(DISTINCT g.user_id) as influencer_count,
    ROUND(AVG(p.followed_by), 0) as avg_followers,
    COUNTIF(g.collaboration_tier IN ('Ready - Premium', 'Ready - Professional')) as ready_tier_count
  FROM \`mmm-lab.gpt_profile.insta_general_profiles\` g
  LEFT JOIN \`mmm-lab.sns.insta_profile_mmm_v3\` p ON g.user_id = p.user_id
  WHERE ${whereClause}
  GROUP BY g.lifestage
)

SELECT
  lifestage,
  influencer_count,
  avg_followers,
  ready_tier_count,
  ROUND(ready_tier_count * 100.0 / influencer_count, 1) as ready_tier_pct
FROM lifestage_stats
ORDER BY influencer_count DESC
`.trim();

  return sql;
}

/**
 * Analyze lifestage segments
 */
export async function analyzeLifestageSegments(
  params: LifestageSegmentParams
): Promise<MarketInsightsResult> {
  console.error("\n=== analyzeLifestageSegments ===");
  console.error("Params:", JSON.stringify(params, null, 2));

  try {
    const sql = buildLifestageSegmentQuery(params);
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
    const { publicUrl } = await uploadCSV(csv, "lifestage-segments");

    return {
      success: true,
      data: result.rows,
      totalRows: result.totalRows,
      downloadUrl: publicUrl,
      query: sql,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Lifestage segment analysis error:", errorMessage);

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
// 4. analyze_beauty_persona_segments
// ============================================================================

export interface BeautyPersonaParams {
  country?: string[];
  skin_type?: string[];
  skin_concerns?: string[];
  personal_color?: string;
  brand_tier_segments?: string;
  limit?: number;
}

/**
 * Build SQL query for beauty persona segment analysis
 */
function buildBeautyPersonaQuery(params: BeautyPersonaParams): string {
  const limit = params.limit || 100;

  // Build filter conditions
  const conditions: string[] = [];

  if (params.country?.length) {
    const countryConditions = params.country
      .map((c) => `'${escapeSQL(c)}' IN UNNEST(g.country)`)
      .join(" OR ");
    conditions.push(`(${countryConditions})`);
  }

  if (params.skin_type?.length) {
    const skinTypeConditions = params.skin_type
      .map((s) => `'${escapeSQL(s)}' IN UNNEST(b.skin_type)`)
      .join(" OR ");
    conditions.push(`(${skinTypeConditions})`);
  }

  if (params.skin_concerns?.length) {
    const concernConditions = params.skin_concerns
      .map((c) => `'${escapeSQL(c)}' IN UNNEST(b.skin_concerns)`)
      .join(" OR ");
    conditions.push(`(${concernConditions})`);
  }

  if (params.personal_color) {
    conditions.push(`b.personal_color = '${escapeSQL(params.personal_color)}'`);
  }

  if (params.brand_tier_segments) {
    conditions.push(`b.brand_tier_segments = '${escapeSQL(params.brand_tier_segments)}'`);
  }

  const whereClause = conditions.length > 0 ? conditions.join(" AND ") : "1=1";

  const sql = `
SELECT
  g.user_id,
  p.username,
  p.followed_by as follower_count,
  g.collaboration_tier,
  g.gender,
  ARRAY_TO_STRING(g.country, ', ') as country,
  ARRAY_TO_STRING(b.skin_type, ', ') as skin_type,
  ARRAY_TO_STRING(b.skin_concerns, ', ') as skin_concerns,
  b.personal_color,
  b.brand_tier_segments,
  ARRAY_TO_STRING(b.beauty_interest_areas, ', ') as beauty_interest_areas,
  ARRAY_TO_STRING(b.beauty_content_types, ', ') as beauty_content_types
FROM \`mmm-lab.gpt_profile.insta_general_profiles\` g
INNER JOIN \`mmm-lab.gpt_profile.insta_beauty_profiles\` b ON g.user_id = b.user_id
LEFT JOIN \`mmm-lab.sns.insta_profile_mmm_v3\` p ON g.user_id = p.user_id
WHERE ${whereClause}
ORDER BY p.followed_by DESC
LIMIT ${limit}
`.trim();

  return sql;
}

/**
 * Analyze beauty persona segments summary
 */
function buildBeautyPersonaSummaryQuery(params: BeautyPersonaParams): string {
  // Build filter conditions
  const conditions: string[] = [];

  if (params.country?.length) {
    const countryConditions = params.country
      .map((c) => `'${escapeSQL(c)}' IN UNNEST(g.country)`)
      .join(" OR ");
    conditions.push(`(${countryConditions})`);
  }

  if (params.skin_type?.length) {
    const skinTypeConditions = params.skin_type
      .map((s) => `'${escapeSQL(s)}' IN UNNEST(b.skin_type)`)
      .join(" OR ");
    conditions.push(`(${skinTypeConditions})`);
  }

  if (params.skin_concerns?.length) {
    const concernConditions = params.skin_concerns
      .map((c) => `'${escapeSQL(c)}' IN UNNEST(b.skin_concerns)`)
      .join(" OR ");
    conditions.push(`(${concernConditions})`);
  }

  if (params.personal_color) {
    conditions.push(`b.personal_color = '${escapeSQL(params.personal_color)}'`);
  }

  if (params.brand_tier_segments) {
    conditions.push(`b.brand_tier_segments = '${escapeSQL(params.brand_tier_segments)}'`);
  }

  const whereClause = conditions.length > 0 ? conditions.join(" AND ") : "1=1";

  // Use UNNEST to flatten skin_type array for proper grouping
  const sql = `
WITH flattened AS (
  SELECT
    g.user_id,
    g.collaboration_tier,
    p.followed_by,
    skin_type_element,
    b.personal_color,
    b.brand_tier_segments
  FROM \`mmm-lab.gpt_profile.insta_general_profiles\` g
  INNER JOIN \`mmm-lab.gpt_profile.insta_beauty_profiles\` b ON g.user_id = b.user_id
  LEFT JOIN \`mmm-lab.sns.insta_profile_mmm_v3\` p ON g.user_id = p.user_id
  CROSS JOIN UNNEST(IFNULL(b.skin_type, ['Unknown'])) as skin_type_element
  WHERE ${whereClause}
)
SELECT
  skin_type_element as skin_type,
  personal_color,
  brand_tier_segments,
  COUNT(DISTINCT user_id) as influencer_count,
  ROUND(AVG(followed_by), 0) as avg_followers,
  COUNTIF(collaboration_tier IN ('Ready - Premium', 'Ready - Professional')) as ready_tier_count
FROM flattened
GROUP BY skin_type_element, personal_color, brand_tier_segments
HAVING COUNT(DISTINCT user_id) >= 5
ORDER BY influencer_count DESC
LIMIT 50
`.trim();

  return sql;
}

/**
 * Analyze beauty persona segments
 */
export async function analyzeBeautyPersonaSegments(
  params: BeautyPersonaParams
): Promise<MarketInsightsResult> {
  console.error("\n=== analyzeBeautyPersonaSegments ===");
  console.error("Params:", JSON.stringify(params, null, 2));

  try {
    // Use summary query for segment analysis
    const sql = buildBeautyPersonaSummaryQuery(params);
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
    const { publicUrl } = await uploadCSV(csv, "beauty-persona-segments");

    return {
      success: true,
      data: result.rows,
      totalRows: result.totalRows,
      downloadUrl: publicUrl,
      query: sql,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Beauty persona segment analysis error:", errorMessage);

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

export function getMarketDemographicsDescription(params: MarketDemographicsParams): string {
  const parts: string[] = [];
  parts.push(`국가: ${params.country.join(", ")}`);
  if (params.interests?.length) {
    parts.push(`관심사: ${params.interests.join(", ")}`);
  }
  parts.push(`그룹: ${(params.group_by || ["gender", "age_range"]).join(", ")}`);
  return parts.join(" | ");
}

export function getKCultureInfluencerDescription(params: KCultureInfluencerParams): string {
  const parts: string[] = [];
  parts.push(`국가: ${params.country.join(", ")}`);
  if (params.interests?.length) {
    parts.push(`관심사: ${params.interests.join(", ")}`);
  }
  if (params.collaboration_tier?.length) {
    parts.push(`티어: ${params.collaboration_tier.join(", ")}`);
  }
  parts.push("K-컬처 관심");
  return parts.join(" | ");
}

export function getLifestageSegmentDescription(params: LifestageSegmentParams): string {
  const parts: string[] = [];
  if (params.country?.length) {
    parts.push(`국가: ${params.country.join(", ")}`);
  }
  if (params.interests?.length) {
    parts.push(`관심사: ${params.interests.join(", ")}`);
  }
  if (params.lifestage?.length) {
    parts.push(`생애주기: ${params.lifestage.join(", ")}`);
  }
  return parts.length > 0 ? parts.join(" | ") : "전체 생애주기 분석";
}

export function getBeautyPersonaDescription(params: BeautyPersonaParams): string {
  const parts: string[] = [];
  if (params.country?.length) {
    parts.push(`국가: ${params.country.join(", ")}`);
  }
  if (params.skin_type?.length) {
    parts.push(`피부타입: ${params.skin_type.join(", ")}`);
  }
  if (params.skin_concerns?.length) {
    parts.push(`피부고민: ${params.skin_concerns.join(", ")}`);
  }
  if (params.personal_color) {
    parts.push(`퍼스널컬러: ${params.personal_color}`);
  }
  if (params.brand_tier_segments) {
    parts.push(`브랜드: ${params.brand_tier_segments}`);
  }
  return parts.length > 0 ? parts.join(" | ") : "전체 뷰티 페르소나 분석";
}
