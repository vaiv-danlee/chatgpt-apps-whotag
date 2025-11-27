# 인플루언서 검색 ChatGPT App

ChatGPT Apps SDK를 사용하여 구현한 자연어 인플루언서 검색 앱입니다.

## 🎯 주요 기능

- **자연어 검색**: "대한민국의 육아 인플루언서" 같은 자연어로 검색
- **캐러셀 UI**: 3명씩 표시되는 캐러셀 형태의 프로필 카드
- **상세 정보**: 팔로워 수, 타이틀, 소셜 링크 등 표시
- **whotag.ai 연동**: 각 프로필에서 whotag.ai로 이동 가능

## 📦 프로젝트 구조

```
influencer-search-app/
├── server/                # MCP 서버 (TypeScript)
│   ├── src/
│   │   ├── index.ts      # 메인 서버
│   │   ├── api/
│   │   │   ├── auth.ts   # 인증 관리
│   │   │   └── influencer.ts  # API 로직
│   │   └── types.ts      # TypeScript 타입
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example      # 환경변수 템플릿
│
├── web/                  # React UI
│   ├── src/
│   │   ├── main.tsx     # 진입점
│   │   ├── App.tsx      # 메인 컴포넌트
│   │   ├── components/
│   │   │   ├── ProfileCard.tsx
│   │   │   └── Carousel.tsx
│   │   └── styles.css   # 스타일
│   ├── package.json
│   └── vite.config.ts
│
└── package.json         # 루트 패키지
```

## 🚀 시작하기

### 0. pnpm 설치 (없는 경우)

```bash
npm install -g pnpm
```

### 1. 환경 설정

1. `.env` 파일 생성:
```bash
cp server/.env.example server/.env
```

2. `.env` 파일에 인증 정보 입력:
```env
WHOTAG_USERNAME=your_username_here
WHOTAG_PASSWORD=your_password_here
PORT=3000
```

### 2. 의존성 설치

```bash
# 전체 의존성 설치
pnpm run install:all
```

### 3. 개발 실행

터미널을 2개 열어서 실행:

```bash
# 터미널 1: React 빌드
cd web
pnpm run build

# 터미널 2: 서버 실행
cd server
pnpm run dev
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

## 🧪 테스트

서버 상태 확인:
```bash
curl http://localhost:3000/health
```

ChatGPT에서 테스트:
- "대한민국의 육아 인플루언서를 검색해줘"
- "패션 인플루언서 10명 찾아줘"
- "요리 전문 인플루언서 보여줘"

## 📝 스크립트

- `pnpm run install:all` - 모든 의존성 설치
- `pnpm run build` - 전체 빌드
- `pnpm run dev:server` - 서버 개발 모드
- `pnpm run dev:web` - 웹 개발 모드
- `pnpm start` - 프로덕션 서버 시작

## 🔧 기술 스택

- **패키지 매니저**: pnpm
- **서버**: TypeScript, Express, MCP SDK
- **UI**: React, TypeScript, Vite
- **API**: whotag.ai API

## 🔍 로그 관리

### 개발 환경 (Development)

현재 개발 환경에서는 상세한 디버그 로그가 활성화되어 있습니다:

```typescript
// 검색 요청 로그
🔍 NEW SEARCH REQUEST: "한국의 패션 인플루언서"

// API 호출 로그
>>> Calling grid API for user: 12345678
>>> Grid API response: {...}

// 이미지 처리 로그
Representative images count: 3
Grid images count: 1
Grid image URLs: [...]
```

이 로그들은 디버깅과 개발 시 유용합니다.

### 프로덕션 환경 (Production)

프로덕션 배포 시 로그를 제어하는 방법:

#### 방법 1: 환경 변수 사용 (권장)

1. **`.env` 파일 설정**:
```env
NODE_ENV=production  # 프로덕션 모드
LOG_LEVEL=error      # error만 로깅 (debug, info, warn, error 중 선택)
```

2. **코드에서 조건부 로깅**:
```typescript
const isDev = process.env.NODE_ENV !== 'production';

if (isDev) {
  console.error('>>> Debug log');  // 개발 환경에서만 표시
}

console.error('Error occurred');   // 항상 표시
```

#### 방법 2: 로그 레벨 구분

```typescript
// server/src/utils/logger.ts (예시)
const logger = {
  debug: (...args: any[]) => {
    if (process.env.NODE_ENV !== 'production') {
      console.error('[DEBUG]', ...args);
    }
  },
  info: (...args: any[]) => {
    console.error('[INFO]', ...args);
  },
  error: (...args: any[]) => {
    console.error('[ERROR]', ...args);
  }
};

// 사용 예시
logger.debug('>>> Calling API');  // 개발에서만
logger.error('API failed');       // 항상
```

#### 방법 3: 로깅 라이브러리 사용

전문적인 로깅이 필요한 경우:

```bash
pnpm add winston
```

```typescript
import winston from 'winston';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: 'error.log',
      level: 'error'
    })
  ]
});
```

### 로그 출력 위치

현재 `console.error`를 사용하는 이유:
- **stdout**: 일반 출력 (`console.log`)
- **stderr**: 에러 및 디버그 출력 (`console.error`) ✅

프로덕션에서는 stderr를 별도로 수집하여 로그 분석 시스템 (CloudWatch, Datadog 등)으로 전송할 수 있습니다.

### 권장 사항

**개발 중**:
- 현재 상태 유지 (모든 디버그 로그 활성화)

**프로덕션 배포 전**:
- `NODE_ENV=production` 설정
- 중요 에러만 로깅하도록 필터링
- 로그 수집 시스템 연동

## 📌 주의사항

- `.env` 파일은 절대 커밋하지 마세요
- API 인증 정보는 안전하게 관리하세요
- 프로덕션 배포 시 HTTPS 필수

## 🤝 기여

이슈나 PR은 언제든 환영합니다!

## 📄 라이선스

MIT License
