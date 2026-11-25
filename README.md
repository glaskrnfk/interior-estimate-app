# 정결 Design Studio — 인테리어 견적 관리 시스템

> 견적 작성 · 자재/노무비 DB · 전자계약 · 영수증 발행 · 고객 포털을 통합한 인테리어 업무 관리 시스템

---

## 📁 파일 구조

```
├── index.html          # 견적 작성 (메인)
├── admin.html          # 관리자 어드민
├── client.html         # 고객 포털 (계약서·공정표·영수증 통합)
├── schedule.html       # 공정표 관리
├── survey.html         # 고객 사전 체크리스트 (직접 발송용)
├── survey-public.html  # 인테리어 스타일 진단 (SNS 홍보용)
├── js/
│   ├── storage.js      # Supabase CRUD 공통 레이어
│   ├── app.js          # 견적 작성 로직
│   ├── receipt.js      # 영수증 발행
│   └── estimate-save.js
├── css/
│   └── style.css
└── libs/               # 외부 라이브러리 (FontAwesome, html2canvas, jsPDF)
```

---

## 🗄️ Supabase 테이블 구조

| 테이블 | 용도 |
|---|---|
| `master_materials` | 자재 DB |
| `master_labors` | 노무비 DB |
| `company_settings` | 시공사 정보·요율·단위·공정 |
| `contracts` | 전자계약서 (서명·토큰 포함) |
| `receipts` | 영수증 발행 이력 |
| `schedules` | 공정표 |
| `survey_responses` | 고객 사전 체크리스트 응답 |
| `consultation_logs` | 마감자재 상담일지 |

### contracts 테이블 주요 컬럼
```sql
id                    text PRIMARY KEY
estimate_id           text              -- localStorage 견적서 연결
client_name           text
site_name             text
site_address          text
contract_amount       bigint
vat_amount            bigint
total_amount          bigint
contract_data         jsonb             -- 계약서 입력 필드 전체 (form_data)
status                text DEFAULT '작성중'  -- 작성중·발송됨·서명완료
access_token          text              -- 고객 포털 접근 토큰
token_expires_at      timestamptz
client_phone_last4    text              -- 인증용 연락처 뒷 4자리
signature_data        text              -- 고객 서명 이미지 (base64)
signed_at             timestamptz
client_confirmed_name text
client_confirmed_phone text
client_confirmed_bizno text             -- 주민번호/사업자번호
created_at            timestamptz DEFAULT now()
updated_at            timestamptz DEFAULT now()
```

### receipts 테이블 주요 컬럼
```sql
id              text PRIMARY KEY
contract_id     text              -- contracts.id 연결
estimate_id     text
client_name     text
site_name       text
supply_amount   bigint
vat_amount      bigint
total_amount    bigint
memo            text
issued_at       date
receipt_data    jsonb             -- 도장·회사정보 등 포함
created_at      timestamptz DEFAULT now()
updated_at      timestamptz DEFAULT now()
```

---

## 🔐 Supabase RLS 정책

```sql
-- contracts
ALTER TABLE contracts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_token_select" ON contracts FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY "anon_token_update" ON contracts FOR UPDATE TO anon, authenticated USING (true) WITH CHECK (true);

-- receipts
ALTER TABLE receipts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_receipt_select" ON receipts FOR SELECT TO anon, authenticated USING (true);

-- schedules
ALTER TABLE schedules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anon_schedule_select" ON schedules FOR SELECT TO anon, authenticated USING (true);
```

---

## 🚀 전자계약 발행 순서 (올바른 플로우)

