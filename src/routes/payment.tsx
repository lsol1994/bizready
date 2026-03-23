import { Hono } from 'hono'
import { renderer } from '../renderer'
import { parseSessionCookie } from '../lib/session'
import { getSupabaseClientWithToken } from '../lib/supabase'
import type { Env } from '../lib/supabase'

const payment = new Hono<{ Bindings: Env }>()
payment.use(renderer)

// 구독 플랜 정의
const PLANS = [
  {
    id: 'monthly',
    name: '월간 구독',
    price: 9900,
    priceLabel: '9,900원',
    period: '/ 월',
    desc: '매월 자동 갱신',
    features: ['모든 업무 가이드 열람', '키워드 검색 무제한', '개인 메모·북마크', '월 1회 콘텐츠 업데이트'],
    badge: '',
    highlight: false,
  },
  {
    id: 'yearly',
    name: '연간 구독',
    price: 79000,
    priceLabel: '79,000원',
    period: '/ 년',
    desc: '월 6,583원 (33% 절약)',
    features: ['모든 업무 가이드 열람', '키워드 검색 무제한', '개인 메모·북마크', '월 1회 콘텐츠 업데이트', '우선 고객 지원', '신규 가이드 즉시 알림'],
    badge: '인기',
    highlight: true,
  },
]

