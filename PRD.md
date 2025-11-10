# Product Requirements Document (PRD)

# 인플루언서 검색 ChatGPT App

**Version**: 1.0  
**Date**: 2024-11-04  
**Author**: Product Team  
**Status**: Initial Release

---

## 1. Executive Summary

### 1.1 제품 개요

ChatGPT Apps SDK 기반의 자연어 인플루언서 검색 애플리케이션으로, 사용자가 ChatGPT 내에서 자연어로 인플루언서를 검색하고 프로필을 확인할 수 있는 서비스입니다.

### 1.2 비전

"AI 기반 자연어 검색으로 최적의 인플루언서를 찾는 가장 쉽고 빠른 방법"

### 1.3 미션

- 복잡한 필터링 없이 자연어로 인플루언서 검색
- ChatGPT 내에서 즉시 활용 가능한 인플루언서 정보 제공
- 직관적인 UI/UX로 효율적인 의사결정 지원

---

## 2. 배경 및 목적

### 2.1 문제 정의

- **현재 상황**: 인플루언서 검색 시 복잡한 필터와 여러 단계의 클릭 필요
- **사용자 Pain Points**:
  - 구체적인 검색 조건을 설정하기 어려움
  - 여러 플랫폼을 오가며 정보 확인 필요
  - 자연스러운 표현으로 검색 불가

### 2.2 솔루션

- ChatGPT 대화 인터페이스를 통한 자연어 검색
- 캐러셀 형태의 직관적인 프로필 표시
- whotag.ai 플랫폼과의 원활한 연동

### 2.3 목표

1. **검색 효율성 향상**: 자연어 검색으로 검색 시간 50% 단축
2. **사용자 만족도**: ChatGPT 내 완결성 있는 경험 제공
3. **전환율 향상**: whotag.ai 플랫폼 방문율 30% 증가

---

## 3. 타겟 사용자

### 3.1 Primary Users

- **마케터**: 브랜드 캠페인을 위한 인플루언서 발굴
- **PR 담당자**: 제품 홍보를 위한 인플루언서 협업
- **스타트업**: 비용 효율적인 인플루언서 마케팅

### 3.2 User Personas

#### Persona 1: 디지털 마케터 (김민지, 32세)

- **역할**: 중견기업 마케팅팀 대리
- **목표**: 육아용품 브랜드 캠페인에 적합한 인플루언서 찾기
- **Pain Points**: 다양한 조건을 고려한 검색이 복잡함
- **Needs**: "30대 육아 인플루언서" 같은 자연스러운 검색

#### Persona 2: 스타트업 대표 (이준호, 28세)

- **역할**: 푸드테크 스타트업 CEO
- **목표**: 제한된 예산으로 효과적인 인플루언서 찾기
- **Pain Points**: 인플루언서 정보 파악에 시간이 많이 소요
- **Needs**: 빠른 프로필 확인과 의사결정

---

## 4. 기능 요구사항

### 4.1 핵심 기능 (P0 - Must Have)

#### F1: 자연어 인플루언서 검색

- **설명**: 자연어 쿼리를 통한 인플루언서 검색
- **입력**: 텍스트 (예: "대한민국의 육아 인플루언서")
- **출력**: 관련 인플루언서 목록
- **제약사항**:
  - 최대 6명까지 결과 반환
  - 한국어/영어 지원

#### F2: 프로필 카드 표시

- **설명**: 인플루언서 핵심 정보를 카드 형태로 표시
- **포함 정보**:
  - 프로필 이미지
  - 사용자명 (@username)
  - 이름
  - 타이틀/직업
  - 팔로워 수
  - 소셜 링크 (최대 3개)
- **UI**: 캐러셀 형태 (3명씩 표시)

#### F3: 캐러셀 네비게이션

- **설명**: 좌우 버튼으로 추가 프로필 확인
- **동작**:
  - '>' 버튼: 다음 3명 표시
  - '<' 버튼: 이전 3명 표시
- **제약**: 처음/마지막에서는 버튼 비활성화

#### F4: whotag.ai 연동

- **설명**: 각 프로필에서 whotag.ai 상세 페이지로 이동
- **버튼**: "View on whotag.ai"
- **동작**: 새 탭에서 프로필 페이지 열기

