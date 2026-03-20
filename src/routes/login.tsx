import { Hono } from 'hono'
import { renderer } from '../renderer'
import type { Env } from '../lib/supabase'

const login = new Hono<{ Bindings: Env }>()
login.use(renderer)

login.get('/', (c) => {
  const errorMsg = c.req.query('error')
  const successMsg = c.req.query('message')

  const errorText: Record<string, string> = {
    auth_failed: '인증에 실패했습니다. 다시 시도해주세요.',
    unauthorized: '로그인이 필요한 페이지입니다.',
    session_expired: '세션이 만료되었습니다. 다시 로그인해주세요.',
  }

  return c.render(
    <div class="min-h-screen gradient-bg flex items-center justify-center px-4">
      <div class="w-full max-w-md">
        {/* 로고 영역 */}
        <div class="text-center mb-8">
          <div class="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-2xl mb-4">
            <i class="fas fa-briefcase text-white text-2xl"></i>
          </div>
          <h1 class="text-3xl font-bold text-white">BizReady</h1>
          <p class="text-sky-200 mt-2 text-sm">경영지원 신규 입사자 올인원 아카이브</p>
        </div>

        {/* 로그인 카드 */}
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

          {/* 이메일 로그인 폼 */}
          <form id="email-login-form" class="space-y-4 mb-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">이메일</label>
              <div class="relative">
                <i class="fas fa-envelope absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                <input
                  type="email"
                  id="email"
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
                  placeholder="••••••••"
                  class="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
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
              class="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <i class="fas fa-sign-in-alt"></i>
              <span>로그인</span>
            </button>
          </form>

          {/* 비밀번호 찾기 */}
          <div class="text-right mb-4">
            <button
              onclick="showResetPassword()"
              class="text-sm text-blue-600 hover:text-blue-800 hover:underline"
            >
              비밀번호를 잊으셨나요?
            </button>
          </div>

          {/* 구분선 */}
          <div class="relative my-5">
            <div class="absolute inset-0 flex items-center">
              <div class="w-full border-t border-gray-200"></div>
            </div>
            <div class="relative flex justify-center text-sm">
              <span class="px-3 bg-white text-gray-400">또는</span>
            </div>
          </div>

          {/* Google 로그인 */}
          <button
            id="google-btn"
            onclick="loginWithGoogle()"
            class="w-full border border-gray-300 hover:bg-gray-50 text-gray-700 font-medium py-2.5 rounded-lg transition-colors flex items-center justify-center gap-3"
          >
            <svg class="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Google 계정으로 로그인
          </button>

          {/* 회원가입 링크 */}
          <p class="text-center text-sm text-gray-500 mt-6">
            아직 계정이 없으신가요?{' '}
            <button onclick="showSignUp()" class="text-blue-600 hover:underline font-medium">
              회원가입
            </button>
          </p>
        </div>

        {/* 비밀번호 재설정 모달 */}
        <div id="reset-modal" class="hidden fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div class="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h3 class="font-bold text-gray-800 mb-2">비밀번호 재설정</h3>
            <p class="text-gray-500 text-sm mb-4">가입한 이메일 주소를 입력하시면 재설정 링크를 보내드립니다.</p>
            <input
              type="email"
              id="reset-email"
              placeholder="이메일 주소"
              class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div id="reset-msg" class="hidden text-sm mb-3"></div>
            <div class="flex gap-2">
              <button
                onclick="sendResetEmail()"
                class="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                전송
              </button>
              <button
                onclick="closeResetModal()"
                class="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                취소
              </button>
            </div>
          </div>
        </div>

        {/* 회원가입 모달 */}
        <div id="signup-modal" class="hidden fixed inset-0 bg-black/50 flex items-center justify-center z-50 px-4">
          <div class="bg-white rounded-2xl p-6 w-full max-w-sm">
            <h3 class="font-bold text-gray-800 mb-1">회원가입</h3>
            <p class="text-gray-500 text-sm mb-4">이메일과 비밀번호를 설정해주세요.</p>
            <div class="space-y-3">
              <input
                type="text"
                id="signup-name"
                placeholder="이름 (선택)"
                class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="email"
                id="signup-email"
                placeholder="이메일"
                class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <input
                type="password"
                id="signup-password"
                placeholder="비밀번호 (8자 이상)"
                class="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div id="signup-msg" class="hidden text-sm mt-3"></div>
            <div class="flex gap-2 mt-4">
              <button
                onclick="signUp()"
                class="flex-1 bg-blue-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                가입하기
              </button>
              <button
                onclick="closeSignupModal()"
                class="flex-1 border border-gray-300 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-50"
              >
                취소
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <p class="text-center text-white/50 text-xs mt-6">
          © 2024 BizReady. 경영지원 아카이브 서비스
        </p>
      </div>

      <script
        dangerouslySetInnerHTML={{
          __html: `
const SUPABASE_URL = '${c.env.SUPABASE_URL}'
const SUPABASE_ANON_KEY = '${c.env.SUPABASE_ANON_KEY}'
const { createClient } = supabase
const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// 이메일 로그인
document.getElementById('email-login-form').addEventListener('submit', async (e) => {
  e.preventDefault()
  const btn = document.getElementById('login-btn')
  const errDiv = document.getElementById('form-error')
  const errText = document.getElementById('form-error-text')
  btn.disabled = true
  btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>로그인 중...'
  errDiv.classList.add('hidden')

  const email = document.getElementById('email').value
  const password = document.getElementById('password').value

  const { data, error } = await client.auth.signInWithPassword({ email, password })
  if (error) {
    errDiv.classList.remove('hidden')
    errText.textContent = error.message.includes('Invalid') ? '이메일 또는 비밀번호가 올바르지 않습니다.' : error.message
    btn.disabled = false
    btn.innerHTML = '<i class="fas fa-sign-in-alt mr-2"></i>로그인'
    return
  }
  if (data.session) {
    await fetch('/auth/set-session', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_token: data.session.access_token,
        refresh_token: data.session.refresh_token,
      }),
    })
    window.location.href = '/dashboard'
  }
})

// Google OAuth
async function loginWithGoogle() {
  const { error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin + '/auth/callback' }
  })
  if (error) alert('Google 로그인 오류: ' + error.message)
}

// 비밀번호 표시 토글
function togglePassword() {
  const pw = document.getElementById('password')
  const eye = document.getElementById('pw-eye')
  if (pw.type === 'password') {
    pw.type = 'text'
    eye.className = 'fas fa-eye-slash text-sm'
  } else {
    pw.type = 'password'
    eye.className = 'fas fa-eye text-sm'
  }
}

// 비밀번호 재설정
function showResetPassword() {
  document.getElementById('reset-modal').classList.remove('hidden')
}
function closeResetModal() {
  document.getElementById('reset-modal').classList.add('hidden')
}
async function sendResetEmail() {
  const email = document.getElementById('reset-email').value
  const msg = document.getElementById('reset-msg')
  if (!email) return
  const { error } = await client.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + '/auth/callback'
  })
  msg.classList.remove('hidden')
  if (error) {
    msg.className = 'text-sm mt-3 text-red-600'
    msg.textContent = '오류가 발생했습니다: ' + error.message
  } else {
    msg.className = 'text-sm mt-3 text-green-600'
    msg.textContent = '재설정 링크를 이메일로 전송했습니다!'
  }
}

// 회원가입
function showSignUp() {
  document.getElementById('signup-modal').classList.remove('hidden')
}
function closeSignupModal() {
  document.getElementById('signup-modal').classList.add('hidden')
}
async function signUp() {
  const email = document.getElementById('signup-email').value
  const password = document.getElementById('signup-password').value
  const name = document.getElementById('signup-name').value
  const msg = document.getElementById('signup-msg')
  if (!email || !password) {
    msg.classList.remove('hidden')
    msg.className = 'text-sm mt-3 text-red-600'
    msg.textContent = '이메일과 비밀번호를 입력해주세요.'
    return
  }
  const { error } = await client.auth.signUp({
    email, password,
    options: { data: { full_name: name } }
  })
  msg.classList.remove('hidden')
  if (error) {
    msg.className = 'text-sm mt-3 text-red-600'
    msg.textContent = error.message
  } else {
    msg.className = 'text-sm mt-3 text-green-600'
    msg.textContent = '가입 완료! 이메일을 확인하여 계정을 인증해주세요.'
  }
}
`,
        }}
      />
    </div>,
    { title: '로그인 | BizReady' }
  )
})

export default login
