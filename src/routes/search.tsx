import { Hono } from 'hono'
import { renderer } from '../renderer'
import { parseSessionCookie } from '../lib/session'
import { getSupabaseClientWithToken } from '../lib/supabase'
import { Sidebar, MobileMenuButton } from '../lib/sidebar'
import type { Env } from '../lib/supabase'

const searchRoute = new Hono<{ Bindings: Env }>()
searchRoute.use(renderer)

// ── 카테고리 필터 정의 ──────────────────────────────────────
const FILTER_CATEGORIES = [
  { value: '',           label: '전체',       icon: 'fa-th-large',           color: 'gray'   },
  { value: '세무회계',   label: '세무·회계',  icon: 'fa-calculator',         color: 'blue'   },
  { value: '인사노무',   label: '인사·노무',  icon: 'fa-users',              color: 'purple' },
  { value: '총무',       label: '총무·행정',  icon: 'fa-building',           color: 'green'  },
  { value: '세금·신고',  label: '세금·신고',  icon: 'fa-file-invoice-dollar',color: 'orange' },
  { value: '급여관리',   label: '급여관리',   icon: 'fa-money-bill-wave',    color: 'teal'   },
]

// 카테고리 색상 맵
const CAT_COLOR: Record<string, { badge: string; dot: string }> = {
  '세무회계':   { badge: 'bg-blue-100 text-blue-700',   dot: 'bg-blue-500'   },
  '인사노무':   { badge: 'bg-purple-100 text-purple-700', dot: 'bg-purple-500' },
  '총무':       { badge: 'bg-green-100 text-green-700',  dot: 'bg-green-500'  },
  '세금·신고':  { badge: 'bg-orange-100 text-orange-700',dot: 'bg-orange-500' },
  '급여관리':   { badge: 'bg-teal-100 text-teal-700',    dot: 'bg-teal-500'   },
  '회계·세무':  { badge: 'bg-blue-100 text-blue-700',    dot: 'bg-blue-500'   },
  '인사·노무':  { badge: 'bg-purple-100 text-purple-700',dot: 'bg-purple-500' },
  '총무·행정':  { badge: 'bg-green-100 text-green-700',  dot: 'bg-green-500'  },
}