### 4.2 보조 기능 (P1 - Should Have)

#### F5: 검색 결과 요약

- **설명**: 검색 결과 상단에 요약 정보 표시
- **내용**:
  - 검색 쿼리
  - 총 검색 결과 수
  - 표시 중인 인원 수

#### F6: 에러 처리

- **검색 결과 없음**: "검색 결과가 없습니다. 다른 질문을 해주십시오"
- **API 오류**: 사용자 친화적 에러 메시지 표시

### 4.3 향후 기능 (P2 - Nice to Have)

- 필터링 옵션 (팔로워 수, 지역, 카테고리)
- 즐겨찾기/북마크
- CSV/Excel 내보내기
- 검색 히스토리

---

## 5. 기술 요구사항

### 5.1 아키텍처

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │     │                 │
│    ChatGPT      │────▶│   MCP Server    │────▶│  whotag.ai API  │
│                 │◀────│   (Node.js)     │◀────│                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                       │
         │                       │
         ▼                       ▼
┌─────────────────┐     ┌─────────────────┐
│                 │     │                 │
│  React Widget   │     │   Session Mgmt  │
│   (Carousel)    │     │                 │
└─────────────────┘     └─────────────────┘
```

### 5.2 기술 스택

- **Backend**: Node.js, TypeScript, Express
- **Frontend**: React 18, TypeScript, Vite
- **Protocol**: MCP (Model Context Protocol)
- **Package Manager**: pnpm
- **API**: RESTful (whotag.ai)

### 5.3 API 명세

#### 인증 API

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "username": "string",
  "password": "string"
}

Response: {
  "access_token": "string",
  "expires_in": number
}
```

#### 검색 API

```http
POST /api/v1/influencers/search
Authorization: Bearer {token}
Content-Type: application/json

{
  "message": "자연어 검색 쿼리"
}

Response: {
  "total_count": number,
  "influencers": ["user_id1", "user_id2", ...],
  "search_summary": "string"
}
```

#### 프로필 조회 API

```http
POST /api/v1/influencers/search/info/batch
Authorization: Bearer {token}
Content-Type: application/json

{
  "influencers": ["user_id1", "user_id2"]
}

Response: {
  "code": "SUCCESS",
  "item": [
    {
      "profile": {
        "user_id": "string",           // 고유 사용자 ID
        "username": "string",          // @username (인스타그램 아이디)
        "full_name": "string",         // 전체 이름
        "followed_by": number,         // 팔로워 수
        "profile_pic_url": "string",   // 프로필 이미지 URL
        // ... 기타 필드
      },
      "general": {
        "user_id": "string",
        "title": "string",             // 직업/타이틀 (예: "Professional Makeup Artist")
        "demo_short": "string",        // 짧은 소개 (title이 없을 경우 대체)
        // ... 기타 필드
      },
      "links": {
        "links": [                     // 소셜 미디어 링크 배열
          {
            "platform": "string",      // 플랫폼명 (예: "instagram", "youtube", "tiktok")
            "urls": ["string"]         // URL 배열
          }
        ],
        "has_links": boolean,
        "total_link_count": number
      }
    }
  ]
}

// 실제 사용 필드 매핑
{
  "username": item.profile.username,           // 사용자명
  "title": item.general.title || item.general.demo_short,  // 타이틀
  "followed_by": item.profile.followed_by,     // 팔로워 수
  "links": item.links.links                    // 소셜 링크 배열
}
```

#### 이미지 조회 API

```http
GET /api/v1/influencers/images/{user_id}/representative/url
Authorization: Bearer {token}

Response: {
  "item": [
    {
      "post_id": "string",
      "image_url": "string"
    }
  ]
}
```

### 5.4 데이터 구조 명세

#### 프로필 카드 데이터 모델

```typescript
interface ProfileCardData {
  user_id: string; // 고유 식별자
  username: string; // 인스타그램 아이디 (@없이)
  full_name: string; // 전체 이름
  title: string; // 직업/타이틀 (general.title || general.demo_short)
  followed_by: number; // 팔로워 수
  primaryImage?: string; // 대표 이미지 URL (이미지 API 첫번째 결과)
  links?: SocialLink[]; // 소셜 미디어 링크 배열
}

interface SocialLink {
  platform: string; // "instagram" | "youtube" | "tiktok" | "twitter" 등
  urls: string[]; // 플랫폼 URL 배열
}
```

