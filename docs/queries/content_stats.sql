-- Content Stats Analysis Query Template
-- Parameters: {{country}}, {{interests}}, {{days}}, {{gender}}, {{age_range}}, {{ethnic_category}}
--
-- Description: 인플루언서 그룹의 콘텐츠 참여 통계를 분석합니다.
-- Output columns: influencer_count, total_posts, avg_likes, avg_comments, avg_engagement
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
    AND age_range IN ({{#each age_range}}'{{this}}'{{#unless @last}}, {{/unless}}{{/each}})
    {{/if}}
    {{#if ethnic_category}}
    AND ethnic_category = '{{ethnic_category}}'
    {{/if}}
),

-- Feed posts stats (with publish_date filter for scan optimization)
feed_stats AS (
  SELECT
    m.user_id,
    m.like_count,
    m.comment_count
  FROM `mmm-lab.sns.insta_media_mmm_v3` m
  WHERE m.publish_date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL {{days}} DAY)
    AND m.publish_date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 365 DAY)  -- Max 1 year scan limit
    AND m.user_id IN (SELECT user_id FROM filtered_influencers)
),

-- Reels stats (with publish_date filter for scan optimization)
reels_stats AS (
  SELECT
    r.user_id,
    r.like_count,
    r.comment_count
  FROM `mmm-lab.sns.insta_reels_mmm_v3` r
  WHERE r.publish_date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL {{days}} DAY)
    AND r.publish_date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 365 DAY)  -- Max 1 year scan limit
    AND r.user_id IN (SELECT user_id FROM filtered_influencers)
),

-- Combine all posts
all_posts AS (
  SELECT * FROM feed_stats
  UNION ALL
  SELECT * FROM reels_stats
)

SELECT
  COUNT(DISTINCT user_id) AS influencer_count,
  COUNT(*) AS total_posts,
  ROUND(AVG(like_count), 2) AS avg_likes,
  ROUND(AVG(comment_count), 2) AS avg_comments,
  ROUND(AVG(like_count + comment_count), 2) AS avg_engagement
FROM all_posts
