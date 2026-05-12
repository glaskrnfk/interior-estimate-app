# 정결 Design Studio — 인테리어 견적·설문 시스템

## 프로젝트 개요
인테리어 리모델링 견적 작성, 자재/노무비 관리, 고객 설문 수집 및 관리를 위한 통합 웹 시스템입니다.

---

## 데이터 스토리지

| 항목 | 서비스 | 비고 |
|------|--------|------|
| 고객 설문 데이터 | **Supabase** `survey_responses` | 젠스파크 구독 독립적 |
| 자재/노무비/공정 DB | localStorage | 브라우저 로컬 저장 |
| 견적 데이터 | **Supabase** `estimates` + localStorage | 클라우드 우선, 로컬 캐시 폴백 |
| 상담일지 데이터 | **Supabase** `consultation_logs` | 클라우드 단독 저장 |
| 관리자 로그인 | **Supabase Auth** | 이메일/패스워드 인증 |

**Supabase 프로젝트:** https://isrimiwqqytzzqjovtot.supabase.co

---

## 기능 구현 현황 (2026-05-12 기준)

### ✅ 2026-05-12 최신 세션 완료 작업 — 마감자재 상담일지 기능 전체 구현

| ID | 기능 | 파일 |
|----|------|------|
| #18-A | **상담일지 탭 추가** — 탭바에 `<i class="fas fa-book-open"> 상담일지` 버튼 추가, `switchTab('tab-consult', …)` 연결, 탭 열릴 때 자동으로 목록 로드 | admin.html |
| #18-B | **상담일지 폼 UI** — 기본정보(방문일·성함·연락처·공사희망일정·이메일·동/아파트·호수·평형), 11개 공종 상담내역 테이블(체크박스+제품번호), 요청사항 메모란 | admin.html |
| #18-C | **11개 공종 상담내역 테이블** — 도배·마루·커튼&블라인드·싱크대·욕실·샷시·가구·조명·발코니확장·철거·도장 각 항목별 세부 옵션 체크박스 + 제품번호/메모 입력란 (`CL_CATS` 배열로 동적 생성) | admin.html |
| #18-D | **Supabase CRUD** — `loadConsultList()` (GET), `clSave()` (POST/PATCH), `clDelete()` (DELETE) + `consultation_logs` 테이블 연동. localStorage fallback 없이 클라우드 단독 저장 | admin.html |
| #18-E | **목록 렌더링** — 방문일 역순 정렬, 고객명·연락처·주소 실시간 검색, 연도 필터, 전체 건수 뱃지 (`consult-count`), 목록 행 클릭 시 폼 자동 채우기 | admin.html |
| #18-F | **견적서 연동** — `clLoadEstimate()` : Supabase `estimates` 테이블 우선 + localStorage 폴백. 인라인 picker에서 선택 시 고객명 자동 입력 + `linked_estimate_id/title` 저장 | admin.html |
| #18-G | **공란 출력** — `clPrint(true)` : 폼 값 무시, 빈 칸 + 체크박스 미체크 상태로 흑백 A4 출력. `@media print` 전용 레이아웃으로 탭바/헤더 숨김 | admin.html |
| #18-H | **작성내용 출력** — `clPrint(false)` : 현재 폼 내용 + 체크박스 ☑/☐ 표시 + 고객정보 테이블 + 요청사항 + 서명란으로 흑백 A4 1장 출력 | admin.html |
| #18-I | **CSS 스타일** — `.cl-*` 전용 CSS + `@media print` 출력 전용 스타일 (흑백 라인 기반, `#cl-print-area` 격리 출력) | admin.html |
| #18-J | **switchTab 패치 확장** — 기존 `tab-contract-tmpl` 패치 유지 + `tab-consult` 열릴 때 `clInitTable()` → `loadConsultList()` 자동 호출 추가 | admin.html |

