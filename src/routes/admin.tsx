import { Hono } from 'hono'
import { renderer } from '../renderer'
import { parseSessionCookie, parseSessionObj } from '../lib/session'
import { getSupabaseClientWithToken, getSupabaseAdmin } from '../lib/supabase'
import type { Env } from '../lib/supabase'

const adminRoute = new Hono<{ Bindings: Env }>()
adminRoute.use(renderer)

// ── 관리자 인증 ─────────────────────────────────────────────
async function requireAdmin(c: any): Promise<{ user: any } | null> {
  const cookieHeader = c.req.header('Cookie') ?? ''
  const sessionStr = parseSessionCookie(cookieHeader)
  if (!sessionStr) return null
  try {
    const sessionObj = parseSessionObj(sessionStr)
    if (!sessionObj?.access_token) return null
    const supabase = getSupabaseClientWithToken(c.env, sessionObj.access_token)
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return null
    if (user.email !== c.env.ADMIN_EMAIL) return null
    return { user }
  } catch {
    return null
  }
}

// ═══════════════════════════════════════════════════════════
//  GET /admin — 메인 페이지 (5탭)
// ═══════════════════════════════════════════════════════════
adminRoute.get('/', async (c) => {
  const auth = await requireAdmin(c)
  if (!auth) return c.redirect('/login?error=unauthorized')

  const db = getSupabaseAdmin(c.env)

  const [guidesRes, usersRes, profilesRes, paymentsRes, noticesRes] = await Promise.all([
    db.from('guides').select('id,title,category,subcategory,summary,is_premium,status,updated_at,view_count,file_url_1,file_url_2,file_url_3,file_name_1,file_name_2,file_name_3').order('created_at', { ascending: false }),
    db.auth.admin.listUsers(),
    db.from('user_profiles').select('*'),
    db.from('payment_logs').select('*').order('created_at', { ascending: false }),
    db.from('announcements').select('*').order('created_at', { ascending: false }),
  ])

  const guides         = guidesRes.data ?? []
  const guidesError    = guidesRes.error ? guidesRes.error.message : null
  const users          = usersRes.data?.users ?? []
  const profiles       = profilesRes.data ?? []
  const payments       = paymentsRes.data ?? []
  const notices        = noticesRes.data ?? []
  const noticesMissing = !!noticesRes.error

  // ── 통계 계산 ───────────────────────────────────────────
  const totalUsers   = users.length
  const paidUsers    = profiles.filter((p: any) => p.is_paid).length
  const todayStr     = new Date().toISOString().slice(0, 10)
  const todayCount   = users.filter((u: any) => u.created_at?.slice(0, 10) === todayStr).length
  const totalRevenue = payments.reduce((s: number, p: any) => s + (p.amount ?? 0), 0)
  const monthStr     = new Date().toISOString().slice(0, 7)
  const monthRevenue = payments
    .filter((p: any) => p.created_at?.slice(0, 7) === monthStr)
    .reduce((s: number, p: any) => s + (p.amount ?? 0), 0)
  const totalGuides  = guides.length
  const top5Guides   = [...guides]
    .sort((a: any, b: any) => (b.view_count ?? 0) - (a.view_count ?? 0))
    .slice(0, 5)
  const recentUsers  = [...users]
    .sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5)

  const catBadge: Record<string, string> = {
    '세무회계':  'bg-blue-100 text-blue-700',
    '인사노무':  'bg-purple-100 text-purple-700',
    '총무':      'bg-green-100 text-green-700',
    '회계·세무': 'bg-blue-100 text-blue-700',
    '인사·노무': 'bg-purple-100 text-purple-700',
    '총무·행정': 'bg-green-100 text-green-700',
  }

  const TABS = [
    { id: 'home',     label: '대시보드 홈', icon: 'fa-chart-bar' },
    { id: 'users',    label: '유저 관리',   icon: 'fa-users' },
    { id: 'payments', label: '결제 관리',   icon: 'fa-credit-card' },
    { id: 'guides',   label: '가이드 관리', icon: 'fa-book' },
    { id: 'notices',  label: '공지사항',    icon: 'fa-bell' },
  ]

  return c.render(
    <div class="min-h-screen bg-gray-50">

      {/* ── 헤더 ── */}
      <header class="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <div class="flex items-center gap-3">
          <div class="w-9 h-9 bg-red-600 rounded-xl flex items-center justify-center">
            <i class="fas fa-shield-alt text-white text-sm"></i>
          </div>
          <div>
            <div class="font-bold text-gray-900 text-lg">BizReady 관리자</div>
            <div class="text-xs text-gray-500">중앙 통제실 · {auth.user.email}</div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <a href="/dashboard" class="text-sm text-gray-500 hover:text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
            <i class="fas fa-arrow-left mr-1"></i>사이트로 이동
          </a>
          <form action="/auth/logout" method="POST" class="inline">
            <button class="text-sm text-red-500 hover:text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors">
              <i class="fas fa-sign-out-alt mr-1"></i>로그아웃
            </button>
          </form>
        </div>
      </header>

      <div class="max-w-7xl mx-auto px-6 py-6">

        {/* ── 탭 네비게이션 ── */}
        <div class="flex gap-1 bg-gray-200 rounded-xl p-1 mb-6 overflow-x-auto w-fit max-w-full">
          {TABS.map((tab) => (
            <button
              onclick={`switchTab('${tab.id}')`}
              id={`tab-${tab.id}`}
              class={`px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap ${tab.id === 'home' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >
              <i class={`fas ${tab.icon} mr-1.5`}></i>{tab.label}
            </button>
          ))}
        </div>

        {/* ══ 탭 1: 대시보드 홈 ══════════════════════════════════ */}
        <div id="panel-home" class="tab-panel space-y-6">

          {/* 통계 카드 6개 */}
          <div class="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4">
            {([
              { icon: 'fa-users',     color: 'bg-blue-50 text-blue-600',     label: '전체 가입자',   value: `${totalUsers}명` },
              { icon: 'fa-crown',     color: 'bg-amber-50 text-amber-600',   label: '프리미엄 유저', value: `${paidUsers}명` },
              { icon: 'fa-user-plus', color: 'bg-teal-50 text-teal-600',     label: '오늘 가입자',   value: `${todayCount}명` },
              { icon: 'fa-won-sign',  color: 'bg-green-50 text-green-600',   label: '총 매출',       value: `${totalRevenue.toLocaleString()}원` },
              { icon: 'fa-calendar',  color: 'bg-indigo-50 text-indigo-600', label: '이번달 매출',   value: `${monthRevenue.toLocaleString()}원` },
              { icon: 'fa-book',      color: 'bg-purple-50 text-purple-600', label: '가이드 수',     value: `${totalGuides}개` },
            ] as const).map((s) => (
              <div class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
                <div class={`w-9 h-9 ${s.color} rounded-lg flex items-center justify-center mb-3`}>
                  <i class={`fas ${s.icon} text-sm`}></i>
                </div>
                <div class="text-xl font-bold text-gray-800">{s.value}</div>
                <div class="text-gray-500 text-xs mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          <div class="grid md:grid-cols-2 gap-6">
            {/* 조회수 TOP 5 가이드 */}
            <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div class="px-5 py-4 border-b border-gray-100">
                <h3 class="font-bold text-gray-800 text-sm"><i class="fas fa-fire text-orange-500 mr-2"></i>조회수 TOP 5 가이드</h3>
              </div>
              <div class="divide-y divide-gray-50">
                {top5Guides.length === 0 ? (
                  <div class="py-10 text-center text-sm text-gray-400">가이드 없음</div>
                ) : top5Guides.map((g: any, i: number) => (
                  <div class="flex items-center gap-3 px-5 py-3">
                    <span class={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${i === 0 ? 'bg-amber-100 text-amber-700' : i === 1 ? 'bg-gray-200 text-gray-600' : 'bg-gray-50 text-gray-400'}`}>
                      {i + 1}
                    </span>
                    <span class="flex-1 text-sm text-gray-700 truncate">{g.title}</span>
                    <span class="text-xs text-gray-400 flex-shrink-0">{(g.view_count ?? 0).toLocaleString()}회</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 최근 가입자 5명 */}
            <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div class="px-5 py-4 border-b border-gray-100">
                <h3 class="font-bold text-gray-800 text-sm"><i class="fas fa-user-clock text-blue-500 mr-2"></i>최근 가입자 5명</h3>
              </div>
              <div class="divide-y divide-gray-50">
                {recentUsers.length === 0 ? (
                  <div class="py-10 text-center text-sm text-gray-400">가입자 없음</div>
                ) : recentUsers.map((u: any) => {
                  const prof = profiles.find((p: any) => p.id === u.id)
                  return (
                    <div class="flex items-center gap-3 px-5 py-3">
                      <div class="w-7 h-7 bg-gradient-to-br from-blue-400 to-indigo-500 rounded-full flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {(u.email?.[0] ?? '?').toUpperCase()}
                      </div>
                      <div class="flex-1 min-w-0">
                        <div class="text-sm text-gray-700 truncate">{u.email}</div>
                        <div class="text-xs text-gray-400">{u.created_at ? new Date(u.created_at).toLocaleDateString('ko-KR') : '-'}</div>
                      </div>
                      <span class={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ${prof?.is_paid ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                        {prof?.is_paid ? '💎' : '무료'}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>

        {/* ══ 탭 2: 유저 관리 ══════════════════════════════════ */}
        <div id="panel-users" class="tab-panel hidden">
          <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div class="px-6 py-4 border-b border-gray-100 flex flex-wrap items-center gap-3">
              <h2 class="font-bold text-gray-800 text-lg"><i class="fas fa-users mr-2 text-purple-500"></i>유저 관리</h2>
              <input
                id="user-search"
                type="text"
                placeholder="이메일 또는 이름 검색..."
                oninput="filterUsers(this.value)"
                class="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-purple-400 w-60"
              />
              <button
                onclick="downloadUsersCSV()"
                class="bg-green-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 ml-auto"
              >
                <i class="fas fa-download"></i>CSV
              </button>
            </div>
            {users.length === 0 ? (
              <div class="text-center py-16 text-gray-400">
                <i class="fas fa-users text-4xl mb-3 block text-gray-300"></i>
                <p class="text-sm">가입자가 없습니다.</p>
              </div>
            ) : (
              <div class="overflow-x-auto">
                <table class="w-full text-sm">
                  <thead class="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th class="text-left px-4 py-3 text-gray-500 font-medium">이메일</th>
                      <th class="text-left px-4 py-3 text-gray-500 font-medium">이름</th>
                      <th class="text-center px-4 py-3 text-gray-500 font-medium">구독</th>
                      <th class="text-center px-4 py-3 text-gray-500 font-medium">플랜</th>
                      <th class="text-left px-4 py-3 text-gray-500 font-medium">가입일</th>
                      <th class="text-left px-4 py-3 text-gray-500 font-medium">최근 로그인</th>
                      <th class="text-left px-4 py-3 text-gray-500 font-medium">결제일</th>
                      <th class="text-center px-4 py-3 text-gray-500 font-medium">플랜 변경</th>
                    </tr>
                  </thead>
                  <tbody id="user-table-body">
                    {users.map((u: any) => {
                      const profile = profiles.find((p: any) => p.id === u.id)
                      const email = u.email || ''
                      const name = profile?.full_name || u.user_metadata?.full_name || ''
                      return (
                        <tr
                          class="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                          data-email={email.toLowerCase()}
                          data-name={name.toLowerCase()}
                        >
                          <td class="px-4 py-3 font-medium text-gray-800 cursor-pointer hover:text-blue-600" onclick={`showUserDetail('${u.id}', '${email.replace(/'/g, '')}')`}>{email || '-'}</td>
                          <td class="px-4 py-3 text-gray-600">{name || '-'}</td>
                          <td class="px-4 py-3 text-center">
                            <span class={`text-xs px-2.5 py-1 rounded-full font-medium ${profile?.is_paid ? 'bg-amber-100 text-amber-700' : 'bg-gray-100 text-gray-500'}`}>
                              {profile?.is_paid ? '💎 유료' : '무료'}
                            </span>
                          </td>
                          <td class="px-4 py-3 text-center text-gray-500 text-xs">{profile?.plan_type || 'free'}</td>
                          <td class="px-4 py-3 text-gray-400 text-xs">{u.created_at ? new Date(u.created_at).toLocaleDateString('ko-KR') : '-'}</td>
                          <td class="px-4 py-3 text-gray-400 text-xs">{u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString('ko-KR') : '-'}</td>
                          <td class="px-4 py-3 text-gray-400 text-xs">{profile?.paid_at ? new Date(profile.paid_at).toLocaleDateString('ko-KR') : '-'}</td>
                          <td class="px-4 py-3 text-center">
                            <button
                              onclick={`changePlan('${u.id}', ${profile?.is_paid ?? false})`}
                              class={`text-xs px-2.5 py-1 rounded-lg font-medium transition-colors ${profile?.is_paid ? 'bg-red-50 text-red-500 hover:bg-red-100' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
                            >
                              {profile?.is_paid ? '무료로' : '프리미엄'}
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ══ 탭 3: 결제 관리 ══════════════════════════════════ */}
        <div id="panel-payments" class="tab-panel hidden">
          <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div class="px-6 py-4 border-b border-gray-100 flex flex-wrap items-center gap-3">
              <h2 class="font-bold text-gray-800 text-lg"><i class="fas fa-credit-card mr-2 text-green-500"></i>결제 관리</h2>
              <div class="flex gap-1.5">
                {([['', '전체'], ['paid', '완료'], ['failed', '실패']] as const).map(([val, label]) => (
                  <button
                    onclick={`filterPayments('${val}')`}
                    data-val={val}
                    class={`pay-filter text-xs px-3 py-1.5 rounded-lg border font-medium transition-colors ${val === '' ? 'bg-gray-800 text-white border-gray-800' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-400'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                onclick="downloadPaymentsCSV()"
                class="bg-green-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 ml-auto"
              >
                <i class="fas fa-download"></i>CSV
              </button>
            </div>
            {payments.length === 0 ? (
              <div class="text-center py-16 text-gray-400">
                <i class="fas fa-receipt text-4xl mb-3 block text-gray-300"></i>
                <p class="text-sm">결제 내역이 없습니다.</p>
              </div>
            ) : (
              <div class="overflow-x-auto">
                <table class="w-full text-sm">
                  <thead class="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th class="text-left px-4 py-3 text-gray-500 font-medium">이메일</th>
                      <th class="text-left px-4 py-3 text-gray-500 font-medium">결제 ID</th>
                      <th class="text-center px-4 py-3 text-gray-500 font-medium">플랜</th>
                      <th class="text-right px-4 py-3 text-gray-500 font-medium">금액</th>
                      <th class="text-center px-4 py-3 text-gray-500 font-medium">상태</th>
                      <th class="text-left px-4 py-3 text-gray-500 font-medium">결제일</th>
                    </tr>
                  </thead>
                  <tbody id="payment-table-body">
                    {payments.map((p: any) => (
                      <tr class="border-b border-gray-50 hover:bg-gray-50 transition-colors" data-status={p.status ?? ''}>
                        <td class="px-4 py-3 text-gray-700">{p.user_email || '-'}</td>
                        <td class="px-4 py-3 text-gray-400 text-xs font-mono">{p.payment_id}</td>
                        <td class="px-4 py-3 text-center">
                          <span class={`text-xs px-2 py-1 rounded-full ${p.plan_id === 'yearly' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                            {p.plan_id === 'yearly' ? '연간' : '월간'}
                          </span>
                        </td>
                        <td class="px-4 py-3 text-right font-medium text-gray-800">{(p.amount ?? 0).toLocaleString()}원</td>
                        <td class="px-4 py-3 text-center">
                          <span class={`text-xs px-2 py-1 rounded-full ${p.status === 'paid' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-500'}`}>
                            {p.status === 'paid' ? '완료' : (p.status || '-')}
                          </span>
                        </td>
                        <td class="px-4 py-3 text-gray-400 text-xs">{new Date(p.created_at).toLocaleDateString('ko-KR')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ══ 탭 4: 가이드 관리 ══════════════════════════════════ */}
        <div id="panel-guides" class="tab-panel hidden">
          <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div class="px-6 py-4 border-b border-gray-100 flex flex-wrap items-center gap-3">
              <h2 class="font-bold text-gray-800 text-lg"><i class="fas fa-book mr-2 text-blue-500"></i>가이드 관리</h2>
              <select
                id="guide-cat-filter"
                onchange="filterGuides(this.value)"
                class="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
              >
                <option value="">전체 카테고리</option>
                <option value="세무회계">세무회계</option>
                <option value="인사노무">인사노무</option>
                <option value="총무">총무</option>
                <option value="회계·세무">회계·세무</option>
                <option value="인사·노무">인사·노무</option>
                <option value="총무·행정">총무·행정</option>
              </select>
              <button
                onclick="openGuideModal()"
                class="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2 ml-auto"
              >
                <i class="fas fa-plus"></i>새 가이드 추가
              </button>
            </div>
            {guidesError && (
              <div class="mx-6 mt-4 mb-2 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700 flex items-center gap-2">
                <i class="fas fa-exclamation-triangle"></i>
                가이드 로딩 오류: {guidesError}
              </div>
            )}
            <div class="overflow-x-auto">
              {guides.length === 0 ? (
                <div class="text-center py-16 text-gray-400">
                  <i class="fas fa-book text-4xl mb-3 block text-gray-300"></i>
                  <p class="font-medium">{guidesError ? '가이드를 불러오지 못했습니다' : '등록된 가이드가 없습니다'}</p>
                  {!guidesError && (
                    <button onclick="openGuideModal()" class="mt-4 inline-flex items-center gap-2 bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors">
                      <i class="fas fa-plus"></i>신규 등록
                    </button>
                  )}
                </div>
              ) : (
                <table class="w-full text-sm">
                  <thead class="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th class="text-center px-4 py-3 text-gray-500 font-medium w-12">번호</th>
                      <th class="text-left px-4 py-3 text-gray-500 font-medium">카테고리</th>
                      <th class="text-left px-4 py-3 text-gray-500 font-medium">제목</th>
                      <th class="text-center px-4 py-3 text-gray-500 font-medium w-20">첨부파일</th>
                      <th class="text-center px-4 py-3 text-gray-500 font-medium">프리미엄</th>
                      <th class="text-center px-4 py-3 text-gray-500 font-medium">상태</th>
                      <th class="text-center px-4 py-3 text-gray-500 font-medium w-24">수정/삭제</th>
                    </tr>
                  </thead>
                  <tbody id="guide-table-body">
                    {guides.map((g: any, idx: number) => (
                      <tr class="border-b border-gray-50 hover:bg-gray-50 transition-colors" data-cat={g.category}>
                        <td class="px-4 py-3 text-center text-gray-400 text-xs">{idx + 1}</td>
                        <td class="px-4 py-3">
                          <span class={`text-xs px-2 py-1 rounded-full font-medium ${catBadge[g.category] ?? 'bg-gray-100 text-gray-600'}`}>
                            {g.category}
                          </span>
                        </td>
                        <td class="px-4 py-3">
                          <div class="font-medium text-gray-800 max-w-sm truncate">{g.title}</div>
                          {g.subcategory && <div class="text-xs text-gray-400 mt-0.5">{g.subcategory}</div>}
                        </td>
                        <td class="px-4 py-3 text-center">
                          {(g.file_url_1 || g.file_url_2 || g.file_url_3)
                            ? <span class="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium bg-emerald-100 text-emerald-700"><i class="fas fa-paperclip"></i>있음</span>
                            : <span class="text-gray-300 text-xs">-</span>
                          }
                        </td>
                        <td class="px-4 py-3 text-center">
                          <span class={`text-xs px-2 py-1 rounded-full font-medium ${g.is_premium ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-400'}`}>
                            {g.is_premium ? '💎 프리미엄' : '무료'}
                          </span>
                        </td>
                        <td class="px-4 py-3 text-center">
                          <span class={`text-xs px-2.5 py-1 rounded-full font-medium ${(g.status ?? 'published') === 'published' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                            {(g.status ?? 'published') === 'published' ? '발행중' : '임시저장'}
                          </span>
                        </td>
                        <td class="px-4 py-3 text-center">
                          <div class="flex items-center justify-center gap-1">
                            <button
                              onclick={`editGuide('${g.id}')`}
                              class="px-2.5 py-1 text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors font-medium"
                            >수정</button>
                            <button
                              onclick={`deleteGuide('${g.id}', '${g.title.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}')`}
                              class="px-2.5 py-1 text-xs text-red-500 bg-red-50 hover:bg-red-100 rounded-lg transition-colors font-medium"
                            >삭제</button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* ══ 탭 5: 공지사항 관리 ══════════════════════════════ */}
        <div id="panel-notices" class="tab-panel hidden">
          {noticesMissing ? (
            <div class="bg-amber-50 border border-amber-200 rounded-2xl p-6">
              <div class="flex items-start gap-4">
                <div class="w-10 h-10 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5">
                  <i class="fas fa-database text-amber-600"></i>
                </div>
                <div class="flex-1">
                  <h3 class="font-bold text-amber-800 mb-1">공지사항 테이블이 없습니다</h3>
                  <p class="text-sm text-amber-700 mb-3">Supabase Dashboard → SQL Editor에서 아래 SQL을 실행하세요.</p>
                  <pre class="bg-white border border-amber-200 rounded-xl p-4 text-xs font-mono text-gray-700 overflow-x-auto leading-relaxed">{`create table if not exists public.announcements (
  id         uuid        primary key default gen_random_uuid(),
  title      text        not null,
  content    text        not null,
  is_public  boolean     not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.announcements enable row level security;
create policy "authenticated users can read public announcements"
  on public.announcements for select to authenticated
  using (is_public = true);`}</pre>
                  <p class="text-xs text-amber-600 mt-3"><i class="fas fa-info-circle mr-1"></i>실행 후 페이지를 새로고침하세요.</p>
                </div>
              </div>
            </div>
          ) : (
            <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                <h2 class="font-bold text-gray-800 text-lg"><i class="fas fa-bell mr-2 text-orange-500"></i>공지사항 관리</h2>
                <button
                  onclick="openNoticeModal()"
                  class="bg-orange-500 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors flex items-center gap-2"
                >
                  <i class="fas fa-plus"></i>새 공지사항
                </button>
              </div>
              {notices.length === 0 ? (
                <div class="text-center py-16 text-gray-400">
                  <i class="fas fa-bell text-4xl mb-3 block text-gray-300"></i>
                  <p class="font-medium">등록된 공지사항이 없습니다</p>
                  <button onclick="openNoticeModal()" class="mt-4 inline-flex items-center gap-2 bg-orange-500 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors">
                    <i class="fas fa-plus"></i>새 공지사항 작성
                  </button>
                </div>
              ) : (
                <div class="overflow-x-auto">
                  <table class="w-full text-sm">
                    <thead class="bg-gray-50 border-b border-gray-100">
                      <tr>
                        <th class="text-left px-4 py-3 text-gray-500 font-medium">제목</th>
                        <th class="text-left px-4 py-3 text-gray-500 font-medium">내용 요약</th>
                        <th class="text-center px-4 py-3 text-gray-500 font-medium">공개 여부</th>
                        <th class="text-left px-4 py-3 text-gray-500 font-medium">작성일</th>
                        <th class="text-center px-4 py-3 text-gray-500 font-medium">관리</th>
                      </tr>
                    </thead>
                    <tbody>
                      {notices.map((n: any) => (
                        <tr class="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                          <td class="px-4 py-3 font-medium text-gray-800">{n.title}</td>
                          <td class="px-4 py-3 text-gray-500 text-xs max-w-xs truncate">{n.content}</td>
                          <td class="px-4 py-3 text-center">
                            <button
                              onclick={`toggleNoticePublic('${n.id}', ${n.is_public})`}
                              class={`text-xs px-2.5 py-1 rounded-full font-medium cursor-pointer transition-colors ${n.is_public ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                            >
                              {n.is_public ? '● 공개' : '○ 비공개'}
                            </button>
                          </td>
                          <td class="px-4 py-3 text-gray-400 text-xs">
                            {n.created_at ? new Date(n.created_at).toLocaleDateString('ko-KR') : '-'}
                          </td>
                          <td class="px-4 py-3 text-center">
                            <div class="flex items-center justify-center gap-1">
                              <button
                                onclick={`editNotice(${JSON.stringify(n).replace(/"/g, '&quot;')})`}
                                class="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                                title="수정"
                              >
                                <i class="fas fa-edit text-xs"></i>
                              </button>
                              <button
                                onclick={`deleteNotice('${n.id}', '${n.title.replace(/'/g, "\\'")}')`}
                                class="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition-colors"
                                title="삭제"
                              >
                                <i class="fas fa-trash text-xs"></i>
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

      </div>{/* end max-w-7xl */}

      {/* ══ 가이드 편집 모달 ══ */}
      <div id="guide-modal" class="fixed inset-0 bg-black/50 z-50 hidden flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto shadow-2xl">
          <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
            <h3 class="font-bold text-gray-800 text-lg" id="modal-title">가이드 추가</h3>
            <button onclick="closeGuideModal()" class="text-gray-400 hover:text-gray-600 transition-colors">
              <i class="fas fa-times text-xl"></i>
            </button>
          </div>
          <div class="p-6 space-y-5">
            <input type="hidden" id="guide-id" value="" />
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">제목 <span class="text-red-500">*</span></label>
              <input id="guide-title" type="text" placeholder="가이드 제목을 입력하세요"
                class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div class="grid grid-cols-3 gap-3">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">카테고리</label>
                <select id="guide-category" onchange="updateSubcategory()" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="세무/회계">세무/회계</option>
                  <option value="인사/노무">인사/노무</option>
                  <option value="총무">총무</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">서브카테고리</label>
                <select id="guide-subcategory" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="">선택 안함</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">상태</label>
                <select id="guide-status" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="published">● 발행중</option>
                  <option value="draft">○ 임시저장</option>
                </select>
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">요약</label>
              <input id="guide-summary" type="text" placeholder="목록에 표시될 1~2줄 요약"
                class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div class="flex items-center gap-2">
              <input id="guide-premium" type="checkbox" class="w-4 h-4 text-blue-600 rounded" />
              <label class="text-sm font-medium text-gray-700">💎 프리미엄 가이드 (유료 회원만 열람)</label>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">본문 (Markdown) <span class="text-red-500">*</span></label>
              <textarea id="guide-content" rows={14} placeholder="## 제목&#10;&#10;본문을 Markdown 형식으로 작성하세요."
                class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"></textarea>
            </div>
            <div id="file-upload-section" class="hidden border border-dashed border-emerald-300 rounded-xl p-4 bg-emerald-50">
              <div class="flex items-center gap-2 mb-3">
                <i class="fas fa-file-upload text-emerald-600"></i>
                <span class="font-medium text-emerald-800 text-sm">실무 양식 파일 첨부 (최대 3개)</span>
                <span class="text-xs text-emerald-600">xlsx, zip, rar, pdf, docx, hwp · 각 20MB 이하</span>
              </div>
              <div class="space-y-2">
                {[1, 2, 3].map(slot => (
                  <div class="flex items-center gap-2">
                    <div class={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${slot===1?'bg-green-100 text-green-700':slot===2?'bg-blue-100 text-blue-700':'bg-purple-100 text-purple-700'}`}>
                      {slot}
                    </div>
                    <div class="flex-1 min-w-0" id={`file-slot-${slot}`}>
                      <div class="relative">
                        <input type="file" id={`file-input-${slot}`}
                          accept=".xlsx,.xls,.zip,.rar,.pdf,.docx,.hwp,.hwpx"
                          class="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                          onchange={`handleFileSelect(${slot})`} />
                        <div id={`file-label-${slot}`} class="border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-500 bg-white cursor-pointer hover:border-emerald-400 flex items-center gap-2">
                          <i class="fas fa-paperclip text-gray-400"></i>
                          <span>파일 선택 (슬롯 {slot})</span>
                        </div>
                      </div>
                    </div>
                    <button type="button" onclick={`clearFileSlot(${slot})`}
                      class="flex-shrink-0 text-red-400 hover:text-red-600 text-xs p-1">
                      <i class="fas fa-times"></i>
                    </button>
                  </div>
                ))}
              </div>
              <p class="text-xs text-emerald-600 mt-2">
                <i class="fas fa-info-circle mr-1"></i>가이드 저장 후 파일이 자동 업로드됩니다.
              </p>
            </div>
            <button type="button" onclick="toggleFileUpload()" id="file-upload-toggle"
              class="text-sm text-emerald-600 hover:text-emerald-700 flex items-center gap-1 font-medium">
              <i class="fas fa-paperclip"></i>
              <span id="file-toggle-label">실무 양식 파일 첨부하기</span>
            </button>
            <div id="modal-error" class="hidden text-red-500 text-sm bg-red-50 p-3 rounded-lg"></div>
          </div>
          <div class="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end sticky bottom-0 bg-white">
            <button onclick="closeGuideModal()" class="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">취소</button>
            <button onclick="saveGuide()" id="save-btn"
              class="px-6 py-2 text-sm bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
              <i class="fas fa-save"></i>저장
            </button>
          </div>
        </div>
      </div>

      {/* ══ 파일 관리 모달 ══ */}
      <div id="file-modal" class="fixed inset-0 bg-black/50 z-50 hidden flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
          <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <div>
              <h3 class="font-bold text-gray-800">파일 관리</h3>
              <p class="text-xs text-gray-400 mt-0.5" id="file-modal-guide-title"></p>
            </div>
            <button onclick="closeFileModal()" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times text-xl"></i></button>
          </div>
          <div class="p-6 space-y-4" id="file-modal-body"></div>
          <div class="px-6 py-3 bg-gray-50 rounded-b-2xl text-xs text-gray-400">
            <i class="fas fa-info-circle mr-1"></i>허용 형식: xlsx, xls, zip, rar, pdf, docx, hwp · 최대 20MB
          </div>
        </div>
      </div>

      {/* ══ 유저 상세 모달 ══ */}
      <div id="user-modal" class="fixed inset-0 bg-black/50 z-50 hidden flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl w-full max-w-lg shadow-2xl">
          <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 class="font-bold text-gray-800" id="user-modal-title">유저 상세</h3>
            <button onclick="closeUserModal()" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times text-xl"></i></button>
          </div>
          <div id="user-modal-body" class="p-6"></div>
        </div>
      </div>

      {/* ══ 공지사항 모달 ══ */}
      <div id="notice-modal" class="fixed inset-0 bg-black/50 z-50 hidden flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
          <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white z-10">
            <h3 class="font-bold text-gray-800 text-lg" id="notice-modal-title">공지사항 추가</h3>
            <button onclick="closeNoticeModal()" class="text-gray-400 hover:text-gray-600 transition-colors">
              <i class="fas fa-times text-xl"></i>
            </button>
          </div>
          <div class="p-6 space-y-4">
            <input type="hidden" id="notice-id" value="" />
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">제목 <span class="text-red-500">*</span></label>
              <input id="notice-title" type="text" placeholder="공지사항 제목"
                class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">내용 <span class="text-red-500">*</span></label>
              <textarea id="notice-content" rows={8} placeholder="공지사항 내용을 입력하세요..."
                class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"></textarea>
            </div>
            <div class="flex items-center gap-2">
              <input id="notice-public" type="checkbox" checked class="w-4 h-4 accent-orange-500 rounded" />
              <label class="text-sm font-medium text-gray-700">공개 (체크 시 사용자에게 표시됨)</label>
            </div>
            <div id="notice-error" class="hidden text-red-500 text-sm bg-red-50 p-3 rounded-lg"></div>
          </div>
          <div class="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end sticky bottom-0 bg-white">
            <button onclick="closeNoticeModal()" class="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">취소</button>
            <button onclick="saveNotice()" id="notice-save-btn"
              class="px-6 py-2 text-sm bg-orange-500 text-white font-medium rounded-lg hover:bg-orange-600 transition-colors flex items-center gap-2">
              <i class="fas fa-save"></i>저장
            </button>
          </div>
        </div>
      </div>

      {/* ══ 파일 관리 스크립트 ══ */}
      <script dangerouslySetInnerHTML={{ __html: `
        let _fileGuideId = ''
        function manageFiles(guideId, title, u1, n1, u2, n2, u3, n3) {
          _fileGuideId = guideId
          document.getElementById('file-modal-guide-title').textContent = title
          const body = document.getElementById('file-modal-body')
          const slots = [{url:u1,name:n1},{url:u2,name:n2},{url:u3,name:n3}]
          body.innerHTML = slots.map(function(s, i) {
            const slot = i + 1
            const hasFile = !!s.url
            const ext = s.name ? s.name.split('.').pop().toLowerCase() : ''
            const iconMap = {xlsx:'🟢',xls:'🟢',zip:'🟠',rar:'🟠',pdf:'🔴',docx:'🔵',hwp:'🟦',hwpx:'🟦'}
            const icon = iconMap[ext] || '📎'
            return '<div class="border border-gray-100 rounded-xl p-4 bg-gray-50">' +
              '<div class="flex items-center justify-between mb-2">' +
              '<span class="text-sm font-medium text-gray-700">슬롯 ' + slot + '</span>' +
              (hasFile ? '<button onclick="deleteFile(\\''+guideId+'\\','+slot+')" class="text-xs text-red-400 hover:text-red-600 flex items-center gap-1"><i class="fas fa-trash"></i> 삭제</button>' : '') +
              '</div>' +
              (hasFile
                ? '<div class="flex items-center gap-2 bg-white rounded-lg p-2 border border-gray-200 mb-2">' +
                  '<span class="text-base">' + icon + '</span>' +
                  '<span class="text-sm text-gray-700 flex-1 truncate">' + (s.name || '첨부파일') + '</span>' +
                  '<a href="' + s.url + '" target="_blank" class="text-xs text-blue-500 hover:underline">보기</a>' +
                  '</div>'
                : '<div class="text-xs text-gray-400 mb-2">파일 없음</div>') +
              '<div class="relative">' +
              '<input type="file" id="fm-input-'+slot+'" accept=".xlsx,.xls,.zip,.rar,.pdf,.docx,.hwp,.hwpx" class="absolute inset-0 opacity-0 cursor-pointer w-full h-full" onchange="uploadFileSlot('+slot+')">' +
              '<div class="border-2 border-dashed border-gray-300 rounded-lg py-3 text-center cursor-pointer hover:border-emerald-400 transition-colors">' +
              '<i class="fas fa-cloud-upload-alt text-gray-400 mr-1"></i>' +
              '<span class="text-xs text-gray-500">' + (hasFile ? '파일 교체하기' : '파일 업로드') + '</span>' +
              '</div></div></div>'
          }).join('')
          document.getElementById('file-modal').classList.remove('hidden')
        }
        function closeFileModal() {
          document.getElementById('file-modal').classList.add('hidden')
        }
        async function uploadFileSlot(slot) {
          const input = document.getElementById('fm-input-' + slot)
          if (!input.files || !input.files[0]) return
          const file = input.files[0]
          if (file.size > 20 * 1024 * 1024) { alert('파일 크기가 20MB를 초과합니다'); return }
          const btn = input.parentElement.querySelector('div')
          btn.innerHTML = '<i class="fas fa-spinner fa-spin text-emerald-500 mr-1"></i><span class="text-xs text-emerald-600">업로드 중...</span>'
          const fd = new FormData()
          fd.append('file', file)
          const res = await fetch('/api/files/upload/' + _fileGuideId + '/' + slot, { method: 'POST', body: fd })
          const data = await res.json()
          if (data.ok) {
            btn.innerHTML = '<i class="fas fa-check text-emerald-500 mr-1"></i><span class="text-xs text-emerald-600">완료!</span>'
            setTimeout(function() { location.reload() }, 800)
          } else {
            btn.innerHTML = '<span class="text-xs text-red-500">실패: ' + data.error + '</span>'
          }
        }
        async function deleteFile(guideId, slot) {
          if (!confirm('파일을 삭제하시겠습니까?')) return
          const res = await fetch('/api/files/delete/' + guideId + '/' + slot, { method: 'DELETE' })
          const data = await res.json()
          if (data.ok) location.reload()
          else alert('삭제 실패: ' + data.error)
        }
      `}}></script>

      {/* ══ 메인 스크립트 ══ */}
      <script dangerouslySetInnerHTML={{ __html: `
        // ── 탭 전환 ─────────────────────────────────────────
        function switchTab(id) {
          document.querySelectorAll('.tab-panel').forEach(function(p) { p.classList.add('hidden') })
          document.querySelectorAll('[id^="tab-"]').forEach(function(t) {
            t.classList.remove('bg-white','text-gray-900','shadow-sm')
            t.classList.add('text-gray-600')
          })
          document.getElementById('panel-' + id).classList.remove('hidden')
          var btn = document.getElementById('tab-' + id)
          btn.classList.add('bg-white','text-gray-900','shadow-sm')
          btn.classList.remove('text-gray-600')
        }

        // ── 유저 검색 필터 ───────────────────────────────────
        function filterUsers(q) {
          var val = q.toLowerCase()
          document.querySelectorAll('#user-table-body tr').forEach(function(tr) {
            var email = tr.dataset.email || ''
            var name  = tr.dataset.name  || ''
            tr.style.display = (email.includes(val) || name.includes(val)) ? '' : 'none'
          })
        }

        // ── 결제 상태 필터 ───────────────────────────────────
        function filterPayments(val) {
          document.querySelectorAll('.pay-filter').forEach(function(btn) {
            if (btn.dataset.val === val) {
              btn.classList.add('bg-gray-800','text-white','border-gray-800')
              btn.classList.remove('bg-white','text-gray-600','border-gray-200')
            } else {
              btn.classList.remove('bg-gray-800','text-white','border-gray-800')
              btn.classList.add('bg-white','text-gray-600','border-gray-200')
            }
          })
          document.querySelectorAll('#payment-table-body tr').forEach(function(tr) {
            tr.style.display = (!val || tr.dataset.status === val) ? '' : 'none'
          })
        }

        // ── 가이드 카테고리 필터 ─────────────────────────────
        function filterGuides(cat) {
          document.querySelectorAll('#guide-table-body tr').forEach(function(tr) {
            tr.style.display = (!cat || tr.dataset.cat === cat) ? '' : 'none'
          })
        }

        // ── 플랜 변경 ────────────────────────────────────────
        async function changePlan(userId, isPaid) {
          var newIsPaid = !isPaid
          var msg = newIsPaid
            ? '프리미엄으로 변경하시겠습니까?\\n\\n(결제 없이 수동으로 프리미엄을 부여합니다)'
            : '무료 플랜으로 변경하시겠습니까?\\n\\n(구독이 취소됩니다)'
          if (!confirm(msg)) return
          var res = await fetch('/admin/api/users/' + userId + '/plan', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_paid: newIsPaid })
          })
          var data = await res.json()
          if (data.ok) { location.reload() }
          else { alert('변경 실패: ' + (data.error || '알 수 없는 오류')) }
        }

        // ── 서브카테고리 동적 업데이트 ───────────────────────
        var SUB_CATS = {
          '세무/회계': ['부가가치세','종합소득세','원천세','법인세','기타세무'],
          '인사/노무': ['근로계약','4대보험','급여/퇴직금','연차/휴가','노무관리'],
          '총무':      ['계약/문서','법인관리','시설/비품','기타총무'],
        }
        function updateSubcategory(selectedValue) {
          var cat = document.getElementById('guide-category').value
          var sel = document.getElementById('guide-subcategory')
          var prev = sel.value
          sel.innerHTML = '<option value="">선택 안함</option>'
          var subs = SUB_CATS[cat] || []
          subs.forEach(function(s) {
            var o = document.createElement('option')
            o.value = s; o.textContent = s
            if (s === (selectedValue || prev)) o.selected = true
            sel.appendChild(o)
          })
        }

        // ── 파일 업로드 UI ───────────────────────────────────
        var pendingFiles = {}
        function toggleFileUpload() {
          var sec = document.getElementById('file-upload-section')
          var lbl = document.getElementById('file-toggle-label')
          var isHidden = sec.classList.contains('hidden')
          sec.classList.toggle('hidden')
          lbl.textContent = isHidden ? '파일 첨부 접기' : '실무 양식 파일 첨부하기'
        }
        function handleFileSelect(slot) {
          var input = document.getElementById('file-input-' + slot)
          var label = document.getElementById('file-label-' + slot)
          if (input.files && input.files[0]) {
            var f = input.files[0]
            if (f.size > 20 * 1024 * 1024) { alert('파일 크기가 20MB를 초과합니다: ' + f.name); input.value = ''; return }
            pendingFiles[slot] = f
            var ext = f.name.split('.').pop().toLowerCase()
            var iconMap = { xlsx:'🟢', xls:'🟢', zip:'🟠', rar:'🟠', pdf:'🔴', docx:'🔵', hwp:'🟦', hwpx:'🟦' }
            var icon = iconMap[ext] || '📎'
            label.innerHTML = icon + ' <span class="text-gray-700 font-medium">' + f.name + '</span> <span class="text-gray-400 text-xs">(' + (f.size/1024).toFixed(0) + 'KB)</span>'
          }
        }
        function clearFileSlot(slot) {
          var input = document.getElementById('file-input-' + slot)
          var label = document.getElementById('file-label-' + slot)
          input.value = ''
          delete pendingFiles[slot]
          label.innerHTML = '<i class="fas fa-paperclip text-gray-400"></i><span>파일 선택 (슬롯 ' + slot + ')</span>'
        }
        async function uploadPendingFiles(guideId) {
          var slots = Object.keys(pendingFiles)
          if (slots.length === 0) return
          for (var i = 0; i < slots.length; i++) {
            var slot = slots[i]
            var file = pendingFiles[slot]
            var fd = new FormData()
            fd.append('file', file)
            try {
              var res = await fetch('/api/files/upload/' + guideId + '/' + slot, { method: 'POST', body: fd })
              var data = await res.json()
              if (!data.ok) console.error('파일 업로드 실패 (슬롯 ' + slot + '):', data.error)
            } catch(e) { console.error('파일 업로드 에러:', e) }
          }
          pendingFiles = {}
        }

        // ── 가이드 모달 ──────────────────────────────────────
        function openGuideModal() {
          document.getElementById('guide-id').value = ''
          document.getElementById('modal-title').textContent = '새 가이드 추가'
          document.getElementById('guide-title').value = ''
          document.getElementById('guide-category').value = '세무/회계'
          updateSubcategory('')
          document.getElementById('guide-status').value = 'published'
          document.getElementById('guide-summary').value = ''
          document.getElementById('guide-content').value = ''
          document.getElementById('guide-premium').checked = false
          document.getElementById('modal-error').classList.add('hidden')
          pendingFiles = {}
          for (var s = 1; s <= 3; s++) clearFileSlot(s)
          document.getElementById('file-upload-section').classList.add('hidden')
          document.getElementById('file-toggle-label').textContent = '실무 양식 파일 첨부하기'
          document.getElementById('guide-modal').classList.remove('hidden')
        }
        function closeGuideModal() {
          document.getElementById('guide-modal').classList.add('hidden')
        }
        async function editGuide(id) {
          var errEl = document.getElementById('modal-error')
          document.getElementById('guide-id').value = ''
          document.getElementById('modal-title').textContent = '가이드 불러오는 중...'
          document.getElementById('guide-modal').classList.remove('hidden')
          errEl.classList.add('hidden')
          try {
            var res = await fetch('/admin/api/guides/' + id)
            var data = await res.json()
            if (!data.ok) throw new Error(data.error || '알 수 없는 오류')
            var g = data.guide
            document.getElementById('guide-id').value = g.id
            document.getElementById('modal-title').textContent = '가이드 수정'
            document.getElementById('guide-title').value = g.title || ''
            document.getElementById('guide-category').value = g.category || '세무회계'
            updateSubcategory(g.subcategory || '')
            document.getElementById('guide-status').value = g.status || 'published'
            document.getElementById('guide-summary').value = g.summary || ''
            document.getElementById('guide-content').value = g.content || ''
            document.getElementById('guide-premium').checked = !!g.is_premium
            pendingFiles = {}
            for (var s = 1; s <= 3; s++) clearFileSlot(s)
          } catch(e) {
            errEl.textContent = '❌ 가이드를 불러올 수 없습니다: ' + e.message
            errEl.classList.remove('hidden')
            document.getElementById('modal-title').textContent = '오류'
          }
        }
        async function saveGuide() {
          var title   = document.getElementById('guide-title').value.trim()
          var content = document.getElementById('guide-content').value.trim()
          var errEl   = document.getElementById('modal-error')
          if (!title)   { errEl.textContent = '⚠️ 제목을 입력해주세요.';  errEl.classList.remove('hidden'); return }
          if (!content) { errEl.textContent = '⚠️ 본문을 입력해주세요.'; errEl.classList.remove('hidden'); return }
          errEl.classList.add('hidden')
          var btn = document.getElementById('save-btn')
          btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 저장 중...'
          btn.disabled = true
          var id = document.getElementById('guide-id').value
          var payload = {
            title,
            category: document.getElementById('guide-category').value,
            subcategory: document.getElementById('guide-subcategory').value,
            status: document.getElementById('guide-status').value,
            summary: document.getElementById('guide-summary').value.trim(),
            content,
            is_premium: document.getElementById('guide-premium').checked,
          }
          var res = await fetch(id ? '/admin/api/guides/' + id : '/admin/api/guides', {
            method: id ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          })
          var data = await res.json()
          if (data.ok) {
            var guideId = data.id || id
            if (guideId && Object.keys(pendingFiles).length > 0) {
              btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 파일 업로드 중...'
              await uploadPendingFiles(guideId)
            }
            closeGuideModal()
            location.reload()
          } else {
            errEl.textContent = '❌ 저장 실패: ' + (data.error || '알 수 없는 오류')
            errEl.classList.remove('hidden')
            btn.innerHTML = '<i class="fas fa-save"></i> 저장'
            btn.disabled = false
          }
        }
        async function deleteGuide(id, title) {
          if (!confirm('정말 삭제하시겠습니까?\\n\\n"' + title + '"\\n\\n이 작업은 되돌릴 수 없습니다.')) return
          var res = await fetch('/admin/api/guides/' + id, { method: 'DELETE' })
          var data = await res.json()
          if (data.ok) { location.reload() }
          else { alert('삭제 실패: ' + (data.error || '알 수 없는 오류')) }
        }
        async function toggleStatus(id, currentStatus) {
          var newStatus = currentStatus === 'published' ? 'draft' : 'published'
          if (!confirm('상태를 "' + (newStatus === 'published' ? '발행중' : '임시저장') + '"으로 변경하시겠습니까?')) return
          var res = await fetch('/admin/api/guides/' + id, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
          })
          var data = await res.json()
          if (data.ok) { location.reload() } else { alert('변경 실패') }
        }
        async function togglePremium(id, isPremium) {
          var newVal = !isPremium
          if (!confirm('프리미엄 설정을 "' + (newVal ? '프리미엄' : '무료') + '"으로 변경하시겠습니까?')) return
          var res = await fetch('/admin/api/guides/' + id, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_premium: newVal })
          })
          var data = await res.json()
          if (data.ok) { location.reload() } else { alert('변경 실패') }
        }

        // ── 공지사항 모달 ────────────────────────────────────
        function openNoticeModal() {
          document.getElementById('notice-id').value = ''
          document.getElementById('notice-modal-title').textContent = '공지사항 추가'
          document.getElementById('notice-title').value = ''
          document.getElementById('notice-content').value = ''
          document.getElementById('notice-public').checked = true
          document.getElementById('notice-error').classList.add('hidden')
          document.getElementById('notice-modal').classList.remove('hidden')
        }
        function closeNoticeModal() {
          document.getElementById('notice-modal').classList.add('hidden')
        }
        function editNotice(n) {
          document.getElementById('notice-id').value = n.id
          document.getElementById('notice-modal-title').textContent = '공지사항 수정'
          document.getElementById('notice-title').value = n.title || ''
          document.getElementById('notice-content').value = n.content || ''
          document.getElementById('notice-public').checked = !!n.is_public
          document.getElementById('notice-error').classList.add('hidden')
          document.getElementById('notice-modal').classList.remove('hidden')
        }
        async function saveNotice() {
          var title   = document.getElementById('notice-title').value.trim()
          var content = document.getElementById('notice-content').value.trim()
          var errEl   = document.getElementById('notice-error')
          if (!title)   { errEl.textContent = '⚠️ 제목을 입력해주세요.';  errEl.classList.remove('hidden'); return }
          if (!content) { errEl.textContent = '⚠️ 내용을 입력해주세요.'; errEl.classList.remove('hidden'); return }
          errEl.classList.add('hidden')
          var btn = document.getElementById('notice-save-btn')
          btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 저장 중...'
          btn.disabled = true
          var id = document.getElementById('notice-id').value
          var payload = {
            title,
            content,
            is_public: document.getElementById('notice-public').checked,
          }
          var res = await fetch(id ? '/admin/api/notices/' + id : '/admin/api/notices', {
            method: id ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          })
          var data = await res.json()
          if (data.ok) {
            closeNoticeModal()
            location.reload()
          } else {
            errEl.textContent = '❌ 저장 실패: ' + (data.error || '알 수 없는 오류')
            errEl.classList.remove('hidden')
            btn.innerHTML = '<i class="fas fa-save"></i> 저장'
            btn.disabled = false
          }
        }
        async function deleteNotice(id, title) {
          if (!confirm('정말 삭제하시겠습니까?\\n\\n"' + title + '"')) return
          var res = await fetch('/admin/api/notices/' + id, { method: 'DELETE' })
          var data = await res.json()
          if (data.ok) { location.reload() }
          else { alert('삭제 실패: ' + (data.error || '알 수 없는 오류')) }
        }
        async function toggleNoticePublic(id, isPublic) {
          var newVal = !isPublic
          var res = await fetch('/admin/api/notices/' + id, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_public: newVal })
          })
          var data = await res.json()
          if (data.ok) { location.reload() } else { alert('변경 실패') }
        }

        // ── 유저 상세 모달 ───────────────────────────────────
        async function showUserDetail(userId, email) {
          document.getElementById('user-modal-title').textContent = email
          document.getElementById('user-modal-body').innerHTML = '<div class="text-center py-8"><i class="fas fa-spinner fa-spin text-2xl text-gray-400"></i></div>'
          document.getElementById('user-modal').classList.remove('hidden')
          var res = await fetch('/admin/api/users/' + userId)
          var data = await res.json()
          if (data.ok) {
            var u = data.user
            var logs = data.payment_logs || []
            document.getElementById('user-modal-body').innerHTML =
              '<div class="space-y-4">' +
              '<div class="grid grid-cols-2 gap-3 text-sm">' +
              '<div class="bg-gray-50 rounded-lg p-3"><div class="text-gray-400 text-xs mb-1">구독 상태</div><div class="font-medium">' + (u.is_paid ? '💎 유료 (' + u.plan_type + ')' : '무료') + '</div></div>' +
              '<div class="bg-gray-50 rounded-lg p-3"><div class="text-gray-400 text-xs mb-1">결제일</div><div class="font-medium">' + (u.paid_at ? new Date(u.paid_at).toLocaleDateString('ko-KR') : '-') + '</div></div>' +
              '</div>' +
              '<div><div class="font-medium text-gray-700 mb-2 text-sm">결제 이력 (' + logs.length + '건)</div>' +
              (logs.length === 0 ? '<div class="text-center py-4 text-gray-400 text-sm">결제 이력 없음</div>' :
                '<div class="space-y-2">' + logs.map(function(l) {
                  return '<div class="flex items-center justify-between bg-gray-50 rounded-lg p-3 text-sm">' +
                    '<div><div class="font-medium">' + (l.plan_id === 'yearly' ? '연간 구독' : '월간 구독') + '</div>' +
                    '<div class="text-gray-400 text-xs">' + new Date(l.created_at).toLocaleDateString('ko-KR') + '</div></div>' +
                    '<div class="font-bold text-green-600">' + (l.amount || 0).toLocaleString() + '원</div></div>'
                }).join('') + '</div>') +
              '</div></div>'
          }
        }
        function closeUserModal() {
          document.getElementById('user-modal').classList.add('hidden')
        }

        // ── CSV 다운로드 ─────────────────────────────────────
        function downloadUsersCSV()    { window.location.href = '/admin/api/export/users' }
        function downloadPaymentsCSV() { window.location.href = '/admin/api/export/payments' }

        // ── 초기화 ──────────────────────────────────────────
        document.addEventListener('DOMContentLoaded', function() { updateSubcategory('') })
      `}}></script>

    </div>,
    { title: '관리자 | BizReady' }
  )
})

// ═══════════════════════════════════════════════════════════
//  API: 가이드 단건 조회
// ═══════════════════════════════════════════════════════════
adminRoute.get('/api/guides/:id', async (c) => {
  const auth = await requireAdmin(c)
  if (!auth) return c.json({ ok: false, error: 'unauthorized' }, 401)

  const id = c.req.param('id')
  const db = getSupabaseAdmin(c.env)
  const { data, error } = await db.from('guides').select('*').eq('id', id).single()
  if (error) return c.json({ ok: false, error: error.message }, 500)
  return c.json({ ok: true, guide: data })
})

// ═══════════════════════════════════════════════════════════
//  POST 폼 라우트: 가이드 수정 / 삭제 (form submit 방식)
// ═══════════════════════════════════════════════════════════
adminRoute.post('/guide/:id/update', async (c) => {
  const auth = await requireAdmin(c)
  if (!auth) return c.redirect('/login?error=unauthorized')

  const id   = c.req.param('id')
  const body = await c.req.parseBody()

  const db = getSupabaseAdmin(c.env)
  const { error } = await db.from('guides').update({
    title:       (body.title as string)?.trim(),
    category:    body.category as string,
    subcategory: body.subcategory as string || '',
    summary:     (body.summary as string)?.trim() || '',
    content:     (body.content as string)?.trim(),
    is_premium:  body.is_premium === 'on',
    status:      body.status as string || 'published',
    updated_at:  new Date().toISOString(),
  }).eq('id', id)

  if (error) return c.redirect(`/admin?tab=guides&error=${encodeURIComponent(error.message)}`)
  return c.redirect('/admin?tab=guides&success=updated')
})

adminRoute.post('/guide/:id/delete', async (c) => {
  const auth = await requireAdmin(c)
  if (!auth) return c.redirect('/login?error=unauthorized')

  const id = c.req.param('id')
  const db = getSupabaseAdmin(c.env)
  const { error } = await db.from('guides').delete().eq('id', id)

  if (error) return c.redirect(`/admin?tab=guides&error=${encodeURIComponent(error.message)}`)
  return c.redirect('/admin?tab=guides&success=deleted')
})

// ═══════════════════════════════════════════════════════════
//  API: 가이드 CRUD
// ═══════════════════════════════════════════════════════════
adminRoute.post('/api/guides', async (c) => {
  const auth = await requireAdmin(c)
  if (!auth) return c.json({ ok: false, error: 'unauthorized' }, 401)

  const body = await c.req.json<any>()
  if (!body.title?.trim()) return c.json({ ok: false, error: '제목이 필요합니다' }, 400)
  if (!body.content?.trim()) return c.json({ ok: false, error: '본문이 필요합니다' }, 400)

  const db = getSupabaseAdmin(c.env)
  const { data, error } = await db.from('guides').insert({
    title: body.title.trim(),
    category: body.category || '세무회계',
    subcategory: body.subcategory || '',
    summary: body.summary?.trim() || '',
    content: body.content.trim(),
    is_premium: body.is_premium ?? false,
    status: body.status || 'published',
    updated_at: new Date().toISOString(),
  }).select('id').single()
  if (error) return c.json({ ok: false, error: error.message }, 500)
  return c.json({ ok: true, id: data?.id })
})

adminRoute.put('/api/guides/:id', async (c) => {
  const auth = await requireAdmin(c)
  if (!auth) return c.json({ ok: false, error: 'unauthorized' }, 401)

  const id = c.req.param('id')
  const body = await c.req.json<any>()

  if (body.title !== undefined && !body.title?.trim()) return c.json({ ok: false, error: '제목이 필요합니다' }, 400)
  if (body.content !== undefined && !body.content?.trim()) return c.json({ ok: false, error: '본문이 필요합니다' }, 400)

  const updateData: any = { updated_at: new Date().toISOString() }
  if (body.title      !== undefined) updateData.title      = body.title.trim()
  if (body.category   !== undefined) updateData.category   = body.category
  if (body.subcategory !== undefined) updateData.subcategory = body.subcategory
  if (body.summary    !== undefined) updateData.summary    = body.summary
  if (body.content    !== undefined) updateData.content    = body.content.trim()
  if (body.is_premium !== undefined) updateData.is_premium = body.is_premium
  if (body.status     !== undefined) updateData.status     = body.status

  const db = getSupabaseAdmin(c.env)
  const { error } = await db.from('guides').update(updateData).eq('id', id)
  if (error) return c.json({ ok: false, error: error.message }, 500)
  return c.json({ ok: true })
})

adminRoute.delete('/api/guides/:id', async (c) => {
  const auth = await requireAdmin(c)
  if (!auth) return c.json({ ok: false, error: 'unauthorized' }, 401)

  const id = c.req.param('id')
  const db = getSupabaseAdmin(c.env)
  const { error } = await db.from('guides').delete().eq('id', id)
  if (error) return c.json({ ok: false, error: error.message }, 500)
  return c.json({ ok: true })
})

// ═══════════════════════════════════════════════════════════
//  API: 유저 상세 조회
// ═══════════════════════════════════════════════════════════
adminRoute.get('/api/users/:id', async (c) => {
  const auth = await requireAdmin(c)
  if (!auth) return c.json({ ok: false, error: 'unauthorized' }, 401)

  const userId = c.req.param('id')
  const db = getSupabaseAdmin(c.env)
  const { data: profile } = await db.from('user_profiles').select('*').eq('id', userId).single()
  const { data: logs } = await db.from('payment_logs').select('*').eq('user_id', userId).order('created_at', { ascending: false })
  return c.json({ ok: true, user: profile, payment_logs: logs ?? [] })
})

// ═══════════════════════════════════════════════════════════
//  API: 유저 플랜 변경
// ═══════════════════════════════════════════════════════════
adminRoute.put('/api/users/:id/plan', async (c) => {
  const auth = await requireAdmin(c)
  if (!auth) return c.json({ ok: false, error: 'unauthorized' }, 401)

  const userId = c.req.param('id')
  const body = await c.req.json<{ is_paid: boolean }>()

  const db = getSupabaseAdmin(c.env)
  const upsertPayload: Record<string, any> = {
    id:        userId,
    is_paid:   body.is_paid,
    plan_type: body.is_paid ? 'premium' : 'free',
    paid_at:   body.is_paid ? new Date().toISOString() : null,
  }

  const { error } = await db.from('user_profiles').upsert(upsertPayload, { onConflict: 'id' })

  if (error) return c.json({ ok: false, error: error.message }, 500)
  return c.json({ ok: true })
})

// ═══════════════════════════════════════════════════════════
//  API: 공지사항 CRUD
// ═══════════════════════════════════════════════════════════
adminRoute.post('/api/notices', async (c) => {
  const auth = await requireAdmin(c)
  if (!auth) return c.json({ ok: false, error: 'unauthorized' }, 401)

  const body = await c.req.json<any>()
  if (!body.title?.trim())   return c.json({ ok: false, error: '제목이 필요합니다' }, 400)
  if (!body.content?.trim()) return c.json({ ok: false, error: '내용이 필요합니다' }, 400)

  const db = getSupabaseAdmin(c.env)
  const { data, error } = await db.from('announcements').insert({
    title:     body.title.trim(),
    content:   body.content.trim(),
    is_public: body.is_public ?? true,
  }).select('id').single()

  if (error) return c.json({ ok: false, error: error.message }, 500)
  return c.json({ ok: true, id: data?.id })
})

adminRoute.put('/api/notices/:id', async (c) => {
  const auth = await requireAdmin(c)
  if (!auth) return c.json({ ok: false, error: 'unauthorized' }, 401)

  const id   = c.req.param('id')
  const body = await c.req.json<any>()

  const updateData: any = { updated_at: new Date().toISOString() }
  if (body.title     !== undefined) updateData.title     = body.title.trim()
  if (body.content   !== undefined) updateData.content   = body.content.trim()
  if (body.is_public !== undefined) updateData.is_public = body.is_public

  const db = getSupabaseAdmin(c.env)
  const { error } = await db.from('announcements').update(updateData).eq('id', id)
  if (error) return c.json({ ok: false, error: error.message }, 500)
  return c.json({ ok: true })
})

adminRoute.delete('/api/notices/:id', async (c) => {
  const auth = await requireAdmin(c)
  if (!auth) return c.json({ ok: false, error: 'unauthorized' }, 401)

  const id = c.req.param('id')
  const db = getSupabaseAdmin(c.env)
  const { error } = await db.from('announcements').delete().eq('id', id)
  if (error) return c.json({ ok: false, error: error.message }, 500)
  return c.json({ ok: true })
})

// ═══════════════════════════════════════════════════════════
//  API: CSV 내보내기
// ═══════════════════════════════════════════════════════════
adminRoute.get('/api/export/users', async (c) => {
  const auth = await requireAdmin(c)
  if (!auth) return c.json({ ok: false, error: 'unauthorized' }, 401)

  const db = getSupabaseAdmin(c.env)
  const { data: users }    = await db.auth.admin.listUsers()
  const { data: profiles } = await db.from('user_profiles').select('*')

  const rows = (users?.users ?? []).map((u: any) => {
    const p = profiles?.find((x: any) => x.id === u.id)
    return [
      u.email,
      p?.full_name || '',
      p?.is_paid ? '유료' : '무료',
      p?.plan_type || 'free',
      new Date(u.created_at).toLocaleDateString('ko-KR'),
      u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString('ko-KR') : '',
    ].join(',')
  })

  const csv = '\uFEFF이메일,이름,구독,플랜,가입일,최근로그인\n' + rows.join('\n')
  c.header('Content-Type', 'text/csv; charset=utf-8')
  c.header('Content-Disposition', `attachment; filename="bizready_users_${new Date().toISOString().slice(0,10)}.csv"`)
  return c.body(csv)
})

adminRoute.get('/api/export/payments', async (c) => {
  const auth = await requireAdmin(c)
  if (!auth) return c.json({ ok: false, error: 'unauthorized' }, 401)

  const db = getSupabaseAdmin(c.env)
  const { data: payments } = await db.from('payment_logs').select('*').order('created_at', { ascending: false })

  const rows = (payments ?? []).map((p: any) => [
    p.user_email || '',
    p.payment_id,
    p.plan_id === 'yearly' ? '연간' : '월간',
    p.amount,
    p.status,
    new Date(p.created_at).toLocaleDateString('ko-KR'),
  ].join(','))

  const csv = '\uFEFF이메일,결제ID,플랜,금액,상태,결제일\n' + rows.join('\n')
  c.header('Content-Type', 'text/csv; charset=utf-8')
  c.header('Content-Disposition', `attachment; filename="bizready_payments_${new Date().toISOString().slice(0,10)}.csv"`)
  return c.body(csv)
})

export default adminRoute
