import { Hono } from 'hono'
import { renderer } from '../renderer'
import { parseSessionCookie } from '../lib/session'
import { getSupabaseClientWithToken, getSupabaseAdmin } from '../lib/supabase'
import { Sidebar, MobileMenuButton } from '../lib/sidebar'
import type { Env } from '../lib/supabase'

const dashboard = new Hono<{ Bindings: Env }>()
dashboard.use(renderer)

// 업무 카테고리 타입
// finance  → 재무/회계/세금/급여 → 빨강
// labor    → 노무/4대보험/고용 → 노랑
// general  → 총무/비품/이벤트/행정 → 파랑
type ScheduleCategory = 'finance' | 'labor' | 'general'

const CATEGORY_STYLE: Record<ScheduleCategory, {
  cardCls:    string
  borderColor: string
  accentColor: string
  badgeBg:    string
  badgeText:  string
  iconBg:     string
  iconText:   string
  iconCls:    string
  label:      string
}> = {
  finance: {
    cardCls:     'dday-card',
    borderColor: '#ef4444',
    accentColor: '#ef4444',
    badgeBg:     '#fee2e2',
    badgeText:   '#b91c1c',
    iconBg:      '#fee2e2',
    iconText:    '#ef4444',
    iconCls:     'fa-file-invoice-dollar',
    label:       '재무·세금',
  },
  labor: {
    cardCls:     'dday-card',
    borderColor: '#ca8a04',
    accentColor: '#ca8a04',
    badgeBg:     '#fef9c3',
    badgeText:   '#854d0e',
    iconBg:      '#fef9c3',
    iconText:    '#ca8a04',
    iconCls:     'fa-users',
    label:       '노무·4대보험',
  },
  general: {
    cardCls:     'dday-card',
    borderColor: '#3b82f6',
    accentColor: '#3b82f6',
    badgeBg:     '#dbeafe',
    badgeText:   '#1d4ed8',
    iconBg:      '#dbeafe',
    iconText:    '#3b82f6',
    iconCls:     'fa-building',
    label:       '총무·행정',
  },
}

// 캘린더 category → ScheduleCategory 매핑
// calendar_events.category: 'tax'|'labor'|'company'|'personal' → finance/labor/general
function mapCategory(cat: string): ScheduleCategory {
  if (cat === 'labor')                          return 'labor'
  if (cat === 'tax' || cat === 'finance')       return 'finance'
  return 'general'  // company, personal, general 등
}

// 카테고리 데이터
const categories = [
  { id: 'accounting', icon: 'fa-calculator',        color: 'bg-blue-100 text-blue-600',   title: '회계·세무',    desc: '전표처리, 세금계산서, 부가세 신고', count: 24 },
  { id: 'hr',         icon: 'fa-users',              color: 'bg-purple-100 text-purple-600',title: '인사·노무',    desc: '4대보험, 급여계산, 근로계약서',     count: 18 },
  { id: 'admin',      icon: 'fa-building',           color: 'bg-green-100 text-green-600', title: '총무·행정',    desc: '비품관리, 계약서, 공문서 작성',     count: 15 },
  { id: 'tax',        icon: 'fa-file-invoice-dollar',color: 'bg-orange-100 text-orange-600',title: '세금·신고',   desc: '원천세, 법인세, 연말정산',         count: 12 },
  { id: 'payroll',    icon: 'fa-money-bill-wave',    color: 'bg-teal-100 text-teal-600',   title: '급여관리',     desc: '급여대장, 퇴직금, 수당 계산',      count: 10 },
  { id: 'checklist',  icon: 'fa-clipboard-check',    color: 'bg-red-100 text-red-600',     title: '입사 체크리스트', desc: '첫 달 필수 처리 업무 목록',    count:  8 },
]

const recentGuides = [
  { category: '회계·세무', title: '세금계산서 발행 A to Z',         badge: 'HOT', badgeColor: 'bg-red-100 text-red-600'  },
  { category: '인사·노무', title: '신규 직원 4대보험 가입 처리',    badge: 'NEW', badgeColor: 'bg-blue-100 text-blue-600' },
  { category: '총무·행정', title: '법인카드 사용 및 정산 방법',     badge: '',    badgeColor: ''                           },
  { category: '세금·신고', title: '부가세 신고 기간과 준비 서류',   badge: 'NEW', badgeColor: 'bg-blue-100 text-blue-600' },
  { category: '급여관리',  title: '퇴직금 계산 방법과 지급 기준',  badge: '',    badgeColor: ''                           },
]

