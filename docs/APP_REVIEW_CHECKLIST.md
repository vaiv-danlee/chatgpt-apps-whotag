# WHOTAG Apps 검수 체크리스트

**검수일**: 2026-01-05
**앱 이름**: Influencer Search (WHOTAG)
**버전**: 1.0.0

---

## 검수 결과 요약

| 영역 | 상태 | 주요 사항 |
|------|------|----------|
| MCP 서버 구성 | ✅ 통과 | protocolVersion 2025-11-25 적용 완료 |
| Tool 정의 | ✅ 통과 | 25개 Tool에 Annotation 추가 완료 |
| Resource 정의 | ✅ 통과 | 올바르게 구성됨 |
| 인증/개인정보 | ⚠️ 확인 필요 | Privacy Policy URL 필요 |
| UI 컴포넌트 | ⚠️ 권장 수정 | 100vh 사용 지양 권장 |
| 상거래/수익화 | ✅ 통과 | 금지 항목 없음 |

---

## 1. MCP 서버 구성

### 1.1 필수 엔드포인트

| 엔드포인트 | 상태 | 비고 |
|-----------|------|------|
| `GET /mcp` | ✅ 구현됨 | Discovery document 반환 |
| `POST /mcp` | ✅ 구현됨 | JSON-RPC 핸들러 |
| `GET /mcp/sse` | ✅ 구현됨 | SSE 연결 |
| `POST /mcp/message` | ✅ 구현됨 | SSE 메시지 라우팅 |

### 1.2 프로토콜 버전

| 항목 | 현재 값 | 상태 |
|------|---------|------|
| protocolVersion | `2025-11-25` | ✅ 최신 버전 적용 완료 |

**파일 위치**: `server/src/index.ts`

### 1.3 세션 관리

- ✅ `transports` 객체로 세션 관리 구현
- ✅ `sessions` 객체로 호스트 타입별 세션 정보 관리
- ✅ ChatGPT/표준 호스트 타입 자동 감지

### 1.4 CORS 설정

```typescript
origin: ["https://chatgpt.com", "https://chat.openai.com"]
```
✅ ChatGPT 도메인에 대해 올바르게 설정됨

---

## 2. Tool 정의 및 Annotation

### 2.1 등록된 도구 목록 (25개)

| 카테고리 | 도구 수 | 도구명 |
|----------|---------|--------|
| 인플루언서 검색 | 3 | `search_influencers`, `search_influencers_bigquery`, `search_by_brand_collaboration` |
| 트렌드 분석 | 4 | `analyze_hashtag_trends_bigquery`, `detect_emerging_hashtags`, `compare_regional_hashtags`, `analyze_beauty_ingredient_trends` |
| 브랜드 분석 | 4 | `analyze_brand_mentions`, `find_brand_collaborators`, `analyze_sponsored_content_performance`, `compare_competitor_brands` |
| 시장 인사이트 | 4 | `analyze_market_demographics`, `find_k_culture_influencers`, `analyze_lifestage_segments`, `analyze_beauty_persona_segments` |
| 콘텐츠 분석 | 5 | `analyze_engagement_metrics`, `compare_content_formats`, `find_optimal_posting_time`, `analyze_viral_content_patterns`, `analyze_beauty_content_performance` |
| 멀티 플랫폼 | 5 | `search_multiplatform_influencers`, `find_influencers_with_shopping_links`, `find_contactable_influencers`, `analyze_platform_distribution`, `compare_platform_presence` |

### 2.2 Tool Annotation 검토 ✅ 적용 완료

**현재 상태**: 모든 25개 Tool에 `readOnlyHint`, `openWorldHint`, `destructiveHint` annotation이 **적용 완료**되었습니다.

**적용된 Annotation 설정**:

| Annotation | 설정값 | 근거 |
|------------|--------|------|
| `readOnlyHint` | `true` | 모든 도구가 데이터 조회/분석만 수행, 외부 데이터 변경 없음 |
| `openWorldHint` | `true` | whotag.ai API 및 BigQuery와 상호작용 |
| `destructiveHint` | `false` | 되돌릴 수 없는 파괴적 작업 없음 |

**적용 예시** (`server/src/index.ts`):

```typescript
server.registerTool(
  "search_influencers",
  {
    title: "Search Influencers",
    description: SEARCH_TOOL_DESCRIPTION,
    inputSchema: { /* ... */ },
    annotations: {
      readOnlyHint: true,
      openWorldHint: true,
      destructiveHint: false,
    },
    _meta: {
      "openai/outputTemplate": "ui://widget/carousel.html",
      // ...
    },
  },
  async (args) => { /* ... */ }
);
```

