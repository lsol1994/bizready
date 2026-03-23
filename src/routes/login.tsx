import { Hono } from 'hono'
import { renderer } from '../renderer'
import type { Env } from '../lib/supabase'

const login = new Hono<{ Bindings: Env }>()
login.use(renderer)

login.get('/', (c) => {
  const errorMsg = c.req.query('error')
  const successMsg = c.req.query('message')

  const errorText: Record<string, string> = {
    auth_failed:      '인증에 실패했습니다. 다시 시도해주세요.',
    unauthorized:     '로그인이 필요한 페이지입니다.',
    session_expired:  '세션이 만료되었습니다. 다시 로그인해주세요.',
  }

  return c.render(
    <div class="min-h-screen gradient-bg flex items-center justify-center px-4">
      <div class="w-full max-w-md">

        {/* 로고 */}
        <div class="text-center mb-8">
          <div class="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-2xl mb-4">
            <i class="fas fa-briefcase text-white text-2xl"></i>
          </div>
          <h1 class="text-3xl font-bold text-white">BizReady</h1>
          <p class="text-sky-200 mt-2 text-sm">경영지원 신규 입사자 올인원 아카이브</p>
        </div>

        {/* 카드 */}
        <div class="bg-white rounded-2xl shadow-2xl p-8">
          <h2 class="text-xl font-bold text-gray-800 mb-1">시작하기</h2>
          <p class="text-gray-500 text-sm mb-6">계정으로 로그인하면 모든 업무 가이드에 접근할 수 있습니다</p>

          {/* 에러/성공 메시지 */}
          {errorMsg && (
            <div class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
              <i class="fas fa-exclamation-circle text-red-500 text-sm"></i>
              <span class="text-red-700 text-sm">{errorText[errorMsg] ?? errorMsg}</span>
            </div>
          )}
          {successMsg && (
            <div class="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
              <i class="fas fa-check-circle text-green-500 text-sm"></i>
              <span class="text-green-700 text-sm">{successMsg}</span>
            </div>
          )}

          {/* ★ Google 로그인 — 최상단 강조 */}
          <button
            id="google-btn"
            onclick="loginWithGoogle()"
            class="w-full border-2 border-blue-200 bg-blue-50 hover:bg-blue-100 text-gray-700 font-semibold py-3 rounded-xl transition-colors flex items-center justify-center gap-3 mb-4"
          >
            <svg class="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            <span>Google 계정으로 계속하기</span>
            <span class="ml-auto text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">추천</span>
          </button>

          {/* 구분선 */}
          <div class="relative my-5">
            <div class="absolute inset-0 flex items-center">
              <div class="w-full border-t border-gray-200"></div>
            </div>
            <div class="relative flex justify-center text-sm">
              <span class="px-3 bg-white text-gray-400">또는 이메일로 로그인</span>
            </div>
          </div>

          {/* 이메일 로그인 폼 */}
          <form id="email-login-form" class="space-y-4 mb-3" autocomplete="on">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">이메일</label>
              <div class="relative">
                <i class="fas fa-envelope absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                <input
                  type="email"
                  id="email"
                  name="email"
                  autocomplete="email"
                  placeholder="example@company.com"
                  class="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">비밀번호</label>
              <div class="relative">
                <i class="fas fa-lock absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                <input
                  type="password"
                  id="password"
                  name="password"
                  autocomplete="current-password"
                  placeholder="••••••••"
                  class="w-full pl-9 pr-10 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
                <button
                  type="button"
                  onclick="togglePassword()"
                  class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <i class="fas fa-eye text-sm" id="pw-eye"></i>
                </button>
              </div>
            </div>

            {/* 에러 표시 */}
            <div id="form-error" class="hidden p-3 bg-red-50 border border-red-200 rounded-lg">
              <span class="text-red-700 text-sm" id="form-error-text"></span>
            </div>

            <button
              type="submit"
              id="login-btn"
              class="w-full bg-gray-800 hover:bg-gray-900 text-white font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <i class="fas fa-sign-in-alt"></i>
              <span>이메일로 로그인</span>
            </button>
          </form>

          {/* 하단 링크 */}
          <div class="flex items-center justify-between text-sm">
            <button
              onclick="showResetPassword()"
              class="text-gray-400 hover:text-blue-600 hover:underline"
            >
              비밀번호 찾기
            </button>
            <button onclick="showSignUp()" class="text-blue-600 hover:underline font-medium">
              이메일로 회원가입
            </button>
          </div>
        </div>

        {/* 비밀번호 재설정 모달 */}
        <div id="reset-modal" class="hidden fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div class="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h3 class="font-bold text-gray-800 mb-2">비밀번호 재설정</h3>
            <p class="text-gray-500 text-sm mb-4">가입한 이메일 주소를 입력하시면 재설정 링크를 보내드립니다.</p>
            <input
              type="email"
              id="reset-email"
              autocomplete="email"
              placeholder="이메일 주소"
              class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div id="reset-msg" class="hidden text-sm mb-3"></div>
            <div class="flex gap-2">
              <button
                onclick="sendResetEmail()"
                class="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
              >전송</button>
              <button
                onclick="closeResetModal()"
                class="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50"
              >취소</button>
            </div>
          </div>
        </div>

        {/* 회원가입 모달 */}
        <div id="signup-modal" class="hidden fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div class="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h3 class="font-bold text-gray-800 mb-1">이메일 회원가입</h3>
            <p class="text-gray-500 text-sm mb-1">가입 즉시 이메일 인증 없이 바로 로그인됩니다.</p>
            {/* Google 유도 배너 */}
            <div class="bg-blue-50 border border-blue-200 rounded-lg px-3 py-2 mb-4 flex items-center gap-2">
              <i class="fab fa-google text-blue-500 text-sm"></i>
              <span class="text-blue-700 text-xs">Gmail 계정이 있다면 <button onclick="closeSignupModal();loginWithGoogle()" class="font-semibold underline">Google 로그인</button>이 더 편해요!</span>
            </div>
            <div class="space-y-3">
              <input
                type="text"
                id="signup-name"
                placeholder="이름 (선택)"
                autocomplete="name"
                class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="email"
                id="signup-email"
                placeholder="이메일"
                autocomplete="email"
                class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="password"
                id="signup-password"
                placeholder="비밀번호 (8자 이상)"
                autocomplete="new-password"
                class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div id="signup-msg" class="hidden text-sm mt-3"></div>
            <div class="flex gap-2 mt-4">
              <button
                id="signup-btn"
                onclick="signUp()"
                class="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
              >가입하기</button>
              <button
                onclick="closeSignupModal()"
                class="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50"
              >취소</button>
            </div>
          </div>
        </div>

        <p class="text-center text-white/50 text-xs mt-6">© 2025 BizReady. 경영지원 아카이브 서비스</p>
      </div>

      <script
        dangerouslySetInnerHTML={{
          __html: `
const SUPABASE_URL = '${c.env.SUPABASE_URL}'
const SUPABASE_ANON_KEY = '${c.env.SUPABASE_ANON_KEY}'
const { createClient } = supabase
const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ── 이메일 로그인 ───────────────────────────────────────
document.getElementById('email-login-form').addEventListener('submit', async (e) => {
  e.preventDefault()
  const btn     = document.getElementById('login-btn')
  const errDiv  = document.getElementById('form-error')
  const errText = document.getElementById('form-error-text')
  btn.disabled  = true
  btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>로그인 중...'
  errDiv.classList.add('hidden')

  const email    = document.getElementById('email').value.trim()
  const password = document.getElementById('password').value

  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error) {
    errDiv.classList.remove('hidden')
    if (error.message.includes('Email not confirmed')) {
      errText.textContent = '이메일 인증이 필요합니다. 잠시 후 다시 시도해주세요.'
    } else if (error.message.includes('Invalid login')) {
      errText.textContent = '이메일 또는 비밀번호가 올바르지 않습니다.'
    } else {
      errText.textContent = error.message
    }
    btn.disabled  = false
    btn.innerHTML = '<i class="fas fa-sign-in-alt mr-2"></i>이메일로 로그인'
    return
  }
  if (data.session) {
    await fetch('/auth/set-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_token:  data.session.access_token,
        refresh_token: data.session.refresh_token,
      }),
    })
    window.location.href = '/dashboard'
  }
})

// ── Google OAuth ────────────────────────────────────────
async function loginWithGoogle() {
  const btn = document.getElementById('google-btn')
  btn.disabled  = true
  btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>Google로 이동 중...'
  const { error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + '/auth/callback' }
  })
  if (error) {
    alert('Google 로그인 오류: ' + error.message)
    btn.disabled  = false
    btn.innerHTML = '<svg class="w-5 h-5 flex-shrink-0" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg><span>Google 계정으로 계속하기</span><span class="ml-auto text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">추천</span>'
  }
}

// ── 비밀번호 표시 토글 ──────────────────────────────────
function togglePassword() {
  const pw  = document.getElementById('password')
  const eye = document.getElementById('pw-eye')
  if (pw.type === 'password') {
    pw.type       = 'text'
    eye.className = 'fas fa-eye-slash text-sm'
  } else {
    pw.type       = 'password'
    eye.className = 'fas fa-eye text-sm'
  }
}

// ── 비밀번호 재설정 ──────────────────────────────────────
function showResetPassword()  { document.getElementById('reset-modal').classList.remove('hidden') }
function closeResetModal()    { document.getElementById('reset-modal').classList.add('hidden') }
async function sendResetEmail() {
  const email = document.getElementById('reset-email').value.trim()
  const msg   = document.getElementById('reset-msg')
  if (!email) return
  const { error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/auth/callback'
  })
  msg.classList.remove('hidden')
  if (error) {
    msg.className   = 'text-sm mt-3 text-red-600'
    msg.textContent = '오류: ' + error.message
  } else {
    msg.className   = 'text-sm mt-3 text-green-600'
    msg.textContent = '재설정 링크를 이메일로 전송했습니다! (스팸함도 확인해주세요)'
  }
}

// ── 회원가입 ─────────────────────────────────────────────
// 핵심: 가입 후 /api/auth/signup 으로 userId 전달 → 서버에서 email_confirm 자동 처리
function showSignUp()       { document.getElementById('signup-modal').classList.remove('hidden') }
function closeSignupModal() { document.getElementById('signup-modal').classList.add('hidden') }

async function signUp() {
  const email    = document.getElementById('signup-email').value.trim()
  const password = document.getElementById('signup-password').value
  const name     = document.getElementById('signup-name').value.trim()
  const msg      = document.getElementById('signup-msg')
  const btn      = document.getElementById('signup-btn')

  if (!email || !password) {
    msg.classList.remove('hidden')
    msg.className   = 'text-sm mt-3 text-red-600'
    msg.textContent = '이메일과 비밀번호를 입력해주세요.'
    return
  }
  if (password.length < 8) {
    msg.classList.remove('hidden')
    msg.className   = 'text-sm mt-3 text-red-600'
    msg.textContent = '비밀번호는 8자 이상이어야 합니다.'
    return
  }

  btn.disabled    = true
  btn.textContent = '처리 중...'
  msg.classList.add('hidden')

  // 1단계: Supabase signUp
  const { data, error } = await client.auth.signUp({
    email, password,
    options: { data: { full_name: name || email.split('@')[0] } }
  })

  if (error) {
    msg.classList.remove('hidden')
    msg.className = 'text-sm mt-3 text-red-600'
    // 이메일 중복 = 이미 Google로 가입된 경우가 대부분
    if (error.message.includes('already registered') || error.message.includes('already been registered')) {
      msg.innerHTML = '이미 가입된 이메일입니다.<br>혹시 <strong>Google로 가입</strong>하셨나요? 위의 Google 버튼을 이용해주세요.'
    } else {
      msg.textContent = error.message
    }
    btn.disabled    = false
    btn.textContent = '가입하기'
    return
  }

  // 2단계: 서버사이드에서 이메일 인증 자동 처리
  if (data.user) {
    const confirmRes = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId: data.user.id })
    })
    const confirmData = await confirmRes.json()

    if (!confirmData.ok) {
      msg.classList.remove('hidden')
      msg.className   = 'text-sm mt-3 text-orange-600'
      msg.textContent = '가입은 완료됐지만 인증 처리 중 오류가 발생했습니다. 잠시 후 로그인을 시도해주세요.'
      btn.disabled    = false
      btn.textContent = '가입하기'
      return
    }

    // 3단계: 가입 즉시 자동 로그인
    const { data: loginData, error: loginErr } = await client.auth.signInWithPassword({ email, password })
    if (!loginErr && loginData.session) {
      msg.classList.remove('hidden')
      msg.className   = 'text-sm mt-3 text-green-600'
      msg.textContent = '가입 완료! 대시보드로 이동합니다...'
      await fetch('/auth/set-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          access_token:  loginData.session.access_token,
          refresh_token: loginData.session.refresh_token,
        }),
      })
      setTimeout(() => { window.location.href = '/dashboard' }, 800)
      return
    }
  }

  msg.classList.remove('hidden')
  msg.className   = 'text-sm mt-3 text-green-600'
  msg.textContent = '가입이 완료됐습니다. 로그인해주세요.'
  btn.disabled    = false
  btn.textContent = '가입하기'
}
`,
        }}
      />
    </div>,
    { title: '로그인 | BizReady' }
  )
})

export default login
