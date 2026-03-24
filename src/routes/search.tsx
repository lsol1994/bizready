import { Hono } from 'hono'
import { renderer } from '../renderer'
import { parseSessionCookie } from '../lib/session'
import { getSupabaseClientWithToken } from '../lib/supabase'
import { Sidebar } from '../lib/sidebar'
import type { Env } from '../lib/supabase'

const searchRoute = new Hono<{ Bindings: Env }>()
searchRoute.use(renderer)

searchRoute.get('/', async (c) => {
  const cookie = c.req.header('Cookie') ?? ''
  const sessionStr = parseSessionCookie(cookie)
  if (!sessionStr) return c.redirect('/login?error=unauthorized')

  const q = c.req.query('q') ?? ''
  let results: any[] = []
  let userName = '사용자'
  let userInitial = 'U'

  try {
    const sessionObj = JSON.parse(decodeURIComponent(sessionStr))
    const supabase = getSupabaseClientWithToken(c.env, sessionObj.access_token)

    const { data: { user }, error: userErr } = await supabase.auth.getUser()
    if (userErr || !user) return c.redirect('/login?error=session_expired')

    userName = (user.user_metadata?.full_name as string) || user.email?.split('@')[0] || '사용자'
    userInitial = userName.charAt(0).toUpperCase()

    if (q.trim()) {
      const { data } = await supabase
        .from('guides')
        .select('id, category, title, summary, tags, is_premium')
        .or(`title.ilike.%${q}%,summary.ilike.%${q}%,content.ilike.%${q}%`)
        .order('view_count', { ascending: false })
        .limit(30)
      if (data) results = data
    }
  } catch {
    return c.redirect('/login?error=session_expired')
  }

  return c.render(
    <div class="flex h-screen overflow-hidden">
      <Sidebar
        userName={userName}
        userInitial={userInitial}
        isPaid={false}
        currentPath="/dashboard/search"
      />

      <main class="flex-1 overflow-y-auto bg-gray-50">
        <header class="bg-white border-b border-gray-200 px-8 py-4 sticky top-0 z-10">
          <h1 class="text-xl font-bold text-gray-800 mb-3">지식 검색</h1>
          <form method="GET" action="/dashboard/search" class="flex gap-3">
            <div class="relative flex-1 max-w-xl">
              <i class="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-gray-400"></i>
              <input
                type="text"
                name="q"
                value={q}
                placeholder="키워드를 입력하세요 (예: 부가세, 4대보험, 급여계산)"
                autofocus
                class="w-full pl-11 pr-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <button type="submit" class="bg-blue-600 text-white px-6 py-3 rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors">
              검색
            </button>
          </form>
        </header>

        <div class="px-8 py-6 max-w-3xl">
          {/* 추천 검색어 */}
          {!q && (
            <div class="mb-8">
              <p class="text-sm text-gray-500 mb-3 font-medium">자주 찾는 키워드</p>
              <div class="flex flex-wrap gap-2">
                {['세금계산서', '부가세', '4대보험', '급여계산', '근로계약서', '원천세', '퇴직금', '법인카드', '연말정산', '취업규칙'].map(kw => (
                  <a href={`/dashboard/search?q=${encodeURIComponent(kw)}`}
                     class="px-3 py-1.5 bg-white border border-gray-200 rounded-full text-sm text-gray-600 hover:border-blue-400 hover:text-blue-600 transition-colors">
                    🔍 {kw}
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* 검색 결과 */}
          {q && (
            <div>
              <p class="text-sm text-gray-500 mb-4">
                <strong class="text-gray-800">"{q}"</strong> 검색 결과 — {results.length}건
              </p>
              {results.length === 0 ? (
                <div class="text-center py-16 text-gray-400">
                  <i class="fas fa-search text-4xl mb-4 block opacity-30"></i>
                  <p class="font-medium">검색 결과가 없습니다</p>
                  <p class="text-sm mt-1">다른 키워드로 다시 검색해보세요</p>
                </div>
              ) : (
                <div class="space-y-3">
                  {results.map((g: any) => (
                    <a href={`/dashboard/guide/${g.id}`}
                       class="bg-white rounded-xl border border-gray-100 p-5 card-hover flex items-start gap-4 block">
                      <div class="flex-1">
                        <div class="flex items-center gap-2 mb-1">
                          <span class="text-xs text-gray-400">{g.category}</span>
                          {g.is_premium && (
                            <span class="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded font-bold">PRO</span>
                          )}
                        </div>
                        <h3 class="font-semibold text-gray-800 text-sm mb-1"
                            dangerouslySetInnerHTML={{ __html: g.title.replace(new RegExp(q, 'gi'), `<mark class="bg-yellow-100 text-yellow-900 px-0.5 rounded">${q}</mark>`) }}
                        />
                        <p class="text-xs text-gray-500 line-clamp-2">{g.summary}</p>
                        <div class="flex gap-2 mt-2">
                          {(g.tags as string[]).slice(0, 3).map((t: string) => (
                            <span class="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded">#{t}</span>
                          ))}
                        </div>
                      </div>
                      <i class="fas fa-chevron-right text-gray-300 text-sm mt-1 flex-shrink-0"></i>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>,
    { title: '지식 검색 | BizReady' }
  )
})

export default searchRoute
