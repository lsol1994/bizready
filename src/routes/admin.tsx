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
  const cookieHeader = c.req.header('Cookie') ?? ''
  
  // 쿠키 원문 로그 (디버깅용, 프로덕션에서도 첫 50자만)
  console.log('[Admin Auth] Cookie header length:', cookieHeader.length, '| preview:', cookieHeader.substring(0, 80))
  
  const sessionStr = parseSessionCookie(cookieHeader)
  if (!sessionStr) {
    console.log('[Admin Auth] No session cookie found')
    return null
  }
  
  try {
    // sessionStr이 이미 decoded JSON 문자열
    let sessionObj: any
    try {
      sessionObj = JSON.parse(sessionStr)
    } catch {
      // 혹시 double-encoded인 경우 한 번 더 decode
      sessionObj = JSON.parse(decodeURIComponent(sessionStr))
    }
    
    if (!sessionObj?.access_token) {
      console.log('[Admin Auth] No access_token in session')
      return null
    }
    
    const supabase = getSupabaseClientWithToken(c.env, sessionObj.access_token)
    const { data: { user }, error } = await supabase.auth.getUser()
    
    if (error) {
      console.log('[Admin Auth] getUser error:', error.message)
      return null
    }
    if (!user) {
      console.log('[Admin Auth] No user returned')
      return null
    }
    
    console.log('[Admin Auth] User email:', user.email, '| Admin?', user.email === ADMIN_EMAIL)
    if (user.email !== ADMIN_EMAIL) return null
    return { user }
  } catch (e: any) {
    console.error('[Admin Auth] Exception:', e.message)
    return null
  }
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
                          {/* 파일 첨부 표시 */}
                          {(g.file_url_1 || g.file_url_2 || g.file_url_3) && (
                            <span class="text-emerald-500 text-xs" title="첨부파일 있음">
                              <i class="fas fa-paperclip"></i>
                              {[g.file_url_1, g.file_url_2, g.file_url_3].filter(Boolean).length}
                            </span>
                          )}
                          <button
                            onclick={`editGuide(${JSON.stringify(g).replace(/"/g, '&quot;')})`}
                            class="p-1.5 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                            title="수정"
                          >
                            <i class="fas fa-edit text-xs"></i>
                          </button>
                          <button
                            onclick={`manageFiles('${g.id}', '${g.title.replace(/'/g, "\\'")}', '${g.file_url_1||''}', '${g.file_name_1||''}', '${g.file_url_2||''}', '${g.file_name_2||''}', '${g.file_url_3||''}', '${g.file_name_3||''}')`}
                            class="p-1.5 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="파일 관리"
                          >
                            <i class="fas fa-file-upload text-xs"></i>
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

      {/* ══ 가이드 편집 모달 (파일 업로드 포함) ══ */}
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

            {/* 제목 */}
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">제목 <span class="text-red-500">*</span></label>
              <input id="guide-title" type="text" placeholder="가이드 제목을 입력하세요"
                class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            {/* 카테고리/서브카테고리/상태 */}
            <div class="grid grid-cols-3 gap-3">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">카테고리</label>
                <select id="guide-category" onchange="updateSubcategory()" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                  <option value="세무회계">세무회계</option>
                  <option value="인사노무">인사노무</option>
                  <option value="총무">총무</option>
                  <option value="회계·세무">회계·세무</option>
                  <option value="인사·노무">인사·노무</option>
                  <option value="총무·행정">총무·행정</option>
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

            {/* 요약 + 프리미엄 */}
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">요약</label>
              <input id="guide-summary" type="text" placeholder="목록에 표시될 1~2줄 요약"
                class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div class="flex items-center gap-2">
              <input id="guide-premium" type="checkbox" class="w-4 h-4 text-blue-600 rounded" />
              <label class="text-sm font-medium text-gray-700">💎 프리미엄 가이드 (유료 회원만 열람)</label>
            </div>

            {/* 본문 */}
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">본문 (Markdown) <span class="text-red-500">*</span></label>
              <textarea id="guide-content" rows={14} placeholder="## 제목&#10;&#10;본문을 Markdown 형식으로 작성하세요.&#10;&#10;- 항목1&#10;&#10;**굵게**, `코드`&#10;&#10;[근로기준법 제60조] 형식으로 법령 링크 자동 생성"
                class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"></textarea>
            </div>

            {/* ── 파일 업로드 섹션 ── */}
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
                <i class="fas fa-info-circle mr-1"></i>
                가이드 저장 후 파일이 자동 업로드됩니다. 원본 파일명이 보존됩니다.
              </p>
            </div>
            <button type="button" onclick="toggleFileUpload()"
              id="file-upload-toggle"
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
          <div class="p-6 space-y-4" id="file-modal-body">
            {/* JS로 동적 렌더링 */}
          </div>
          <div class="px-6 py-3 bg-gray-50 rounded-b-2xl text-xs text-gray-400">
            <i class="fas fa-info-circle mr-1"></i>
            허용 형식: xlsx, xls, zip, rar, pdf, docx, hwp · 최대 20MB
          </div>
        </div>
      </div>

      <script>{`
        // ── 파일 관리 모달 ─────────────────────────────────
        let _fileGuideId = ''
        function manageFiles(guideId, title, u1, n1, u2, n2, u3, n3) {
          _fileGuideId = guideId
          document.getElementById('file-modal-guide-title').textContent = title
          const body = document.getElementById('file-modal-body')
          const slots = [{url:u1,name:n1},{url:u2,name:n2},{url:u3,name:n3}]
          const colors = ['emerald','blue','purple']
          body.innerHTML = slots.map((s, i) => {
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
              '</div>' +
              '</div>' +
              '</div>'
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
            btn.innerHTML = '<i class="fas fa-check text-emerald-500 mr-1"></i><span class="text-xs text-emerald-600">업로드 완료!</span>'
            setTimeout(() => location.reload(), 800)
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
      `}</script>

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

        // ── 서브카테고리 동적 업데이트 ───────────────────
        const SUB_CATS = {
          '세무회계':  ['전표/결산','부가세','법인세','원천세/연말정산','자금관리'],
          '인사노무':  ['채용/퇴사','급여/4대보험','근태/연차','근로계약/사규','성과평가'],
          '총무':      ['자산/시설','법무/인장','복리후생','구매관리'],
          '회계·세무': ['전표/결산','부가세','법인세','원천세/연말정산','자금관리'],
          '인사·노무': ['채용/퇴사','급여/4대보험','근태/연차','근로계약/사규','성과평가'],
          '총무·행정': ['자산/시설','법무/인장','복리후생','구매관리'],
          '세금·신고': ['부가세','법인세','종합소득세'],
          '급여관리':  ['급여계산','4대보험','원천세'],
          '입사 체크리스트': ['입사준비','서류체크','OJT'],
        }
        function updateSubcategory(selectedValue) {
          const cat = document.getElementById('guide-category').value
          const sel = document.getElementById('guide-subcategory')
          const prev = sel.value
          sel.innerHTML = '<option value="">선택 안함</option>'
          const subs = SUB_CATS[cat] || []
          subs.forEach(s => {
            const o = document.createElement('option')
            o.value = s; o.textContent = s
            if (s === (selectedValue || prev)) o.selected = true
            sel.appendChild(o)
          })
        }

        // ── 파일 업로드 UI ───────────────────────────────
        let pendingFiles = {} // { slot: File }
        function toggleFileUpload() {
          const sec = document.getElementById('file-upload-section')
          const lbl = document.getElementById('file-toggle-label')
          const isHidden = sec.classList.contains('hidden')
          sec.classList.toggle('hidden')
          lbl.textContent = isHidden ? '파일 첨부 접기' : '실무 양식 파일 첨부하기'
        }
        function handleFileSelect(slot) {
          const input = document.getElementById('file-input-' + slot)
          const label = document.getElementById('file-label-' + slot)
          if (input.files && input.files[0]) {
            const f = input.files[0]
            if (f.size > 20 * 1024 * 1024) {
              alert('파일 크기가 20MB를 초과합니다: ' + f.name)
              input.value = ''
              return
            }
            pendingFiles[slot] = f
            const ext = f.name.split('.').pop().toLowerCase()
            const iconMap = { xlsx:'🟢', xls:'🟢', zip:'🟠', rar:'🟠', pdf:'🔴', docx:'🔵', hwp:'🟦', hwpx:'🟦' }
            const icon = iconMap[ext] || '📎'
            label.innerHTML = icon + ' <span class="text-gray-700 font-medium">' + f.name + '</span> <span class="text-gray-400 text-xs">(' + (f.size/1024).toFixed(0) + 'KB)</span>'
          }
        }
        function clearFileSlot(slot) {
          const input = document.getElementById('file-input-' + slot)
          const label = document.getElementById('file-label-' + slot)
          input.value = ''
          delete pendingFiles[slot]
          label.innerHTML = '<i class="fas fa-paperclip text-gray-400"></i><span>파일 선택 (슬롯 ' + slot + ')</span>'
        }
        async function uploadPendingFiles(guideId) {
          const slots = Object.keys(pendingFiles)
          if (slots.length === 0) return
          for (const slot of slots) {
            const file = pendingFiles[slot]
            const fd = new FormData()
            fd.append('file', file)
            try {
              const res = await fetch('/api/files/upload/' + guideId + '/' + slot, { method: 'POST', body: fd })
              const data = await res.json()
              if (!data.ok) console.error('파일 업로드 실패 (슬롯 ' + slot + '):', data.error)
            } catch(e) { console.error('파일 업로드 에러:', e) }
          }
          pendingFiles = {}
        }

        // ── 가이드 모달 ──────────────────────────────────
        function openGuideModal() {
          document.getElementById('guide-id').value = ''
          document.getElementById('modal-title').textContent = '새 가이드 추가'
          document.getElementById('guide-title').value = ''
          document.getElementById('guide-category').value = '세무회계'
          updateSubcategory('')
          document.getElementById('guide-status').value = 'published'
          document.getElementById('guide-summary').value = ''
          document.getElementById('guide-content').value = ''
          document.getElementById('guide-premium').checked = false
          document.getElementById('modal-error').classList.add('hidden')
          // 파일 슬롯 초기화
          pendingFiles = {}
          for (let s = 1; s <= 3; s++) clearFileSlot(s)
          document.getElementById('file-upload-section').classList.add('hidden')
          document.getElementById('file-toggle-label').textContent = '실무 양식 파일 첨부하기'
          document.getElementById('guide-modal').classList.remove('hidden')
        }
        function closeGuideModal() {
          document.getElementById('guide-modal').classList.add('hidden')
        }
        function editGuide(g) {
          document.getElementById('guide-id').value = g.id
          document.getElementById('modal-title').textContent = '가이드 수정'
          document.getElementById('guide-title').value = g.title || ''
          document.getElementById('guide-category').value = g.category || '세무회계'
          updateSubcategory(g.subcategory || '')
          document.getElementById('guide-status').value = g.status || 'published'
          document.getElementById('guide-summary').value = g.summary || ''
          document.getElementById('guide-content').value = g.content || ''
          document.getElementById('guide-premium').checked = !!g.is_premium
          document.getElementById('modal-error').classList.add('hidden')
          pendingFiles = {}
          for (let s = 1; s <= 3; s++) clearFileSlot(s)
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
            const guideId = data.id || id
            // 파일 업로드 (있는 경우)
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
        function downloadUsersCSV() { window.location.href = '/admin/api/export/users' }
        function downloadPaymentsCSV() { window.location.href = '/admin/api/export/payments' }

        // ── 가이드 테이블에 파일 버튼 추가 표시 ──────────────
        // (파일 슬롯이 있는 가이드는 📎 아이콘 표시 - 서버에서 이미 렌더링됨)

        // ── 페이지 로드 시 서브카테고리 초기화 ───────────────
        document.addEventListener('DOMContentLoaded', () => updateSubcategory(''))
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
  const { data, error } = await db.from('guides').insert({
    title: body.title.trim(),
    category: body.category || '세무회계',
    subcategory: body.subcategory || '',
    summary: body.summary?.trim() || '',
    content: body.content.trim(),
    is_premium: body.is_premium ?? false,
    status: body.status || 'published',
    updated_by: auth.user.email,
    updated_at: new Date().toISOString(),
  }).select('id').single()
  if (error) return c.json({ ok: false, error: error.message }, 500)
  return c.json({ ok: true, id: data?.id })
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
  if (body.subcategory !== undefined) updateData.subcategory = body.subcategory
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
