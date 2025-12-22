import { executeQuery, toCSV, validateQuery } from "./bigquery.js";
import { uploadCSV } from "./gcs.js";

/**
 * Search parameters for influencer search
 */
export interface SearchInfluencersParams {
  // General filters
  country?: string[];
  gender?: string;
  age_range?: string[];
  interests?: string[];
  collaboration_tier?: string[];
  follower_min?: number;
  follower_max?: number;
  k_interest?: boolean;

  // Beauty-specific filters
  beauty_interest_areas?: string[];
  beauty_content_types?: string[];
  skin_type?: string[];
  skin_concerns?: string[];
  personal_color?: string;
  brand_tier_segments?: string;

  // Result options
  limit?: number;
}

/**
 * Search result interface
 */
export interface SearchInfluencersResult {
  success: boolean;
  data: Record<string, unknown>[];
  totalRows: number;
  downloadUrl: string;
  query: string;
  error?: string;
}

/**
 * Check if any beauty-specific parameters are provided
 */
function hasBeautyParams(params: SearchInfluencersParams): boolean {
  return !!(
    params.beauty_interest_areas?.length ||
    params.beauty_content_types?.length ||
    params.skin_type?.length ||
    params.skin_concerns?.length ||
    params.personal_color ||
    params.brand_tier_segments
  );
}

/**
 * Escape string for SQL
 */
