# 시장 인사이트 도구 개발 로그

## 개요

| 항목 | 내용 |
|------|------|
| 카테고리 | 시장 인사이트 |
| 도구 수 | 4개 (BigQuery 직접 구현) |
| 시작일 | 2024-12-22 |
| 완료일 | 2024-12-22 |
| 상태 | ✅ 완료 |

## 도구 목록

### 1. `analyze_market_demographics` ✅

**설명**: 시장별 인구통계 분석

**데이터 소스**:
- `mmm-lab.gpt_profile.insta_general_profiles` (인플루언서 프로필)
- `mmm-lab.sns.insta_profile_mmm_v3` (팔로워 수)

**파라미터**:
| 파라미터 | 타입 | 설명 | 상태 |
|----------|------|------|------|
| country | Array[String] | 국가 필터 (필수) | ✅ |
| interests | Array[String] | 관심사 필터 | ✅ |
| group_by | Array[String] | 그룹화 기준 (gender, age_range, collaboration_tier, occupation) | ✅ |

**출력**:
- 그룹화 기준별 인플루언서 수
- avg_followers: 평균 팔로워
- stddev_followers: 팔로워 표준편차

---

### 2. `find_k_culture_influencers` ✅

**설명**: K-컬처 관심 해외 인플루언서 탐색

**데이터 소스**:
- `mmm-lab.gpt_profile.insta_general_profiles` (k_interest 필드)
- `mmm-lab.sns.insta_profile_mmm_v3` (username, follower)

**파라미터**:
| 파라미터 | 타입 | 설명 | 상태 |
|----------|------|------|------|
| country | Array[String] | 국가 필터 (필수, KR 제외 권장) | ✅ |
| interests | Array[String] | 관심사 필터 | ✅ |
| collaboration_tier | Array[String] | 협업 등급 필터 | ✅ |
| min_followers | Integer | 최소 팔로워 | ✅ |
| limit | Integer | 결과 수 | ✅ |

**출력**:
- user_id, username: 인플루언서 정보
- follower_count: 팔로워 수
- k_interest_reason: K-컬처 관심 이유 (GPT 분석 결과)
- country, interests: 국가 및 관심사

---

### 3. `analyze_lifestage_segments` ✅

**설명**: 생애주기별 세그먼트 분석

**데이터 소스**:
- `mmm-lab.gpt_profile.insta_general_profiles` (lifestage 필드)
- `mmm-lab.sns.insta_profile_mmm_v3` (팔로워 수)

**파라미터**:
| 파라미터 | 타입 | 설명 | 상태 |
|----------|------|------|------|
| country | Array[String] | 국가 필터 | ✅ |
| interests | Array[String] | 관심사 필터 | ✅ |
| lifestage | Array[String] | 생애주기 필터 | ✅ |

**Lifestage 값**:
- Single
- Married Without Child
- Married With Infant/Toddler
- Married With Young Children
- Married With Teenager
- Married With Child Over 18
- Single With Child
- Others
- Unknown

**출력**:
- lifestage: 생애주기
- influencer_count: 인플루언서 수
- avg_followers: 평균 팔로워
- ready_tier_count: Ready 등급 인플루언서 수
- ready_tier_pct: Ready 등급 비율 (%)

---

### 4. `analyze_beauty_persona_segments` ✅

**설명**: 뷰티 페르소나 세그먼트 분석

**데이터 소스**:
- `mmm-lab.gpt_profile.insta_general_profiles` (기본 프로필)
- `mmm-lab.gpt_profile.insta_beauty_profiles` (뷰티 프로필)
- `mmm-lab.sns.insta_profile_mmm_v3` (팔로워 수)

**파라미터**:
| 파라미터 | 타입 | 설명 | 상태 |
|----------|------|------|------|
| country | Array[String] | 국가 필터 | ✅ |
| skin_type | Array[String] | 피부 타입 (Oily, Dry, Combination 등) | ✅ |
| skin_concerns | Array[String] | 피부 고민 (Acne, Anti Aging 등) | ✅ |
| personal_color | String | 퍼스널 컬러 (Warm, Cool, Neutral) | ✅ |
| brand_tier_segments | String | 브랜드 선호 등급 | ✅ |
| limit | Integer | 결과 수 | ✅ |

