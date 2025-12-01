# 인플루언서 검색 ChatGPT App

ChatGPT Apps SDK를 사용하여 구현한 자연어 인플루언서 검색 앱입니다. whotag.ai API와 연동하여 인플루언서를 검색하고 캐러셀 형태로 결과를 표시합니다.

**MCP 호환**: ChatGPT 외에도 Claude Desktop, Cursor 등 표준 MCP 클라이언트에서도 사용할 수 있습니다.

## 주요 기능

### 인플루언서 검색 (`search_influencers`)
- **자연어 검색**: "대한민국의 육아 인플루언서" 같은 자연어로 검색
- **ChatGPT**: 캐러셀 UI로 프로필 카드 표시 (3명씩 슬라이드)
- **표준 MCP 클라이언트**: 마크다운 형식으로 상세 정보 제공
- **전체화면 뷰어**: 이미지 클릭 시 전체화면으로 확대 보기 (ChatGPT)
- **상세 정보**: 팔로워 수, 참여율, 협업 이력, 관심사 등 표시
- **whotag.ai 연동**: 각 프로필에서 whotag.ai로 이동 가능

### BigQuery 분석 도구 (`analyze_hashtag_trends`, `analyze_content_stats`)
- **해시태그 트렌드 분석**: 특정 조건의 인플루언서들이 사용하는 해시태그 트렌드 분석
- **콘텐츠 통계 분석**: 인플루언서 그룹의 콘텐츠 참여율 및 통계 분석
- **다양한 필터**: 국가(ISO 코드), 관심사, 성별, 연령대, 민족 카테고리 등으로 필터링
- **CSV 다운로드**: 분석 결과를 CSV 파일로 다운로드 (Signed URL, 24시간 유효)

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
├── cloudbuild.yaml           # Cloud Build 설정 (프로덕션)
├── cloudbuild-dev.yaml       # Cloud Build 설정 (개발)
├── Dockerfile                # Docker 이미지 빌드
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

### 5. Claude Desktop / Cursor 연결 (표준 MCP)

`claude_desktop_config.json` 또는 Cursor MCP 설정에 추가:

```json
{
  "mcpServers": {
    "whotag": {
      "url": "http://localhost:3000/mcp/sse"
    }
  }
}
```

표준 MCP 클라이언트에서는 UI 위젯 대신 마크다운 형식으로 결과가 표시됩니다.

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

서버는 MCP (Model Context Protocol) SDK를 사용하여 ChatGPT와 표준 MCP 클라이언트에 도구와 리소스를 노출합니다:

- **Resource**: `ui://widget/carousel.html` - CSP 설정이 포함된 React 컴포넌트 (ChatGPT 전용)
- **Tool**: `search_influencers` - 인플루언서 검색 기능
- **Tool**: `analyze_hashtag_trends` - 해시태그 트렌드 분석
- **Tool**: `analyze_content_stats` - 콘텐츠 참여 통계 분석

MCP 서버는 SSE (Server-Sent Events)를 사용한 양방향 통신:
- `GET /mcp/sse` - SSE 연결 수립
- `POST /mcp/message` - 세션 ID를 통한 클라이언트 메시지 처리

### Host Type 감지

서버는 클라이언트 유형을 자동으로 감지하여 적절한 응답 형식을 반환합니다:

| 클라이언트 | 감지 방법 | 응답 형식 |
|-----------|----------|----------|
| ChatGPT | User-Agent에 `openai-mcp` 포함 또는 Origin이 `chatgpt.com` | UI 위젯 + structuredContent |
| Claude, Cursor 등 | 그 외 모든 클라이언트 | 마크다운 텍스트 |

**ChatGPT 응답 예시:**
```json
{
  "structuredContent": { "summary": {...}, "influencers": [...] },
  "content": [{ "type": "text", "text": "Found 50 influencers..." }],
  "_meta": { "openai/outputTemplate": "ui://widget/carousel.html", ... }
}
```

**표준 MCP 응답 예시:**
```json
{
  "content": [{ "type": "text", "text": "## Influencer Search Results\n..." }]
}
```

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

## Cloud Run 배포

### 사전 준비

1. **GCP 프로젝트 설정**
   ```bash
   gcloud config set project mmm-lab
   ```

2. **필요한 API 활성화**
   ```bash
   gcloud services enable cloudbuild.googleapis.com
   gcloud services enable run.googleapis.com
   gcloud services enable artifactregistry.googleapis.com
   gcloud services enable secretmanager.googleapis.com
   ```

3. **Artifact Registry 저장소 생성** (없는 경우)
   ```bash
   gcloud artifacts repositories create cloud-run-source-deploy \
     --repository-format=docker \
     --location=asia-northeast3 \
     --description="Cloud Run deployment images"
   ```

