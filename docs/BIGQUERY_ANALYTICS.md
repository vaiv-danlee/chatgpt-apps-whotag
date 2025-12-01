# BigQuery Analytics Tools

ChatGPT Apps에서 사용할 수 있는 BigQuery 기반 인플루언서 분석 도구입니다.

## 개요

이 도구들은 자연어 질의를 BigQuery SQL로 변환하여 인플루언서 데이터를 분석합니다.

```
[사용자 질의] → [GPT Tool 호출] → [OpenAI SQL 생성] → [BigQuery 실행] → [GCS 저장] → [결과 반환]
```

## 사용 가능한 도구

### 1. `analyze_hashtag_trends`

특정 조건의 인플루언서들이 사용하는 해시태그 트렌드를 분석합니다.

**파라미터:**

| 파라미터 | 타입 | 필수 | 설명 | 예시 |
|---------|------|------|------|------|
| `country` | string | 선택 | ISO 3166-1 Alpha-2 국가 코드 | `"VN"`, `"KR"`, `"US"` |
| `interests` | string[] | 선택 | 관심사 카테고리 | `["Beauty", "Fashion & Style"]` |
| `days` | number | 선택 | 분석 기간 (기본: 30, 최대: 365) | `30`, `60`, `90` |
| `limit` | number | 선택 | 반환할 해시태그 수 (기본: 100) | `50`, `100` |
| `gender` | string | 선택 | 성별 필터 | `"Male"`, `"Female"`, `"Unknown"` |
| `age_range` | string | 선택 | 연령대 필터 | `"20~24"`, `"25~29"`, `"30~34"` |
| `ethnic_category` | string | 선택 | 민족 카테고리 필터 | `"Asian"`, `"Caucasian"`, `"Southeast Asian"` |

**예시 질의:**
- "베트남 뷰티 인플루언서들의 최근 해시태그 트렌드를 알고싶어"
- "한국 패션 인플루언서들이 많이 쓰는 해시태그는?"
- "일본 푸드 인플루언서들의 최근 3개월 해시태그 분석해줘"
- "20대 여성 뷰티 인플루언서들의 해시태그 트렌드"

**응답 예시:**
```json
{
  "structuredContent": {
    "analysis": {
      "type": "hashtag_trends",
      "description": "베트남 뷰티 인플루언서들의 해시태그 트렌드 분석",
      "totalHashtags": 100
    },
    "data": [
      {"hashtag": "#makeup", "usage_count": 1255, "avg_engagement": 312.25},
      {"hashtag": "#kbeauty", "usage_count": 1182, "avg_engagement": 73.55},
      {"hashtag": "#skincare", "usage_count": 957, "avg_engagement": 150.46}
    ],
    "downloadUrl": "https://storage.googleapis.com/chatgpt-apps/..."
  }
}
```

---

### 2. `analyze_content_stats`

인플루언서 그룹의 콘텐츠 참여 통계를 분석합니다.

**파라미터:**

| 파라미터 | 타입 | 필수 | 설명 | 예시 |
|---------|------|------|------|------|
| `country` | string | 선택 | ISO 3166-1 Alpha-2 국가 코드 | `"KR"`, `"TH"` |
| `interests` | string[] | 선택 | 관심사 카테고리 | `["Fitness", "Wellness"]` |
| `days` | number | 선택 | 분석 기간 (기본: 30, 최대: 365) | `30`, `60` |
| `gender` | string | 선택 | 성별 필터 | `"Male"`, `"Female"`, `"Unknown"` |
| `age_range` | string | 선택 | 연령대 필터 | `"20~24"`, `"25~29"`, `"30~34"` |
| `ethnic_category` | string | 선택 | 민족 카테고리 필터 | `"Asian"`, `"Caucasian"`, `"Southeast Asian"` |

**예시 질의:**
- "한국 패션 인플루언서들의 평균 참여율이 궁금해"
- "태국 뷰티 인플루언서들의 콘텐츠 통계를 보여줘"
- "인도네시아 푸드 인플루언서들의 평균 좋아요 수는?"
- "30대 남성 피트니스 인플루언서들의 참여율 분석"

**응답 예시:**
```json
{
  "structuredContent": {
    "analysis": {
      "type": "content_stats",
      "description": "한국 패션 인플루언서들의 콘텐츠 통계"
    },
    "data": [
      {
        "influencer_count": 1523,
        "total_posts": 45678,
        "avg_likes": 2345.67,
        "avg_comments": 123.45
      }
    ],
    "downloadUrl": "https://storage.googleapis.com/chatgpt-apps/..."
  }
}
```

---

### 3. `find_trending_topics`

특정 분야에서 급상승 중인 트렌딩 토픽을 찾습니다.

**파라미터:**

