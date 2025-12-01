# 인플루언서 검색 ChatGPT App

ChatGPT Apps SDK를 사용하여 구현한 자연어 인플루언서 검색 앱입니다. whotag.ai API와 연동하여 인플루언서를 검색하고 캐러셀 형태로 결과를 표시합니다.

## 주요 기능

### 인플루언서 검색
- **자연어 검색**: "대한민국의 육아 인플루언서" 같은 자연어로 검색
- **캐러셀 UI**: 3명씩 표시되는 캐러셀 형태의 프로필 카드
- **전체화면 뷰어**: 이미지 클릭 시 전체화면으로 확대 보기
- **상세 정보**: 팔로워 수, 타이틀, 소셜 링크 등 표시
- **whotag.ai 연동**: 각 프로필에서 whotag.ai로 이동 가능

### BigQuery 분석 도구
- **해시태그 트렌드 분석**: 특정 조건의 인플루언서들이 사용하는 해시태그 트렌드 분석
- **콘텐츠 통계 분석**: 인플루언서 그룹의 콘텐츠 참여율 및 통계 분석
- **다양한 필터**: 국가, 관심사, 성별, 연령대, 민족 카테고리 등으로 필터링
- **CSV 다운로드**: 분석 결과를 CSV 파일로 다운로드 가능

## 프로젝트 구조

```
chatgpt-apps-whotag/
├── server/                    # MCP 서버 (TypeScript)
│   ├── src/
│   │   ├── index.ts          # 메인 서버 및 MCP 설정
│   │   ├── api/
│   │   │   ├── auth.ts       # 토큰 인증 관리 (자동 갱신)
│   │   │   ├── influencer.ts # 인플루언서 검색 API 로직
│   │   │   ├── analytics.ts  # BigQuery 분석 도구
│   │   │   ├── bigquery.ts   # BigQuery 클라이언트
│   │   │   ├── gcs.ts        # Google Cloud Storage 연동
│   │   │   └── query-generator.ts # SQL 쿼리 생성기
│   │   └── types.ts          # TypeScript 타입 정의
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example          # 환경변수 템플릿
│
├── web/                       # React UI
│   ├── src/
│   │   ├── main.tsx          # 진입점
│   │   ├── App.tsx           # 메인 컴포넌트
│   │   ├── types.ts          # 프론트엔드 타입 정의
│   │   ├── styles.css        # 스타일
│   │   ├── components/
│   │   │   ├── Carousel.tsx        # 캐러셀 컴포넌트
│   │   │   ├── ProfileCard.tsx     # 프로필 카드 컴포넌트
│   │   │   └── FullscreenViewer.tsx # 전체화면 이미지 뷰어
│   │   └── hooks/
│   │       ├── useOpenAi.ts        # ChatGPT 연동 훅
│   │       └── useMaxHeight.ts     # 높이 계산 훅
│   ├── package.json
│   └── vite.config.ts
│
├── docs/                      # 문서 및 참조 자료
│   ├── BIGQUERY_ANALYTICS.md # BigQuery 분석 도구 상세 문서
│   ├── bigquery_schema.yaml  # BigQuery 테이블 스키마
│   └── queries/              # 예시 SQL 쿼리
│       ├── hashtag_trends.sql
│       ├── content_stats.sql
│       └── trending_topics.sql
│
├── package.json              # 루트 패키지 (워크스페이스 스크립트)
├── CLAUDE.md                 # Claude Code 가이드
└── README.md                 # 이 파일
```

## 시작하기

### 0. pnpm 설치 (없는 경우)

```bash
npm install -g pnpm
```

### 1. 환경 설정

```bash
# .env 파일 생성
cp server/.env.example server/.env
```

`server/.env` 파일에 인증 정보 입력:
```env
WHOTAG_USERNAME=your_username_here
WHOTAG_PASSWORD=your_password_here
PORT=3000

# BigQuery 분석 도구 사용 시 필요 (선택)
GOOGLE_APPLICATION_CREDENTIALS=./your-service-account.json
GCS_BUCKET_NAME=your-bucket-name
```

### 2. 의존성 설치

```bash
pnpm run install:all
```

### 3. 개발 실행

터미널을 2개 열어서 실행:

```bash
# 터미널 1: React 빌드 (먼저 실행)
cd web && pnpm run build

# 터미널 2: 서버 실행 (watch 모드)
cd server && pnpm run dev
```

또는 루트에서:
```bash
pnpm run build:web    # React 빌드
pnpm run dev:server   # 서버 개발 모드
```

### 4. ChatGPT 연결

1. ngrok으로 로컬 서버 노출:
```bash
ngrok http 3000
```

