# BizReady — 경영지원 신규 입사자 올인원 아카이브

## 프로젝트 개요
- **이름**: BizReady
- **목적**: 중소기업 경영지원부 신규 입사자를 위한 실무 지식 아카이브 SaaS
- **타겟**: 회계·인사·노무·총무 동시 수행 1인 경영지원 담당자

## 현재 구현된 기능
- ✅ 이메일/비밀번호 로그인 (Supabase Auth)
- ✅ Google 계정 소셜 로그인 (OAuth)
- ✅ 회원가입 (이메일 인증 포함)
- ✅ 비밀번호 재설정 (이메일 발송)
- ✅ HttpOnly 쿠키 기반 서버사이드 세션
- ✅ 보호 라우트 (미인증 접근 자동 차단 → /login 리다이렉트)
- ✅ 메인 대시보드 (카테고리 6개, 통계 카드, 최근 가이드 목록)
- ✅ 반응형 사이드바 레이아웃

## API 엔드포인트
| Method | Path | 설명 |
|--------|------|------|
| GET | `/` | 루트 (세션 유무에 따라 리다이렉트) |
| GET | `/login` | 로그인 페이지 |
| GET | `/auth/callback` | OAuth 콜백 처리 |
| POST | `/auth/set-session` | 토큰 → 쿠키 저장 |
| POST | `/auth/logout` | 로그아웃 (쿠키 삭제) |
| GET | `/dashboard` | 메인 대시보드 (🔒 보호) |

## 미구현 기능 (다음 단계)
- [ ] 업무 아카이브 상세 페이지 (`/dashboard/archive`)
- [ ] 키워드 검색 기능 (`/dashboard/search`)
- [ ] 입사 체크리스트 (`/dashboard/checklist`)
- [ ] 개인 메모 기능 (`/dashboard/memo`)
- [ ] Supabase D1/KV 연동 (콘텐츠 DB)
- [ ] 결제 시스템 (Portone 연동)
- [ ] 관리자 콘텐츠 관리 패널

## 로컬 개발 환경 설정

### 1. Supabase 프로젝트 생성
1. [https://supabase.com](https://supabase.com) 접속 → 새 프로젝트 생성
2. Settings → API → `Project URL`, `anon public` 키 복사

### 2. 환경변수 설정
`.dev.vars` 파일에 입력:
```
SUPABASE_URL=https://xxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

### 3. (선택) Google OAuth 설정
Supabase Dashboard → Authentication → Providers → Google 활성화

### 4. 실행
```bash
npm run build
pm2 start ecosystem.config.cjs
```

## 기술 스택
- **Backend**: Hono v4 + Cloudflare Workers
- **Frontend**: HTML/CSS + Tailwind CSS (CDN) + FontAwesome
- **Auth**: Supabase Auth (이메일 + Google OAuth)
- **Session**: HttpOnly Cookie (서버사이드)
- **Deploy**: Cloudflare Pages
- **Build**: Vite + @hono/vite-build

## 배포 (Cloudflare Pages)
```bash
npm run deploy
```

## 데이터 구조 (예정)
- **마스터 데이터**: 관리자 제공 업무 가이드 (Supabase DB)
- **사용자 데이터**: 개인 메모, 체크리스트 진행 현황 (RLS 적용)
- **세션**: HttpOnly 쿠키 (7일 유효)
