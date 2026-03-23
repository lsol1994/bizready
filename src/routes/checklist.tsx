import { Hono } from 'hono'
import { renderer } from '../renderer'
import { parseSessionCookie } from '../lib/session'
import { getSupabaseClientWithToken } from '../lib/supabase'
import type { Env } from '../lib/supabase'

const checklistRoute = new Hono<{ Bindings: Env }>()
checklistRoute.use(renderer)

// 입사 체크리스트 고정 항목
const CHECKLIST_ITEMS = [
  { key: 'org_chart',       week: 1, label: '회사 전체 조직도 파악',                       icon: 'fa-sitemap' },
  { key: 'accounting_sw',   week: 1, label: '사용 중인 회계 프로그램 파악 (더존/ERP 등)',   icon: 'fa-desktop' },
  { key: 'bank_account',    week: 1, label: '법인 은행 계좌 현황 및 인터넷뱅킹 권한 확인', icon: 'fa-university' },
  { key: 'handover_docs',   week: 1, label: '전임자 인수인계 자료 수령',                    icon: 'fa-file-alt' },
  { key: 'corp_seal',       week: 1, label: '법인인감·통장·공인인증서 보관 위치 확인',      icon: 'fa-stamp' },
  { key: 'vendor_list',     week: 2, label: '거래처 목록 및 지급 조건 파악',                icon: 'fa-handshake' },
  { key: 'employee_list',   week: 2, label: '직원 명부 및 4대보험 현황 확인',               icon: 'fa-users' },
  { key: 'payroll_prep',    week: 2, label: '가장 가까운 급여일 급여 계산 준비',            icon: 'fa-money-bill-wave' },
  { key: 'expense_flow',    week: 2, label: '경비 지출 결재 라인 파악',                     icon: 'fa-route' },
  { key: 'tax_calendar',    week: 3, label: '부가세·원천세 신고 일정 달력 등록',            icon: 'fa-calendar-check' },
  { key: 'tax_invoice',     week: 3, label: '주요 거래처 세금계산서 수수 현황 점검',        icon: 'fa-file-invoice' },
  { key: 'work_rules',      week: 3, label: '취업규칙 열람',                                icon: 'fa-book' },
  { key: 'monthly_close',   week: 4, label: '월말 결산 프로세스 파악',                      icon: 'fa-calculator' },
  { key: 'payroll_practice',week: 4, label: '다음 달 급여 계산 연습',                       icon: 'fa-table' },
  { key: 'account_codes',   week: 4, label: '자주 쓰는 계정과목 목록 정리',                 icon: 'fa-list' },
  { key: 'prev_tax_docs',   week: 4, label: '전년도 세무 신고 서류 위치 확인',              icon: 'fa-folder-open' },
]

