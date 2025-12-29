# WHOTAG Apps 파생 도구 상세 명세서

**문서 버전**: 1.1
**작성일**: 2024-12 (Updated: 2024-12-22)
**목적**: WHOTAG Apps에서 활용 가능한 파생 도구의 상세 정의 및 활용 시나리오

> **Note**: 이 문서는 구현 완료 후 업데이트되었습니다. 실제 구현된 도구는 25개입니다.

---

## 1. 데이터 자산 개요

### 1.1 테이블 구조

| 테이블 | 데이터셋 | 규모 | 핵심 용도 |
|--------|----------|------|-----------|
| `insta_general_profiles` | gpt_profile | ~500K | 인플루언서 필터링 (인구통계, 관심사, 협업이력) |
| `insta_beauty_profiles` | gpt_profile | ~500K | 뷰티 특화 프로필 (피부/메이크업/헤어 분석, 브랜드 선호) |
| `insta_user_links_v3` | sns | - | 외부 링크 정보 (SNS, 쇼핑, 연락처) |
| `insta_media_mmm_v3` | sns | ~100M+ | 피드 게시물 (해시태그, 참여도) |
| `insta_reels_mmm_v3` | sns | ~50M+ | 릴스 (해시태그, 조회수) |
| `insta_profile_mmm_v3` | sns | ~10M+ | 팔로워 수, 계정 정보 |

**테이블 관계**
- `insta_general_profiles` ↔ `insta_beauty_profiles`: user_id로 1:1 JOIN
- `insta_general_profiles` → `insta_user_links_v3`: user_id로 1:N JOIN (여러 링크)
- `insta_general_profiles` → `insta_media_mmm_v3` / `insta_reels_mmm_v3`: user_id로 1:N JOIN
- `insta_general_profiles` → `insta_profile_mmm_v3`: user_id로 1:1 JOIN

### 1.3 외부 링크 필드 (`insta_user_links_v3`)

인플루언서의 멀티 플랫폼 활동 및 연락처 정보를 담고 있습니다.

#### 링크 타입 (`type`)

| 타입 | 설명 |
|------|------|
| `contact` | 연락처 (이메일, 블로그, 카카오톡) |
| `shopping` | 쇼핑/제휴 링크 (아마존, 쿠팡, 세포라 등) |
| `sns` | 다른 SNS 플랫폼 (유튜브, 틱톡, 트위터 등) |

#### 채널 (`channel`)

| 카테고리 | 채널 옵션 |
|----------|----------|
| **SNS** | facebook, instagram, linkedin, snapchat, telegram, tiktok, twitter, whatsapp, youtube |
| **Shopping** | amazon, coupang, rakuten, sephora, shopee, shopltk |
| **Contact** | blog, email, kakaotalk |

### 1.2 활용 가능한 Enum 필드 (필터링 키)

#### 인구통계학적 정보

| 필드명 | 옵션 |
|--------|------|
| `gender` | Male, Female, Unknown |
| `age_range` | 0~4, 5~9, 10~14, 15~19, 20~24, 25~29, 30~34, 35~39, 40~44, 45~49, 50~54, 55~59, 60~64, 65~69, 70+, Unknown |
| `ethnic_category` | Caucasian, African, Asian, East Asian, South Asian, Southeast Asian, Hispanic/Latino, Middle Eastern/North African (MENA), Pacific Islander, Indigenous Peoples, Mixed Race, Unknown |
| `marital_status` | Single, In Relationship, Married, Unknown |
| `lifestage` | Single, Married Without Child, Married With Infant/Toddler, Married With Young Children, Married With Teenager, Married With Child Over 18, Single With Child, Others, Unknown |
| `occupation` | Full-time Content Creator/Influencer, Digital Creative Professional, Online Educator/Coach/Consultant, Owner Of A Company With 20+ Employees, Owner Of A Small Business, Self Employed/Freelancer, Executive/Senior Manager, Company Employee, Sales/Marketing Professional, Healthcare Professional, Education Professional, Skilled Trades/Craftsperson, Performing Artist/Entertainer, Athlete/Fitness Professional, Student, Homemaker, Retired, Job Seeking/Between Jobs, Multiple Occupations, Others |

#### 비즈니스 관련

| 필드명 | 옵션 |
|--------|------|
| `account_type` | Personal/Individual, Celebrity/Influencer/Creator, Business/Brand Account, Product/Service Account, Fan Account, Others |
| `collaboration_tier` | Ready - Premium, Ready - Professional, Potential - High, Potential - Basic, Personal Only |

#### 관심사

| 필드명 | 옵션 |
|--------|------|
| `interests` | Fashion & Style, Accessories & Jewelry, Beauty, Hair Care, Food Culture, Meals, Beverages, Alcoholic Beverages, Snacks & Desserts, Travel & Leisure, Relationships & Emotions, Fitness, Ball Sports, Outdoor Sports, Indoor Sports, Sports Events, Wellness, Healthcare, Child Care & Parenting, Pets, Household Management, Interior & Decor, Photography, Visual Arts, Performing Arts, Music, Literature & Writing, Media & Entertainment, New Media, Crafts, Fan Culture, Games, Personal Development, Academic Studies, Student Life, Business & Marketing, Startups & Small Business, Personal Finance, Automotive, Technology & Innovation, Consumer Electronics, Values & Human Rights, Environment & Sustainability, Community Engagement, Religion & Politics, Shopping & Deals, Other |

#### 뷰티 특화 필드

| 필드명 | 옵션 |
|--------|------|
| `beauty_interest_areas` | Makeup, Skincare, K Beauty, Clean Beauty, Vegan Beauty, Anti Aging, Sun Care, Hair Care, Nail Care, Fragrance |
| `beauty_content_types` | Makeup Tutorial, Product Review, Skincare Routine, GRWM, Unboxing, Before After, Haul, Look Recreation |
| `makeup_interests` | Natural Makeup, Glam Look, Korean Beauty, Vintage Style, Bold Colors, Minimal Makeup, Editorial Style, Everyday Look |
| `makeup_points` | Glow, Matte, Natural, Dewy, Bold, Subtle, Contour, Highlight |
| `makeup_items` | Foundation, Concealer, Lipstick, Lip Tint, Eyeshadow, Mascara, Blush, Highlighter, Bronzer, Eyeliner |
| `makeup_color_preferences` | Cool Tones, Warm Tones, Neutral Tones, Brown Family, Pink Family, Red Family, Orange Family, Coral Pinks, Berry Reds, Mauve Purples, Terracotta Browns, Bold Colors, Subtle Colors |
| `skincare_items` | Cleanser, Toner, Serum, Moisturizer, Sunscreen, Face Mask, Exfoliator, Eye Cream, Face Oil, Essence |
| `skin_concerns` | Acne, Anti Aging, Hydration, Brightening, Sensitive Skin, Pore Care, Dark Circles, Pigmentation, Oil Control |
| `skin_type` | Oily, Dry, Combination, Normal, Sensitive |
| `skincare_ingredients` | Vitamin C, Retinol, Hyaluronic Acid, Niacinamide, AHA, BHA, Peptides, Ceramides, Glycolic Acid, Salicylic Acid |
| `hair_type` | Straight Fine, Straight Medium, Straight Thick, Wavy Fine, Wavy Medium, Wavy Thick, Curly Fine, Curly Medium, Curly Thick, Coily Fine, Coily Medium, Coily Thick, Unknown |
| `skin_tone` | very fair, fair, light, medium, tan, deep, Unknown |
| `personal_color` | Warm, Cool, Neutral, Unknown |
| `personal_color_detailed` | Bright Spring, True Spring, Light Spring, Light Summer, True Summer, Soft Summer, Soft Autumn, True Autumn, Deep Autumn, Deep Winter, True Winter, Bright Winter, Unknown |
| `brand_tier_segments` | Ultra Luxury, Luxury, Premium, Drugstore, Budget, Mixed, Unknown |
| `brand_positioning_segments` | Clean Beauty, Vegan, Cruelty Free, Innovation, Traditional, Trendy, Science Based, Natural Ingredients, Luxury Heritage, Indie Brands, Unknown |

---

## 2. 파생 도구 상세 정의

### 2.1 인플루언서 검색 도구

#### `search_influencers` (whotag.ai API)

