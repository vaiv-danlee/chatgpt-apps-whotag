# 콘텐츠 분석 도구 개발 로그

## 개요

| 항목 | 내용 |
|------|------|
| 카테고리 | 콘텐츠 성과 분석 |
| 도구 수 | 5개 (BigQuery 직접 구현) |
| 시작일 | 2024-12-22 |
| 완료일 | 2024-12-22 |
| 상태 | ✅ 완료 |

## 도구 목록

### 1. `analyze_engagement_metrics` ✅

**설명**: 참여도 통계 분석

**데이터 소스**:
- `mmm-lab.sns.insta_media_mmm_v3` (피드 포스트)
- `mmm-lab.sns.insta_reels_mmm_v3` (릴스)
- `mmm-lab.gpt_profile.insta_general_profiles` (인플루언서 필터)

**파라미터**:
| 파라미터 | 타입 | 설명 | 기본값 |
|----------|------|------|--------|
| country | Array[String] | 국가 필터 | - |
| interests | Array[String] | 관심사 필터 | - |
| collaboration_tier | Array[String] | 협업 등급 필터 | - |
| period_days | Integer | 분석 기간 (일) | 30 |
| content_type | String | 콘텐츠 유형 | "all" |

**출력**:
- avg_likes: 평균 좋아요
- median_likes: 좋아요 중앙값
- avg_comments: 평균 댓글
- median_comments: 댓글 중앙값
- avg_engagement_rate: 평균 참여율
- p90_likes: 상위 10% 좋아요 기준값

**SQL 패턴 (예상)**:
```sql
WITH all_content AS (
  SELECT DISTINCT media_id, user_id, like_count, comment_count, ...
  FROM (
    SELECT ... FROM `mmm-lab.sns.insta_media_mmm_v3` m
    UNION ALL
    SELECT ... FROM `mmm-lab.sns.insta_reels_mmm_v3` r
  )
),
filtered_content AS (
  SELECT c.*, g.country, g.interests
  FROM all_content c
  JOIN `mmm-lab.gpt_profile.insta_general_profiles` g ON c.user_id = g.user_id
  WHERE ...
)
SELECT
  AVG(like_count) as avg_likes,
  APPROX_QUANTILES(like_count, 100)[OFFSET(50)] as median_likes,
  AVG(comment_count) as avg_comments,
  APPROX_QUANTILES(comment_count, 100)[OFFSET(90)] as p90_likes,
  ...
FROM filtered_content
```

---

### 2. `compare_content_formats` ✅

**설명**: 피드 vs 릴스 성과 비교

**데이터 소스**:
- `mmm-lab.sns.insta_media_mmm_v3` (피드: is_video=FALSE)
- `mmm-lab.sns.insta_reels_mmm_v3` (릴스)
- `mmm-lab.gpt_profile.insta_general_profiles` (인플루언서 필터)

**파라미터**:
| 파라미터 | 타입 | 설명 | 기본값 |
|----------|------|------|--------|
| country | Array[String] | 국가 필터 | - |
| interests | Array[String] | 관심사 필터 | - |
| period_days | Integer | 분석 기간 (일) | 90 |

**출력**:
- content_type: feed / reels
- content_count: 콘텐츠 수
- avg_likes: 평균 좋아요
- avg_comments: 평균 댓글
- avg_engagement_rate: 평균 참여율
- avg_views: 평균 조회수 (릴스만)

**핵심 로직**:
- 피드: `insta_media_mmm_v3` WHERE `is_video = FALSE`
- 릴스: `insta_reels_mmm_v3` (또는 media WHERE `is_video = TRUE`)
- media_id 중복 제거 (DISTINCT)

---

### 3. `find_optimal_posting_time` ✅

**설명**: 최적 포스팅 시간대 분석

**데이터 소스**:
- `mmm-lab.sns.insta_media_mmm_v3` (publish_date)
- `mmm-lab.sns.insta_reels_mmm_v3` (publish_date)
- `mmm-lab.gpt_profile.insta_general_profiles` (인플루언서 필터)

