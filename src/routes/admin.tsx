import { Hono } from 'hono'
import { renderer } from '../renderer'
import { parseSessionCookie } from '../lib/session'
import { getSupabaseClientWithToken, getSupabaseAdmin } from '../lib/supabase'
import type { Env } from '../lib/supabase'

const adminRoute = new Hono<{ Bindings: Env }>()
adminRoute.use(renderer)

const ADMIN_EMAIL = 'lsol3264@gmail.com'

// ── 관리자 인증 미들웨어 ────────────────────────────
async function requireAdmin(c: any): Promise<{ user: any } | null> {
  const cookie = c.req.header('Cookie') ?? ''
  const sessionStr = parseSessionCookie(cookie)
  if (!sessionStr) return null
  try {
    const sessionObj = JSON.parse(decodeURIComponent(sessionStr))
    const supabase = getSupabaseClientWithToken(c.env, sessionObj.access_token)
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return null
    if (user.email !== ADMIN_EMAIL) return null
    return { user }
  } catch { return null }
}

// ══════════════════════════════════════════════════
//  GET /admin  — 메인 대시보드
// ══════════════════════════════════════════════════
adminRoute.get('/', async (c) => {
  const auth = await requireAdmin(c)
  if (!auth) return c.redirect('/login?error=unauthorized')

  const db = getSupabaseAdmin(c.env)
  const { data: guides } = await db.from('guides').select('id,title,category,is_premium,status,updated_by,updated_at,view_count').order('created_at', { ascending: false })
  const { data: users } = await db.auth.admin.listUsers()
  const { data: profiles } = await db.from('user_profiles').select('*')
  const { data: payments } = await db.from('payment_logs').select('*').order('created_at', { ascending: false })

  const totalGuides = guides?.length ?? 0
  const totalUsers = users?.users?.length ?? 0
  const paidUsers = profiles?.filter((p: any) => p.is_paid).length ?? 0
  const totalRevenue = payments?.reduce((sum: number, p: any) => sum + (p.amount ?? 0), 0) ?? 0

  const categoryColors: Record<string, string> = {
    '회계·세무': 'bg-blue-100 text-blue-700',
    '인사·노무': 'bg-purple-100 text-purple-700',
    '총무·행정': 'bg-green-100 text-green-700',
    '세금·신고': 'bg-orange-100 text-orange-700',
    '급여관리': 'bg-teal-100 text-teal-700',
    '입사 체크리스트': 'bg-red-100 text-red-700',
  }

  return c.render(
    <div class="min-h-screen bg-gray-50">
      {/* 상단 헤더 */}
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
        {/* 탭 네비게이션 */}
        <div class="flex gap-1 bg-gray-200 rounded-xl p-1 mb-6 w-fit">
          {[
            { id: 'guides', label: '가이드 관리', icon: 'fa-book' },
            { id: 'users', label: '유저 현황', icon: 'fa-users' },
            { id: 'payments', label: '결제 내역', icon: 'fa-credit-card' },
          ].map((tab) => (
            <button
              onclick={`switchTab('${tab.id}')`}
              id={`tab-${tab.id}`}
              class={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab.id === 'guides' ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'}`}
            >
              <i class={`fas ${tab.icon} mr-1.5`}></i>{tab.label}
            </button>
          ))}
        </div>

        {/* 통계 카드 */}
        <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {[
            { icon: 'fa-book', color: 'bg-blue-50 text-blue-600', label: '총 가이드', value: `${totalGuides}개` },
            { icon: 'fa-users', color: 'bg-purple-50 text-purple-600', label: '총 회원', value: `${totalUsers}명` },
            { icon: 'fa-crown', color: 'bg-yellow-50 text-yellow-600', label: '유료 회원', value: `${paidUsers}명` },
            { icon: 'fa-won-sign', color: 'bg-green-50 text-green-600', label: '총 매출', value: `${totalRevenue.toLocaleString()}원` },
          ].map((s) => (
            <div class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
              <div class={`w-10 h-10 ${s.color} rounded-lg flex items-center justify-center mb-3`}>
                <i class={`fas ${s.icon}`}></i>
              </div>
              <div class="text-2xl font-bold text-gray-800">{s.value}</div>
              <div class="text-gray-500 text-sm">{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── 탭 1: 가이드 관리 ── */}
        <div id="panel-guides" class="tab-panel">
          <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 class="font-bold text-gray-800 text-lg"><i class="fas fa-book mr-2 text-blue-500"></i>가이드 관리</h2>
              <button
                onclick="openGuideModal()"
                class="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <i class="fas fa-plus"></i>새 가이드 추가
              </button>
            </div>
            <div class="overflow-x-auto">
              <table class="w-full text-sm">
                <thead class="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th class="text-left px-4 py-3 text-gray-500 font-medium">제목</th>
                    <th class="text-left px-4 py-3 text-gray-500 font-medium">카테고리</th>
                    <th class="text-center px-4 py-3 text-gray-500 font-medium">상태</th>
                    <th class="text-center px-4 py-3 text-gray-500 font-medium">프리미엄</th>
                    <th class="text-right px-4 py-3 text-gray-500 font-medium">조회수</th>
                    <th class="text-left px-4 py-3 text-gray-500 font-medium">최종 수정</th>
                    <th class="text-center px-4 py-3 text-gray-500 font-medium">관리</th>
                  </tr>
                </thead>
                <tbody>
                  {(guides ?? []).map((g: any) => (
                    <tr class="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                      <td class="px-4 py-3">
                        <div class="font-medium text-gray-800 max-w-xs truncate">{g.title}</div>
                      </td>
                      <td class="px-4 py-3">
                        <span class={`text-xs px-2 py-1 rounded-full font-medium ${categoryColors[g.category] ?? 'bg-gray-100 text-gray-600'}`}>
                          {g.category}
                        </span>
                      </td>
                      <td class="px-4 py-3 text-center">
                        <button
                          onclick={`toggleStatus('${g.id}', '${g.status ?? 'published'}')`}
                          class={`text-xs px-2.5 py-1 rounded-full font-medium cursor-pointer transition-colors ${(g.status ?? 'published') === 'published' ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}
                        >
                          {(g.status ?? 'published') === 'published' ? '● 발행중' : '○ 임시저장'}
                        </button>
                      </td>
                      <td class="px-4 py-3 text-center">
                        <button
                          onclick={`togglePremium('${g.id}', ${g.is_premium})`}
                          class={`text-xs px-2.5 py-1 rounded-full font-medium transition-colors ${g.is_premium ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                        >
                          {g.is_premium ? '💎 프리미엄' : '무료'}
                        </button>
                      </td>
                      <td class="px-4 py-3 text-right text-gray-500">{g.view_count ?? 0}</td>
                      <td class="px-4 py-3 text-xs text-gray-400">
                        <div>{g.updated_by || '-'}</div>
                        <div>{g.updated_at ? new Date(g.updated_at).toLocaleDateString('ko-KR') : '-'}</div>
                      </td>
                      <td class="px-4 py-3 text-center">
                        <div class="flex items-center justify-center gap-1">
                          <button
                            onclick={`editGuide(${JSON.stringify(g).replace(/"/g, '&quot;')})`}
                            class="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                            title="수정"
                          >
                            <i class="fas fa-edit text-xs"></i>
                          </button>
                          <button
                            onclick={`deleteGuide('${g.id}', '${g.title.replace(/'/g, "\\'")}')`}
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
          </div>
        </div>

        {/* ── 탭 2: 유저 현황 ── */}
        <div id="panel-users" class="tab-panel hidden">
          <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 class="font-bold text-gray-800 text-lg"><i class="fas fa-users mr-2 text-purple-500"></i>유저 현황</h2>
              <button
                onclick="downloadUsersCSV()"
                class="bg-green-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                <i class="fas fa-download"></i>CSV 다운로드
              </button>
            </div>
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
                  </tr>
                </thead>
                <tbody>
                  {(users?.users ?? []).map((u: any) => {
                    const profile = profiles?.find((p: any) => p.id === u.id)
                    return (
                      <tr class="border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer" onclick={`showUserDetail('${u.id}', '${u.email}')`}>
                        <td class="px-4 py-3 font-medium text-gray-800">{u.email}</td>
                        <td class="px-4 py-3 text-gray-600">{profile?.full_name || u.user_metadata?.full_name || '-'}</td>
                        <td class="px-4 py-3 text-center">
                          <span class={`text-xs px-2.5 py-1 rounded-full font-medium ${profile?.is_paid ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>
                            {profile?.is_paid ? '💎 유료' : '무료'}
                          </span>
                        </td>
                        <td class="px-4 py-3 text-center text-gray-500 text-xs">{profile?.plan_type || 'free'}</td>
                        <td class="px-4 py-3 text-gray-400 text-xs">{new Date(u.created_at).toLocaleDateString('ko-KR')}</td>
                        <td class="px-4 py-3 text-gray-400 text-xs">{u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleDateString('ko-KR') : '-'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ── 탭 3: 결제 내역 ── */}
        <div id="panel-payments" class="tab-panel hidden">
          <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 class="font-bold text-gray-800 text-lg"><i class="fas fa-credit-card mr-2 text-green-500"></i>결제 내역</h2>
              <button
                onclick="downloadPaymentsCSV()"
                class="bg-green-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
              >
                <i class="fas fa-download"></i>CSV 다운로드
              </button>
            </div>
            {(payments ?? []).length === 0 ? (
              <div class="text-center py-16 text-gray-400">
                <i class="fas fa-receipt text-4xl mb-3 block"></i>
                <p>아직 결제 내역이 없습니다.</p>
                <p class="text-sm mt-1">실결제 테스트 후 여기에 표시됩니다.</p>
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
                  <tbody>
                    {(payments ?? []).map((p: any) => (
                      <tr class="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td class="px-4 py-3 text-gray-700">{p.user_email || '-'}</td>
                        <td class="px-4 py-3 text-gray-400 text-xs font-mono">{p.payment_id}</td>
                        <td class="px-4 py-3 text-center">
                          <span class={`text-xs px-2 py-1 rounded-full ${p.plan_id === 'yearly' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'}`}>
                            {p.plan_id === 'yearly' ? '연간' : '월간'}
                          </span>
                        </td>
                        <td class="px-4 py-3 text-right font-medium text-gray-800">{(p.amount ?? 0).toLocaleString()}원</td>
                        <td class="px-4 py-3 text-center">
                          <span class="text-xs px-2 py-1 rounded-full bg-green-100 text-green-700">{p.status}</span>
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
      </div>

      {/* ══ 가이드 편집 모달 ══ */}
      <div id="guide-modal" class="fixed inset-0 bg-black/50 z-50 hidden flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl">
          <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between sticky top-0 bg-white">
            <h3 class="font-bold text-gray-800 text-lg" id="modal-title">가이드 추가</h3>
            <button onclick="closeGuideModal()" class="text-gray-400 hover:text-gray-600 transition-colors">
              <i class="fas fa-times text-xl"></i>
            </button>
          </div>
          <div class="p-6 space-y-4">
            <input type="hidden" id="guide-id" value="" />
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">제목 <span class="text-red-500">*</span></label>
              <input id="guide-title" type="text" placeholder="가이드 제목을 입력하세요"
                class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div class="grid grid-cols-2 gap-4">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">카테고리</label>
                <select id="guide-category" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="회계·세무">회계·세무</option>
                  <option value="인사·노무">인사·노무</option>
                  <option value="총무·행정">총무·행정</option>
                  <option value="세금·신고">세금·신고</option>
                  <option value="급여관리">급여관리</option>
                  <option value="입사 체크리스트">입사 체크리스트</option>
                </select>
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">상태</label>
                <select id="guide-status" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="published">발행중</option>
                  <option value="draft">임시저장</option>
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
              <textarea id="guide-content" rows={12} placeholder="## 제목&#10;&#10;본문을 Markdown 형식으로 작성하세요.&#10;&#10;- 항목1&#10;- 항목2&#10;&#10;**굵게**, `코드`"
                class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"></textarea>
            </div>
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

      <script>{`
        // ── 탭 전환 ─────────────────────────────────────
        function switchTab(id) {
          document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'))
          document.querySelectorAll('[id^="tab-"]').forEach(t => {
            t.classList.remove('bg-white','text-gray-900','shadow-sm')
            t.classList.add('text-gray-600')
          })
          document.getElementById('panel-' + id).classList.remove('hidden')
          const btn = document.getElementById('tab-' + id)
          btn.classList.add('bg-white','text-gray-900','shadow-sm')
          btn.classList.remove('text-gray-600')
        }

        // ── 가이드 모달 ──────────────────────────────────
        function openGuideModal() {
          document.getElementById('guide-id').value = ''
          document.getElementById('modal-title').textContent = '새 가이드 추가'
          document.getElementById('guide-title').value = ''
          document.getElementById('guide-category').value = '회계·세무'
          document.getElementById('guide-status').value = 'published'
          document.getElementById('guide-summary').value = ''
          document.getElementById('guide-content').value = ''
          document.getElementById('guide-premium').checked = false
          document.getElementById('modal-error').classList.add('hidden')
          document.getElementById('guide-modal').classList.remove('hidden')
        }
        function closeGuideModal() {
          document.getElementById('guide-modal').classList.add('hidden')
        }
        function editGuide(g) {
          document.getElementById('guide-id').value = g.id
          document.getElementById('modal-title').textContent = '가이드 수정'
          document.getElementById('guide-title').value = g.title || ''
          document.getElementById('guide-category').value = g.category || '회계·세무'
          document.getElementById('guide-status').value = g.status || 'published'
          document.getElementById('guide-summary').value = g.summary || ''
          document.getElementById('guide-content').value = g.content || ''
          document.getElementById('guide-premium').checked = !!g.is_premium
          document.getElementById('modal-error').classList.add('hidden')
          document.getElementById('guide-modal').classList.remove('hidden')
        }

        // ── 가이드 저장 ──────────────────────────────────
        async function saveGuide() {
          const title = document.getElementById('guide-title').value.trim()
          const content = document.getElementById('guide-content').value.trim()
          const errEl = document.getElementById('modal-error')
          if (!title) { errEl.textContent = '⚠️ 제목을 입력해주세요.'; errEl.classList.remove('hidden'); return }
          if (!content) { errEl.textContent = '⚠️ 본문을 입력해주세요.'; errEl.classList.remove('hidden'); return }
          errEl.classList.add('hidden')

          const btn = document.getElementById('save-btn')
          btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 저장 중...'
          btn.disabled = true

          const id = document.getElementById('guide-id').value
          const payload = {
            title,
            category: document.getElementById('guide-category').value,
            status: document.getElementById('guide-status').value,
            summary: document.getElementById('guide-summary').value.trim(),
            content,
            is_premium: document.getElementById('guide-premium').checked,
          }
          const res = await fetch(id ? '/admin/api/guides/' + id : '/admin/api/guides', {
            method: id ? 'PUT' : 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
          })
          const data = await res.json()
          if (data.ok) {
            closeGuideModal()
            location.reload()
          } else {
            errEl.textContent = '❌ 저장 실패: ' + (data.error || '알 수 없는 오류')
            errEl.classList.remove('hidden')
            btn.innerHTML = '<i class="fas fa-save"></i> 저장'
            btn.disabled = false
          }
        }

        // ── 가이드 삭제 ──────────────────────────────────
        async function deleteGuide(id, title) {
          if (!confirm('정말 삭제하시겠습니까?\\n\\n"' + title + '"\\n\\n이 작업은 되돌릴 수 없습니다.')) return
          const res = await fetch('/admin/api/guides/' + id, { method: 'DELETE' })
          const data = await res.json()
          if (data.ok) { location.reload() }
          else { alert('삭제 실패: ' + (data.error || '알 수 없는 오류')) }
        }

        // ── 상태 토글 ────────────────────────────────────
        async function toggleStatus(id, currentStatus) {
          const newStatus = currentStatus === 'published' ? 'draft' : 'published'
          if (!confirm('상태를 "' + (newStatus === 'published' ? '발행중' : '임시저장') + '"으로 변경하시겠습니까?')) return
          const res = await fetch('/admin/api/guides/' + id, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus })
          })
          const data = await res.json()
          if (data.ok) { location.reload() }
          else { alert('변경 실패') }
        }

        // ── 프리미엄 토글 ────────────────────────────────
        async function togglePremium(id, isPremium) {
          const newVal = !isPremium
          if (!confirm('프리미엄 설정을 "' + (newVal ? '프리미엄' : '무료') + '"으로 변경하시겠습니까?')) return
          const res = await fetch('/admin/api/guides/' + id, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ is_premium: newVal })
          })
          const data = await res.json()
          if (data.ok) { location.reload() }
          else { alert('변경 실패') }
        }

        // ── 유저 상세 ────────────────────────────────────
        async function showUserDetail(userId, email) {
          document.getElementById('user-modal-title').textContent = email
          document.getElementById('user-modal-body').innerHTML = '<div class="text-center py-8"><i class="fas fa-spinner fa-spin text-2xl text-gray-400"></i></div>'
          document.getElementById('user-modal').classList.remove('hidden')
          const res = await fetch('/admin/api/users/' + userId)
          const data = await res.json()
          if (data.ok) {
            const u = data.user
            const logs = data.payment_logs || []
            document.getElementById('user-modal-body').innerHTML =
              '<div class="space-y-4">' +
              '<div class="grid grid-cols-2 gap-3 text-sm">' +
              '<div class="bg-gray-50 rounded-lg p-3"><div class="text-gray-400 text-xs mb-1">구독 상태</div><div class="font-medium">' + (u.is_paid ? '💎 유료 (' + u.plan_type + ')' : '무료') + '</div></div>' +
              '<div class="bg-gray-50 rounded-lg p-3"><div class="text-gray-400 text-xs mb-1">결제일</div><div class="font-medium">' + (u.paid_at ? new Date(u.paid_at).toLocaleDateString('ko-KR') : '-') + '</div></div>' +
              '</div>' +
              '<div><div class="font-medium text-gray-700 mb-2 text-sm">결제 이력 (' + logs.length + '건)</div>' +
              (logs.length === 0 ? '<div class="text-center py-4 text-gray-400 text-sm">결제 이력 없음</div>' :
                '<div class="space-y-2">' + logs.map((l: any) =>
                  '<div class="flex items-center justify-between bg-gray-50 rounded-lg p-3 text-sm">' +
                  '<div><div class="font-medium">' + (l.plan_id === 'yearly' ? '연간 구독' : '월간 구독') + '</div>' +
                  '<div class="text-gray-400 text-xs">' + new Date(l.created_at).toLocaleDateString('ko-KR') + '</div></div>' +
                  '<div class="font-bold text-green-600">' + (l.amount || 0).toLocaleString() + '원</div></div>'
                ).join('') + '</div>') +
              '</div></div>'
          }
        }
        function closeUserModal() {
          document.getElementById('user-modal').classList.add('hidden')
        }

        // ── CSV 다운로드 ─────────────────────────────────
        function downloadUsersCSV() {
          window.location.href = '/admin/api/export/users'
        }
        function downloadPaymentsCSV() {
          window.location.href = '/admin/api/export/payments'
        }
      `}</script>
    </div>,
    { title: '관리자 | BizReady' }
  )
})

// ══════════════════════════════════════════════════
//  API: 가이드 CRUD
// ══════════════════════════════════════════════════

// POST /admin/api/guides — 새 가이드 생성
adminRoute.post('/api/guides', async (c) => {
  const auth = await requireAdmin(c)
  if (!auth) return c.json({ ok: false, error: 'unauthorized' }, 401)

  const body = await c.req.json<any>()
  if (!body.title?.trim()) return c.json({ ok: false, error: '제목이 필요합니다' }, 400)
  if (!body.content?.trim()) return c.json({ ok: false, error: '본문이 필요합니다' }, 400)

  const db = getSupabaseAdmin(c.env)
  const { error } = await db.from('guides').insert({
    title: body.title.trim(),
    category: body.category || '회계·세무',
    summary: body.summary?.trim() || '',
    content: body.content.trim(),
    is_premium: body.is_premium ?? false,
    status: body.status || 'published',
    updated_by: auth.user.email,
    updated_at: new Date().toISOString(),
  })
  if (error) return c.json({ ok: false, error: error.message }, 500)
  return c.json({ ok: true })
})

// PUT /admin/api/guides/:id — 가이드 수정
adminRoute.put('/api/guides/:id', async (c) => {
  const auth = await requireAdmin(c)
  if (!auth) return c.json({ ok: false, error: 'unauthorized' }, 401)

  const id = c.req.param('id')
  const body = await c.req.json<any>()

  // 제목/본문 둘 다 있는 경우만 검증 (토글은 하나만 올 수 있음)
  if (body.title !== undefined && !body.title?.trim()) return c.json({ ok: false, error: '제목이 필요합니다' }, 400)
  if (body.content !== undefined && !body.content?.trim()) return c.json({ ok: false, error: '본문이 필요합니다' }, 400)

  const updateData: any = { updated_by: auth.user.email, updated_at: new Date().toISOString() }
  if (body.title !== undefined) updateData.title = body.title.trim()
  if (body.category !== undefined) updateData.category = body.category
  if (body.summary !== undefined) updateData.summary = body.summary
  if (body.content !== undefined) updateData.content = body.content.trim()
  if (body.is_premium !== undefined) updateData.is_premium = body.is_premium
  if (body.status !== undefined) updateData.status = body.status

  const db = getSupabaseAdmin(c.env)
  const { error } = await db.from('guides').update(updateData).eq('id', id)
  if (error) return c.json({ ok: false, error: error.message }, 500)
  return c.json({ ok: true })
})

// DELETE /admin/api/guides/:id — 가이드 삭제
adminRoute.delete('/api/guides/:id', async (c) => {
  const auth = await requireAdmin(c)
  if (!auth) return c.json({ ok: false, error: 'unauthorized' }, 401)

  const id = c.req.param('id')
  const db = getSupabaseAdmin(c.env)
  const { error } = await db.from('guides').delete().eq('id', id)
  if (error) return c.json({ ok: false, error: error.message }, 500)
  return c.json({ ok: true })
})

// ══════════════════════════════════════════════════
//  API: 유저 상세 조회
// ══════════════════════════════════════════════════
adminRoute.get('/api/users/:id', async (c) => {
  const auth = await requireAdmin(c)
  if (!auth) return c.json({ ok: false, error: 'unauthorized' }, 401)

  const userId = c.req.param('id')
  const db = getSupabaseAdmin(c.env)

  const { data: profile } = await db.from('user_profiles').select('*').eq('id', userId).single()
  const { data: logs } = await db.from('payment_logs').select('*').eq('user_id', userId).order('created_at', { ascending: false })

  return c.json({ ok: true, user: profile, payment_logs: logs ?? [] })
})

// ══════════════════════════════════════════════════
//  API: CSV 내보내기
// ══════════════════════════════════════════════════
adminRoute.get('/api/export/users', async (c) => {
  const auth = await requireAdmin(c)
  if (!auth) return c.json({ ok: false, error: 'unauthorized' }, 401)

  const db = getSupabaseAdmin(c.env)
  const { data: users } = await db.auth.admin.listUsers()
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
