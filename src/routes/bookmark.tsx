import { Hono } from 'hono'
import { renderer } from '../renderer'
import { parseSessionCookie } from '../lib/session'
import { getSupabaseClientWithToken, getSupabaseAdmin } from '../lib/supabase'
import { Sidebar, MobileMenuButton } from '../lib/sidebar'
import type { Env } from '../lib/supabase'

const bookmarkRoute = new Hono<{ Bindings: Env }>()
bookmarkRoute.use(renderer)

// ── 카테고리 색상 ─────────────────────────────────────────────
const CAT_COLOR: Record<string, string> = {
  '세무회계':      'bg-blue-100 text-blue-700',
  '인사노무':      'bg-purple-100 text-purple-700',
  '총무':          'bg-green-100 text-green-700',
  '회계·세무':     'bg-blue-100 text-blue-700',
  '인사·노무':     'bg-purple-100 text-purple-700',
  '총무·행정':     'bg-green-100 text-green-700',
  '세금·신고':     'bg-orange-100 text-orange-700',
  '급여관리':      'bg-teal-100 text-teal-700',
  '입사 체크리스트': 'bg-red-100 text-red-700',
}

// ── GET /dashboard/bookmark ───────────────────────────────────
bookmarkRoute.get('/', async (c) => {
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

  // 북마크 목록 + 가이드 상세 조인
  const admin = getSupabaseAdmin(c.env)
  const { data: bookmarks } = await admin
    .from('bookmarks')
    .select(`
      id,
      created_at,
      guide_id,
      guides (
        id, title, summary, category, subcategory,
        is_premium, view_count, like_count, updated_at,
        tags
      )
    `)
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  const guides = (bookmarks ?? [])
    .map((b: any) => ({ ...b.guides, bookmark_id: b.id, bookmarked_at: b.created_at }))
    .filter(Boolean)

  return c.render(
    <div class="flex h-screen overflow-hidden">
      <Sidebar
        userName={userName}
        userInitial={userInitial}
        isPaid={isPaid}
        currentPath="/dashboard/bookmark"
      />

      <main class="flex-1 overflow-y-auto bg-gray-50">
        {/* 헤더 */}
        <header class="bg-white border-b border-gray-200 px-4 md:px-8 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
          <div class="flex items-center gap-2">
            <MobileMenuButton />
            <div>
              <h1 class="text-lg md:text-xl font-bold text-gray-800">
                <i class="fas fa-bookmark text-amber-500 mr-2"></i>저장한 가이드
              </h1>
              <p class="text-gray-500 text-xs mt-0.5 hidden sm:block">
                북마크한 가이드 {guides.length}개
              </p>
            </div>
          </div>
          {/* 검색 바로가기 */}
          <a
            href="/dashboard/archive"
            class="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-1.5 bg-blue-50 px-3 py-1.5 rounded-lg hover:bg-blue-100 transition-colors"
          >
            <i class="fas fa-compass text-xs"></i>가이드 탐색하기
          </a>
        </header>

        <div class="px-4 md:px-8 py-6 max-w-5xl mx-auto">
          {guides.length === 0 ? (
            /* 빈 상태 */
            <div class="flex flex-col items-center justify-center py-24 text-center">
              <div class="w-20 h-20 bg-amber-50 rounded-full flex items-center justify-center mb-5">
                <i class="fas fa-bookmark text-amber-300 text-3xl"></i>
              </div>
              <h2 class="text-lg font-bold text-gray-700 mb-2">저장한 가이드가 없어요</h2>
              <p class="text-gray-400 text-sm mb-6 leading-relaxed">
                가이드를 읽다가 나중에 다시 보고 싶은 내용을<br/>
                🔖 저장하기 버튼으로 북마크해 보세요!
              </p>
              <a
                href="/dashboard/archive"
                class="bg-blue-600 text-white text-sm font-medium px-5 py-2.5 rounded-xl hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <i class="fas fa-compass"></i>가이드 탐색하러 가기
              </a>
            </div>
          ) : (
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
              {guides.map((g: any) => {
                const catCls = CAT_COLOR[g.category] ?? 'bg-gray-100 text-gray-600'
                const savedDate = new Date(g.bookmarked_at).toLocaleDateString('ko-KR', {
                  month: 'long', day: 'numeric'
                })
                return (
                  <div class="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md hover:border-amber-200 transition-all group relative">
                    {/* 북마크 해제 버튼 */}
                    <button
                      onclick={`removeBookmark('${g.id}', this)`}
                      class="absolute top-3 right-3 w-7 h-7 flex items-center justify-center rounded-full bg-gray-100 hover:bg-red-100 text-gray-400 hover:text-red-500 transition-colors z-10"
                      title="북마크 해제"
                    >
                      <i class="fas fa-times text-xs"></i>
                    </button>

                    <a href={`/dashboard/guide/${g.id}`} class="block p-5">
                      {/* 카테고리 + 저장일 */}
                      <div class="flex items-center gap-2 mb-2.5">
                        <span class={`text-xs px-2 py-0.5 rounded-full font-medium ${catCls}`}>
                          {g.category}
                        </span>
                        {g.subcategory && (
                          <span class="text-xs text-gray-400">{g.subcategory}</span>
                        )}
                        {g.is_premium && (
                          <span class="text-xs bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium ml-auto mr-8">
                            <i class="fas fa-crown mr-0.5"></i>PRO
                          </span>
                        )}
                      </div>

                      {/* 제목 */}
                      <h3 class="font-bold text-gray-800 text-sm leading-snug mb-1.5 group-hover:text-blue-700 transition-colors line-clamp-2 pr-6">
                        {g.title}
                      </h3>

                      {/* 요약 */}
                      {g.summary && (
                        <p class="text-xs text-gray-500 leading-relaxed line-clamp-2 mb-3">
                          {g.summary}
                        </p>
                      )}

                      {/* 메타 정보 */}
                      <div class="flex items-center gap-3 text-xs text-gray-400 border-t border-gray-50 pt-3">
                        <span><i class="fas fa-eye mr-0.5"></i>{g.view_count ?? 0}</span>
                        {(g.like_count ?? 0) > 0 && (
                          <span><i class="fas fa-heart text-rose-300 mr-0.5"></i>{g.like_count}</span>
                        )}
                        <span class="ml-auto flex items-center gap-1 text-amber-500">
                          <i class="fas fa-bookmark text-xs"></i>
                          {savedDate} 저장
                        </span>
                      </div>
                    </a>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </main>

      <script dangerouslySetInnerHTML={{ __html: `
// 북마크 해제 (카드 제거)
async function removeBookmark(guideId, btn) {
  if (!confirm('이 가이드를 저장 목록에서 제거하시겠습니까?')) return;

  btn.disabled = true;
  try {
    const res  = await fetch('/dashboard/guide/' + guideId + '/bookmark', { method: 'POST' });
    const data = await res.json();
    if (data.ok && !data.bookmarked) {
      // 카드 페이드 아웃 후 제거
      const card = btn.closest('.bg-white');
      card.style.transition = 'opacity 0.3s, transform 0.3s';
      card.style.opacity = '0';
      card.style.transform = 'scale(0.95)';
      setTimeout(() => {
        card.remove();
        // 남은 카드 없으면 빈 상태 표시
        const grid = document.querySelector('.grid');
        if (grid && grid.children.length === 0) {
          location.reload();
        }
      }, 300);
    }
  } catch(e) {
    console.error('북마크 해제 실패', e);
    btn.disabled = false;
  }
}
      `}} />
    </div>,
    { title: '저장한 가이드 | BizReady' }
  )
})

export default bookmarkRoute
