# BigQuery 스캔량 및 비용 분석

**문서 버전**: 1.0
**작성일**: 2024-12-22
**비용 기준**: $7.5 / TB (on-demand pricing)

---

## 1. 테이블 정보

### 1.1 테이블 크기 및 파티셔닝

| 테이블 | 크기 (GB) | 행 수 | 파티션 | 클러스터 |
|--------|-----------|-------|--------|----------|
| `insta_general_profiles` | 2.67 | 413K | - | `user_id` |
| `insta_beauty_profiles` | 0.77 | 440K | - | `user_id` |
| `insta_profile_mmm_v3` | 12.05 | 14.3M | - | `user_id` |
| `insta_media_mmm_v3` | **844.5** | 613M | `publish_date` (MONTH) | `media_id` |
| `insta_reels_mmm_v3` | **294.0** | 115M | `publish_date` (MONTH) | `media_id` |
| `insta_user_links_v3` | 0.56 | 6M | - | `channel`, `user_id` |

> **핵심**: `insta_media_mmm_v3`(844GB)와 `insta_reels_mmm_v3`(294GB)는 **월별 파티셔닝**되어 있어, 기간 조건(`publish_date`)을 사용하면 스캔량이 대폭 감소합니다.

---

## 2. 도구별 스캔량 및 비용

### 2.1 비용 등급 분류

| 등급 | 스캔량 | 호출당 비용 | 색상 |
|------|--------|-------------|------|
| 🟢 **Light** | < 500 MB | < $0.004 | 저비용 |
| 🟡 **Medium** | 500 MB ~ 5 GB | $0.004 ~ $0.04 | 중간 |
| 🟠 **Heavy** | 5 GB ~ 20 GB | $0.04 ~ $0.15 | 주의 |
| 🔴 **Very Heavy** | > 20 GB | > $0.15 | 고비용 |

---

### 2.2 인플루언서 검색 (3개)

| 도구 | 접근 테이블 | 스캔량 | 비용/호출 | 등급 |
|------|-------------|--------|-----------|------|
| `search_influencers` | (whotag API) | 0 | $0 | - |
| `search_influencers_bigquery` | general + profile | ~285 MB | ~$0.002 | 🟢 |
| `search_influencers_bigquery` (뷰티) | + beauty | ~300 MB | ~$0.002 | 🟢 |
| `search_by_brand_collaboration` | general + profile | ~285 MB | ~$0.002 | 🟢 |

---

### 2.3 트렌드 분석 (4개)

| 도구 | 기간 | 접근 테이블 | 스캔량 | 비용/호출 | 등급 |
|------|------|-------------|--------|-----------|------|
| `analyze_hashtag_trends` | 30일 (media만) | general + media | ~4.4 GB | ~$0.033 | 🟡 |
| `analyze_hashtag_trends` | 30일 (all) | + reels | ~6.7 GB | ~$0.050 | 🟠 |
| `analyze_hashtag_trends` | 90일 (all) | + reels | **~19.4 GB** | **~$0.145** | 🟠 |
| `detect_emerging_hashtags` | 2x period | media + reels | ~13-40 GB | $0.10~$0.30 | 🟠🔴 |
| `compare_regional_hashtags` | 30일 x N국가 | media + reels | ~7 GB x N | $0.05 x N | 🟠 |
| `analyze_beauty_ingredient_trends` | 90일 | general + beauty | ~24 MB | ~$0.0002 | 🟢 |

> ⚠️ **트렌드 분석 도구는 기간(period_days)에 따라 비용이 크게 변동합니다.**

---

### 2.4 브랜드 분석 (4개)

| 도구 | 기간 | 접근 테이블 | 스캔량 | 비용/호출 | 등급 |
|------|------|-------------|--------|-----------|------|
| `analyze_brand_mentions` | 90일 | general + media + reels | ~20 GB | ~$0.15 | 🟠 |
| `find_brand_collaborators` | - | general + profile | ~285 MB | ~$0.002 | 🟢 |
| `analyze_sponsored_content_performance` | 90일 | general + media + reels | ~20 GB | ~$0.15 | 🟠 |
| `compare_competitor_brands` | 90일 | general + profile + media + reels | ~4.4 GB per brand | ~$0.033 x N | 🟡🟠 |