#### Supabase 테이블: `consultation_logs`
| 컬럼 | 타입 | 설명 |
|------|------|------|
| `id` | uuid (PK) | 자동 생성 |
| `visit_date` | date | 방문(상담)일 |
| `client_name` | text | 고객 성함 |
| `client_phone` | text | 연락처 |
| `work_from` / `work_to` | text | 공사 희망일정 |
| `client_email` | text | 이메일 |
| `address_dong` / `address_ho` / `address_size` | text | 주소 정보 |
| `memo` | text | 요청사항/특이사항 |
| `items` | jsonb | 공종별 체크박스+제품번호 `{공종: {checked:[], product:''}}` |
| `linked_estimate_id` | text | 연동 견적서 ID |
| `linked_estimate_title` | text | 연동 견적서 제목 |
| `created_at` / `updated_at` | timestamptz | 자동 관리 |

---

### ✅ 2026-05-07 최신 세션 완료 작업 (4차) — 계약서·영수증 UX 개선

| ID | 기능 | 파일 |
|----|------|------|
| #17-A | **도급금액 만원 단위 절삭** — `buildInteriorContract`, `buildGeneralContract`, `calcPayments` 모두 `Math.floor(n/10000)*10000` 적용. 천원 이하 자투리 금액이 계약서·한글금액·지급스케줄에 반영되지 않도록 통일 | admin.html |
| #17-B | **관리자 특약사항 메모란 중복 제거** — 기존 "발주자 요청 특약"(`ct-special`)·"관리자 특약"(`ct-admin-special`) 2개 란을 **"특약 사항 (관리자 전용)" 1개**로 통합. `allSpecial` 로직도 단순화 (`adminSpecial` 단독 사용) | admin.html |
| #17-C | **영수증 부가세 수동 수정 가능** — 공급가액 입력 시 10% 자동계산 유지, 부가세(`rv`) 필드를 직접 수정하면 합계 즉시 재계산. 수정 시 오렌지 테두리·tooltip으로 "수동 수정됨" 시각 표시 | js/receipt.js |

### ✅ 2026-05-07 최신 세션 완료 작업 (3차) — JS 코드 노출 완전 차단

| ID | 기능 | 파일 |
|----|------|------|
| #16-A | **`openReceiptWindow` 중복 제거** — admin.html 내 약 220줄의 중복 함수 코드 완전 제거, `js/receipt.js` 단일 소스로 통합 | admin.html |
| #16-B | **`js/receipt.js` `<script src>` 로드 추가** — admin.html HTML 파서 영역에서 영수증 기능을 완전히 분리해 파서 충돌 원천 차단 | admin.html |
| #16-C | **`js/receipt.js` v3.0 전면 재작성** — 데이터(JSON)를 팝업 HTML `<script>` 인라인에 직접 포함 → `cross-origin Blob URL` 간 `window.__RC_DATA__` 주입 타이밍 문제 완전 해소. Unicode escape 오류도 함께 수정 | js/receipt.js |
| #16-D | **DOMContentLoaded 핸들러 검증 완료** — ① `취소` 옵션 보완, ② `switchContractTmpl('interior')` 초기화, ③ `populateContractEstSelect()` 자동 호출, ④ `switchTab` 패치(회사정보·날짜·견적목록·미리보기 자동 주입) 정상 동작 확인 | admin.html |

### ✅ 2026-05-07 최신 세션 완료 작업 (2차)