2. ChatGPT Actions 설정:
   - Name: `Influencer Search`
   - Authentication: `None`
   - Schema URL: `https://your-ngrok-url.ngrok.io/mcp`
   - Actions Type: `MCP`

## 테스트

서버 상태 확인:
```bash
pnpm test
# 또는
curl http://localhost:3000/health
```

ChatGPT에서 테스트:

**인플루언서 검색:**
- "대한민국의 육아 인플루언서를 검색해줘"
- "패션 인플루언서 10명 찾아줘"
- "요리 전문 인플루언서 보여줘"

**해시태그 트렌드 분석:**
- "베트남 뷰티 인플루언서들의 해시태그 트렌드를 분석해줘"
- "한국 패션 인플루언서들이 많이 쓰는 해시태그는?"
- "20대 여성 뷰티 인플루언서들의 해시태그 트렌드"

**콘텐츠 통계 분석:**
- "한국 패션 인플루언서들의 평균 참여율이 궁금해"
- "태국 뷰티 인플루언서들의 콘텐츠 통계를 보여줘"

## 스크립트

| 명령어 | 설명 |
|--------|------|
| `pnpm run install:all` | 모든 의존성 설치 (root, server, web) |
| `pnpm run build` | 전체 빌드 (web + server) |
| `pnpm run build:web` | React UI 빌드 |
| `pnpm run build:server` | 서버 빌드 |
| `pnpm run dev:server` | 서버 개발 모드 (watch) |
| `pnpm run dev:web` | 웹 개발 모드 |
| `pnpm start` | 프로덕션 서버 시작 |
| `pnpm test` | 헬스 체크 |

## 기술 스택

- **패키지 매니저**: pnpm
- **서버**: TypeScript, Express, MCP SDK (SSE 기반)
- **UI**: React 18, TypeScript, Vite
- **API**: whotag.ai API
- **분석**: Google BigQuery, Google Cloud Storage

## 아키텍처

### MCP 서버 패턴

서버는 MCP (Model Context Protocol) SDK를 사용하여 ChatGPT에 도구와 리소스를 노출합니다:

- **Resource**: `ui://widget/carousel.html` - CSP 설정이 포함된 React 컴포넌트
- **Tool**: `search_influencers` - 인플루언서 검색 기능
- **Tool**: `analyze_hashtag_trends` - 해시태그 트렌드 분석
- **Tool**: `analyze_content_stats` - 콘텐츠 참여 통계 분석

MCP 서버는 SSE (Server-Sent Events)를 사용한 양방향 통신:
- `GET /mcp/sse` - SSE 연결 수립
- `POST /mcp/message` - 세션 ID를 통한 클라이언트 메시지 처리

### API 통합 흐름

#### 인플루언서 검색 (`search_influencers`)
1. **인증** (`server/src/api/auth.ts`): 토큰 캐싱 및 만료 전 자동 갱신
2. **검색** (`server/src/api/influencer.ts`): 자연어 쿼리 → whotag.ai API
3. **배치 조회**: 반환된 사용자 ID에 대한 상세 프로필 조회
4. **이미지 조회**: 각 프로필의 대표 이미지 병렬 조회
5. **반환**: `structuredContent` (모델용 프로필) + `_meta.allProfiles` (UI용 전체 목록)

#### BigQuery 분석 (`analyze_hashtag_trends`, `analyze_content_stats`)
1. **쿼리 생성** (`server/src/api/query-generator.ts`): 파라미터 기반 SQL 쿼리 생성
2. **BigQuery 실행** (`server/src/api/bigquery.ts`): 쿼리 실행 및 결과 조회
3. **GCS 저장** (`server/src/api/gcs.ts`): 결과를 CSV로 변환하여 Cloud Storage에 저장
4. **반환**: 분석 결과 요약 + CSV 다운로드 URL

### CORS 설정

허용된 도메인:
- `https://chatgpt.com`
- `https://chat.openai.com`

## 주의사항

- `.env` 파일은 절대 커밋하지 마세요
- API 인증 정보 및 GCP 서비스 계정 키는 안전하게 관리하세요
- 프로덕션 배포 시 HTTPS 필수
- ESM Only: server와 web 모두 `"type": "module"` 사용
- BigQuery 분석 도구 사용 시 GCP 프로젝트 및 권한 설정 필요

## 추가 문서

- [BigQuery 분석 도구 상세 문서](./docs/BIGQUERY_ANALYTICS.md) - 분석 도구 파라미터 및 사용 예시
- [BigQuery 스키마](./docs/bigquery_schema.yaml) - 테이블 구조 정의

## 라이선스

MIT License
