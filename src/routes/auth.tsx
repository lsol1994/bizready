import { Hono } from 'hono'
import type { Env } from '../lib/supabase'

const auth = new Hono<{ Bindings: Env }>()

// ─────────────────────────────────────────────
//  GET /auth/callback  ← Supabase OAuth 리다이렉트 처리
// ─────────────────────────────────────────────
auth.get('/callback', async (c) => {
  // Supabase는 OAuth 후 hash fragment 로 토큰을 전달함
  // → 브라우저 JS 에서 처리해야 하므로 중계 HTML 반환
  return c.html(`<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8" />
  <title>로그인 처리중...</title>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
</head>
<body>
  <div style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:sans-serif;color:#1e3a5f;">
    <div style="text-align:center;">
      <div style="font-size:48px;margin-bottom:16px;">⏳</div>
      <p style="font-size:18px;">로그인 처리 중입니다...</p>
    </div>
  </div>
  <script>
    (async function () {
      const SUPABASE_URL = '${c.env.SUPABASE_URL}'
      const SUPABASE_ANON_KEY = '${c.env.SUPABASE_ANON_KEY}'
      const { createClient } = supabase
      const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

      const { data, error } = await client.auth.getSession()
      if (error || !data.session) {
        // hash에서 직접 파싱 시도
        const hash = window.location.hash
        const params = new URLSearchParams(hash.substring(1))
        const access_token = params.get('access_token')
        const refresh_token = params.get('refresh_token')
        if (access_token) {
          await client.auth.setSession({ access_token, refresh_token: refresh_token || '' })
        }
      }
      // 서버에 세션 저장 후 대시보드로
      const { data: sessionData } = await client.auth.getSession()
      if (sessionData?.session?.access_token) {
        const res = await fetch('/auth/set-session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            access_token: sessionData.session.access_token,
            refresh_token: sessionData.session.refresh_token,
          }),
        })
        if (res.ok) {
          window.location.href = '/dashboard'
          return
        }
      }
      window.location.href = '/login?error=auth_failed'
    })()
  </script>
</body>
</html>`)
})

// ─────────────────────────────────────────────
//  POST /auth/set-session  ← 토큰을 HttpOnly 쿠키에 저장
// ─────────────────────────────────────────────
auth.post('/set-session', async (c) => {
  const { access_token, refresh_token } = await c.req.json<{
    access_token: string
    refresh_token: string
  }>()

  if (!access_token) {
    return c.json({ error: 'No token' }, 400)
  }

  const sessionData = JSON.stringify({ access_token, refresh_token })
  const encoded = encodeURIComponent(sessionData)

  c.header(
    'Set-Cookie',
    `sb-session=${encoded}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 7}`
  )
  return c.json({ ok: true })
})

// ─────────────────────────────────────────────
//  POST /auth/logout
// ─────────────────────────────────────────────
auth.post('/logout', (c) => {
  c.header('Set-Cookie', `sb-session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`)
  return c.redirect('/login')
})

export default auth
