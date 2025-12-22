# 인플루언서 검색 도구 개발 로그

## 개요

| 항목 | 내용 |
|------|------|
| 카테고리 | 인플루언서 검색 |
| 도구 수 | 2개 |
| 시작일 | 2024-12-22 |
| 완료일 | 2024-12-22 |
| 상태 | ✅ 완료 |

## 도구 목록

### 1. `search_influencers_bigquery` ✅

**설명**: 일반 + 뷰티 통합 인플루언서 검색

**데이터 소스**:
- `mmm-lab.gpt_profile.insta_general_profiles`
- `mmm-lab.gpt_profile.insta_beauty_profiles`
- `mmm-lab.sns.insta_profile_mmm_v3` (팔로워 수 조회)

**파라미터**:
| 카테고리 | 파라미터 | 타입 | 상태 |
|----------|----------|------|------|
| 공통 | country | Array[String] | ✅ |
| 공통 | gender | String | ✅ |
| 공통 | age_range | Array[String] | ✅ |
| 공통 | interests | Array[String] | ✅ |
| 공통 | collaboration_tier | Array[String] | ✅ |
| 공통 | follower_min | Integer | ✅ |
| 공통 | follower_max | Integer | ✅ |
| 공통 | k_interest | Boolean | ✅ |
| 뷰티 | beauty_interest_areas | Array[String] | ✅ |
| 뷰티 | beauty_content_types | Array[String] | ✅ |
| 뷰티 | skin_type | Array[String] | ✅ |
| 뷰티 | skin_concerns | Array[String] | ✅ |
| 뷰티 | personal_color | String | ✅ |
| 뷰티 | brand_tier_segments | String | ✅ |
| 결과 | limit | Integer | ✅ |

**구현 진행**:
- [x] SQL 템플릿 작성 (`docs/queries/search_influencers.sql`)
- [x] 검색 로직 구현 (`server/src/api/influencer-search.ts`)
- [x] MCP 도구 등록 (`server/src/index.ts`)
- [x] 테스트 완료

**핵심 로직**:
- 뷰티 파라미터 제공 시 → `insta_beauty_profiles` INNER JOIN
- 뷰티 파라미터 없을 시 → `insta_general_profiles`만 조회
- 결과는 팔로워 수 기준 정렬, CSV 다운로드 URL 제공

---

### 2. `search_by_brand_collaboration` ✅

**설명**: 브랜드 협업 이력 기반 검색

**데이터 소스**:
- `mmm-lab.gpt_profile.insta_general_profiles` (collaborate_brand 필드)
- `mmm-lab.sns.insta_profile_mmm_v3` (팔로워 수 조회)

**파라미터**:
| 파라미터 | 타입 | 상태 |
|----------|------|------|
| brand_name | String | ✅ |
| country | Array[String] | ✅ |
| exclude_brand | Array[String] | ✅ |
| collaboration_tier | Array[String] | ✅ |
| follower_min | Integer | ✅ |
| follower_max | Integer | ✅ |
| limit | Integer | ✅ |

**구현 진행**:
- [x] SQL 쿼리 로직 구현 (LOWER() 대소문자 무시)
- [x] 검색 로직 구현 (`server/src/api/influencer-search.ts`)
- [x] MCP 도구 등록 (`server/src/index.ts`)
- [x] 테스트 완료

**핵심 로직**:
- `LOWER()` 함수로 대소문자 무시 브랜드 매칭
- `exclude_brand`도 동일하게 LOWER() 적용
- EXISTS/NOT EXISTS 서브쿼리로 ARRAY 필드 검색

---

## 개발 일지

### 2024-12-22

**작업 내용**:
- 개발 로그 디렉토리 및 문서 생성
- `search_influencers_bigquery` 구현 완료
  - SQL 템플릿 작성 (동적 JOIN 로직)
  - BigQuery 쿼리 실행 로직 구현
  - MCP 도구 등록 (Zod 스키마 + 핸들러)
  - 테스트 통과

**테스트 결과**:

1. **일반 검색 (뷰티 파라미터 없음)**:
   - 입력: `{ country: ["KR"], interests: ["Fashion & Style"], limit: 3 }`
   - 결과: 성공 (lalalalisa_m, 106M 팔로워)
   - SQL: `FROM insta_general_profiles g` (단독 조회)

2. **뷰티 검색 (뷰티 파라미터 포함)**:
   - 입력: `{ country: ["KR"], skin_type: ["Oily"], beauty_interest_areas: ["Skincare"], limit: 3 }`
   - 결과: 성공 (sunnydahye, skin_type: Oily/Combination)
   - SQL: `FROM insta_general_profiles g INNER JOIN insta_beauty_profiles b`

**다음 단계**:
- ~~`search_by_brand_collaboration` 도구 구현~~ ✅ 완료

---

### 2024-12-22 (추가)

**작업 내용**:
- `search_by_brand_collaboration` 구현 완료
  - LOWER() 함수로 대소문자 무시 브랜드 매칭
  - exclude_brand 필드 지원
  - MCP 도구 등록 및 테스트 통과

**테스트 결과**:

1. **브랜드 협업 검색 (Innisfree)**:
   - 입력: `{ brand_name: "Innisfree", country: ["KR"], limit: 5 }`
   - 결과: 성공 (ddoyeon2_e, collaborate_brand: ["Shark", "Innisfree", "Audi", ...])

2. **대소문자 무시 테스트 (innisfree → Innisfree)**:
   - 입력: `{ brand_name: "innisfree", country: ["KR"], limit: 3 }`
   - 결과: 성공 (LOWER() 변환으로 "Innisfree" 매칭됨)

3. **브랜드 제외 테스트 (Nike, Adidas 제외)**:
   - 입력: `{ brand_name: "Nike", exclude_brand: ["Adidas"], limit: 3 }`
   - 결과: 성공 (결과에 Adidas 없음)

**인플루언서 검색 카테고리 완료**: 2개 도구 모두 구현 및 테스트 완료
