# 트렌드 분석 도구 개발 로그

## 개요

| 항목 | 내용 |
|------|------|
| 카테고리 | 트렌드 분석 |
| 도구 수 | 4개 (BigQuery 직접 구현) |
| 시작일 | 2024-12-22 |
| 완료일 | 2024-12-22 |
| 상태 | ✅ 완료 |

## 도구 목록

### 1. `analyze_hashtag_trends_bigquery` ✅

**설명**: 특정 조건의 인플루언서 그룹에서 인기 해시태그 분석

**데이터 소스**:
- `mmm-lab.sns.insta_media_mmm_v3` (피드 포스트)
- `mmm-lab.sns.insta_reels_mmm_v3` (릴스)
- `mmm-lab.gpt_profile.insta_general_profiles` (인플루언서 필터)

**파라미터**:
| 파라미터 | 타입 | 설명 | 상태 |
|----------|------|------|------|
| country | Array[String] | 국가 필터 | ✅ |
| interests | Array[String] | 관심사 필터 | ✅ |
| period_days | Integer | 분석 기간 (일) | ✅ |
| content_type | String | 콘텐츠 유형 (all/media/reels) | ✅ |
| limit | Integer | 결과 수 | ✅ |

**출력**:
- hashtag: 해시태그명
- usage_count: 사용 횟수
- unique_users: 사용자 수
- avg_engagement: 평균 참여도

---

### 2. `detect_emerging_hashtags` ✅

**설명**: 급성장 중인 해시태그 탐지

**파라미터**:
| 파라미터 | 타입 | 설명 | 상태 |
|----------|------|------|------|
| country | Array[String] | 국가 필터 | ✅ |
| interests | Array[String] | 관심사 필터 | ✅ |
| compare_period | String | 비교 기간 (2weeks/1month/3months) | ✅ |
| min_growth_rate | Float | 최소 성장률 (1.5 = 150%) | ✅ |
| min_current_count | Integer | 최소 현재 사용량 | ✅ |
| limit | Integer | 결과 수 | ✅ |

**출력**:
- hashtag: 해시태그명
- previous_count: 이전 기간 사용량
- current_count: 현재 기간 사용량
- growth_rate: 성장률

---

### 3. `compare_regional_hashtags` ✅

**설명**: 지역별 해시태그 비교 분석

**파라미터**:
| 파라미터 | 타입 | 설명 | 상태 |
|----------|------|------|------|
| countries | Array[String] | 비교할 국가들 (2-5개) | ✅ |
| interests | Array[String] | 관심사 필터 | ✅ |
| period_days | Integer | 분석 기간 | ✅ |
| limit | Integer | 국가별 TOP N | ✅ |

**출력**:
- country: 국가 코드
- hashtag: 해시태그명
- usage_count: 사용 횟수
- rank: 국가별 순위

---

### 4. `analyze_beauty_ingredient_trends` ✅

**설명**: 뷰티 성분/아이템 트렌드 분석 (스킨케어 성분, 메이크업 아이템, 헤어케어 아이템)

**데이터 소스**:
- `mmm-lab.gpt_profile.insta_beauty_profiles` (뷰티 분석 데이터)
- `mmm-lab.gpt_profile.insta_general_profiles` (국가 필터)

**파라미터**:
| 파라미터 | 타입 | 설명 | 상태 |
|----------|------|------|------|
| country | Array[String] | 국가 필터 | ✅ |
| category | String | 카테고리 (skincare/makeup/haircare) | ✅ |
| period_days | Integer | 분석 기간 (일) | ✅ |
| limit | Integer | 결과 수 | ✅ |

**카테고리별 분석 필드**:
| 카테고리 | 분석 필드 | 관련 제품 | 관련 고민 |
|----------|-----------|----------|----------|
| skincare | `skincare_ingredients` | `beauty_products` | `skin_concerns` |
| makeup | `makeup_items` | `beauty_products` | `makeup_interests` |
| haircare | `hair_items` | `beauty_products` | `hair_concerns` |

**출력**:
- ingredient: 성분/아이템명
- current_count: 현재 기간 언급 인플루언서 수
- previous_count: 이전 기간 언급 인플루언서 수
- growth_rate: 성장률
- related_products: 관련 제품 (최대 5개)
- related_concerns: 관련 고민 (최대 5개)

---

## 핵심 SQL 패턴