인플루언서를 자연어 쿼리로 검색하는 도구 (whotag.ai API 기반)

> **Note**: 이 도구는 whotag.ai API를 사용합니다. 구조화된 필터 검색은 `search_influencers_bigquery`를 사용하세요.

**입력 파라미터**

| 파라미터 | 타입 | 설명 | 예시 |
|----------|------|------|------|
| `country` | Array[String] | 거주 국가 (ISO 3166-1 Alpha-2) | ["KR", "JP", "VN"] |
| `gender` | String | 성별 | "Female" |
| `age_range` | Array[String] | 연령대 | ["20~24", "25~29", "30~34"] |
| `interests` | Array[String] | 관심사 | ["Beauty", "Fashion & Style"] |
| `collaboration_tier` | Array[String] | 협업 등급 | ["Ready - Premium", "Ready - Professional"] |
| `follower_min` | Integer | 최소 팔로워 | 10000 |
| `follower_max` | Integer | 최대 팔로워 | 100000 |
| `k_interest` | Boolean | K-컬처 관심 여부 | true |
| `limit` | Integer | 결과 수 제한 | 50 |

**출력**

| 필드 | 설명 | 예시 |
|------|------|------|
| `user_id` | 인플루언서 고유 ID | `"12345678"` |
| `username` | 인스타그램 사용자명 | `"beauty_creator_kr"` |
| `follower_count` | 팔로워 수 | `85000` |
| `collaboration_tier` | 협업 등급 | `"Ready - Premium"` |
| `interests` | 관심사 목록 | `["Beauty", "Fashion & Style"]` |

---

#### `search_influencers_bigquery` (BigQuery 직접 검색)

일반 + 뷰티 통합 인플루언서 검색 도구 (BigQuery 기반)

> **Note**: 기존 `search_beauty_influencers`가 이 도구로 통합되었습니다. 뷰티 파라미터가 제공되면 자동으로 뷰티 프로필 데이터가 포함됩니다.

**입력 파라미터 (공통)**

| 파라미터 | 타입 | 설명 | 예시 |
|----------|------|------|------|
| `country` | Array[String] | 거주 국가 (ISO 3166-1 Alpha-2) | ["KR", "JP", "VN"] |
| `gender` | String | 성별 | "Female" |
| `age_range` | Array[String] | 연령대 | ["20~24", "25~29"] |
| `interests` | Array[String] | 관심사 | ["Beauty", "Fashion & Style"] |
| `collaboration_tier` | Array[String] | 협업 등급 | ["Ready - Premium"] |
| `follower_min` | Integer | 최소 팔로워 | 10000 |
| `follower_max` | Integer | 최대 팔로워 | 100000 |
| `k_interest` | Boolean | K-컬처 관심 여부 | true |
| `limit` | Integer | 결과 수 제한 | 50 |

**입력 파라미터 (뷰티 특화)** - 제공 시 뷰티 프로필 JOIN

| 파라미터 | 타입 | 설명 | 예시 |
|----------|------|------|------|
| `beauty_interest_areas` | Array[String] | 뷰티 관심 분야 | ["Skincare", "K Beauty"] |
| `beauty_content_types` | Array[String] | 콘텐츠 유형 | ["Product Review", "Skincare Routine"] |
| `skin_type` | Array[String] | 피부 타입 | ["Oily", "Combination"] |
| `skin_concerns` | Array[String] | 피부 고민 | ["Acne", "Pore Care"] |
| `personal_color` | String | 퍼스널 컬러 | "Warm" |
| `brand_tier_segments` | String | 브랜드 가격대 선호 | "Premium" |

**출력**

| 필드 | 설명 | 예시 |
|------|------|------|
| `user_id` | 인플루언서 고유 ID | `"12345678"` |
| `username` | 인스타그램 사용자명 | `"skincare_lover"` |
| `follower_count` | 팔로워 수 | `120000` |
| `collaboration_tier` | 협업 등급 | `"Ready - Professional"` |
| `interests` | 관심사 목록 | `["Beauty", "Skincare"]` |
| `skin_type` | 피부 타입 (뷰티 파라미터 시) | `"Combination"` |
| `skin_concerns` | 피부 고민 (뷰티 파라미터 시) | `["Acne", "Pore Care"]` |
| `beauty_content_types` | 뷰티 콘텐츠 유형 (뷰티 파라미터 시) | `["Product Review", "GRWM"]` |

---

#### `search_by_brand_collaboration`

특정 브랜드와 협업 이력이 있는 인플루언서 검색

**입력 파라미터**

| 파라미터 | 타입 | 설명 | 예시 |
|----------|------|------|------|
| `brand_name` | String | 브랜드명 | "Innisfree" |
| `country` | Array[String] | 거주 국가 | ["KR", "JP"] |
| `exclude_brand` | Array[String] | 제외할 브랜드 | ["Competitor Brand"] |

**출력**

| 필드 | 설명 | 예시 |
|------|------|------|
| `user_id` | 인플루언서 고유 ID | `"12345678"` |
| `username` | 인스타그램 사용자명 | `"innisfree_lover"` |
| `follower_count` | 팔로워 수 | `95000` |
| `collaboration_count` | 해당 브랜드 협업 횟수 | `5` |
| `last_collaboration_date` | 마지막 협업 날짜 | `"2024-11-15"` |
| `collaboration_tier` | 협업 등급 | `"Ready - Premium"` |

---

### 2.2 트렌드 분석 도구

#### `analyze_hashtag_trends_bigquery`

특정 조건의 인플루언서 그룹에서 인기 해시태그 분석 (BigQuery 직접 생성 방식)

**입력 파라미터**

| 파라미터 | 타입 | 설명 | 예시 |
|----------|------|------|------|
| `country` | Array[String] | 국가 필터 | ["VN"] |
| `interests` | Array[String] | 관심사 필터 | ["Beauty"] |
| `period_days` | Integer | 분석 기간 (일) | 30 |
| `content_type` | String | 콘텐츠 유형 | "all" / "media" / "reels" |
| `limit` | Integer | 결과 수 | 50 |

**출력**

| 필드 | 설명 | 예시 |
|------|------|------|
| `hashtag` | 해시태그명 | `"#skincareroutine"` |
| `usage_count` | 사용 횟수 | `12340` |
| `unique_users` | 사용자 수 | `3450` |
| `growth_rate` | 전기 대비 성장률 | `1.45` (145%) |

---

#### `detect_emerging_hashtags`

급성장 중인 해시태그 탐지

**입력 파라미터**

| 파라미터 | 타입 | 설명 | 예시 |
|----------|------|------|------|
| `country` | Array[String] | 국가 필터 | ["KR", "JP"] |
| `interests` | Array[String] | 관심사 필터 | ["Beauty", "Skincare"] |
| `compare_period` | String | 비교 기간 | "2weeks" / "1month" / "3months" |
| `min_growth_rate` | Float | 최소 성장률 | 1.5 (150%) |

**출력**

| 필드 | 설명 | 예시 |
|------|------|------|
| `hashtag` | 해시태그명 | `"#cleanbeauty"` |
| `previous_count` | 이전 기간 사용량 | `2500` |
| `current_count` | 현재 기간 사용량 | `8500` |
| `growth_rate` | 성장률 | `3.4` (340%) |
| `top_countries` | 주요 사용 국가 | `["US", "KR"]` |

---

#### `compare_regional_hashtags`

지역별 해시태그 비교 분석

**입력 파라미터**

| 파라미터 | 타입 | 설명 | 예시 |
|----------|------|------|------|
| `countries` | Array[String] | 비교할 국가들 | ["KR", "JP", "US"] |
| `interests` | Array[String] | 관심사 필터 | ["Beauty"] |
| `period_days` | Integer | 분석 기간 | 30 |

**출력**

| 필드 | 설명 | 예시 |
|------|------|------|
| `country` | 국가 코드 | `"KR"` |
| `top_hashtags` | TOP 해시태그 목록 | `["#glasskin", "#skincare"]` |
| `common_hashtags` | 국가간 공통 해시태그 | `["#beauty", "#makeup"]` |
| `unique_hashtags` | 해당 국가 특화 해시태그 | `["#퍼스널컬러", "#kbeauty"]` |
| `usage_count` | 해시태그별 사용 횟수 | `{"#glasskin": 5600}` |