4. **Secret Manager에 환경변수 등록**
   ```bash
   # whotag API 인증 정보
   echo -n "your_whotag_username" | gcloud secrets create whotag-username --data-file=-
   echo -n "your_whotag_password" | gcloud secrets create whotag-password --data-file=-

   # OpenAI API Key (BigQuery SQL 생성용)
   echo -n "your_openai_api_key" | gcloud secrets create openai-api-key --data-file=-

   # Cloud Run 서비스 계정에 Secret 접근 권한 부여
   PROJECT_NUMBER=$(gcloud projects describe mmm-lab --format='value(projectNumber)')

   for SECRET in whotag-username whotag-password openai-api-key; do
     gcloud secrets add-iam-policy-binding $SECRET \
       --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
       --role="roles/secretmanager.secretAccessor"
   done
   ```

5. **BigQuery 권한 설정** (분석 도구 사용 시)
   ```bash
   # Cloud Run 기본 서비스 계정에 BigQuery 권한 부여
   PROJECT_NUMBER=$(gcloud projects describe mmm-lab --format='value(projectNumber)')

   gcloud projects add-iam-policy-binding mmm-lab \
     --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
     --role="roles/bigquery.dataViewer"

   gcloud projects add-iam-policy-binding mmm-lab \
     --member="serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com" \
     --role="roles/bigquery.jobUser"
   ```

6. **GCS 버킷 권한 설정** (CSV 다운로드용)
   ```bash
   PROJECT_NUMBER=$(gcloud projects describe mmm-lab --format='value(projectNumber)')

   gsutil iam ch \
     serviceAccount:${PROJECT_NUMBER}-compute@developer.gserviceaccount.com:objectAdmin \
     gs://chatgpt-apps
   ```

### GitHub 연동 자동 배포

프로덕션과 개발 환경을 위한 두 가지 Cloud Build 설정이 있습니다:

| 환경 | 설정 파일 | 브랜치 | 서비스 이름 |
|-----|----------|--------|------------|
| 프로덕션 | `cloudbuild.yaml` | `main` | `whotag-chatgpt-app` |
| 개발 | `cloudbuild-dev.yaml` | `develop` | `whotag-chatgpt-app-dev` |

1. **Cloud Build 트리거 생성**
   - GCP Console → Cloud Build → 트리거 → 트리거 만들기
   - 저장소: GitHub 저장소 연결
   - 브랜치: `^main$` (프로덕션) 또는 `^develop$` (개발)
   - 구성: 해당 `cloudbuild*.yaml` 선택

2. **또는 CLI로 트리거 생성**
   ```bash
   # 프로덕션 트리거
   gcloud builds triggers create github \
     --name="whotag-chatgpt-app-deploy" \
     --repo-name="chatgpt-apps-whotag" \
     --repo-owner="your-github-username" \
     --branch-pattern="^main$" \
     --build-config="cloudbuild.yaml"

   # 개발 트리거
   gcloud builds triggers create github \
     --name="whotag-chatgpt-app-deploy-dev" \
     --repo-name="chatgpt-apps-whotag" \
     --repo-owner="your-github-username" \
     --branch-pattern="^develop$" \
     --build-config="cloudbuild-dev.yaml"
   ```

### 수동 배포

```bash
# 프로덕션 배포
gcloud builds submit --config=cloudbuild.yaml

# 개발 환경 배포
gcloud builds submit --config=cloudbuild-dev.yaml

# 또는 Cloud Run 소스 배포 (Dockerfile 사용)
gcloud run deploy whotag-chatgpt-app \
  --source . \
  --region asia-northeast3 \
  --allow-unauthenticated
```

### 배포 후 설정

1. **배포된 URL 확인**
   ```bash
   # 프로덕션
   gcloud run services describe whotag-chatgpt-app \
     --region asia-northeast3 \
     --format='value(status.url)'

   # 개발
   gcloud run services describe whotag-chatgpt-app-dev \
     --region asia-northeast3 \
     --format='value(status.url)'
   ```

2. **ChatGPT Actions 업데이트**
   - Schema URL을 Cloud Run URL로 변경: `https://whotag-chatgpt-app-xxxxx.asia-northeast3.run.app/mcp`

3. **표준 MCP 클라이언트 연결**
   - Claude Desktop이나 Cursor에서 배포된 URL 사용:
   ```json
   {
     "mcpServers": {
       "whotag": {
         "url": "https://whotag-chatgpt-app-xxxxx.asia-northeast3.run.app/mcp/sse"
       }
     }
   }
   ```

## 주의사항

- `.env` 파일은 절대 커밋하지 마세요
- API 인증 정보 및 GCP 서비스 계정 키는 안전하게 관리하세요
- 프로덕션 배포 시 HTTPS 필수
- ESM Only: server와 web 모두 `"type": "module"` 사용
- BigQuery 분석 도구 사용 시 GCP 프로젝트 및 권한 설정 필요
- 표준 MCP 클라이언트는 UI 위젯을 지원하지 않으므로 마크다운 응답만 제공됨

## 추가 문서

- [BigQuery 분석 도구 상세 문서](./docs/BIGQUERY_ANALYTICS.md) - 분석 도구 파라미터 및 사용 예시
- [BigQuery 스키마](./docs/bigquery_schema.yaml) - 테이블 구조 정의

## 라이선스

MIT License