| 파라미터 | 타입 | 필수 | 설명 | 예시 |
|---------|------|------|------|------|
| `field` | string | 선택 | 분석할 분야 (기본: Beauty) | `"Beauty"`, `"Fashion & Style"` |
| `days` | number | 선택 | 분석 기간 (기본: 30, 최대: 365) | `30`, `14`, `7` |
| `limit` | number | 선택 | 반환할 토픽 수 (기본: 50) | `20`, `50` |
| `gender` | string | 선택 | 성별 필터 | `"Male"`, `"Female"`, `"Unknown"` |
| `age_range` | string | 선택 | 연령대 필터 | `"20~24"`, `"25~29"`, `"30~34"` |
| `ethnic_category` | string | 선택 | 민족 카테고리 필터 | `"Asian"`, `"Caucasian"`, `"Southeast Asian"` |

**예시 질의:**
- "뷰티 분야에서 최근 핫한 주제가 뭐야?"
- "패션 업계에서 급상승 중인 트렌드를 알려줘"
- "피트니스 분야의 최근 1주일 트렌딩 토픽"
- "20대 여성 인플루언서들 사이에서 뜨는 뷰티 트렌드"

---

## 지원되는 국가 코드

ISO 3166-1 Alpha-2 형식의 모든 국가 코드를 사용할 수 있습니다.

**자주 사용되는 예시:**

| 코드 | 국가 |
|------|------|
| `KR` | 한국 |
| `US` | 미국 |
| `VN` | 베트남 |
| `JP` | 일본 |
| `TH` | 태국 |
| `ID` | 인도네시아 |
| `PH` | 필리핀 |
| `BR` | 브라질 |
| `CN` | 중국 |
| `TW` | 대만 |
| `SG` | 싱가포르 |
| `MY` | 말레이시아 |
| ... | 기타 모든 ISO 3166-1 Alpha-2 국가 코드 |

---

## 인구통계 필터 (공통 파라미터)

모든 분석 도구에서 사용할 수 있는 선택적 인구통계 필터입니다. **값이 제공되지 않으면 해당 조건은 쿼리에서 제외됩니다.**

### `gender` (성별)

| 값 | 설명 |
|----|------|
| `Male` | 남성 |
| `Female` | 여성 |
| `Unknown` | 알 수 없음 |

### `age_range` (연령대)

5년 단위 연령대:
```
0~4, 5~9, 10~14, 15~19, 20~24, 25~29, 30~34, 35~39,
40~44, 45~49, 50~54, 55~59, 60~64, 65~69, 70+, Unknown
```

### `ethnic_category` (민족 카테고리)

| 값 | 설명 |
|----|------|
| `Asian` | 아시아인 (일반) |
| `East Asian` | 동아시아인 |
| `Southeast Asian` | 동남아시아인 |
| `South Asian` | 남아시아인 |
| `Caucasian` | 백인 |
| `African` | 아프리카인 |
| `Hispanic/Latino` | 히스패닉/라틴계 |
| `Middle Eastern/North African (MENA)` | 중동/북아프리카 |
| `Pacific Islander` | 태평양 섬 주민 |
| `Indigenous Peoples` | 원주민 |
| `Mixed Race` | 혼혈 |
| `Unknown` | 알 수 없음 |

---

## 지원되는 관심사 카테고리

```
Fashion & Style, Accessories & Jewelry, Beauty, Hair Care, Food Culture,
Meals, Beverages, Alcoholic Beverages, Snacks & Desserts, Travel & Leisure,
Relationships & Emotions, Fitness, Ball Sports, Outdoor Sports, Indoor Sports,
Sports Events, Wellness, Healthcare, Child Care & Parenting, Pets,
Household Management, Interior & Decor, Photography, Visual Arts,
Performing Arts, Music, Literature & Writing, Media & Entertainment,
New Media, Crafts, Fan Culture, Games, Personal Development, Academic Studies,
Student Life, Business & Marketing, Startups & Small Business, Personal Finance,
Automotive, Technology & Innovation, Consumer Electronics, Values & Human Rights,
Environment & Sustainability, Community Engagement, Religion & Politics,
Shopping & Deals
```

---

## 데이터 소스

### 테이블 구조

| 테이블 | 용도 |
|--------|------|
| `mmm-lab.gpt_profile.insta_general_profiles` | 인플루언서 프로필 (AI 분석 결과) |
| `mmm-lab.sns.insta_media_mmm_v3` | 인스타그램 피드 게시물 |
| `mmm-lab.sns.insta_reels_mmm_v3` | 인스타그램 릴스 |
| `mmm-lab.sns.insta_profile_mmm_v3` | 기본 프로필 정보 |

### 해시태그 분석 원리

1. `insta_general_profiles`에서 조건에 맞는 인플루언서 필터링
2. 해당 인플루언서들의 `insta_media_mmm_v3` + `insta_reels_mmm_v3` 게시물 조회
3. `hashtags` 배열에서 해시태그 추출 및 집계
4. 사용 빈도 및 평균 참여율 계산

---

## 결과 다운로드

