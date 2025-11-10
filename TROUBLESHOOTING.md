# Troubleshooting Guide

이 문서는 Influencer Search App 개발 중 발생한 주요 이슈와 해결 방법을 정리한 문서입니다.

## 1. 템플릿 리터럴 구문 오류

### 문제
```
ERROR: Syntax error "`"
```

서버 시작 시 esbuild에서 템플릿 리터럴 구문 오류 발생

### 원인
백틱(`)이 이스케이프된 형태(`\``)로 작성되어 있어 구문 오류 발생

### 해결
모든 이스케이프된 백틱을 일반 백틱으로 변경
```typescript
// 변경 전
console.error(\`Searching for: \${args.query}\`);

// 변경 후
console.error(`Searching for: ${args.query}`);
```

**영향받은 파일**: `server/src/index.ts` (여러 위치)

---

## 2. Zod 버전 불일치

### 문제
```
Type 'ZodOptional<ZodDefault<ZodNumber>>' is missing properties from type 'ZodType<any, any, any>'
```

### 원인
- MCP SDK는 Zod v3.23.8을 요구
- 프로젝트에 Zod v4.1.12가 설치됨 (breaking changes 포함)

### 해결
Zod를 v3로 다운그레이드
```bash
pnpm remove zod
pnpm add zod@^3.23.8
```

설치된 버전: `zod@3.25.76`

---

## 3. TypeScript Error 타입 처리

### 문제
```
'error' is of type 'unknown'
```

catch 블록의 error가 unknown 타입으로 처리되어 `.message` 접근 불가

### 해결
타입 가드를 사용하여 에러 메시지 추출
```typescript
catch (error) {
  const errorMessage = error instanceof Error ? error.message : String(error);
  // errorMessage 사용
}
```

---

## 4. CSS 파일명 불일치

### 문제
```
Warning: Component files not found. Run npm run build in web directory.
```

### 원인
- Vite는 `style.css` 파일 생성
- 서버는 `component.css` 파일 로드 시도

### 해결
서버 코드에서 올바른 파일명 사용
```typescript
// server/src/index.ts
COMPONENT_CSS = readFileSync(join(__dirname, '../../web/dist/style.css'), 'utf8');
```

---

## 5. ChatGPT 연동 오류 (400/500 에러)

### 문제
ChatGPT Actions 설정 시 400 Bad Request 또는 500 Internal Server Error 발생

### 원인
MCP 프로토콜의 JSON-RPC 메서드 핸들러가 구현되지 않음

### 해결 과정

#### 5.1 MCP Manifest 엔드포인트 추가
```typescript
app.get('/mcp', (_req, res) => {
  res.json({
    openapi: '3.1.0',
    info: { title: 'Influencer Search MCP', version: '1.0.0' },
    'x-mcp': {
      protocolVersion: '2025-03-26',
      capabilities: { tools: {}, resources: {} },
      transport: { type: 'sse', url: '/mcp/sse' }
    }
  });
});
```

#### 5.2 JSON-RPC 메서드 핸들러 구현
ChatGPT가 요청하는 모든 JSON-RPC 메서드 처리:

**1) `initialize`** - 서버 초기화
```typescript
case 'initialize':
  res.json({
    jsonrpc: '2.0',
    id: id,
    result: {
      protocolVersion: params?.protocolVersion || '2025-03-26',
      serverInfo: { name: 'influencer-search', version: '1.0.0' },
      capabilities: { tools: {}, resources: {} }
    }
  });
```

**2) `notifications/initialized`** - 초기화 완료 알림
```typescript
case 'notifications/initialized':
  res.status(200).end(); // 응답 필요 없음
```

**3) `tools/list`** - 사용 가능한 도구 목록 반환
```typescript
case 'tools/list':
  res.json({
    jsonrpc: '2.0',
    id: id,
    result: {
      tools: [{
        name: 'search_influencers',
        description: 'Search influencers using natural language query',
        inputSchema: { /* JSON Schema */ }
      }]
    }
  });
```