---

### 2.5 시장 인사이트 (4개)

| 도구 | 접근 테이블 | 스캔량 | 비용/호출 | 등급 |
|------|-------------|--------|-----------|------|
| `analyze_market_demographics` | general + profile | ~285 MB | ~$0.002 | 🟢 |
| `find_k_culture_influencers` | general + profile | ~285 MB | ~$0.002 | 🟢 |
| `analyze_lifestage_segments` | general + profile | ~285 MB | ~$0.002 | 🟢 |
| `analyze_beauty_persona_segments` | general + beauty + profile | ~300 MB | ~$0.002 | 🟢 |

---

### 2.6 콘텐츠 분석 (5개)

| 도구 | 기간 | 접근 테이블 | 스캔량 | 비용/호출 | 등급 |
|------|------|-------------|--------|-----------|------|
| `analyze_engagement_metrics` | 30일 | general + profile + media | ~1.6 GB | ~$0.012 | 🟡 |
| `analyze_engagement_metrics` | 30일 (all) | + reels | ~2.5 GB | ~$0.019 | 🟡 |
| `compare_content_formats` | 90일 | general + profile + media + reels | ~20 GB | ~$0.15 | 🟠 |
| `find_optimal_posting_time` | 90일 | general + profile + media + reels | ~20 GB | ~$0.15 | 🟠 |
| `analyze_viral_content_patterns` | 180일 | general + media + reels | **~32 GB** | **~$0.24** | 🔴 |
| `analyze_beauty_content_performance` | 90일 | general + beauty + profile + media + reels | ~20 GB | ~$0.15 | 🟠 |

---

### 2.7 멀티 플랫폼/링크 분석 (5개)

| 도구 | 접근 테이블 | 스캔량 | 비용/호출 | 등급 |
|------|-------------|--------|-----------|------|
| `search_multiplatform_influencers` | general + profile + links | ~163 MB | ~$0.001 | 🟢 |
| `find_influencers_with_shopping_links` | general + profile + links | ~163 MB | ~$0.001 | 🟢 |
| `find_contactable_influencers` | general + profile + links | ~163 MB | ~$0.001 | 🟢 |
| `analyze_platform_distribution` | general + links | ~163 MB | ~$0.001 | 🟢 |
| `compare_platform_presence` | general + links | ~163 MB | ~$0.001 | 🟢 |

---

## 3. 비용 요약

### 3.1 도구 카테고리별 평균 비용

| 카테고리 | 도구 수 | 평균 스캔량 | 평균 비용/호출 | 주요 비용 요인 |
|----------|--------|-------------|----------------|----------------|
| 인플루언서 검색 | 3 | ~285 MB | ~$0.002 | - |
| 트렌드 분석 | 4 | ~7-20 GB | ~$0.05-$0.15 | `period_days`, 콘텐츠 테이블 |
| 브랜드 분석 | 4 | ~5-20 GB | ~$0.04-$0.15 | `period_days`, 콘텐츠 테이블 |
| 시장 인사이트 | 4 | ~285 MB | ~$0.002 | - |
| 콘텐츠 분석 | 5 | ~2-32 GB | ~$0.02-$0.24 | `period_days`, `viral_threshold` |
| 멀티 플랫폼 | 5 | ~163 MB | ~$0.001 | - |

### 3.2 고비용 도구 TOP 5

