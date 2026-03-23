# 🔐 BizReady — 프로젝트 복구용 마스터 가이드
> **이 파일 하나면 처음부터 완전 재건 가능합니다.**  
> 새 대화창에서 이 파일을 업로드하면 AI가 모든 컨텍스트를 즉시 파악합니다.  
> 최종 업데이트: 2026-03-23

---

## 1. 프로젝트 개요

| 항목 | 내용 |
|------|------|
| **서비스명** | BizReady |
| **슬로건** | 경영지원 올인원 아카이브 |
| **목적** | 경리·총무·노무 담당자(특히 신입/이직자)가 실무에서 즉시 쓸 수 있는 업무 가이드·체크리스트·검색을 한 곳에서 제공하는 SaaS |
| **수익 모델** | 월 9,900원 / 연 79,000원 구독 (프리미엄 가이드 잠금 해제) |
| **타깃 유저** | 경리/경영지원 신입·이직자, 중소기업 1인 경리 담당자 |
| **현재 상태** | 개발 완료 (미배포) — 로컬 샌드박스에서 동작 중 |

### 핵심 기능 목록
- **회원 인증**: 이메일 회원가입(자동 인증) / 구글 OAuth 로그인
- **업무 아카이브**: 카테고리별 가이드 열람 (회계·세무 / 인사·노무 / 총무·행정 / 세금·신고 / 급여관리)
- **지식 검색**: 키워드 기반 가이드 검색
- **입사 체크리스트**: 첫 4주 필수 업무 16가지, 완료 체크 및 진도 표시
- **개인 메모/북마크**: 가이드별 개인 노트 저장
- **결제 시스템**: 포트원 V2 — 카카오페이·토스페이 결제 + 서버 검증 + DB 업데이트
- **세션 관리**: HttpOnly 쿠키 기반 (sb-session), 7일 유지

---

## 2. 기술 스택

```
Frontend  : HTML + TailwindCSS (CDN) + Vanilla JS
Backend   : Hono (TypeScript) — Cloudflare Workers 엣지 런타임
Build     : Vite + @hono/vite-cloudflare-pages
Database  : Supabase (PostgreSQL) — 인증·DB·RLS 포함
Auth      : Supabase Auth (이메일 + Google OAuth)
Payment   : 포트원(PortOne) V2 — 카카오페이, 토스페이
Deploy    : Cloudflare Pages (예정, 아직 미배포)
Dev Tool  : Wrangler (로컬 개발), PM2 (프로세스 관리)
```

### 주요 의존성 (package.json)
```json
{
  "hono": "^4.x",
  "@supabase/supabase-js": "^2.x",
  "@hono/vite-cloudflare-pages": "^0.4.x",
  "vite": "^6.x",
  "wrangler": "^3.x",
  "typescript": "^5.x"
}
```

---

## 3. 디렉토리 구조

```
/home/user/webapp/
├── src/
│   ├── index.tsx              # 메인 앱 + 라우터 등록 + 세션 미들웨어
│   ├── renderer.tsx           # HTML 렌더러 (TailwindCSS CDN 포함)
│   ├── lib/
│   │   ├── session.ts         # parseSessionCookie() 함수
│   │   └── supabase.ts        # Env 타입 + 3가지 Supabase 클라이언트 팩토리
│   └── routes/
│       ├── auth.tsx           # /auth/callback, /auth/set-session, /auth/logout
│       ├── login.tsx          # /login (이메일+구글 로그인, 회원가입, DEV 배너)
│       ├── dashboard.tsx      # /dashboard (홈 — 카테고리·최근가이드)
│       ├── archive.tsx        # /dashboard/archive (가이드 목록·필터)
│       ├── guide.tsx          # /dashboard/guide/:id (가이드 상세 + 메모)
│       ├── search.tsx         # /dashboard/search (키워드 검색)
│       ├── checklist.tsx      # /dashboard/checklist (입사 체크리스트 16항목)
│       ├── payment.tsx        # /dashboard/payment (결제 페이지 UI)
│       └── payment-api.tsx    # POST /api/payment/complete (서버 검증 로직)
├── public/                    # 정적 파일 (favicon 등)
├── .dev.vars                  # 로컬 환경변수 (git 제외 ✅)
├── .env.example               # 환경변수 템플릿 (git 포함)
├── .gitignore                 # node_modules, .dev.vars, dist 등 제외
├── ecosystem.config.cjs       # PM2 설정 (wrangler pages dev)
├── wrangler.jsonc             # Cloudflare 설정
├── vite.config.ts             # Vite 빌드 설정
├── tsconfig.json              # TypeScript 설정
└── package.json               # 스크립트 + 의존성
```

