# Data Visualization Guide

whotag 데이터를 효과적으로 시각화하는 가이드.

## Table of Contents

1. [차트 유형 선택 가이드](#차트-유형-선택-가이드)
2. [차트별 구현 패턴](#차트별-구현-패턴)
3. [테이블 스타일 가이드](#테이블-스타일-가이드)
4. [색상 및 스타일링](#색상-및-스타일링)

---

## 차트 유형 선택 가이드

| 데이터 특성 | 추천 차트 | 사용 예시 |
|-------------|-----------|-----------|
| 순위/랭킹 (10개 이하) | 수평 막대 차트 | 해시태그 TOP 10, 인플루언서 순위 |
| 순위/랭킹 (10개 초과) | 테이블 + 하이라이트 | 전체 해시태그 목록 |
| 비율/구성 | 도넛 차트 | 카테고리별 분포, 팔로워 구간 비율 |
| 시계열 변화 | 라인 차트 | 월별 트렌드, 성장률 추이 |
| 비교 분석 | 그룹 막대 차트 | 국가별 비교, 기간별 비교 |
| 분포/밀도 | 버블 차트 | 팔로워 vs 참여율 분포 |
| 상관관계 | 산점도 | 팔로워 수와 참여율 관계 |

---

## 차트별 구현 패턴

### 수평 막대 차트 (Horizontal Bar)

**적합한 데이터**: 해시태그 순위, 인플루언서 팔로워 비교

```
해시태그 트렌드 TOP 10
─────────────────────────────────────
#뷰티        ████████████████  45,230
#메이크업    ████████████      38,100
#스킨케어    ██████████        31,500
#화장품      ████████          28,200
#뷰티팁      ██████            22,800
```

**PptxGenJS 구현**:
```javascript
slide.addChart(pptx.charts.BAR, chartData, {
  x: 0.5, y: 1.5, w: 9, h: 4,
  barDir: 'bar',  // horizontal
  showValue: true,
  dataLabelPosition: 'outEnd',
  chartColors: ['#1E3A5F'],
});
```

### 도넛 차트 (Donut)

**적합한 데이터**: 카테고리 비율, 구성 비교

```
      ┌─────────┐
     ╱    25%   ╲
    │  ┌─────┐   │
    │  │ 40% │   │  뷰티: 40%
    │  └─────┘   │  패션: 25%
     ╲   20%    ╱   푸드: 20%
      └───15%──┘    기타: 15%
```

**PptxGenJS 구현**:
```javascript
slide.addChart(pptx.charts.DOUGHNUT, chartData, {
  x: 5, y: 1.5, w: 4, h: 4,
  holeSize: 50,
  showPercent: true,
  chartColors: ['#1E3A5F', '#0D9488', '#F97316', '#64748B'],
});
```

### 라인 차트 (Line)

**적합한 데이터**: 시계열 트렌드, 성장률 추이

```
게시물 수 추이 (최근 6개월)
│
│         ╱──●
│    ●──╱
│   ╱
│  ●
│─●───────────────────────
  1월  2월  3월  4월  5월  6월
```

**PptxGenJS 구현**:
```javascript
slide.addChart(pptx.charts.LINE, chartData, {
  x: 0.5, y: 1.5, w: 9, h: 4,
  lineSmooth: true,
  showMarker: true,
  chartColors: ['#0D9488'],
});
```

---

## 테이블 스타일 가이드

### 기본 테이블 구조

```html
<table style="width: 100%; border-collapse: collapse;">
  <thead>
    <tr style="background: #1E3A5F; color: white;">
      <th style="padding: 12px; text-align: left;">순위</th>
      <th style="padding: 12px; text-align: left;">인플루언서</th>
      <th style="padding: 12px; text-align: right;">팔로워</th>
      <th style="padding: 12px; text-align: right;">참여율</th>
    </tr>
  </thead>
  <tbody>
    <tr style="background: #F8FAFC;">
      <td style="padding: 10px;">1</td>
      <td style="padding: 10px;">@username</td>
      <td style="padding: 10px; text-align: right;">1.2M</td>
      <td style="padding: 10px; text-align: right;">4.5%</td>
    </tr>
    <!-- 줄바꿈 색상: #FFFFFF / #F8FAFC 교차 -->
  </tbody>
</table>
```

### 테이블 스타일 규칙

| 요소 | 스타일 |
|------|--------|
| 헤더 배경 | Navy (#1E3A5F) |
| 헤더 텍스트 | White, Bold |
| 본문 배경 | White / Light Gray 교차 |
| 본문 텍스트 | Dark Gray (#334155) |
| 셀 패딩 | 10-12px |
| 테두리 | 1px solid #E2E8F0 |

### 하이라이트 패턴

**Top 3 강조**:
```css
tr:nth-child(1) { background: #FEF3C7; }  /* Gold */
tr:nth-child(2) { background: #F3F4F6; }  /* Silver */
tr:nth-child(3) { background: #FED7AA; }  /* Bronze */
```

**특정 값 강조**:
```css
.highlight {
  background: #0D9488;
  color: white;
  padding: 2px 8px;
  border-radius: 4px;
}
```

---

## 색상 및 스타일링

### 기본 색상 팔레트

```
Primary Colors:
┌────────────────────────────────────┐
│ Navy      #1E3A5F  ████████████   │ 헤더, 제목
│ Slate     #64748B  ████████████   │ 본문, 부제목
│ Light     #F8FAFC  ████████████   │ 배경
└────────────────────────────────────┘

Accent Colors:
┌────────────────────────────────────┐
│ Teal      #0D9488  ████████████   │ 긍정적 지표
│ Coral     #F97316  ████████████   │ 주의/강조
│ Red       #DC2626  ████████████   │ 부정적 지표
│ Green     #16A34A  ████████████   │ 성장/증가
└────────────────────────────────────┘
```

### 차트 색상 조합

**단일 계열**:
```javascript
chartColors: ['#1E3A5F']
```

**다중 계열 (2-4개)**:
```javascript
chartColors: ['#1E3A5F', '#0D9488', '#F97316', '#64748B']
```

**그라데이션 (순위 표현)**:
```javascript
chartColors: ['#1E3A5F', '#2E4A6F', '#3E5A7F', '#4E6A8F', '#5E7A9F']
```

### 숫자 포맷팅

| 값 범위 | 표시 형식 | 예시 |
|---------|-----------|------|
| < 1,000 | 그대로 | 856 |
| 1,000 - 999,999 | K 단위 | 45.2K |
| 1,000,000+ | M 단위 | 1.2M |
| 백분율 | 소수점 1자리 | 4.5% |
| 변화율 | +/- 기호 포함 | +12.3% |

### 아이콘 및 기호

| 의미 | 기호 | 사용처 |
|------|------|--------|
| 증가 | ▲ 또는 ↑ | 성장률, 순위 상승 |
| 감소 | ▼ 또는 ↓ | 하락, 순위 하락 |
| 유지 | ● 또는 — | 변화 없음 |
| 체크 | ✓ | 완료, 충족 |
| 경고 | ⚠ | 주의 필요 |
