# 멀티 플랫폼/링크 분석 도구 개발 로그

## 개요

| 항목 | 내용 |
|------|------|
| 카테고리 | 멀티 플랫폼/링크 분석 |
| 도구 수 | 5개 (BigQuery 직접 구현) |
| 시작일 | 2024-12-22 |
| 완료일 | 2024-12-22 |
| 상태 | ✅ 완료 |

## 데이터 소스

### `insta_user_links_v3` 스키마

| 필드 | 타입 | 설명 |
|------|------|------|
| user_id | STRING | 인스타그램 사용자 ID |
| type | STRING | 링크 타입 (contact, shopping, sns) |
| channel | STRING | 채널명 (youtube, tiktok, amazon, email 등) |
| urls | ARRAY<STRING> | 해당 채널의 URL 목록 |
| updated_at | STRING | 최종 업데이트 시간 |

### 링크 타입 및 채널

| 타입 | 채널 옵션 |
|------|----------|
| **sns** | facebook, instagram, linkedin, snapchat, telegram, tiktok, twitter, whatsapp, youtube |
| **shopping** | amazon, coupang, rakuten, sephora, shopee, shopltk |
| **contact** | blog, email, kakaotalk |

---

## 도구 목록

### 1. `search_multiplatform_influencers` ✅

**설명**: 여러 플랫폼에서 활동하는 인플루언서 검색

**파라미터**:
| 파라미터 | 타입 | 설명 | 기본값 |
|----------|------|------|--------|
| country | Array[String] | 국가 필터 | - |
| interests | Array[String] | 관심사 필터 | - |
| required_channels | Array[String] | 필수 보유 채널 | - |
| optional_channels | Array[String] | 선택적 채널 | - |
| collaboration_tier | Array[String] | 협업 등급 | - |
| limit | Integer | 결과 수 제한 | 100 |

**출력**:
- user_id, username, followed_by
- channels: 보유 채널 목록
- channel_urls: 채널별 URL

**SQL 패턴**:
```sql
WITH influencer_channels AS (
  SELECT
    l.user_id,
    ARRAY_AGG(DISTINCT l.channel) as channels,
    ARRAY_AGG(STRUCT(l.channel, l.urls)) as channel_details
  FROM `mmm-lab.sns.insta_user_links_v3` l
  WHERE l.type = 'sns'
  GROUP BY l.user_id
),
filtered_influencers AS (
  SELECT g.*, ic.channels, ic.channel_details
  FROM `mmm-lab.gpt_profile.insta_general_profiles` g
  JOIN influencer_channels ic ON g.user_id = ic.user_id
  WHERE 'youtube' IN UNNEST(ic.channels)
    AND 'tiktok' IN UNNEST(ic.channels)
    -- 필수 채널 조건
)
SELECT * FROM filtered_influencers
```

---

### 2. `find_influencers_with_shopping_links` ✅

**설명**: 쇼핑/제휴 링크를 보유한 인플루언서 탐색

**파라미터**:
| 파라미터 | 타입 | 설명 | 기본값 |
|----------|------|------|--------|
| country | Array[String] | 국가 필터 | - |
| interests | Array[String] | 관심사 필터 | - |
| shopping_channels | Array[String] | 쇼핑 채널 필터 | - |
| collaboration_tier | Array[String] | 협업 등급 | - |
| limit | Integer | 결과 수 제한 | 100 |

**쇼핑 채널 옵션**:
- amazon: Amazon Associates/Storefront
- shopltk: LTK (LikeToKnow.it)
- sephora: Sephora Squad/Affiliate
- shopee: Shopee Affiliate
- coupang: 쿠팡 파트너스
- rakuten: 라쿠텐 제휴

**출력**:
- user_id, username, followed_by
- shopping_channels: 보유 쇼핑 채널
- shopping_urls: 채널별 URL

---

### 3. `find_contactable_influencers` ✅

**설명**: 연락 가능한 인플루언서 검색

**파라미터**:
| 파라미터 | 타입 | 설명 | 기본값 |
|----------|------|------|--------|
| country | Array[String] | 국가 필터 | - |
| interests | Array[String] | 관심사 필터 | - |
| contact_channels | Array[String] | 연락처 유형 | - |
| collaboration_tier | Array[String] | 협업 등급 | - |
| limit | Integer | 결과 수 제한 | 100 |

**연락처 채널 옵션**:
- email: 이메일 주소
- blog: 블로그 URL
- kakaotalk: 카카오톡 오픈채팅/채널

**출력**:
- user_id, username, followed_by
- contact_channels: 보유 연락처 채널
- contact_info: 채널별 연락처 정보

---

### 4. `analyze_platform_distribution` ✅

**설명**: 인플루언서 그룹 내 플랫폼 분포 분석

**파라미터**:
| 파라미터 | 타입 | 설명 | 기본값 |
|----------|------|------|--------|
| country | Array[String] | 국가 필터 | - |
| interests | Array[String] | 관심사 필터 | - |
| collaboration_tier | Array[String] | 협업 등급 | - |
| link_type | String | 링크 타입 (all/sns/shopping/contact) | "all" |