---

## 4. 환경변수 (Secrets) 완전 목록

### 4-1. 로컬 개발 — `.dev.vars` 파일 (git 제외됨)
```env
# ── Supabase ──────────────────────────────────────────
SUPABASE_URL=https://blvhpajeaelvmgfglivk.supabase.co
SUPABASE_ANON_KEY=sb_publishable_hXSJE5IOVVOwYEoIrhPIvw_b3nYUBqd
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJsdmhwYWplYWVsdm1nZmdsaXZrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mzk4NjgxNywiZXhwIjoyMDg5NTYyODE3fQ.jX7CRonscWv4wKADoEvmWxNl3w_ATqtsBh5okJT9Le4

# ── 포트원 V2 ─────────────────────────────────────────
PORTONE_V2_STORE_ID=store-7b370e7d-683d-4e5d-a75e-47f254cf91fe
PORTONE_V2_CHANNEL_KEY_KAKAO=channel-key-e379d514-8869-4f9b-a701-63c95e81ffc9
PORTONE_V2_CHANNEL_KEY_TOSS=channel-key-f56682af-9444-478f-86f2-5a53e91c5e19
PORTONE_V2_API_SECRET=F8RDRV9zQiyy8XODg43ScWEo1uEKVXGLtJSrBGjiEmVk0yGTTqPJcZ1KWrYV1yZ17ZiPRB1Sv9bxuPiR
```

### 4-2. 보안 분류표

| 분류 | 환경변수 키 | 브라우저 노출 | 용도 |
|------|------------|:------------:|------|
| Supabase | `SUPABASE_URL` | ✅ 허용 | DB 연결 URL |
| Supabase | `SUPABASE_ANON_KEY` | ✅ 허용 | 일반 클라이언트용 키 |
| Supabase | `SUPABASE_SERVICE_ROLE_KEY` | ❌ **절대 금지** | RLS 우회·결제 처리용 |
| 포트원 | `PORTONE_V2_STORE_ID` | ✅ 허용 | 결제창 초기화 |
| 포트원 | `PORTONE_V2_CHANNEL_KEY_KAKAO` | ✅ 허용 | 카카오페이 채널 |
| 포트원 | `PORTONE_V2_CHANNEL_KEY_TOSS` | ✅ 허용 | 토스페이 채널 |
| 포트원 | `PORTONE_V2_API_SECRET` | ❌ **절대 금지** | 결제 서버 검증용 |
| Google | `GOOGLE_CLIENT_ID` | ✅ 허용 | OAuth (Supabase가 처리) |
| Google | `GOOGLE_CLIENT_SECRET` | ❌ **절대 금지** | Supabase에 직접 등록 |

### 4-3. Cloudflare 배포 시 Secret 등록 명령어
```bash
# 배포 전 반드시 실행 (서버 전용 키들)
npx wrangler pages secret put SUPABASE_SERVICE_ROLE_KEY --project-name bizready
npx wrangler pages secret put PORTONE_V2_API_SECRET     --project-name bizready

# 나머지 공개 키들 (환경변수로 등록)
npx wrangler pages secret put SUPABASE_URL              --project-name bizready
npx wrangler pages secret put SUPABASE_ANON_KEY         --project-name bizready
npx wrangler pages secret put PORTONE_V2_STORE_ID       --project-name bizready
npx wrangler pages secret put PORTONE_V2_CHANNEL_KEY_KAKAO --project-name bizready
npx wrangler pages secret put PORTONE_V2_CHANNEL_KEY_TOSS  --project-name bizready
```

---

## 5. Supabase 프로젝트 정보

| 항목 | 값 |
|------|-----|
| **프로젝트 ID** | `blvhpajeaelvmgfglivk` |
| **프로젝트 URL** | `https://blvhpajeaelvmgfglivk.supabase.co` |
| **대시보드 URL** | https://supabase.com/dashboard/project/blvhpajeaelvmgfglivk |
| **Auth 설정** | https://supabase.com/dashboard/project/blvhpajeaelvmgfglivk/auth/url-configuration |
| **API Keys** | https://supabase.com/dashboard/project/blvhpajeaelvmgfglivk/settings/api-keys |
| **이메일 자동인증** | 코드에서 `email_confirm: true` 강제 처리 (Confirm Email 토글 불필요) |