**4) `resources/list`** - 사용 가능한 리소스 목록 반환
```typescript
case 'resources/list':
  res.json({
    jsonrpc: '2.0',
    id: id,
    result: {
      resources: [{
        uri: 'ui://widget/carousel.html',
        name: 'Influencer Carousel Widget',
        mimeType: 'text/html+skybridge'
      }]
    }
  });
```

**5) `tools/call`** - 실제 도구 실행
```typescript
case 'tools/call':
  const toolName = params?.name;
  const toolArgs = params?.arguments || {};

  if (toolName === 'search_influencers') {
    // API 호출 및 결과 반환
    const searchResults = await searchInfluencers(toolArgs.query);
    // ... 데이터 처리 ...

    res.json({
      jsonrpc: '2.0',
      id: id,
      result: {
        content: [
          { type: 'text', text: '...' },
          { type: 'resource', resource: { /* widget */ } }
        ],
        _meta: { allProfiles, searchMetadata }
      }
    });
  }
```

#### 5.3 CORS 설정 개선
```typescript
app.use(cors({
  origin: ['https://chatgpt.com', 'https://chat.openai.com'],
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
```

#### 5.4 요청 로깅 추가
디버깅을 위한 요청 로깅 미들웨어 추가
```typescript
app.use((req, _res, next) => {
  console.error(`${req.method} ${req.path}`);
  next();
});
```

---

## 6. 미사용 파라미터 경고

### 문제
```
Parameter 'req' implicitly has an 'any' type
```

### 해결
사용하지 않는 파라미터는 언더스코어 접두사 사용
```typescript
app.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});
```

---

## 디버깅 체크리스트

### ChatGPT 연동 시 확인사항

1. **ngrok 실행 확인**
   ```bash
   pgrep -f ngrok
   curl http://localhost:4040/api/tunnels
   ```

2. **서버 로그 확인**
   - `GET /mcp` - manifest 요청
   - `POST /mcp` - JSON-RPC 요청들
   - `initialize`, `tools/list`, `tools/call` 등

3. **MCP manifest 테스트**
   ```bash
   curl https://YOUR-NGROK-URL.ngrok.io/mcp
   ```

4. **ChatGPT Actions 설정**
   - Schema URL: `https://YOUR-NGROK-URL.ngrok.io/mcp`
   - Authentication: None
   - Actions Type: MCP

### 일반적인 개발 플로우

1. **Web 컴포넌트 빌드**
   ```bash
   cd web
   pnpm run build
   ```

2. **서버 실행**
   ```bash
   cd server
   pnpm run dev
   ```

3. **ngrok 터널 생성**
   ```bash
   ngrok http 3000
   ```

4. **Health check**
   ```bash
   curl http://localhost:3000/health
   ```

---

## 주요 학습 내용

1. **MCP 프로토콜은 JSON-RPC 2.0 기반**
   - 모든 요청/응답이 JSON-RPC 형식
   - `method`, `id`, `params`, `result` 구조

2. **ChatGPT Apps의 연동 플로우**
   ```
   GET /mcp (discovery)
   → POST /mcp (initialize)
   → POST /mcp (notifications/initialized)
   → POST /mcp (tools/list)
   → POST /mcp (tools/call) [사용자 요청 시]
   ```

3. **Zod 버전 호환성 중요**
   - 의존성의 peer dependency 확인 필요
   - breaking changes 주의

4. **MCP SDK의 구조**
   - Server: 도구와 리소스 등록
   - Transport: SSE, stdio 등 통신 방식
   - JSON-RPC: 프로토콜 계층

---

## 참고 자료

- [MCP Protocol Documentation](https://github.com/modelcontextprotocol)
- [ChatGPT Actions Documentation](https://platform.openai.com/docs/actions)
- [Zod Documentation](https://zod.dev)