```
1. 계약서 작성
   admin.html → 계약서 템플릿 탭 → 내용 입력
   (도장 on/off, 공정표 포함 여부 설정)
   → [저장] 버튼

2. 고객 링크 발송 (1회만)
   저장 후 → [고객 링크 발송] 버튼
   → 연락처 뒷 4자리 입력 → [링크 생성 및 저장]
   → 메시지 복사 → 카카오톡 발송

3. 고객이 링크 접속
   계약서 확인 → 주민번호 입력 → 서명 → 제출

4. 영수증 발행 (나중에 언제든지)
   admin.html → 계약서 탭 → [영수증 발행] 버튼
   → 금액 입력 → [DB 저장]
   → 고객이 기존 링크 재접속 시 영수증 탭 자동 표시
   (별도 링크 발송 불필요)

5. 공정표 연결 (나중에 언제든지)
   schedule.html에서 공정표 작성·저장
   → admin.html 계약관리 탭 → 🔗 버튼으로 연결
   → 고객이 기존 링크 재접속 시 공정표 탭 자동 표시
   (별도 링크 발송 불필요)
```

> **핵심:** 링크는 계약서 기준으로 1회만 발송합니다.  
> 이후 공정표·영수증이 추가되면 고객이 **같은 링크**로 재접속하면 자동으로 보입니다.

---

## 📋 고객 설문 링크 2종

| 링크 | 용도 | 발송 방법 |
|---|---|---|
| `survey.html` | 사전 체크리스트 | 고객에게 직접 카카오톡 발송 |
| `survey-public.html` | 인테리어 스타일 진단 | SNS·블로그 프로필 등록 (공개용) |

admin.html → 고객 설문 탭 → 링크 복사 버튼에서 두 링크 모두 복사 가능합니다.

---

## 📅 업데이트 이력

### 2026-11-26 — 무료견적 개별 기록 확인·삭제 (관리자)
- `admin.html` 홍보 링크 유입 현황 팝업: 날짜(▸)를 누르면 그날의 개별 기록이 시각(한국시간)·평형·공사유형·항목 수와 함께 나타나고, 기록마다 삭제 버튼으로 테스트 기록을 지울 수 있음(확인창 후 삭제, `type=funnel` 기록만 삭제 가능).
- 같은 팝업에 '유입 시간대' 그래프(한국시간, 무료견적 완료 기준) 추가. SQL 변경 없음(관리자 로그인 상태의 삭제 권한 사용).

### 2026-11-26 — 홍보 링크(survey-public.html) 4단계 화면 + 문구 개편
- 긴 한 페이지를 4단계로 분리: 공간 → 스타일 → 공사범위① 구조·설비 → 공사범위② 마감·가구. 상단 진행 바에 'STEP n/4', 단계별 응원 문구(3개 파트 남았어요 / 절반 왔어요 / 거의 다 왔어요), 단계 표시 칩. 단계마다 필수 응답 확인 후 다음으로.
- 마지막 버튼 문구: '우리집 예상견적 바로 확인하기'. 커버와 진행 바에 '예상견적은 개인정보 입력 없이 확인 가능합니다' 안내 추가.
- 공사 유형(구 '리모델링 목적')을 4개 단일 선택으로 변경: 전체 리모델링 / 입주 전 부분공사 / 거주 중 부분공사 / 전·월세용 부분공사.
- '전체 리모델링' 선택 시 시스템에어컨, 창호 전체교체, 벽체·천장·단열, 전기 신규배선, 안방·공용 욕실 전체, 타일(현관·세탁실·베란다), 도장(보조공간), 수납(현관장·붙박이장), 준공청소 자동 체크. 고객이 해제·추가 가능하고, 다른 유형으로 바꾸면 자동 체크분만 해제.
- 목공사 그룹에 '문 / 문틀 교체' 추가: 1조 55만원 × 평형별 개수(10평대 3조·20평대 4·30평대 5·40평대 6·50평대 7·60평대 이상 8, 임의 지정)를 예상견적에 반영. 전체 리모델링 자동 체크 대상에서는 제외.
- 결과 화면 마지막 '전화 상담 신청' 버튼: 어두운 배경에서 파란 글씨로 안 보이던 것을 흰색 버튼(검은 글씨)으로 변경.
- 견적 계산식(diagnoseStyle)은 변경 없음. SQL 변경 없음.