**파라미터**:
| 파라미터 | 타입 | 설명 | 기본값 |
|----------|------|------|--------|
| country | Array[String] | 국가 필터 | - |
| interests | Array[String] | 관심사 필터 | - |
| period_days | Integer | 분석 기간 (일) | 90 |

**출력**:
- day_of_week: 요일 (0=일, 1=월, ..., 6=토)
- hour: 시간 (0-23)
- post_count: 게시물 수
- avg_engagement_rate: 평균 참여율
- avg_likes: 평균 좋아요

**SQL 패턴 (예상)**:
```sql
SELECT
  EXTRACT(DAYOFWEEK FROM publish_date) as day_of_week,
  EXTRACT(HOUR FROM publish_date) as hour,
  COUNT(DISTINCT media_id) as post_count,
  AVG((like_count + comment_count) / NULLIF(follower_count, 0)) as avg_engagement_rate
FROM ...
GROUP BY day_of_week, hour
ORDER BY avg_engagement_rate DESC
```

---

### 4. `analyze_viral_content_patterns` ✅

**설명**: 바이럴 콘텐츠 패턴 분석

**데이터 소스**:
- `mmm-lab.sns.insta_media_mmm_v3` (고참여 필터)
- `mmm-lab.sns.insta_reels_mmm_v3` (고참여 필터)
- `mmm-lab.gpt_profile.insta_general_profiles` (인플루언서 필터)

**파라미터**:
| 파라미터 | 타입 | 설명 | 기본값 |
|----------|------|------|--------|
| country | Array[String] | 국가 필터 | - |
| interests | Array[String] | 관심사 필터 | - |
| viral_threshold | Integer | 바이럴 기준 좋아요 수 | 100000 |
| period_days | Integer | 분석 기간 (일) | 180 |

**출력**:
- viral_content_count: 바이럴 콘텐츠 수
- content_type_distribution: 콘텐츠 유형 분포 (feed/reels)
- top_hashtags: 상위 해시태그
- avg_caption_length: 평균 캡션 길이
- day_of_week_distribution: 요일별 분포

**핵심 로직**:
- `like_count >= viral_threshold` 필터
- 해시태그 빈도 분석 (UNNEST)
- 콘텐츠 유형별 통계

---

### 5. `analyze_beauty_content_performance` ✅

**설명**: 뷰티 콘텐츠 유형별 성과 분석

**데이터 소스**:
- `mmm-lab.sns.insta_media_mmm_v3` (콘텐츠)
- `mmm-lab.sns.insta_reels_mmm_v3` (콘텐츠)
- `mmm-lab.gpt_profile.insta_beauty_profiles` (beauty_content_types)

**파라미터**:
| 파라미터 | 타입 | 설명 | 기본값 |
|----------|------|------|--------|
| country | Array[String] | 국가 필터 | - |
| beauty_content_types | Array[String] | 뷰티 콘텐츠 유형 | - |
| period_days | Integer | 분석 기간 (일) | 90 |

**Beauty Content Types**:
- Makeup Tutorial
- Product Review
- Skincare Routine
- GRWM (Get Ready With Me)
- Unboxing
- Before After
- Haul
- Look Recreation

**출력**:
- beauty_content_type: 뷰티 콘텐츠 유형
- influencer_count: 해당 유형 인플루언서 수
- avg_engagement_rate: 평균 참여율
- avg_likes: 평균 좋아요
- avg_comments: 평균 댓글

**핵심 로직**:
- `insta_beauty_profiles.beauty_content_types` 배열 필드 활용
- 인플루언서별 주력 콘텐츠 유형 기반 분석

---

## 공통 SQL 패턴

### media_id 중복 제거 (media + reels UNION)

