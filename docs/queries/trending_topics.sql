-- Trending Topics Analysis Query Template
-- Parameters: {{field}}, {{days}}, {{limit}}, {{gender}}, {{age_range}}, {{ethnic_category}}
--
-- Description: 특정 분야에서 급상승 중인 트렌딩 토픽(해시태그)을 찾습니다.
-- Compares recent period vs previous period to calculate growth rate.
-- Output columns: hashtag, recent_count, previous_count, growth_rate
--
-- Note: All demographic filters (gender, age_range, ethnic_category) are OPTIONAL.
--       If a parameter is not provided, that condition should be omitted from the WHERE clause.

WITH filtered_influencers AS (
  SELECT DISTINCT user_id
  FROM `mmm-lab.gpt_profile.insta_general_profiles`
  WHERE '{{field}}' IN UNNEST(interests)
    {{#if gender}}
    AND gender = '{{gender}}'
    {{/if}}
    {{#if age_range}}
    AND age_range IN ({{#each age_range}}'{{this}}'{{#unless @last}}, {{/unless}}{{/each}})
    {{/if}}
    {{#if ethnic_category}}
    AND ethnic_category = '{{ethnic_category}}'
    {{/if}}
),

-- Recent period hashtags (last N days)
recent_feed AS (
  SELECT LOWER(hashtag) AS hashtag
  FROM `mmm-lab.sns.insta_media_mmm_v3` m,
    UNNEST(m.hashtags) AS hashtag
  WHERE m.publish_date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL {{days}} DAY)
    AND m.publish_date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 365 DAY)  -- Max 1 year scan limit
    AND m.user_id IN (SELECT user_id FROM filtered_influencers)
),

recent_reels AS (
  SELECT LOWER(hashtag) AS hashtag
  FROM `mmm-lab.sns.insta_reels_mmm_v3` r,
    UNNEST(r.hashtags) AS hashtag
  WHERE r.publish_date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL {{days}} DAY)
    AND r.publish_date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 365 DAY)  -- Max 1 year scan limit
    AND r.user_id IN (SELECT user_id FROM filtered_influencers)
),

recent_hashtags AS (
  SELECT hashtag, COUNT(*) AS recent_count
  FROM (
    SELECT * FROM recent_feed
    UNION ALL
    SELECT * FROM recent_reels
  )
  WHERE hashtag IS NOT NULL AND hashtag != ''
  GROUP BY hashtag
),

-- Previous period hashtags (N days before the recent period)
previous_feed AS (
  SELECT LOWER(hashtag) AS hashtag
  FROM `mmm-lab.sns.insta_media_mmm_v3` m,
    UNNEST(m.hashtags) AS hashtag
  WHERE m.publish_date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL {{days_doubled}} DAY)
    AND m.publish_date < TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL {{days}} DAY)
    AND m.publish_date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 365 DAY)  -- Max 1 year scan limit
    AND m.user_id IN (SELECT user_id FROM filtered_influencers)
),

previous_reels AS (
  SELECT LOWER(hashtag) AS hashtag
  FROM `mmm-lab.sns.insta_reels_mmm_v3` r,
    UNNEST(r.hashtags) AS hashtag
  WHERE r.publish_date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL {{days_doubled}} DAY)
    AND r.publish_date < TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL {{days}} DAY)
    AND r.publish_date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 365 DAY)  -- Max 1 year scan limit
    AND r.user_id IN (SELECT user_id FROM filtered_influencers)
),

previous_hashtags AS (
  SELECT hashtag, COUNT(*) AS previous_count
  FROM (
    SELECT * FROM previous_feed
    UNION ALL
    SELECT * FROM previous_reels
  )
  WHERE hashtag IS NOT NULL AND hashtag != ''
  GROUP BY hashtag
)

SELECT
  COALESCE(r.hashtag, p.hashtag) AS hashtag,
  COALESCE(r.recent_count, 0) AS recent_count,
  COALESCE(p.previous_count, 0) AS previous_count,
  CASE
    WHEN COALESCE(p.previous_count, 0) = 0 THEN 999.99  -- New hashtag
    ELSE ROUND((COALESCE(r.recent_count, 0) - p.previous_count) * 100.0 / p.previous_count, 2)
  END AS growth_rate
FROM recent_hashtags r
FULL OUTER JOIN previous_hashtags p ON r.hashtag = p.hashtag
WHERE COALESCE(r.recent_count, 0) >= 10  -- Minimum threshold for relevance
ORDER BY growth_rate DESC, recent_count DESC
LIMIT {{limit}}
