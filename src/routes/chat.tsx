// ============================================================
// GET /dashboard/chat  — AI 챗봇 페이지
// ============================================================
import { Hono } from 'hono'
import { renderer } from '../renderer'
import { parseSessionCookie } from '../lib/session'
import { getSupabaseClientWithToken } from '../lib/supabase'
import { Sidebar, MobileMenuButton } from '../lib/sidebar'
import type { Env } from '../lib/supabase'

const chatRoute = new Hono<{ Bindings: Env }>()
chatRoute.use(renderer)

chatRoute.get('/', async (c) => {
  const cookie = c.req.header('Cookie') ?? ''
  const sessionStr = parseSessionCookie(cookie)
  if (!sessionStr) return c.redirect('/login?error=unauthorized')

  let userName = '사용자'
  let userInitial = 'U'
  let isPaid = false

  try {
    const sessionObj = JSON.parse(decodeURIComponent(sessionStr))
    const supabase = getSupabaseClientWithToken(c.env, sessionObj.access_token)

    const { data: { user }, error: userErr } = await supabase.auth.getUser()
    if (userErr || !user) return c.redirect('/login?error=session_expired')

    userName = (user.user_metadata?.full_name as string) || user.email?.split('@')[0] || '사용자'
    userInitial = userName.charAt(0).toUpperCase()

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('is_paid')
      .eq('id', user.id)
      .single()

    isPaid = profile?.is_paid ?? false
  } catch {
    return c.redirect('/login?error=session_expired')
  }

  return c.render(
    <div class="flex h-screen overflow-hidden">
      <Sidebar
        userName={userName}
        userInitial={userInitial}
        isPaid={isPaid}
        currentPath="/dashboard/chat"
      />

      {/* ── 메인 콘텐츠 ── */}
      <div class="flex-1 flex flex-col overflow-hidden">
        {/* 모바일 헤더 */}
        <div class="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 flex-shrink-0">
          <MobileMenuButton userName={userName} userInitial={userInitial} title="AI 챗봇" />
        </div>

        {/* 페이지 본문 */}
        <div class="flex-1 overflow-y-auto bg-gray-50 flex flex-col">

          {isPaid ? (
            /* ── 프리미엄 유저: 챗봇 UI ── */
            <div class="flex flex-col h-full max-w-3xl w-full mx-auto px-4 py-4">

              {/* 헤더 */}
              <div class="flex items-center gap-3 mb-4 flex-shrink-0">
                <div class="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow">
                  <i class="fas fa-robot text-white text-sm"></i>
                </div>
                <div>
                  <h1 class="text-lg font-bold text-gray-800">AI 챗봇</h1>
                  <p class="text-xs text-gray-500">세무회계 · 인사노무 · 총무 실무 전문가</p>
                </div>
                <button
                  id="clear-btn"
                  class="ml-auto flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-500 hover:text-red-500 border border-gray-200 hover:border-red-200 rounded-lg transition-colors"
                >
                  <i class="fas fa-trash-alt text-xs"></i>
                  <span>대화 초기화</span>
                </button>
              </div>

              {/* 메시지 영역 */}
              <div
                id="chat-messages"
                class="flex-1 overflow-y-auto space-y-4 pb-4 min-h-0"
              >
                {/* 환영 메시지 */}
                <div class="flex gap-3" id="welcome-msg">
                  <div class="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5">
                    <i class="fas fa-robot text-white text-xs"></i>
                  </div>
                  <div class="bg-white rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border border-gray-100 max-w-[85%]">
                    <p class="text-sm text-gray-700 leading-relaxed">
                      안녕하세요! 저는 <strong>BizReady AI</strong>입니다. 세무회계, 인사노무, 총무행정 실무에 관한 궁금한 점을 편하게 질문해주세요.
                    </p>
                    <div class="mt-3 flex flex-wrap gap-2">
                      {['부가세 신고 절차', '연차 계산 방법', '4대보험 요율'].map(q => (
                        <button
                          class="quick-q text-xs px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-full transition-colors border border-blue-100"
                        >
                          {q}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* 입력 영역 */}
              <div class="flex-shrink-0 bg-white border border-gray-200 rounded-2xl shadow-sm p-3 flex gap-2 items-end">
                <textarea
                  id="chat-input"
                  rows={1}
                  placeholder="세무, 노무, 총무 관련 질문을 입력하세요..."
                  class="flex-1 resize-none text-sm text-gray-700 placeholder-gray-400 outline-none bg-transparent leading-relaxed max-h-32 overflow-y-auto"
                  style="min-height: 24px;"
                ></textarea>
                <button
                  id="send-btn"
                  class="w-9 h-9 rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-gray-200 flex items-center justify-center transition-colors flex-shrink-0"
                  disabled
                >
                  <i class="fas fa-paper-plane text-white text-xs"></i>
                </button>
              </div>
              <p class="text-center text-xs text-gray-400 mt-2">AI 답변은 참고용입니다. 중요한 사항은 전문가에게 확인하세요.</p>
            </div>

          ) : (

            /* ── 무료 유저: 업그레이드 안내 ── */
            <div class="flex-1 flex items-center justify-center p-6">
              <div class="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-md w-full text-center">
                <div class="w-16 h-16 bg-gradient-to-br from-amber-400 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-5 shadow-md">
                  <i class="fas fa-robot text-white text-2xl"></i>
                </div>
                <h2 class="text-xl font-bold text-gray-800 mb-2">AI 챗봇은 프리미엄 전용 기능입니다</h2>
                <p class="text-sm text-gray-500 mb-6 leading-relaxed">
                  세무회계, 인사노무, 총무행정 실무 전문가 AI와 무제한 대화하세요.<br />
                  프리미엄 플랜으로 업그레이드하면 즉시 이용 가능합니다.
                </p>
                <div class="space-y-2.5 mb-6 text-left">
                  {[
                    { icon: 'fa-comments', text: 'AI와 실무 질문 무제한 대화' },
                    { icon: 'fa-file-invoice', text: '세무·노무·총무 전 영역 커버' },
                    { icon: 'fa-bolt', text: 'Gemini 2.5 Flash 기반 빠른 응답' },
                  ].map(item => (
                    <div class="flex items-center gap-3 bg-amber-50 rounded-xl px-4 py-2.5">
                      <i class={`fas ${item.icon} text-amber-500 text-sm w-4 text-center`}></i>
                      <span class="text-sm text-gray-700">{item.text}</span>
                    </div>
                  ))}
                </div>
                <a
                  href="/dashboard/payment"
                  class="block w-full py-3 bg-gradient-to-r from-amber-400 to-orange-500 hover:from-amber-500 hover:to-orange-600 text-white font-semibold rounded-xl shadow transition-all text-sm"
                >
                  <i class="fas fa-crown mr-2"></i>프리미엄으로 업그레이드
                </a>
              </div>
            </div>

          )}
        </div>
      </div>

      {/* ── 챗봇 인라인 스크립트 (프리미엄 유저 전용) ── */}
      {isPaid && (
        <script dangerouslySetInnerHTML={{ __html: `
(function () {
  // 메시지 히스토리 (세션 내 유지)
  const history = []

  const messagesEl = document.getElementById('chat-messages')
  const inputEl    = document.getElementById('chat-input')
  const sendBtn    = document.getElementById('send-btn')
  const clearBtn   = document.getElementById('clear-btn')

  // ── 자동 높이 조절 ──────────────────────────────────
  inputEl.addEventListener('input', function () {
    this.style.height = 'auto'
    this.style.height = Math.min(this.scrollHeight, 128) + 'px'
    sendBtn.disabled = this.value.trim() === ''
  })

  // ── Enter 전송 (Shift+Enter 줄바꿈) ─────────────────
  inputEl.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      if (!sendBtn.disabled) sendMessage()
    }
  })

  sendBtn.addEventListener('click', sendMessage)

  // ── 빠른 질문 버튼 ──────────────────────────────────
  document.querySelectorAll('.quick-q').forEach(function (btn) {
    btn.addEventListener('click', function () {
      inputEl.value = btn.textContent.trim()
      inputEl.dispatchEvent(new Event('input'))
      sendMessage()
    })
  })

  // ── 대화 초기화 ─────────────────────────────────────
  clearBtn.addEventListener('click', function () {
    history.length = 0
    const welcome = document.getElementById('welcome-msg')
    messagesEl.innerHTML = ''
    if (welcome) messagesEl.appendChild(welcome)
  })

  // ── 메시지 추가 헬퍼 ────────────────────────────────
  function appendMessage(role, text) {
    const isUser = role === 'user'
    const wrap = document.createElement('div')
    wrap.className = 'flex gap-3' + (isUser ? ' justify-end' : '')

    if (!isUser) {
      const avatar = document.createElement('div')
      avatar.className = 'w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center flex-shrink-0 shadow-sm mt-0.5'
      avatar.innerHTML = '<i class="fas fa-robot text-white text-xs"></i>'
      wrap.appendChild(avatar)
    }

    const bubble = document.createElement('div')
    bubble.className = isUser
      ? 'bg-blue-600 text-white rounded-2xl rounded-tr-sm px-4 py-3 shadow-sm max-w-[85%] text-sm leading-relaxed whitespace-pre-wrap'
      : 'bg-white text-gray-700 rounded-2xl rounded-tl-sm px-4 py-3 shadow-sm border border-gray-100 max-w-[85%] text-sm leading-relaxed whitespace-pre-wrap'
    bubble.textContent = text
    wrap.appendChild(bubble)

    messagesEl.appendChild(wrap)
    messagesEl.scrollTop = messagesEl.scrollHeight
    return bubble
  }

  // ── 전송 로직 ───────────────────────────────────────
  async function sendMessage() {
    const text = inputEl.value.trim()
    if (!text) return

    // 입력 초기화
    inputEl.value = ''
    inputEl.style.height = 'auto'
    sendBtn.disabled = true

    // 사용자 메시지 표시 & 히스토리 추가
    appendMessage('user', text)
    history.push({ role: 'user', content: text })

    // AI 응답 버블 (스트리밍)
    const aiBubble = appendMessage('assistant', '')
    const typingDots = document.createElement('span')
    typingDots.className = 'inline-block animate-pulse text-gray-400'
    typingDots.textContent = '답변 생성 중...'
    aiBubble.appendChild(typingDots)

    let fullText = ''

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        aiBubble.textContent = err.error === 'premium_required'
          ? '프리미엄 전용 기능입니다.'
          : '오류가 발생했습니다. 잠시 후 다시 시도해주세요.'
        return
      }

      // SSE 스트리밍 파싱
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      let firstChunk = true

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\\n')
        buf = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const raw = line.slice(6).trim()
          if (raw === '[DONE]') break

          try {
            const chunk = JSON.parse(raw)
            if (firstChunk) {
              aiBubble.textContent = ''
              firstChunk = false
            }
            fullText += chunk
            aiBubble.textContent = fullText
            messagesEl.scrollTop = messagesEl.scrollHeight
          } catch {}
        }
      }

      // 히스토리 추가
      if (fullText) {
        history.push({ role: 'assistant', content: fullText })
      }

    } catch (e) {
      aiBubble.textContent = '네트워크 오류가 발생했습니다. 다시 시도해주세요.'
    }
  }
})()
        `}} />
      )}
    </div>,
    { title: 'AI 챗봇 | BizReady' }
  )
})

export default chatRoute
