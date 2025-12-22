import { executeQuery, toCSV, validateQuery } from "./bigquery.js";
import { uploadCSV } from "./gcs.js";

/**
 * Common result interface for trend analysis
 */
export interface TrendAnalysisResult {
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
// 1. analyze_hashtag_trends
// ============================================================================

export interface HashtagTrendParams {
  country?: string[];
  interests?: string[];
  period_days?: number;
  content_type?: "all" | "media" | "reels";
  limit?: number;
}

/**
 * Build SQL query for hashtag trend analysis
 */
function buildHashtagTrendQuery(params: HashtagTrendParams): string {
  const periodDays = params.period_days || 30;
  const contentType = params.content_type || "all";
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

  // Build content source based on content_type
  // Note: insta_media_mmm_v3 contains reels (is_video=TRUE) but insta_reels_mmm_v3 may have additional reels
  // We need to UNION both tables and deduplicate by media_id
  let contentQuery = "";

  if (contentType === "media") {
    // Feed posts only (non-video content from media table)
    contentQuery = `
    SELECT
      m.media_id,
      m.user_id,
      hashtag,
      m.like_count,
      m.comment_count,
      m.publish_date
    FROM \`mmm-lab.sns.insta_media_mmm_v3\` m, UNNEST(m.hashtags) AS hashtag
    WHERE m.user_id IN (SELECT user_id FROM target_influencers)
      AND m.publish_date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${periodDays} DAY)
      AND m.is_video = FALSE`;
  } else if (contentType === "reels") {
    // Reels only: UNION both tables (is_video=TRUE from media + reels table), dedupe by media_id
    contentQuery = `
    SELECT DISTINCT media_id, user_id, hashtag, like_count, comment_count, publish_date
    FROM (
      SELECT
        m.media_id,
        m.user_id,
        hashtag,
        m.like_count,
        m.comment_count,
        m.publish_date
      FROM \`mmm-lab.sns.insta_media_mmm_v3\` m, UNNEST(m.hashtags) AS hashtag
      WHERE m.user_id IN (SELECT user_id FROM target_influencers)
        AND m.publish_date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${periodDays} DAY)
        AND m.is_video = TRUE
      UNION ALL
      SELECT
        r.media_id,
        r.user_id,
        hashtag,
        r.like_count,
        r.comment_count,
        r.publish_date
      FROM \`mmm-lab.sns.insta_reels_mmm_v3\` r, UNNEST(r.hashtags) AS hashtag
      WHERE r.user_id IN (SELECT user_id FROM target_influencers)
        AND r.publish_date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${periodDays} DAY)
    )`;
  } else {
    // All content: UNION both tables, dedupe by media_id
    contentQuery = `
    SELECT DISTINCT media_id, user_id, hashtag, like_count, comment_count, publish_date
    FROM (
      SELECT
        m.media_id,
        m.user_id,
        hashtag,
        m.like_count,
        m.comment_count,
        m.publish_date
      FROM \`mmm-lab.sns.insta_media_mmm_v3\` m, UNNEST(m.hashtags) AS hashtag
      WHERE m.user_id IN (SELECT user_id FROM target_influencers)
        AND m.publish_date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${periodDays} DAY)
      UNION ALL
      SELECT
        r.media_id,
        r.user_id,
        hashtag,
        r.like_count,
        r.comment_count,
        r.publish_date
      FROM \`mmm-lab.sns.insta_reels_mmm_v3\` r, UNNEST(r.hashtags) AS hashtag
      WHERE r.user_id IN (SELECT user_id FROM target_influencers)
        AND r.publish_date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${periodDays} DAY)
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
  LOWER(hashtag) as hashtag,
  COUNT(*) as usage_count,
  COUNT(DISTINCT user_id) as unique_users,
  ROUND(AVG(like_count), 1) as avg_likes,
  ROUND(AVG(comment_count), 1) as avg_comments,
  ROUND(AVG(like_count + comment_count), 1) as avg_engagement
FROM all_content
GROUP BY 1
HAVING COUNT(*) >= 3
ORDER BY usage_count DESC
LIMIT ${limit}
`.trim();

  return sql;
}

/**
 * Analyze hashtag trends for influencer groups
 */
export async function analyzeHashtagTrends(
  params: HashtagTrendParams
): Promise<TrendAnalysisResult> {
  console.error("\n=== analyzeHashtagTrends ===");
  console.error("Params:", JSON.stringify(params, null, 2));

  try {
    const sql = buildHashtagTrendQuery(params);
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
    const { publicUrl } = await uploadCSV(csv, "hashtag-trends");

    return {
      success: true,
      data: result.rows,
      totalRows: result.totalRows,
      downloadUrl: publicUrl,
      query: sql,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Hashtag trend analysis error:", errorMessage);

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
// 2. detect_emerging_hashtags
// ============================================================================

export interface EmergingHashtagParams {
  country?: string[];
  interests?: string[];
  compare_period?: "2weeks" | "1month" | "3months";
  min_growth_rate?: number;
  min_current_count?: number;
  limit?: number;
}

/**
 * Get period days from compare_period string
 */
function getPeriodDays(period: string): number {
  switch (period) {
    case "2weeks":
      return 14;
    case "1month":
      return 30;
    case "3months":
      return 90;
    default:
      return 30;
  }
}

/**
 * Build SQL query for emerging hashtag detection
 * Note: Uses UNION + DISTINCT to deduplicate content that exists in both tables
 */
function buildEmergingHashtagQuery(params: EmergingHashtagParams): string {
  const comparePeriod = params.compare_period || "1month";
  const periodDays = getPeriodDays(comparePeriod);
  const minGrowthRate = params.min_growth_rate || 1.5;
  const minCurrentCount = params.min_current_count || 10;
  const limit = params.limit || 30;

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

  const sql = `
WITH target_influencers AS (
  SELECT user_id
  FROM \`mmm-lab.gpt_profile.insta_general_profiles\`
  WHERE ${influencerWhere}
),

-- Previous period hashtags (deduplicated by media_id)
previous_period AS (
  SELECT
    LOWER(hashtag) as hashtag,
    COUNT(*) as count
  FROM (
    SELECT DISTINCT media_id, hashtag
    FROM (
      SELECT m.media_id, hashtag
      FROM \`mmm-lab.sns.insta_media_mmm_v3\` m, UNNEST(m.hashtags) AS hashtag
      WHERE m.user_id IN (SELECT user_id FROM target_influencers)
        AND m.publish_date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${periodDays * 2} DAY)
        AND m.publish_date < TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${periodDays} DAY)
      UNION ALL
      SELECT r.media_id, hashtag
      FROM \`mmm-lab.sns.insta_reels_mmm_v3\` r, UNNEST(r.hashtags) AS hashtag
      WHERE r.user_id IN (SELECT user_id FROM target_influencers)
        AND r.publish_date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${periodDays * 2} DAY)
        AND r.publish_date < TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${periodDays} DAY)
    )
  )
  GROUP BY 1
),

-- Current period hashtags (deduplicated by media_id)
current_period AS (
  SELECT
    LOWER(hashtag) as hashtag,
    COUNT(*) as count
  FROM (
    SELECT DISTINCT media_id, hashtag
    FROM (
      SELECT m.media_id, hashtag
      FROM \`mmm-lab.sns.insta_media_mmm_v3\` m, UNNEST(m.hashtags) AS hashtag
      WHERE m.user_id IN (SELECT user_id FROM target_influencers)
        AND m.publish_date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${periodDays} DAY)
      UNION ALL
      SELECT r.media_id, hashtag
      FROM \`mmm-lab.sns.insta_reels_mmm_v3\` r, UNNEST(r.hashtags) AS hashtag
      WHERE r.user_id IN (SELECT user_id FROM target_influencers)
        AND r.publish_date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${periodDays} DAY)
    )
  )
  GROUP BY 1
)

SELECT
  c.hashtag,
  COALESCE(p.count, 0) as previous_count,
  c.count as current_count,
  ROUND(
    CASE
      WHEN COALESCE(p.count, 0) = 0 THEN c.count * 1.0
      ELSE c.count * 1.0 / p.count
    END, 2
  ) as growth_rate,
  ROUND(c.count - COALESCE(p.count, 0), 0) as absolute_growth
FROM current_period c
LEFT JOIN previous_period p ON c.hashtag = p.hashtag
WHERE c.count >= ${minCurrentCount}
  AND (
    COALESCE(p.count, 0) = 0
    OR (c.count * 1.0 / p.count) >= ${minGrowthRate}
  )
ORDER BY growth_rate DESC, current_count DESC
LIMIT ${limit}
`.trim();

  return sql;
}

/**
 * Detect emerging hashtags
 */
export async function detectEmergingHashtags(
  params: EmergingHashtagParams
): Promise<TrendAnalysisResult> {
  console.error("\n=== detectEmergingHashtags ===");
  console.error("Params:", JSON.stringify(params, null, 2));

  try {
    const sql = buildEmergingHashtagQuery(params);
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
    const { publicUrl } = await uploadCSV(csv, "emerging-hashtags");

    return {
      success: true,
      data: result.rows,
      totalRows: result.totalRows,
      downloadUrl: publicUrl,
      query: sql,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Emerging hashtag detection error:", errorMessage);

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
// 3. compare_regional_hashtags
// ============================================================================

export interface RegionalHashtagParams {
  countries: string[];
  interests?: string[];
  period_days?: number;
  limit?: number;
}

/**
 * Build SQL query for regional hashtag comparison
 * Note: Uses UNION + DISTINCT to deduplicate content that exists in both tables
 */
function buildRegionalHashtagQuery(params: RegionalHashtagParams): string {
  const periodDays = params.period_days || 30;
  const limit = params.limit || 20;

  // Build interest conditions
  let interestCondition = "";
  if (params.interests?.length) {
    const interestConditions = params.interests
      .map((i) => `'${escapeSQL(i)}' IN UNNEST(interests)`)
      .join(" OR ");
    interestCondition = `AND (${interestConditions})`;
  }

  // Build country-specific CTEs with deduplication by media_id
  const countryCTEs = params.countries
    .map((country) => {
      const countryCode = escapeSQL(country);
      return `
${countryCode.toLowerCase()}_influencers AS (
  SELECT user_id
  FROM \`mmm-lab.gpt_profile.insta_general_profiles\`
  WHERE '${countryCode}' IN UNNEST(country) ${interestCondition}
),

${countryCode.toLowerCase()}_hashtags AS (
  SELECT
    '${countryCode}' as country,
    LOWER(hashtag) as hashtag,
    COUNT(*) as usage_count
  FROM (
    -- Deduplicate by media_id
    SELECT DISTINCT media_id, hashtag
    FROM (
      SELECT m.media_id, hashtag
      FROM \`mmm-lab.sns.insta_media_mmm_v3\` m, UNNEST(m.hashtags) AS hashtag
      WHERE m.user_id IN (SELECT user_id FROM ${countryCode.toLowerCase()}_influencers)
        AND m.publish_date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${periodDays} DAY)
      UNION ALL
      SELECT r.media_id, hashtag
      FROM \`mmm-lab.sns.insta_reels_mmm_v3\` r, UNNEST(r.hashtags) AS hashtag
      WHERE r.user_id IN (SELECT user_id FROM ${countryCode.toLowerCase()}_influencers)
        AND r.publish_date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${periodDays} DAY)
    )
  )
  GROUP BY 1, 2
  HAVING COUNT(*) >= 3
)`;
    })
    .join(",\n");

  // Build ranked hashtags per country
  const rankedCTEs = params.countries
    .map((country) => {
      const countryCode = escapeSQL(country).toLowerCase();
      return `
${countryCode}_ranked AS (
  SELECT
    country,
    hashtag,
    usage_count,
    ROW_NUMBER() OVER (ORDER BY usage_count DESC) as rank
  FROM ${countryCode}_hashtags
)`;
    })
    .join(",\n");

  // Build UNION ALL for all countries
  const unionAll = params.countries
    .map((country) => `SELECT * FROM ${escapeSQL(country).toLowerCase()}_ranked WHERE rank <= ${limit}`)
    .join("\n  UNION ALL\n  ");

  const sql = `
WITH ${countryCTEs},
${rankedCTEs}

SELECT
  country,
  hashtag,
  usage_count,
  rank
FROM (
  ${unionAll}
)
ORDER BY country, rank
`.trim();

  return sql;
}

/**
 * Compare regional hashtag usage
 */
export async function compareRegionalHashtags(
  params: RegionalHashtagParams
): Promise<TrendAnalysisResult> {
  console.error("\n=== compareRegionalHashtags ===");
  console.error("Params:", JSON.stringify(params, null, 2));

  if (!params.countries || params.countries.length < 2) {
    return {
      success: false,
      data: [],
      totalRows: 0,
      downloadUrl: "",
      query: "",
      error: "At least 2 countries are required for comparison",
    };
  }

  try {
    const sql = buildRegionalHashtagQuery(params);
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
    const { publicUrl } = await uploadCSV(csv, "regional-hashtags");

    return {
      success: true,
      data: result.rows,
      totalRows: result.totalRows,
      downloadUrl: publicUrl,
      query: sql,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Regional hashtag comparison error:", errorMessage);

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

export function getHashtagTrendDescription(params: HashtagTrendParams): string {
  const parts: string[] = [];

  if (params.country?.length) {
    parts.push(`국가: ${params.country.join(", ")}`);
  }
  if (params.interests?.length) {
    parts.push(`관심사: ${params.interests.join(", ")}`);
  }
  parts.push(`기간: ${params.period_days || 30}일`);
  if (params.content_type && params.content_type !== "all") {
    parts.push(`콘텐츠: ${params.content_type}`);
  }

  return parts.length > 0 ? parts.join(" | ") : "전체 해시태그 트렌드";
}

export function getEmergingHashtagDescription(params: EmergingHashtagParams): string {
  const parts: string[] = [];

  if (params.country?.length) {
    parts.push(`국가: ${params.country.join(", ")}`);
  }
  if (params.interests?.length) {
    parts.push(`관심사: ${params.interests.join(", ")}`);
  }
  parts.push(`비교 기간: ${params.compare_period || "1month"}`);
  parts.push(`최소 성장률: ${((params.min_growth_rate || 1.5) * 100).toFixed(0)}%`);

  return parts.join(" | ");
}

export function getRegionalHashtagDescription(params: RegionalHashtagParams): string {
  const parts: string[] = [];

  parts.push(`국가: ${params.countries.join(" vs ")}`);
  if (params.interests?.length) {
    parts.push(`관심사: ${params.interests.join(", ")}`);
  }
  parts.push(`기간: ${params.period_days || 30}일`);

  return parts.join(" | ");
}

// ============================================================================
// 4. analyze_beauty_ingredient_trends
// ============================================================================

export interface BeautyIngredientTrendParams {
  country?: string[];
  period_days?: number;
  category?: "skincare" | "makeup" | "haircare";
  limit?: number;
}

/**
 * Build SQL query for beauty ingredient trend analysis
 * Uses skincare_ingredients from insta_beauty_profiles for skincare category
 * Uses makeup_items for makeup, hair_items for haircare
 */
function buildBeautyIngredientTrendQuery(params: BeautyIngredientTrendParams): string {
  const periodDays = params.period_days || 90;
  const category = params.category || "skincare";
  const limit = params.limit || 30;

  // Build country filter
  const countryConditions: string[] = ["1=1"];
  if (params.country?.length) {
    const conditions = params.country
      .map((c) => `'${escapeSQL(c)}' IN UNNEST(g.country)`)
      .join(" OR ");
    countryConditions.push(`(${conditions})`);
  }
  const countryWhere = countryConditions.join(" AND ");

  // Determine which field to use based on category
  // Note: Use column names WITHOUT alias for CTE references, WITH alias for JOIN conditions
  let ingredientField: string;  // Column name in target_influencers CTE
  let categoryFilter: string;   // Filter condition with b. alias for JOIN
  let relatedProductsField: string;
  let relatedConcernsField: string;

  switch (category) {
    case "makeup":
      ingredientField = "makeup_items";
      categoryFilter = "'Makeup' IN UNNEST(b.beauty_interest_areas)";
      relatedProductsField = "beauty_products";
      relatedConcernsField = "makeup_interests";
      break;
    case "haircare":
      ingredientField = "hair_items";
      categoryFilter = "'Hair Care' IN UNNEST(b.beauty_interest_areas)";
      relatedProductsField = "beauty_products";
      relatedConcernsField = "hair_concerns";
      break;
    case "skincare":
    default:
      ingredientField = "skincare_ingredients";
      categoryFilter = "'Skincare' IN UNNEST(b.beauty_interest_areas)";
      relatedProductsField = "beauty_products";
      relatedConcernsField = "skin_concerns";
      break;
  }

  const sql = `
WITH target_influencers AS (
  SELECT
    g.user_id,
    b.skincare_ingredients,
    b.makeup_items,
    b.hair_items,
    b.beauty_products,
    b.skin_concerns,
    b.makeup_interests,
    b.hair_concerns,
    b.analyzed_at
  FROM \`mmm-lab.gpt_profile.insta_general_profiles\` g
  JOIN \`mmm-lab.gpt_profile.insta_beauty_profiles\` b ON g.user_id = b.user_id
  WHERE ${countryWhere}
    AND ${categoryFilter}
    AND b.analyzed_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${periodDays} DAY)
),

-- Current period: last half of the period
current_period_ingredients AS (
  SELECT
    ingredient,
    COUNT(DISTINCT user_id) as influencer_count
  FROM target_influencers, UNNEST(${ingredientField}) as ingredient
  WHERE analyzed_at >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${Math.floor(periodDays / 2)} DAY)
  GROUP BY ingredient
),

-- Previous period: first half of the period
previous_period_ingredients AS (
  SELECT
    ingredient,
    COUNT(DISTINCT user_id) as influencer_count
  FROM target_influencers, UNNEST(${ingredientField}) as ingredient
  WHERE analyzed_at < TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${Math.floor(periodDays / 2)} DAY)
  GROUP BY ingredient
),

-- Related data aggregation
ingredient_details AS (
  SELECT
    ingredient,
    ARRAY_AGG(DISTINCT product IGNORE NULLS LIMIT 5) as related_products,
    ARRAY_AGG(DISTINCT concern IGNORE NULLS LIMIT 5) as related_concerns
  FROM target_influencers,
    UNNEST(${ingredientField}) as ingredient,
    UNNEST(${relatedProductsField}) as product,
    UNNEST(${relatedConcernsField}) as concern
  GROUP BY ingredient
)

SELECT
  c.ingredient,
  c.influencer_count as current_count,
  COALESCE(p.influencer_count, 0) as previous_count,
  ROUND(
    CASE
      WHEN COALESCE(p.influencer_count, 0) = 0 THEN c.influencer_count * 1.0
      ELSE c.influencer_count * 1.0 / p.influencer_count
    END, 2
  ) as growth_rate,
  ARRAY_TO_STRING(COALESCE(d.related_products, []), ', ') as related_products,
  ARRAY_TO_STRING(COALESCE(d.related_concerns, []), ', ') as related_concerns
FROM current_period_ingredients c
LEFT JOIN previous_period_ingredients p ON c.ingredient = p.ingredient
LEFT JOIN ingredient_details d ON c.ingredient = d.ingredient
WHERE c.influencer_count >= 3
ORDER BY growth_rate DESC, current_count DESC
LIMIT ${limit}
`.trim();

  return sql;
}

/**
 * Analyze beauty ingredient trends
 */
export async function analyzeBeautyIngredientTrends(
  params: BeautyIngredientTrendParams
): Promise<TrendAnalysisResult> {
  console.error("\n=== analyzeBeautyIngredientTrends ===");
  console.error("Params:", JSON.stringify(params, null, 2));

  try {
    const sql = buildBeautyIngredientTrendQuery(params);
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
    const { publicUrl } = await uploadCSV(csv, "beauty-ingredient-trends");

    return {
      success: true,
      data: result.rows,
      totalRows: result.totalRows,
      downloadUrl: publicUrl,
      query: sql,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Beauty ingredient trend analysis error:", errorMessage);

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

export function getBeautyIngredientTrendDescription(params: BeautyIngredientTrendParams): string {
  const parts: string[] = [];

  if (params.country?.length) {
    parts.push(`국가: ${params.country.join(", ")}`);
  }
  parts.push(`카테고리: ${params.category || "skincare"}`);
  parts.push(`기간: ${params.period_days || 90}일`);

  return parts.join(" | ");
}
