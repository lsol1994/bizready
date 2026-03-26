# BizReady — 경영지원 신규 입사자 올인원 아카이브

## 프로젝트 개요
- **이름**: BizReady
- **목적**: 중소기업 경영지원부 신규 입사자를 위한 실무 지식 아카이브 SaaS
- **타겟**: 회계·인사·노무·총무 동시 수행 1인 경영지원 담당자
- **프로덕션**: https://bizready.pages.dev
- **GitHub**: https://github.com/lsol1994/bizready

---

## 🤖 AI 작업 필수 루틴 (매 작업마다 반드시 시행)

> **이 섹션은 AI(Claude)가 작업할 때 반드시 따라야 하는 규칙입니다.**
> 작업 주제가 정해지는 순간부터 아래 두 루틴을 순서대로 실행합니다.

---

### ✅ 루틴 1 — 작업 시작 전 설명 (작업 착수 전 반드시 먼저 제시)

작업을 시작하기 **전에** 반드시 아래 3가지를 솔님께 설명합니다:

1. **작업 주제 설명** — 이 작업이 무엇인지, 왜 필요한지
2. **작동 방법 / 작업 단계** — 어떤 순서로 어떻게 진행할 것인지
3. **예상 결과** — 작업 완료 후 어떤 상태가 되는지

> 설명 없이 바로 코드 작업을 시작하면 안 됩니다.
> 솔님의 확인("진행해줘", "ok" 등) 이후에 작업을 시작합니다.

---

### ✅ 루틴 2 — 작업 완료 후 자동화 (테스트 완료 시 반드시 실행)

테스트가 완료되면 아래 스크립트를 실행합니다:

```bash
python3 scripts/post-deploy.py \
  --feature "기능명" \
  --path "/경로" \
  --desc "상세 설명" \
  --test-urls "/url1,/url2" \
  --commit-msg "feat: 커밋 메시지"
```

이 스크립트가 자동으로 처리하는 것:

| 순서 | 작업 |
|------|------|
| 1️⃣ | GitHub `main` 브랜치에 push |
| 2️⃣ | Notion 개발일정 DB에 완료 항목 추가 |
| 3️⃣ | Notion 개발일정 캘린더 DB에 동일 항목 추가 |
| 4️⃣ | Notion 개발 진행사항 페이지에 배포 완료 callout 추가 |
| 5️⃣ | 테스트 체크리스트 + 직접 확인할 수 있는 URL 출력 |

---

## 현재 구현된 기능

### 🔐 인증
- ✅ 이메일/비밀번호 로그인 (Supabase Auth)
- ✅ Google 소셜 로그인 (OAuth implicit flow)
- ✅ 회원가입 (이메일 인증 자동 처리)
- ✅ 비밀번호 재설정 (`/reset-password` 전용 페이지)
- ✅ HttpOnly 쿠키 기반 서버사이드 세션 (7일)
- ✅ 보호 라우트 (미인증 → `/login` 자동 리다이렉트)

### 📄 페이지 (총 14개)
- ✅ 대시보드 홈 (`/dashboard`)
- ✅ 업무 아카이브 (`/dashboard/archive`)
- ✅ 가이드 상세 (`/dashboard/guide/:id`)
- ✅ 지식 검색 (`/dashboard/search`)
- ✅ 체크리스트 (`/dashboard/checklist`)
- ✅ 사내 캘린더 (`/dashboard/calendar`)
- ✅ 내 메모 (`/dashboard/memo`)
- ✅ 프리미엄 구독 (`/dashboard/payment`)
- ✅ 관리자 패널 (`/admin`)
- ✅ 로그인 (`/login`)
- ✅ 비밀번호 재설정 (`/reset-password`)

### 📧 이메일 템플릿
- ✅ 비밀번호 재설정 이메일 (BizReady 브랜드)
- ✅ 회원가입 인증 이메일 (BizReady 브랜드)
- ✅ 비밀번호 변경 알림 이메일 (BizReady 브랜드)

### 📱 UI/UX
- ✅ 모바일 반응형 (햄버거 메뉴 + 드로어 사이드바)
- ✅ 공통 사이드바 컴포넌트 (전 페이지 통일)
- ✅ 768px 기준 반응형 분기 (Tailwind `md:`)