---

#### `analyze_beauty_ingredient_trends`

뷰티 성분 트렌드 분석 (뷰티 특화)

**입력 파라미터**

| 파라미터 | 타입 | 설명 | 예시 |
|----------|------|------|------|
| `country` | Array[String] | 국가 필터 | ["KR"] |
| `period_days` | Integer | 분석 기간 | 90 |
| `category` | String | 카테고리 | "skincare" / "makeup" / "haircare" |
| `limit` | Integer | 결과 수 | 30 |

**출력**

| 필드 | 설명 | 예시 |
|------|------|------|
| `ingredient` | 성분명 (Vitamin C, Retinol 등) 또는 아이템명 | `"Niacinamide"` |
| `current_count` | 현재 기간 언급 인플루언서 수 | `1250` |
| `previous_count` | 이전 기간 언급 인플루언서 수 | `450` |
| `growth_rate` | 성장률 | `1.78` (178%) |
| `related_products` | 관련 제품 | `["Serum", "Toner"]` |
| `related_concerns` | 관련 피부/뷰티 고민 | `["Brightening", "Pore Care"]` |

---

### 2.3 브랜드/스폰서십 분석 도구

#### `analyze_brand_mentions`

브랜드 언급량 및 감성 분석

**입력 파라미터**

| 파라미터 | 타입 | 설명 | 예시 |
|----------|------|------|------|
| `brand_names` | Array[String] | 분석할 브랜드 | ["Estee Lauder", "Lancome"] |
| `country` | Array[String] | 국가 필터 | ["KR", "JP"] |
| `period_days` | Integer | 분석 기간 | 90 |

**출력**

| 필드 | 설명 | 예시 |
|------|------|------|
| `brand` | 브랜드명 | `"Estee Lauder"` |
| `mention_count` | 언급 횟수 | `4520` |
| `hashtag_count` | 관련 해시태그 수 | `15` |
| `sponsored_count` | 스폰서 콘텐츠 수 | `230` |
| `avg_engagement_rate` | 평균 참여율 | `3.8` |
| `top_influencers` | 주요 언급 인플루언서 | `["user1", "user2"]` |

---

#### `find_brand_collaborators`

특정 브랜드와 협업한 인플루언서 탐색

**입력 파라미터**

| 파라미터 | 타입 | 설명 | 예시 |
|----------|------|------|------|
| `brand_name` | String | 브랜드명 | "Chanel" |
| `country` | Array[String] | 국가 필터 | ["KR", "JP", "CN"] |
| `collaboration_tier` | Array[String] | 협업 등급 | ["Ready - Premium"] |
| `min_followers` | Integer | 최소 팔로워 | 50000 |

**출력**

| 필드 | 설명 | 예시 |
|------|------|------|
| `user_id` | 인플루언서 고유 ID | `"12345678"` |
| `username` | 인스타그램 사용자명 | `"chanel_beauty"` |
| `follower_count` | 팔로워 수 | `150000` |
| `collaboration_count` | 해당 브랜드 협업 횟수 | `8` |
| `avg_engagement_rate` | 평균 참여율 | `4.5` |
| `collaboration_tier` | 협업 등급 | `"Ready - Premium"` |

---

#### `analyze_sponsored_content_performance`

스폰서 콘텐츠 성과 분석

**입력 파라미터**

| 파라미터 | 타입 | 설명 | 예시 |
|----------|------|------|------|
| `brand_name` | String | 브랜드명 (optional) | "Dior" |
| `country` | Array[String] | 국가 필터 | ["KR"] |
| `period_days` | Integer | 분석 기간 | 90 |
| `content_type` | String | 콘텐츠 유형 | "all" / "media" / "reels" |

**출력**

| 필드 | 설명 | 예시 |
|------|------|------|
| `sponsored_avg_engagement` | 스폰서 콘텐츠 평균 참여율 | `4.2` |
| `organic_avg_engagement` | 일반 콘텐츠 평균 참여율 | `3.1` |
| `performance_premium` | 스폰서 콘텐츠 성과 프리미엄 | `+35%` |
| `top_content_type` | 최고 성과 콘텐츠 유형 | `"GRWM"` |
| `top_content_engagement` | 최고 성과 콘텐츠 참여율 | `5.8` |
| `total_sponsored_posts` | 총 스폰서 콘텐츠 수 | `156` |

---

#### `compare_competitor_brands`

경쟁 브랜드 인플루언서 마케팅 비교

**입력 파라미터**

| 파라미터 | 타입 | 설명 | 예시 |
|----------|------|------|------|
| `brands` | Array[String] | 비교할 브랜드들 | ["Fwee", "Rom&nd", "Peripera"] |
| `country` | Array[String] | 국가 필터 | ["KR", "JP", "TH"] |
| `period_days` | Integer | 분석 기간 | 90 |

**출력**

| 필드 | 설명 | 예시 |
|------|------|------|
| `brand` | 브랜드명 | `"Fwee"` |
| `collaborator_count` | 협업 인플루언서 수 | `87` |
| `total_sponsored_posts` | 스폰서 콘텐츠 수 | `156` |
| `avg_engagement_rate` | 평균 참여율 | `4.2` |
| `top_markets` | 주요 시장 | `["KR", "JP"]` |
| `influencer_tier_distribution` | 인플루언서 등급 분포 | `{"Premium": 19, "Professional": 48}` |

---

### 2.4 시장/오디언스 인사이트 도구

#### `analyze_market_demographics`

시장별 인플루언서 인구통계 분석

**입력 파라미터**

| 파라미터 | 타입 | 설명 | 예시 |
|----------|------|------|------|
| `country` | Array[String] | 분석할 국가 | ["ID", "TH", "VN", "PH"] |
| `interests` | Array[String] | 관심사 필터 | ["Beauty"] |
| `group_by` | Array[String] | 그룹핑 기준 | ["age_range", "gender"] |

**출력**

| 필드 | 설명 | 예시 |
|------|------|------|
| `country` | 국가 코드 | `"ID"` |
| `total_count` | 총 인플루언서 수 | `15420` |
| `gender_distribution` | 성별 분포 | `{"Female": 89, "Male": 11}` |
| `age_distribution` | 연령대 분포 | `{"20~24": 35, "25~29": 28}` |
| `occupation_distribution` | 직업 분포 | `{"Content Creator": 45}` |
| `tier_distribution` | 협업 등급 분포 | `{"Ready - Premium": 8}` |

---

#### `find_k_culture_influencers`

K-컬처 관심 해외 인플루언서 발굴

**입력 파라미터**

| 파라미터 | 타입 | 설명 | 예시 |
|----------|------|------|------|
| `country` | Array[String] | 국가 필터 (KR 제외) | ["US", "JP", "ID"] |
| `k_interest` | Boolean | K-컬처 관심 | true |
| `interests` | Array[String] | 관심사 필터 | ["Beauty", "Fashion & Style"] |
| `collaboration_tier` | Array[String] | 협업 등급 | ["Ready - Premium", "Ready - Professional"] |

**출력**

| 필드 | 설명 | 예시 |
|------|------|------|
| `user_id` | 인플루언서 고유 ID | `"12345678"` |
| `username` | 인스타그램 사용자명 | `"kbeauty_fan_us"` |
| `follower_count` | 팔로워 수 | `75000` |
| `country` | 거주 국가 | `"US"` |
| `k_interest_reason` | K-컬처 관심 이유 | `"K-Beauty Brand Mentions"` |
| `collaboration_tier` | 협업 등급 | `"Ready - Professional"` |

---

#### `analyze_lifestage_segments`

생애주기별 인플루언서 세그먼트 분석

**입력 파라미터**

| 파라미터 | 타입 | 설명 | 예시 |
|----------|------|------|------|
| `country` | Array[String] | 국가 필터 | ["KR"] |
| `interests` | Array[String] | 관심사 필터 | ["Child Care & Parenting", "Beauty"] |
| `lifestage` | Array[String] | 생애주기 필터 | ["Married With Infant/Toddler", "Married With Young Children"] |

**출력**

