import { Hono } from 'hono'
import { renderer } from '../renderer'
import { parseSessionCookie } from '../lib/session'
import { getSupabaseClientWithToken } from '../lib/supabase'
import { Sidebar } from '../lib/sidebar'
import type { Env } from '../lib/supabase'

const dashboard = new Hono<{ Bindings: Env }>()
dashboard.use(renderer)

// 카테고리 데이터 (추후 DB로 확장)
const categories = [
  {
    id: 'accounting',
    icon: 'fa-calculator',
    color: 'bg-blue-100 text-blue-600',
    title: '회계·세무',
    desc: '전표처리, 세금계산서, 부가세 신고',
    count: 24,
  },
  {
    id: 'hr',
    icon: 'fa-users',
    color: 'bg-purple-100 text-purple-600',
    title: '인사·노무',
    desc: '4대보험, 급여계산, 근로계약서',
    count: 18,
  },
  {
    id: 'admin',
    icon: 'fa-building',
    color: 'bg-green-100 text-green-600',
    title: '총무·행정',
    desc: '비품관리, 계약서, 공문서 작성',
    count: 15,
  },
  {
    id: 'tax',
    icon: 'fa-file-invoice-dollar',
    color: 'bg-orange-100 text-orange-600',
    title: '세금·신고',
    desc: '원천세, 법인세, 연말정산',
    count: 12,
  },
  {
    id: 'payroll',
    icon: 'fa-money-bill-wave',
    color: 'bg-teal-100 text-teal-600',
    title: '급여관리',
    desc: '급여대장, 퇴직금, 수당 계산',
    count: 10,
  },
  {
    id: 'checklist',
    icon: 'fa-clipboard-check',
    color: 'bg-red-100 text-red-600',
    title: '입사 체크리스트',
    desc: '첫 달 필수 처리 업무 목록',
    count: 8,
  },
]

const recentGuides = [
  { category: '회계·세무', title: '세금계산서 발행 A to Z', badge: 'HOT', badgeColor: 'bg-red-100 text-red-600' },
  { category: '인사·노무', title: '신규 직원 4대보험 가입 처리', badge: 'NEW', badgeColor: 'bg-blue-100 text-blue-600' },
  { category: '총무·행정', title: '법인카드 사용 및 정산 방법', badge: '', badgeColor: '' },
  { category: '세금·신고', title: '부가세 신고 기간과 준비 서류', badge: 'NEW', badgeColor: 'bg-blue-100 text-blue-600' },
  { category: '급여관리', title: '퇴직금 계산 방법과 지급 기준', badge: '', badgeColor: '' },
]