// ── 결제 페이지 ────────────────────────────────
payment.get('/', async (c) => {
  const cookie = c.req.header('Cookie') ?? ''
  const sessionStr = parseSessionCookie(cookie)
  if (!sessionStr) return c.redirect('/login?error=unauthorized')

  let userName = '사용자'
  let userInitial = 'U'
  let userEmail = ''
  let userId = ''
  let isPaid = false

  try {
    const sessionObj = JSON.parse(decodeURIComponent(sessionStr))
    const supabase = getSupabaseClientWithToken(c.env, sessionObj.access_token)
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return c.redirect('/login?error=session_expired')

    userName = (user.user_metadata?.full_name as string) || user.email?.split('@')[0] || '사용자'
    userInitial = userName.charAt(0).toUpperCase()
    userEmail = user.email ?? ''
    userId = user.id

    const { data: profile } = await supabase
      .from('user_profiles').select('is_paid, plan_type, paid_at').eq('id', user.id).single()
    isPaid = profile?.is_paid ?? false
  } catch {
    return c.redirect('/login?error=session_expired')
  }

  return c.render(
    <div class="flex h-screen overflow-hidden">
      {/* 사이드바 */}
      <aside class="w-64 gradient-bg flex flex-col flex-shrink-0">
        <div class="px-6 py-5 border-b border-white/10">
          <a href="/dashboard" class="flex items-center gap-3">
            <div class="w-9 h-9 bg-white/20 rounded-xl flex items-center justify-center">
              <i class="fas fa-briefcase text-white text-sm"></i>
            </div>
            <div>
              <div class="text-white font-bold text-base">BizReady</div>
              <div class="text-sky-200 text-xs">경영지원 아카이브</div>
            </div>
          </a>
        </div>
        <div class="px-4 py-4 border-b border-white/10">
          <div class="flex items-center gap-3 bg-white/10 rounded-xl px-3 py-2.5">
            <div class="w-8 h-8 bg-sky-400 rounded-full flex items-center justify-center text-white text-sm font-bold">{userInitial}</div>
            <div class="flex-1 min-w-0">
              <div class="text-white text-sm font-medium truncate">{userName}</div>
              <div class="text-sky-300 text-xs">{isPaid ? '💎 프리미엄' : '무료 플랜'}</div>
            </div>
          </div>
        </div>
        <nav class="flex-1 px-3 py-4 space-y-1">
          <a href="/dashboard"           class="sidebar-item flex items-center gap-3 px-3 py-2.5 rounded-lg text-sky-200 hover:text-white text-sm"><i class="fas fa-home w-4 text-center"></i><span>홈</span></a>
          <a href="/dashboard/archive"   class="sidebar-item flex items-center gap-3 px-3 py-2.5 rounded-lg text-sky-200 hover:text-white text-sm"><i class="fas fa-book-open w-4 text-center"></i><span>업무 아카이브</span></a>
          <a href="/dashboard/search"    class="sidebar-item flex items-center gap-3 px-3 py-2.5 rounded-lg text-sky-200 hover:text-white text-sm"><i class="fas fa-search w-4 text-center"></i><span>지식 검색</span></a>
          <a href="/dashboard/checklist" class="sidebar-item flex items-center gap-3 px-3 py-2.5 rounded-lg text-sky-200 hover:text-white text-sm"><i class="fas fa-clipboard-check w-4 text-center"></i><span>체크리스트</span></a>
        </nav>
        <div class="px-3 pb-4">
          <form action="/auth/logout" method="POST">
            <button type="submit" class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sky-200 hover:text-white hover:bg-white/10 text-sm transition-colors">
              <i class="fas fa-sign-out-alt w-4 text-center"></i><span>로그아웃</span>
            </button>
          </form>
        </div>
      </aside>

      {/* 메인 */}
      <main class="flex-1 overflow-y-auto bg-gray-50">
        <header class="bg-white border-b border-gray-200 px-8 py-4 sticky top-0 z-10">
          <h1 class="text-xl font-bold text-gray-800">프리미엄 구독</h1>
          <p class="text-gray-500 text-sm">5년차 실무 노하우 전체를 이용하세요</p>
        </header>

        <div class="px-8 py-8 max-w-4xl">

          {/* 이미 구독 중인 경우 */}
          {isPaid ? (
            <div class="bg-green-50 border border-green-200 rounded-2xl p-8 text-center">
              <div class="text-5xl mb-4">💎</div>
              <h2 class="text-2xl font-bold text-green-800 mb-2">프리미엄 구독 중</h2>
              <p class="text-green-600 mb-6">모든 콘텐츠를 자유롭게 이용하실 수 있습니다.</p>
              <a href="/dashboard/archive" class="bg-green-600 text-white px-6 py-3 rounded-xl font-medium hover:bg-green-700 transition-colors inline-block">
                아카이브 보러가기 →
              </a>
            </div>
          ) : (
            <div>
              {/* 헤더 배너 */}
              <div class="gradient-bg rounded-2xl p-6 text-white text-center mb-8">
                <div class="text-3xl mb-2">🚀</div>
                <h2 class="text-xl font-bold mb-1">지금 업그레이드하고 모든 가이드를 확인하세요</h2>
                <p class="text-sky-200 text-sm">세무·노무·급여 심화 가이드 + 판례 기반 실무 Q&A 포함</p>
              </div>

              {/* 플랜 카드 */}
              <div class="grid md:grid-cols-2 gap-5 mb-8">
                {PLANS.map((plan) => (
                  <div class={`bg-white rounded-2xl border-2 p-6 relative ${plan.highlight ? 'border-blue-500 shadow-lg shadow-blue-100' : 'border-gray-100'}`}>
                    {plan.badge && (
                      <div class="absolute -top-3 left-1/2 -translate-x-1/2 bg-blue-600 text-white text-xs font-bold px-4 py-1 rounded-full">
                        {plan.badge} 🔥
                      </div>
                    )}
                    <div class="mb-4">
                      <h3 class="font-bold text-gray-800 text-lg">{plan.name}</h3>
                      <div class="flex items-end gap-1 mt-2">
                        <span class="text-3xl font-bold text-gray-900">{plan.priceLabel}</span>
                        <span class="text-gray-400 text-sm mb-1">{plan.period}</span>
                      </div>
                      <p class="text-sm text-blue-600 font-medium mt-1">{plan.desc}</p>
                    </div>
                    <ul class="space-y-2 mb-6">
                      {plan.features.map((f) => (
                        <li class="flex items-center gap-2 text-sm text-gray-600">
                          <i class="fas fa-check-circle text-green-500 flex-shrink-0"></i>
                          {f}
                        </li>
                      ))}
                    </ul>
                    {/* 결제 수단 선택 버튼 */}
                    <div class="space-y-2">
                      <button
                        onclick={`requestPayment('kakaopay', '${plan.id}', ${plan.price}, '${plan.name}')`}
                        class={`w-full py-3 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 ${plan.highlight ? 'bg-yellow-400 hover:bg-yellow-500 text-yellow-900' : 'bg-yellow-50 hover:bg-yellow-100 text-yellow-800 border border-yellow-200'}`}
                      >
                        <img src="https://developers.kakao.com/tool/resource/static/img/button/kakaoIcon/kakao_icon_round_small.png"
                             class="w-5 h-5" alt="카카오" />
                        카카오페이로 결제
                      </button>
                      <button
                        onclick={`requestPayment('tosspay', '${plan.id}', ${plan.price}, '${plan.name}')`}
                        class={`w-full py-3 rounded-xl font-semibold text-sm transition-colors flex items-center justify-center gap-2 ${plan.highlight ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200'}`}
                      >
                        <i class="fas fa-credit-card"></i>
                        토스페이먼츠로 결제
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* 안내 사항 */}
              <div class="bg-gray-50 rounded-xl border border-gray-100 p-5 text-sm text-gray-500 space-y-1">
                <p><i class="fas fa-shield-alt text-blue-400 mr-2"></i>결제 정보는 포트원(PG사)이 안전하게 처리하며 당사 서버에 저장되지 않습니다.</p>
                <p><i class="fas fa-undo text-blue-400 mr-2"></i>결제 후 7일 이내 미사용 시 전액 환불 가능합니다.</p>
                <p><i class="fas fa-lock text-blue-400 mr-2"></i>테스트 모드에서는 실제 결제가 발생하지 않습니다.</p>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* 결제 처리 로딩 오버레이 */}
      <div id="payment-overlay" class="hidden fixed inset-0 bg-black/50 flex items-center justify-center z-50">
        <div class="bg-white rounded-2xl p-8 text-center max-w-sm w-full mx-4">
          <div class="text-4xl mb-4" id="overlay-icon">⏳</div>
          <h3 class="font-bold text-gray-800 text-lg mb-2" id="overlay-title">결제 처리 중...</h3>
          <p class="text-gray-500 text-sm" id="overlay-desc">잠시만 기다려주세요</p>
        </div>
      </div>

      {/* 포트원 V2 SDK */}
      <script src="https://cdn.portone.io/v2/browser-sdk.js"></script>

      <script dangerouslySetInnerHTML={{ __html: `
const USER_ID   = '${userId}'
const USER_EMAIL = '${userEmail}'
const USER_NAME  = '${userName}'
const STORE_ID   = '${c.env.PORTONE_STORE_ID}'
const CHANNEL_KEY_KAKAO = '${c.env.PORTONE_CHANNEL_KEY_KAKAO}'
const CHANNEL_KEY_TOSS  = '${c.env.PORTONE_CHANNEL_KEY_TOSS}'

async function requestPayment(method, planId, amount, planName) {
  const overlay = document.getElementById('payment-overlay')
  const overlayTitle = document.getElementById('overlay-title')
  const overlayDesc  = document.getElementById('overlay-desc')
  const overlayIcon  = document.getElementById('overlay-icon')

  overlay.classList.remove('hidden')
  overlayTitle.textContent = '결제창 열는 중...'
  overlayDesc.textContent  = '잠시만 기다려주세요'
  overlayIcon.textContent  = '⏳'

  const paymentId = 'bizready-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8)
  const channelKey = method === 'kakaopay' ? CHANNEL_KEY_KAKAO : CHANNEL_KEY_TOSS

  try {
    const response = await PortOne.requestPayment({
      storeId: STORE_ID,
      channelKey: channelKey,
      paymentId: paymentId,
      orderName: 'BizReady ' + planName,
      totalAmount: amount,
      currency: 'KRW',
      payMethod: method === 'kakaopay' ? 'EASY_PAY' : 'EASY_PAY',
      easyPay: {
        easyPayProvider: method === 'kakaopay' ? 'KAKAOPAY' : 'TOSSPAY',
      },
      customer: {
        customerId: USER_ID,
        fullName: USER_NAME,
        email: USER_EMAIL,
      },
      customData: {
        userId: USER_ID,
        planId: planId,
      },
    })

    if (response.code !== undefined) {
      // 결제 실패 or 취소
      overlay.classList.add('hidden')
      if (response.code !== 'USER_CANCEL') {
        alert('결제 실패: ' + (response.message || '알 수 없는 오류'))
      }
      return
    }

    // 결제 성공 → 서버에서 검증 + DB 업데이트
    overlayTitle.textContent = '결제 확인 중...'
    overlayDesc.textContent  = '결제를 검증하고 있습니다'
    overlayIcon.textContent  = '🔍'

    const verifyRes = await fetch('/api/payment/complete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentId: paymentId,
        planId: planId,
        userId: USER_ID,
      }),
    })

    const result = await verifyRes.json()

    if (result.ok) {
      overlayIcon.textContent  = '🎉'
      overlayTitle.textContent = '결제 완료!'
      overlayDesc.textContent  = '프리미엄 구독이 활성화되었습니다'
      setTimeout(() => {
        window.location.href = '/dashboard?upgraded=1'
      }, 2000)
    } else {
      overlay.classList.add('hidden')
      alert('결제 검증 실패: ' + (result.error || '관리자에게 문의하세요'))
    }
  } catch (err) {
    overlay.classList.add('hidden')
    alert('결제 오류: ' + err.message)
  }
}
      ` }} />
    </div>,
    { title: '프리미엄 구독 | BizReady' }
  )
})

export default payment
