-- Search Influencers Query Template (BigQuery)
-- Parameters:
--   General: country[], gender, age_range[], interests[], collaboration_tier[],
--            follower_min, follower_max, k_interest, limit
--   Beauty:  beauty_interest_areas[], beauty_content_types[], skin_type[],
--            skin_concerns[], personal_color, brand_tier_segments
--
-- Description: 인플루언서를 다양한 조건으로 검색합니다. 뷰티 파라미터가 제공되면 뷰티 테이블도 JOIN합니다.
--
-- Data Sources:
--   - mmm-lab.gpt_profile.insta_general_profiles (필수)
--   - mmm-lab.gpt_profile.insta_beauty_profiles (뷰티 파라미터 사용 시)
--   - mmm-lab.sns.insta_profile_mmm_v3 (팔로워 수 조회용)

WITH base_profiles AS (
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
    {{#if has_beauty_params}}
    -- Beauty profile columns (only when beauty params provided)
    , b.beauty_interest_areas
    , b.beauty_brands
    , b.beauty_content_types
    , b.beauty_products
    , b.makeup_interests
    , b.makeup_points
    , b.makeup_items
    , b.makeup_color_preferences
    , b.skincare_items
    , b.skin_concerns
    , b.skin_type
    , b.skincare_ingredients
    , b.hair_type
    , b.hair_concerns
    , b.skin_tone
    , b.personal_color
    , b.personal_color_detailed
    , b.aesthetic_keywords
    , b.brand_tier_segments
    , b.brand_positioning_segments
    , b.beauty_creator_desc
    {{/if}}
  FROM `mmm-lab.gpt_profile.insta_general_profiles` g
  {{#if has_beauty_params}}
  INNER JOIN `mmm-lab.gpt_profile.insta_beauty_profiles` b ON g.user_id = b.user_id
  {{/if}}
  WHERE 1=1
    -- Country filter (ARRAY)
    {{#if country}}
    AND (
      {{#each country}}
      '{{this}}' IN UNNEST(g.country){{#unless @last}} OR {{/unless}}
      {{/each}}
    )
    {{/if}}

    -- Gender filter
    {{#if gender}}
    AND g.gender = '{{gender}}'
    {{/if}}

    -- Age range filter (ARRAY)
    {{#if age_range}}
    AND g.age_range IN ({{#each age_range}}'{{this}}'{{#unless @last}}, {{/unless}}{{/each}})
    {{/if}}

    -- Interests filter (ARRAY - OR logic)
    {{#if interests}}
    AND (
      {{#each interests}}
      '{{this}}' IN UNNEST(g.interests){{#unless @last}} OR {{/unless}}
      {{/each}}
    )
    {{/if}}

    -- Collaboration tier filter (ARRAY)
    {{#if collaboration_tier}}
    AND g.collaboration_tier IN ({{#each collaboration_tier}}'{{this}}'{{#unless @last}}, {{/unless}}{{/each}})
    {{/if}}

    -- K-interest filter
    {{#if k_interest}}
    AND g.k_interest = TRUE
    {{/if}}

    -- Beauty filters (only when has_beauty_params is true)
    {{#if beauty_interest_areas}}
    AND (
      {{#each beauty_interest_areas}}
      '{{this}}' IN UNNEST(b.beauty_interest_areas){{#unless @last}} OR {{/unless}}
      {{/each}}
    )
    {{/if}}

    {{#if beauty_content_types}}
    AND (
      {{#each beauty_content_types}}
      '{{this}}' IN UNNEST(b.beauty_content_types){{#unless @last}} OR {{/unless}}
      {{/each}}
    )
    {{/if}}

    {{#if skin_type}}
    AND (
      {{#each skin_type}}
      '{{this}}' IN UNNEST(b.skin_type){{#unless @last}} OR {{/unless}}
      {{/each}}
    )
    {{/if}}

    {{#if skin_concerns}}
    AND (
      {{#each skin_concerns}}
      '{{this}}' IN UNNEST(b.skin_concerns){{#unless @last}} OR {{/unless}}
      {{/each}}
    )
    {{/if}}

    {{#if personal_color}}
    AND b.personal_color = '{{personal_color}}'
    {{/if}}

    {{#if brand_tier_segments}}
    AND b.brand_tier_segments = '{{brand_tier_segments}}'
    {{/if}}
),

-- Join with profile data to get follower counts
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
  INNER JOIN `mmm-lab.sns.insta_profile_mmm_v3` p ON bp.user_id = p.user_id
  WHERE 1=1
    {{#if follower_min}}
    AND p.followed_by >= {{follower_min}}
    {{/if}}
    {{#if follower_max}}
    AND p.followed_by <= {{follower_max}}
    {{/if}}
)

SELECT *
FROM profiles_with_followers
ORDER BY follower_count DESC
LIMIT {{limit}}