// D-day 계산 — 카테고리 스타일 포함
function calcDday(deadlineStr: string, category: ScheduleCategory) {
  const now      = new Date()
  const deadline = new Date(deadlineStr)
  const dday     = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
  const style    = CATEGORY_STYLE[category]
  return { dday, ...style }
}

dashboard.get('/', async (c) => {
  const cookie     = c.req.header('Cookie') ?? ''
  const sessionStr = parseSessionCookie(cookie)
  if (!sessionStr) return c.redirect('/login?error=unauthorized')

  let userEmail = '사용자'
  let userName  = ''
  let isPaid    = false

  try {
    const sessionObj = JSON.parse(decodeURIComponent(sessionStr))
    const supabase   = getSupabaseClientWithToken(c.env, sessionObj.access_token)
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return c.redirect('/login?error=session_expired')

    userEmail = user.email ?? '사용자'
    userName  = (user.user_metadata?.full_name as string) || userEmail.split('@')[0]

    const { data: profile } = await supabase
      .from('user_profiles').select('is_paid').eq('id', user.id).single()
    isPaid = profile?.is_paid ?? false
  } catch {
    return c.redirect('/login?error=session_expired')
  }

  const initial  = userName.charAt(0).toUpperCase()
  const upgraded = c.req.query('upgraded') === '1'

  // D-day 계산 — 캘린더 DB에서 조회
  let ddayItems: any[] = []
  try {
    const adminDb = getSupabaseAdmin(c.env)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    // 오늘 이후 90일 범위 일정 조회
    const futureLimit = new Date(today)
    futureLimit.setDate(futureLimit.getDate() + 90)
    const { data: events } = await adminDb
      .from('calendar_events')
      .select('id, title, start_date, category')
      .gte('start_date', today.toISOString().slice(0, 10))
      .lte('start_date', futureLimit.toISOString().slice(0, 10))
      .order('start_date', { ascending: true })

    if (events && events.length > 0) {
      ddayItems = events
        .map((e: any) => {
          const cat = mapCategory(e.category ?? 'general')
          return { title: e.title, deadline: e.start_date, category: cat, ...calcDday(e.start_date, cat) }
        })
        .filter((s: any) => s.dday >= 0)
        .sort((a: any, b: any) => a.dday - b.dday)
        .slice(0, 4)
    }
  } catch {
    ddayItems = []
  }

  // 공지 고유 ID — 공지 내용 바꿀 때 이 값만 바꾸면 전체 재표시
  const NOTICE_ID = 'notice_2026_q1_vat'

  return c.render(
    <div class="flex h-screen overflow-hidden">
      <Sidebar userName={userName} userInitial={initial} isPaid={isPaid} currentPath="/dashboard" />

      <main class="flex-1 overflow-y-auto bg-gray-50">
        {/* 헤더 */}
        <header class="bg-white border-b border-gray-200 px-4 md:px-8 py-4 flex items-center justify-between sticky top-0 z-10">
          <div class="flex items-center gap-2">
            <MobileMenuButton />
            <div>
              <h1 class="text-lg md:text-xl font-bold text-gray-800">안녕하세요, {userName}님 👋</h1>
              <p class="text-gray-500 text-xs md:text-sm hidden sm:block">오늘도 성장하는 경영지원 전문가가 되어봐요</p>
            </div>
          </div>
          <div class="flex items-center gap-3">
            <div class="relative hidden md:block">
              <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
              <input
                type="text"
                placeholder="업무 키워드 검색..."
                class="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm w-56 focus:outline-none focus:ring-2 focus:ring-blue-500"
                onkeydown="if(event.key==='Enter') window.location.href='/dashboard/search?q='+encodeURIComponent(this.value)"
              />
            </div>
            <div class="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center text-white text-sm font-bold">{initial}</div>
          </div>
        </header>

        <div class="px-4 md:px-8 py-5 max-w-6xl space-y-5">

          {/* 업그레이드 토스트 */}
          {upgraded && (
            <div class="p-4 bg-green-50 border border-green-200 rounded-xl flex items-center gap-3">
              <span class="text-2xl">🎉</span>
              <div>
                <div class="font-bold text-green-800">프리미엄 구독 활성화 완료!</div>
                <div class="text-green-600 text-sm">이제 모든 가이드를 자유롭게 열람하실 수 있습니다.</div>
              </div>
            </div>
          )}

          {/* ── 공지 배너 (최초 1회, localStorage로 관리) ── */}
          <div
            id="notice-banner"
            class="notice-bar rounded-xl px-4 md:px-5 py-3 flex items-center gap-3 border border-amber-200 shadow-sm"
          >
            <span class="text-xl flex-shrink-0">📢</span>
            <div class="flex-1 min-w-0">
              <span class="font-bold text-amber-800 text-sm">공지</span>
              <span class="text-amber-700 text-sm ml-2">
                2026년 1분기 부가세 확정신고 기간(4/1~4/25) 안내 — 미리 서류를 준비해 두세요!
              </span>
            </div>
            <span class="text-xs text-amber-500 whitespace-nowrap flex-shrink-0 hidden sm:block">2026.03.26</span>
            <button
              onclick={`dismissNotice('${NOTICE_ID}')`}
              class="flex-shrink-0 w-7 h-7 flex items-center justify-center rounded-full hover:bg-amber-200 text-amber-500 hover:text-amber-700 transition-colors"
              type="button"
              aria-label="공지 닫기"
            >
              <i class="fas fa-times text-sm"></i>
            </button>
          </div>

          {/* ── ① 히어로 배너 ── */}
          <div class="gradient-bg rounded-2xl p-5 md:p-6 text-white relative overflow-hidden">
            <div class="absolute right-0 top-0 w-48 h-full opacity-10 pointer-events-none">
              <i class="fas fa-chart-line text-9xl absolute -right-4 -top-4"></i>
            </div>
            <h2 class="text-base md:text-lg font-bold mb-1">🎉 경영지원 올인원 아카이브에 오신 것을 환영합니다!</h2>
            <p class="text-sky-200 text-xs md:text-sm mb-4">중소기업(SME)을 위한 통합 경영지원 가이드를 지금 바로 확인하세요.</p>
            <div class="flex gap-3 flex-wrap">
              <a href="/dashboard/archive" class="bg-white text-blue-700 text-sm font-semibold px-4 py-2 rounded-lg hover:bg-sky-50 transition-colors">
                업무 가이드 보기
              </a>
              <a href="/dashboard/checklist" class="bg-white/20 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-white/30 transition-colors">
                입사 체크리스트
              </a>
            </div>
          </div>

          {/* ── ② 통계 카드 ── */}
          <div class="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
            {[
              { icon: 'fa-book',         color: 'text-blue-600 bg-blue-50',   label: '총 가이드',     value: '87개' },
              { icon: 'fa-check-square', color: 'text-green-600 bg-green-50', label: '완료 체크',     value: '0 / 20' },
              { icon: 'fa-sticky-note',  color: 'text-purple-600 bg-purple-50',label: '내 메모',      value: '0개' },
              { icon: 'fa-clock',        color: 'text-orange-600 bg-orange-50',label: '최근 업데이트', value: '오늘' },
            ].map((stat) => (
              <div class="bg-white rounded-xl p-4 border border-gray-100 card-hover">
                <div class={`w-10 h-10 ${stat.color} rounded-lg flex items-center justify-center mb-3`}>
                  <i class={`fas ${stat.icon}`}></i>
                </div>
                <div class="text-xl md:text-2xl font-bold text-gray-800">{stat.value}</div>
                <div class="text-gray-500 text-sm">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* ── ③ D-day 업무 일정 위젯 ── */}
          {ddayItems.length > 0 && (
            <div class="grid grid-cols-2 md:grid-cols-4 gap-3">
              {ddayItems.map((item) => (
                <a
                  href="/dashboard/calendar"
                  class="dday-card bg-white rounded-xl p-4 block border border-gray-100"
                  style={`border-left: 4px solid ${item.borderColor};`}
                >
                  {/* 상단: 카테고리 라벨 + 아이콘 */}
                  <div class="flex items-center justify-between mb-3">
                    <span
                      class="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={`background:${item.iconBg}; color:${item.iconText};`}
                    >
                      {item.label}
                    </span>
                    <div
                      class="w-7 h-7 rounded-lg flex items-center justify-center"
                      style={`background:${item.iconBg};`}
                    >
                      <i class={`fas ${item.iconCls} text-xs`} style={`color:${item.iconText};`}></i>
                    </div>
                  </div>
                  {/* D-day 숫자 강조 */}
                  <div class="mb-1">
                    <span
                      class="text-2xl font-black"
                      style={`color:${item.accentColor};`}
                    >
                      D-{item.dday}
                    </span>
                  </div>
                  {/* 일정 제목 */}
                  <div class="font-semibold text-gray-800 text-sm leading-snug mb-1">{item.title}</div>
                  {/* 마감일 */}
                  <div class="text-gray-400 text-xs">
                    <i class="fas fa-calendar-alt mr-1"></i>
                    {new Date(item.deadline).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric', weekday: 'short' })}
                  </div>
                </a>
              ))}
            </div>
          )}

          {/* ── ④ 업무 카테고리 + 최근 가이드 ── */}
          <div class="grid grid-cols-1 md:grid-cols-2 gap-5">

            {/* 업무 카테고리 */}
            <div>
              <div class="flex items-center justify-between mb-3">
                <h2 class="text-base font-bold text-gray-800">업무 카테고리</h2>
                <a href="/dashboard/archive" class="text-blue-600 text-xs hover:underline">전체 보기 →</a>
              </div>
              <div class="grid grid-cols-2 gap-3">
                {categories.slice(0, 4).map((cat) => (
                  <a href={`/dashboard/archive?category=${cat.id}`} class="bg-white rounded-xl p-4 border border-gray-100 card-hover block">
                    <div class="flex items-center gap-2 mb-1.5">
                      <div class={`w-8 h-8 ${cat.color} rounded-lg flex items-center justify-center`}>
                        <i class={`fas ${cat.icon} text-sm`}></i>
                      </div>
                      <span class="font-semibold text-gray-800 text-sm">{cat.title}</span>
                    </div>
                    <p class="text-gray-500 text-xs mb-1">{cat.desc}</p>
                    <span class="text-xs text-blue-600 font-medium">{cat.count}개 가이드</span>
                  </a>
                ))}
              </div>
            </div>

            {/* 최근 가이드 */}
            <div>
              <div class="flex items-center justify-between mb-3">
                <h2 class="text-base font-bold text-gray-800">최근 업데이트 가이드</h2>
                <a href="/dashboard/archive" class="text-blue-600 text-xs hover:underline">전체 보기 →</a>
              </div>
              <div class="bg-white rounded-xl border border-gray-100 overflow-hidden">
                {recentGuides.map((guide, i) => (
                  <div
                    class={`flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 cursor-pointer ${i < recentGuides.length - 1 ? 'border-b border-gray-100' : ''}`}
                    onclick="window.location.href='/dashboard/archive'"
                  >
                    <div class="flex-1">
                      <div class="flex items-center gap-2 mb-0.5">
                        <span class="text-xs text-gray-400 font-medium">{guide.category}</span>
                        {guide.badge && (
                          <span class={`text-xs font-bold px-1.5 py-0.5 rounded ${guide.badgeColor}`}>{guide.badge}</span>
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

        </div>
      </main>

      <style>{`
        .gradient-bg   { background: linear-gradient(135deg, #1e3a5f 0%, #0f2544 100%); }
        .notice-bar    { background: linear-gradient(90deg, #fef3c7, #fde68a); }
        .card-hover    { transition: all 0.15s; }
        .card-hover:hover { box-shadow: 0 4px 12px rgba(0,0,0,0.08); transform: translateY(-1px); }
        /* D-day 카드 — 흰 배경 박스 + 좌측 컬러 보더 */
        .dday-card              { transition: all 0.18s; display:block; }
        .dday-card:hover        { box-shadow: 0 6px 20px rgba(0,0,0,0.10); transform: translateY(-2px); }
      `}</style>

      {/* 공지 1회 표시 JS */}
      <script dangerouslySetInnerHTML={{ __html: `
(function() {
  var NOTICE_ID   = '${NOTICE_ID}';
  var STORAGE_KEY = 'bizready_dismissed_' + NOTICE_ID;

  // 이미 닫은 공지면 즉시 숨김
  if (localStorage.getItem(STORAGE_KEY) === '1') {
    var b = document.getElementById('notice-banner');
    if (b) b.style.display = 'none';
  }

  window.dismissNotice = function(id) {
    localStorage.setItem('bizready_dismissed_' + id, '1');
    var b = document.getElementById('notice-banner');
    if (!b) return;
    b.style.overflow      = 'hidden';
    b.style.maxHeight     = b.scrollHeight + 'px';
    b.style.transition    = 'max-height .35s ease, opacity .35s ease, margin .35s ease, padding .35s ease';
    requestAnimationFrame(function() {
      b.style.maxHeight     = '0';
      b.style.opacity       = '0';
      b.style.paddingTop    = '0';
      b.style.paddingBottom = '0';
      b.style.marginBottom  = '0';
    });
    setTimeout(function() { b.style.display = 'none'; }, 380);
  };
})();
      `}} />
    </div>,
    { title: '대시보드 | BizReady' }
  )
})

export default dashboard
