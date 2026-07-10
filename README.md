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
