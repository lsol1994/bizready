import { Hono } from 'hono'
import { renderer } from '../renderer'
import { parseSessionCookie } from '../lib/session'
import { getSupabaseClientWithToken } from '../lib/supabase'
import type { Env } from '../lib/supabase'

const archive = new Hono<{ Bindings: Env }>()
archive.use(renderer)

const CATEGORY_META: Record<string, { icon: string; color: string; bg: string }> = {
  '회계·세무':      { icon: 'fa-calculator',         color: 'text-blue-600',   bg: 'bg-blue-50 border-blue-200' },
  '인사·노무':      { icon: 'fa-users',               color: 'text-purple-600', bg: 'bg-purple-50 border-purple-200' },
  '총무·행정':      { icon: 'fa-building',            color: 'text-green-600',  bg: 'bg-green-50 border-green-200' },
  '세금·신고':      { icon: 'fa-file-invoice-dollar', color: 'text-orange-600', bg: 'bg-orange-50 border-orange-200' },
  '급여관리':       { icon: 'fa-money-bill-wave',     color: 'text-teal-600',   bg: 'bg-teal-50 border-teal-200' },
  '입사 체크리스트': { icon: 'fa-clipboard-check',    color: 'text-red-600',    bg: 'bg-red-50 border-red-200' },
}