모든 분석 결과는 GCS에 CSV 파일로 저장되며, 24시간 유효한 다운로드 URL이 제공됩니다.

**CSV 파일 위치:**
- `gs://chatgpt-apps/hashtag-trends/` - 해시태그 트렌드 분석
- `gs://chatgpt-apps/content-stats/` - 콘텐츠 통계 분석
- `gs://chatgpt-apps/trending-topics/` - 트렌딩 토픽 분석

---

## 아키텍처

```
┌─────────────────────────────────────────────────────────────────┐
│                        ChatGPT Apps                              │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                     MCP Server (Express)                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │
│  │ tools/call  │  │ tools/list  │  │ resources/read          │  │
│  └─────────────┘  └─────────────┘  └─────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      Analytics Module                            │
│  ┌───────────────────┐  ┌───────────────────┐                   │
│  │ analyzeHashtag    │  │ analyzeContent    │                   │
│  │ Trends()          │  │ Stats()           │                   │
│  └───────────────────┘  └───────────────────┘                   │
│  ┌───────────────────┐                                          │
│  │ findTrending      │                                          │
│  │ Topics()          │                                          │
│  └───────────────────┘                                          │
└─────────────────────────────────────────────────────────────────┘
                              │
            ┌─────────────────┼─────────────────┐
            ▼                 ▼                 ▼
┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐
│  OpenAI API     │  │   BigQuery      │  │      GCS        │
│  (SQL 생성)      │  │  (쿼리 실행)    │  │  (CSV 저장)      │
└─────────────────┘  └─────────────────┘  └─────────────────┘
```

---

## 환경 설정

### 필수 환경 변수 (`.env`)

```bash
# OpenAI API Key (SQL 생성용)
OPENAI_API_KEY=sk-...

# GCS 버킷 이름
GCS_BUCKET=chatgpt-apps
```

### GCP 서비스 계정

`mmm-lab-8dae8dbd9a6f.json` 파일이 프로젝트 루트에 있어야 합니다.

필요한 권한:
- BigQuery Data Viewer
- BigQuery Job User
- Storage Object Admin (for GCS)

---

## 개발 및 테스트

### 로컬 테스트

```bash
# 서버 실행
cd server
pnpm run dev

# 도구 목록 확인
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list"}'

# 해시태그 트렌드 분석 테스트
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc":"2.0",
    "id":2,
    "method":"tools/call",
    "params":{
      "name":"analyze_hashtag_trends",
      "arguments":{
        "country":"VN",
        "interests":["Beauty"],
        "days":30,
        "limit":20
      }
    }
  }'
```

---

## 제한 사항

1. **쿼리 실행 시간**: 복잡한 쿼리는 최대 2분까지 소요될 수 있음
2. **결과 크기**: GPT에 전달되는 데이터는 상위 50개로 제한 (전체 데이터는 CSV 다운로드)
3. **다운로드 URL 유효기간**: 24시간
4. **BigQuery 쿼리**: SELECT 문만 허용 (INSERT, UPDATE, DELETE 차단)
5. **조회 기간**: 최대 365일(1년)까지만 조회 가능 (BigQuery 스캔량 최적화)

---

## 파일 구조

```
server/src/
├── api/
│   ├── analytics.ts      # 분석 함수들 (3개 도구의 핸들러)
│   ├── bigquery.ts       # BigQuery 클라이언트
│   ├── gcs.ts            # GCS 업로드
│   └── query-generator.ts # OpenAI 기반 SQL 생성
└── index.ts              # MCP 서버 및 도구 등록

docs/
├── bigquery_schema.yaml  # LLM이 참조하는 스키마 문서
├── BIGQUERY_ANALYTICS.md # 이 문서
└── queries/              # SQL 템플릿 파일
    ├── hashtag_trends.sql   # 해시태그 트렌드 분석 쿼리 템플릿
    ├── content_stats.sql    # 콘텐츠 통계 분석 쿼리 템플릿
    └── trending_topics.sql  # 트렌딩 토픽 분석 쿼리 템플릿
```

---

## SQL 템플릿

각 도구는 `docs/queries/` 디렉토리의 SQL 템플릿을 참조하여 쿼리를 생성합니다.

### 템플릿 사용 방식

1. OpenAI GPT가 사용자 요청을 분석
2. 해당 도구의 SQL 템플릿을 참조
3. 파라미터(`{{country}}`, `{{interests}}`, `{{days}}` 등)를 실제 값으로 치환
4. 최적화된 BigQuery SQL 생성

### 스캔 최적화

모든 템플릿에는 다음 최적화가 적용되어 있습니다:

```sql
-- publish_date 조건을 먼저 적용하여 스캔량 감소
WHERE m.publish_date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL {{days}} DAY)
  AND m.publish_date >= TIMESTAMP_SUB(CURRENT_TIMESTAMP(), INTERVAL 365 DAY)  -- Max 1 year limit
  AND m.user_id IN (SELECT user_id FROM filtered_influencers)
```