| 필드 | 설명 | 예시 |
|------|------|------|
| `lifestage` | 생애주기 | `"Married With Infant/Toddler"` |
| `count` | 해당 생애주기 인플루언서 수 | `2450` |
| `percentage` | 비율 | `15.8` |
| `top_interests` | 주요 관심사 | `["Child Care", "Beauty"]` |
| `avg_engagement_rate` | 평균 참여율 | `4.2` |
| `tier_distribution` | 협업 등급 분포 | `{"Ready - Premium": 12}` |

---

#### `analyze_beauty_persona_segments`

뷰티 페르소나 세그먼트 분석

**입력 파라미터**

| 파라미터 | 타입 | 설명 | 예시 |
|----------|------|------|------|
| `country` | Array[String] | 국가 필터 | ["KR", "JP"] |
| `skin_type` | Array[String] | 피부 타입 | ["Oily", "Combination"] |
| `skin_concerns` | Array[String] | 피부 고민 | ["Acne", "Pore Care"] |
| `personal_color` | String | 퍼스널 컬러 | "Warm" |
| `brand_tier_segments` | String | 브랜드 선호 가격대 | "Premium" |

**출력**

| 필드 | 설명 | 예시 |
|------|------|------|
| `segment_name` | 세그먼트명 | `"Oily Skin + Acne Concern"` |
| `count` | 해당 세그먼트 인플루언서 수 | `1850` |
| `skin_type_distribution` | 피부 타입 분포 | `{"Oily": 65, "Combination": 35}` |
| `top_concerns` | 주요 피부 고민 | `["Acne", "Pore Care"]` |
| `preferred_brands` | 선호 브랜드 | `["COSRX", "Some By Mi"]` |
| `avg_engagement_rate` | 평균 참여율 | `4.8` |

---

### 2.5 콘텐츠 성과 분석 도구

#### `analyze_engagement_metrics`

참여도 통계 분석

**입력 파라미터**

| 파라미터 | 타입 | 설명 | 예시 |
|----------|------|------|------|
| `country` | Array[String] | 국가 필터 | ["KR"] |
| `interests` | Array[String] | 관심사 필터 | ["Beauty"] |
| `collaboration_tier` | Array[String] | 협업 등급 | ["Ready - Premium"] |
| `period_days` | Integer | 분석 기간 | 30 |
| `content_type` | String | 콘텐츠 유형 | "all" / "media" / "reels" |

**출력**

| 필드 | 설명 | 예시 |
|------|------|------|
| `avg_likes` | 평균 좋아요 수 | `3500` |
| `median_likes` | 중앙값 좋아요 수 | `2800` |
| `avg_comments` | 평균 댓글 수 | `120` |
| `median_comments` | 중앙값 댓글 수 | `85` |
| `avg_engagement_rate` | 평균 참여율 | `4.2` |
| `top_10_threshold` | 상위 10% 기준값 | `{"likes": 8500, "engagement": 7.5}` |

---

#### `compare_content_formats`

피드 vs 릴스 성과 비교

**입력 파라미터**

| 파라미터 | 타입 | 설명 | 예시 |
|----------|------|------|------|
| `country` | Array[String] | 국가 필터 | ["KR", "JP"] |
| `interests` | Array[String] | 관심사 필터 | ["Beauty"] |
| `period_days` | Integer | 분석 기간 | 90 |

**출력**

| 필드 | 설명 | 예시 |
|------|------|------|
| `content_type` | 콘텐츠 유형 | `"reels"` |
| `avg_engagement_rate` | 평균 참여율 | `5.2` |
| `avg_views` | 평균 조회수 (릴스) | `45000` |
| `avg_likes` | 평균 좋아요 수 | `3200` |
| `optimal_length` | 최적 콘텐츠 길이 | `"15-30초"` |
| `comparison` | 피드 대비 성과 | `"+35% engagement"` |

---

#### `find_optimal_posting_time`

최적 포스팅 시간대 분석

**입력 파라미터**

| 파라미터 | 타입 | 설명 | 예시 |
|----------|------|------|------|
| `country` | Array[String] | 국가 필터 | ["JP"] |
| `interests` | Array[String] | 관심사 필터 | ["Beauty"] |
| `period_days` | Integer | 분석 기간 | 90 |

**출력**

| 필드 | 설명 | 예시 |
|------|------|------|
| `day_of_week` | 요일 | `"Wednesday"` |
| `hour` | 시간대 | `20` (20:00) |
| `avg_engagement_rate` | 해당 시간대 평균 참여율 | `5.8` |
| `post_count` | 해당 시간대 포스팅 수 | `1250` |
| `optimal_time` | 최적 포스팅 시점 | `"Wed 20:00-22:00"` |
| `timezone` | 시간대 기준 | `"KST"` |

---

#### `analyze_viral_content_patterns`

바이럴 콘텐츠 패턴 분석

**입력 파라미터**

| 파라미터 | 타입 | 설명 | 예시 |
|----------|------|------|------|
| `country` | Array[String] | 국가 필터 | ["KR", "JP", "US"] |
| `interests` | Array[String] | 관심사 필터 | ["Beauty"] |
| `viral_threshold` | Integer | 바이럴 기준 좋아요 수 | 100000 |
| `period_days` | Integer | 분석 기간 | 180 |

**출력**

| 필드 | 설명 | 예시 |
|------|------|------|
| `viral_count` | 바이럴 콘텐츠 수 | `450` |
| `top_hashtags` | 공통 해시태그 | `["#grwm", "#tutorial"]` |
| `top_content_types` | 주요 콘텐츠 유형 | `["Before/After", "Tutorial"]` |
| `optimal_length` | 최적 길이 | `"15-30초"` |
| `format_distribution` | 포맷 분포 | `{"Reels": 78, "Image": 22}` |
| `common_features` | 공통 특징 | `["자막 포함", "트렌딩 오디오"]` |

---

#### `analyze_beauty_content_performance`

뷰티 콘텐츠 유형별 성과 분석

**입력 파라미터**

| 파라미터 | 타입 | 설명 | 예시 |
|----------|------|------|------|
| `country` | Array[String] | 국가 필터 | ["KR"] |
| `beauty_content_types` | Array[String] | 뷰티 콘텐츠 유형 | ["Makeup Tutorial", "GRWM", "Product Review"] |
| `period_days` | Integer | 분석 기간 | 90 |

**출력**

| 필드 | 설명 | 예시 |
|------|------|------|
| `content_type` | 뷰티 콘텐츠 유형 | `"Makeup Tutorial"` |
| `post_count` | 콘텐츠 수 | `3450` |
| `avg_engagement_rate` | 평균 참여율 | `5.2` |
| `avg_likes` | 평균 좋아요 수 | `4500` |
| `avg_comments` | 평균 댓글 수 | `180` |
| `top_performer` | 최고 성과 유형 | `"GRWM"` |

---

### 2.6 멀티 플랫폼/링크 분석 도구

`insta_user_links_v3` 테이블을 활용하여 인플루언서의 멀티 플랫폼 활동 및 연락처 정보를 분석합니다.

#### `search_multiplatform_influencers`

여러 플랫폼에서 활동하는 인플루언서 검색

**입력 파라미터**

| 파라미터 | 타입 | 설명 | 예시 |
|----------|------|------|------|
| `country` | Array[String] | 거주 국가 | ["KR", "JP"] |
| `interests` | Array[String] | 관심사 필터 | ["Beauty"] |
| `required_channels` | Array[String] | 필수 보유 채널 | ["youtube", "tiktok"] |
| `optional_channels` | Array[String] | 선택적 채널 | ["blog", "twitter"] |
| `collaboration_tier` | Array[String] | 협업 등급 | ["Ready - Premium"] |

**출력**

| 필드 | 설명 | 예시 |
|------|------|------|
| `user_id` | 인플루언서 고유 ID | `"12345678"` |
| `username` | 인스타그램 사용자명 | `"beauty_multi"` |
| `follower_count` | 팔로워 수 | `95000` |
| `channels` | 보유 채널 목록 | `["youtube", "tiktok", "blog"]` |
| `channel_urls` | 채널별 URL | `{"youtube": "youtube.com/..."}` |
| `collaboration_tier` | 협업 등급 | `"Ready - Premium"` |

**활용 예시**
- "유튜브와 인스타그램 모두 운영하는 뷰티 인플루언서"
- "틱톡 + 인스타그램 동시 활동하는 한국 크리에이터"

---

#### `find_influencers_with_shopping_links`