#### 필드 추출 로직

```typescript
// API 응답에서 필드 추출
const extractProfileData = (apiResponse: any): ProfileCardData => {
  return {
    user_id: apiResponse.profile.user_id,
    username: apiResponse.profile.username,
    full_name: apiResponse.profile.full_name,
    title:
      apiResponse.general?.title ||
      apiResponse.general?.demo_short ||
      "인플루언서",
    followed_by: apiResponse.profile.followed_by,
    primaryImage: undefined, // 별도 API 호출 후 설정
    links: apiResponse.links?.links || [],
  };
};

// 팔로워 수 포맷팅
const formatFollowers = (count: number): string => {
  if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
  if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
  return count.toString();
};

// 플랫폼 아이콘 매핑
const platformIcons: Record<string, string> = {
  instagram: "📷",
  youtube: "▶️",
  tiktok: "🎵",
  twitter: "🐦",
  facebook: "📘",
  linkedin: "💼",
  snapchat: "👻",
  blog: "📝", // 네이버블로그, 티스토리, 미디엄, 브런치
  kakaotalk: "💛",
  whatsapp: "💬",
  telegram: "✈️",
  shopee: "🛍️",
  amazon: "📦",
  shopltk: "🛒",
  rakuten: "🏪",
  sephora: "💄",
  coupang: "🚀",
  default: "🔗",
};

// 플랫폼 식별 로직
const getPlatform = (url: string): string => {
  const lowerUrl = url.toLowerCase();

  // 도메인 기반 식별
  if (lowerUrl.includes("instagram.com")) return "instagram";
  if (lowerUrl.includes("youtube.com") || lowerUrl.includes("m.youtube.com"))
    return "youtube";
  if (lowerUrl.includes("tiktok.com")) return "tiktok";
  if (lowerUrl.includes("twitter.com") || lowerUrl.includes("x.com"))
    return "twitter";
  if (lowerUrl.includes("facebook.com") || lowerUrl.includes("fb.com"))
    return "facebook";
  if (lowerUrl.includes("linkedin.com")) return "linkedin";
  if (lowerUrl.includes("snapchat.com")) return "snapchat";

  // 블로그 플랫폼
  if (
    lowerUrl.includes("blog.naver.com") ||
    lowerUrl.includes("m.blog.naver.com")
  )
    return "blog";
  if (lowerUrl.includes("tistory.com")) return "blog";
  if (lowerUrl.includes("medium.com")) return "blog";
  if (lowerUrl.includes("brunch.co.kr")) return "blog";

  // 초대 링크 패턴
  if (lowerUrl.includes("open.kakao.com")) return "kakaotalk";
  if (lowerUrl.includes("wa.me") || lowerUrl.includes("api.whatsapp.com"))
    return "whatsapp";
  if (lowerUrl.includes("t.me")) return "telegram";

  // 쇼핑 플랫폼
  if (lowerUrl.includes("shopee.")) return "shopee";
  if (lowerUrl.includes("amazon.com")) return "amazon";
  if (lowerUrl.includes("shopltk.com")) return "shopltk";
  if (lowerUrl.includes("rakuten.co.jp")) return "rakuten";
  if (lowerUrl.includes("sephora.com")) return "sephora";
  if (lowerUrl.includes("link.coupang.com")) return "coupang";

  return "default";
};
```

#### 필드 활용 예시

```json
{
  "user_id": "ENC_0sQAsjZrWnggvSi9MULvpogEf6vZOKChlhf7_Zv0M69qF6rlPYY",
  "username": "hnifaseran",
  "full_name": "Princess Jasmine",
  "title": "Family and Lifestyle Influencer",
  "followed_by": 10896,
  "primaryImage": "https://cdn.whotag.ai/insta/media/post_image/3249021/DMXVlXVRG.jpg",
  "links": [
    {
      "platform": "instagram",
      "urls": ["https://www.instagram.com/hnifaseran"]
    }
  ]
}

---

## 6. UI/UX 요구사항

### 6.1 디자인 원칙
- **Simple**: 최소한의 클릭으로 목표 달성
- **Intuitive**: 학습 없이 사용 가능한 인터페이스
- **Responsive**: 다양한 화면 크기 지원
- **Accessible**: 접근성 표준 준수

### 6.2 컴포넌트 명세

#### 프로필 카드
```

