import OpenAI from "openai";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load schema documentation
const SCHEMA_PATH = join(__dirname, "../../../docs/bigquery_schema.yaml");
let schemaDoc: string;

try {
  schemaDoc = readFileSync(SCHEMA_PATH, "utf-8");
} catch (error) {
  console.error("Warning: Could not load schema documentation:", error);
  schemaDoc = "";
}

// Load SQL templates
const TEMPLATES_DIR = join(__dirname, "../../../docs/queries");
const sqlTemplates: Record<string, string> = {};

try {
  sqlTemplates.hashtag_trends = readFileSync(join(TEMPLATES_DIR, "hashtag_trends.sql"), "utf-8");
  sqlTemplates.content_stats = readFileSync(join(TEMPLATES_DIR, "content_stats.sql"), "utf-8");
  sqlTemplates.trending_topics = readFileSync(join(TEMPLATES_DIR, "trending_topics.sql"), "utf-8");
} catch (error) {
  console.error("Warning: Could not load SQL templates:", error);
}

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `You are a BigQuery SQL expert. Generate SQL queries based on the user's natural language request and the provided SQL template.

IMPORTANT RULES:
1. ONLY generate SELECT queries (no INSERT, UPDATE, DELETE, etc.)
2. Always use backticks for table names: \`mmm-lab.dataset.table\`
3. Use UNNEST() for ARRAY columns
4. For hashtag analysis, ALWAYS use BOTH insta_media_mmm_v3 AND insta_reels_mmm_v3 with UNION ALL
5. When filtering by country/interests, use: 'VALUE' IN UNNEST(column)
6. Country codes use ISO 3166-1 Alpha-2 format (e.g., KR, US, VN, JP, TH, ID, PH, BR, etc.). Any valid country code can be used.
7. For date filtering, use: publish_date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL N DAY)
8. MAXIMUM scan period is 365 days (1 year). Always include: publish_date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 365 DAY)
9. LIMIT results to prevent excessive data (default: 100-500 rows)
10. Use LOWER() for case-insensitive hashtag comparison
11. When using insta_media_mmm_v3 or insta_reels_mmm_v3, ALWAYS filter by publish_date FIRST to reduce scan volume, then filter by user_id

SCHEMA DOCUMENTATION:
${schemaDoc}

OUTPUT FORMAT:
Return ONLY the SQL query, nothing else. No explanations, no markdown formatting.`;

export interface GeneratedQuery {
  sql: string;
  description: string;
}

/**
 * Generate a BigQuery SQL query from natural language
 */
export async function generateSQL(
  userQuery: string,
  queryType: "hashtag_trends" | "content_stats" | "trending_topics"
): Promise<GeneratedQuery> {
  console.error(`\n=== Generating SQL ===`);
  console.error(`User Query: ${userQuery}`);
  console.error(`Query Type: ${queryType}`);

  // Get SQL template for the query type
  const sqlTemplate = sqlTemplates[queryType] || "";

  // Add type-specific hints with template
  let typeHint = "";
  switch (queryType) {
    case "hashtag_trends":
      typeHint = `
Use the following SQL template as a reference:
${sqlTemplate}

Focus on hashtag frequency analysis. The output should include:
- hashtag (lowercase)
- usage_count
- Optional: avg_engagement (likes + comments)
Order by usage_count DESC.`;
      break;
    case "content_stats":
      typeHint = `
Use the following SQL template as a reference:
${sqlTemplate}

Focus on engagement statistics. The output should include:
- influencer_count
- total_posts
- avg_likes
- avg_comments
- avg_engagement
Group by relevant dimensions if needed.`;
      break;
    case "trending_topics":
      typeHint = `
Use the following SQL template as a reference:
${sqlTemplate}

Focus on identifying trending/rising hashtags. Consider:
- Compare recent period vs previous period
- Calculate growth rate
- Focus on hashtags with significant volume
The output should include hashtag, recent_count, previous_count, growth_rate.`;
      break;
  }

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Query Type: ${queryType}
${typeHint}

User Request: ${userQuery}

Generate the BigQuery SQL query:`,
      },
    ],
    temperature: 0.1,
    max_tokens: 2000,
  });

  const sql = response.choices[0]?.message?.content?.trim() || "";

  // Clean up the SQL (remove markdown code blocks if present)
  const cleanedSQL = sql
    .replace(/```sql\n?/gi, "")
    .replace(/```\n?/gi, "")
    .trim();

  console.error(`Generated SQL:\n${cleanedSQL}`);

  // Generate a brief description
  const descResponse = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content: "Generate a brief 1-2 sentence description of what this SQL query does. Be concise.",
      },
      { role: "user", content: `SQL: ${cleanedSQL}\n\nUser request: ${userQuery}` },
    ],
    temperature: 0.3,
    max_tokens: 100,
  });

  const description = descResponse.choices[0]?.message?.content?.trim() || "BigQuery analysis";

  return {
    sql: cleanedSQL,
    description,
  };
}

/**
 * Validate and fix common SQL issues
 */
export function sanitizeSQL(sql: string): string {
  let sanitized = sql;

  // Ensure table names have backticks (but don't double-wrap)
  // First, remove any existing backticks around table names to normalize
  sanitized = sanitized.replace(/`(mmm-lab\.(gpt_profile|sns)\.\w+)`/g, "$1");

  // Then add backticks properly
  const tablePattern = /mmm-lab\.(gpt_profile|sns)\.\w+/g;
  sanitized = sanitized.replace(tablePattern, (match) => `\`${match}\``);

  return sanitized;
}