쇼핑/제휴 링크를 보유한 인플루언서 탐색 (제휴 마케팅 적합)

**입력 파라미터**

| 파라미터 | 타입 | 설명 | 예시 |
|----------|------|------|------|
| `country` | Array[String] | 거주 국가 | ["US", "KR"] |
| `interests` | Array[String] | 관심사 필터 | ["Beauty", "Fashion & Style"] |
| `shopping_channels` | Array[String] | 쇼핑 채널 필터 | ["amazon", "shopltk", "sephora"] |
| `collaboration_tier` | Array[String] | 협업 등급 | ["Ready - Premium", "Ready - Professional"] |

**출력**

| 필드 | 설명 | 예시 |
|------|------|------|
| `user_id` | 인플루언서 고유 ID | `"12345678"` |
| `username` | 인스타그램 사용자명 | `"affiliate_beauty"` |
| `follower_count` | 팔로워 수 | `85000` |
| `shopping_channels` | 보유 쇼핑 채널 | `["amazon", "shopltk"]` |
| `shopping_urls` | 채널별 URL | `{"amazon": "amazon.com/shop/..."}` |
| `collaboration_tier` | 협업 등급 | `"Ready - Professional"` |

**쇼핑 채널 옵션**

| 채널 | 설명 | 주요 시장 |
|------|------|----------|
| `amazon` | Amazon Associates/Storefront | US, Global |
| `shopltk` | LTK (LikeToKnow.it) 제휴 | US |
| `sephora` | Sephora Squad/Affiliate | US, Global |
| `shopee` | Shopee Affiliate | SEA |
| `coupang` | 쿠팡 파트너스 | KR |
| `rakuten` | 라쿠텐 제휴 | JP |

---

#### `find_contactable_influencers`

연락 가능한 인플루언서 검색 (이메일, 블로그 등 연락처 보유)

**입력 파라미터**

| 파라미터 | 타입 | 설명 | 예시 |
|----------|------|------|------|
| `country` | Array[String] | 거주 국가 | ["KR"] |
| `interests` | Array[String] | 관심사 필터 | ["Beauty"] |
| `contact_channels` | Array[String] | 연락처 유형 | ["email", "blog", "kakaotalk"] |
| `collaboration_tier` | Array[String] | 협업 등급 | ["Ready - Premium"] |

**출력**

| 필드 | 설명 | 예시 |
|------|------|------|
| `user_id` | 인플루언서 고유 ID | `"12345678"` |
| `username` | 인스타그램 사용자명 | `"beauty_biz"` |
| `follower_count` | 팔로워 수 | `120000` |
| `contact_channels` | 보유 연락처 유형 | `["email", "blog"]` |
| `contact_info` | 연락처 정보 | `{"email": "biz@example.com"}` |
| `collaboration_tier` | 협업 등급 | `"Ready - Premium"` |

**연락처 채널 옵션**

| 채널 | 설명 |
|------|------|
| `email` | 이메일 주소 (비즈니스 문의용) |
| `blog` | 블로그 URL (네이버 블로그 등) |
| `kakaotalk` | 카카오톡 오픈채팅/채널 |

---

#### `analyze_platform_distribution`

특정 조건의 인플루언서 그룹 내 플랫폼 분포 분석

**입력 파라미터**

| 파라미터 | 타입 | 설명 | 예시 |
|----------|------|------|------|
| `country` | Array[String] | 거주 국가 | ["KR", "JP", "VN"] |
| `interests` | Array[String] | 관심사 필터 | ["Beauty"] |
| `collaboration_tier` | Array[String] | 협업 등급 | ["Ready - Premium", "Ready - Professional"] |
| `link_type` | String | 링크 타입 | "all" / "sns" / "shopping" / "contact" |

**출력**

| 필드 | 설명 | 예시 |
|------|------|------|
| `channel` | 채널명 | `"youtube"` |
| `influencer_count` | 보유 인플루언서 수 | `312` |
| `percentage` | 비율 | `78.5` |
| `by_country` | 국가별 분포 | `{"KR": 45, "JP": 33}` |

**활용 예시**
- "한국 뷰티 인플루언서 중 유튜브 채널 보유 비율"
- "동남아 인플루언서의 쇼핑 채널 보유 현황"

---

#### `compare_platform_presence`

경쟁 브랜드 협업 인플루언서의 플랫폼 보유 현황 비교

**입력 파라미터**

| 파라미터 | 타입 | 설명 | 예시 |
|----------|------|------|------|
| `brands` | Array[String] | 비교할 브랜드 | ["Fwee", "Rom&nd"] |
| `channels` | Array[String] | 분석할 채널 | ["youtube", "tiktok", "blog"] |

**출력**

| 필드 | 설명 | 예시 |
|------|------|------|
| `brand` | 브랜드명 | `"Fwee"` |
| `total_collaborators` | 총 협업 인플루언서 수 | `87` |
| `youtube_count` | YouTube 보유 수 | `45` |
| `youtube_percentage` | YouTube 보유 비율 | `51.7` |
| `tiktok_count` | TikTok 보유 수 | `32` |
| `tiktok_percentage` | TikTok 보유 비율 | `36.8` |

---

## 3. 활용 시나리오

### 시나리오 A: 동남아 K-뷰티 시장 진출 전략

**상황**: 한국 스킨케어 브랜드가 인도네시아 시장에 진출하려고 합니다.

**Step 1: 시장 인구통계 분석**

```
도구: analyze_market_demographics
파라미터:
  - country: ["ID"]
  - interests: ["Beauty", "Skincare"]
  - group_by: ["age_range", "gender", "skin_type", "skin_concerns"]

결과:
  - 전체 뷰티 인플루언서: 15,420명
  - 성별 분포: 여성 89%, 남성 11%
  - 연령대 분포: 20~24세 (35%), 25~29세 (28%), 30~34세 (18%)
  - 주요 피부타입: Oily (42%), Combination (31%)
  - 주요 피부고민: Acne (38%), Oil Control (25%), Brightening (22%)
```

**Step 2: K-뷰티 관심 인플루언서 발굴**

```
도구: find_k_culture_influencers
파라미터:
  - country: ["ID"]
  - k_interest: true
  - interests: ["Beauty", "Skincare"]
  - collaboration_tier: ["Ready - Premium", "Ready - Professional"]

결과:
  - K-뷰티 관심 인플루언서: 1,847명
  - Ready 티어: 423명 (Premium 89명, Professional 334명)
  - 주요 관심 브랜드: Innisfree, COSRX, Laneige, Sulwhasoo
```

**Step 3: 해시태그 트렌드 분석**

```
도구: analyze_hashtag_trends_bigquery
파라미터:
  - country: ["ID"]
  - interests: ["Beauty", "Skincare"]
  - period_days: 30

결과 (TOP 10):
  1. #skincareroutine (12,340회)
  2. #glowingskin (8,920회)
  3. #kbeauty (7,650회)
  4. #skincarekorea (5,430회)
  5. #acnecare (4,890회)
  6. #serum (4,210회)
  7. #naturalbeauty (3,980회)
  8. #affordable (3,540회)
  9. #beforeafter (3,120회)
  10. #skincaretips (2,890회)
```

**Step 4: 성분 트렌드 분석**

```
도구: analyze_beauty_ingredient_trends
파라미터:
  - country: ["ID"]
  - period_days: 90
  - category: "skincare"

결과:
  - 급성장 성분: Niacinamide (+180%), Centella Asiatica (+145%)
  - 꾸준한 인기: Hyaluronic Acid, Vitamin C
  - 신흥 관심: Snail Mucin (+220%), Propolis (+95%)
```

**Step 5: 타겟 인플루언서 검색**

```
도구: search_influencers_bigquery
파라미터:
  - country: ["ID"]
  - beauty_interest_areas: ["Skincare", "K Beauty"]
  - skin_type: ["Oily", "Combination"]
  - skin_concerns: ["Acne", "Oil Control"]
  - brand_tier_segments: "Premium"
  - collaboration_tier: ["Ready - Premium", "Ready - Professional"]
  - follower_min: 10000
  - follower_max: 100000

결과: 127명의 마이크로 인플루언서 목록
```

**종합 인사이트**