┌─────────────────────┐
│ [Profile Img] │ 80x80px, 원형
│ │
│ @username │ 16px, bold
│ Full Name │ 14px, gray
│ Title │ 13px, light gray
│ 3.9K followers │ 14px
│ │
│ [📷] [▶️] [💛] │ 소셜 링크 (플랫폼별 아이콘)
│ │
│ [View on whotag.ai] │ 버튼
└─────────────────────┘

```

#### 플랫폼별 아이콘 명세

##### SNS 플랫폼
| 플랫폼 | 아이콘 | 배경색 | 설명 |
|---------|--------|--------|------|
| Instagram | 📷 | Gradient (#f09433 → #bc1888) | 인스타그램 |
| YouTube | ▶️ | #FF0000 | 유튜브 |
| TikTok | 🎵 | #000000 | 틱톡 |
| Twitter/X | 🐦 | #1DA1F2 | 트위터/엑스 |
| Facebook | 📘 | #1877F2 | 페이스북 |
| LinkedIn | 💼 | #0077B5 | 링크드인 |
| Snapchat | 👻 | #FFFC00 | 스냅챗 |
| Blog | 📝 | #03C75A | 네이버블로그/티스토리 |
| Medium | 📝 | #000000 | 미디엄 |
| Brunch | 📝 | #00C3BD | 브런치 |

##### 메신저 플랫폼
| 플랫폼 | 아이콘 | 배경색 | 설명 |
|---------|--------|--------|------|
| KakaoTalk | 💛 | #FEE500 | 카카오톡 오픈채팅 |
| WhatsApp | 💬 | #25D366 | 왓츠앱 |
| Telegram | ✈️ | #0088CC | 텔레그램 |

##### 쇼핑 플랫폼
| 플랫폼 | 아이콘 | 배경색 | 설명 |
|---------|--------|--------|------|
| Shopee | 🛍️ | #EE4D2D | 쇼피 |
| Amazon | 📦 | #FF9900 | 아마존 |
| ShopLTK | 🛒 | #000000 | ShopLTK |
| Rakuten | 🏪 | #BF0000 | 라쿠텐 |
| Sephora | 💄 | #000000 | 세포라 |
| Coupang | 🚀 | #5A2E0E | 쿠팡 |

##### 기타
| 플랫폼 | 아이콘 | 배경색 | 설명 |
|---------|--------|--------|------|
| Others | 🔗 | #666666 | 기타 링크 |

#### 캐러셀 레이아웃
```

     [<]  [Card1] [Card2] [Card3]  [>]
           3개씩 표시, 좌우 네비게이션