| ID | 기능 | 파일 |
|----|------|------|
| #15-A | **견적 선택 드롭다운 → 선택된 견적 자동채우기** — 기존 최신 견적 고정 방식에서, 드롭다운에서 원하는 견적을 선택 후 "자동 채우기" 클릭 시 해당 견적 정보 반영. 탭 전환 시 목록 자동 갱신 | admin.html |
| #15-B | **도급금액 부가세 제외 표기 수정** — 도급금액 표에 `금 N원 (부가세 별도)` 로 표기. 부가세 포함 금액(×1.1)도 참고 표시. 제3조 본문에도 "부가세 별도" 명시 및 세금계산서 별도 정산 안내 추가 | admin.html |
| #15-C | **제7조 하자담보책임 기간 세분화** — 마감재(도배·장판·타일·마루·도장 등) **1년**, 구조·방수공사(목공사·창호·방수) **2년**으로 표로 분리. 제외사유 목록 형식으로 개선 | admin.html |
| #15-D | **제12조 저작권 보호 조항 추가** — 설계도서(도면·시방서·3D 렌더링 등) 저작권은 "을"에 귀속, "갑"의 서면동의 없는 복제·배포·전시·양도 금지 | admin.html |
| #15-E | **제13조 기타 사항 조항 추가** — ① 인허가·민원해결 협조 및 비용 부담, ② 상호합의로 계약 변경·수정 가능(서면 보관), ③ 미규정 사항은 관련 법령 및 합의 특약으로 처리 | admin.html |
| #15-F | **관리자용 특약사항란** — `#ct-admin-special` textarea: 내용 있을 때만 계약서에 【특약사항】 블록 출력, 없으면 미출력 (기존 구현 유지 확인) | admin.html |
| #15-G | **영수증 발행 기능** — "영수증 발행" 버튼 → 새 팝업 창에서 공급가액 입력 시 부가세(10%) 자동계산·합계 표시, 비고·발행일 입력, 발주자·시공자 정보 자동입력, **대표 도장(iq_stamp) 자동 날인**, A4 1장 2분할(공급자 보관·공급받는자 보관), 인쇄 버튼 지원 | admin.html |
| #15-H | **DOMContentLoaded 개선** — 초기화 시 `populateContractEstSelect()` 자동 호출, 계약서 탭 전환 시에도 견적 목록 갱신 | admin.html |

### ✅ 2026-05-07 이전 세션 완료 작업 (1차)

| ID | 기능 | 파일 |
|----|------|------|
| #14-A | **인테리어 표준계약서 전면 재작성** — 공정위 표준약관 준용 13개 조항, 계약 당사자 테이블, 공사 개요 테이블, 대금지급 스케줄 테이블 포함 | admin.html |
| #14-B | **계약서 입력 폼 전면 확장** — 발주자(성명/주민사업자번호/주소/전화FAX), 공사내용(현장주소/목적물/금액/기간), 대금지급스케줄(계약금·중도금·잔금 % 편집+금액자동계산), 수급인(상호/대표자/사업자번호/전화/FAX/주소/계약일), 특약사항 | admin.html |
| #14-C | **시공사 정보 탭 확장** — 사업자등록번호, 이메일, 비고(REMARK) 필드 추가 | admin.html |
| #14-D | **견적서 REMARK 컬럼 연동** — 시공사 정보 탭의 비고란 내용이 견적서 비고/REMARK 영역에 자동 표시 | js/app.js |
| #14-E | **downloadContractPDF 완전 재검증** — jsPDF UMD 네임스페이스 안전 탐색, px→mm 정확한 비율 계산, 페이지별 슬라이스+흰배경 채우기, 파일명 `인테리어계약서_<고객명>.pdf` | admin.html |
| #14-F | **calcPayments() 함수 추가** — 계약금/중도금/잔금 % 실시간 금액 계산 및 합계 검증 | admin.html |
| #14-G | **autoFillContractFromEst 개선** — 새 필드(발주자전화, 수급인FAX·사업자번호·주소) 자동 채우기 연동 | admin.html |
| #14-H | **switchTab 패치 개선** — 계약서 탭 전환 시 수급인 FAX·사업자번호·주소 포함 자동 주입 | admin.html |
| #14-I | **storage.js loadCompanyInfo() 별칭** — admin.html에서 `loadCompanyInfo()` 호출 시 `loadCompany()` 위임 | js/storage.js |

### ✅ 이전 세션에서 완료된 작업

| ID | 기능 | 파일 |
|----|------|------|
| #2 | 관리자 공종명 변경 시 자재/노무 목록 즉시 동기화 (BroadcastChannel 발신) | admin.html |
| #3 | 세부내역 편집 품목명 팝업 → 관리자 DB 등록 버튼 (자재/노무 선택) | js/app.js |
| #4 | 헤더 **새로만들기** 버튼 + 미저장 변경사항 확인 모달 | index.html |
| #5 | 직접공사비 합계 행: 자재 소계 / 노무 소계 분리 표시 + 합계 강조 | index.html |
| #7 | 시공 기간 설정 블록: 시작·종료일 입력 → 주말/공휴일 제외 실제 시공일수 자동계산 | index.html |
| #8 | BroadcastChannel `proc_renamed` 수신 → detailRows 카테고리 동기화 | index.html |
| #9 | SVC 라벨 제거 · 행 타입별 색상 구분 · isNonEst 토글 버튼 추가 | js/app.js |
| #11 | PDF 캐시 버그 수정: doPDF 전 buildEstDoc 강제 재호출 패치 | index.html, pdf.js |
| #12 | index.html + admin.html 반응형 CSS 개선 (모바일 600px · 태블릿 900px) | index.html, admin.html |
| #13 | 계약서 템플릿 탭 추가 (인테리어/도급 계약서 HTML 생성) | admin.html |