- **타겟**: 20대 여성, 지성/복합성 피부, 여드름 고민
- **콘텐츠 전략**: Before/After + Skincare Routine 포맷
- **해시태그 전략**: #kbeauty + #acnecare + #glowingskin
- **성분 마케팅**: Niacinamide, Centella 강조
- **인플루언서**: Ready 티어 마이크로 인플루언서 127명 타겟

---

### 시나리오 B: 경쟁사 벤치마킹 분석

**상황**: Fwee가 Rom&nd, Peripera와의 인플루언서 마케팅 현황을 비교하고 싶습니다.

**Step 1: 경쟁사 브랜드 비교**

```
도구: compare_competitor_brands
파라미터:
  - brands: ["Fwee", "Rom&nd", "Peripera"]
  - country: ["KR", "JP", "TH", "VN", "ID"]
  - period_days: 90

결과:
| 브랜드 | 협업 인플루언서 | 스폰서 콘텐츠 | 평균 참여율 | 주요 시장 |
|--------|----------------|--------------|------------|----------|
| Fwee | 87명 | 156건 | 4.2% | KR (78%), JP (12%) |
| Rom&nd | 234명 | 412건 | 3.8% | KR (45%), JP (25%), TH (15%) |
| Peripera | 178명 | 298건 | 3.5% | KR (52%), VN (20%), ID (15%) |
```

**Step 2: 각 브랜드 협업 인플루언서 분석**

```
도구: find_brand_collaborators
파라미터:
  - brand_name: "Rom&nd"
  - country: ["KR", "JP", "TH", "VN", "ID"]
  - collaboration_tier: ["Ready - Premium", "Ready - Professional"]

결과:
  - Premium 티어: 45명 (19%)
  - Professional 티어: 112명 (48%)
  - 주요 연령대: 20~29세 (67%)
  - 주요 콘텐츠: Lip Tint 리뷰 (42%), GRWM (28%)
```

**Step 3: 스폰서 콘텐츠 성과 비교**

```
도구: analyze_sponsored_content_performance
파라미터:
  - brand_name: "Fwee"
  - country: ["KR", "JP"]
  - period_days: 90
  - content_type: "all"

결과:
  - Fwee 스폰서 콘텐츠 평균 참여율: 4.2%
  - 일반 콘텐츠 평균 참여율: 3.1%
  - 스폰서 콘텐츠 참여율 프리미엄: +35%
  - 최고 성과 콘텐츠 유형: GRWM (5.8%)
```

**Step 4: 시장별 기회 분석**

```
도구: analyze_market_demographics
파라미터:
  - country: ["TH", "VN", "ID"]
  - interests: ["Beauty", "Makeup"]
  - group_by: ["country", "collaboration_tier"]

결과:
| 국가 | Ready 티어 인플루언서 | 경쟁사 진출 현황 |
|------|---------------------|----------------|
| TH | 1,240명 | Rom&nd 활발, Fwee 미진출 |
| VN | 980명 | Peripera 활발, Fwee 미진출 |
| ID | 1,560명 | Peripera 진출 중, Fwee 미진출 |
```

**종합 인사이트**

- **강점**: Fwee는 참여율이 가장 높음 (4.2%)
- **약점**: 협업 인플루언서 수가 경쟁사 대비 적음 (87명 vs 234명)
- **기회**: 동남아 시장 (TH, VN, ID)에서 Rom&nd/Peripera 대비 미진출 상태
- **위협**: 경쟁사들의 공격적인 동남아 확장

**액션 아이템**

1. 태국 시장 우선 진출 (Ready 티어 1,240명 활용)
2. GRWM 콘텐츠 포맷 강화 (최고 성과 5.8%)
3. 협업 인플루언서 수 2배 확대 목표

---

### 시나리오 C: 2025 뷰티 트렌드 예측

**상황**: 2025년 글로벌 뷰티 트렌드를 예측하고 선제적 마케팅 전략을 수립하려 합니다.

**Step 1: 급성장 해시태그 탐지**

```
도구: detect_emerging_hashtags
파라미터:
  - country: ["KR", "JP", "US", "VN", "TH"]
  - interests: ["Beauty", "Skincare", "Makeup"]
  - compare_period: "3months"
  - min_growth_rate: 1.5

결과 (글로벌 급성장 TOP 10):
| 해시태그 | 성장률 | 주요 국가 |
|---------|-------|----------|
| #cleanbeauty | +340% | US, KR |
| #skinminimalism | +280% | KR, JP |
| #skinbarrier | +245% | KR, JP, VN |
| #glutathione | +220% | TH, VN, ID |
| #slugging | +195% | US, KR |
| #dopaminebeauty | +180% | US, KR, JP |
| #quietluxury | +165% | KR, JP |
| #protectivehairstyles | +155% | US |
| #koreanskincare | +142% | US, TH, VN |
| #glasskin | +138% | Global |
```

**Step 2: 지역별 트렌드 비교**

```
도구: compare_regional_hashtags
파라미터:
  - countries: ["KR", "JP", "US", "VN", "TH"]
  - interests: ["Beauty"]
  - period_days: 90

결과:
- 글로벌 공통: #glasskin, #skincare, #cleanbeauty
- KR 특화: #skinminimalism, #quietluxury, #morningskincare
- JP 특화: #jbeauty, #minimalmakeup, #naturalbeauty
- US 특화: #cleanbeauty, #slugging, #dopaminebeauty
- VN/TH 특화: #glutathione, #whitening, #koreanskincare
```

**Step 3: 성분 트렌드 분석**

```
도구: analyze_beauty_ingredient_trends
파라미터:
  - country: ["KR", "JP", "US"]
  - period_days: 90
  - category: "skincare"

결과:
- 급성장: Centella Asiatica (+180%), Mugwort (+165%), Probiotics (+142%)
- 꾸준한 상승: Niacinamide, Peptides, Ceramides
- 신흥 관심: Bakuchiol (레티놀 대안), Tranexamic Acid
- 하락 추세: Vitamin C (포화), Hyaluronic Acid (기본화)
```

**Step 4: 바이럴 콘텐츠 패턴 분석**

```
도구: analyze_viral_content_patterns
파라미터:
  - country: ["KR", "JP", "US"]
  - interests: ["Beauty"]
  - viral_threshold: 100000
  - period_days: 180

결과:
- 포맷: Reels/숏폼 (78%), 이미지 (22%)
- 최적 길이: 15~30초 (릴스)
- 고성과 구조: Before/After (32%), Tutorial (28%), GRWM (24%)
- 공통 특징: 자막 포함 (89%), 트렌딩 오디오 사용 (67%)
```

**Step 5: 트렌드 선도 인플루언서 세그먼트**

```
도구: search_influencers_bigquery
파라미터:
  - country: ["KR", "JP"]
  - beauty_interest_areas: ["Clean Beauty", "Skincare"]
  - brand_positioning_segments: "Clean Beauty"
  - collaboration_tier: ["Ready - Premium"]
  - follower_min: 50000

결과: 89명의 클린뷰티 선도 인플루언서
  - 주요 콘텐츠: Skincare Routine (45%), Product Review (32%)
  - 선호 브랜드: Klairs, Benton, Isntree, Beauty of Joseon
```

**2025 트렌드 예측 종합**

1. **스킨 미니멀리즘**: 적은 제품으로 효과적인 루틴
2. **스킨 배리어 케어**: 장벽 강화 성분 (Ceramides, Centella) 부상
3. **클린뷰티 대세화**: 비건, 클루얼티프리 요구 증가
4. **도파민 뷰티**: 컬러풀하고 기분 좋아지는 메이크업
5. **숏폼 콘텐츠 지속**: 15~30초 릴스 중심
6. **Before/After 포맷**: 가장 높은 참여율 유지

---

### 시나리오 D: 신제품 출시용 인플루언서 캐스팅

**상황**: 민감성 피부를 위한 진정 세럼 신제품 출시를 위해 적합한 인플루언서를 찾습니다.

**Step 1: 타겟 페르소나 기반 검색**

```
도구: search_influencers_bigquery
파라미터:
  - country: ["KR"]
  - beauty_interest_areas: ["Skincare", "Clean Beauty"]
  - skin_type: ["Sensitive"]
  - skin_concerns: ["Sensitive Skin", "Acne", "Hydration"]
  - skincare_ingredients: ["Centella Asiatica", "Ceramides", "Panthenol"]
  - collaboration_tier: ["Ready - Premium", "Ready - Professional"]
  - follower_min: 30000
  - follower_max: 300000

결과: 67명
  - Premium 티어: 12명
  - Professional 티어: 55명
  - 평균 참여율: 4.8%
```