### 2026-11-25 — 손익 계산 기준 변경 (계약 도급금액 기준 매출)
- `admin.html` 월간 손익 / 연간 요약: 매출 = 계약완료일이 속한 달의 **도급금액**(+ 추가 수입). '실제 입금액' 수동 입력·표시 제거(기존에 저장된 값은 DB에 그대로 보존).
- 실질 잔액 = 매출 − 실행원가(견적 원가 + 수동 초과분) − 사업 운영비 − 개인 생활비. 월간·연간이 같은 식.
- 추가공사 견적도 '계약 완료'로 표시하면 해당 월 매출에 포함됨.
- 이익·원가 소수점 반올림(예: 15,156,142.3 → 15,156,142). 연간 표 열: 매출 / 실행원가 / 사업운영비 / 개인생활비 / 실질잔액.
- 도넛 그래프의 '기타 N개' → '그 외 N개'(사용자가 입력한 '기타' 카테고리와 구분).

### 2026-11-24 — 손익 관리 그래프 추가
- `admin.html` 지출 관리 탭: '이달 지출 구성' 도넛 그래프(카테고리별 금액·%, 가장 큰 지출 한 줄 요약, 전체/사업/개인 전환). 식비/접대·회식·식대는 '식비'로 합산, 카테고리가 7개를 넘으면 상위 6개 + 기타.
- `admin.html` 연간 요약 탭: 월별 실수입·총지출(공사원가 포함) 막대 + 실질잔액 선 그래프, 올해 지출 구성 도넛(공사원가 제외). 외부 라이브러리 없이 CSS/SVG로 구현, SQL 변경 없음.

### 2026-11-23 — 공정표 공종 추가
- `schedule.html`: 보양/가설, 폐기물반출, 금속, 장판, 입주청소 공종 추가(기존 순서에 맞춰 배치, 공종별 색상 지정).

### 2026-11-19 — 홍보 링크 문구
- `survey-public.html`: 표지 문구 '3분이면 충분' → '1분이면 충분'.

### 2026-11-17 — 설문 접수 텔레그램 알림
- `telegram-notify.sql`(Supabase SQL Editor에서 실행): survey_responses에 새 행이 저장되면 텔레그램으로 알림. 상담신청/공사범위/사전체크리스트 구분, 익명 진단(funnel) 제외. 토큰은 notify_settings 표에만 저장(RLS로 외부 조회 차단). 이 SQL 파일은 GitHub에 올리지 않음.

### 2026-11-17 — 홍보 링크(인테리어 스타일 진단) 퍼널 개편
- `survey-public.html`: 이름·연락처 선입력 제거 → 진단 후 결과 화면 하단에서 상담 신청(이름/연락처/공사 위치/공사 희망 시기/공사 예정 예산, 개인정보·연락 동의 분리). 견적 계산식은 변경 없음.
- 평형에 40평대 / 50평대 / 60평대 이상 추가. 공사범위 최상단에 **공조**·**샷시** 추가 (시스템에어컨·창호 전체교체는 평형별 금액표).
- 저장 방식: 익명 진단 = `type='funnel'` (개인정보 없음), 상담 신청 = `type='public'`. (SQL 추가 없음, anon은 INSERT만 허용)
- `admin.html`: 고객설문 상태값 통일(unread/new/홍보유입 → 신규), 3번째 탭 '인테리어 스타일 진단', 퍼널 카드(무료견적 완료 / 상담신청 / 신청률)와 일자별 상세 팝업.
- `survey-scope.html`: 저장 상태값을 신규로 통일.

### 2026-10-30
- **고객 링크 발송 모달 — 입금 계좌 안내 추가**
  - 계좌 입력칸 2개: 🧾 사업자 계좌(세금계산서 발행 시) / 💵 일반 계좌(미발행 시)
  - 입력한 계좌는 카카오 메시지에 `[입금 계좌 안내]`로 자동 포함, 비워 두면 해당 줄 생략
  - "다음 발송부터 자동으로 채우기" 체크 시 시공사 정보(`company` 설정)에 `bankBiz`, `bankGen`으로 저장 — 별도 SQL 불필요
  - 카카오 메시지 문구를 `buildKakaoMsg()` 하나로 통합 (모달 초기표시 / 입력 변경 / 복사 버튼이 항상 동일한 결과)