### ✅ 버그 수정 내역 (누적)

| 항목 | 수정 내용 |
|------|-----------|
| **JS 코드 화면 노출 버그** | `printContractTmpl()` 내 `</style>`, `</head>`, `</body>` 태그 미이스케이프 → `<\/...>` 수정 |
| **설문 목록 미표시** | `initPage()`가 Supabase 설문 데이터를 `_surveyRecords`에 저장하지 않던 버그 수정 |
| **설문 응답 배열 필드 파싱 오류** | `_parseArr()` 헬퍼 추가 — JSON 문자열/배열 혼합 안전 처리 |
| **Supabase 인증 실패 구분** | 401/403 → 'AUTH_FAIL' 에러로 구분, 만료 메시지 별도 표시 |
| **중복 DOMContentLoaded 리스너** | 단일 핸들러로 통합 |
| **renderSurveyList onclick XSS** | `data-sid` / `data-client` / `data-site` attribute 방식으로 변경 |
| **switchTab 계약서 탭 패치** | 계약서 탭 전환 시 전체 시공사 정보·오늘날짜 자동 주입 정상화 |

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
6. **시공사 정보** – 회사명·대표자·사업자번호·전화·FAX·이메일·주소 + **비고(REMARK)** ← 신규
7. **계약관리** – 연간 매출 대시보드, 월별 계약 현황, 계약 목록
8. **고객 설문** – 실시간 설문 응답 조회, 상태 관리, 메모 (Supabase `survey_responses`)
9. **계약서 템플릿** *(#13/#14 대폭 강화)* – 인테리어 표준계약서(공정위 표준약관 준용)/도급 계약서 생성·인쇄·PDF 저장

**계약서 템플릿 입력 폼 (신규 필드 포함):**
- **발주자(甲)**: 성명/상호, 주민(사업자)번호, 주소, 전화/FAX
- **공사 내용**: 현장주소, 공사목적물, 도급금액(부가세 별도), 착공일·준공일
- **대금 지급 스케줄**: 계약금/중도금/잔금 비율(%) 편집 + 금액 자동계산 + 합계 검증
- **수급인(乙)**: 상호, 대표자, 사업자번호, 전화, FAX, 주소
- **계약일, 특약사항(발주자 요청), 관리자 특약(내용 없으면 미출력)**
- **자동 채우기**: 드롭다운에서 견적서 선택 후 일괄 가져오기

**계약서 조항 구성 (인테리어 표준계약서 v2.0):**
| 조항 | 내용 |
|------|------|
| 제1조 | 계약의 목적 |
| 제2조 | 공사 범위 |
| 제3조 | 도급 금액 및 대금 지급 (부가세 별도, 세금계산서 별도 정산) |
| 제4조 | 공사 기간 |
| 제5조 | 설계 변경 및 추가 공사 |
| 제6조 | 재료 및 시공 |
| 제7조 | 하자 담보 책임 (마감재 1년 / 목공·창호·방수 2년) |
| 제8조 | 검사 및 인도 |
| 제9조 | 안전 관리 |
| 제10조 | 계약 해제 및 손해 배상 |
| 제11조 | 분쟁 해결 |
| 제12조 | 저작권 보호 (설계도서 저작권 "을" 귀속) |
| 제13조 | 기타 사항 (인허가 협조, 계약 변경, 미규정 합의) |

**영수증 발행 기능:**
- 계약서 탭 상단 「영수증 발행」버튼 → 새 팝업 창
- 공급가액 입력 시 부가세(10%) 자동계산·합계 표시
- 비고(계약금/중도금/잔금 등), 발행일 입력
- 발주자·발행자 정보 자동 입력
- **대표 도장(localStorage `iq_stamp`) 자동 날인**
- A4 1장 2분할 (공급받는자 보관 / 공급자 보관)
- 브라우저 인쇄(Ctrl+P)로 A4 출력

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

---

### 📅 공정표 관리 (schedule.html) — v2.0 업그레이드

**신규 기능:**
- **Ctrl+드래그 즉시 복사** — 복사모드 버튼 없이 Ctrl(⌘) 누른 채 드래그하면 공정이 복사됨
- **복사모드 버튼** — 전용 복사모드 ON/OFF (모든 드래그가 복사로 동작)
- **모바일 롱프레스 복사** — 0.6초 길게 눌러 복사 소스 선택 후 대상 날짜 탭
- **Ctrl 힌트 배너** — Ctrl 키 누르는 순간 화면 상단에 안내 배너 표시
- **공종별 인력/인건비 상세 테이블** — 인력현황 패널 > "공종별 상세" 토글 클릭 시 공종별 집계 표 표시
- **인력현황 패널 토글 버튼** — 헤더 버튼으로 패널 열기/닫기 (기본 닫힘)
- **일별 인력 표시** — 인력현황 패널 열면 각 날짜 칸에 당일 투입 인원/비용 표시
- **고객 입주일 강조** — 보라색 테두리/배경, 공정표 셀에 🏠 표시
- **마감일 강조** — 분홍색 테두리/배경, 공정표 셀에 🏁 표시 (미지정 시 종료일이 자동 마감)
- **마감일 목록 카드** — 카드 뷰에서 입주일/마감일 배지 표시
- **인쇄 헤더 개선** — 인쇄 시 입주일·마감일 정보 포함
- **휴무일 모달 빠른 선택** — 정부 대체휴무일 / 현장 사정 / 작업자 휴가 / 소음 제한일 원클릭 입력
- **달력 내 휴무 해제 버튼** — 각 날짜 칸 하단에서 바로 휴무 토글

**Supabase schedules 테이블 컬럼:**
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | uuid | PK (gen_random_uuid()) |
| created_at | timestamptz | 생성 시각 |
| updated_at | timestamptz | 수정 시각 |
| site_name | text | 현장명 |
| client_name | text | 고객명 |
| start_date | date | 공사 시작일 |
| end_date | date | 공사 종료일 |
| move_in_date | date | 고객 입주일 |
| deadline_date | date | 마감 지정일 |
| status | text | 상태 (입력중/수정중/최종) |
| source | text | 연결 출처 (계약관리/고객설문) |
| note | text | 비고 |
| tasks | jsonb | 공정 데이터 {dateKey: [{id, cat, text, sub, flag, crew, cost, crewMemo}]} |
| custom_hols | jsonb | 지정 휴무일 {dateKey: label} |

---

## 미구현/향후 개발 예정

- [ ] 견적서 계약완료 토글 UI (index.html)
- [ ] 계약관리 대시보드 심화 기능
- [ ] 이메일/문자 자동 발송 연동
- [ ] 고객 포털 (설문 응답 확인 페이지)
- [ ] 공정표 공종별 인건비 월별 통계 차트

---

## 현재 날짜: 2026-05-07

---

## 계약서 기능 요약 (빠른 참고)

```
[계약서 탭 열기]
  → 수급인(시공사) 정보 자동 주입
  → 견적서 드롭다운 목록 자동 갱신
  → 계약일 오늘 날짜 자동 입력

[견적서 선택 → 자동 채우기 클릭]
  → 발주자명·주소·전화 → ct-client-*
  → 공사현장·공사명 → ct-site-*
  → 도급금액(부가세 제외) → ct-amount
  → 공사기간 → ct-start / ct-end
  → 수급인 정보 → ct-company / ct-rep / ct-tel 등

[영수증 발행 버튼]
  → 팝업 창에서 공급가액 입력
  → 부가세(10%) 자동계산
  → 대표 도장 자동 날인
  → A4 1장 2분할 인쇄
```
