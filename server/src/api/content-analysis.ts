/**
 * Content Analysis API Module
 *
 * Provides tools for analyzing content performance metrics:
 * 1. analyze_engagement_metrics - Engagement statistics analysis
 * 2. compare_content_formats - Feed vs Reels performance comparison
 * 3. find_optimal_posting_time - Optimal posting time analysis
 * 4. analyze_viral_content_patterns - Viral content pattern analysis
 * 5. analyze_beauty_content_performance - Beauty content type performance
 */

import { executeQuery, validateQuery, toCSV } from "./bigquery.js";
import { uploadCSV } from "./gcs.js";

// ============================================================================
// Common Types
// ============================================================================

export interface ContentAnalysisResult {
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
// 1. analyze_engagement_metrics
// ============================================================================

export interface EngagementMetricsParams {
  country?: string[];
  interests?: string[];
  collaboration_tier?: string[];
  period_days?: number;
  content_type?: "all" | "media" | "reels";
}

/**
 * Build SQL query for engagement metrics analysis
 */
function buildEngagementMetricsQuery(params: EngagementMetricsParams): string {
  const periodDays = params.period_days || 30;
  const contentType = params.content_type || "all";

  // Build filter conditions for profile
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

  // Build content source query based on content_type
  let contentQuery: string;

  if (contentType === "media") {
    contentQuery = `
      SELECT
        m.media_id,
        m.user_id,
        m.like_count,
        m.comment_count,
        p.followed_by
      FROM \`mmm-lab.sns.insta_media_mmm_v3\` m
      JOIN \`mmm-lab.gpt_profile.insta_general_profiles\` g ON m.user_id = g.user_id
      JOIN \`mmm-lab.sns.insta_profile_mmm_v3\` p ON m.user_id = p.user_id
      WHERE m.publish_date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${periodDays} DAY)
        AND m.is_video = FALSE
        AND ${profileWhereClause}
    `;
  } else if (contentType === "reels") {
    contentQuery = `
      SELECT
        r.media_id,
        r.user_id,
        r.like_count,
        r.comment_count,
        p.followed_by
      FROM \`mmm-lab.sns.insta_reels_mmm_v3\` r
      JOIN \`mmm-lab.gpt_profile.insta_general_profiles\` g ON r.user_id = g.user_id
      JOIN \`mmm-lab.sns.insta_profile_mmm_v3\` p ON r.user_id = p.user_id
      WHERE r.publish_date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${periodDays} DAY)
        AND ${profileWhereClause}
    `;
  } else {
    // all: union media + reels with deduplication
    contentQuery = `
      SELECT DISTINCT media_id, user_id, like_count, comment_count, followed_by
      FROM (
        SELECT
          m.media_id,
          m.user_id,
          m.like_count,
          m.comment_count,
          p.followed_by
        FROM \`mmm-lab.sns.insta_media_mmm_v3\` m
        JOIN \`mmm-lab.gpt_profile.insta_general_profiles\` g ON m.user_id = g.user_id
        JOIN \`mmm-lab.sns.insta_profile_mmm_v3\` p ON m.user_id = p.user_id
        WHERE m.publish_date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${periodDays} DAY)
          AND ${profileWhereClause}

        UNION ALL

        SELECT
          r.media_id,
          r.user_id,
          r.like_count,
          r.comment_count,
          p.followed_by
        FROM \`mmm-lab.sns.insta_reels_mmm_v3\` r
        JOIN \`mmm-lab.gpt_profile.insta_general_profiles\` g ON r.user_id = g.user_id
        JOIN \`mmm-lab.sns.insta_profile_mmm_v3\` p ON r.user_id = p.user_id
        WHERE r.publish_date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${periodDays} DAY)
          AND ${profileWhereClause}
      )
    `;
  }

  const sql = `
WITH filtered_content AS (
  ${contentQuery}
)
SELECT
  COUNT(DISTINCT media_id) as total_content,
  COUNT(DISTINCT user_id) as unique_influencers,
  ROUND(AVG(like_count), 0) as avg_likes,
  APPROX_QUANTILES(like_count, 100)[OFFSET(50)] as median_likes,
  ROUND(AVG(comment_count), 0) as avg_comments,
  APPROX_QUANTILES(comment_count, 100)[OFFSET(50)] as median_comments,
  ROUND(AVG((like_count + comment_count) * 100.0 / NULLIF(followed_by, 0)), 2) as avg_engagement_rate,
  APPROX_QUANTILES(like_count, 100)[OFFSET(90)] as p90_likes,
  APPROX_QUANTILES(like_count, 100)[OFFSET(95)] as p95_likes,
  APPROX_QUANTILES(like_count, 100)[OFFSET(99)] as p99_likes
FROM filtered_content
`.trim();

  return sql;
}

/**
 * Analyze engagement metrics for content
 */
export async function analyzeEngagementMetrics(
  params: EngagementMetricsParams
): Promise<ContentAnalysisResult> {
  console.error("\n=== analyzeEngagementMetrics ===");
  console.error("Params:", JSON.stringify(params, null, 2));

  try {
    const sql = buildEngagementMetricsQuery(params);
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
    const { publicUrl } = await uploadCSV(csv, "engagement-metrics");

    return {
      success: true,
      data: result.rows,
      totalRows: result.totalRows,
      downloadUrl: publicUrl,
      query: sql,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Engagement metrics analysis error:", errorMessage);

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

export function getEngagementMetricsDescription(): string {
  return `Analyze engagement metrics (likes, comments, engagement rate) for content.
Returns average, median, and percentile statistics.`;
}

// ============================================================================
// 2. compare_content_formats
// ============================================================================

export interface ContentFormatsParams {
  country?: string[];
  interests?: string[];
  period_days?: number;
}

/**
 * Build SQL query for content format comparison
 */
function buildContentFormatsQuery(params: ContentFormatsParams): string {
  const periodDays = params.period_days || 90;

  // Build filter conditions
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

  const profileWhereClause =
    profileConditions.length > 0 ? profileConditions.join(" AND ") : "1=1";

  const sql = `
WITH feed_content AS (
  SELECT
    m.media_id,
    m.user_id,
    m.like_count,
    m.comment_count,
    p.followed_by,
    'feed' as content_type
  FROM \`mmm-lab.sns.insta_media_mmm_v3\` m
  JOIN \`mmm-lab.gpt_profile.insta_general_profiles\` g ON m.user_id = g.user_id
  JOIN \`mmm-lab.sns.insta_profile_mmm_v3\` p ON m.user_id = p.user_id
  WHERE m.publish_date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${periodDays} DAY)
    AND m.is_video = FALSE
    AND ${profileWhereClause}
),
reels_content AS (
  SELECT
    r.media_id,
    r.user_id,
    r.like_count,
    r.comment_count,
    p.followed_by,
    'reels' as content_type
  FROM \`mmm-lab.sns.insta_reels_mmm_v3\` r
  JOIN \`mmm-lab.gpt_profile.insta_general_profiles\` g ON r.user_id = g.user_id
  JOIN \`mmm-lab.sns.insta_profile_mmm_v3\` p ON r.user_id = p.user_id
  WHERE r.publish_date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${periodDays} DAY)
    AND ${profileWhereClause}
),
all_content AS (
  SELECT * FROM feed_content
  UNION ALL
  SELECT * FROM reels_content
)
SELECT
  content_type,
  COUNT(DISTINCT media_id) as content_count,
  COUNT(DISTINCT user_id) as unique_influencers,
  ROUND(AVG(like_count), 0) as avg_likes,
  ROUND(AVG(comment_count), 0) as avg_comments,
  ROUND(AVG((like_count + comment_count) * 100.0 / NULLIF(followed_by, 0)), 2) as avg_engagement_rate,
  APPROX_QUANTILES(like_count, 100)[OFFSET(50)] as median_likes
FROM all_content
GROUP BY content_type
ORDER BY content_type
`.trim();

  return sql;
}

/**
 * Compare content formats (feed vs reels)
 */
export async function compareContentFormats(
  params: ContentFormatsParams
): Promise<ContentAnalysisResult> {
  console.error("\n=== compareContentFormats ===");
  console.error("Params:", JSON.stringify(params, null, 2));

  try {
    const sql = buildContentFormatsQuery(params);
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
    const { publicUrl } = await uploadCSV(csv, "content-formats-comparison");

    return {
      success: true,
      data: result.rows,
      totalRows: result.totalRows,
      downloadUrl: publicUrl,
      query: sql,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Content format comparison error:", errorMessage);

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

export function getContentFormatsDescription(): string {
  return `Compare performance metrics between feed posts and reels.
Returns engagement statistics for each content format.`;
}

// ============================================================================
// 3. find_optimal_posting_time
// ============================================================================

export interface OptimalPostingTimeParams {
  country?: string[];
  interests?: string[];
  period_days?: number;
}

/**
 * Build SQL query for optimal posting time analysis
 */
function buildOptimalPostingTimeQuery(params: OptimalPostingTimeParams): string {
  const periodDays = params.period_days || 90;

  // Build filter conditions
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

  const profileWhereClause =
    profileConditions.length > 0 ? profileConditions.join(" AND ") : "1=1";

  const sql = `
WITH all_content AS (
  SELECT DISTINCT media_id, user_id, like_count, comment_count, publish_date, followed_by
  FROM (
    SELECT
      m.media_id,
      m.user_id,
      m.like_count,
      m.comment_count,
      m.publish_date,
      p.followed_by
    FROM \`mmm-lab.sns.insta_media_mmm_v3\` m
    JOIN \`mmm-lab.gpt_profile.insta_general_profiles\` g ON m.user_id = g.user_id
    JOIN \`mmm-lab.sns.insta_profile_mmm_v3\` p ON m.user_id = p.user_id
    WHERE m.publish_date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${periodDays} DAY)
      AND ${profileWhereClause}

    UNION ALL

    SELECT
      r.media_id,
      r.user_id,
      r.like_count,
      r.comment_count,
      r.publish_date,
      p.followed_by
    FROM \`mmm-lab.sns.insta_reels_mmm_v3\` r
    JOIN \`mmm-lab.gpt_profile.insta_general_profiles\` g ON r.user_id = g.user_id
    JOIN \`mmm-lab.sns.insta_profile_mmm_v3\` p ON r.user_id = p.user_id
    WHERE r.publish_date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${periodDays} DAY)
      AND ${profileWhereClause}
  )
)
SELECT
  EXTRACT(DAYOFWEEK FROM publish_date) as day_of_week,
  EXTRACT(HOUR FROM publish_date) as hour,
  COUNT(DISTINCT media_id) as post_count,
  ROUND(AVG(like_count), 0) as avg_likes,
  ROUND(AVG(comment_count), 0) as avg_comments,
  ROUND(AVG((like_count + comment_count) * 100.0 / NULLIF(followed_by, 0)), 2) as avg_engagement_rate
FROM all_content
WHERE publish_date IS NOT NULL
GROUP BY day_of_week, hour
HAVING COUNT(DISTINCT media_id) >= 10
ORDER BY avg_engagement_rate DESC
LIMIT 50
`.trim();

  return sql;
}

/**
 * Find optimal posting times based on engagement
 */
export async function findOptimalPostingTime(
  params: OptimalPostingTimeParams
): Promise<ContentAnalysisResult> {
  console.error("\n=== findOptimalPostingTime ===");
  console.error("Params:", JSON.stringify(params, null, 2));

  try {
    const sql = buildOptimalPostingTimeQuery(params);
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
    const { publicUrl } = await uploadCSV(csv, "optimal-posting-time");

    return {
      success: true,
      data: result.rows,
      totalRows: result.totalRows,
      downloadUrl: publicUrl,
      query: sql,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Optimal posting time analysis error:", errorMessage);

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

export function getOptimalPostingTimeDescription(): string {
  return `Analyze optimal posting times based on engagement rates.
Returns day of week (1=Sunday, 7=Saturday) and hour (0-23) with engagement metrics.`;
}

// ============================================================================
// 4. analyze_viral_content_patterns
// ============================================================================

export interface ViralContentParams {
  country?: string[];
  interests?: string[];
  viral_threshold?: number;
  period_days?: number;
}

/**
 * Build SQL query for viral content pattern analysis
 */
function buildViralContentQuery(params: ViralContentParams): string {
  const periodDays = params.period_days || 180;
  const viralThreshold = params.viral_threshold || 100000;

  // Build filter conditions
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

  const profileWhereClause =
    profileConditions.length > 0 ? profileConditions.join(" AND ") : "1=1";

  const sql = `
WITH viral_content AS (
  SELECT DISTINCT
    media_id,
    user_id,
    like_count,
    comment_count,
    publish_date,
    hashtags,
    caption,
    content_type
  FROM (
    SELECT
      m.media_id,
      m.user_id,
      m.like_count,
      m.comment_count,
      m.publish_date,
      m.hashtags,
      m.caption,
      CASE WHEN m.is_video THEN 'reels' ELSE 'feed' END as content_type
    FROM \`mmm-lab.sns.insta_media_mmm_v3\` m
    JOIN \`mmm-lab.gpt_profile.insta_general_profiles\` g ON m.user_id = g.user_id
    WHERE m.publish_date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${periodDays} DAY)
      AND m.like_count >= ${viralThreshold}
      AND ${profileWhereClause}

    UNION ALL

    SELECT
      r.media_id,
      r.user_id,
      r.like_count,
      r.comment_count,
      r.publish_date,
      r.hashtags,
      r.caption,
      'reels' as content_type
    FROM \`mmm-lab.sns.insta_reels_mmm_v3\` r
    JOIN \`mmm-lab.gpt_profile.insta_general_profiles\` g ON r.user_id = g.user_id
    WHERE r.publish_date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${periodDays} DAY)
      AND r.like_count >= ${viralThreshold}
      AND ${profileWhereClause}
  )
),
-- Content type distribution
content_type_stats AS (
  SELECT
    content_type,
    COUNT(DISTINCT media_id) as count
  FROM viral_content
  GROUP BY content_type
),
-- Top hashtags
hashtag_stats AS (
  SELECT
    hashtag,
    COUNT(*) as usage_count
  FROM viral_content, UNNEST(hashtags) as hashtag
  GROUP BY hashtag
  ORDER BY usage_count DESC
  LIMIT 20
),
-- Day of week distribution
day_stats AS (
  SELECT
    EXTRACT(DAYOFWEEK FROM publish_date) as day_of_week,
    COUNT(DISTINCT media_id) as count
  FROM viral_content
  WHERE publish_date IS NOT NULL
  GROUP BY day_of_week
)
SELECT
  (SELECT COUNT(DISTINCT media_id) FROM viral_content) as viral_content_count,
  (SELECT COUNT(DISTINCT user_id) FROM viral_content) as unique_creators,
  (SELECT ROUND(AVG(like_count), 0) FROM viral_content) as avg_likes,
  (SELECT ROUND(AVG(comment_count), 0) FROM viral_content) as avg_comments,
  (SELECT ROUND(AVG(LENGTH(caption)), 0) FROM viral_content WHERE caption IS NOT NULL) as avg_caption_length,
  (SELECT ARRAY_AGG(STRUCT(content_type, count)) FROM content_type_stats) as content_type_distribution,
  (SELECT ARRAY_AGG(STRUCT(hashtag, usage_count) ORDER BY usage_count DESC LIMIT 10) FROM hashtag_stats) as top_hashtags,
  (SELECT ARRAY_AGG(STRUCT(day_of_week, count) ORDER BY count DESC) FROM day_stats) as day_distribution
`.trim();

  return sql;
}

/**
 * Analyze viral content patterns
 */
export async function analyzeViralContentPatterns(
  params: ViralContentParams
): Promise<ContentAnalysisResult> {
  console.error("\n=== analyzeViralContentPatterns ===");
  console.error("Params:", JSON.stringify(params, null, 2));

  try {
    const sql = buildViralContentQuery(params);
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
    const { publicUrl } = await uploadCSV(csv, "viral-content-patterns");

    return {
      success: true,
      data: result.rows,
      totalRows: result.totalRows,
      downloadUrl: publicUrl,
      query: sql,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Viral content pattern analysis error:", errorMessage);

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

export function getViralContentDescription(): string {
  return `Analyze patterns in viral content (high engagement posts).
Returns content type distribution, top hashtags, and posting day patterns.`;
}

// ============================================================================
// 5. analyze_beauty_content_performance
// ============================================================================

export interface BeautyContentParams {
  country?: string[];
  beauty_content_types?: string[];
  period_days?: number;
}

/**
 * Build SQL query for beauty content performance analysis
 */
function buildBeautyContentQuery(params: BeautyContentParams): string {
  const periodDays = params.period_days || 90;

  // Build filter conditions
  const profileConditions: string[] = [];

  if (params.country?.length) {
    const countryConditions = params.country
      .map((c) => `'${escapeSQL(c)}' IN UNNEST(g.country)`)
      .join(" OR ");
    profileConditions.push(`(${countryConditions})`);
  }

  if (params.beauty_content_types?.length) {
    const contentTypeConditions = params.beauty_content_types
      .map((t) => `'${escapeSQL(t)}' IN UNNEST(b.beauty_content_types)`)
      .join(" OR ");
    profileConditions.push(`(${contentTypeConditions})`);
  }

  const profileWhereClause =
    profileConditions.length > 0 ? profileConditions.join(" AND ") : "1=1";

  const sql = `
WITH beauty_influencers AS (
  SELECT
    g.user_id,
    b.beauty_content_types,
    p.followed_by
  FROM \`mmm-lab.gpt_profile.insta_general_profiles\` g
  INNER JOIN \`mmm-lab.gpt_profile.insta_beauty_profiles\` b ON g.user_id = b.user_id
  LEFT JOIN \`mmm-lab.sns.insta_profile_mmm_v3\` p ON g.user_id = p.user_id
  WHERE ${profileWhereClause}
),
flattened_types AS (
  SELECT
    user_id,
    content_type,
    followed_by
  FROM beauty_influencers,
  UNNEST(IFNULL(beauty_content_types, ['Unknown'])) as content_type
),
content_stats AS (
  SELECT DISTINCT
    media_id,
    c.user_id,
    c.like_count,
    c.comment_count,
    f.content_type,
    f.followed_by
  FROM (
    SELECT media_id, user_id, like_count, comment_count
    FROM \`mmm-lab.sns.insta_media_mmm_v3\`
    WHERE publish_date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${periodDays} DAY)

    UNION ALL

    SELECT media_id, user_id, like_count, comment_count
    FROM \`mmm-lab.sns.insta_reels_mmm_v3\`
    WHERE publish_date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL ${periodDays} DAY)
  ) c
  JOIN flattened_types f ON c.user_id = f.user_id
)
SELECT
  content_type as beauty_content_type,
  COUNT(DISTINCT user_id) as influencer_count,
  COUNT(DISTINCT media_id) as content_count,
  ROUND(AVG(like_count), 0) as avg_likes,
  ROUND(AVG(comment_count), 0) as avg_comments,
  ROUND(AVG((like_count + comment_count) * 100.0 / NULLIF(followed_by, 0)), 2) as avg_engagement_rate
FROM content_stats
GROUP BY content_type
HAVING COUNT(DISTINCT user_id) >= 5
ORDER BY avg_engagement_rate DESC
`.trim();

  return sql;
}

/**
 * Analyze beauty content performance by type
 */
export async function analyzeBeautyContentPerformance(
  params: BeautyContentParams
): Promise<ContentAnalysisResult> {
  console.error("\n=== analyzeBeautyContentPerformance ===");
  console.error("Params:", JSON.stringify(params, null, 2));

  try {
    const sql = buildBeautyContentQuery(params);
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
    const { publicUrl } = await uploadCSV(csv, "beauty-content-performance");

    return {
      success: true,
      data: result.rows,
      totalRows: result.totalRows,
      downloadUrl: publicUrl,
      query: sql,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Beauty content performance analysis error:", errorMessage);

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

export function getBeautyContentDescription(): string {
  return `Analyze performance of different beauty content types.
Beauty content types include: Makeup Tutorial, Product Review, Skincare Routine, GRWM, Unboxing, Before After, Haul, Look Recreation.`;
}
