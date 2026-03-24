import { Hono } from 'hono'
import { renderer } from '../renderer'
import { parseSessionCookie } from '../lib/session'
import { getSupabaseClientWithToken } from '../lib/supabase'
import { Sidebar } from '../lib/sidebar'
import type { Env } from '../lib/supabase'

const memoRoute = new Hono<{ Bindings: Env }>()
memoRoute.use(renderer)

// ── GET /dashboard/memo ─────────────────────────────────
memoRoute.get('/', async (c) => {
  const cookie = c.req.header('Cookie') ?? ''
  const sessionStr = parseSessionCookie(cookie)
  if (!sessionStr) return c.redirect('/login?error=unauthorized')

  let memos: any[] = []
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

    // 내 메모 조회 (최신순)
    const { data: memoData } = await supabase
      .from('user_notes')
      .select('id, title, content, color, tags, created_at, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
    if (memoData) memos = memoData
  } catch {
    return c.redirect('/login?error=session_expired')
  }

  const SUPABASE_URL = c.env.SUPABASE_URL
  const SUPABASE_ANON_KEY = c.env.SUPABASE_ANON_KEY

  return c.render(
    <div class="flex h-screen overflow-hidden">
      <Sidebar
        userName={userName}
        userInitial={userInitial}
        isPaid={isPaid}
        currentPath="/dashboard/memo"
      />

      <main class="flex-1 overflow-y-auto bg-gray-50">
        {/* 헤더 */}
        <header class="bg-white border-b border-gray-200 px-8 py-4 sticky top-0 z-10 flex items-center justify-between">
          <div>
            <h1 class="text-xl font-bold text-gray-800">
              <i class="fas fa-sticky-note text-yellow-500 mr-2"></i>내 메모
            </h1>
            <p class="text-gray-500 text-sm">나만의 업무 메모를 자유롭게 기록하세요</p>
          </div>
          <button
            onclick="openMemoModal()"
            class="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
          >
            <i class="fas fa-plus"></i>새 메모
          </button>
        </header>

        <div class="px-8 py-6 max-w-5xl">
          {/* 메모 통계 */}
          <div class="grid grid-cols-3 gap-4 mb-6">
            <div class="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
              <div class="w-10 h-10 bg-yellow-50 rounded-lg flex items-center justify-center">
                <i class="fas fa-sticky-note text-yellow-500"></i>
              </div>
              <div>
                <div class="text-2xl font-bold text-gray-800" id="memo-count">{memos.length}</div>
                <div class="text-xs text-gray-500">총 메모</div>
              </div>
            </div>
            <div class="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
              <div class="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                <i class="fas fa-clock text-blue-500"></i>
              </div>
              <div>
                <div class="text-sm font-bold text-gray-800" id="last-updated">
                  {memos.length > 0 ? '최근 수정됨' : '아직 없음'}
                </div>
                <div class="text-xs text-gray-500">최근 메모</div>
              </div>
            </div>
            <div class="bg-white rounded-xl border border-gray-100 p-4 flex items-center gap-3">
              <div class="w-10 h-10 bg-green-50 rounded-lg flex items-center justify-center">
                <i class="fas fa-search text-green-500"></i>
              </div>
              <div class="flex-1">
                <input
                  type="text"
                  id="memo-search"
                  placeholder="메모 검색..."
                  class="text-sm text-gray-700 bg-transparent outline-none w-full"
                  oninput="filterMemos(this.value)"
                />
                <div class="text-xs text-gray-500">검색</div>
              </div>
            </div>
          </div>

          {/* 메모 그리드 */}
          <div id="memo-grid" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {memos.length === 0 ? (
              <div class="col-span-3 text-center py-20 text-gray-400" id="empty-state">
                <i class="fas fa-sticky-note text-5xl mb-4 block opacity-20"></i>
                <p class="font-medium text-gray-500">아직 메모가 없습니다</p>
                <p class="text-sm mt-1">오른쪽 상단의 '새 메모' 버튼을 클릭해보세요</p>
              </div>
            ) : (
              memos.map((memo: any) => {
                const colorMap: Record<string, string> = {
                  yellow: 'bg-yellow-50 border-yellow-200',
                  blue:   'bg-blue-50 border-blue-200',
                  green:  'bg-green-50 border-green-200',
                  purple: 'bg-purple-50 border-purple-200',
                  pink:   'bg-pink-50 border-pink-200',
                  gray:   'bg-gray-50 border-gray-200',
                }
                const dotMap: Record<string, string> = {
                  yellow: 'bg-yellow-400',
                  blue:   'bg-blue-400',
                  green:  'bg-green-400',
                  purple: 'bg-purple-400',
                  pink:   'bg-pink-400',
                  gray:   'bg-gray-400',
                }
                const cardClass = colorMap[memo.color] || colorMap['yellow']
                const dotClass  = dotMap[memo.color]   || dotMap['yellow']
                const date = new Date(memo.updated_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
                const tags: string[] = Array.isArray(memo.tags) ? memo.tags : (memo.tags ? JSON.parse(memo.tags) : [])

                return (
                  <div
                    class={`memo-card rounded-2xl border-2 p-4 cursor-pointer hover:shadow-md transition-all ${cardClass}`}
                    data-id={memo.id}
                    data-title={memo.title || ''}
                    data-content={memo.content || ''}
                    data-color={memo.color || 'yellow'}
                    data-tags={JSON.stringify(tags)}
                    onclick="openEditMemo(this)"
                  >
                    <div class="flex items-start justify-between mb-2">
                      <div class="flex items-center gap-2 flex-1 min-w-0">
                        <div class={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${dotClass}`}></div>
                        <h3 class="font-semibold text-gray-800 text-sm truncate">{memo.title || '제목 없음'}</h3>
                      </div>
                      <button
                        class="text-gray-400 hover:text-red-500 transition-colors ml-2 flex-shrink-0"
                        onclick={`event.stopPropagation(); deleteMemo('${memo.id}')`}
                        title="삭제"
                      >
                        <i class="fas fa-times text-xs"></i>
                      </button>
                    </div>
                    <p class="text-xs text-gray-600 line-clamp-4 mb-3 leading-relaxed whitespace-pre-wrap">{memo.content || ''}</p>
                    {tags.length > 0 && (
                      <div class="flex flex-wrap gap-1 mb-2">
                        {tags.slice(0, 3).map((tag: string) => (
                          <span class="text-xs bg-white/60 text-gray-500 px-1.5 py-0.5 rounded-full">#{tag}</span>
                        ))}
                      </div>
                    )}
                    <p class="text-xs text-gray-400 text-right">{date}</p>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </main>

      {/* ── 메모 추가/수정 모달 ── */}
      <div id="memo-modal" class="fixed inset-0 z-50 hidden">
        <div class="absolute inset-0 bg-black/50 backdrop-blur-sm" onclick="closeMemoModal()"></div>
        <div class="absolute inset-0 flex items-center justify-center p-4">
          <div class="bg-white rounded-2xl shadow-2xl w-full max-w-lg p-6 relative" onclick="event.stopPropagation()">
            <div class="flex items-center justify-between mb-5">
              <h2 class="text-lg font-bold text-gray-800" id="modal-title">새 메모</h2>
              <button onclick="closeMemoModal()" class="text-gray-400 hover:text-gray-600 transition-colors">
                <i class="fas fa-times text-lg"></i>
              </button>
            </div>

            <input type="hidden" id="edit-memo-id" value="" />

            {/* 메모 색상 선택 */}
            <div class="mb-4">
              <label class="text-xs text-gray-500 font-medium mb-2 block">메모 색상</label>
              <div class="flex gap-2">
                {['yellow', 'blue', 'green', 'purple', 'pink', 'gray'].map(color => {
                  const bgMap: Record<string, string> = {
                    yellow: 'bg-yellow-400', blue: 'bg-blue-400', green: 'bg-green-400',
                    purple: 'bg-purple-400', pink: 'bg-pink-400', gray: 'bg-gray-400'
                  }
                  return (
                    <button
                      class={`color-btn w-7 h-7 rounded-full ${bgMap[color]} border-2 border-transparent hover:border-gray-400 transition-all`}
                      data-color={color}
                      onclick={`selectColor('${color}')`}
                      title={color}
                    ></button>
                  )
                })}
              </div>
              <input type="hidden" id="memo-color" value="yellow" />
            </div>

            {/* 제목 */}
            <div class="mb-4">
              <label class="text-xs text-gray-500 font-medium mb-1.5 block">제목</label>
              <input
                type="text"
                id="memo-title"
                placeholder="메모 제목 (선택)"
                class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* 내용 */}
            <div class="mb-4">
              <label class="text-xs text-gray-500 font-medium mb-1.5 block">내용</label>
              <textarea
                id="memo-content"
                rows={6}
                placeholder="메모 내용을 입력하세요..."
                class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              ></textarea>
            </div>

            {/* 태그 */}
            <div class="mb-5">
              <label class="text-xs text-gray-500 font-medium mb-1.5 block">태그 (쉼표로 구분)</label>
              <input
                type="text"
                id="memo-tags"
                placeholder="예: 부가세, 신고, 4월"
                class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* 에러 메시지 */}
            <div id="memo-error" class="hidden mb-3 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm"></div>

            {/* 버튼 */}
            <div class="flex gap-3">
              <button
                onclick="closeMemoModal()"
                class="flex-1 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                취소
              </button>
              <button
                onclick="saveMemo()"
                class="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors flex items-center justify-center gap-2"
                id="save-btn"
              >
                <i class="fas fa-save"></i>저장
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .line-clamp-4 {
          display: -webkit-box;
          -webkit-line-clamp: 4;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
        .memo-card { transition: all 0.15s ease; }
        .color-btn.selected { border-color: #374151 !important; transform: scale(1.15); }
      `}</style>

      <script dangerouslySetInnerHTML={{ __html: `
const SUPABASE_URL = '${SUPABASE_URL}'
const SUPABASE_ANON_KEY = '${SUPABASE_ANON_KEY}'
const { createClient } = supabase
const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
const USER_ID = '${userId}'

// ── 색상 선택 ──────────────────────────
function selectColor(color) {
  document.getElementById('memo-color').value = color
  document.querySelectorAll('.color-btn').forEach(btn => {
    btn.classList.toggle('selected', btn.dataset.color === color)
  })
}

// ── 모달 열기 (새 메모) ──────────────────
function openMemoModal() {
  document.getElementById('edit-memo-id').value = ''
  document.getElementById('memo-title').value = ''
  document.getElementById('memo-content').value = ''
  document.getElementById('memo-tags').value = ''
  document.getElementById('modal-title').textContent = '새 메모'
  document.getElementById('memo-error').classList.add('hidden')
  selectColor('yellow')
  document.getElementById('memo-modal').classList.remove('hidden')
  setTimeout(() => document.getElementById('memo-title').focus(), 100)
}

// ── 모달 열기 (수정) ──────────────────
function openEditMemo(el) {
  const id      = el.dataset.id
  const title   = el.dataset.title
  const content = el.dataset.content
  const color   = el.dataset.color   || 'yellow'
  const tags    = JSON.parse(el.dataset.tags || '[]')

  document.getElementById('edit-memo-id').value   = id
  document.getElementById('memo-title').value     = title
  document.getElementById('memo-content').value   = content
  document.getElementById('memo-tags').value      = tags.join(', ')
  document.getElementById('modal-title').textContent = '메모 수정'
  document.getElementById('memo-error').classList.add('hidden')
  selectColor(color)
  document.getElementById('memo-modal').classList.remove('hidden')
  setTimeout(() => document.getElementById('memo-content').focus(), 100)
}

// ── 모달 닫기 ──────────────────────────
function closeMemoModal() {
  document.getElementById('memo-modal').classList.add('hidden')
}

// ── 메모 저장 (Create / Update) ──────────
async function saveMemo() {
  const id      = document.getElementById('edit-memo-id').value
  const title   = document.getElementById('memo-title').value.trim()
  const content = document.getElementById('memo-content').value.trim()
  const color   = document.getElementById('memo-color').value || 'yellow'
  const tagsRaw = document.getElementById('memo-tags').value
  const tags    = tagsRaw ? tagsRaw.split(',').map(t => t.trim()).filter(Boolean) : []

  if (!content) {
    const err = document.getElementById('memo-error')
    err.textContent = '내용을 입력해주세요.'
    err.classList.remove('hidden')
    return
  }

  const btn = document.getElementById('save-btn')
  btn.disabled = true
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>저장 중...'

  let error = null
  let data   = null
  const now  = new Date().toISOString()

  if (id) {
    // 수정
    const res = await client
      .from('user_notes')
      .update({ title, content, color, tags, updated_at: now })
      .eq('id', id)
      .eq('user_id', USER_ID)
      .select()
    error = res.error
    data  = res.data?.[0]
  } else {
    // 신규
    const res = await client
      .from('user_notes')
      .insert({ user_id: USER_ID, title, content, color, tags, created_at: now, updated_at: now })
      .select()
    error = res.error
    data  = res.data?.[0]
  }

  btn.disabled = false
  btn.innerHTML = '<i class="fas fa-save"></i>저장'

  if (error) {
    const errEl = document.getElementById('memo-error')
    errEl.textContent = '저장 실패: ' + error.message
    errEl.classList.remove('hidden')
    return
  }

  closeMemoModal()
  renderMemoCard(data, !!id)
  updateMemoCount()
}

// ── 메모 삭제 ──────────────────────────
async function deleteMemo(id) {
  if (!confirm('이 메모를 삭제할까요?')) return

  const { error } = await client
    .from('user_notes')
    .delete()
    .eq('id', id)
    .eq('user_id', USER_ID)

  if (error) { alert('삭제 실패: ' + error.message); return }

  const el = document.querySelector('.memo-card[data-id="' + id + '"]')
  if (el) {
    el.style.opacity = '0'
    el.style.transform = 'scale(0.9)'
    setTimeout(() => { el.remove(); updateMemoCount() }, 200)
  }
}

// ── 카드 렌더링 (동적 추가/수정) ────────
const COLOR_BG  = { yellow:'bg-yellow-50 border-yellow-200', blue:'bg-blue-50 border-blue-200', green:'bg-green-50 border-green-200', purple:'bg-purple-50 border-purple-200', pink:'bg-pink-50 border-pink-200', gray:'bg-gray-50 border-gray-200' }
const COLOR_DOT = { yellow:'bg-yellow-400', blue:'bg-blue-400', green:'bg-green-400', purple:'bg-purple-400', pink:'bg-pink-400', gray:'bg-gray-400' }

function renderMemoCard(memo, isEdit) {
  const grid    = document.getElementById('memo-grid')
  const empty   = document.getElementById('empty-state')
  if (empty) empty.remove()

  const tags    = Array.isArray(memo.tags) ? memo.tags : []
  const date    = new Date(memo.updated_at).toLocaleDateString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })
  const bgCls   = COLOR_BG[memo.color]  || COLOR_BG['yellow']
  const dotCls  = COLOR_DOT[memo.color] || COLOR_DOT['yellow']

  const tagsHtml = tags.slice(0, 3).map(t => '<span class="text-xs bg-white/60 text-gray-500 px-1.5 py-0.5 rounded-full">#' + t + '</span>').join('')

  const card = document.createElement('div')
  card.className = 'memo-card rounded-2xl border-2 p-4 cursor-pointer hover:shadow-md transition-all ' + bgCls
  card.dataset.id      = memo.id
  card.dataset.title   = memo.title || ''
  card.dataset.content = memo.content || ''
  card.dataset.color   = memo.color || 'yellow'
  card.dataset.tags    = JSON.stringify(tags)
  card.setAttribute('onclick', 'openEditMemo(this)')
  card.innerHTML = \`
    <div class="flex items-start justify-between mb-2">
      <div class="flex items-center gap-2 flex-1 min-w-0">
        <div class="w-2.5 h-2.5 rounded-full flex-shrink-0 \${dotCls}"></div>
        <h3 class="font-semibold text-gray-800 text-sm truncate">\${memo.title || '제목 없음'}</h3>
      </div>
      <button class="text-gray-400 hover:text-red-500 transition-colors ml-2 flex-shrink-0"
        onclick="event.stopPropagation(); deleteMemo('\${memo.id}')" title="삭제">
        <i class="fas fa-times text-xs"></i>
      </button>
    </div>
    <p class="text-xs text-gray-600 line-clamp-4 mb-3 leading-relaxed whitespace-pre-wrap">\${(memo.content||'').replace(/</g,'&lt;')}</p>
    \${tags.length > 0 ? '<div class="flex flex-wrap gap-1 mb-2">' + tagsHtml + '</div>' : ''}
    <p class="text-xs text-gray-400 text-right">\${date}</p>
  \`

  if (isEdit) {
    const existing = document.querySelector('.memo-card[data-id="' + memo.id + '"]')
    if (existing) {
      existing.replaceWith(card)
      return
    }
  }
  // 새 메모는 맨 앞에 추가
  grid.insertBefore(card, grid.firstChild)
}

// ── 메모 개수 업데이트 ─────────────────
function updateMemoCount() {
  const count = document.querySelectorAll('.memo-card').length
  const el = document.getElementById('memo-count')
  if (el) el.textContent = count
}

// ── 메모 검색 필터 ────────────────────
function filterMemos(query) {
  const q = query.toLowerCase().trim()
  document.querySelectorAll('.memo-card').forEach(card => {
    const title   = (card.dataset.title   || '').toLowerCase()
    const content = (card.dataset.content || '').toLowerCase()
    const tags    = JSON.parse(card.dataset.tags || '[]').join(' ').toLowerCase()
    const match   = !q || title.includes(q) || content.includes(q) || tags.includes(q)
    card.style.display = match ? '' : 'none'
  })
}

// ── ESC 키로 모달 닫기 ─────────────────
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeMemoModal()
})

// 초기 색상 선택 표시
selectColor('yellow')
      ` }} />
    </div>,
    { title: '내 메모 | BizReady' }
  )
})

// ── API: 메모 목록 조회 ─────────────────────────────────
memoRoute.get('/api', async (c) => {
  const cookie = c.req.header('Cookie') ?? ''
  const sessionStr = parseSessionCookie(cookie)
  if (!sessionStr) return c.json({ error: 'unauthorized' }, 401)

  try {
    const sessionObj = JSON.parse(decodeURIComponent(sessionStr))
    const supabase = getSupabaseClientWithToken(c.env, sessionObj.access_token)
    const { data: { user }, error: userErr } = await supabase.auth.getUser()
    if (userErr || !user) return c.json({ error: 'unauthorized' }, 401)

    const { data, error } = await supabase
      .from('user_notes')
      .select('id, title, content, color, tags, created_at, updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false })
    if (error) return c.json({ error: error.message }, 500)
    return c.json({ memos: data })
  } catch {
    return c.json({ error: 'server_error' }, 500)
  }
})

export default memoRoute