```

### 6.3 반응형 디자인
- **Desktop** (>768px): 3열 그리드
- **Mobile** (<768px): 1열 그리드
- **Tablet** (768px-1024px): 2열 그리드

### 6.4 다크모드 지원
- 시스템 설정에 따른 자동 전환
- 컬러 팔레트:
  - Light: 배경 #FFFFFF, 텍스트 #1A1A1A
  - Dark: 배경 #1F1F1F, 텍스트 #F0F0F0

---

## 7. 성능 요구사항

### 7.1 응답 시간
- **검색 응답**: < 3초
- **프로필 로딩**: < 2초
- **이미지 로딩**: < 1초

### 7.2 동시성
- **동시 사용자**: 100명 이상 지원
- **세션 관리**: 독립적인 세션별 상태 관리

### 7.3 캐싱 전략
- **토큰 캐싱**: 만료 1분 전까지 재사용
- **이미지 캐싱**: 브라우저 캐시 활용
- **API 응답 캐싱**: 5분간 동일 쿼리 캐싱 (선택사항)

---

## 8. 보안 요구사항

### 8.1 인증 및 권한
- **API 인증**: Bearer Token 방식
- **토큰 관리**: 서버 사이드 저장 및 관리
- **환경 변수**: .env 파일로 민감 정보 분리

### 8.2 데이터 보호
- **HTTPS**: 모든 통신 암호화
- **CORS**: 허가된 도메인만 접근
- **CSP**: Content Security Policy 적용

### 8.3 에러 처리
- **민감 정보 노출 방지**: 에러 메시지에 시스템 정보 미포함
- **로깅**: 에러 로그 서버 사이드 저장

---

## 9. 제약사항 및 가정

### 9.1 제약사항
- ChatGPT Plus 구독 필요
- whotag.ai API 접근 권한 필요
- 검색 결과 최대 20명 제한
- 한국어/영어만 지원

### 9.2 가정
- 사용자는 기본적인 ChatGPT 사용법 숙지
- 안정적인 인터넷 연결
- 최신 브라우저 사용

### 9.3 의존성
- whotag.ai API 가용성
- ChatGPT Actions 기능
- ngrok 또는 공개 HTTPS 엔드포인트

---

## 10. 개발 일정

### Phase 1: MVP (2주)
- Week 1:
  - [ ] 환경 설정 및 프로젝트 구조
  - [ ] MCP 서버 기본 구현
  - [ ] whotag.ai API 연동

- Week 2:
  - [ ] React 컴포넌트 개발
  - [ ] 캐러셀 UI 구현
  - [ ] ChatGPT 연동 테스트

### Phase 2: Enhancement (1주)
- [ ] 에러 처리 고도화
- [ ] 성능 최적화
- [ ] UI/UX 개선

### Phase 3: Production (1주)
- [ ] 배포 환경 구축
- [ ] 문서화
- [ ] QA 및 버그 수정

---

## 11. 성공 지표 (KPIs)

### 11.1 사용성 지표
- **검색 완료율**: > 80%
- **평균 검색 시간**: < 30초
- **재사용율**: > 60%

### 11.2 기술 지표
- **API 응답 시간**: P95 < 3초
- **에러율**: < 1%
- **가용성**: > 99.9%

### 11.3 비즈니스 지표
- **whotag.ai 전환율**: > 30%
- **일일 활성 사용자**: 100+
- **사용자 만족도**: NPS > 40

---

## 12. 리스크 및 완화 방안

### 12.1 기술적 리스크
| 리스크 | 영향도 | 확률 | 완화 방안 |
|--------|--------|------|-----------|
| API 서버 다운 | 높음 | 낮음 | 에러 처리 및 재시도 로직 |
| 토큰 만료 | 중간 | 중간 | 자동 갱신 메커니즘 |
| CORS 이슈 | 낮음 | 중간 | 올바른 CORS 설정 |

### 12.2 비즈니스 리스크
| 리스크 | 영향도 | 확률 | 완화 방안 |
|--------|--------|------|-----------|
| 낮은 사용률 | 높음 | 중간 | 사용자 교육 및 홍보 |
| API 비용 초과 | 중간 | 낮음 | 사용량 모니터링 |

---

## 13. 향후 로드맵

### Q1 2025
- 고급 필터링 기능
- 다국어 지원 (일본어, 중국어)
- 분석 대시보드

### Q2 2025
- AI 기반 추천 시스템
- 일괄 검색 기능
- API 공개

### Q3 2025
- 모바일 앱 출시
- 팀 협업 기능
- 캠페인 관리 도구

---

## 14. 부록

### A. 용어 정의
- **MCP**: Model Context Protocol
- **SSE**: Server-Sent Events
- **pnpm**: Performant npm, 패키지 매니저
- **ChatGPT Actions**: ChatGPT의 외부 서비스 연동 기능

### B. 참고 문서
- [ChatGPT Apps SDK Documentation](https://docs.chatgpt.com/apps)
- [MCP Protocol Specification](https://modelcontextprotocol.org)
- [whotag.ai API Documentation](https://docs.whotag.ai)

### C. 연락처
- Product Owner: product@example.com
- Tech Lead: tech@example.com
- Design Lead: design@example.com

---

## 15. 변경 이력

| 버전 | 날짜 | 작성자 | 변경 내용 |
|------|------|--------|-----------|
| 1.0 | 2024-11-04 | Product Team | 초기 버전 작성 |

---

**END OF DOCUMENT**
```
