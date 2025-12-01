import { executeQuery, toCSV, validateQuery } from "./bigquery.js";
import { uploadCSV } from "./gcs.js";
import { generateSQL, sanitizeSQL } from "./query-generator.js";

export interface AnalyticsResult {
  success: boolean;
  data: Record<string, unknown>[];
  totalRows: number;
  downloadUrl: string;
  query: string;
  description: string;
  error?: string;
}

// Common demographic filter parameters
export interface DemographicFilters {
  gender?: string;
  age_range?: string;
  ethnic_category?: string;
}

/**
 * Analyze hashtag trends for specific influencer groups
 */
export async function analyzeHashtagTrends(params: {
  country?: string;
  interests?: string[];
  days?: number;
  limit?: number;
} & DemographicFilters): Promise<AnalyticsResult> {
  const { country, interests = [], days = 30, limit = 100, gender, age_range, ethnic_category } = params;

  // Build natural language query
  let queryDesc = "해시태그 트렌드 분석";
  const conditions: string[] = [];

  if (country) {
    conditions.push(`${country} 국가`);
  }
  if (interests.length > 0) {
    conditions.push(`${interests.join(", ")} 분야`);
  }
  if (gender) {
    conditions.push(`성별: ${gender}`);
  }
  if (age_range) {
    conditions.push(`연령대: ${age_range}`);
  }
  if (ethnic_category) {
    conditions.push(`민족: ${ethnic_category}`);
  }
  conditions.push(`최근 ${days}일`);

  const naturalQuery = `${conditions.join(", ")} 인플루언서들의 해시태그 트렌드를 분석해줘. 상위 ${limit}개`;

  try {
    // Generate SQL
    const { sql, description } = await generateSQL(naturalQuery, "hashtag_trends");
    const sanitizedSQL = sanitizeSQL(sql);

    // Validate
    const validation = validateQuery(sanitizedSQL);
    if (!validation.valid) {
      return {
        success: false,
        data: [],
        totalRows: 0,
        downloadUrl: "",
        query: sanitizedSQL,
        description,
        error: validation.error,
      };
    }

    // Execute query
    const result = await executeQuery(sanitizedSQL);

    // Upload to GCS
    const csv = toCSV(result);
    const { publicUrl } = await uploadCSV(csv, "hashtag-trends");

    return {
      success: true,
      data: result.rows,
      totalRows: result.totalRows,
      downloadUrl: publicUrl,
      query: sanitizedSQL,
      description,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      data: [],
      totalRows: 0,
      downloadUrl: "",
      query: "",
      description: queryDesc,
      error: errorMessage,
    };
  }
}

/**
 * Analyze content statistics for influencer groups
 */
export async function analyzeContentStats(params: {
  country?: string;
  interests?: string[];
  days?: number;
} & DemographicFilters): Promise<AnalyticsResult> {
  const { country, interests = [], days = 30, gender, age_range, ethnic_category } = params;

  // Build natural language query
  const conditions: string[] = [];

  if (country) {
    conditions.push(`${country} 국가`);
  }
  if (interests.length > 0) {
    conditions.push(`${interests.join(", ")} 분야`);
  }
  if (gender) {
    conditions.push(`성별: ${gender}`);
  }
  if (age_range) {
    conditions.push(`연령대: ${age_range}`);
  }
  if (ethnic_category) {
    conditions.push(`민족: ${ethnic_category}`);
  }
  conditions.push(`최근 ${days}일`);

  const naturalQuery = `${conditions.join(", ")} 인플루언서들의 콘텐츠 통계를 분석해줘. 평균 좋아요, 댓글, 참여율 등`;

  try {
    const { sql, description } = await generateSQL(naturalQuery, "content_stats");
    const sanitizedSQL = sanitizeSQL(sql);

    const validation = validateQuery(sanitizedSQL);
    if (!validation.valid) {
      return {
        success: false,
        data: [],
        totalRows: 0,
        downloadUrl: "",
        query: sanitizedSQL,
        description,
        error: validation.error,
      };
    }

    const result = await executeQuery(sanitizedSQL);
    const csv = toCSV(result);
    const { publicUrl } = await uploadCSV(csv, "content-stats");

    return {
      success: true,
      data: result.rows,
      totalRows: result.totalRows,
      downloadUrl: publicUrl,
      query: sanitizedSQL,
      description,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      data: [],
      totalRows: 0,
      downloadUrl: "",
      query: "",
      description: "콘텐츠 통계 분석",
      error: errorMessage,
    };
  }
}

/**
 * Find trending topics in a specific field
 */
export async function findTrendingTopics(params: {
  field?: string;
  days?: number;
  limit?: number;
} & DemographicFilters): Promise<AnalyticsResult> {
  const { field = "Beauty", days = 30, limit = 50, gender, age_range, ethnic_category } = params;

  // Build natural language query
  const conditions: string[] = [`${field} 분야`];

  if (gender) {
    conditions.push(`성별: ${gender}`);
  }
  if (age_range) {
    conditions.push(`연령대: ${age_range}`);
  }
  if (ethnic_category) {
    conditions.push(`민족: ${ethnic_category}`);
  }

  const naturalQuery = `${conditions.join(", ")} 인플루언서들 중에서 최근 ${days}일간 가장 급상승한 해시태그 트렌드를 찾아줘. 성장률 기준으로 상위 ${limit}개`;

  try {
    const { sql, description } = await generateSQL(naturalQuery, "trending_topics");
    const sanitizedSQL = sanitizeSQL(sql);

    const validation = validateQuery(sanitizedSQL);
    if (!validation.valid) {
      return {
        success: false,
        data: [],
        totalRows: 0,
        downloadUrl: "",
        query: sanitizedSQL,
        description,
        error: validation.error,
      };
    }

    const result = await executeQuery(sanitizedSQL);
    const csv = toCSV(result);
    const { publicUrl } = await uploadCSV(csv, "trending-topics");

    return {
      success: true,
      data: result.rows,
      totalRows: result.totalRows,
      downloadUrl: publicUrl,
      query: sanitizedSQL,
      description,
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      success: false,
      data: [],
      totalRows: 0,
      downloadUrl: "",
      query: "",
      description: "트렌딩 토픽 분석",
      error: errorMessage,
    };
  }
}
