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

## 📌 주의사항

- `.env` 파일은 절대 커밋하지 마세요
- API 인증 정보는 안전하게 관리하세요
- 프로덕션 배포 시 HTTPS 필수

## 🤝 기여

이슈나 PR은 언제든 환영합니다!

## 📄 라이선스

MIT License