### Supabase Auth URL Configuration 설정값
```
Site URL:
  https://bizready.pages.dev         ← 배포 후 고정 URL로 변경
  (개발 중: https://3000-xxx.sandbox.novita.ai)

Additional Redirect URLs:
  https://bizready.pages.dev/auth/callback
  https://*.novita.ai/auth/callback     ← 샌드박스 와일드카드 (개발용)
  http://localhost:3000/auth/callback   ← 로컬 개발용
```

---

## 6. DB 테이블 구조 (Supabase PostgreSQL)

### 6-1. `user_profiles` 테이블
```sql
CREATE TABLE user_profiles (
  id           UUID PRIMARY KEY,           -- auth.users.id 와 동일
  full_name    TEXT,                        -- 회원가입 시 입력한 이름
  is_paid      BOOLEAN DEFAULT false,       -- 유료 구독 여부
  plan_type    TEXT    DEFAULT 'free',      -- 'free' | 'monthly' | 'yearly'
  paid_at      TIMESTAMPTZ,                 -- 최초 결제 시각
  created_at   TIMESTAMPTZ DEFAULT now()
);

-- RLS 정책: 본인만 조회/수정, admin(service_role)은 모두 가능
```

### 6-2. `guides` 테이블
```sql
CREATE TABLE guides (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  category    TEXT NOT NULL,    -- '회계·세무'|'인사·노무'|'총무·행정'|'세금·신고'|'급여관리'|'입사 체크리스트'
  content     TEXT,             -- Markdown 형식의 가이드 본문
  summary     TEXT,             -- 목록 페이지 요약 (1~2줄)
  tags        TEXT[],           -- 검색 태그 배열
  is_premium  BOOLEAN DEFAULT false,  -- true = 유료 회원만 열람
  view_count  INTEGER DEFAULT 0,
  created_at  TIMESTAMPTZ DEFAULT now()
);
```

### 6-3. `checklists` 테이블
```sql
CREATE TABLE checklists (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID REFERENCES auth.users(id),
  item_key  TEXT NOT NULL,   -- 고정 항목 키 (org_chart, tax_calendar 등 16개)
  is_done   BOOLEAN DEFAULT false,
  done_at   TIMESTAMPTZ,
  UNIQUE(user_id, item_key)
);
```

### 6-4. `user_notes` 테이블
```sql
CREATE TABLE user_notes (
  id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id   UUID REFERENCES auth.users(id),
  guide_id  UUID REFERENCES guides(id),
  content   TEXT,            -- 개인 메모 내용
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, guide_id)
);
```

### 6-5. 현재 데이터 현황 (2026-03-23 기준)
| 테이블 | 레코드 수 | 비고 |
|--------|:---------:|------|
| auth.users | 1명 | lsol2@naver.com (email 프로바이더) |
| user_profiles | 1개 | is_paid=false |
| guides | 9개 | 모두 is_premium=false |
| checklists | 0개 | 아직 미사용 |
| user_notes | 0개 | 아직 미사용 |

### 6-6. 현재 guides 목록 (9개)
| 제목 | 카테고리 | 프리미엄 |
|------|---------|:--------:|
| 세금계산서 발행 A to Z | 회계·세무 | ❌ |
| 부가세 신고 완벽 가이드 | 회계·세무 | ❌ |
| 법인카드 사용 및 정산 방법 | 회계·세무 | ❌ |
| 신규 직원 4대보험 가입 처리 | 인사·노무 | ❌ |
| 근로계약서 작성 필수 체크리스트 | 인사·노무 | ❌ |
| 매월 급여 계산 및 이체 프로세스 | 급여관리 | ❌ |
| 사무용품 구매 및 비품 관리 | 총무·행정 | ❌ |
| 원천세 신고 및 납부 방법 | 세금·신고 | ❌ |
| 첫 1개월 필수 업무 로드맵 | 입사 체크리스트 | ❌ |

---

## 7. 포트원(PortOne) V2 결제 연동