### 2.3 도구별 Annotation 권장 설정

| 도구명 | readOnlyHint | openWorldHint | destructiveHint | 비고 |
|--------|-------------|---------------|-----------------|------|
| `search_influencers` | `true` | `true` | `false` | whotag.ai API 호출 |
| `search_influencers_bigquery` | `true` | `true` | `false` | BigQuery 조회 |
| `search_by_brand_collaboration` | `true` | `true` | `false` | BigQuery 조회 |
| `analyze_hashtag_trends_bigquery` | `true` | `true` | `false` | BigQuery 조회 |
| `detect_emerging_hashtags` | `true` | `true` | `false` | BigQuery 조회 |
| `compare_regional_hashtags` | `true` | `true` | `false` | BigQuery 조회 |
| `analyze_beauty_ingredient_trends` | `true` | `true` | `false` | BigQuery 조회 |
| `analyze_brand_mentions` | `true` | `true` | `false` | BigQuery 조회 |
| `find_brand_collaborators` | `true` | `true` | `false` | BigQuery 조회 |
| `analyze_sponsored_content_performance` | `true` | `true` | `false` | BigQuery 조회 |
| `compare_competitor_brands` | `true` | `true` | `false` | BigQuery 조회 |
| `analyze_market_demographics` | `true` | `true` | `false` | BigQuery 조회 |
| `find_k_culture_influencers` | `true` | `true` | `false` | BigQuery 조회 |
| `analyze_lifestage_segments` | `true` | `true` | `false` | BigQuery 조회 |
| `analyze_beauty_persona_segments` | `true` | `true` | `false` | BigQuery 조회 |
| `analyze_engagement_metrics` | `true` | `true` | `false` | BigQuery 조회 |
| `compare_content_formats` | `true` | `true` | `false` | BigQuery 조회 |
| `find_optimal_posting_time` | `true` | `true` | `false` | BigQuery 조회 |
| `analyze_viral_content_patterns` | `true` | `true` | `false` | BigQuery 조회 |
| `analyze_beauty_content_performance` | `true` | `true` | `false` | BigQuery 조회 |
| `search_multiplatform_influencers` | `true` | `true` | `false` | BigQuery 조회 |
| `find_influencers_with_shopping_links` | `true` | `true` | `false` | BigQuery 조회 |
| `find_contactable_influencers` | `true` | `true` | `false` | BigQuery 조회 |
| `analyze_platform_distribution` | `true` | `true` | `false` | BigQuery 조회 |
| `compare_platform_presence` | `true` | `true` | `false` | BigQuery 조회 |

---

## 3. Resource 정의

### 3.1 등록된 리소스

| URI | MIME Type | 상태 |
|-----|-----------|------|
| `ui://widget/carousel.html` | `text/html+skybridge` | ✅ 올바름 |
| `ui://instructions/tool-guidelines.txt` | `text/plain` | ✅ 올바름 |

### 3.2 Widget Metadata

```typescript
_meta: {
  "openai/widgetDescription": "Displays influencer profiles in carousel format",
  "openai/widgetPrefersBorder": true,
  "openai/widgetDomain": "https://whotag.ai",
  "openai/widgetCSP": {
    connect_domains: ["https://dev.whotag.ai", "https://cdn.whotag.ai"],
    resource_domains: ["https://cdn.whotag.ai", "https://*.oaistatic.com"],
  },
}
```

✅ 모든 필수 메타데이터가 올바르게 설정됨

---

## 4. 인증 및 개인정보

### 4.1 인증 방식

| 항목 | 상태 | 비고 |
|------|------|------|
| 사용자 인증 | ✅ 불필요 | 서버 측에서 API 인증 처리 |
| API 키 노출 | ✅ 안전 | 환경변수로 관리 (`.env` 파일) |
| 별도 회원가입 | ✅ 불필요 | 앱 사용에 별도 가입 불필요 |

### 4.2 개인정보 수집

| 수집 데이터 | 해당 여부 | 비고 |
|------------|----------|------|
| PCI DSS 결제정보 | ❌ 없음 | - |
| PHI 건강정보 | ❌ 없음 | - |
| 정부 발급 ID | ❌ 없음 | - |
| API 키/비밀번호 | ❌ 없음 | 서버 측에서만 관리 |

### 4.3 제출 시 필요 사항 ⚠️

