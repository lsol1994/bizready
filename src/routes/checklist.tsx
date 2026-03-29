import { Hono } from 'hono'
import { renderer } from '../renderer'
import { parseSessionCookie } from '../lib/session'
import { getSupabaseClientWithToken } from '../lib/supabase'
import { Sidebar, MobileMenuButton } from '../lib/sidebar'
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
  let customItems: { item_key: string; label: string; is_done: boolean }[] = []
  let userName = '사용자'
  let userInitial = 'U'
  let userId = ''
  let isPaid = false

  try {
    const sessionObj = JSON.parse(decodeURIComponent(sessionStr))
    const supabase = getSupabaseClientWithToken(c.env, sessionObj.access_token)

    const { data: { user }, error: userErr } = await supabase.auth.getUser()
    if (userErr || !user) return c.redirect('/login?error=session_expired')

    userName = (user.user_metadata?.full_name as string) || user.email?.split('@')[0] || '사용자'
    userInitial = userName.charAt(0).toUpperCase()
    userId = user.id

    const { data: profile } = await supabase
      .from('user_profiles').select('is_paid').eq('id', user.id).single()
    isPaid = profile?.is_paid ?? false

    const { data } = await supabase
      .from('checklists')
      .select('item_key, label, is_done')
      .eq('user_id', user.id)

    if (data) {
      doneKeys = new Set(data.filter((d: any) => d.is_done).map((d: any) => d.item_key))
      customItems = data
        .filter((d: any) => d.item_key.startsWith('custom_'))
        .sort((a: any, b: any) => a.item_key.localeCompare(b.item_key))
    }
  } catch {
    return c.redirect('/login?error=session_expired')
  }

  const doneCount = doneKeys.size
  const totalCount = CHECKLIST_ITEMS.length + customItems.length
  const progress = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0
  const customDone = customItems.filter(it => doneKeys.has(it.item_key)).length

  const weeks = [1, 2, 3, 4]
  const weekLabels: Record<number, string> = {
    1: '첫째 주 (1~5일) — 기초 파악',
    2: '둘째 주 (6~10일) — 업무 흐름 파악',
    3: '셋째 주 (11~20일) — 세무·노무 일정 등록',
    4: '넷째 주 (21~말일) — 실무 적용',
  }

  return c.render(
    <div class="flex h-screen overflow-hidden">
      <Sidebar
        userName={userName}
        userInitial={userInitial}
        isPaid={isPaid}
        currentPath="/dashboard/checklist"
      />

      <main class="flex-1 overflow-y-auto bg-gray-50">
        <header class="bg-white border-b border-gray-200 px-4 md:px-8 py-4 sticky top-0 z-10 flex items-center gap-2">
          <MobileMenuButton />
          <div>
            <h1 class="text-lg md:text-xl font-bold text-gray-800">입사 첫 달 체크리스트</h1>
            <p class="text-gray-500 text-xs md:text-sm hidden sm:block">완료한 항목을 체크하면 진행상황이 자동 저장됩니다</p>
          </div>
        </header>

        <div class="px-4 md:px-8 py-6 max-w-3xl">
          {/* 진행률 카드 */}
          <div class="bg-white rounded-2xl border border-gray-100 p-6 mb-6">
            <div class="flex items-center justify-between mb-3">
              <div>
                <span id="progress-pct" class="text-3xl font-bold text-blue-600">{progress}%</span>
                <span class="text-gray-500 text-sm ml-2">완료</span>
              </div>
              <div class="text-right">
                <div id="progress-count" class="text-2xl font-bold text-gray-800">
                  {doneCount} <span class="text-gray-400 text-lg font-normal">/ {totalCount}</span>
                </div>
                <div class="text-xs text-gray-400">항목 완료</div>
              </div>
            </div>
            <div class="w-full bg-gray-100 rounded-full h-3">
              <div
                id="progress-bar"
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

          {/* 나만의 체크 항목 */}
          <div class="bg-white rounded-2xl border border-blue-100 p-5 mb-4">
            <div class="flex items-center justify-between mb-4">
              <div class="flex items-center gap-2">
                <h2 class="font-bold text-gray-800 text-sm">나만의 체크 항목</h2>
                <span class="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">직접 추가</span>
              </div>
              <span id="custom-count" class="text-xs text-gray-400">{customDone}/{customItems.length} 완료</span>
            </div>

            <div id="custom-items" class="space-y-2">
              {customItems.map((item) => {
                const done = doneKeys.has(item.item_key)
                return (
                  <div
                    class={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all checklist-item ${done ? 'bg-green-50 border border-green-100' : 'bg-gray-50 border border-transparent hover:border-gray-200'}`}
                    data-key={item.item_key}
                    data-done={done ? 'true' : 'false'}
                    onclick="toggleItem(this)"
                  >
                    <div class={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${done ? 'bg-green-500 border-green-500' : 'border-gray-300'}`}>
                      {done && <i class="fas fa-check text-white text-xs"></i>}
                    </div>
                    <div class="flex items-center gap-2 flex-1">
                      <i class={`fas fa-star text-xs ${done ? 'text-green-400' : 'text-blue-300'}`}></i>
                      <span class={`text-sm ${done ? 'text-green-700 line-through' : 'text-gray-700'}`}>
                        {item.label}
                      </span>
                    </div>
                    <button
                      onclick="event.stopPropagation(); deleteCustomItem(this)"
                      class="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0 p-1 rounded"
                      title="항목 삭제"
                    >
                      <i class="fas fa-times text-xs"></i>
                    </button>
                  </div>
                )
              })}
            </div>

            {/* 항목 추가 버튼 */}
            <div class="mt-3">
              <button
                id="add-toggle-btn"
                onclick="toggleAddForm()"
                class="flex items-center gap-1.5 text-sm text-blue-500 hover:text-blue-700 font-medium transition-colors"
              >
                <i class="fas fa-plus text-xs"></i>항목 추가
              </button>
              <div id="add-form" class="hidden mt-2 flex gap-2">
                <input
                  id="new-item-input"
                  type="text"
                  placeholder="추가할 항목을 입력하세요 (최대 100자)"
                  maxlength="100"
                  class="flex-1 px-3 py-2 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-gray-50"
                  onkeydown="if(event.key==='Enter') addCustomItem()"
                />
                <button
                  id="add-confirm-btn"
                  onclick="addCustomItem()"
                  class="bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
                >
                  추가
                </button>
                <button
                  onclick="toggleAddForm()"
                  class="text-gray-400 hover:text-gray-600 px-2 py-2 rounded-xl transition-colors"
                >
                  취소
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* 토스트 */}
      <div
        id="toast"
        class="fixed bottom-4 right-4 px-4 py-3 rounded-xl text-sm font-medium shadow-lg z-50 pointer-events-none"
        style="opacity:0; transform:translateY(8px); transition:all 0.3s;"
      ></div>

      <script dangerouslySetInnerHTML={{ __html: `
const SUPABASE_URL = '${c.env.SUPABASE_URL}'
const SUPABASE_ANON_KEY = '${c.env.SUPABASE_ANON_KEY}'
const { createClient } = supabase
const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
const USER_ID = '${userId}'

// ── 고정/커스텀 항목 체크 토글 ──────────────────────
async function toggleItem(el) {
  const key = el.dataset.key
  const currentDone = el.dataset.done === 'true'
  const newDone = !currentDone
  el.dataset.done = newDone ? 'true' : 'false'

  const circle = el.querySelector('.rounded-full')
  const label = el.querySelector('span')
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
  updateProgress()

  await client.from('checklists').upsert({
    user_id: USER_ID,
    item_key: key,
    is_done: newDone,
    done_at: newDone ? new Date().toISOString() : null
  }, { onConflict: 'user_id,item_key' })
}

// ── 진행률 업데이트 ──────────────────────────────────
function updateProgress() {
  const all = document.querySelectorAll('.checklist-item')
  const done = document.querySelectorAll('.checklist-item[data-done="true"]')
  const pct = all.length > 0 ? Math.round((done.length / all.length) * 100) : 0
  document.getElementById('progress-bar').style.width = pct + '%'
  document.getElementById('progress-pct').textContent = pct + '%'
  document.getElementById('progress-count').innerHTML =
    done.length + ' <span class="text-gray-400 text-lg font-normal">/ ' + all.length + '</span>'
  updateCustomCount()
}

// ── 커스텀 카운터 업데이트 ───────────────────────────
function updateCustomCount() {
  const items = document.querySelectorAll('#custom-items .checklist-item')
  const done = document.querySelectorAll('#custom-items .checklist-item[data-done="true"]')
  document.getElementById('custom-count').textContent = done.length + '/' + items.length + ' 완료'
}

// ── 추가 폼 토글 ─────────────────────────────────────
function toggleAddForm() {
  const form = document.getElementById('add-form')
  const input = document.getElementById('new-item-input')
  form.classList.toggle('hidden')
  if (!form.classList.contains('hidden')) input.focus()
  else input.value = ''
}

// ── 커스텀 항목 추가 ─────────────────────────────────
async function addCustomItem() {
  const input = document.getElementById('new-item-input')
  const label = input.value.trim()
  if (!label) { showToast('항목명을 입력해주세요', 'error'); return }

  const btn = document.getElementById('add-confirm-btn')
  btn.disabled = true

  let json
  try {
    const res = await fetch('/api/checklist/custom', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ label })
    })
    json = await res.json()
  } catch {
    showToast('네트워크 오류가 발생했습니다', 'error')
    btn.disabled = false
    return
  }

  if (!json.ok) {
    showToast('항목 추가에 실패했습니다', 'error')
    btn.disabled = false
    return
  }

  const container = document.getElementById('custom-items')
  const div = document.createElement('div')
  div.className = 'flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all checklist-item bg-gray-50 border border-transparent hover:border-gray-200'
  div.dataset.key = json.item_key
  div.dataset.done = 'false'
  div.setAttribute('onclick', 'toggleItem(this)')
  div.innerHTML =
    '<div class="w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all border-gray-300"></div>' +
    '<div class="flex items-center gap-2 flex-1">' +
      '<i class="fas fa-star text-xs text-blue-300"></i>' +
      '<span class="text-sm text-gray-700">' + escapeHtml(json.label) + '</span>' +
    '</div>' +
    '<button onclick="event.stopPropagation(); deleteCustomItem(this)" class="text-gray-300 hover:text-red-400 transition-colors flex-shrink-0 p-1 rounded" title="항목 삭제">' +
      '<i class="fas fa-times text-xs"></i>' +
    '</button>'
  container.appendChild(div)

  updateProgress()
  input.value = ''
  toggleAddForm()
  showToast('항목이 추가되었습니다', 'success')
  btn.disabled = false
}

// ── 커스텀 항목 삭제 ─────────────────────────────────
async function deleteCustomItem(btn) {
  const item = btn.closest('.checklist-item')
  const key = item.dataset.key

  let json
  try {
    const res = await fetch('/api/checklist/custom/' + encodeURIComponent(key), {
      method: 'DELETE'
    })
    json = await res.json()
  } catch {
    showToast('네트워크 오류가 발생했습니다', 'error')
    return
  }

  if (!json.ok) {
    showToast('항목 삭제에 실패했습니다', 'error')
    return
  }

  item.remove()
  updateProgress()
  showToast('항목이 삭제되었습니다', 'success')
}

// ── HTML 이스케이프 (동적 DOM 삽입용) ───────────────
function escapeHtml(s) {
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

// ── 토스트 메시지 ────────────────────────────────────
function showToast(msg, type) {
  const toast = document.getElementById('toast')
  toast.textContent = msg
  toast.className = 'fixed bottom-4 right-4 px-4 py-3 rounded-xl text-sm font-medium shadow-lg z-50 pointer-events-none ' +
    (type === 'error'
      ? 'bg-red-50 text-red-700 border border-red-200'
      : 'bg-green-50 text-green-700 border border-green-200')
  toast.style.opacity = '1'
  toast.style.transform = 'translateY(0)'
  clearTimeout(toast._timer)
  toast._timer = setTimeout(() => {
    toast.style.opacity = '0'
    toast.style.transform = 'translateY(8px)'
  }, 3000)
}
` }} />
    </div>,
    { title: '체크리스트 | BizReady' }
  )
})

export default checklistRoute
