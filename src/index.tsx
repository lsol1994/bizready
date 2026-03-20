import { Hono } from 'hono'
import { renderer } from './renderer'
import { parseSessionCookie } from './lib/session'
import authRoutes from './routes/auth'
import loginRoute from './routes/login'
import dashboardRoute from './routes/dashboard'
import type { Env } from './lib/supabase'

const app = new Hono<{ Bindings: Env }>()

// ─── 정적 파일 ───────────────────────────────────
app.use('/static/*', async (c, next) => {
  await next()
})

// ─── 인증 라우트 ─────────────────────────────────
app.route('/auth', authRoutes)

// ─── 로그인 페이지 ────────────────────────────────
app.route('/login', loginRoute)

// ─── 대시보드 (보호 라우트) ─────────────────────────
// 세션 미들웨어 - /dashboard/* 전체에 적용
app.use('/dashboard/*', async (c, next) => {
  const cookie = c.req.header('Cookie') ?? ''
  const session = parseSessionCookie(cookie)
  if (!session) {
    return c.redirect('/login?error=unauthorized')
  }
  await next()
})

app.route('/dashboard', dashboardRoute)

// ─── 루트 리다이렉트 ─────────────────────────────
app.get('/', (c) => {
  const cookie = c.req.header('Cookie') ?? ''
  const session = parseSessionCookie(cookie)
  if (session) {
    return c.redirect('/dashboard')
  }
  return c.redirect('/login')
})

export default app