archive.get('/', async (c) => {
  const cookie   = c.req.header('Cookie') ?? ''
  const sessionStr = parseSessionCookie(cookie)
  if (!sessionStr) return c.redirect('/login?error=unauthorized')

  const selectedCategory = c.req.query('category') ?? ''

  let guides: any[] = []
  let userName = '사용자'
  let userInitial = 'U'
  let isPaid = false

  try {
    const sessionObj = JSON.parse(decodeURIComponent(sessionStr))
    const supabase   = getSupabaseClientWithToken(c.env, sessionObj.access_token)

    const { data: { user }, error: userErr } = await supabase.auth.getUser()
    if (userErr || !user) return c.redirect('/login?error=session_expired')

    userName    = (user.user_metadata?.full_name as string) || user.email?.split('@')[0] || '사용자'
    userInitial = userName.charAt(0).toUpperCase()

    // 유료 여부
    const { data: profile } = await supabase
      .from('user_profiles').select('is_paid').eq('id', user.id).single()
    isPaid = profile?.is_paid ?? false

    // 가이드 목록
    let query = supabase.from('guides')
      .select('id, category, title, summary, tags, is_premium, view_count, updated_at')
      .order('created_at', { ascending: true })
    if (selectedCategory) query = query.eq('category', selectedCategory)

    const { data, error } = await query
    if (!error && data) guides = data
  } catch {
    return c.redirect('/login?error=session_expired')
  }

  // 카테고리 목록 (고유값)
  const categories = Object.keys(CATEGORY_META)

  return c.render(
    <div class="flex h-screen overflow-hidden">
      {/* 사이드바 */}
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
              <div class="text-sky-300 text-xs">{isPaid ? '💎 프리미엄' : '무료 플랜'}</div>
            </div>
          </div>
        </div>
        <nav class="flex-1 px-3 py-4 space-y-1">
          <a href="/dashboard"           class="sidebar-item flex items-center gap-3 px-3 py-2.5 rounded-lg text-sky-200 hover:text-white text-sm"><i class="fas fa-home w-4 text-center"></i><span>홈</span></a>
          <a href="/dashboard/archive"   class="sidebar-item active flex items-center gap-3 px-3 py-2.5 rounded-lg text-white text-sm"><i class="fas fa-book-open w-4 text-center"></i><span>업무 아카이브</span></a>
          <a href="/dashboard/search"    class="sidebar-item flex items-center gap-3 px-3 py-2.5 rounded-lg text-sky-200 hover:text-white text-sm"><i class="fas fa-search w-4 text-center"></i><span>지식 검색</span></a>
          <a href="/dashboard/checklist" class="sidebar-item flex items-center gap-3 px-3 py-2.5 rounded-lg text-sky-200 hover:text-white text-sm"><i class="fas fa-clipboard-check w-4 text-center"></i><span>체크리스트</span></a>
        </nav>
        <div class="px-3 pb-4">
          <form action="/auth/logout" method="POST">
            <button type="submit" class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sky-200 hover:text-white hover:bg-white/10 text-sm transition-colors">
              <i class="fas fa-sign-out-alt w-4 text-center"></i><span>로그아웃</span>
            </button>
          </form>
        </div>
      </aside>

      {/* 메인 */}
      <main class="flex-1 overflow-y-auto bg-gray-50">
        <header class="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between sticky top-0 z-10">
          <div>
            <h1 class="text-xl font-bold text-gray-800">업무 아카이브</h1>
            <p class="text-gray-500 text-sm">5년차 실무 노하우 가이드 모음</p>
          </div>
          <a href="/dashboard/search" class="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm transition-colors">
            <i class="fas fa-search"></i> 검색
          </a>
        </header>

        <div class="px-8 py-6 max-w-5xl">
          {/* 카테고리 탭 */}
          <div class="flex flex-wrap gap-2 mb-6">
            <a href="/dashboard/archive"
               class={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${!selectedCategory ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-400'}`}>
              전체 ({guides.length > 0 ? guides.length : '—'})
            </a>
            {categories.map((cat) => {
              const m = CATEGORY_META[cat]
              const count = guides.filter((g: any) => g.category === cat).length
              return (
                <a href={`/dashboard/archive?category=${encodeURIComponent(cat)}`}
                   class={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${selectedCategory === cat ? 'bg-blue-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-400'}`}>
                  <i class={`fas ${m.icon} mr-1`}></i>{cat}
                  {selectedCategory === cat && count > 0 && ` (${count})`}
                </a>
              )
            })}
          </div>

          {/* 가이드 카드 목록 */}
          {guides.length === 0 ? (
            <div class="text-center py-20 text-gray-400">
              <i class="fas fa-inbox text-4xl mb-4 block"></i>
              <p class="text-lg font-medium">아직 등록된 가이드가 없습니다.</p>
              <p class="text-sm mt-1">Supabase에 시드 데이터를 먼저 실행해주세요.</p>
            </div>
          ) : (
            <div class="grid gap-4">
              {guides.map((guide: any) => {
                const meta = CATEGORY_META[guide.category] ?? { icon: 'fa-file', color: 'text-gray-600', bg: 'bg-gray-50 border-gray-200' }
                const isLocked = guide.is_premium && !isPaid
                return (
                  <a href={isLocked ? '/dashboard/archive#upgrade' : `/dashboard/guide/${guide.id}`}
                     class="bg-white rounded-xl border border-gray-100 p-5 card-hover flex items-start gap-4 block">
                    <div class={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${meta.bg}`}>
                      <i class={`fas ${meta.icon} ${meta.color} text-sm`}></i>
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="flex items-center gap-2 mb-1">
                        <span class="text-xs text-gray-400 font-medium">{guide.category}</span>
                        {guide.is_premium && (
                          <span class="text-xs font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                            <i class="fas fa-crown mr-0.5"></i>PRO
                          </span>
                        )}
                        {isLocked && (
                          <span class="text-xs text-gray-400"><i class="fas fa-lock ml-1"></i></span>
                        )}
                      </div>
                      <h3 class={`font-semibold text-sm mb-1 ${isLocked ? 'text-gray-400' : 'text-gray-800'}`}>
                        {isLocked ? '🔒 ' : ''}{guide.title}
                      </h3>
                      <p class={`text-xs ${isLocked ? 'text-gray-300' : 'text-gray-500'} line-clamp-1`}>
                        {isLocked ? '프리미엄 플랜에서 열람 가능합니다.' : guide.summary}
                      </p>
                      <div class="flex items-center gap-3 mt-2">
                        {(guide.tags as string[]).slice(0, 3).map((tag: string) => (
                          <span class="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded">#{tag}</span>
                        ))}
                      </div>
                    </div>
                    <i class="fas fa-chevron-right text-gray-300 text-sm flex-shrink-0 mt-1"></i>
                  </a>
                )
              })}
            </div>
          )}

          {/* 업그레이드 배너 */}
          {!isPaid && (
            <div id="upgrade" class="mt-8 gradient-bg rounded-2xl p-6 text-white text-center">
              <i class="fas fa-crown text-amber-300 text-2xl mb-3 block"></i>
              <h3 class="font-bold text-lg mb-2">프리미엄 플랜으로 업그레이드</h3>
              <p class="text-sky-200 text-sm mb-4">심화 세무·노무 가이드, 판례 기반 실무 Q&A 등 모든 콘텐츠를 이용하세요.</p>
              <a href="/dashboard/payment" class="bg-white text-blue-700 font-bold px-6 py-2.5 rounded-lg hover:bg-sky-50 transition-colors inline-block">
                지금 시작하기
              </a>
            </div>
          )}
        </div>
      </main>
    </div>,
    { title: '업무 아카이브 | BizReady' }
  )
})

export default archive