| 항목 | 상태 | 조치 필요 |
|------|------|----------|
| Privacy Policy URL | ⚠️ 미확인 | 제출 전 URL 준비 필요 |
| 테스트 계정 | ⚠️ 미확인 | 검수자용 테스트 계정 정보 준비 |

**Privacy Policy 필수 포함 항목**:
- [ ] 수집하는 개인정보 항목
- [ ] 사용 목적
- [ ] 공유 대상
- [ ] 사용자 제어 옵션

---

## 5. UI 컴포넌트

### 5.1 기술 스택

- React + TypeScript
- Vite 빌드
- CSS (별도 styles.css)

### 5.2 레이아웃 검토

| 항목 | 상태 | 위치 | 권장 조치 |
|------|------|------|----------|
| `100vh` 사용 | ⚠️ 발견됨 | `styles.css:386, 494, 1099` | `maxHeight: "800px"` 권장 |
| Null-safe 접근 | ✅ 올바름 | `App.tsx:17` | `toolResponseMetadata?.allProfiles \|\| []` |
| window.openai API | ✅ 올바름 | `App.tsx:35, 48, 127` | 올바르게 사용됨 |

**100vh 사용 위치**:
```css
/* styles.css:386 */
min-height: 100vh;

/* styles.css:494 */
max-height: calc(100vh - 200px);

/* styles.css:1099 */
max-height: calc(100vh - 160px);
```

**권장 수정**: ChatGPT 위젯에서는 `100vh` 대신 고정 값 사용 권장
```css
/* 권장 */
max-height: 800px;
overflow-y: auto;
```

### 5.3 window.openai API 사용

| 메서드 | 사용 여부 | 위치 |
|--------|----------|------|
| `toolOutput` | ✅ 사용 | `useOpenAiGlobal("toolOutput")` |
| `toolResponseMetadata` | ✅ 사용 | `useOpenAiGlobal("toolResponseMetadata")` |
| `requestDisplayMode` | ✅ 사용 | 풀스크린 전환 |
| `openExternal` | ✅ 사용 | whotag.ai 링크 열기 |

---

## 6. 상거래 및 수익화

| 항목 | 상태 |
|------|------|
| 물리적 상품 판매 | ❌ 없음 |
| 디지털 제품/서비스 | ❌ 없음 |
| 구독 모델 | ❌ 없음 |
| Freemium 업셀 | ❌ 없음 |
| 광고 게재 | ❌ 없음 |

✅ 금지된 상거래 항목 없음

---

## 7. 조치 필요 항목 요약

### 필수 수정 (검수 거절 가능성)

1. **Tool Annotation 추가** ✅ 완료
   - 모든 25개 Tool에 `annotations` 객체 추가 완료
   - `readOnlyHint: true`, `openWorldHint: true`, `destructiveHint: false` 설정 완료
   - **파일**: `server/src/index.ts`

### 권장 수정

2. **protocolVersion 업데이트** ✅ 완료
   - `2025-03-26` → `2025-11-25` 업데이트 완료
   - **파일**: `server/src/index.ts`

3. **CSS 100vh 제거** ⚠️
   - `min-height: 100vh` → `min-height: auto` 또는 고정값
   - `max-height: calc(100vh - 200px)` → `max-height: 800px`
   - **파일**: `web/src/styles.css:386, 494, 1099`

### 제출 전 준비

4. **Privacy Policy URL 준비** ⚠️
5. **테스트 계정 정보 문서화** ⚠️

---

## 8. 제출 전 최종 체크리스트

### 기본 요건
- [ ] 앱 이름, 설명이 정확하고 명확함
- [ ] ChatGPT 기본 기능으로 대체 불가능한 고유 기능 제공 ✅
- [ ] 안정적으로 동작 (충돌, 지연, 오류 없음)

### Tool 정의
- [x] 모든 Tool 이름이 명확하고 기능을 정확히 반영 ✅
- [x] `readOnlyHint`, `openWorldHint`, `destructiveHint` annotation 설정 ✅ 완료
- [x] 각 annotation에 대한 근거 문서화 ✅

### 인증
- [ ] 테스트 계정 (ID/PW) 제공 준비
- [ ] 테스트 계정에 샘플 데이터 포함

### 개인정보
- [ ] Privacy Policy URL 준비
- [ ] 금지 데이터 수집하지 않음 ✅

### UI
- [ ] `100vh` 대신 고정 maxHeight 사용 ⚠️ 권장 수정
- [ ] Null-safe 데이터 접근 ✅

---

**문서 작성**: Claude Code
**검토 기준**: ChatGPT Apps SDK Submission Guidelines (2025)