### 설정 정보
| 항목 | 값 |
|------|-----|
| **가맹점 식별코드(Store ID)** | `store-7b370e7d-683d-4e5d-a75e-47f254cf91fe` |
| **카카오페이 채널키** | `channel-key-e379d514-8869-4f9b-a701-63c95e81ffc9` |
| **토스페이 채널키** | `channel-key-f56682af-9444-478f-86f2-5a53e91c5e19` |
| **포트원 대시보드** | https://admin.portone.io |
| **현재 모드** | **테스트 모드** (실결제 아님) |
| **결제 방식** | 포트원 V2 SDK (`PortOne.requestPayment()`) |

### 결제 플로우
```
[클라이언트 /dashboard/payment]
  1. 플랜 선택 (monthly 9,900원 / yearly 79,000원)
  2. PortOne.requestPayment() 호출
     → paymentId: bizready_[plan]_[timestamp]
     → storeId, channelKey 전달
  
[포트원 결제창]
  3. 카카오페이 or 토스페이 결제 진행
  4. 결제 완료 → paymentId 반환

[서버 POST /api/payment/complete]
  5. 세션 쿠키 검증 (sessionUserId)
  6. 포트원 서버 API로 paymentId 조회
  7. 결제상태 PAID 확인
  8. 금액 검증 (위변조 방지)
  9. Supabase admin으로 user_profiles.is_paid = true 업데이트
  10. 대시보드로 리다이렉트 (?upgraded=1)
```

### 구독 플랜 가격표
| Plan ID | 금액 | 기간 |
|---------|-----:|------|
| `monthly` | 9,900원 | 월간 |
| `yearly` | 79,000원 | 연간 (월 6,583원) |

---

## 8. 인증 흐름 상세

### 8-1. 이메일 회원가입 플로우
```
[POST /api/auth/signup]
  1. client.auth.signUp({ email, password, options: { data: { full_name } } })
  2. 가입 직후 admin.auth.admin.updateUserById(userId, { email_confirm: true })
     → 이메일 인증 없이 즉시 로그인 가능
  3. client.auth.signInWithPassword() 로 자동 로그인
  4. POST /auth/set-session → HttpOnly 쿠키 저장
  5. /dashboard 리다이렉트
```

### 8-2. Google OAuth 플로우
```
[클라이언트 loginWithGoogle()]
  1. client.auth.signInWithOAuth({
       provider: 'google',
       options: { redirectTo: window.location.origin + '/auth/callback' }
     })
  2. Google 동의 화면
  3. → /auth/callback?code=xxx (PKCE)
  4. exchangeCodeForSession(code)
  5. POST /auth/set-session → HttpOnly 쿠키
  6. /dashboard 리다이렉트
```

### 8-3. 세션 관리
- 쿠키명: `sb-session`
- 내용: `{ access_token, refresh_token }` JSON → URL encode
- 속성: HttpOnly, SameSite=Lax, Max-Age=7일
- 검증: `parseSessionCookie()` → `getSupabaseClientWithToken()` → `supabase.auth.getUser()`

---

## 9. 체크리스트 고정 항목 (16개)

| 주차 | key | 라벨 |
|:----:|-----|------|
| 1주 | org_chart | 회사 전체 조직도 파악 |
| 1주 | accounting_sw | 사용 중인 회계 프로그램 파악 |
| 1주 | bank_account | 법인 은행 계좌 현황 및 인터넷뱅킹 권한 확인 |
| 1주 | handover_docs | 전임자 인수인계 자료 수령 |
| 1주 | corp_seal | 법인인감·통장·공인인증서 보관 위치 확인 |
| 2주 | vendor_list | 거래처 목록 및 지급 조건 파악 |
| 2주 | employee_list | 직원 명부 및 4대보험 현황 확인 |
| 2주 | payroll_prep | 가장 가까운 급여일 급여 계산 준비 |
| 2주 | expense_flow | 경비 지출 결재 라인 파악 |
| 3주 | tax_calendar | 부가세·원천세 신고 일정 달력 등록 |
| 3주 | tax_invoice | 주요 거래처 세금계산서 수수 현황 점검 |
| 3주 | work_rules | 취업규칙 열람 |
| 4주 | monthly_close | 월말 결산 프로세스 파악 |
| 4주 | payroll_practice | 다음 달 급여 계산 연습 |
| 4주 | account_codes | 자주 쓰는 계정과목 목록 정리 |
| 4주 | prev_tax_docs | 전년도 세무 신고 서류 위치 확인 |

---

## 10. 핵심 코드 로직 설명