```sql
WITH all_content AS (
  SELECT DISTINCT media_id, user_id, like_count, comment_count, publish_date,
         hashtags, caption, is_paid_partnership, 'media' as source
  FROM (
    SELECT
      m.media_id,
      m.user_id,
      m.like_count,
      m.comment_count,
      m.publish_date,
      m.hashtags,
      m.caption,
      m.is_paid_partnership
    FROM `mmm-lab.sns.insta_media_mmm_v3` m
    WHERE m.publish_date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @period_days DAY)

    UNION ALL

    SELECT
      r.media_id,
      r.user_id,
      r.like_count,
      r.comment_count,
      r.publish_date,
      r.hashtags,
      r.caption,
      r.is_paid_partnership
    FROM `mmm-lab.sns.insta_reels_mmm_v3` r
    WHERE r.publish_date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL @period_days DAY)
  )
)
```

### 참여율 계산

```sql
-- 참여율 = (좋아요 + 댓글) / 팔로워 수 * 100
ROUND((like_count + comment_count) * 100.0 / NULLIF(p.followed_by, 0), 2) as engagement_rate
```

### 백분위수 계산

```sql
-- 중앙값 (50th percentile)
APPROX_QUANTILES(like_count, 100)[OFFSET(50)] as median_likes,
-- 상위 10% (90th percentile)
APPROX_QUANTILES(like_count, 100)[OFFSET(90)] as p90_likes
```

---

## 개발 일지

### 2024-12-22

**계획**:
1. `content-analysis.ts` 모듈 신규 생성
2. 5개 도구 순차 구현
3. media_id 중복 제거 패턴 적용 (media + reels UNION)
4. MCP 서버 등록 및 테스트
5. 개발 로그 업데이트

**구현 파일**:
- `server/src/api/content-analysis.ts` (신규)
- `server/src/index.ts` (도구 등록 추가)

**이슈 및 해결**:
1. `uploadCSV` 함수 임포트 오류 → `gcs.js`에서 임포트하도록 수정
2. `publish_date`가 TIMESTAMP 타입이라 DATE_SUB 사용 불가 → TIMESTAMP_SUB로 변경

---

## 테스트 결과

### 1. `analyze_engagement_metrics`
- **조건**: country=KR, interests=Beauty, period_days=30
- **결과**: 263,599건 콘텐츠, 평균 참여율 2.67%, 평균 좋아요 3,116

### 2. `compare_content_formats`
- **조건**: country=KR, interests=Beauty, period_days=90
- **결과**:
  - Reels: 평균 참여율 4.19%, 평균 좋아요 5,012
  - Feed: 평균 참여율 1.52%, 평균 좋아요 1,586
  - 릴스가 피드보다 약 2.75배 높은 참여율

### 3. `find_optimal_posting_time`
- **조건**: country=KR, interests=Beauty, period_days=90
- **결과**: 50개 시간대 분석, 요일/시간별 평균 참여율 및 게시물 수 제공

### 4. `analyze_viral_content_patterns`
- **조건**: country=KR, viral_threshold=10000, period_days=180
- **결과**: 12,249건 바이럴 콘텐츠, 상위 해시태그: #fyp, #korea, #reels

### 5. `analyze_beauty_content_performance`
- **조건**: country=KR, period_days=90
- **결과**: 100+ 뷰티 콘텐츠 유형 분석
  - GRWM: 평균 참여율 5.08%
  - Makeup Tutorial: 평균 참여율 3.60%

---

## 참고 사항

### 데이터 스키마

**insta_media_mmm_v3**:
- media_id, user_id, like_count, comment_count
- publish_date, hashtags (ARRAY), caption
- is_video, is_paid_partnership

**insta_reels_mmm_v3**:
- media_id, user_id, like_count, comment_count
- publish_date, hashtags (ARRAY), caption
- video_view_count, is_paid_partnership

**insta_profile_mmm_v3**:
- user_id, username, followed_by (팔로워 수)

### 성과 기준

- 평균 참여율: 3-5% (양호), 5%+ (우수)
- 바이럴 기준: 좋아요 10만+ (글로벌), 1만+ (한국 마이크로)