**Step 2: 콘텐츠 스타일 필터링**

```
도구: search_influencers_bigquery (추가 필터)
파라미터:
  - beauty_content_types: ["Product Review", "Skincare Routine", "Before After"]
  - aesthetic_keywords: ["Minimalist", "Clean Girl", "Natural"]
  - brand_tier_segments: "Premium"

결과: 34명으로 좁혀짐
  - 주요 콘텐츠 유형: Skincare Routine (48%), Product Review (35%)
  - 선호 미학: Minimalist (62%), Natural (28%)
```

**Step 3: 경쟁 브랜드 협업 이력 확인**

```
도구: search_by_brand_collaboration
파라미터:
  - brand_name: "Klairs"  # 유사 포지셔닝 브랜드
  - country: ["KR"]
  - exclude_brand: ["직접 경쟁사"]

결과: 위 34명 중 Klairs 협업 이력 8명
  - 이들의 평균 참여율: 5.2%
  - 민감성 피부 관련 콘텐츠 비율: 68%
```

**Step 4: 최종 후보 프로필 분석**

```
최종 추천 인플루언서 (TOP 5):
1. @sensitive_skin_kr
   - 팔로워: 85K | 참여율: 5.8%
   - 피부타입: Sensitive | 피부고민: Sensitive Skin, Acne
   - 협업이력: Klairs, Benton, Round Lab
   - 강점: Before/After 콘텐츠 전문, 성분 분석 깊이 있음

2. @skincare_minimalist
   - 팔로워: 120K | 참여율: 4.9%
   - 피부타입: Sensitive | 피부고민: Hydration, Sensitive Skin
   - 협업이력: Isntree, Beauty of Joseon
   - 강점: 미니멀 루틴 전문, 클린뷰티 오피니언 리더

... (이하 생략)
```

**캐스팅 전략 제안**

- **Phase 1 (시딩)**: TOP 5 인플루언서 제품 시딩
- **Phase 2 (리뷰)**: 긍정 반응 인플루언서 유료 협업
- **콘텐츠 가이드**: Before/After + 성분 설명 + 민감성 피부 테스트
- **예상 리치**: 50만+ (5명 합산)
- **예상 참여**: 25,000+ 인터랙션

---

### 시나리오 E: 글로벌 캠페인 현지화 전략

**상황**: 한국 립틴트 브랜드가 일본, 태국, 베트남에서 동시 캠페인을 진행합니다.

**Step 1: 국가별 뷰티 트렌드 비교**

```
도구: compare_regional_hashtags
파라미터:
  - countries: ["JP", "TH", "VN"]
  - interests: ["Beauty", "Makeup"]
  - period_days: 30

결과:
| 국가 | TOP 립 관련 해시태그 | 선호 컬러 | 선호 마감 |
|------|---------------------|----------|----------|
| JP | #naturallip #mlbb #sheerlip | Mauve, Pink | Natural, Sheer |
| TH | #boldlip #redlip #kbeauty | Red, Coral | Matte, Bold |
| VN | #liptint #koreanmakeup #everyday | Pink, Coral | Dewy, Natural |
```

**Step 2: 국가별 인플루언서 검색**

```
도구: search_influencers_bigquery
파라미터 (JP):
  - country: ["JP"]
  - makeup_items: ["Lip Tint", "Lipstick"]
  - makeup_interests: ["Natural Makeup", "Korean Beauty"]
  - makeup_color_preferences: ["Mauve Purples", "Pink Family"]
  - collaboration_tier: ["Ready - Premium", "Ready - Professional"]

결과: JP 78명, TH 92명, VN 64명
```

**Step 3: 국가별 콘텐츠 성과 분석**

```
도구: analyze_beauty_content_performance
파라미터:
  - country: ["JP", "TH", "VN"]
  - beauty_content_types: ["Product Review", "GRWM", "Look Recreation"]
  - period_days: 90

결과:
| 국가 | 최고 성과 콘텐츠 | 평균 참여율 | 최적 포스팅 시간 |
|------|----------------|------------|----------------|
| JP | GRWM (5.2%) | 4.1% | 20:00-22:00 |
| TH | Look Recreation (4.8%) | 3.9% | 19:00-21:00 |
| VN | Product Review (5.5%) | 4.3% | 21:00-23:00 |
```

**현지화 전략 제안**

| 요소 | 일본 | 태국 | 베트남 |
|------|------|------|--------|
| **메인 컬러** | Mauve, MLBB | Coral Red, Bold | Coral Pink |
| **마감감** | Sheer, Natural | Matte, Long-lasting | Dewy, Glossy |
| **콘텐츠 포맷** | GRWM | Look Recreation | Product Review |
| **해시태그** | #naturallip #mlbb | #boldlip #koreanlip | #liptint #koreanmakeup |
| **인플루언서 수** | 20명 | 25명 | 15명 |
| **포스팅 시간** | 20:00-22:00 | 19:00-21:00 | 21:00-23:00 |

---

### 시나리오 F: 멀티 플랫폼 인플루언서 발굴 및 제휴 마케팅

**상황**: 브랜드가 유튜브+인스타그램 동시 활동하는 인플루언서를 찾고, Amazon/LTK 제휴 링크 보유 여부도 확인하려 합니다.

**Step 1: 멀티 플랫폼 인플루언서 검색**

```
도구: search_multiplatform_influencers
파라미터:
  - country: ["US"]
  - interests: ["Beauty"]
  - required_channels: ["youtube", "instagram"]
  - optional_channels: ["tiktok", "blog"]
  - collaboration_tier: ["Ready - Premium", "Ready - Professional"]

결과: 234명
  - YouTube + Instagram: 234명 (100%)
  - YouTube + Instagram + TikTok: 89명 (38%)
  - YouTube + Instagram + Blog: 67명 (29%)
  - 평균 YouTube 구독자: 45K
```

**Step 2: 쇼핑 링크 보유 인플루언서 필터링**

```
도구: find_influencers_with_shopping_links
파라미터:
  - country: ["US"]
  - interests: ["Beauty"]
  - shopping_channels: ["amazon", "shopltk", "sephora"]
  - collaboration_tier: ["Ready - Premium"]

결과: 156명
  - Amazon Storefront 보유: 98명 (63%)
  - LTK 링크 보유: 87명 (56%)
  - Sephora Squad: 23명 (15%)
  - 복수 쇼핑 채널: 54명 (35%)
```

**Step 3: 플랫폼 분포 분석**

```
도구: analyze_platform_distribution
파라미터:
  - country: ["US"]
  - interests: ["Beauty"]
  - collaboration_tier: ["Ready - Premium"]
  - link_type: "all"

결과:
| 채널 | 보유 수 | 비율 |
|------|--------|------|
| youtube | 312명 | 78% |
| tiktok | 245명 | 61% |
| amazon | 156명 | 39% |
| shopltk | 134명 | 34% |
| blog | 89명 | 22% |
| email | 267명 | 67% |
```

**Step 4: 연락 가능 인플루언서 최종 필터**

```
도구: find_contactable_influencers
파라미터:
  - country: ["US"]
  - interests: ["Beauty"]
  - contact_channels: ["email"]
  - collaboration_tier: ["Ready - Premium"]

결과: 267명 (이메일 연락 가능)
```

**종합 인사이트**

| 세그먼트 | 인플루언서 수 | 특징 |
|----------|-------------|------|
| 멀티 플랫폼 (YT+IG) | 234명 | 콘텐츠 다양화, 넓은 도달 |
| 제휴 링크 보유 | 156명 | 제휴 마케팅 경험 있음 |
| 이메일 컨택 가능 | 267명 | 직접 연락 가능 |
| **최종 타겟** | **89명** | YT+IG+제휴링크+이메일 |

**캠페인 전략 제안**

1. **Phase 1**: 89명 타겟 이메일 아웃리치
2. **제휴 마케팅**: Amazon/LTK 보유 인플루언서 우선 협업
3. **콘텐츠 전략**: YouTube 리뷰 + Instagram 숏폼 + LTK 쇼핑링크 연동
4. **기대 효과**: 구매 전환까지 추적 가능한 풀퍼널 마케팅

