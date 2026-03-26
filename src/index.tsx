import { Hono } from 'hono'
import { parseSessionCookie } from './lib/session'
import authRoutes        from './routes/auth'
import loginRoute        from './routes/login'
import resetPasswordRoute from './routes/reset-password'
import dashboardRoute    from './routes/dashboard'
import archiveRoute      from './routes/archive'
import guideRoute        from './routes/guide'
import searchRoute       from './routes/search'
import checklistRoute    from './routes/checklist'
import paymentRoute      from './routes/payment'
import paymentApi        from './routes/payment-api'
import adminRoute        from './routes/admin'
import fileApi           from './routes/file-api'
import calendarRoute     from './routes/calendar'
import memoRoute         from './routes/memo'
import reminderRoute     from './routes/reminder'
import settingsRoute     from './routes/settings'
import bookmarkRoute    from './routes/bookmark'
import { getSupabaseAdmin } from './lib/supabase'
import type { Env } from './lib/supabase'

const app = new Hono<{ Bindings: Env }>()

// ── 인증 라우트 ────────────────────────────────
app.route('/auth', authRoutes)

// ── 로그인 페이지 ──────────────────────────────
app.route('/login', loginRoute)

// ── 비밀번호 재설정 페이지 (인증 불필요) ────────
app.route('/reset-password', resetPasswordRoute)

// ── 회원가입 API: 가입 즉시 이메일 인증 처리 ────────
// 클라이언트에서 signUp() 후 이 엔드포인트를 호출 → service_role로 email_confirm 강제 처리
app.post('/api/auth/signup', async (c) => {
  try {
    const { userId } = await c.req.json<{ userId: string }>()
    if (!userId) return c.json({ ok: false, error: 'missing userId' }, 400)

    const admin = getSupabaseAdmin(c.env)

    // email_confirm: true 로 강제 인증 처리 (이메일 발송 불필요)
    const { error } = await admin.auth.admin.updateUserById(userId, {
      email_confirm: true,
    })
    if (error) {
      console.error('[signup confirm error]', error.message)
      return c.json({ ok: false, error: error.message }, 500)
    }

    return c.json({ ok: true })
  } catch (e: any) {
    return c.json({ ok: false, error: e.message }, 500)
  }
})

// ── 결제 완료 API (세션 미들웨어 내부에서 자체 검증) ──
app.route('/api/payment', paymentApi)

// ── 파일 업로드/다운로드 API ──────────────────────────
app.route('/api/files', fileApi)

// ── 관리자 라우트 (lsol3264@gmail.com 전용) ───────
app.route('/admin', adminRoute)

// ── 보호 라우트 미들웨어 (/dashboard/*) ───────────
app.use('/dashboard/*', async (c, next) => {
  const cookie = c.req.header('Cookie') ?? ''
  const session = parseSessionCookie(cookie)
  if (!session) return c.redirect('/login?error=unauthorized')
  await next()
})

// ── 대시보드 서브 라우트 ────────────────────────
app.route('/dashboard/bookmark',  bookmarkRoute)
app.route('/dashboard/archive',   archiveRoute)
app.route('/dashboard/guide',     guideRoute)
app.route('/dashboard/search',    searchRoute)
app.route('/dashboard/checklist', checklistRoute)
app.route('/dashboard/payment',   paymentRoute)
app.route('/dashboard/calendar',  calendarRoute)
app.route('/dashboard/memo',      memoRoute)
app.route('/dashboard/settings',  settingsRoute)
app.route('/dashboard',           dashboardRoute)

// ── 리마인더 API (인증 불필요 — Cron Trigger 진입점) ────
app.route('/api/reminder',        reminderRoute)



// ── 대시보드 목업 미리보기 (임시) ────────────────
app.get('/mockup/dashboard', async (c) => {
  const html = await import('../public/preview/dashboard-mockup.html?raw')
  return c.html(html.default)
})

// ── 루트 리다이렉트 ─────────────────────────────
app.get('/', (c) => {
  const cookie = c.req.header('Cookie') ?? ''
  const session = parseSessionCookie(cookie)
  return c.redirect(session ? '/dashboard' : '/login')
})

export default app
