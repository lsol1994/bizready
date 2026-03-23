import { Hono } from 'hono'
import { renderer } from './renderer'
import { parseSessionCookie } from './lib/session'
import authRoutes     from './routes/auth'
import loginRoute     from './routes/login'
import dashboardRoute from './routes/dashboard'
import archiveRoute   from './routes/archive'
import guideRoute     from './routes/guide'
import searchRoute    from './routes/search'
import checklistRoute from './routes/checklist'
import type { Env } from './lib/supabase'

const app = new Hono<{ Bindings: Env }>()

// ── 인증 라우트 ────────────────────────────────
app.route('/auth', authRoutes)

// ── 로그인 페이지 ──────────────────────────────
app.route('/login', loginRoute)

// ── 보호 라우트 미들웨어 (dashboard/*) ───────────
app.use('/dashboard/*', async (c, next) => {
  const cookie = c.req.header('Cookie') ?? ''
  const session = parseSessionCookie(cookie)
  if (!session) return c.redirect('/login?error=unauthorized')
  await next()
})

// ── 대시보드 서브 라우트 ───────────────────────
app.route('/dashboard/archive',   archiveRoute)
app.route('/dashboard/guide',     guideRoute)
app.route('/dashboard/search',    searchRoute)
app.route('/dashboard/checklist', checklistRoute)
app.route('/dashboard',           dashboardRoute)

// ── 루트 리다이렉트 ────────────────────────────
app.get('/', (c) => {
  const cookie = c.req.header('Cookie') ?? ''
  const session = parseSessionCookie(cookie)
  return c.redirect(session ? '/dashboard' : '/login')
})

export default app