function escapeSQL(value: string): string {
  return value.replace(/'/g, "''");
}

/**
 * Build SQL query dynamically based on parameters
 */
function buildSearchQuery(params: SearchInfluencersParams): string {
  const hasBeauty = hasBeautyParams(params);
  const limit = params.limit || 50;

  // Build SELECT columns
  const generalColumns = [
    "g.user_id",
    "g.gender",
    "g.age_range",
    "g.ethnic_category",
    "g.country",
    "g.region",
    "g.language",
    "g.interests",
    "g.interests_in_detail",
    "g.field_of_creator",
    "g.collaboration_tier",
    "g.willing_to_collaborate",
    "g.collaborate_brand",
    "g.account_type",
    "g.k_interest",
    "g.analyzed_at",
  ];

  const beautyColumns = hasBeauty
    ? [
        "b.beauty_interest_areas",
        "b.beauty_brands",
        "b.beauty_content_types",
        "b.beauty_products",
        "b.makeup_interests",
        "b.makeup_points",
        "b.makeup_items",
        "b.makeup_color_preferences",
        "b.skincare_items",
        "b.skin_concerns",
        "b.skin_type",
        "b.skincare_ingredients",
        "b.hair_type",
        "b.hair_concerns",
        "b.skin_tone",
        "b.personal_color",
        "b.personal_color_detailed",
        "b.aesthetic_keywords",
        "b.brand_tier_segments",
        "b.brand_positioning_segments",
        "b.beauty_creator_desc",
      ]
    : [];

  const selectColumns = [...generalColumns, ...beautyColumns].join(",\n    ");

  // Build WHERE conditions
  const conditions: string[] = ["1=1"];

  // Country filter
  if (params.country?.length) {
    const countryConditions = params.country
      .map((c) => `'${escapeSQL(c)}' IN UNNEST(g.country)`)
      .join(" OR ");
    conditions.push(`(${countryConditions})`);
  }

  // Gender filter
  if (params.gender) {
    conditions.push(`g.gender = '${escapeSQL(params.gender)}'`);
  }

  // Age range filter
  if (params.age_range?.length) {
    const ageValues = params.age_range.map((a) => `'${escapeSQL(a)}'`).join(", ");
    conditions.push(`g.age_range IN (${ageValues})`);
  }

  // Interests filter (OR logic)
  if (params.interests?.length) {
    const interestConditions = params.interests
      .map((i) => `'${escapeSQL(i)}' IN UNNEST(g.interests)`)
      .join(" OR ");
    conditions.push(`(${interestConditions})`);
  }

  // Collaboration tier filter
  if (params.collaboration_tier?.length) {
    const tierValues = params.collaboration_tier.map((t) => `'${escapeSQL(t)}'`).join(", ");
    conditions.push(`g.collaboration_tier IN (${tierValues})`);
  }

  // K-interest filter
  if (params.k_interest === true) {
    conditions.push(`g.k_interest = TRUE`);
  }

  // Beauty-specific conditions
  if (hasBeauty) {
    // Beauty interest areas
    if (params.beauty_interest_areas?.length) {
      const beautyInterestConditions = params.beauty_interest_areas
        .map((i) => `'${escapeSQL(i)}' IN UNNEST(b.beauty_interest_areas)`)
        .join(" OR ");
      conditions.push(`(${beautyInterestConditions})`);
    }

    // Beauty content types
    if (params.beauty_content_types?.length) {
      const contentTypeConditions = params.beauty_content_types
        .map((t) => `'${escapeSQL(t)}' IN UNNEST(b.beauty_content_types)`)
        .join(" OR ");
      conditions.push(`(${contentTypeConditions})`);
    }

    // Skin type
    if (params.skin_type?.length) {
      const skinTypeConditions = params.skin_type
        .map((t) => `'${escapeSQL(t)}' IN UNNEST(b.skin_type)`)
        .join(" OR ");
      conditions.push(`(${skinTypeConditions})`);
    }

    // Skin concerns
    if (params.skin_concerns?.length) {
      const skinConcernConditions = params.skin_concerns
        .map((c) => `'${escapeSQL(c)}' IN UNNEST(b.skin_concerns)`)
        .join(" OR ");
      conditions.push(`(${skinConcernConditions})`);
    }

    // Personal color
    if (params.personal_color) {
      conditions.push(`b.personal_color = '${escapeSQL(params.personal_color)}'`);
    }

    // Brand tier segments
    if (params.brand_tier_segments) {
      conditions.push(`b.brand_tier_segments = '${escapeSQL(params.brand_tier_segments)}'`);
    }
  }

  const whereClause = conditions.join("\n    AND ");

  // Build JOIN clause
  const joinClause = hasBeauty
    ? `INNER JOIN \`mmm-lab.gpt_profile.insta_beauty_profiles\` b ON g.user_id = b.user_id`
    : "";

  // Build follower filter conditions
  const followerConditions: string[] = ["1=1"];
  if (params.follower_min !== undefined) {
    followerConditions.push(`p.followed_by >= ${params.follower_min}`);
  }
  if (params.follower_max !== undefined) {
    followerConditions.push(`p.followed_by <= ${params.follower_max}`);
  }
  const followerWhereClause = followerConditions.join(" AND ");

  // Build final SQL
  const sql = `
WITH base_profiles AS (
  SELECT
    ${selectColumns}
  FROM \`mmm-lab.gpt_profile.insta_general_profiles\` g
  ${joinClause}
  WHERE ${whereClause}
),

profiles_with_followers AS (
  SELECT
    bp.*,
    p.username,
    p.full_name,
    p.biography,
    p.followed_by AS follower_count,
    p.follows AS following_count,
    p.media_count,
    p.profile_pic_url,
    p.external_url,
    p.is_verified,
    p.is_business_account,
    p.is_professional_account
  FROM base_profiles bp
  INNER JOIN \`mmm-lab.sns.insta_profile_mmm_v3\` p ON bp.user_id = p.user_id
  WHERE ${followerWhereClause}
)

SELECT *
FROM profiles_with_followers
ORDER BY follower_count DESC
LIMIT ${limit}
`.trim();

  return sql;
}

/**
 * Search influencers using BigQuery
 */
export async function searchInfluencersBigQuery(
  params: SearchInfluencersParams
): Promise<SearchInfluencersResult> {
  console.error("\n=== searchInfluencersBigQuery ===");
  console.error("Params:", JSON.stringify(params, null, 2));

  try {
    // Build SQL query
    const sql = buildSearchQuery(params);
    console.error("Generated SQL:", sql.substring(0, 500) + "...");

    // Validate query
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

    // Execute query
    const result = await executeQuery(sql);

    // Upload to GCS for download
    const csv = toCSV(result);
    const { publicUrl } = await uploadCSV(csv, "influencer-search");

    return {
      success: true,
      data: result.rows,
      totalRows: result.totalRows,
      downloadUrl: publicUrl,
      query: sql,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Search error:", errorMessage);

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

/**
 * Search parameters for brand collaboration search
 */
export interface SearchByBrandParams {
  brand_name: string;
  country?: string[];
  exclude_brand?: string[];
  collaboration_tier?: string[];
  follower_min?: number;
  follower_max?: number;
  limit?: number;
}

/**
 * Build SQL query for brand collaboration search
 * Uses LOWER() for case-insensitive brand matching
 */
function buildBrandCollaborationQuery(params: SearchByBrandParams): string {
  const limit = params.limit || 50;

  // Build WHERE conditions
  const conditions: string[] = [];

  // Brand name filter (case-insensitive using LOWER)
  const brandNameLower = escapeSQL(params.brand_name.toLowerCase());
  conditions.push(`EXISTS (
    SELECT 1 FROM UNNEST(g.collaborate_brand) AS brand
    WHERE LOWER(brand) = '${brandNameLower}'
  )`);

  // Country filter
  if (params.country?.length) {
    const countryConditions = params.country
      .map((c) => `'${escapeSQL(c)}' IN UNNEST(g.country)`)
      .join(" OR ");
    conditions.push(`(${countryConditions})`);
  }

  // Exclude brands filter (case-insensitive)
  if (params.exclude_brand?.length) {
    const excludeBrands = params.exclude_brand
      .map((b) => `'${escapeSQL(b.toLowerCase())}'`)
      .join(", ");
    conditions.push(`NOT EXISTS (
    SELECT 1 FROM UNNEST(g.collaborate_brand) AS brand
    WHERE LOWER(brand) IN (${excludeBrands})
  )`);
  }

  // Collaboration tier filter
  if (params.collaboration_tier?.length) {
    const tierValues = params.collaboration_tier.map((t) => `'${escapeSQL(t)}'`).join(", ");
    conditions.push(`g.collaboration_tier IN (${tierValues})`);
  }

  const whereClause = conditions.join("\n    AND ");

  // Build follower filter conditions
  const followerConditions: string[] = ["1=1"];
  if (params.follower_min !== undefined) {
    followerConditions.push(`p.followed_by >= ${params.follower_min}`);
  }
  if (params.follower_max !== undefined) {
    followerConditions.push(`p.followed_by <= ${params.follower_max}`);
  }
  const followerWhereClause = followerConditions.join(" AND ");

  // Build final SQL
  const sql = `
WITH brand_collaborators AS (
  SELECT
    g.user_id,
    g.gender,
    g.age_range,
    g.ethnic_category,
    g.country,
    g.region,
    g.language,
    g.interests,
    g.interests_in_detail,
    g.field_of_creator,
    g.collaboration_tier,
    g.willing_to_collaborate,
    g.collaborate_brand,
    g.account_type,
    g.k_interest,
    g.analyzed_at
  FROM \`mmm-lab.gpt_profile.insta_general_profiles\` g
  WHERE ${whereClause}
),

profiles_with_followers AS (
  SELECT
    bc.*,
    p.username,
    p.full_name,
    p.biography,
    p.followed_by AS follower_count,
    p.follows AS following_count,
    p.media_count,
    p.profile_pic_url,
    p.external_url,
    p.is_verified,
    p.is_business_account,
    p.is_professional_account
  FROM brand_collaborators bc
  INNER JOIN \`mmm-lab.sns.insta_profile_mmm_v3\` p ON bc.user_id = p.user_id
  WHERE ${followerWhereClause}
)

SELECT *
FROM profiles_with_followers
ORDER BY follower_count DESC
LIMIT ${limit}
`.trim();

  return sql;
}

/**
 * Search influencers by brand collaboration history
 */
export async function searchByBrandCollaboration(
  params: SearchByBrandParams
): Promise<SearchInfluencersResult> {
  console.error("\n=== searchByBrandCollaboration ===");
  console.error("Params:", JSON.stringify(params, null, 2));

  try {
    // Build SQL query
    const sql = buildBrandCollaborationQuery(params);
    console.error("Generated SQL:", sql.substring(0, 500) + "...");

    // Validate query
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

    // Execute query
    const result = await executeQuery(sql);

    // Upload to GCS for download
    const csv = toCSV(result);
    const { publicUrl } = await uploadCSV(csv, "brand-collaboration-search");

    return {
      success: true,
      data: result.rows,
      totalRows: result.totalRows,
      downloadUrl: publicUrl,
      query: sql,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error("Brand collaboration search error:", errorMessage);

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

/**
 * Get description of brand collaboration search for display
 */
export function getBrandSearchDescription(params: SearchByBrandParams): string {
  const parts: string[] = [`브랜드: ${params.brand_name}`];

  if (params.country?.length) {
    parts.push(`국가: ${params.country.join(", ")}`);
  }
  if (params.exclude_brand?.length) {
    parts.push(`제외: ${params.exclude_brand.join(", ")}`);
  }
  if (params.collaboration_tier?.length) {
    parts.push(`협업 등급: ${params.collaboration_tier.join(", ")}`);
  }
  if (params.follower_min !== undefined || params.follower_max !== undefined) {
    const min = params.follower_min ?? 0;
    const max = params.follower_max ?? "∞";
    parts.push(`팔로워: ${min.toLocaleString()} ~ ${max.toLocaleString()}`);
  }

  return parts.join(" | ");
}

/**
 * Get description of search parameters for display
 */
export function getSearchDescription(params: SearchInfluencersParams): string {
  const parts: string[] = [];

  if (params.country?.length) {
    parts.push(`국가: ${params.country.join(", ")}`);
  }
  if (params.gender) {
    parts.push(`성별: ${params.gender}`);
  }
  if (params.age_range?.length) {
    parts.push(`연령대: ${params.age_range.join(", ")}`);
  }
  if (params.interests?.length) {
    parts.push(`관심사: ${params.interests.join(", ")}`);
  }
  if (params.collaboration_tier?.length) {
    parts.push(`협업 등급: ${params.collaboration_tier.join(", ")}`);
  }
  if (params.follower_min !== undefined || params.follower_max !== undefined) {
    const min = params.follower_min ?? 0;
    const max = params.follower_max ?? "∞";
    parts.push(`팔로워: ${min.toLocaleString()} ~ ${max.toLocaleString()}`);
  }
  if (params.k_interest) {
    parts.push("K-컬처 관심");
  }

  // Beauty params
  if (params.beauty_interest_areas?.length) {
    parts.push(`뷰티 관심: ${params.beauty_interest_areas.join(", ")}`);
  }
  if (params.skin_type?.length) {
    parts.push(`피부 타입: ${params.skin_type.join(", ")}`);
  }
  if (params.skin_concerns?.length) {
    parts.push(`피부 고민: ${params.skin_concerns.join(", ")}`);
  }
  if (params.personal_color) {
    parts.push(`퍼스널 컬러: ${params.personal_color}`);
  }
  if (params.brand_tier_segments) {
    parts.push(`브랜드 선호: ${params.brand_tier_segments}`);
  }

  if (parts.length === 0) {
    return "전체 인플루언서 검색";
  }

  return parts.join(" | ");
}
