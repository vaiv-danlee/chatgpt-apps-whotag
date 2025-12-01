---
name: bigquery
description: Execute BigQuery SQL queries, analyze data warehouses, retrieve table schemas, and optimize query performance. Use when working with Google BigQuery databases, data analysis, SQL queries, or when the user mentions BigQuery, GCP data, SQL tables, or data warehouse operations.
---

# BigQuery Skill

Execute and manage Google BigQuery queries for data analysis and warehouse operations.

## When to Use This Skill

Use this skill when:
- User asks to query BigQuery databases
- Need to analyze data in a BigQuery data warehouse
- User mentions table schemas, datasets, or BigQuery-specific operations
- Working with GCP data infrastructure
- Optimizing SQL queries for BigQuery

## Quick Start

### Execute a SQL Query

Use the `run_query.py` script to execute queries:

```bash
python scripts/run_query.py "SELECT * FROM \`project.dataset.table\` LIMIT 10" \
  --project-id your-project-id \
  --format json
```

**Parameters:**
- Query string or path to `.sql` file
- `--project-id`: GCP project ID (optional if set in credentials)
- `--credentials`: Path to service account JSON (optional if using default auth)
- `--format`: Output format - `json`, `csv`, or `table` (default: json)
- `--max-results`: Maximum rows to return (default: 1000)

### Inspect Table Schemas

Use `inspect_schema.py` to retrieve table information:

```bash
# Get table schema
python scripts/inspect_schema.py schema dataset_name table_name \
  --project-id your-project-id \
  --format markdown

# List all tables in a dataset
python scripts/inspect_schema.py list dataset_name \
  --project-id your-project-id
```

## Authentication

BigQuery requires authentication. Three methods are available:

1. **Application Default Credentials** (easiest for development):
   ```bash
   gcloud auth application-default login
   ```

2. **Service Account** (recommended for production):
   ```bash
   export GOOGLE_APPLICATION_CREDENTIALS="/path/to/service-account.json"
   ```

3. **Explicit credentials** (pass `--credentials` flag to scripts)

For detailed setup instructions, see [references/setup.md](references/setup.md).

## Common Workflows

### Analyzing Data

When user requests data analysis:

1. Understand the question and identify required tables/datasets
2. Check if table schemas are known; if not, use `inspect_schema.py` to retrieve them
3. Construct SQL query using patterns from [references/sql_patterns.md](references/sql_patterns.md)
4. Execute query with `run_query.py`
5. Analyze and present results to user

### Exploring Unknown Data

When working with unfamiliar tables:

1. List tables in dataset: `inspect_schema.py list dataset_name`
2. Inspect schema: `inspect_schema.py schema dataset_name table_name --format markdown`
3. Run exploratory query: `SELECT * FROM table LIMIT 100`
4. Proceed with analysis

### Query Optimization

When optimizing queries:

1. Review cost optimization section in [references/sql_patterns.md](references/sql_patterns.md)
2. Use partitioned column filters early in WHERE clause
3. Select only needed columns (avoid SELECT *)
4. Use approximate aggregations when appropriate (APPROX_COUNT_DISTINCT)
5. Test with LIMIT before running on full dataset

## Writing SQL Queries

### Basic Pattern

```sql
SELECT 
  column1,
  column2,
  aggregation_function(column3) as metric
FROM `project_id.dataset_id.table_id`
WHERE 
  date_column >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
  AND filter_condition = 'value'
GROUP BY column1, column2
ORDER BY metric DESC
LIMIT 1000
```

### Important Notes

- Always use backticks for fully qualified table names: \`project.dataset.table\`
- Filter on partitioned columns (_PARTITIONDATE or _PARTITIONTIME) to reduce costs
- Use DATE and TIMESTAMP functions for date operations
- BigQuery SQL is similar to standard SQL but has unique functions

For comprehensive SQL patterns and examples, read [references/sql_patterns.md](references/sql_patterns.md).

## Reference Documents

Load these references as needed:

- **[references/sql_patterns.md](references/sql_patterns.md)** - Common SQL patterns, window functions, date operations, array/struct handling, and cost optimization strategies. Read this when constructing complex queries or optimizing performance.

- **[references/setup.md](references/setup.md)** - Authentication setup, IAM roles, environment variables, and troubleshooting. Read this when encountering authentication issues or setting up BigQuery access.

## Python Integration

When writing custom Python code to interact with BigQuery:

```python
from google.cloud import bigquery

# Initialize client
client = bigquery.Client(project='your-project-id')

# Execute query
query = """
    SELECT column1, COUNT(*) as count
    FROM `project.dataset.table`
    GROUP BY column1
"""
query_job = client.query(query)
results = query_job.result()

# Process results
for row in results:
    print(f"{row.column1}: {row.count}")
```

Install required package:
```bash
pip install google-cloud-bigquery --break-system-packages
```

## Best Practices

1. **Start small** - Use LIMIT when exploring data
2. **Filter early** - Apply WHERE clauses on partitioned columns first
3. **Be specific** - Select only columns you need
4. **Check costs** - Use dry run to estimate query costs before execution
5. **Document queries** - Add comments to complex SQL for future reference
6. **Handle errors** - Queries may fail due to permissions, syntax, or resource limits

## Error Handling

Common errors and solutions:

- **Authentication error**: Ensure credentials are set up correctly (see references/setup.md)
- **Permission denied**: Check IAM roles (need at least `bigquery.user` role)
- **Table not found**: Verify project/dataset/table names and permissions
- **Query timeout**: Reduce data scanned by filtering on partitions or adding WHERE clauses
- **Syntax error**: Check BigQuery SQL dialect differences from standard SQL

## User Data Customization

Users can customize this skill by:

1. Adding company-specific schemas to a new file `references/company_schemas.md`
2. Including common query templates relevant to their datasets
3. Adding project-specific configuration (project IDs, dataset names) to setup documentation
4. Creating domain-specific reference files (e.g., `references/finance.md` for financial data queries)

The skill is designed to be extended with company or domain-specific knowledge while keeping core functionality intact.
