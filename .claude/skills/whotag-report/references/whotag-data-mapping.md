# Whotag Data Mapping Guide

whotag API 응답 데이터를 PPT 슬라이드 요소로 매핑하는 가이드.

## Table of Contents

1. [API 응답 구조](#api-응답-구조)
2. [데이터 → 슬라이드 매핑](#데이터--슬라이드-매핑)
3. [프로필 이미지 처리](#프로필-이미지-처리)
4. [데이터 가공 패턴](#데이터-가공-패턴)

---

## API 응답 구조

### 인플루언서 검색 결과 (search_influencers)

```json
{
  "item": {
    "influencers": ["userId1", "userId2", ...],
    "summary": "검색 결과 요약"
  }
}
```

### 인플루언서 프로필 (getInfluencerBatch)

```json
{
  "user_id": "12345678",
  "username": "beauty_creator",
  "full_name": "뷰티 크리에이터",
  "biography": "뷰티 & 라이프스타일 크리에이터",
  "follower_count": 1250000,
  "following_count": 500,
  "media_count": 1200,
  "engagement_rate": 4.5,
  "avg_likes": 45000,
  "avg_comments": 1200,
  "interests": ["뷰티", "패션", "라이프스타일"],
  "country": "KR",
  "collaboration_tier": "Ready - Premium"
}
```

### 프로필 이미지 (get_profile_image)

```json
{
  "user_id": "12345678",
  "image_url": "https://..."
}
```

---

## 데이터 → 슬라이드 매핑

### 표지 슬라이드

| API 데이터 | 슬라이드 요소 |
|-----------|--------------|
| 검색 쿼리 | 보고서 제목 |
| 국가 코드 | 부제목 (국가명으로 변환) |
| 현재 날짜 | 작성일 |
| 결과 수 | 부제목 ("N명의 인플루언서 분석") |

**예시**:
```
검색: "태국 뷰티 인플루언서"
→ 제목: "태국 뷰티 인플루언서 시장 분석"
→ 부제목: "15명의 인플루언서 분석 리포트"
→ 날짜: "2024년 12월"
```

### Executive Summary 슬라이드

| 분석 내용 | 슬라이드 요소 |
|-----------|--------------|
| 총 인플루언서 수 | 핵심 발견 1 |
| 평균 팔로워/참여율 | 핵심 발견 2 |
| 주요 카테고리 | 핵심 발견 3 |

**예시**:
```
• 총 15명의 인플루언서 발굴 (팔로워 100K 이상)
• 평균 참여율 4.2% (업계 평균 3.1% 대비 +35%)
• 주요 카테고리: 뷰티(60%), 패션(25%), 라이프스타일(15%)
```

### 인플루언서 프로필 카드

| API 필드 | 슬라이드 요소 | 포맷 |
|---------|--------------|------|
| `profile_image` | 프로필 사진 | 80x80px 원형 |
| `username` | @username | @접두사 |
| `full_name` | 이름 | 그대로 |
| `follower_count` | 팔로워 | K/M 단위 |
| `engagement_rate` | 참여율 | 소수점 1자리 % |
| `interests` | 카테고리 | 쉼표로 구분 |
| `collaboration_tier` | 협업 등급 | 뱃지 스타일 |
| `biography` | 소개 | 최대 100자 |

### 비교 테이블

| 열 | API 필드 | 정렬 |
|------|---------|------|
| 순위 | (자동 생성) | 가운데 |
| 프로필 | `username` | 왼쪽 |
| 팔로워 | `follower_count` | 오른쪽 |
| 참여율 | `engagement_rate` | 오른쪽 |
| 카테고리 | `interests[0]` | 왼쪽 |
| 등급 | `collaboration_tier` | 가운데 |

### 차트 데이터

**팔로워 분포 (도넛 차트)**:
```javascript
// follower_count 기준 그룹핑
const distribution = {
  "1M+": profiles.filter(p => p.follower_count >= 1000000).length,
  "500K-1M": profiles.filter(p => p.follower_count >= 500000 && p.follower_count < 1000000).length,
  "100K-500K": profiles.filter(p => p.follower_count >= 100000 && p.follower_count < 500000).length,
  "<100K": profiles.filter(p => p.follower_count < 100000).length,
};
```

**카테고리 분포 (막대 차트)**:
```javascript
// interests 배열에서 첫 번째 카테고리 집계
const categoryCount = {};
profiles.forEach(p => {
  const category = p.interests?.[0] || '기타';
  categoryCount[category] = (categoryCount[category] || 0) + 1;
});
```

---

## 프로필 이미지 처리

### MCP 툴 호출

```javascript
// get_profile_image 툴 호출
const imageResult = await mcp.callTool('get_profile_image', {
  user_id: profile.user_id
});
```

### 이미지 다운로드 및 저장

```javascript
import fs from 'fs';
import path from 'path';

async function downloadProfileImage(userId, imageUrl) {
  const tempDir = './temp';
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true });
  }

  const response = await fetch(imageUrl);
  const buffer = await response.arrayBuffer();
  const filePath = path.join(tempDir, `profile_${userId}.jpg`);

  fs.writeFileSync(filePath, Buffer.from(buffer));
  return filePath;
}
```

### HTML에서 참조

```html
<div class="profile-card">
  <img src="./temp/profile_12345678.jpg"
       class="profile-image"
       style="width: 80px; height: 80px; border-radius: 50%; object-fit: cover;">
  <div class="profile-info">
    <h3>@username</h3>
    <p>팔로워: 1.2M</p>
  </div>
</div>
```

### 정리 (PPT 생성 후)

```javascript
import fs from 'fs';
import path from 'path';

function cleanupTempImages() {
  const tempDir = './temp';
  if (fs.existsSync(tempDir)) {
    const files = fs.readdirSync(tempDir);
    files.forEach(file => {
      if (file.startsWith('profile_')) {
        fs.unlinkSync(path.join(tempDir, file));
      }
    });
  }
}
```

---

## 데이터 가공 패턴

### 숫자 포맷팅

```javascript
function formatNumber(num) {
  if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
  if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
  return num.toString();
}

function formatPercent(num) {
  return num.toFixed(1) + '%';
}
```

### 국가 코드 → 국가명

```javascript
const countryNames = {
  'KR': '대한민국',
  'TH': '태국',
  'VN': '베트남',
  'ID': '인도네시아',
  'JP': '일본',
  'US': '미국',
  // ...
};
```

### 협업 등급 스타일

```javascript
const tierStyles = {
  'Ready - Premium': { bg: '#1E3A5F', color: '#FFFFFF' },
  'Ready - Professional': { bg: '#0D9488', color: '#FFFFFF' },
  'Potential - High': { bg: '#F97316', color: '#FFFFFF' },
  'Potential - Basic': { bg: '#64748B', color: '#FFFFFF' },
  'Personal Only': { bg: '#E2E8F0', color: '#334155' },
};
```

### 정렬 기준

```javascript
// 팔로워 수 기준 내림차순
profiles.sort((a, b) => b.follower_count - a.follower_count);

// 참여율 기준 내림차순
profiles.sort((a, b) => b.engagement_rate - a.engagement_rate);

// 복합 점수 (팔로워 + 참여율 가중)
profiles.sort((a, b) => {
  const scoreA = (a.follower_count / 1000000) * 0.4 + a.engagement_rate * 0.6;
  const scoreB = (b.follower_count / 1000000) * 0.4 + b.engagement_rate * 0.6;
  return scoreB - scoreA;
});
```