### 10-1. 이메일 자동 인증 로직 (login.tsx — POST /api/auth/signup)
```javascript
// 1단계: 일반 회원가입
const { data: signUpData, error: signUpError } = await client.auth.signUp({
  email, password,
  options: { data: { full_name: fullName } }
})

// 2단계: service_role로 이메일 인증 강제 완료
//        → Supabase의 "Confirm Email" 기능 비활성화 없이도 즉시 로그인 가능
const verifyRes = await fetch('/api/auth/signup', {
  method: 'POST',
  body: JSON.stringify({ userId: signUpData.user.id })
})
// 서버에서: admin.auth.admin.updateUserById(userId, { email_confirm: true })

// 3단계: 자동 로그인
const { data: loginData } = await client.auth.signInWithPassword({ email, password })

// 4단계: HttpOnly 쿠키 저장
await fetch('/auth/set-session', {
  method: 'POST',
  body: JSON.stringify({ access_token, refresh_token })
})
```

### 10-2. 결제 서버 검증 로직 (payment-api.tsx)
```typescript
// 핵심: 클라이언트 결제 완료 후 서버에서 반드시 재검증
// (클라이언트 금액 위변조 방지)

// 1. 포트원 서버에서 실제 결제 데이터 조회
const portoneRes = await fetch(
  `https://api.portone.io/payments/${paymentId}`,
  { headers: { Authorization: `PortOne ${env.PORTONE_V2_API_SECRET}` } }
)
const paymentData = await portoneRes.json()

// 2. 결제 상태 + 금액 이중 검증
if (paymentData.status !== 'PAID') → 에러
if (paymentData.amount.total !== expectedAmounts[planId]) → 에러

// 3. 검증 통과 후 DB 업데이트 (RLS 우회)
await admin.from('user_profiles')
  .update({ is_paid: true, plan_type: planId, paid_at: now() })
  .eq('id', userId)
```

### 10-3. Supabase 클라이언트 3가지 패턴 (supabase.ts)
```typescript
// 패턴 A: 브라우저(클라이언트) — anon key 사용
getSupabaseClient(env)

// 패턴 B: 인증된 사용자 — access_token + RLS 적용
getSupabaseClientWithToken(env, accessToken)

// 패턴 C: 관리자 — service_role key, RLS 우회 (서버 전용!)
getSupabaseAdmin(env)
```

---

## 11. Google OAuth 설정 현황

| 항목 | 상태 | 비고 |
|------|:----:|------|
| **Google Cloud Console 설정** | ⚠️ 부분완료 | OAuth 클라이언트 생성됨 |
| **Supabase에 클라이언트 ID/Secret 등록** | ✅ 완료 | Supabase Auth → Providers → Google |
| **Authorized JavaScript Origins** | ❌ 미완료 | 샌드박스 URL 등록 필요 |
| **Authorized Redirect URIs** | ✅ 완료 | `https://blvhpajeaelvmgfglivk.supabase.co/auth/v1/callback` |

### Google Cloud Console 설정 가이드
```
URL: https://console.cloud.google.com/apis/credentials

[배포 후 설정할 값]
Authorized JavaScript origins:
  https://bizready.pages.dev

Authorized redirect URIs:
  https://blvhpajeaelvmgfglivk.supabase.co/auth/v1/callback
  (변경 불필요)
```

---

## 12. Git 커밋 히스토리 (주요 마일스톤)

| 커밋 | 설명 |
|------|------|
| `3fa2eec` | BizReady MVP — 초기 로그인/대시보드 구현 |
| `a5b86b3` | 실제 Supabase 키 연결, favicon 추가 |
| `374da60` | 2단계: DB 스키마, 아카이브/검색/체크리스트/가이드 페이지 |
| `2059da7` | 3단계: 포트원 V2 결제 시스템 구현 |
| `2eeea20` | 보안: 환경변수 V2 네이밍 통일, 보안 감사 완료 |
| `a25bcc2` | 이메일 자동 인증 + Google 로그인 우선 UI |
| `76739fb` | DEV 전용 URL 도우미 배너 추가 |
| `0d1c022` | 인증 콜백 완전 재작성 + redirectTo 동적화 |

---

## 13. 미해결 과제 & 배포 직후 처리 목록

### 🔴 배포 즉시 필수 (우선순위 높음)
- [ ] **Cloudflare Pages 배포**
  ```bash
  setup_cloudflare_api_key()
  npm run build
  npx wrangler pages project create bizready --production-branch main
  npx wrangler pages deploy dist --project-name bizready
  ```