checklistRoute.get('/', async (c) => {
  const cookie = c.req.header('Cookie') ?? ''
  const sessionStr = parseSessionCookie(cookie)
  if (!sessionStr) return c.redirect('/login?error=unauthorized')

  let doneKeys = new Set<string>()
  let userName = '사용자'
  let userInitial = 'U'
  let userId = ''

  try {
    const sessionObj = JSON.parse(decodeURIComponent(sessionStr))
    const supabase = getSupabaseClientWithToken(c.env, sessionObj.access_token)

    const { data: { user }, error: userErr } = await supabase.auth.getUser()
    if (userErr || !user) return c.redirect('/login?error=session_expired')

    userName = (user.user_metadata?.full_name as string) || user.email?.split('@')[0] || '사용자'
    userInitial = userName.charAt(0).toUpperCase()
    userId = user.id

    const { data } = await supabase
      .from('checklists').select('item_key').eq('user_id', user.id).eq('is_done', true)
    if (data) doneKeys = new Set(data.map((d: any) => d.item_key))
  } catch {
    return c.redirect('/login?error=session_expired')
  }

  const doneCount = doneKeys.size
  const totalCount = CHECKLIST_ITEMS.length
  const progress = Math.round((doneCount / totalCount) * 100)

  const weeks = [1, 2, 3, 4]
  const weekLabels: Record<number, string> = {
    1: '첫째 주 (1~5일) — 기초 파악',
    2: '둘째 주 (6~10일) — 업무 흐름 파악',
    3: '셋째 주 (11~20일) — 세무·노무 일정 등록',
    4: '넷째 주 (21~말일) — 실무 적용',
  }

  return c.render(
    <div class="flex h-screen overflow-hidden">
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
            </div>
          </div>
        </div>
        <nav class="flex-1 px-3 py-4 space-y-1">
          <a href="/dashboard"           class="sidebar-item flex items-center gap-3 px-3 py-2.5 rounded-lg text-sky-200 hover:text-white text-sm"><i class="fas fa-home w-4 text-center"></i><span>홈</span></a>
          <a href="/dashboard/archive"   class="sidebar-item flex items-center gap-3 px-3 py-2.5 rounded-lg text-sky-200 hover:text-white text-sm"><i class="fas fa-book-open w-4 text-center"></i><span>업무 아카이브</span></a>
          <a href="/dashboard/search"    class="sidebar-item flex items-center gap-3 px-3 py-2.5 rounded-lg text-sky-200 hover:text-white text-sm"><i class="fas fa-search w-4 text-center"></i><span>지식 검색</span></a>
          <a href="/dashboard/checklist" class="sidebar-item active flex items-center gap-3 px-3 py-2.5 rounded-lg text-white text-sm"><i class="fas fa-clipboard-check w-4 text-center"></i><span>체크리스트</span></a>
        </nav>
        <div class="px-3 pb-4">
          <form action="/auth/logout" method="POST">
            <button type="submit" class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sky-200 hover:text-white hover:bg-white/10 text-sm transition-colors">
              <i class="fas fa-sign-out-alt w-4 text-center"></i><span>로그아웃</span>
            </button>
          </form>
        </div>
      </aside>

      <main class="flex-1 overflow-y-auto bg-gray-50">
        <header class="bg-white border-b border-gray-200 px-8 py-4 sticky top-0 z-10">
          <h1 class="text-xl font-bold text-gray-800">입사 첫 달 체크리스트</h1>
          <p class="text-gray-500 text-sm">완료한 항목을 체크하면 진행상황이 자동 저장됩니다</p>
        </header>

        <div class="px-8 py-6 max-w-3xl">
          {/* 진행률 카드 */}
          <div class="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
            <div class="flex items-center justify-between mb-3">
              <div>
                <span class="text-3xl font-bold text-blue-600">{progress}%</span>
                <span class="text-gray-500 text-sm ml-2">완료</span>
              </div>
              <div class="text-right">
                <div class="text-2xl font-bold text-gray-800">{doneCount} <span class="text-gray-400 text-lg font-normal">/ {totalCount}</span></div>
                <div class="text-xs text-gray-400">항목 완료</div>
              </div>
            </div>
            <div class="w-full bg-gray-100 rounded-full h-3">
              <div
                class="bg-blue-500 h-3 rounded-full transition-all"
                style={`width: ${progress}%`}
              ></div>
            </div>
            {progress === 100 && (
              <div class="mt-3 text-center text-green-600 font-medium text-sm">
                🎉 모든 항목을 완료했습니다! 첫 달 적응 완료!
              </div>
            )}
          </div>

          {/* 주차별 체크리스트 */}
          {weeks.map((week) => {
            const items = CHECKLIST_ITEMS.filter(it => it.week === week)
            const weekDone = items.filter(it => doneKeys.has(it.key)).length
            return (
              <div class="bg-white rounded-2xl border border-gray-100 p-5 mb-4">
                <div class="flex items-center justify-between mb-4">
                  <h2 class="font-bold text-gray-800 text-sm">{weekLabels[week]}</h2>
                  <span class="text-xs text-gray-400">{weekDone}/{items.length} 완료</span>
                </div>
                <div class="space-y-2">
                  {items.map((item) => {
                    const done = doneKeys.has(item.key)
                    return (
                      <div
                        class={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all checklist-item ${done ? 'bg-green-50 border border-green-100' : 'bg-gray-50 border border-transparent hover:border-gray-200'}`}
                        data-key={item.key}
                        data-done={done ? 'true' : 'false'}
                        onclick="toggleItem(this)"
                      >
                        <div class={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${done ? 'bg-green-500 border-green-500' : 'border-gray-300'}`}>
                          {done && <i class="fas fa-check text-white text-xs"></i>}
                        </div>
                        <div class="flex items-center gap-2 flex-1">
                          <i class={`fas ${item.icon} text-xs ${done ? 'text-green-400' : 'text-gray-400'}`}></i>
                          <span class={`text-sm ${done ? 'text-green-700 line-through' : 'text-gray-700'}`}>
                            {item.label}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>
      </main>

      <script dangerouslySetInnerHTML={{ __html: `
const SUPABASE_URL = '${c.env.SUPABASE_URL}'
const SUPABASE_ANON_KEY = '${c.env.SUPABASE_ANON_KEY}'
const { createClient } = supabase
const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
const USER_ID = '${userId}'

async function toggleItem(el) {
  const key = el.dataset.key
  const currentDone = el.dataset.done === 'true'
  const newDone = !currentDone
  el.dataset.done = newDone ? 'true' : 'false'

  // UI 즉시 반영
  const circle = el.querySelector('.rounded-full')
  const label = el.querySelector('span')
  const icon = el.querySelector('.fas:last-of-type')
  if (newDone) {
    el.className = el.className.replace('bg-gray-50 border-transparent hover:border-gray-200','bg-green-50 border border-green-100')
    circle.className = circle.className.replace('border-gray-300','bg-green-500 border-green-500')
    circle.innerHTML = '<i class="fas fa-check text-white text-xs"></i>'
    label.className = label.className.replace('text-gray-700','text-green-700 line-through')
  } else {
    el.className = el.className.replace('bg-green-50 border border-green-100','bg-gray-50 border border-transparent hover:border-gray-200')
    circle.className = circle.className.replace('bg-green-500 border-green-500','border-gray-300')
    circle.innerHTML = ''
    label.className = label.className.replace('text-green-700 line-through','text-gray-700')
  }

  // 진행률 업데이트
  updateProgress()

  // Supabase 저장
  await client.from('checklists').upsert({
    user_id: USER_ID,
    item_key: key,
    is_done: newDone,
    done_at: newDone ? new Date().toISOString() : null
  }, { onConflict: 'user_id,item_key' })
}

function updateProgress() {
  const all = document.querySelectorAll('.checklist-item')
  const done = document.querySelectorAll('.checklist-item[data-done="true"]')
  const pct = Math.round((done.length / all.length) * 100)
  document.querySelector('.bg-blue-500').style.width = pct + '%'
  document.querySelector('.text-3xl').textContent = pct + '%'
  document.querySelector('.text-2xl').innerHTML = done.length + ' <span class="text-gray-400 text-lg font-normal">/ ' + all.length + '</span>'
}
` }} />
    </div>,
    { title: '체크리스트 | BizReady' }
  )
})

export default checklistRoute
