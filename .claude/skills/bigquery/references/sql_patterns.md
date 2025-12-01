# BigQuery SQL Reference

Common SQL patterns and best practices for BigQuery.

## Table of Contents

1. [Basic Queries](#basic-queries)
2. [Aggregations and GROUP BY](#aggregations-and-group-by)
3. [Window Functions](#window-functions)
4. [Date and Time Functions](#date-and-time-functions)
5. [String Functions](#string-functions)
6. [Array and Struct Operations](#array-and-struct-operations)
7. [Partitioned Tables](#partitioned-tables)
8. [Cost Optimization](#cost-optimization)

## Basic Queries

### SELECT with WHERE

```sql
SELECT 
  column1,
  column2,
  column3
FROM `project.dataset.table`
WHERE condition = 'value'
  AND date >= '2024-01-01'
LIMIT 1000
```

### JOIN Operations

```sql
-- INNER JOIN
SELECT 
  a.id,
  a.name,
  b.value
FROM `project.dataset.table_a` AS a
INNER JOIN `project.dataset.table_b` AS b
  ON a.id = b.id

-- LEFT JOIN
SELECT 
  a.id,
  a.name,
  b.value
FROM `project.dataset.table_a` AS a
LEFT JOIN `project.dataset.table_b` AS b
  ON a.id = b.id
```

## Aggregations and GROUP BY

### COUNT, SUM, AVG

```sql
SELECT 
  category,
  COUNT(*) as total_rows,
  COUNT(DISTINCT user_id) as unique_users,
  SUM(amount) as total_amount,
  AVG(amount) as avg_amount
FROM `project.dataset.transactions`
GROUP BY category
ORDER BY total_amount DESC
```

### HAVING Clause

```sql
SELECT 
  user_id,
  COUNT(*) as purchase_count,
  SUM(amount) as total_spent
FROM `project.dataset.purchases`
GROUP BY user_id
HAVING COUNT(*) >= 5
ORDER BY total_spent DESC
```

## Window Functions

### ROW_NUMBER and RANK

```sql
SELECT 
  user_id,
  date,
  amount,
  ROW_NUMBER() OVER (PARTITION BY user_id ORDER BY date DESC) as row_num,
  RANK() OVER (PARTITION BY user_id ORDER BY amount DESC) as amount_rank
FROM `project.dataset.purchases`
```

### Running Totals

```sql
SELECT 
  date,
  amount,
  SUM(amount) OVER (ORDER BY date) as running_total
FROM `project.dataset.daily_sales`
ORDER BY date
```

### LAG and LEAD

```sql
SELECT 
  date,
  revenue,
  LAG(revenue, 1) OVER (ORDER BY date) as previous_day_revenue,
  LEAD(revenue, 1) OVER (ORDER BY date) as next_day_revenue
FROM `project.dataset.daily_revenue`
```

## Date and Time Functions

### Current Date/Time

```sql
SELECT 
  CURRENT_DATE() as today,
  CURRENT_TIMESTAMP() as now,
  CURRENT_DATETIME() as datetime_now
```

### Date Arithmetic

```sql
SELECT 
  DATE_SUB(CURRENT_DATE(), INTERVAL 7 DAY) as last_week,
  DATE_ADD(CURRENT_DATE(), INTERVAL 1 MONTH) as next_month,
  DATE_DIFF(CURRENT_DATE(), DATE '2024-01-01', DAY) as days_since_jan
```

### Date Extraction

```sql
SELECT 
  date,
  EXTRACT(YEAR FROM date) as year,
  EXTRACT(MONTH FROM date) as month,
  EXTRACT(DAY FROM date) as day,
  EXTRACT(DAYOFWEEK FROM date) as day_of_week,
  FORMAT_DATE('%Y-%m', date) as year_month
FROM `project.dataset.events`
```

### Date Truncation

```sql
SELECT 
  DATE_TRUNC(timestamp, WEEK) as week,
  COUNT(*) as events
FROM `project.dataset.events`
GROUP BY week
ORDER BY week
```

## String Functions

### String Operations

```sql
SELECT 
  CONCAT(first_name, ' ', last_name) as full_name,
  UPPER(email) as email_upper,
  LOWER(email) as email_lower,
  LENGTH(description) as desc_length,
  SUBSTR(phone, 1, 3) as area_code
FROM `project.dataset.users`
```

### Pattern Matching

```sql
SELECT *
FROM `project.dataset.logs`
WHERE 
  message LIKE '%error%'
  OR REGEXP_CONTAINS(message, r'(?i)warning|alert')
```

### String Splitting

```sql
SELECT 
  email,
  SPLIT(email, '@')[OFFSET(0)] as username,
  SPLIT(email, '@')[OFFSET(1)] as domain
FROM `project.dataset.users`
```

## Array and Struct Operations

### UNNEST Arrays

```sql
SELECT 
  user_id,
  product_id
FROM `project.dataset.purchases`,
UNNEST(products) as product_id
```

### Array Aggregation

```sql
SELECT 
  user_id,
  ARRAY_AGG(product_id) as purchased_products,
  ARRAY_AGG(DISTINCT category) as categories
FROM `project.dataset.purchases`
GROUP BY user_id
```

### Struct Access

```sql
SELECT 
  user_id,
  address.city,
  address.country,
  address.postal_code
FROM `project.dataset.users`
WHERE address.country = 'US'
```

## Partitioned Tables

### Query Partitioned Table

```sql
-- Query specific partition (cost-effective)
SELECT *
FROM `project.dataset.events`
WHERE _PARTITIONTIME = TIMESTAMP('2024-01-01')

-- Query date range
SELECT *
FROM `project.dataset.events`
WHERE _PARTITIONDATE BETWEEN DATE('2024-01-01') AND DATE('2024-01-31')
```

### Create Partitioned Table

```sql
CREATE TABLE `project.dataset.events_partitioned`
PARTITION BY DATE(timestamp)
AS
SELECT *
FROM `project.dataset.events`
```

## Cost Optimization

### Best Practices

1. **Use SELECT specific columns** instead of SELECT *
2. **Filter early** with WHERE clauses on partitioned columns
3. **Preview data** with LIMIT before running full queries
4. **Use approximate aggregations** when exact counts aren't needed
5. **Avoid SELECT DISTINCT** on large datasets when possible
6. **Use clustering** for frequently filtered columns

### Example: Cost-Effective Query

```sql
-- BAD: Scans entire table
SELECT *
FROM `project.dataset.large_table`
WHERE status = 'active'

-- GOOD: Filters by partition first
SELECT 
  id,
  name,
  status
FROM `project.dataset.large_table`
WHERE 
  _PARTITIONDATE >= DATE_SUB(CURRENT_DATE(), INTERVAL 30 DAY)
  AND status = 'active'
LIMIT 10000
```

### Dry Run to Check Costs

Use `--dry_run` flag to estimate bytes scanned:

```bash
bq query --dry_run 'SELECT * FROM `project.dataset.table`'
```

### Approximate COUNT DISTINCT

```sql
-- Exact (expensive)
SELECT COUNT(DISTINCT user_id)
FROM `project.dataset.events`

-- Approximate (cheaper, 98%+ accuracy)
SELECT APPROX_COUNT_DISTINCT(user_id)
FROM `project.dataset.events`
```
