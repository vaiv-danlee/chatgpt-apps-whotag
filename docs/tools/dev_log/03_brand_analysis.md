# 브랜드 분석 도구 개발 로그

## 개요

| 항목 | 내용 |
|------|------|
| 카테고리 | 브랜드 분석 |
| 도구 수 | 4개 (BigQuery 직접 구현) |
| 시작일 | 2024-12-22 |
| 완료일 | 2024-12-22 |
| 상태 | ✅ 완료 |

## 도구 목록

### 1. `analyze_brand_mentions` ✅

**설명**: 브랜드 언급량 분석

**데이터 소스**:
- `mmm-lab.sns.insta_media_mmm_v3` (피드 포스트)
- `mmm-lab.sns.insta_reels_mmm_v3` (릴스)
- Caption + hashtags 에서 브랜드명 검색

**파라미터**:
| 파라미터 | 타입 | 설명 | 상태 |
|----------|------|------|------|
| brand_names | Array[String] | 분석할 브랜드명 | ✅ |
| country | Array[String] | 국가 필터 | ✅ |
| interests | Array[String] | 관심사 필터 | ✅ |
| period_days | Integer | 분석 기간 (일) | ✅ |
| limit | Integer | 결과 수 | ✅ |

**출력**:
- brand_name: 브랜드명
- mention_count: 언급 횟수
- unique_influencers: 언급한 인플루언서 수
- sponsored_count: 스폰서 콘텐츠 수
- avg_engagement: 평균 참여도

---

### 2. `find_brand_collaborators` ✅

**설명**: 특정 브랜드와 협업한 인플루언서 탐색

**데이터 소스**:
- `mmm-lab.gpt_profile.insta_general_profiles` (collaborate_brand 필드)
- `mmm-lab.sns.insta_profile_mmm_v3` (username, follower)

**파라미터**:
| 파라미터 | 타입 | 설명 | 상태 |
|----------|------|------|------|
| brand_name | String | 브랜드명 (필수) | ✅ |
| country | Array[String] | 국가 필터 | ✅ |
| collaboration_tier | Array[String] | 협업 등급 필터 | ✅ |
| min_followers | Integer | 최소 팔로워 | ✅ |
| limit | Integer | 결과 수 | ✅ |

**출력**:
- user_id, username: 인플루언서 정보
- follower_count: 팔로워 수
- collaboration_tier: 협업 등급
- collaborate_brands: 협업 브랜드 목록

---

### 3. `analyze_sponsored_content_performance` ✅

**설명**: 스폰서 vs 오가닉 콘텐츠 성과 비교

**데이터 소스**:
- `mmm-lab.sns.insta_media_mmm_v3` (is_paid_partnership)
- `mmm-lab.sns.insta_reels_mmm_v3` (is_paid_partnership)

**파라미터**:
| 파라미터 | 타입 | 설명 | 상태 |
|----------|------|------|------|
| brand_name | String | 브랜드 필터 (선택) | ✅ |
| country | Array[String] | 국가 필터 | ✅ |
| interests | Array[String] | 관심사 필터 | ✅ |
| period_days | Integer | 분석 기간 | ✅ |
| content_type | String | all/media/reels | ✅ |

**출력**:
- content_category: Sponsored / Organic
- content_count: 콘텐츠 수
- unique_influencers: 인플루언서 수
- avg_engagement: 평균 참여도

---

### 4. `compare_competitor_brands` ✅

**설명**: 경쟁 브랜드 인플루언서 마케팅 비교

**데이터 소스**:
- `mmm-lab.gpt_profile.insta_general_profiles` (collaborate_brand)
- `mmm-lab.sns.insta_media_mmm_v3` + `insta_reels_mmm_v3`

**파라미터**:
| 파라미터 | 타입 | 설명 | 상태 |
|----------|------|------|------|
| brands | Array[String] | 비교할 브랜드 (2-5개) | ✅ |
| country | Array[String] | 국가 필터 | ✅ |
| period_days | Integer | 분석 기간 | ✅ |

**출력**:
- brand: 브랜드명
- collaborator_count: 협업 인플루언서 수
- sponsored_posts: 스폰서 콘텐츠 수
- avg_engagement: 평균 참여도
- tier_distribution: 협업 등급 분포

---

## 핵심 SQL 패턴

```sql
-- 브랜드 언급 검색 (caption + hashtags)
WITH all_content AS (
  SELECT DISTINCT media_id, user_id, search_text, like_count, comment_count, is_paid_partnership
  FROM (
    SELECT
      m.media_id,
      CONCAT(COALESCE(m.caption, ''), ' ', ARRAY_TO_STRING(m.hashtags, ' ')) as search_text,
      ...
    FROM `mmm-lab.sns.insta_media_mmm_v3` m
    UNION ALL
    SELECT ... FROM `mmm-lab.sns.insta_reels_mmm_v3` r
  )
),
brand_content AS (
  SELECT *,
    CASE
      WHEN LOWER(search_text) LIKE '%innisfree%' THEN 'Innisfree'
      WHEN LOWER(search_text) LIKE '%laneige%' THEN 'Laneige'
    END as brand_name
  FROM all_content
  WHERE (LOWER(search_text) LIKE '%innisfree%' OR LOWER(search_text) LIKE '%laneige%')
)
SELECT brand_name, COUNT(DISTINCT media_id) as mention_count, ...
FROM brand_content
GROUP BY brand_name
```

```sql
-- 브랜드 협업 인플루언서 검색
SELECT g.user_id, p.username, p.followed_by as follower_count, ...
FROM `mmm-lab.gpt_profile.insta_general_profiles` g
LEFT JOIN `mmm-lab.sns.insta_profile_mmm_v3` p ON g.user_id = p.user_id
WHERE LOWER(ARRAY_TO_STRING(g.collaborate_brand, ',')) LIKE '%innisfree%'
```

---

## 개발 일지

### 2024-12-22

**작업 내용**:
- `brand-analysis.ts` 모듈 신규 생성
- 4개 도구 구현 및 MCP 등록 완료
- 스키마 이슈 수정 (username, followed_by 컬럼명)
- 테스트 통과

**스키마 이슈 수정**:
- `g.username` → `p.username` (profile 테이블에 있음)
- `p.follower` → `p.followed_by` (정확한 컬럼명)
- `g.bio` → `g.short_bio` (정확한 컬럼명)

**테스트 결과**:

1. **브랜드 언급 분석 (Innisfree, Laneige)**:
   - 입력: `{ brand_names: ["Innisfree", "Laneige"], country: ["KR"], interests: ["Beauty"] }`
   - 결과: Laneige 171건, Innisfree 125건

2. **브랜드 협업자 검색 (Innisfree)**:
   - 입력: `{ brand_name: "Innisfree", country: ["KR"] }`
   - 결과: 295명, Top: @ddoyeon2_e (183K), @nayeon07211 (167K)

3. **스폰서 콘텐츠 성과 분석**:
   - 입력: `{ country: ["KR"], interests: ["Beauty"] }`
   - 결과: Organic 260,324건, Sponsored 6,118건 (2.3%)

4. **경쟁 브랜드 비교**:
   - 입력: `{ brands: ["Innisfree", "Laneige"], country: ["KR"] }`
   - 결과: Innisfree 295명, Laneige 144명

**구현 파일**:
- `server/src/api/brand-analysis.ts` (신규)
- `server/src/index.ts` (도구 등록 추가)