---

### 시나리오 G: 지역별 플랫폼 전략 수립

**상황**: 글로벌 캠페인을 위해 국가별 인플루언서의 플랫폼 보유 현황을 파악하려 합니다.

**Step 1: 국가별 플랫폼 분포 비교**

```
도구: analyze_platform_distribution
파라미터:
  - country: ["KR", "JP", "US", "VN", "TH"]
  - interests: ["Beauty"]
  - collaboration_tier: ["Ready - Premium", "Ready - Professional"]
  - link_type: "sns"

결과:
| 국가 | YouTube | TikTok | Twitter | Blog |
|------|---------|--------|---------|------|
| KR | 45% | 28% | 12% | 62% |
| JP | 38% | 35% | 42% | 28% |
| US | 78% | 61% | 34% | 22% |
| VN | 32% | 52% | 8% | 15% |
| TH | 28% | 68% | 15% | 12% |
```

**Step 2: 국가별 쇼핑 채널 분포**

```
도구: analyze_platform_distribution
파라미터:
  - country: ["KR", "JP", "US", "VN", "TH"]
  - interests: ["Beauty"]
  - link_type: "shopping"

결과:
| 국가 | 주요 쇼핑 채널 | 보유 비율 |
|------|--------------|----------|
| KR | coupang | 34% |
| JP | rakuten | 28% |
| US | amazon, shopltk | 45%, 32% |
| VN | shopee | 42% |
| TH | shopee | 55% |
```

**지역별 전략 제안**

| 국가 | 콘텐츠 플랫폼 전략 | 제휴 마케팅 채널 |
|------|------------------|----------------|
| **KR** | 블로그 리뷰 + 인스타그램 | 쿠팡 파트너스 |
| **JP** | Twitter 바이럴 + YouTube | 라쿠텐 |
| **US** | YouTube 튜토리얼 + TikTok | Amazon + LTK |
| **VN** | TikTok 숏폼 중심 | Shopee Affiliate |
| **TH** | TikTok + Instagram | Shopee Affiliate |

---

## 4. 도구 조합 패턴

### 패턴 A: 시장 진출 분석

```
1. analyze_market_demographics → 시장 규모/특성 파악
2. analyze_hashtag_trends_bigquery → 현지 트렌드 파악
3. find_k_culture_influencers → K-컬처 관심층 발굴
4. search_influencers_bigquery → 타겟 인플루언서 검색
5. compare_regional_hashtags → 현지 vs 본국 차이 분석
```

### 패턴 B: 경쟁사 벤치마킹

```
1. compare_competitor_brands → 경쟁사 현황 비교
2. find_brand_collaborators → 경쟁사 협업 인플루언서 분석
3. analyze_sponsored_content_performance → 스폰서 콘텐츠 성과 비교
4. analyze_market_demographics → 미진출 시장 기회 분석
```

### 패턴 C: 트렌드 예측

```
1. detect_emerging_hashtags → 급성장 트렌드 탐지
2. compare_regional_hashtags → 지역별 차이 분석
3. analyze_beauty_ingredient_trends → 성분 트렌드 분석
4. analyze_viral_content_patterns → 바이럴 패턴 분석
```

### 패턴 D: 인플루언서 캐스팅

```
1. search_influencers_bigquery → 조건 기반 검색
2. search_by_brand_collaboration → 유사 브랜드 협업 이력 확인
3. analyze_engagement_metrics → 성과 지표 확인
4. 버킷에 담기 → GPT에게 최종 선별 요청
```

### 패턴 E: 멀티 플랫폼 / 제휴 마케팅

```
1. search_multiplatform_influencers → 멀티 플랫폼 인플루언서 탐색
2. find_influencers_with_shopping_links → 쇼핑 링크 보유 확인
3. analyze_platform_distribution → 플랫폼 분포 분석
4. find_contactable_influencers → 연락 가능 인플루언서 필터
5. 이메일 아웃리치 리스트 생성
```

### 패턴 F: 글로벌 캠페인 현지화

```
1. analyze_platform_distribution → 국가별 플랫폼 보유 현황
2. compare_regional_hashtags → 국가별 트렌드 차이
3. analyze_beauty_content_performance → 콘텐츠 유형별 성과
4. find_influencers_with_shopping_links → 현지 제휴 채널 보유 확인
5. 국가별 차별화 전략 수립
```

---

## 5. 요약

| 도구 카테고리 | 도구 수 | 구현 상태 | 주요 용도 |
|--------------|--------|----------|----------|
| 인플루언서 검색 | 3개 | ✅ 완료 | 조건 기반 인플루언서 발굴 |
| 트렌드 분석 | 4개 | ✅ 완료 | 해시태그/성분 트렌드 파악 |
| 브랜드 분석 | 4개 | ✅ 완료 | 경쟁사/협업 현황 분석 |
| 시장 인사이트 | 4개 | ✅ 완료 | 시장 특성/세그먼트 분석 |
| 콘텐츠 분석 | 5개 | ✅ 완료 | 콘텐츠 성과/패턴 분석 |
| 멀티 플랫폼/링크 | 5개 | ✅ 완료 | 외부 채널/제휴 링크 분석 |
| **합계** | **25개** | | |

### 구현된 도구 목록 (25개)

**인플루언서 검색 (3개)**
- `search_influencers` - whotag.ai API 기반 자연어 검색
- `search_influencers_bigquery` - BigQuery 기반 구조화 검색 (일반+뷰티 통합)
- `search_by_brand_collaboration` - 브랜드 협업 이력 검색

**트렌드 분석 (4개)**
- `analyze_hashtag_trends_bigquery` - 해시태그 트렌드 분석
- `detect_emerging_hashtags` - 급성장 해시태그 탐지
- `compare_regional_hashtags` - 지역별 해시태그 비교
- `analyze_beauty_ingredient_trends` - 뷰티 성분/아이템 트렌드 분석

**브랜드 분석 (4개)**
- `analyze_brand_mentions` - 브랜드 언급량 분석
- `find_brand_collaborators` - 브랜드 협업 인플루언서 탐색
- `analyze_sponsored_content_performance` - 스폰서 콘텐츠 성과 분석
- `compare_competitor_brands` - 경쟁 브랜드 비교

**시장 인사이트 (4개)**
- `analyze_market_demographics` - 시장별 인구통계 분석
- `find_k_culture_influencers` - K-컬처 관심 해외 인플루언서
- `analyze_lifestage_segments` - 생애주기별 세그먼트 분석
- `analyze_beauty_persona_segments` - 뷰티 페르소나 분석

**콘텐츠 분석 (5개)**
- `analyze_engagement_metrics` - 참여도 통계 분석
- `compare_content_formats` - 피드 vs 릴스 성과 비교
- `find_optimal_posting_time` - 최적 포스팅 시간대 분석
- `analyze_viral_content_patterns` - 바이럴 콘텐츠 패턴 분석
- `analyze_beauty_content_performance` - 뷰티 콘텐츠 유형별 성과

**멀티 플랫폼/링크 (5개)**
- `search_multiplatform_influencers` - 멀티 플랫폼 인플루언서 검색
- `find_influencers_with_shopping_links` - 쇼핑 링크 보유 인플루언서
- `find_contactable_influencers` - 연락 가능 인플루언서 검색
- `analyze_platform_distribution` - 플랫폼 분포 분석
- `compare_platform_presence` - 브랜드별 플랫폼 현황 비교

### 데이터 테이블 요약

| 테이블 | 주요 용도 |
|--------|----------|
| `insta_general_profiles` | 인구통계, 관심사, 협업이력 기반 필터링 |
| `insta_beauty_profiles` | 뷰티 특화 분석 (피부/메이크업/헤어) |
| `insta_user_links_v3` | 멀티 플랫폼, 쇼핑링크, 연락처 정보 |
| `insta_media_mmm_v3` | 피드 게시물 해시태그/참여도 분석 |
| `insta_reels_mmm_v3` | 릴스 해시태그/조회수 분석 |
| `insta_profile_mmm_v3` | 팔로워 수, 계정 기본 정보 |

---

**END OF DOCUMENT**
