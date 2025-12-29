---
name: whotag-report
description: "whotag MCP 툴 데이터(해시태그 트렌드, 인플루언서 분석, 시장조사)를 컨설팅 스타일 PPT 보고서로 변환. 사용자가 '보고서 만들어줘', 'PPT로 정리해줘', '리포트 작성해줘', '발표자료 만들어줘' 등 whotag 데이터 기반 보고서 생성을 요청할 때 사용. 시장조사, 인플루언서 캐스팅 분석, 트렌드 리포트 등 다목적 지원. 한국어/영어 혼용 가능."
---

# Whotag Report

whotag MCP 툴에서 가져온 데이터를 컨설팅 스타일 PPT 보고서로 변환하는 스킬.

## Workflow

### Step 1: 데이터 분석 및 보고서 유형 결정

whotag 툴 결과를 분석하여 보고서 유형 결정:

| 데이터 유형 | 보고서 유형 | 주요 슬라이드 |
|-------------|-------------|---------------|
| 해시태그 트렌드 | 시장 트렌드 리포트 | 트렌드 순위, 성장률 차트, 카테고리 분포 |
| 인플루언서 검색 결과 | 인플루언서 캐스팅 리포트 | 프로필 카드, 비교 테이블, 추천 리스트 |
| 국가별 데이터 | 시장조사 리포트 | 시장 개요, 경쟁 분석, 기회 영역 |
| 복합 데이터 | 종합 분석 리포트 | 위 요소들 조합 |

### Step 2: 슬라이드 구조 설계

참조: [references/slide-structure.md](references/slide-structure.md)

**기본 보고서 구조** (8-12장):
1. **표지** (1장) - 제목, 날짜, 로고
2. **Executive Summary** (1장) - 핵심 발견 3개
3. **목차** (1장, 선택) - 10장 이상일 때
4. **본문** (4-8장) - 데이터별 분석
5. **인사이트 & 권장사항** (1-2장) - 시사점
6. **부록** (필요시) - 상세 데이터

### Step 3: 시각화 방식 결정

참조: [references/data-visualization.md](references/data-visualization.md)

| 데이터 특성 | 추천 시각화 |
|-------------|-------------|
| 순위/랭킹 | 수평 막대 차트 |
| 비율/구성 | 도넛 차트 |
| 시계열 변화 | 라인 차트 |
| 비교 분석 | 테이블 + 하이라이트 |
| 프로필 정보 | 카드형 레이아웃 |

### Step 4: 컨설팅 스타일 적용

**색상 팔레트** (권장):
- **Primary**: Navy (#1E3A5F) - 헤더, 강조
- **Secondary**: Slate (#64748B) - 본문, 테이블 헤더
- **Accent**: Teal (#0D9488) 또는 Coral (#F97316) - 하이라이트
- **Background**: White (#FFFFFF) 또는 Light Gray (#F8FAFC)

**폰트 규칙**:
- 제목: Arial Bold, 28-36pt
- 부제목: Arial Bold, 20-24pt
- 본문: Arial, 14-18pt
- 캡션/주석: Arial, 10-12pt

**레이아웃 원칙**:
- 여백: 상하좌우 0.5인치 이상
- 정보량: 슬라이드당 핵심 메시지 1개
- 차트/테이블: 슬라이드 60% 이하 차지
- 텍스트: 불릿 3-5개, 줄당 1-2줄

### Step 5: PPT 생성

**pptx 스킬의 html2pptx 워크플로우 사용**:

1. 각 슬라이드를 HTML로 작성 (720pt x 405pt, 16:9)
2. html2pptx.js로 PowerPoint 변환
3. 썸네일 생성 및 시각적 검증
4. 필요시 수정 후 재생성

**슬라이드 HTML 작성 시 주의사항**:
- 모든 텍스트는 `<p>`, `<h1>`-`<h6>`, `<ul>`, `<ol>` 태그 내에
- 차트/테이블 영역은 `class="placeholder"` 사용
- flexbox로 레이아웃 구성
- 그라디언트/아이콘은 PNG로 래스터화 후 사용

## Data Mapping Guide

참조: [references/whotag-data-mapping.md](references/whotag-data-mapping.md)

whotag API 결과를 슬라이드 요소로 매핑하는 가이드라인.

## Output Quality Checklist

PPT 생성 후 확인사항:

- [ ] 표지에 제목, 날짜, 대상 국가/시장 명시
- [ ] Executive Summary에 핵심 발견 3개 이내
- [ ] 각 슬라이드 핵심 메시지 명확
- [ ] 차트/테이블 가독성 확인
- [ ] 색상 일관성 유지
- [ ] 폰트 크기 계층 구조 준수
- [ ] 데이터 출처 명시 (whotag.ai)