dashboard.get('/', async (c) => {
  // 세션 검증
  const cookie = c.req.header('Cookie') ?? ''
  const sessionStr = parseSessionCookie(cookie)

  if (!sessionStr) {
    return c.redirect('/login?error=unauthorized')
  }

  let userEmail = '사용자'
  let userName = ''
  let isPaid = false

  try {
    const sessionObj = JSON.parse(decodeURIComponent(sessionStr))
    const supabase = getSupabaseClientWithToken(c.env, sessionObj.access_token)
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) {
      return c.redirect('/login?error=session_expired')
    }

    userEmail = user.email ?? '사용자'
    userName = (user.user_metadata?.full_name as string) || userEmail.split('@')[0]

    const { data: profile } = await supabase
      .from('user_profiles').select('is_paid').eq('id', user.id).single()
    isPaid = profile?.is_paid ?? false
  } catch {
    return c.redirect('/login?error=session_expired')
  }

  const initial = userName.charAt(0).toUpperCase()
  const upgraded = c.req.query('upgraded') === '1'

  return c.render(
    <div class="flex h-screen overflow-hidden">
      {/* ── 공통 사이드바 ── */}
      <Sidebar
        userName={userName}
        userInitial={initial}
        isPaid={isPaid}
        currentPath="/dashboard"
      />

      {/* ── 메인 콘텐츠 ── */}
      <main class="flex-1 overflow-y-auto bg-gray-50">
        {/* 상단 헤더 */}
        <header class="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h1 class="text-xl font-bold text-gray-800">
              안녕하세요, {userName}님 👋
            </h1>
            <p class="text-gray-500 text-sm">오늘도 성장하는 경영지원 전문가가 되어봐요</p>
          </div>
          <div class="flex items-center gap-3">
            {/* 검색바 */}
            <div class="relative hidden md:block">
              <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
              <input
                type="text"
                placeholder="업무 키워드 검색..."
                class="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-500"
                onkeydown="if(event.key==='Enter') window.location.href='/dashboard/search?q='+encodeURIComponent(this.value)"
              />
            </div>
            <div class="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold">
              {initial}
            </div>
          </div>
        </header>

        <div class="px-8 py-6 max-w-6xl">
          {/* 업그레이드 완료 토스트 */}
          {upgraded && (
            <div class="mb-4 p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
              <span class="text-2xl">🎉</span>
              <div>
                <div class="font-bold text-green-800">프리미엄 구독 활성화 완료!</div>
                <div class="text-green-600 text-sm">이제 모든 가이드를 자유롭게 열람하실 수 있습니다.</div>
              </div>
            </div>
          )}

          {/* 배너 */}
          <div class="gradient-bg rounded-2xl p-6 mb-6 text-white relative overflow-hidden">
            <div class="absolute right-0 top-0 w-48 h-full opacity-10">
              <i class="fas fa-chart-line text-9xl absolute -right-4 -top-4"></i>
            </div>
            <h2 class="text-lg font-bold mb-1">🎉 경영지원 올인원 아카이브에 오신 것을 환영합니다!</h2>
            <p class="text-sky-200 text-sm mb-4">
              중소기업(SME)을 위한 통합 경영지원 가이드를 지금 바로 확인하세요.
            </p>
            <div class="flex gap-3">
              <a
                href="/dashboard/archive"
                class="bg-white text-blue-700 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-sky-50 transition-colors"
              >
                업무 가이드 보기
              </a>
              <a
                href="/dashboard/checklist"
                class="bg-white/20 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-white/30 transition-colors"
              >
                입사 체크리스트
              </a>
            </div>
          </div>

          {/* 통계 카드 */}
          <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {[
              { icon: 'fa-book', color: 'text-blue-600 bg-blue-50', label: '총 가이드', value: '87개' },
              { icon: 'fa-check-square', color: 'text-green-600 bg-green-50', label: '완료 체크', value: '0 / 20' },
              { icon: 'fa-sticky-note', color: 'text-purple-600 bg-purple-50', label: '내 메모', value: '0개' },
              { icon: 'fa-clock', color: 'text-orange-600 bg-orange-50', label: '최근 업데이트', value: '오늘' },
            ].map((stat) => (
              <div class="bg-white rounded-xl p-4 border border-gray-100 card-hover">
                <div class={`w-10 h-10 ${stat.color} rounded-lg flex items-center justify-center mb-3`}>
                  <i class={`fas ${stat.icon}`}></i>
                </div>
                <div class="text-2xl font-bold text-gray-800">{stat.value}</div>
                <div class="text-gray-500 text-sm">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* 업무 카테고리 */}
          <div class="mb-6">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-lg font-bold text-gray-800">업무 카테고리</h2>
              <a href="/dashboard/archive" class="text-blue-600 text-sm hover:underline">전체 보기 →</a>
            </div>
            <div class="grid grid-cols-2 md:grid-cols-3 gap-4">
              {categories.map((cat) => (
                <a
                  href={`/dashboard/archive?category=${cat.id}`}
                  class="bg-white rounded-xl p-4 border border-gray-100 card-hover block"
                >
                  <div class="flex items-center gap-3 mb-2">
                    <div class={`w-9 h-9 ${cat.color} rounded-lg flex items-center justify-center`}>
                      <i class={`fas ${cat.icon} text-sm`}></i>
                    </div>
                    <span class="font-semibold text-gray-800 text-sm">{cat.title}</span>
                  </div>
                  <p class="text-gray-500 text-xs mb-2">{cat.desc}</p>
                  <span class="text-xs text-blue-600 font-medium">{cat.count}개 가이드</span>
                </a>
              ))}
            </div>
          </div>

          {/* 최근 가이드 */}
          <div>
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-lg font-bold text-gray-800">최근 업데이트 가이드</h2>
              <a href="/dashboard/archive" class="text-blue-600 text-sm hover:underline">전체 보기 →</a>
            </div>
            <div class="bg-white rounded-xl border border-gray-100 overflow-hidden">
              {recentGuides.map((guide, i) => (
                <div
                  class={`flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 cursor-pointer ${i < recentGuides.length - 1 ? 'border-b border-gray-100' : ''}`}
                  onclick={`window.location.href='/dashboard/archive'`}
                >
                  <div class="flex-1">
                    <div class="flex items-center gap-2 mb-0.5">
                      <span class="text-xs text-gray-400 font-medium">{guide.category}</span>
                      {guide.badge && (
                        <span class={`text-xs font-bold px-1.5 py-0.5 rounded ${guide.badgeColor}`}>
                          {guide.badge}
                        </span>
                      )}
                    </div>
                    <div class="text-sm text-gray-800 font-medium">{guide.title}</div>
                  </div>
                  <i class="fas fa-chevron-right text-gray-300 text-sm"></i>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      <style>{`
        .gradient-bg { background: linear-gradient(135deg, #1e3a5f 0%, #0f2544 100%); }
        .card-hover { transition: all 0.15s; }
        .card-hover:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08); transform: translateY(-1px); }
      `}</style>
    </div>,
    { title: '대시보드 | BizReady' }
  )
})

export default dashboard