```sql
-- 해시태그 분석 기본 패턴
WITH target_influencers AS (
  SELECT user_id
  FROM `mmm-lab.gpt_profile.insta_general_profiles`
  WHERE 'KR' IN UNNEST(country)
    AND 'Beauty' IN UNNEST(interests)
),
all_hashtags AS (
  SELECT hashtag, like_count, comment_count, publish_date
  FROM `mmm-lab.sns.insta_media_mmm_v3`, UNNEST(hashtags) AS hashtag
  WHERE user_id IN (SELECT user_id FROM target_influencers)
    AND publish_date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
  UNION ALL
  SELECT hashtag, like_count, comment_count, publish_date
  FROM `mmm-lab.sns.insta_reels_mmm_v3`, UNNEST(hashtags) AS hashtag
  WHERE user_id IN (SELECT user_id FROM target_influencers)
    AND publish_date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 30 DAY)
)
SELECT
  LOWER(hashtag) as hashtag,
  COUNT(*) as usage_count,
  COUNT(DISTINCT user_id) as unique_users,
  AVG(like_count + comment_count) as avg_engagement
FROM all_hashtags
GROUP BY 1
ORDER BY 2 DESC
LIMIT 100
```

---

## 개발 일지

### 2024-12-22 (v2 - 데이터 중복 제거)

**이슈**:
- `insta_media_mmm_v3`에도 릴스 데이터 포함 (`is_video=TRUE`)
- `insta_reels_mmm_v3`에만 있는 릴스도 존재
- 두 테이블 UNION 시 중복 발생 가능

**해결**:
- 모든 쿼리에 `DISTINCT media_id, hashtag` 적용
- `content_type="media"`: `is_video=FALSE` 조건으로 피드 포스트만
- `content_type="reels"`: 두 테이블 UNION + 중복 제거
- `content_type="all"`: 두 테이블 UNION + 중복 제거

**수정 파일**:
- `server/src/api/trend-analysis.ts`: 3개 함수 모두 수정
  - `buildHashtagTrendQuery()`
  - `buildEmergingHashtagQuery()`
  - `buildRegionalHashtagQuery()`

**테스트 결과**:
- 3개 도구 모두 정상 동작 확인
- Top hashtags: #협찬, #광고, #제품제공 (KR Beauty)

---

### 2024-12-22 (v1 - 초기 구현)

**작업 내용**:
- 개발 로그 생성
- `trend-analysis.ts` 모듈 신규 생성 (BigQuery 직접 SQL)
- 3개 도구 구현 및 MCP 등록 완료
- 테스트 통과

**테스트 결과**:

1. **해시태그 트렌드 분석 (한국 뷰티)**:
   - 입력: `{ country: ["KR"], interests: ["Beauty"], period_days: 30, limit: 10 }`
   - 결과: 성공
   - Top 3: #협찬 (49,654), #광고 (35,426), #제품제공 (12,777)

2. **급성장 해시태그 탐지 (한국 뷰티)**:
   - 입력: `{ country: ["KR"], interests: ["Beauty"], compare_period: "1month", min_growth_rate: 1.5 }`
   - 결과: 성공
   - Top 3: #올영어워즈 (NEW), #올리브영어워즈 (NEW), #장벽회복보습크림 (54,000%)

3. **지역별 해시태그 비교 (KR vs JP)**:
   - 입력: `{ countries: ["KR", "JP"], interests: ["Beauty"], period_days: 30, limit: 5 }`
   - 결과: 성공
   - KR: #협찬, #광고, #제품제공...
   - JP: #pr, #韓国コスメ, #qoo10...

**구현 파일**:
- `server/src/api/trend-analysis.ts` (신규)
- `server/src/index.ts` (도구 등록 추가)

**참고**: 기존 `analyze_hashtag_trends` (GPT 기반)는 유지하고, 새로운 `analyze_hashtag_trends_bigquery` (직접 SQL)를 추가함

---

### 2024-12-22 (v3 - 뷰티 성분 트렌드 추가)

**작업 내용**:
- `analyze_beauty_ingredient_trends` 도구 신규 구현
- `insta_beauty_profiles` 테이블의 성분/아이템 필드 활용
- 카테고리별 분석 지원 (skincare, makeup, haircare)

**구현 특징**:
- 기간을 반으로 나누어 성장률 계산 (이전 기간 vs 현재 기간)
- 관련 제품 및 고민 데이터 조인하여 풍부한 컨텍스트 제공
- 카테고리별 다른 필드 사용 (skincare_ingredients, makeup_items, hair_items)

**수정 파일**:
- `server/src/api/trend-analysis.ts`: `analyzeBeautyIngredientTrends()` 함수 추가
- `server/src/index.ts`: 도구 등록 및 핸들러 추가

**테스트 예정**:
- skincare 카테고리: `{ country: ["KR"], category: "skincare", period_days: 90 }`
- makeup 카테고리: `{ country: ["JP"], category: "makeup", period_days: 60 }`
