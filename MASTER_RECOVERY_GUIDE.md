# BizReady 프로젝트 컨텍스트

## 프로젝트 개요
- 서비스명: BizReady (경영지원 신규 입사자 올인원 아카이브)
- 운영 URL: https://bizready.pages.dev
- GitHub: https://github.com/lsol1994/webapp
- 관리자 이메일: lsol3264@gmail.com

## 기술 스택 (변경 금지)
- Runtime: Cloudflare Workers (Pages Functions)
- Framework: Hono v4 (JSX SSR — React 아님, useState/useEffect 사용 불가)
- Build: Vite + @hono/vite-build
- Auth: Supabase Auth (Google OAuth implicit flow + Email/Password)
- DB: Supabase PostgreSQL (Project ID: blvhpajeaelvmgfglivk)
- Storage: Supabase Storage (버킷명: guide-files)
- 결제: 포트원 V2 (카카오페이 + 토스페이먼츠)
- 이메일: Resend API
- 배포: Cloudflare Pages (wrangler pages deploy)
- CSS: Tailwind CSS + FontAwesome CDN (인라인 스크립트로 동작)

## 환경변수 (c.env.변수명으로 접근)
SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY
PORTONE_V2_STORE_ID, PORTONE_V2_CHANNEL_KEY_KAKAO,
PORTONE_V2_CHANNEL_KEY_TOSS, PORTONE_V2_API_SECRET
RESEND_API_KEY

## DB 스키마 (Supabase 실측값 — 이것이 정본)

### bookmarks
id: bigint (PK) | user_id: uuid | guide_id: uuid | created_at: timestamptz

### calendar_events
id: uuid (PK) | title: text | start_date: date | end_date: date
category: text | note: text | created_by: text
created_at: timestamptz | updated_at: timestamptz

### checklists
id: uuid (PK) | user_id: uuid | item_key: text
is_done: boolean | done_at: timestamptz

### guide_likes
id: bigint (PK) | user_id: uuid | guide_id: uuid | created_at: timestamptz

### guides
id: uuid (PK) | category: text | subcategory: text | title: text
summary: text | content: text | tags: text[] | status: text
is_premium: boolean | view_count: int | like_count: int
file_url_1~3: text | file_name_1~3: text | law_refs: jsonb
created_at: timestamptz | updated_at: timestamptz

### payment_logs
id: uuid (PK) | user_id: uuid | user_email: text | payment_id: text
plan_id: text | amount: int | status: text | created_at: timestamptz

### user_notes
id: uuid (PK) | user_id: uuid | guide_id: uuid
memo: text | is_bookmarked: boolean
created_at: timestamptz | updated_at: timestamptz
⚠️ title/content/color/tags 컬럼은 DB에 없음
   (memo.tsx의 개인 메모장 기능은 이 컬럼들이 필요 — 추가 마이그레이션 필요)

### user_profiles
id: uuid (PK) | full_name: text | is_paid: boolean
plan_type: text | paid_at: timestamptz
updated_by: text | updated_at: timestamptz | created_at: timestamptz

### user_settings
id: uuid (PK)
notify_finance: bool | notify_labor: bool | notify_general: bool
notify_d7: bool | notify_d3: bool | notify_d1: bool | notify_d0: bool
email_reminder: bool | dnd_start: date | dnd_end: date
created_at: timestamptz | updated_at: timestamptz

## 인증 패턴 (모든 라우트 동일)
```typescript
const cookie = c.req.header('Cookie') ?? ''
const sessionStr = parseSessionCookie(cookie)
if (!sessionStr) return c.redirect('/login?error=unauthorized')

let sessionObj: any
try { sessionObj = JSON.parse(sessionStr) }
catch { sessionObj = JSON.parse(decodeURIComponent(sessionStr)) }

const supabase = getSupabaseClientWithToken(c.env, sessionObj.access_token)
const { data: { user }, error } = await supabase.auth.getUser()
if (error || !user) return c.redirect('/login?error=session_expired')
```

## Supabase 클라이언트 2종
- getSupabaseClientWithToken(env, token) → 사용자 권한 (RLS 적용)
- getSupabaseAdmin(env) → service_role (RLS 우회, 관리자/결제/리마인더 전용)

## 라우팅 구조
/login → login.tsx
/auth/callback, /auth/set-session(POST), /auth/logout(POST) → auth.tsx
/reset-password → reset-password.tsx
/dashboard → dashboard.tsx
/dashboard/archive → archive.tsx
/dashboard/guide/:id → guide.tsx (북마크 POST, 좋아요 POST 포함)
/dashboard/search → search.tsx
/dashboard/bookmark → bookmark.tsx
/dashboard/checklist → checklist.tsx
/dashboard/calendar → calendar.tsx (FullCalendar 6.x CDN)
/dashboard/memo → memo.tsx ⚠️ user_notes 마이그레이션 필요
/dashboard/payment → payment.tsx
/dashboard/settings → settings.tsx
/admin → admin.tsx (requireAdmin() 필수)
/api/files/upload/:id/:slot → file-api.ts
/api/files/delete/:id/:slot → file-api.ts
/api/files/download-proxy → file-api.ts
/api/payment/complete → payment-api.ts
/api/reminder/send, /api/reminder/test, /api/reminder/preview → reminder.ts

## 카테고리 체계
메인: 세무회계 / 인사노무 / 총무
구버전 호환: 회계·세무 / 인사·노무 / 총무·행정 / 세금·신고 / 급여관리 / 입사 체크리스트
캘린더 색상: finance=#ef4444 / labor=#ca8a04 / general|company=#3b82f6 / team=#22c55e / exec=#f59e0b

## 결제 플랜
monthly: 9,900원 | yearly: 79,000원
포트원 서버사이드 금액 검증 → user_profiles.is_paid = true

## 이메일 리마인더
Resend API | D-7/3/1/0 | user_settings로 개인화 | Cron: GET /api/reminder/send

## 작업 규칙
1. Hono JSX SSR 패턴 유지 (React hooks 사용 불가)
2. 새 라우트는 src/index.tsx에 등록
3. RLS 정책 임의 변경 금지
4. 관리자 인증은 requireAdmin() 패턴 사용
5. 환경변수는 c.env.변수명으로 접근
6. DB 스키마 변경 시 SQL 마이그레이션 파일도 함께 제공
7. 수정 전 "확인 → 영향 분석 → 수정" 순서 준수

## ⚠️ 현재 알려진 미완성 사항
- user_notes 테이블에 title/content/color/tags 컬럼 미존재
  → memo.tsx의 개인 메모장 기능 사용 시 아래 SQL 먼저 실행 필요:
  ALTER TABLE user_notes
    ADD COLUMN IF NOT EXISTS title TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS content TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS color TEXT DEFAULT 'yellow',
    ADD COLUMN IF NOT EXISTS tags TEXT[] DEFAULT '{}';