### 💾 데이터
- ✅ Supabase PostgreSQL DB (6개 테이블)
- ✅ 가이드 콘텐츠 47개
- ✅ PortOne V2 결제 연동

---

## 미구현 / 예정 기능

### 🟡 완성도 향상
- [ ] 대시보드 홈 개편 (세무일정 위젯 + 공지사항)
- [ ] 좋아요 / 조회수 카운트 기능
- [ ] 세무신고 리마인더 이메일 (D-7/D-3/D-1)
- [ ] 검색 기능 강화
- [ ] 북마크 페이지

### 🟢 장기 로드맵
- [ ] AI Q&A 챗봇
- [ ] 급여 계산기 (4대보험 자동 계산)
- [ ] 가이드 PDF 내보내기
- [ ] 팀 공유 기능
- [ ] 템플릿 다운로드 센터

---

## API 엔드포인트

| Method | Path | 설명 |
|--------|------|------|
| GET | `/` | 루트 (세션 유무에 따라 리다이렉트) |
| GET | `/login` | 로그인 페이지 |
| GET | `/reset-password` | 비밀번호 재설정 페이지 |
| GET | `/auth/callback` | OAuth / 이메일 인증 콜백 |
| POST | `/auth/set-session` | 토큰 → HttpOnly 쿠키 저장 |
| POST | `/auth/logout` | 로그아웃 (쿠키 삭제) |
| POST | `/api/auth/signup` | 회원가입 이메일 인증 자동 처리 |
| GET | `/dashboard` | 메인 대시보드 🔒 |
| GET | `/dashboard/archive` | 업무 아카이브 🔒 |
| GET | `/dashboard/guide/:id` | 가이드 상세 🔒 |
| GET | `/dashboard/search` | 지식 검색 🔒 |
| GET | `/dashboard/checklist` | 체크리스트 🔒 |
| GET | `/dashboard/calendar` | 캘린더 🔒 |
| GET | `/dashboard/memo` | 내 메모 🔒 |
| GET | `/dashboard/payment` | 구독 관리 🔒 |
| GET | `/admin` | 관리자 패널 🔒 |

---

## 데이터 구조 (Supabase)

| 테이블 | 설명 |
|--------|------|
| `user_profiles` | 사용자 프로필 (is_paid 등) |
| `guides` | 업무 가이드 콘텐츠 (47개) |
| `checklists` | 체크리스트 항목 |
| `user_notes` | 개인 메모 |
| `calendar_events` | 사내 일정 |
| `payment_logs` | 결제 이력 |

---

## 기술 스택

| 구분 | 기술 |
|------|------|
| Backend | Hono v4 + Cloudflare Workers |
| Frontend | HTML/CSS + Tailwind CSS CDN + FontAwesome |
| Auth | Supabase Auth (이메일 + Google OAuth) |
| DB | Supabase PostgreSQL |
| 결제 | PortOne V2 |
| Session | HttpOnly Cookie (서버사이드) |
| Deploy | Cloudflare Pages |
| Build | Vite + @hono/vite-cloudflare-pages |

---

## 로컬 개발 환경 설정

### 1. 저장소 클론
```bash
git clone https://github.com/lsol1994/bizready.git
cd bizready
npm install
```

### 2. 환경변수 설정 (`.dev.vars`)
```
SUPABASE_URL=https://blvhpajeaelvmgfglivk.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
PORTONE_V2_STORE_ID=...
PORTONE_V2_SECRET_KEY=...
ADMIN_EMAIL=lsol3264@gmail.com
```

### 3. 빌드 & 실행
```bash
npm run build
pm2 start ecosystem.config.cjs
```

---

## 배포

```bash
# Cloudflare Pages 배포
npm run build
npx wrangler pages deploy dist --project-name bizready

# 이메일 템플릿 재적용 (변경 시)
python3 scripts/apply-email-templates.py --token [SUPABASE_ACCESS_TOKEN]
```

---

## 자동화 스크립트

| 파일 | 설명 |
|------|------|
| `scripts/post-deploy.py` | 작업 완료 후 Notion + GitHub + 체크리스트 자동화 |
| `scripts/apply-email-templates.py` | Supabase 이메일 템플릿 자동 적용 |
| `scripts/email-templates/` | 이메일 HTML 템플릿 3종 |

---

*Last updated: 2026-03-26*