**출력**:
- skin_type: 피부 타입
- personal_color: 퍼스널 컬러
- brand_tier_segments: 브랜드 등급 선호도
- influencer_count: 인플루언서 수
- avg_followers: 평균 팔로워
- ready_tier_count: Ready 등급 수

---

## 핵심 SQL 패턴

```sql
-- 시장 인구통계 분석
SELECT
  g.gender,
  g.age_range,
  COUNT(DISTINCT g.user_id) as influencer_count,
  ROUND(AVG(p.followed_by), 0) as avg_followers
FROM `mmm-lab.gpt_profile.insta_general_profiles` g
LEFT JOIN `mmm-lab.sns.insta_profile_mmm_v3` p ON g.user_id = p.user_id
WHERE ('KR' IN UNNEST(country)) AND ('Beauty' IN UNNEST(interests))
GROUP BY g.gender, g.age_range
```

```sql
-- K-컬처 인플루언서 검색
SELECT g.user_id, p.username, g.k_interest_reason, ...
FROM `mmm-lab.gpt_profile.insta_general_profiles` g
LEFT JOIN `mmm-lab.sns.insta_profile_mmm_v3` p ON g.user_id = p.user_id
WHERE g.k_interest = TRUE AND ('US' IN UNNEST(g.country) OR 'JP' IN UNNEST(g.country))
```

```sql
-- 뷰티 페르소나 세그먼트 (배열 필드 UNNEST)
WITH flattened AS (
  SELECT g.user_id, skin_type_element, b.personal_color, ...
  FROM `mmm-lab.gpt_profile.insta_general_profiles` g
  INNER JOIN `mmm-lab.gpt_profile.insta_beauty_profiles` b ON g.user_id = b.user_id
  CROSS JOIN UNNEST(IFNULL(b.skin_type, ['Unknown'])) as skin_type_element
  WHERE ...
)
SELECT skin_type_element as skin_type, personal_color, ...
FROM flattened
GROUP BY skin_type_element, personal_color
```

---

## 스키마 이슈 수정

**배열 필드 처리**:
- `skin_type`: REPEATED STRING (배열)
- `skin_concerns`: REPEATED STRING (배열)
- 필터링: `'값' IN UNNEST(필드)`
- 그룹화: `CROSS JOIN UNNEST()` 사용

---

## 개발 일지

### 2024-12-22

**작업 내용**:
- `market-insights.ts` 모듈 신규 생성
- 4개 도구 구현 및 MCP 등록 완료
- 배열 필드(skin_type) 처리를 위한 UNNEST 패턴 적용
- 테스트 통과

**테스트 결과**:

1. **시장 인구통계 분석 (KR, Beauty)**:
   - 입력: `{ country: ["KR"], interests: ["Beauty"], group_by: ["gender", "age_range"] }`
   - 결과: 40개 그룹, Top: Female 25~29 (10,544명)

2. **K-컬처 인플루언서 검색 (US, JP)**:
   - 입력: `{ country: ["US", "JP"], interests: ["Beauty"], min_followers: 10000, limit: 10 }`
   - 결과: 10명, Top: @jennierubyjane (88.5M), @dovecameron (47.3M)
   - K-interest reason 포함: "Korean girl vibes" 등

3. **생애주기 세그먼트 분석**:
   - 입력: `{ country: ["KR"], interests: ["Beauty"] }`
   - 결과: 9개 세그먼트, Top: Single (17,985명, 82.8% Ready)

4. **뷰티 페르소나 세그먼트**:
   - 입력: `{ country: ["KR"], skin_type: ["Oily", "Combination"] }`
   - 결과: 50개 조합, Top: Combination/Warm/Mixed (1,657명)

**구현 파일**:
- `server/src/api/market-insights.ts` (신규)
- `server/src/index.ts` (도구 등록 추가)
