import { Hono } from 'hono'
import type { Env } from '../lib/supabase'

const auth = new Hono<{ Bindings: Env }>()

// ─────────────────────────────────────────────────────────────
//  GET /auth/callback
//  처리 케이스:
//  1) 이메일 인증 / 비밀번호 재설정  → URL에 ?code=xxx  (PKCE flow)
//  2) Google OAuth                   → URL hash에 #access_token=xxx
//  3) 이메일 인증링크 (구형)           → URL hash에 #access_token=xxx&type=signup
// ─────────────────────────────────────────────────────────────
auth.get('/callback', async (c) => {
  const SUPABASE_URL     = c.env.SUPABASE_URL
  const SUPABASE_ANON_KEY = c.env.SUPABASE_ANON_KEY

  return c.html(`<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>로그인 처리중... | BizReady</title>
  <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>
  <style>
    body { margin:0; display:flex; align-items:center; justify-content:center;
           height:100vh; font-family:-apple-system,sans-serif; background:#f0f9ff; }
    .box { text-align:center; background:white; border-radius:20px;
           padding:40px 48px; box-shadow:0 4px 24px rgba(0,0,0,.08); max-width:360px; width:90%; }
    .icon { font-size:48px; margin-bottom:16px; }
    .title { font-size:18px; font-weight:700; color:#1e3a5f; margin-bottom:8px; }
    .desc  { font-size:14px; color:#64748b; margin-bottom:16px; }
    .debug { font-size:11px; color:#94a3b8; word-break:break-all; background:#f8fafc;
             border-radius:8px; padding:8px; text-align:left; display:none; }
    .err   { color:#ef4444; font-size:13px; margin-top:12px; }
  </style>
</head>
<body>
  <div class="box">
    <div class="icon" id="icon">⏳</div>
    <div class="title" id="title">로그인 처리 중...</div>
    <div class="desc"  id="desc">잠시만 기다려주세요</div>
    <div class="debug" id="debug"></div>
    <div class="err"   id="err"></div>
  </div>

  <script>
  (async function() {
    const SUPABASE_URL      = '${SUPABASE_URL}'
    const SUPABASE_ANON_KEY = '${SUPABASE_ANON_KEY}'
    const { createClient }  = supabase
    const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { autoRefreshToken: false, persistSession: true, detectSessionInUrl: true, flowType: 'implicit' }
    })

    // ── 디버그 출력 헬퍼 ──────────────────────────────────
    const dbg = document.getElementById('debug')
    const isSandbox = location.origin.includes('novita.ai') || location.origin.includes('localhost')
    function log(msg) {
      console.log('[BizReady Auth]', msg)
      if (isSandbox) {
        dbg.style.display = 'block'
        dbg.innerHTML += msg + '<br>'
      }
    }
    function showError(msg) {
      console.error('[BizReady Auth Error]', msg)
      document.getElementById('icon').textContent  = '❌'
      document.getElementById('title').textContent = '로그인 실패'
      document.getElementById('desc').textContent  = '아래 오류를 확인해주세요'
      document.getElementById('err').textContent   = msg
      if (isSandbox) {
        dbg.style.display = 'block'
        dbg.innerHTML += '<span style="color:#ef4444">ERROR: ' + msg + '</span><br>'
      }
      setTimeout(() => { location.href = '/login?error=auth_failed' }, 4000)
    }

    // ── URL 파라미터 파싱 ─────────────────────────────────
    const urlParams = new URLSearchParams(location.search)
    const hashParams = new URLSearchParams(location.hash.substring(1))

    const code          = urlParams.get('code')          // PKCE flow (이메일 인증, 비번 재설정)
    const errorCode     = urlParams.get('error')
    const errorDesc     = urlParams.get('error_description')
    const hashToken     = hashParams.get('access_token') // OAuth hash flow
    const hashType      = hashParams.get('type')         // signup | recovery | ...
    const hashRefresh   = hashParams.get('refresh_token') || ''

    log('URL: ' + location.href)
    log('code=' + code + ' | hash_token=' + (hashToken ? '있음' : '없음') + ' | type=' + hashType)

    // ── 에러 파라미터 처리 ────────────────────────────────
    if (errorCode) {
      log('Supabase 오류: ' + errorCode + ' / ' + errorDesc)
      if (errorCode === 'access_denied' && errorDesc && errorDesc.includes('redirect_uri')) {
        showError('리다이렉트 URL 불일치 오류입니다.\\n\\nSupabase Dashboard → Authentication → URL Configuration → Additional Redirect URLs 에\\n현재 주소(' + location.origin + '/auth/callback)를 추가해주세요.')
      } else {
        showError(errorCode + ': ' + (errorDesc || ''))
      }
      return
    }

    // ── CASE 1: Hash fragment token (Google OAuth implicit flow) ── 최우선 처리
    if (hashToken) {
      log('Hash token 감지 → setSession 시도 (type=' + hashType + ')')

      // ★ 비밀번호 재설정 recovery 토큰: /reset-password 로 위임
      if (hashType === 'recovery') {
        log('recovery 타입 감지 → /reset-password 로 이동')
        // hash fragment를 그대로 붙여서 리다이렉트
        location.href = '/reset-password' + location.hash
        return
      }

      try {
        const { data, error } = await client.auth.setSession({
          access_token:  hashToken,
          refresh_token: hashRefresh
        })
        if (error) { showError('세션 설정 실패: ' + error.message); return }
        log('세션 설정 성공! user=' + data.session?.user?.email)
        await saveSessionAndRedirect(data.session)
        return
      } catch(e) {
        showError('setSession 오류: ' + e.message)
        return
      }
    }

    // ── CASE 2: PKCE code (이메일 인증 / 비번 재설정) ────
    // ⚠️ Google OAuth가 implicit flow이므로 여기 도달하면 이메일 인증 코드
    if (code) {
      log('PKCE code 감지 → exchangeCodeForSession 시도')

      // ★ PKCE recovery: type=recovery 쿼리가 있으면 /reset-password 로 위임
      const typeParam = urlParams.get('type')
      if (typeParam === 'recovery') {
        log('PKCE recovery 감지 → /reset-password 로 이동')
        location.href = '/reset-password' + location.search
        return
      }

      document.getElementById('desc').textContent = '이메일 인증 처리 중...'
      try {
        const { data, error } = await client.auth.exchangeCodeForSession(code)
        if (error) {
          log('PKCE 교환 실패 (' + error.message + ') → getSession 시도')
          // code_verifier 없을 때 fallback: 이미 세션이 있으면 그대로 사용
          const { data: existing } = await client.auth.getSession()
          if (existing?.session?.access_token) {
            log('기존 세션으로 대체 처리')
            await saveSessionAndRedirect(existing.session)
            return
          }
          showError('코드 교환 실패: ' + error.message)
          return
        }
        log('코드 교환 성공! user=' + data.session?.user?.email)
        await saveSessionAndRedirect(data.session)
        return
      } catch(e) {
        showError('exchangeCodeForSession 오류: ' + e.message)
        return
      }
    }

    // ── CASE 3: 이미 세션이 있는 경우 (재방문) ───────────
    const { data: existing } = await client.auth.getSession()
    if (existing?.session?.access_token) {
      log('기존 세션 발견 → 바로 저장')
      await saveSessionAndRedirect(existing.session)
      return
    }

    // ── 아무것도 없으면 로그인으로 ───────────────────────
    log('처리할 토큰/코드 없음 → 로그인 페이지로')
    showError('인증 정보를 찾을 수 없습니다. 다시 로그인해주세요.')

    // ── 세션 저장 및 리다이렉트 공통 함수 ────────────────
    async function saveSessionAndRedirect(session) {
      if (!session?.access_token) {
        showError('세션 데이터가 올바르지 않습니다.')
        return
      }
      document.getElementById('icon').textContent  = '🔐'
      document.getElementById('desc').textContent  = '세션 저장 중...'
      const res = await fetch('/auth/set-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token:  session.access_token,
          refresh_token: session.refresh_token || ''
        })
      })
      if (res.ok) {
        document.getElementById('icon').textContent  = '✅'
        document.getElementById('title').textContent = '로그인 완료!'
        document.getElementById('desc').textContent  = '대시보드로 이동합니다...'
        log('세션 저장 완료 → /dashboard 이동')
        setTimeout(() => { location.href = '/dashboard' }, 600)
      } else {
        const body = await res.text()
        showError('세션 저장 실패: HTTP ' + res.status + ' / ' + body)
      }
    }
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

  // Cloudflare Workers / gensparksite 환경에서 SameSite=None; Secure 필요
  const isSecure = c.req.url.startsWith('https://')
  const sameSite = isSecure ? 'None' : 'Lax'
  const secureFlag = isSecure ? '; Secure' : ''
  c.header(
    'Set-Cookie',
    `sb-session=${encoded}; Path=/; HttpOnly; SameSite=${sameSite}${secureFlag}; Max-Age=${60 * 60 * 24 * 7}`
  )
  return c.json({ ok: true })
})

// ─────────────────────────────────────────────
//  POST /auth/logout
// ─────────────────────────────────────────────
auth.post('/logout', (c) => {
  const isSecure = c.req.url.startsWith('https://')
  const sameSite = isSecure ? 'None' : 'Lax'
  const secureFlag = isSecure ? '; Secure' : ''
  c.header('Set-Cookie', `sb-session=; Path=/; HttpOnly; SameSite=${sameSite}${secureFlag}; Max-Age=0`)
  return c.redirect('/login')
})

export default auth
