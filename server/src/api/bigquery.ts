import { BigQuery } from "@google-cloud/bigquery";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Initialize BigQuery client with service account
const bigquery = new BigQuery({
  keyFilename: join(__dirname, "../../../mmm-lab-8dae8dbd9a6f.json"),
  projectId: "mmm-lab",
});

export interface QueryResult {
  rows: Record<string, unknown>[];
  totalRows: number;
  schema: { name: string; type: string }[];
}

/**
 * Execute a BigQuery SQL query
 */
export async function executeQuery(sql: string): Promise<QueryResult> {
  console.error(`\n=== Executing BigQuery Query ===`);
  console.error(`SQL: ${sql.substring(0, 500)}...`);

  try {
    const [job] = await bigquery.createQueryJob({
      query: sql,
      location: "asia-northeast3",
    });

    console.error(`Job ${job.id} started.`);

    const [rows] = await job.getQueryResults();
    const [metadata] = await job.getMetadata();

    const schema =
      metadata.statistics?.query?.schema?.fields?.map(
        (f: { name: string; type: string }) => ({
          name: f.name,
          type: f.type,
        })
      ) || [];

    console.error(`Query completed. Rows returned: ${rows.length}`);

    return {
      rows: rows as Record<string, unknown>[],
      totalRows: rows.length,
      schema,
    };
  } catch (error) {
    console.error("BigQuery error:", error);
    throw error;
  }
}

/**
 * Convert query results to CSV format
 */
export function toCSV(result: QueryResult): string {
  if (result.rows.length === 0) {
    return "";
  }

  const headers = Object.keys(result.rows[0]);
  const csvRows: string[] = [];

  // Header row
  csvRows.push(headers.join(","));

  // Data rows
  for (const row of result.rows) {
    const values = headers.map((header) => {
      const value = row[header];
      if (value === null || value === undefined) {
        return "";
      }
      if (Array.isArray(value)) {
        // Handle array values
        return `"${value.join("; ")}"`;
      }
      if (typeof value === "string") {
        // Escape quotes and wrap in quotes if contains comma or quote
        if (value.includes(",") || value.includes('"') || value.includes("\n")) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }
      return String(value);
    });
    csvRows.push(values.join(","));
  }

  return csvRows.join("\n");
}

/**
 * Validate SQL query (basic safety check)
 */
export function validateQuery(sql: string): { valid: boolean; error?: string } {
  const upperSql = sql.toUpperCase().trim();

  // Only allow SELECT queries
  if (!upperSql.startsWith("SELECT") && !upperSql.startsWith("WITH")) {
    return { valid: false, error: "Only SELECT queries are allowed" };
  }

  // Block dangerous operations
  const blocked = [
    "INSERT",
    "UPDATE",
    "DELETE",
    "DROP",
    "CREATE",
    "ALTER",
    "TRUNCATE",
    "MERGE",
  ];
  for (const keyword of blocked) {
    if (upperSql.includes(keyword)) {
      return { valid: false, error: `${keyword} operation is not allowed` };
    }
  }

  return { valid: true };
}