- **대금 지급 스케줄 — % 또는 금액으로 입력**
  - 계약금·중도금에 `%` 칸과 `금액(원)` 칸 병행, 어느 쪽을 입력해도 반대쪽 자동 계산 (% 는 소수점 2자리)
  - 잔금은 `도급금액 − 계약금 − 중도금`으로 자동 산정 (합계 항상 100%)
  - 저장 필드에 `ct-pay1-amt`, `ct-pay2-amt` 추가 (기존 저장 계약서는 % 기준으로 그대로 열림)
- **세부견적 편집 — 실행 자재 / 실행 노무 합계 표시** (`js/app.js`)
  - 노란색 실행단가 칸 아래에 `= 실행단가 × 수량` 합계 표시 (재료비·노무비 단가 칸의 `=345,000 원`과 동일한 방식)
  - 모든 공정의 모든 행에 적용 (행 공통 템플릿 수정), 실행단가·수량이 0이면 표시 없음
  - 표시 전용이며 기존 합계 계산에는 영향 없음. 견적서 미리보기/인쇄(`buildEstDoc`)는 실행 관련 값을 사용하지 않아 출력물에 노출되지 않음
- **버그 수정**
  - 계약서 대금표 % 가 `8.365256%`, `21.63474399999998%`처럼 길게 나오던 문제 → 소수점 2자리 (PC `admin.html` + 고객 모바일 `client.html` 모두)
  - 모바일 고객 화면의 대금 계산 기준을 PC와 동일하게 통일 (만원 미만 절삭, 저장된 금액 우선)
  - 카카오 메시지 인사말 `박소연 고객님님` 중복 → `박소연 고객님`
  - 인쇄/PDF 저장을 브라우저 인쇄 방식으로 통일 (페이지 잘림 방지, "서명 대기중" 문구 출력 시 숨김)

### 2026-07-07
- **전자계약 시스템 구축**
  - `client.html` 고객 포털: 계약서·공정표·영수증 탭 통합
  - 계약서 서명란에 고객 서명 이미지 자동 표시 (admin 출력 시 포함)
  - 발주자 주민번호/사업자번호 입력 필드 추가
  - 도장 이미지 on/off 토글 (인쇄용/전자계약용 구분)
  - 계약서 1조~13조 전문 고객 화면 적용 (PC와 동일)

- **영수증 DB 저장 및 발송**
  - `receipts` 테이블 신설
  - 영수증 발행 후 DB 저장 → 고객이 기존 링크로 재접속 시 영수증 탭 자동 표시
  - admin.html 영수증 관리 탭 추가

- **고객 포털 링크 일원화**
  - 계약서 저장 후 1회 발송 → 이후 공정표·영수증은 같은 링크에 자동 반영
  - 링크 발송 버튼 계약서 탭으로 통일

- **공정표 연결 개선**
  - 공정표 저장 시 견적 레코드에 scheduleId 자동 기록
  - 기존 끊어진 공정표 수동 재연결 기능 추가 (계약관리 탭 🔗 버튼)

- **설문 링크 2종 표시**
  - 사전 체크리스트 (직접 발송용)
  - 인테리어 스타일 진단 (SNS 홍보용)

- **버그 수정**
  - `saveMaterials`/`saveLabors` PGRST102 키 불일치 수정
  - async/await 정합성 전체 수정
  - 도장 키(`iq_stamp`/`iq_stamp_image`) 통일
  - receipt.js `parent` → `opener` 수정

---

## 🛠️ 개발 환경

- **프론트엔드:** 순수 HTML/CSS/JS (프레임워크 없음)
- **백엔드:** Supabase (PostgreSQL + REST API)
- **호스팅:** Vercel
- **인증:** Supabase Auth (관리자) / 토큰 기반 (고객)

---

*정결 Design Studio 내부 업무 시스템 — 추후 SaaS 상용화 예정*
