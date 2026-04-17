# 정결 Design Studio — 인테리어 견적·설문 시스템

## 프로젝트 개요
인테리어 리모델링 견적 작성, 자재/노무비 관리, 고객 설문 수집 및 관리를 위한 통합 웹 시스템입니다.

---

## 데이터 스토리지

| 항목 | 서비스 | 비고 |
|------|--------|------|
| 고객 설문 데이터 | **Supabase** `survey_responses` | 젠스파크 구독 독립적 |
| 자재/노무비/공정 DB | localStorage | 브라우저 로컬 저장 |
| 견적 데이터 | localStorage (`iq_estimates`) | 브라우저 로컬 저장 |
| 관리자 로그인 | **Supabase Auth** | 이메일/패스워드 인증 |

**Supabase 프로젝트:** https://isrimiwqqytzzqjovtot.supabase.co

---

## 완료된 기능

### 🏠 고객 설문 페이지 (survey.html)
- 5-PART 구성의 인테리어 사전 준비 체크리스트
- 모바일 최적화 UI (max-width 620px)
- 실시간 진행률 표시
- 제출 시 **Supabase** `survey_responses` 테이블에 저장 (메인)
- 젠스파크 내부 API(`tables/survey_responses`)에도 병행 저장 (백업)
- 제출 완료 화면 표시

**설문 구성 (v3.0):**
- **고객 기본정보**: 성함, 연락처
- **PART 01 – 기본 정보 & 현장 정보 (통합)**
  - Q1 리모델링 목적 (복수 선택)
  - Q2 공사 시작 희망일 & 입주 마감일
  - Q3 예산 마지노선 (1,500~2,500만 / 2,500~3,500만 / 3,500~5,000만 / 5,000~8,000만 / 8,000만 이상)
  - Q4 핵심 공간 1순위
  - Q5 생략 가능 부분
  - Q6 개선하고 싶은 공간 3가지
  - Q7 가족 구성원
  - **현장 정보 (PART01 통합):**
    - Q8 현장 주소
    - Q9 평수 (전용면적 평/㎡)
    - Q10 주거 유형 (아파트/빌라/단독/오피스텔/상가/기타)
    - Q11 현재 공간의 상태 (4가지 옵션: 거주중 부분공사 희망 / 거주중 보관이사 예정 전체공사 / 매매후 공사 예정 / 세입자용 공사)

- **PART 02 – 공사 범위 & 공간별 요구사항**
  - Q12 공사 범위 (다중선택): 확장공사, 창호교체, 시스템에어컨, 욕실공사, 전기/조명, 리폼필름·도배, 현관·베란다 타일, 베란다 도장, 벽체 철거·구조변경, 마루교체, 전체 공사 올리모델링
  - Q13 주방 형태 / Q14 주방 세부 요청사항
  - Q14 욕실 개수 / Q14 욕실 스타일

- **PART 03 – 마감재 & 스타일**
  - Q15 바닥재 종류
  - Q16 벽체/도배 선호 (다중선택): 합지도배, 실크도배, 페인트(도장), 필름·아트월 포인트, 타일·석재·아트월 포인트, 미정
  - Q17 조명 밝기 (단일선택): 아주 밝은 6500K / 은은한 밝기 4000K / 노란 불빛 3000K
  - Q18 인테리어 스타일 (다중선택): 모던/미니멀, 내추럴/우드톤, 미정(상담후 협의)
  - Q19 선호 색상 계열

- **PART 04 – 맞춤 가구 계획**
  - Q20 맞춤 가구 (다중선택): 주방 수납장(키큰장), 침실 붙박이장, 작은방 붙박이장, 서재 책장 수납장, 파우더룸 화장대 제작, 드레스룸 시스템장, 현관 신발장, 욕실 하부장

- **PART 05 – 설비 & 기타**
  - Q21 시스템 에어컨
  - Q22 난방 요청 (다중선택): 보일러 교체, 분배기 교체, 난방 배관 전체 교체, 해당없음
  - Q23 현재 불편한 점 (자유기술)
  - Q24 참고 이미지/레퍼런스
  - Q25 추가 요청사항

---

### 🛠️ 관리자 페이지 (admin.html) - 완전 재작성 v3.0

**수정 이력:**
- 함수 중복 선언 오류 수정 (`updateBulkBtn` 이중 정의 제거)
- 모든 Arrow function을 일반 function으로 변환 (브라우저 호환성)
- `const`/`let` 변수를 `var`로 변환 (구형 브라우저 호환성)
- `initPage()` 실행을 `DOMContentLoaded` 이벤트로 안전하게 이동
- 모달 배경 클릭 처리 로직 단순화 (드래그 버그 제거)
- Template literal 제거, string 연결 방식으로 변환
- 전체 코드 안정화 및 재작성