| 순위 | 도구 | 최대 스캔량 | 최대 비용/호출 |
|------|------|-------------|----------------|
| 1 | `analyze_viral_content_patterns` (180일) | ~32 GB | ~$0.24 |
| 2 | `detect_emerging_hashtags` (3개월 비교) | ~40 GB | ~$0.30 |
| 3 | `compare_content_formats` (90일) | ~20 GB | ~$0.15 |
| 4 | `analyze_sponsored_content_performance` (90일) | ~20 GB | ~$0.15 |
| 5 | `analyze_hashtag_trends` (90일, all) | ~19 GB | ~$0.15 |

---

## 4. 비용 최적화 권장사항

### 4.1 파티션 활용 (필수)
- `insta_media_mmm_v3`와 `insta_reels_mmm_v3`는 `publish_date` 파티션 필터 **필수**
- 기간을 줄이면 비용이 비례하여 감소 (30일 → 90일 = 3배 비용)

### 4.2 기간 파라미터 권장값

| 사용 목적 | 권장 기간 | 비용 절감 |
|-----------|-----------|-----------|
| 빠른 트렌드 체크 | 14일 | 최대 80% |
| 일반 분석 | 30일 | 기준 |
| 심층 분석 | 90일 | 3배 비용 |
| 장기 패턴 분석 | 180일 | 6배 비용 |

### 4.3 콘텐츠 타입 최적화
- `content_type: "media"` 사용 시 reels 스캔 제외 → ~30% 비용 절감
- 릴스만 분석할 경우 `content_type: "reels"` 사용

### 4.4 저비용 대안 활용
- **멀티 플랫폼 분석**: `insta_user_links_v3` 테이블만 사용 → 매우 저렴
- **인플루언서 검색**: 프로필 테이블만 사용 → 저렴
- **뷰티 성분 트렌드**: `beauty_profiles`만 사용 → 저렴

---

## 5. 월간 비용 시뮬레이션

### 시나리오: 중간 사용량 (일 50회 호출)

| 도구 유형 | 일 호출 | 호출당 비용 | 일 비용 | 월 비용 |
|-----------|--------|-------------|---------|---------|
| 인플루언서 검색 | 20회 | $0.002 | $0.04 | $1.2 |
| 시장 인사이트 | 10회 | $0.002 | $0.02 | $0.6 |
| 멀티 플랫폼 | 10회 | $0.001 | $0.01 | $0.3 |
| 트렌드 분석 (30일) | 5회 | $0.05 | $0.25 | $7.5 |
| 콘텐츠 분석 (30일) | 3회 | $0.05 | $0.15 | $4.5 |
| 브랜드 분석 (90일) | 2회 | $0.15 | $0.30 | $9.0 |
| **합계** | **50회** | - | **$0.77** | **~$23** |

### 시나리오: 고사용량 (일 200회 호출)

| 도구 유형 | 일 호출 | 호출당 비용 | 월 비용 |
|-----------|--------|-------------|---------|
| 인플루언서 검색 | 100회 | $0.002 | $6 |
| 시장/멀티플랫폼 | 50회 | $0.002 | $3 |
| 트렌드/콘텐츠 (30일) | 30회 | $0.05 | $45 |
| 고비용 분석 (90일) | 20회 | $0.15 | $90 |
| **합계** | **200회** | - | **~$144** |

---

## 6. 참고: Dry Run 측정 결과

실제 측정한 스캔량 (2024-12-22 기준):

```
search_influencers_bigquery (basic):     ~285 MB
search_influencers_bigquery (+ beauty):  ~300 MB  (+ 15 MB)
analyze_hashtag_trends (media, 30일):    ~4.4 GB
analyze_hashtag_trends (all, 30일):      ~6.7 GB  (+ 2.3 GB for reels)
analyze_hashtag_trends (all, 90일):      ~19.4 GB (x2.9)
analyze_platform_distribution:            ~163 MB
analyze_beauty_ingredient_trends (90일): ~24 MB
compare_competitor_brands (90일):        ~4.4 GB per brand
analyze_engagement_metrics (30일):       ~1.6 GB
analyze_viral_content_patterns (180일):  ~15.3 GB (media only)
```

---

**END OF DOCUMENT**