// ── 검색어 하이라이팅 (XSS 방지 + 강조) ────────────────────
function highlight(text: string, q: string): string {
  if (!q || !text) return escapeHtml(text)
  const escaped = escapeHtml(text)
  const escapedQ = escapeRegex(q)
  return escaped.replace(
    new RegExp(escapedQ, 'gi'),
    (m) => `<mark class="hl">${m}</mark>`
  )
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

// 요약문에서 검색어 주변 컨텍스트 추출 (앞뒤 50자)
function excerpt(text: string, q: string): string {
  if (!text) return ''
  const idx = text.toLowerCase().indexOf(q.toLowerCase())
  if (idx === -1) return text.slice(0, 120) + (text.length > 120 ? '…' : '')
  const start = Math.max(0, idx - 40)
  const end   = Math.min(text.length, idx + q.length + 60)
  const slice = text.slice(start, end)
  return (start > 0 ? '…' : '') + slice + (end < text.length ? '…' : '')
}

// ── 추천 검색어 (카테고리별) ────────────────────────────────
const SUGGEST_KEYWORDS: Record<string, string[]> = {
  '':          ['세금계산서', '부가세', '4대보험', '급여계산', '근로계약서', '원천세', '퇴직금', '법인카드', '연말정산', '취업규칙'],
  '세무회계':  ['전표처리', '세금계산서', '부가세', '법인세', '결산', '원천세'],
  '인사노무':  ['4대보험', '급여계산', '근로계약서', '연차계산', '퇴직금', '취업규칙'],
  '총무':      ['법인카드', '비품관리', '공문서', '계약서', '차량관리'],
  '세금·신고': ['부가세', '법인세', '종합소득세', '원천세', '연말정산'],
  '급여관리':  ['급여대장', '퇴직금', '수당계산', '성과급', '급여이체'],
}

searchRoute.get('/', async (c) => {
  const cookie = c.req.header('Cookie') ?? ''
  const sessionStr = parseSessionCookie(cookie)
  if (!sessionStr) return c.redirect('/login?error=unauthorized')

  const q   = (c.req.query('q') ?? '').trim()
  const cat = c.req.query('cat') ?? ''

  let results: any[] = []
  let userName    = '사용자'
  let userInitial = 'U'
  let isPaid      = false

  try {
    let sessionObj: any
    try { sessionObj = JSON.parse(sessionStr) }
    catch { sessionObj = JSON.parse(decodeURIComponent(sessionStr)) }

    const supabase = getSupabaseClientWithToken(c.env, sessionObj.access_token)
    const { data: { user }, error: userErr } = await supabase.auth.getUser()
    if (userErr || !user) return c.redirect('/login?error=session_expired')

    userName    = (user.user_metadata?.full_name as string) || user.email?.split('@')[0] || '사용자'
    userInitial = userName.charAt(0).toUpperCase()
    const { data: profile } = await supabase
      .from('user_profiles').select('is_paid').eq('id', user.id).single()
    isPaid = profile?.is_paid ?? false

    if (q) {
      let query = supabase
        .from('guides')
        .select('id, category, subcategory, title, summary, tags, is_premium, view_count')
        .eq('status', 'published')
        .or(`title.ilike.%${q}%,summary.ilike.%${q}%,tags.cs.{${q}}`)
        .order('view_count', { ascending: false })
        .limit(40)

      if (cat) query = query.eq('category', cat)
      const { data } = await query
      if (data) results = data
    }
  } catch {
    return c.redirect('/login?error=session_expired')
  }

  const suggestKws = SUGGEST_KEYWORDS[cat] ?? SUGGEST_KEYWORDS['']
  const catLabel   = FILTER_CATEGORIES.find(f => f.value === cat)?.label ?? '전체'

  return c.render(
    <div class="flex h-screen overflow-hidden">
      <Sidebar
        userName={userName}
        userInitial={userInitial}
        isPaid={isPaid}
        currentPath="/dashboard/search"
      />

      <main class="flex-1 overflow-y-auto bg-gray-50">

        {/* ── 헤더 + 검색창 ── */}
        <header class="bg-white border-b border-gray-200 px-4 md:px-8 py-4 sticky top-0 z-10 shadow-sm">
          <div class="flex items-center gap-2 mb-3">
            <MobileMenuButton />
            <div>
              <h1 class="text-lg md:text-xl font-bold text-gray-800">
                <i class="fas fa-search text-blue-500 mr-2"></i>업무 검색
              </h1>
              <p class="text-gray-400 text-xs hidden sm:block">가이드·세무·노무·총무 업무 통합 검색</p>
            </div>
          </div>

          {/* 검색 폼 */}
          <form method="GET" action="/dashboard/search" class="flex gap-2 max-w-2xl">
            <input type="hidden" name="cat" value={cat} />
            <div class="relative flex-1">
              <i class="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
              <input
                type="text"
                name="q"
                id="search-input"
                value={q}
                placeholder="키워드로 검색 (예: 부가세, 4대보험, 급여계산)"
                autofocus
                autocomplete="off"
                class="w-full pl-10 pr-10 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-gray-50 focus:bg-white transition-colors"
              />
              {q && (
                <a href={`/dashboard/search?cat=${cat}`}
                   class="absolute right-3 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
                  <i class="fas fa-times text-sm"></i>
                </a>
              )}
            </div>
            <button type="submit"
              class="bg-blue-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-1.5">
              <i class="fas fa-search text-xs"></i>검색
            </button>
          </form>

          {/* ── 카테고리 필터 탭 ── */}
          <div class="flex gap-1.5 mt-3 overflow-x-auto pb-0.5 scrollbar-hide">
            {FILTER_CATEGORIES.map(f => (
              <a
                href={`/dashboard/search?q=${encodeURIComponent(q)}&cat=${f.value}`}
                class={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all border
                  ${cat === f.value
                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-blue-300 hover:text-blue-600'
                  }`}
              >
                <i class={`fas ${f.icon} text-xs`}></i>
                {f.label}
                {cat === f.value && q && results.length > 0 && (
                  <span class="bg-white/30 text-white text-xs px-1 rounded">{results.length}</span>
                )}
              </a>
            ))}
          </div>
        </header>

        <div class="px-4 md:px-8 py-5 max-w-3xl">

          {/* ── 검색 전: 추천 키워드 ── */}
          {!q && (
            <div>
              <div class="mb-6">
                <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                  {cat ? `${catLabel} 자주 찾는 키워드` : '자주 찾는 키워드'}
                </p>
                <div class="flex flex-wrap gap-2">
                  {suggestKws.map(kw => (
                    <a href={`/dashboard/search?q=${encodeURIComponent(kw)}&cat=${cat}`}
                       class="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white border border-gray-200 rounded-full text-sm text-gray-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-all shadow-sm">
                      <i class="fas fa-search text-xs text-gray-300"></i>{kw}
                    </a>
                  ))}
                </div>
              </div>

              {/* 카테고리 바로가기 카드 */}
              <p class="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">카테고리별 빠른 검색</p>
              <div class="grid grid-cols-2 md:grid-cols-3 gap-3">
                {FILTER_CATEGORIES.filter(f => f.value).map(f => (
                  <a href={`/dashboard/search?cat=${f.value}`}
                     class={`bg-white rounded-xl p-4 border border-gray-100 hover:shadow-md transition-all flex items-center gap-3 group`}>
                    <div class={`w-9 h-9 rounded-lg flex items-center justify-center cat-icon-${f.color}`}>
                      <i class={`fas ${f.icon} text-sm`}></i>
                    </div>
                    <span class="font-medium text-gray-700 text-sm group-hover:text-blue-600">{f.label}</span>
                    <i class="fas fa-chevron-right text-gray-200 text-xs ml-auto"></i>
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* ── 검색 결과 ── */}
          {q && (
            <div>
              {/* 결과 헤더 */}
              <div class="flex items-center justify-between mb-4">
                <p class="text-sm text-gray-500">
                  <strong class="text-gray-800">"{q}"</strong>
                  {cat && <span class="ml-1 text-blue-600">· {catLabel}</span>}
                  <span class="ml-2">— 총 <strong class="text-blue-600">{results.length}건</strong></span>
                </p>
                {cat && (
                  <a href={`/dashboard/search?q=${encodeURIComponent(q)}`}
                     class="text-xs text-gray-400 hover:text-blue-500 flex items-center gap-1">
                    <i class="fas fa-times text-xs"></i>필터 해제
                  </a>
                )}
              </div>

              {results.length === 0 ? (
                /* ── 결과 없음 ── */
                <div class="text-center py-12">
                  <div class="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i class="fas fa-search text-2xl text-gray-300"></i>
                  </div>
                  <p class="font-semibold text-gray-600 mb-1">"{q}" 검색 결과가 없어요</p>
                  <p class="text-sm text-gray-400 mb-6">
                    {cat ? `${catLabel} 카테고리에서 찾을 수 없어요. 전체 검색을 시도해보세요.` : '다른 키워드나 유사한 단어로 검색해보세요.'}
                  </p>
                  {cat && (
                    <a href={`/dashboard/search?q=${encodeURIComponent(q)}`}
                       class="inline-flex items-center gap-2 bg-blue-50 text-blue-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors mb-4">
                      <i class="fas fa-globe text-xs"></i>전체 카테고리에서 재검색
                    </a>
                  )}
                  <div class="mt-4">
                    <p class="text-xs text-gray-400 mb-2">이런 키워드는 어떨까요?</p>
                    <div class="flex flex-wrap gap-2 justify-center">
                      {suggestKws.slice(0, 6).map(kw => (
                        <a href={`/dashboard/search?q=${encodeURIComponent(kw)}&cat=${cat}`}
                           class="px-3 py-1.5 bg-white border border-gray-200 rounded-full text-xs text-gray-500 hover:border-blue-400 hover:text-blue-600 transition-colors">
                          {kw}
                        </a>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                /* ── 결과 목록 ── */
                <div class="space-y-3">
                  {results.map((g: any) => {
                    const catStyle = CAT_COLOR[g.category] ?? { badge: 'bg-gray-100 text-gray-600', dot: 'bg-gray-400' }
                    const titleHtml   = highlight(g.title ?? '', q)
                    const summaryText = excerpt(g.summary ?? '', q)
                    const summaryHtml = highlight(summaryText, q)
                    const tags: string[] = Array.isArray(g.tags) ? g.tags : []
                    return (
                      <a href={`/dashboard/guide/${g.id}`}
                         class="bg-white rounded-xl border border-gray-100 p-4 md:p-5 result-card flex items-start gap-4 block hover:border-blue-200 transition-all">
                        {/* 카테고리 도트 */}
                        <div class={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${catStyle.dot}`}></div>
                        <div class="flex-1 min-w-0">
                          {/* 상단: 카테고리 뱃지 + PRO */}
                          <div class="flex items-center gap-2 mb-1.5 flex-wrap">
                            <span class={`text-xs font-medium px-2 py-0.5 rounded-full ${catStyle.badge}`}>
                              {g.category}
                            </span>
                            {g.subcategory && (
                              <span class="text-xs text-gray-400">{g.subcategory}</span>
                            )}
                            {g.is_premium && (
                              <span class="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-bold">PRO</span>
                            )}
                          </div>
                          {/* 제목 (하이라이팅) */}
                          <h3
                            class="font-semibold text-gray-800 text-sm mb-1.5 leading-snug"
                            dangerouslySetInnerHTML={{ __html: titleHtml }}
                          />
                          {/* 요약 (하이라이팅 + 컨텍스트) */}
                          {summaryText && (
                            <p
                              class="text-xs text-gray-500 leading-relaxed mb-2"
                              dangerouslySetInnerHTML={{ __html: summaryHtml }}
                            />
                          )}
                          {/* 태그 */}
                          {tags.length > 0 && (
                            <div class="flex flex-wrap gap-1.5">
                              {tags.slice(0, 4).map((t: string) => (
                                <a
                                  href={`/dashboard/search?q=${encodeURIComponent(t)}&cat=${cat}`}
                                  class="text-xs bg-gray-50 text-gray-400 px-2 py-0.5 rounded border border-gray-100 hover:border-blue-300 hover:text-blue-500 transition-colors"
                                  onclick="event.stopPropagation()"
                                >
                                  #{t}
                                </a>
                              ))}
                            </div>
                          )}
                        </div>
                        <i class="fas fa-chevron-right text-gray-200 text-sm mt-1 flex-shrink-0"></i>
                      </a>
                    )
                  })}
                </div>
              )}
            </div>
          )}

        </div>
      </main>

      <style>{`
        /* 하이라이팅 */
        mark.hl {
          background: #fef08a;
          color: #713f12;
          padding: 0 2px;
          border-radius: 3px;
          font-weight: 600;
        }
        /* 결과 카드 */
        .result-card { transition: all 0.15s; }
        .result-card:hover { box-shadow: 0 4px 16px rgba(0,0,0,0.08); transform: translateY(-1px); }
        /* 카테고리 아이콘 배경 */
        .cat-icon-blue   { background:#dbeafe; color:#2563eb; }
        .cat-icon-purple { background:#ede9fe; color:#7c3aed; }
        .cat-icon-green  { background:#d1fae5; color:#059669; }
        .cat-icon-orange { background:#ffedd5; color:#ea580c; }
        .cat-icon-teal   { background:#ccfbf1; color:#0d9488; }
        .cat-icon-gray   { background:#f3f4f6; color:#6b7280; }
        /* 스크롤바 숨김 */
        .scrollbar-hide::-webkit-scrollbar { display:none; }
        .scrollbar-hide { -ms-overflow-style:none; scrollbar-width:none; }
      `}</style>
    </div>,
    { title: `${q ? `"${q}" 검색결과` : '업무 검색'} | BizReady` }
  )
})

export default searchRoute