**탭 구성:**
1. **공정 관리** – 공정 카테고리 추가/수정/삭제/순서변경
2. **자재 관리** – 자재 DB (CSV 내보내기/가져오기, 일괄수정, 복사)
3. **노무비 관리** – 노무비 DB (동일 기능)
4. **단위 관리** – 자재/노무 단위 마스터 관리
5. **요율 기본값** – 간접노무비, 보험료, 관리비, 이윤, VAT 설정
6. **시공사 정보** – 회사명, 대표자, 연락처, 주소
7. **계약관리** – 연간 매출 대시보드, 월별 계약 현황, 계약 목록
8. **고객 설문** – 실시간 설문 응답 조회, 상태 관리, 메모

---

### 📊 견적 작성 페이지 (index.html)
- 공정별 자재·노무비 세부내역 작성
- 원가계산서 자동 생성 (직접비 + 간접비 + VAT)
- 견적서 저장 (localStorage)
- 계약완료 처리

---

## 파일 구조

```
index.html          — 견적 작성 페이지
admin.html          — 관리자 페이지 (v3.0 완전 재작성)
survey.html         — 고객 설문 페이지 (v3.0)
css/
  style.css         — 공통 CSS
  estimate.css      — 견적서 인쇄용 CSS
js/
  storage.js        — localStorage 관리 (공정, 자재, 노무비, 단위)
  app.js            — 견적 작성 메인 로직
  estimate-save.js  — 견적 저장/계약완료 처리
  pdf.js            — PDF 출력 유틸리티
libs/
  fontawesome.min.css
  html2canvas.min.js
  jspdf.umd.min.js
```

---

## API 엔드포인트

| 기능 | 메서드 | 경로 |
|------|--------|------|
| 설문 목록 조회 | GET | `tables/survey_responses?limit=200` |
| 설문 상태 변경 | PATCH | `tables/survey_responses/{id}` |
| 설문 삭제 | DELETE | `tables/survey_responses/{id}` |
| 설문 제출 | POST | `tables/survey_responses` |

---

## 데이터 모델

### survey_responses 테이블
| 필드 | 타입 | 설명 |
|------|------|------|
| id | text | UUID (자동생성) |
| clientName | text | 고객 성함 |
| clientPhone | text | 연락처 |
| purpose | array | 리모델링 목적 (복수) |
| startDate | text | 공사 시작 희망일 |
| moveInDate | text | 입주 마감 희망일 |
| budget | text | 예산 범위 |
| priority1 | text | 핵심 공간 1순위 |
| priority2 | text | 생략 가능 부분 |
| improveSpaces | text | 개선 희망 공간 |
| familyInfo | text | 가족 구성원 |
| siteAddress | text | 현장 주소 |
| siteSize | text | 평수 (전용면적) |
| aptType | text | 주거 유형 |
| moveStatus | text | 현재 공간의 상태 |
| constructionScope | array | 공사 범위 (복수) |
| kitchenStyle | text | 주방 형태 |
| kitchenNotes | text | 주방 세부 요청 |
| bathroomCount | text | 욕실 개수 |
| bathroomStyle | text | 욕실 스타일 |
| floorMaterial | text | 바닥재 종류 |
| wallStyle | array | 벽체/도배 선호 (복수) |
| lightingStyle | text | 조명 밝기 (K값) |
| overallStyle | array | 인테리어 스타일 (복수) |
| colorPrefer | text | 선호 색상 |
| customFurniture | array | 맞춤 가구 (복수) |
| systemAC | text | 시스템 에어컨 |
| heating | array | 난방 요청 (복수) |
| concerns | text | 현재 불편한 점 |
| referenceImages | text | 레퍼런스 링크 |
| additionalNotes | text | 추가 요청사항 |
| adminStatus | text | 관리자 처리상태 (신규/확인중/미팅완료/계약완료) |
| adminMemo | text | 관리자 메모 |
| submittedAt | datetime | 제출 시각 (ms) |

---

## 미구현/향후 개발 예정

- [ ] 견적서 계약완료 토글 UI (index.html)
- [ ] 계약관리 대시보드 심화 기능
- [ ] 이메일/문자 자동 발송 연동
- [ ] 고객 포털 (설문 응답 확인 페이지)
- [ ] 공사 진행 현황 관리

---

## 현재 날짜: 2026-04-17
