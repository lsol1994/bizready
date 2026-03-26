import { Hono } from 'hono'
import { renderer } from '../renderer'
import { parseSessionCookie } from '../lib/session'
import { getSupabaseClientWithToken, getSupabaseAdmin } from '../lib/supabase'
import { Sidebar, MobileMenuButton } from '../lib/sidebar'
import type { Env } from '../lib/supabase'

const settingsRoute = new Hono<{ Bindings: Env }>()
settingsRoute.use(renderer)

// ── GET /dashboard/settings ─────────────────────────────
settingsRoute.get('/', async (c) => {
  const cookie     = c.req.header('Cookie') ?? ''
  const sessionStr = parseSessionCookie(cookie)
  if (!sessionStr) return c.redirect('/login?error=unauthorized')

  let userName    = '사용자'
  let userInitial = 'U'
  let isPaid      = false
  let userId      = ''

  try {
    let sessionObj: any
    try { sessionObj = JSON.parse(sessionStr) }
    catch { sessionObj = JSON.parse(decodeURIComponent(sessionStr)) }

    const supabase = getSupabaseClientWithToken(c.env, sessionObj.access_token)
    const { data: { user }, error: userErr } = await supabase.auth.getUser()
    if (userErr || !user) return c.redirect('/login?error=session_expired')

    userName    = (user.user_metadata?.full_name as string) || user.email?.split('@')[0] || '사용자'
    userInitial = userName.charAt(0).toUpperCase()
    userId      = user.id

    const { data: profile } = await supabase
      .from('user_profiles').select('is_paid').eq('id', user.id).single()
    isPaid = profile?.is_paid ?? false
  } catch {
    return c.redirect('/login?error=session_expired')
  }

  // user_settings 조회 (없으면 기본값)
  const admin = getSupabaseAdmin(c.env)
  const { data: settings } = await admin
    .from('user_settings')
    .select('*')
    .eq('id', userId)
    .single()

  const s = settings ?? {
    notify_finance: true,
    notify_labor:   true,
    notify_general: true,
    notify_d7:      true,
    notify_d3:      true,
    notify_d1:      true,
    notify_d0:      true,
    dnd_start:      null,
    dnd_end:        null,
    email_reminder: true,
  }

  return c.render(
    <div class="flex h-screen overflow-hidden">
      <Sidebar
        userName={userName}
        userInitial={userInitial}
        isPaid={isPaid}
        currentPath="/dashboard/settings"
      />

      <main class="flex-1 overflow-y-auto bg-gray-50">
        <header class="bg-white border-b border-gray-200 px-4 md:px-8 py-4 flex items-center gap-2 sticky top-0 z-10 shadow-sm">
          <MobileMenuButton />
          <div>
            <h1 class="text-lg md:text-xl font-bold text-gray-800">
              <i class="fas fa-bell text-blue-500 mr-2"></i>알림 설정
            </h1>
            <p class="text-gray-500 text-xs mt-0.5 hidden sm:block">이메일 리마인더 수신 조건을 맞춤 설정하세요</p>
          </div>
        </header>

        <div class="px-4 md:px-8 py-6 max-w-2xl mx-auto space-y-5">

          {/* 전체 이메일 알림 ON/OFF */}
          <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div class="flex items-center justify-between">
              <div>
                <h2 class="font-bold text-gray-800 text-sm flex items-center gap-2">
                  <i class="fas fa-envelope text-blue-500"></i>이메일 리마인더
                </h2>
                <p class="text-xs text-gray-500 mt-0.5">D-7/3/1/0 일정 이메일 알림을 전체적으로 켜거나 끕니다.</p>
              </div>
              <label class="relative inline-flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  id="email_reminder"
                  checked={s.email_reminder !== false}
                  class="sr-only peer"
                  onchange="toggleReminder(this)"
                />
                <div class="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>

          {/* 카테고리별 알림 */}
          <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 class="font-bold text-gray-800 text-sm mb-3 flex items-center gap-2">
              <i class="fas fa-tags text-purple-500"></i>카테고리별 알림
            </h2>
            <p class="text-xs text-gray-500 mb-4">특정 업무 분류의 알림만 받을 수 있습니다.</p>
            <div class="space-y-3">
              {[
                { key: 'notify_finance', label: '재무·회계·세금', icon: 'fa-calculator', color: 'text-red-500', desc: '세금 신고, 납부 일정 알림', checked: s.notify_finance !== false },
                { key: 'notify_labor',   label: '노무·4대보험',   icon: 'fa-users',       color: 'text-yellow-600', desc: '4대보험, 급여, 연말정산 알림', checked: s.notify_labor !== false },
                { key: 'notify_general', label: '총무·행정·비품', icon: 'fa-building',    color: 'text-blue-500', desc: '사내 행사, 비품 구매 등 알림', checked: s.notify_general !== false },
              ].map(item => (
                <div class="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                  <div class="flex items-center gap-3">
                    <div class={`w-8 h-8 rounded-lg bg-gray-50 flex items-center justify-center`}>
                      <i class={`fas ${item.icon} ${item.color} text-sm`}></i>
                    </div>
                    <div>
                      <div class="text-sm font-medium text-gray-800">{item.label}</div>
                      <div class="text-xs text-gray-500">{item.desc}</div>
                    </div>
                  </div>
                  <label class="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      id={item.key}
                      checked={item.checked}
                      class="sr-only peer"
                      onchange={`saveSetting('${item.key}', this.checked)`}
                    />
                    <div class="w-9 h-5 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>
              ))}
            </div>
          </div>

          {/* D-day 알림 시점 */}
          <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 class="font-bold text-gray-800 text-sm mb-3 flex items-center gap-2">
              <i class="fas fa-clock text-amber-500"></i>알림 시점 (D-day)
            </h2>
            <p class="text-xs text-gray-500 mb-4">이메일을 받을 D-day 시점을 선택하세요. 여러 개 선택 가능합니다.</p>
            <div class="grid grid-cols-2 gap-3">
              {[
                { key: 'notify_d7', label: 'D-7', desc: '7일 전', checked: s.notify_d7 !== false, color: 'blue' },
                { key: 'notify_d3', label: 'D-3', desc: '3일 전', checked: s.notify_d3 !== false, color: 'amber' },
                { key: 'notify_d1', label: 'D-1', desc: '하루 전', checked: s.notify_d1 !== false, color: 'orange' },
                { key: 'notify_d0', label: 'D-0', desc: '당일', checked: s.notify_d0 !== false, color: 'red' },
              ].map(item => (
                <label class="relative flex items-center gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors has-[:checked]:border-blue-400 has-[:checked]:bg-blue-50">
                  <input
                    type="checkbox"
                    id={item.key}
                    checked={item.checked}
                    class="w-4 h-4 text-blue-600 rounded"
                    onchange={`saveSetting('${item.key}', this.checked)`}
                  />
                  <div>
                    <div class="text-sm font-bold text-gray-800">{item.label}</div>
                    <div class="text-xs text-gray-500">{item.desc}</div>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* 수신 거부 기간 */}
          <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h2 class="font-bold text-gray-800 text-sm mb-1 flex items-center gap-2">
              <i class="fas fa-moon text-indigo-500"></i>알림 일시 중단 (수신 거부 기간)
            </h2>
            <p class="text-xs text-gray-500 mb-4">설정한 기간 동안 모든 이메일 알림이 발송되지 않습니다. (예: 휴가, 출장 기간)</p>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">시작일</label>
                <input
                  type="date"
                  id="dnd_start"
                  value={s.dnd_start ?? ''}
                  class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onchange="saveDnd()"
                />
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">종료일</label>
                <input
                  type="date"
                  id="dnd_end"
                  value={s.dnd_end ?? ''}
                  class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  onchange="saveDnd()"
                />
              </div>
            </div>
            <button
              onclick="clearDnd()"
              class="mt-3 text-xs text-gray-400 hover:text-red-500 flex items-center gap-1 transition-colors"
            >
              <i class="fas fa-times-circle"></i>수신 거부 기간 초기화
            </button>
          </div>

          {/* 저장 상태 토스트 */}
          <div id="toast" class="fixed bottom-6 right-6 bg-gray-900 text-white text-sm px-4 py-2.5 rounded-xl shadow-lg opacity-0 translate-y-2 transition-all duration-300 pointer-events-none z-50 flex items-center gap-2">
            <i id="toast-icon" class="fas fa-check-circle text-green-400"></i>
            <span id="toast-msg">설정 저장됨</span>
          </div>

          {/* 이메일 테스트 버튼 */}
          <div class="bg-blue-50 border border-blue-100 rounded-2xl p-4 flex items-center justify-between">
            <div>
              <div class="text-sm font-medium text-blue-800">테스트 이메일 발송</div>
              <div class="text-xs text-blue-600 mt-0.5">현재 설정으로 샘플 이메일을 내 주소로 발송합니다.</div>
            </div>
            <button
              onclick="sendTestEmail()"
              id="test-email-btn"
              class="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <i class="fas fa-paper-plane"></i>테스트 발송
            </button>
          </div>

        </div>
      </main>

      <script dangerouslySetInnerHTML={{ __html: `
// ── 설정 저장 (단일 키) ─────────────────────────
async function saveSetting(key, value) {
  try {
    const res = await fetch('/dashboard/settings/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, value })
    });
    const data = await res.json();
    showToast(data.ok ? '✓ 저장됨' : '저장 실패: ' + data.error, data.ok);
  } catch(e) {
    showToast('네트워크 오류', false);
  }
}

// 전체 이메일 토글
function toggleReminder(el) {
  saveSetting('email_reminder', el.checked);
}

// 수신 거부 기간 저장
async function saveDnd() {
  const start = document.getElementById('dnd_start').value || null;
  const end   = document.getElementById('dnd_end').value   || null;
  try {
    const res = await fetch('/dashboard/settings/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'dnd', value: { dnd_start: start, dnd_end: end } })
    });
    const data = await res.json();
    showToast(data.ok ? '✓ 수신 거부 기간 저장됨' : '저장 실패', data.ok);
  } catch(e) {
    showToast('네트워크 오류', false);
  }
}

function clearDnd() {
  document.getElementById('dnd_start').value = '';
  document.getElementById('dnd_end').value   = '';
  saveDnd();
}

// 테스트 이메일 발송
async function sendTestEmail() {
  const btn = document.getElementById('test-email-btn');
  btn.disabled = true;
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 발송 중...';
  try {
    const res  = await fetch('/api/reminder/test', { method: 'POST' });
    // /api/reminder/test 는 index.tsx에서 /api/reminder/* 라우트로 처리됨
    const data = await res.json();
    showToast(data.ok ? '✓ 테스트 이메일 발송됨' : '발송 실패: ' + data.error, data.ok);
  } catch(e) {
    showToast('네트워크 오류', false);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fas fa-paper-plane"></i>테스트 발송';
  }
}

// ── 토스트 알림 ─────────────────────────────────
function showToast(msg, ok = true) {
  const toast = document.getElementById('toast');
  const icon  = document.getElementById('toast-icon');
  const msgEl = document.getElementById('toast-msg');
  icon.className = ok ? 'fas fa-check-circle text-green-400' : 'fas fa-times-circle text-red-400';
  msgEl.textContent = msg;
  toast.style.opacity  = '1';
  toast.style.transform = 'translateY(0)';
  setTimeout(() => {
    toast.style.opacity  = '0';
    toast.style.transform = 'translateY(8px)';
  }, 2500);
}
      `}} />
    </div>,
    { title: '알림 설정 | BizReady' }
  )
})

// ── POST /api/settings — 설정 저장 ─────────────────────────
settingsRoute.post('/api/settings', async (c) => {
  const cookie     = c.req.header('Cookie') ?? ''
  const sessionStr = parseSessionCookie(cookie)
  if (!sessionStr) return c.json({ ok: false, error: 'unauthorized' }, 401)

  try {
    let sessionObj: any
    try { sessionObj = JSON.parse(sessionStr) }
    catch { sessionObj = JSON.parse(decodeURIComponent(sessionStr)) }

    const supabase = getSupabaseClientWithToken(c.env, sessionObj.access_token)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return c.json({ ok: false, error: 'unauthorized' }, 401)

    const body = await c.req.json<{ key: string; value: any }>()
    const admin = getSupabaseAdmin(c.env)

    // 현재 설정 있는지 확인
    const { data: existing } = await admin
      .from('user_settings').select('id').eq('id', user.id).single()

    let updateData: Record<string, any> = {}

    if (body.key === 'dnd') {
      updateData = {
        dnd_start: body.value?.dnd_start ?? null,
        dnd_end:   body.value?.dnd_end   ?? null,
        updated_at: new Date().toISOString(),
      }
    } else {
      const ALLOWED_KEYS = [
        'notify_finance', 'notify_labor', 'notify_general',
        'notify_d7', 'notify_d3', 'notify_d1', 'notify_d0',
        'email_reminder'
      ]
      if (!ALLOWED_KEYS.includes(body.key)) {
        return c.json({ ok: false, error: 'invalid key' }, 400)
      }
      updateData = { [body.key]: body.value, updated_at: new Date().toISOString() }
    }

    if (existing) {
      const { error } = await admin
        .from('user_settings').update(updateData).eq('id', user.id)
      if (error) return c.json({ ok: false, error: error.message }, 500)
    } else {
      const { error } = await admin
        .from('user_settings').insert({ id: user.id, ...updateData })
      if (error) return c.json({ ok: false, error: error.message }, 500)
    }

    return c.json({ ok: true })
  } catch (e: any) {
    return c.json({ ok: false, error: e.message }, 500)
  }
})

export default settingsRoute