- [ ] **Cloudflare Secret 7개 등록** (위 4-3 섹션 명령어 참조)
- [ ] **Google Cloud Console** — `https://bizready.pages.dev` JavaScript Origins 추가
- [ ] **Supabase Auth URL** — Site URL + Redirect URLs를 `bizready.pages.dev`로 업데이트

### 🟡 배포 후 1주일 내
- [ ] **관리자 페이지 `/admin`** 구현
  - 가이드 CRUD (Markdown 에디터)
  - 카테고리·태그 관리
  - 프리미엄 가이드 설정 토글
  - 사용자 목록 및 결제 현황 조회
- [ ] **콘텐츠 추가** (현재 9개 → 목표 50개+)
  - 세금: 연말정산, 종합소득세, 법인세
  - 노무: 퇴직금 계산, 해고 절차, 육아휴직
  - 급여: 급여 협상, 각종 수당, 4대보험 정산
  - 행정: 계약서 종류, 업무용 차량 관리

### 🟢 배포 후 1개월 내
- [ ] **실제 결제 테스트**
  - 카카오페이 테스트 결제 (테스트 카드: 4242-4242-4242-4242)
  - 결제 후 `is_paid = true` 확인
  - 프리미엄 가이드 접근 확인
- [ ] **payment_logs 테이블** 추가 (결제 이력 관리)
- [ ] **이메일 알림** 설정 (구독 만료 D-7 알림 등)
- [ ] **연간 구독 자동 갱신** 로직 구현

---

## 14. 로컬 서버 재시작 방법

```bash
# 포트 정리 후 재시작
cd /home/user/webapp
fuser -k 3000/tcp 2>/dev/null || true
npm run build
pm2 delete all 2>/dev/null || true
pm2 start ecosystem.config.cjs

# 상태 확인
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/login
pm2 logs bizready --nostream
```

### ecosystem.config.cjs 내용
```javascript
module.exports = {
  apps: [{
    name: 'bizready',
    script: 'npx',
    args: 'wrangler pages dev dist --ip 0.0.0.0 --port 3000',
    env: { NODE_ENV: 'development', PORT: 3000 },
    watch: false,
    instances: 1,
    exec_mode: 'fork'
  }]
}
```

---

## 15. 자주 발생하는 문제 & 해결법

| 문제 | 원인 | 해결 |
|------|------|------|
| 구글 로그인 403 오류 | Google Console에 현재 URL 미등록 | JavaScript Origins에 현재 샌드박스 URL 추가 |
| 이메일 인증 링크 → localhost 이동 | Supabase Site URL이 localhost로 설정됨 | Supabase Auth URL Configuration에서 현재 URL로 수정 |
| `/api/payment/complete` 401 | 세션 쿠키 없음 (로그아웃 상태) | 정상 동작 — 테스트 시 로그인 후 실행 |
| `sb-session` 쿠키 저장 안됨 | SameSite 정책 문제 | HTTPS 환경에서는 자동 해결됨 |
| 빌드 에러 `Transform failed` | JSX 문법 오류 | div 태그 쌍 확인 (45:45 균형 필요) |
| wrangler 인증 실패 | CLOUDFLARE_API_TOKEN 없음 | `setup_cloudflare_api_key()` 호출 |

---

## 16. 새 대화창에서 AI에게 전달할 컨텍스트 요약

> **아래 내용을 새 대화창 첫 메시지에 붙여넣으세요:**

```
나는 BizReady라는 경영지원 실무 가이드 SaaS를 개발 중입니다.
이 파일(MASTER_RECOVERY_GUIDE.md)에 모든 설정이 담겨 있습니다.

현재 상태:
- 기술스택: Hono(TypeScript) + Supabase + 포트원V2 + Cloudflare Pages(예정)
- 샌드박스: /home/user/webapp/ 에 코드 존재
- DB: Supabase(blvhpajeaelvmgfglivk), guides 9개, users 1명
- 미배포 상태: wrangler pages dev로 로컬 동작 중
- 미해결: Cloudflare 배포, Google OAuth 최종 설정, 관리자 페이지, 콘텐츠 추가

이 파일을 기반으로 [요청사항]을 진행해주세요.
```

---

*이 문서는 2026-03-23에 자동 생성되었습니다. 주요 변경사항 발생 시 업데이트하세요.*
