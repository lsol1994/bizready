import { Hono } from 'hono'
import { renderer } from '../renderer'
import type { Env } from '../lib/supabase'

const resetPassword = new Hono<{ Bindings: Env }>()
resetPassword.use(renderer)

// GET /reset-password  ← Supabase 재설정 링크 클릭 시 진입
// URL 형태: /reset-password#access_token=xxx&type=recovery
resetPassword.get('/', (c) => {
  return c.render(
    <div class="min-h-screen gradient-bg flex items-center justify-center px-4">
      <div class="w-full max-w-md">

        {/* 로고 */}
        <div class="text-center mb-8">
          <div class="inline-flex items-center justify-center w-16 h-16 bg-white/20 rounded-2xl mb-4">
            <i class="fas fa-lock text-white text-2xl"></i>
          </div>
          <h1 class="text-3xl font-bold text-white">BizReady</h1>
          <p class="text-sky-200 mt-2 text-sm">비밀번호 재설정</p>
        </div>

        {/* 카드 */}
        <div class="bg-white rounded-2xl shadow-2xl p-8" id="card">

          {/* 로딩 상태 (초기) */}
          <div id="state-loading" class="text-center py-4">
            <i class="fas fa-spinner fa-spin text-blue-500 text-3xl mb-4"></i>
            <p class="text-gray-600 text-sm">인증 확인 중...</p>
          </div>

          {/* 오류 상태 */}
          <div id="state-error" class="hidden text-center py-4">
            <div class="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <i class="fas fa-exclamation-triangle text-red-500 text-2xl"></i>
            </div>
            <h2 class="text-lg font-bold text-gray-800 mb-2">링크가 만료되었습니다</h2>
            <p class="text-gray-500 text-sm mb-6" id="error-detail">재설정 링크가 유효하지 않거나 만료되었습니다.</p>
            <a href="/login"
              class="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-6 rounded-xl transition-colors text-sm">
              <i class="fas fa-arrow-left"></i>
              로그인 페이지로 돌아가기
            </a>
          </div>

          {/* 비밀번호 입력 폼 */}
          <div id="state-form" class="hidden">
            <h2 class="text-xl font-bold text-gray-800 mb-1">새 비밀번호 설정</h2>
            <p class="text-gray-500 text-sm mb-6">사용할 새 비밀번호를 입력해주세요.</p>

            <form id="reset-form" class="space-y-4" autocomplete="off">
              {/* 새 비밀번호 */}
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">새 비밀번호</label>
                <div class="relative">
                  <i class="fas fa-lock absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                  <input
                    type="password"
                    id="new-password"
                    autocomplete="new-password"
                    placeholder="8자 이상 입력"
                    class="w-full pl-9 pr-10 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button type="button" onclick="togglePw('new-password','eye1')"
                    class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <i class="fas fa-eye text-sm" id="eye1"></i>
                  </button>
                </div>
                {/* 강도 표시바 */}
                <div class="mt-1.5 h-1.5 bg-gray-200 rounded-full overflow-hidden">
                  <div id="strength-bar" class="h-full rounded-full transition-all duration-300 w-0"></div>
                </div>
                <p class="text-xs mt-1 text-gray-400" id="strength-label"></p>
              </div>

              {/* 비밀번호 확인 */}
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">비밀번호 확인</label>
                <div class="relative">
                  <i class="fas fa-shield-alt absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                  <input
                    type="password"
                    id="confirm-password"
                    autocomplete="new-password"
                    placeholder="비밀번호 재입력"
                    class="w-full pl-9 pr-10 py-2.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <button type="button" onclick="togglePw('confirm-password','eye2')"
                    class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <i class="fas fa-eye text-sm" id="eye2"></i>
                  </button>
                </div>
                <p class="text-xs mt-1 text-red-500 hidden" id="match-error">비밀번호가 일치하지 않습니다.</p>
              </div>

              {/* 에러 메시지 */}
              <div id="form-error" class="hidden p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2">
                <i class="fas fa-exclamation-circle text-red-500 text-sm"></i>
                <span class="text-red-700 text-sm" id="form-error-text"></span>
              </div>

              <button
                type="submit"
                id="submit-btn"
                class="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2"
              >
                <i class="fas fa-check"></i>
                <span>비밀번호 변경하기</span>
              </button>
            </form>
          </div>

          {/* 완료 상태 */}
          <div id="state-success" class="hidden text-center py-4">
            <div class="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <i class="fas fa-check-circle text-green-500 text-3xl"></i>
            </div>
            <h2 class="text-lg font-bold text-gray-800 mb-2">비밀번호 변경 완료!</h2>
            <p class="text-gray-500 text-sm mb-6">새 비밀번호로 로그인해주세요.<br/>잠시 후 자동으로 이동합니다.</p>
            <div class="flex items-center justify-center gap-2 text-blue-600 text-sm">
              <i class="fas fa-spinner fa-spin"></i>
              <span>로그인 페이지로 이동 중...</span>
            </div>
          </div>

        </div>

        <p class="text-center text-white/50 text-xs mt-6">© 2025 BizReady. 경영지원 아카이브 서비스</p>
      </div>

      <script dangerouslySetInnerHTML={{ __html: `
const SUPABASE_URL      = '${c.env.SUPABASE_URL}'
const SUPABASE_ANON_KEY = '${c.env.SUPABASE_ANON_KEY}'
` }} />

      <script dangerouslySetInnerHTML={{ __html: `
;(async function() {
  // ── 상태 전환 헬퍼 ─────────────────────────────────────
  function showState(name) {
    ['loading','error','form','success'].forEach(s => {
      document.getElementById('state-' + s).classList.toggle('hidden', s !== name)
    })
  }

  // ── Supabase 클라이언트 생성 ────────────────────────────
  const { createClient } = supabase
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession:   true,
      detectSessionInUrl: true,
      flowType: 'implicit'
    }
  })

  // ── URL에서 토큰/타입 추출 ──────────────────────────────
  // Supabase 비밀번호 재설정 링크:
  //   /reset-password#access_token=...&refresh_token=...&type=recovery
  // 또는 PKCE flow:
  //   /reset-password?code=...&type=recovery (신형)
  const hashParams  = new URLSearchParams(location.hash.substring(1))
  const urlParams   = new URLSearchParams(location.search)

  const hashToken   = hashParams.get('access_token')
  const hashRefresh = hashParams.get('refresh_token') || ''
  const hashType    = hashParams.get('type')           // "recovery"
  const codeParam   = urlParams.get('code')
  const errorParam  = urlParams.get('error')
  const errorDesc   = urlParams.get('error_description')

  console.log('[Reset] hash type:', hashType, '| hashToken:', !!hashToken, '| code:', !!codeParam)

  // ── 에러 파라미터 처리 ──────────────────────────────────
  if (errorParam) {
    document.getElementById('error-detail').textContent =
      errorDesc || errorParam
    showState('error')
    return
  }

  // ── CASE 1: Hash fragment (implicit flow) recovery 토큰 ─
  if (hashToken && hashType === 'recovery') {
    try {
      const { data, error } = await client.auth.setSession({
        access_token:  hashToken,
        refresh_token: hashRefresh
      })
      if (error) throw error
      console.log('[Reset] 세션 설정 완료 →', data.session?.user?.email)
      showState('form')
    } catch(e) {
      document.getElementById('error-detail').textContent = e.message
      showState('error')
    }
    return
  }

  // ── CASE 2: PKCE code (신형 Supabase 기본값) ───────────
  if (codeParam) {
    try {
      const { data, error } = await client.auth.exchangeCodeForSession(codeParam)
      if (error) throw error
      console.log('[Reset] PKCE 교환 완료 →', data.session?.user?.email)
      showState('form')
    } catch(e) {
      document.getElementById('error-detail').textContent = e.message
      showState('error')
    }
    return
  }

  // ── 아무 토큰도 없으면 에러 ─────────────────────────────
  document.getElementById('error-detail').textContent =
    '재설정 링크가 유효하지 않습니다. 이메일에서 링크를 다시 클릭해주세요.'
  showState('error')

})()

// ── 비밀번호 보이기/숨기기 ──────────────────────────────
function togglePw(inputId, eyeId) {
  const input = document.getElementById(inputId)
  const eye   = document.getElementById(eyeId)
  if (input.type === 'password') {
    input.type    = 'text'
    eye.className = 'fas fa-eye-slash text-sm'
  } else {
    input.type    = 'password'
    eye.className = 'fas fa-eye text-sm'
  }
}

// ── 비밀번호 강도 체크 ───────────────────────────────────
document.getElementById('new-password').addEventListener('input', function() {
  const val   = this.value
  const bar   = document.getElementById('strength-bar')
  const label = document.getElementById('strength-label')
  let score = 0
  if (val.length >= 8)  score++
  if (val.length >= 12) score++
  if (/[A-Z]/.test(val))   score++
  if (/[0-9]/.test(val))   score++
  if (/[^a-zA-Z0-9]/.test(val)) score++

  const levels = [
    { pct: '0%',   color: '',            text: '' },
    { pct: '25%',  color: 'bg-red-400',  text: '매우 약함' },
    { pct: '50%',  color: 'bg-orange-400', text: '약함' },
    { pct: '75%',  color: 'bg-yellow-400', text: '보통' },
    { pct: '90%',  color: 'bg-green-400',  text: '강함' },
    { pct: '100%', color: 'bg-green-600',  text: '매우 강함 ✓' },
  ]
  const lv = levels[Math.min(score, 5)]
  bar.style.width = lv.pct
  bar.className   = 'h-full rounded-full transition-all duration-300 ' + lv.color
  label.textContent = lv.text
})

// ── 비밀번호 일치 확인 ───────────────────────────────────
document.getElementById('confirm-password').addEventListener('input', function() {
  const pw  = document.getElementById('new-password').value
  const err = document.getElementById('match-error')
  if (this.value && pw !== this.value) {
    err.classList.remove('hidden')
  } else {
    err.classList.add('hidden')
  }
})

// ── 폼 제출: 비밀번호 업데이트 ──────────────────────────
document.getElementById('reset-form').addEventListener('submit', async (e) => {
  e.preventDefault()

  const pw1 = document.getElementById('new-password').value
  const pw2 = document.getElementById('confirm-password').value
  const btn = document.getElementById('submit-btn')
  const errDiv  = document.getElementById('form-error')
  const errText = document.getElementById('form-error-text')

  function showErr(msg) {
    errDiv.classList.remove('hidden')
    errText.textContent = msg
  }

  // 유효성 검사
  if (pw1.length < 8) {
    showErr('비밀번호는 8자 이상이어야 합니다.')
    return
  }
  if (pw1 !== pw2) {
    showErr('비밀번호가 일치하지 않습니다.')
    return
  }

  btn.disabled  = true
  btn.innerHTML = '<i class="fas fa-spinner fa-spin mr-2"></i>변경 중...'
  errDiv.classList.add('hidden')

  const { createClient } = supabase
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: true, detectSessionInUrl: false, flowType: 'implicit' }
  })

  const { error } = await client.auth.updateUser({ password: pw1 })

  if (error) {
    console.error('[Reset] updateUser 오류:', error.message)
    showErr(
      error.message.includes('session') || error.message.includes('token')
        ? '세션이 만료되었습니다. 재설정 이메일을 다시 요청해주세요.'
        : '비밀번호 변경 실패: ' + error.message
    )
    btn.disabled  = false
    btn.innerHTML = '<i class="fas fa-check mr-2"></i>비밀번호 변경하기'
    return
  }

  // 성공 → 쿠키 세션 삭제 후 로그인 페이지로
  await fetch('/auth/logout', { method: 'POST' })

  document.getElementById('state-form').classList.add('hidden')
  document.getElementById('state-success').classList.remove('hidden')

  setTimeout(() => {
    window.location.href = '/login?message=비밀번호가 변경되었습니다. 새 비밀번호로 로그인해주세요.'
  }, 2500)
})
` }} />

    </div>,
    { title: '비밀번호 재설정 | BizReady' }
  )
})

export default resetPassword
