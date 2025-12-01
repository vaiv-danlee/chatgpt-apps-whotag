-- Hashtag Trends Analysis Query Template
-- Parameters: {{country}}, {{interests}}, {{days}}, {{limit}}, {{gender}}, {{age_range}}, {{ethnic_category}}
--
-- Description: 특정 조건의 인플루언서들이 사용하는 해시태그 트렌드를 분석합니다.
-- Output columns: hashtag, usage_count, avg_engagement
--
-- Note: All demographic filters (gender, age_range, ethnic_category) are OPTIONAL.
--       If a parameter is not provided, that condition should be omitted from the WHERE clause.

WITH filtered_influencers AS (
  SELECT DISTINCT user_id
  FROM `mmm-lab.gpt_profile.insta_general_profiles`
  WHERE 1=1
    {{#if country}}
    AND '{{country}}' IN UNNEST(country)
    {{/if}}
    {{#if interests}}
    AND (
      {{#each interests}}
      '{{this}}' IN UNNEST(interests){{#unless @last}} OR {{/unless}}
      {{/each}}
    )
    {{/if}}
    {{#if gender}}
    AND gender = '{{gender}}'
    {{/if}}
    {{#if age_range}}
    AND age_range = '{{age_range}}'
    {{/if}}
    {{#if ethnic_category}}
    AND ethnic_category = '{{ethnic_category}}'
    {{/if}}
),

-- Feed posts (with publish_date filter for scan optimization)
feed_hashtags AS (
  SELECT
    LOWER(hashtag) AS hashtag,
    m.like_count + m.comment_count AS engagement
  FROM `mmm-lab.sns.insta_media_mmm_v3` m,
    UNNEST(m.hashtags) AS hashtag
  WHERE m.publish_date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL {{days}} DAY)
    AND m.publish_date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 365 DAY)  -- Max 1 year scan limit
    AND m.user_id IN (SELECT user_id FROM filtered_influencers)
),

-- Reels (with publish_date filter for scan optimization)
reels_hashtags AS (
  SELECT
    LOWER(hashtag) AS hashtag,
    r.like_count + r.comment_count AS engagement
  FROM `mmm-lab.sns.insta_reels_mmm_v3` r,
    UNNEST(r.hashtags) AS hashtag
  WHERE r.publish_date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL {{days}} DAY)
    AND r.publish_date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 365 DAY)  -- Max 1 year scan limit
    AND r.user_id IN (SELECT user_id FROM filtered_influencers)
),

-- Combine all hashtags
all_hashtags AS (
  SELECT * FROM feed_hashtags
  UNION ALL
  SELECT * FROM reels_hashtags
)

SELECT
  hashtag,
  COUNT(*) AS usage_count,
  ROUND(AVG(engagement), 2) AS avg_engagement
FROM all_hashtags
WHERE hashtag IS NOT NULL AND hashtag != ''
GROUP BY hashtag
ORDER BY usage_count DESC
LIMIT {{limit}}