**출력**:
- channel: 채널명
- influencer_count: 보유 인플루언서 수
- percentage: 비율
- by_country: 국가별 분포 (선택적)

**SQL 패턴**:
```sql
WITH base_influencers AS (
  SELECT g.user_id, g.country
  FROM `mmm-lab.gpt_profile.insta_general_profiles` g
  WHERE g.country IN ('KR', 'JP', 'US')
    AND 'Beauty' IN UNNEST(g.interests)
),
platform_counts AS (
  SELECT
    l.channel,
    COUNT(DISTINCT l.user_id) as influencer_count
  FROM `mmm-lab.sns.insta_user_links_v3` l
  JOIN base_influencers b ON l.user_id = b.user_id
  WHERE l.type = 'sns'  -- or 'shopping' or 'contact'
  GROUP BY l.channel
)
SELECT
  channel,
  influencer_count,
  ROUND(influencer_count * 100.0 / SUM(influencer_count) OVER(), 2) as percentage
FROM platform_counts
ORDER BY influencer_count DESC
```

---

### 5. `compare_platform_presence` ✅

**설명**: 경쟁 브랜드 협업 인플루언서의 플랫폼 보유 현황 비교

**파라미터**:
| 파라미터 | 타입 | 설명 | 기본값 |
|----------|------|------|--------|
| brands | Array[String] | 비교할 브랜드 | - |
| channels | Array[String] | 분석할 채널 | - |

**출력**:
- brand: 브랜드명
- channel: 채널명
- influencer_count: 해당 채널 보유 인플루언서 수
- percentage: 비율

**SQL 패턴**:
```sql
WITH brand_collaborators AS (
  SELECT g.user_id, brand
  FROM `mmm-lab.gpt_profile.insta_general_profiles` g,
  UNNEST(g.collaborate_brand) as brand
  WHERE LOWER(brand) IN ('fwee', 'rom&nd', 'peripera')
),
brand_platform AS (
  SELECT
    bc.brand,
    l.channel,
    COUNT(DISTINCT bc.user_id) as influencer_count
  FROM brand_collaborators bc
  JOIN `mmm-lab.sns.insta_user_links_v3` l ON bc.user_id = l.user_id
  WHERE l.channel IN ('youtube', 'tiktok', 'blog')
  GROUP BY bc.brand, l.channel
)
SELECT * FROM brand_platform
ORDER BY brand, influencer_count DESC
```

---

## 개발 일지

### 2024-12-22

**계획**:
1. `multiplatform.ts` 모듈 신규 생성
2. 5개 도구 순차 구현
3. `insta_user_links_v3` 테이블 JOIN 패턴 적용
4. MCP 서버 등록 및 테스트
5. 개발 로그 업데이트

**구현 파일**:
- `server/src/api/multiplatform.ts` (신규)
- `server/src/index.ts` (도구 등록 추가)

**이슈 및 해결**:
1. `toCSV(result)` - QueryResult 객체 전체를 전달해야 함 (`result.rows` 아님)
2. `uploadCSV` 반환값이 `{ publicUrl }` 객체임
3. `username` 필드는 `insta_profile_mmm_v3`에 있음 (`insta_general_profiles` 아님)

---

## 테스트 결과

### 1. `search_multiplatform_influencers`
- **조건**: country=KR, interests=Beauty, required_channels=[youtube]
- **결과**:
  - somsomi0309 (전소미): 18.7M 팔로워, YouTube 보유
  - yoona__lim (임윤아): 18.7M 팔로워, YouTube 보유

### 2. `find_influencers_with_shopping_links`
- **조건**: country=KR, interests=Beauty
- **결과**: shopee 링크 보유 인플루언서 발견

### 3. `find_contactable_influencers`
- **조건**: country=KR, interests=Beauty, contact_channels=[email]
- **결과**: 이메일 연락처 보유 인플루언서 5명+

### 4. `analyze_platform_distribution`
- **조건**: country=KR, interests=Beauty, link_type=sns
- **결과**:
  - YouTube: 4,807명 (15.14%)
  - Blog: 3,044명 (9.59%)
  - Instagram: 2,405명 (7.58%)
  - TikTok: 2,362명 (7.44%)

### 5. `compare_platform_presence`
- **조건**: brands=[Fwee, Rom&nd], channels=[youtube, tiktok, blog]
- **결과**:
  - Fwee (699명 협업): TikTok 35.62%, YouTube 20.6%
  - Rom&nd (58명 협업): TikTok 18.97%, YouTube 10.34%

---

## 참고 사항

### 테이블 관계

```
insta_general_profiles (g)
    ↓ user_id (1:N)
insta_user_links_v3 (l)
```

### 채널별 주요 시장

| 채널 | 주요 시장 |
|------|----------|
| youtube | Global |
| tiktok | Global, SEA |
| blog | KR |
| coupang | KR |
| rakuten | JP |
| amazon | US, Global |
| shopee | SEA |
| shopltk | US |
