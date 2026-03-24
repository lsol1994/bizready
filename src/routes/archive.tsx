import { Hono } from 'hono'
import { renderer } from '../renderer'
import { parseSessionCookie } from '../lib/session'
import { getSupabaseClientWithToken } from '../lib/supabase'
import type { Env } from '../lib/supabase'

const archive = new Hono<{ Bindings: Env }>()
archive.use(renderer)

// ── 카테고리 메타 (구·신 카테고리 통합) ────────────────────
const CATEGORY_META: Record<string, { icon: string; color: string; bg: string; gradient: string }> = {
  '세무회계':          { icon: 'fa-calculator',         color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200',    gradient: 'from-blue-500 to-blue-600' },
  '인사노무':          { icon: 'fa-users',               color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', gradient: 'from-purple-500 to-purple-600' },
  '총무':              { icon: 'fa-building',            color: 'text-emerald-700',bg: 'bg-emerald-50 border-emerald-200', gradient: 'from-emerald-500 to-emerald-600' },
  '회계·세무':         { icon: 'fa-calculator',         color: 'text-blue-700',   bg: 'bg-blue-50 border-blue-200',    gradient: 'from-blue-500 to-blue-600' },
  '인사·노무':         { icon: 'fa-users',               color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200', gradient: 'from-purple-500 to-purple-600' },
  '총무·행정':         { icon: 'fa-building',            color: 'text-green-700',  bg: 'bg-green-50 border-green-200',  gradient: 'from-green-500 to-green-600' },
  '세금·신고':         { icon: 'fa-file-invoice-dollar', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200', gradient: 'from-orange-500 to-orange-600' },
  '급여관리':          { icon: 'fa-money-bill-wave',     color: 'text-teal-700',   bg: 'bg-teal-50 border-teal-200',    gradient: 'from-teal-500 to-teal-600' },
  '입사 체크리스트':   { icon: 'fa-clipboard-check',    color: 'text-red-700',    bg: 'bg-red-50 border-red-200',      gradient: 'from-red-500 to-red-600' },
}

// 표시할 메인 카테고리 순서
const MAIN_CATEGORIES = ['세무회계', '인사노무', '총무']

// 서브카테고리 매핑
const SUBCATEGORIES: Record<string, string[]> = {
  '세무회계':  ['전표/결산', '부가세', '법인세', '원천세/연말정산', '자금관리'],
  '인사노무':  ['채용/퇴사', '급여/4대보험', '근태/연차', '근로계약/사규', '성과평가'],
  '총무':      ['자산/시설', '법무/인장', '복리후생', '구매관리', '전사 일정 관리'],
  '회계·세무': ['전표/결산', '부가세', '법인세', '원천세/연말정산', '자금관리'],
  '인사·노무': ['채용/퇴사', '급여/4대보험', '근태/연차', '근로계약/사규', '성과평가'],
  '총무·행정': ['자산/시설', '법무/인장', '복리후생', '구매관리'],
}

archive.get('/', async (c) => {
  const cookie     = c.req.header('Cookie') ?? ''
  const sessionStr = parseSessionCookie(cookie)
  if (!sessionStr) return c.redirect('/login?error=unauthorized')

  const selectedCategory    = c.req.query('cat') ?? c.req.query('category') ?? ''
  const selectedSubcategory = c.req.query('sub') ?? ''

  let guides: any[] = []
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

    let query = supabase.from('guides')
      .select('id, category, subcategory, title, summary, tags, is_premium, view_count, updated_at, file_url_1, file_url_2, file_url_3')
      .eq('status', 'published')
      .order('created_at', { ascending: true })

    if (selectedCategory) {
      query = query.eq('category', selectedCategory)
    }
    if (selectedSubcategory) {
      query = query.eq('subcategory', selectedSubcategory)
    }

    const { data, error } = await query
    if (!error && data) guides = data
  } catch {
    return c.redirect('/login?error=session_expired')
  }

  // 카테고리별 가이드 수 (표시용 — 전체 조회 X, 이미 가져온 데이터 활용)
  const catCounts: Record<string, number> = {}
  guides.forEach((g: any) => {
    catCounts[g.category] = (catCounts[g.category] ?? 0) + 1
  })

  // 서브카테고리 목록 (현재 카테고리 기준)
  const subCategories = selectedCategory ? (SUBCATEGORIES[selectedCategory] ?? []) : []

  // 파일 첨부 여부
  const hasAttachment = (g: any) => !!(g.file_url_1 || g.file_url_2 || g.file_url_3)

  return c.render(
    <div class="flex h-screen overflow-hidden">
      {/* ── 사이드바 ── */}
      <aside class="w-64 gradient-bg flex flex-col flex-shrink-0 overflow-y-auto">
        <div class="px-6 py-5 border-b border-white/10 flex-shrink-0">
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
        <div class="px-4 py-3 border-b border-white/10 flex-shrink-0">
          <div class="flex items-center gap-3 bg-white/10 rounded-xl px-3 py-2">
            <div class="w-8 h-8 bg-sky-400 rounded-full flex items-center justify-center text-white text-sm font-bold flex-shrink-0">{userInitial}</div>
            <div class="flex-1 min-w-0">
              <div class="text-white text-sm font-medium truncate">{userName}</div>
              <div class="text-sky-300 text-xs">{isPaid ? '💎 프리미엄' : '무료 플랜'}</div>
            </div>
          </div>
        </div>
        <nav class="flex-1 px-3 py-4 space-y-0.5">
          <a href="/dashboard"           class="sidebar-item flex items-center gap-3 px-3 py-2.5 rounded-lg text-sky-200 hover:text-white text-sm"><i class="fas fa-home w-4 text-center"></i><span>홈</span></a>
          <a href="/dashboard/archive"   class="sidebar-item active flex items-center gap-3 px-3 py-2.5 rounded-lg text-white text-sm"><i class="fas fa-book-open w-4 text-center"></i><span>업무 아카이브</span></a>
          <a href="/dashboard/search"    class="sidebar-item flex items-center gap-3 px-3 py-2.5 rounded-lg text-sky-200 hover:text-white text-sm"><i class="fas fa-search w-4 text-center"></i><span>지식 검색</span></a>
          <a href="/dashboard/checklist" class="sidebar-item flex items-center gap-3 px-3 py-2.5 rounded-lg text-sky-200 hover:text-white text-sm"><i class="fas fa-clipboard-check w-4 text-center"></i><span>체크리스트</span></a>
          <a href="/dashboard/calendar"  class="sidebar-item flex items-center gap-3 px-3 py-2.5 rounded-lg text-sky-200 hover:text-white text-sm"><i class="fas fa-calendar-alt w-4 text-center"></i><span>전사 일정</span></a>

          {/* 카테고리 바로가기 */}
          <div class="pt-3">
            <div class="text-sky-400 text-xs font-semibold px-3 mb-2 uppercase tracking-wide">카테고리</div>
            {MAIN_CATEGORIES.map(cat => {
              const m = CATEGORY_META[cat]
              return (
                <a href={`/dashboard/archive?cat=${encodeURIComponent(cat)}`}
                   class={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${selectedCategory === cat ? 'bg-white/20 text-white' : 'text-sky-200 hover:text-white hover:bg-white/10'}`}>
                  <i class={`fas ${m.icon} w-4 text-center text-xs`}></i>
                  <span class="text-xs">{cat}</span>
                </a>
              )
            })}
          </div>
        </nav>
        <div class="px-3 pb-4 flex-shrink-0">
          <form action="/auth/logout" method="POST">
            <button type="submit" class="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sky-200 hover:text-white hover:bg-white/10 text-sm transition-colors">
              <i class="fas fa-sign-out-alt w-4 text-center"></i><span>로그아웃</span>
            </button>
          </form>
        </div>
      </aside>

      {/* ── 메인 ── */}
      <main class="flex-1 overflow-y-auto bg-gray-50">
        {/* 상단 헤더 */}
        <header class="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
          <div>
            <h1 class="text-xl font-bold text-gray-800">
              {selectedCategory ? (
                <span>
                  <span class="text-gray-400 font-normal text-base">업무 아카이브 /</span> {selectedCategory}
                  {selectedSubcategory && <span class="text-gray-400 font-normal text-base"> / {selectedSubcategory}</span>}
                </span>
              ) : '업무 아카이브'}
            </h1>
            <p class="text-gray-500 text-xs mt-0.5">
              {guides.length}개 가이드 · 5년차 실무 노하우 총집결
            </p>
          </div>
          <div class="flex items-center gap-2">
            <a href="/dashboard/search" class="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-600 px-3 py-2 rounded-lg text-sm transition-colors">
              <i class="fas fa-search text-xs"></i> 검색
            </a>
          </div>
        </header>

        <div class="px-6 py-5 max-w-6xl mx-auto">

          {/* ── 카테고리 탭 (대분류) ── */}
          <div class="flex flex-wrap gap-2 mb-4">
            <a href="/dashboard/archive"
               class={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${!selectedCategory ? 'bg-blue-600 text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-400 hover:text-blue-600'}`}>
              <i class="fas fa-th-large mr-1.5"></i>전체
            </a>
            {MAIN_CATEGORIES.map((cat) => {
              const m = CATEGORY_META[cat]
              return (
                <a href={`/dashboard/archive?cat=${encodeURIComponent(cat)}`}
                   class={`px-4 py-2 rounded-xl text-sm font-medium transition-all flex items-center gap-1.5 ${selectedCategory === cat ? 'bg-blue-600 text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-600 hover:border-blue-400 hover:text-blue-600'}`}>
                  <i class={`fas ${m.icon} text-xs`}></i>{cat}
                </a>
              )
            })}
          </div>

          {/* ── 서브카테고리 탭 (선택된 카테고리 있을 때) ── */}
          {selectedCategory && subCategories.length > 0 && (
            <div class="flex flex-wrap gap-1.5 mb-5 pl-1">
              <a href={`/dashboard/archive?cat=${encodeURIComponent(selectedCategory)}`}
                 class={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${!selectedSubcategory ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                전체 소항목
              </a>
              {subCategories.map(sub => (
                <a href={`/dashboard/archive?cat=${encodeURIComponent(selectedCategory)}&sub=${encodeURIComponent(sub)}`}
                   class={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${selectedSubcategory === sub ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {sub}
                </a>
              ))}
            </div>
          )}

          {/* ── 카테고리 선택 전 : 카테고리 카드 그리드 ── */}
          {!selectedCategory && (
            <div class="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {MAIN_CATEGORIES.map((cat) => {
                const m = CATEGORY_META[cat]
                const subs = SUBCATEGORIES[cat] ?? []
                const catGuides = guides.filter((g: any) => g.category === cat)
                return (
                  <a href={`/dashboard/archive?cat=${encodeURIComponent(cat)}`}
                     class="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md hover:border-blue-200 transition-all group">
                    <div class="flex items-center gap-3 mb-3">
                      <div class={`w-10 h-10 rounded-xl bg-gradient-to-br ${m.gradient} flex items-center justify-center shadow-sm`}>
                        <i class={`fas ${m.icon} text-white text-sm`}></i>
                      </div>
                      <div>
                        <div class="font-bold text-gray-800 text-sm">{cat}</div>
                        <div class="text-xs text-gray-400">{catGuides.length}개 가이드</div>
                      </div>
                    </div>
                    <div class="flex flex-wrap gap-1">
                      {subs.map(sub => (
                        <span class="text-xs bg-gray-50 text-gray-500 px-2 py-0.5 rounded-full border border-gray-100">{sub}</span>
                      ))}
                    </div>
                    <div class="mt-3 text-xs text-blue-500 font-medium group-hover:text-blue-600">
                      가이드 보기 <i class="fas fa-arrow-right ml-1"></i>
                    </div>
                  </a>
                )
              })}
            </div>
          )}

          {/* ── 가이드 목록 ── */}
          {guides.length === 0 ? (
            <div class="text-center py-20 text-gray-400 bg-white rounded-2xl border border-gray-100">
              <i class="fas fa-inbox text-4xl mb-4 block text-gray-300"></i>
              <p class="text-base font-medium text-gray-500">이 카테고리에 가이드가 없습니다.</p>
              <p class="text-sm mt-1">Supabase SQL Editor에서 seed_guides_v3.sql을 실행하세요.</p>
              <a href="/dashboard/archive" class="inline-block mt-4 text-sm text-blue-500 hover:underline">
                전체 목록 보기
              </a>
            </div>
          ) : (
            <div class="grid gap-3" id="guide-list">
              {guides.map((guide: any) => {
                const meta    = CATEGORY_META[guide.category] ?? { icon: 'fa-file', color: 'text-gray-600', bg: 'bg-gray-50 border-gray-200', gradient: 'from-gray-400 to-gray-500' }
                const isLocked = guide.is_premium && !isPaid
                const fileCount = [guide.file_url_1, guide.file_url_2, guide.file_url_3].filter(Boolean).length
                return (
                  <a href={isLocked ? '/dashboard/archive#upgrade' : `/dashboard/guide/${guide.id}`}
                     class={`bg-white rounded-xl border ${isLocked ? 'border-gray-100 opacity-75' : 'border-gray-100 hover:border-blue-200 hover:shadow-md'} p-4 flex items-start gap-4 transition-all group`}>
                    <div class={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${meta.bg}`}>
                      <i class={`fas ${meta.icon} ${meta.color} text-sm`}></i>
                    </div>
                    <div class="flex-1 min-w-0">
                      <div class="flex flex-wrap items-center gap-1.5 mb-1">
                        {guide.subcategory && (
                          <span class="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{guide.subcategory}</span>
                        )}
                        {guide.is_premium && (
                          <span class="text-xs font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">
                            <i class="fas fa-crown mr-0.5 text-xs"></i>PRO
                          </span>
                        )}
                        {fileCount > 0 && !isLocked && (
                          <span class="text-xs bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-full font-medium" title="실무 양식 첨부됨">
                            <i class="fas fa-file-excel mr-0.5 text-xs"></i>양식 {fileCount}개
                          </span>
                        )}
                        {isLocked && (
                          <span class="text-xs text-gray-400"><i class="fas fa-lock text-xs"></i></span>
                        )}
                      </div>
                      <h3 class={`font-semibold text-sm mb-1 ${isLocked ? 'text-gray-400' : 'text-gray-800 group-hover:text-blue-600'} transition-colors`}>
                        {isLocked ? '🔒 ' : ''}{guide.title}
                      </h3>
                      <p class={`text-xs leading-relaxed ${isLocked ? 'text-gray-300' : 'text-gray-500'} line-clamp-1`}>
                        {isLocked ? '프리미엄 플랜에서 열람 가능합니다.' : guide.summary}
                      </p>
                      {!isLocked && Array.isArray(guide.tags) && guide.tags.length > 0 && (
                        <div class="flex items-center gap-1.5 mt-2 flex-wrap">
                          {(guide.tags as string[]).slice(0, 4).map((tag: string) => (
                            <span class="text-xs bg-gray-100 text-gray-400 px-2 py-0.5 rounded">#{tag}</span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div class="flex flex-col items-end gap-1 flex-shrink-0">
                      <i class="fas fa-chevron-right text-gray-300 text-xs group-hover:text-blue-400 transition-colors"></i>
                      {guide.view_count > 0 && (
                        <span class="text-xs text-gray-300">{guide.view_count}</span>
                      )}
                    </div>
                  </a>
                )
              })}
            </div>
          )}

          {/* ── 업그레이드 배너 ── */}
          {!isPaid && (
            <div id="upgrade" class="mt-8 gradient-bg rounded-2xl p-6 text-white text-center">
              <i class="fas fa-crown text-amber-300 text-2xl mb-3 block"></i>
              <h3 class="font-bold text-lg mb-2">프리미엄 플랜으로 업그레이드</h3>
              <p class="text-sky-200 text-sm mb-4">심화 세무·노무 가이드와 실무 양식 파일을 제한 없이 다운로드하세요.</p>
              <a href="/dashboard/payment" class="bg-white text-blue-700 font-bold px-6 py-2.5 rounded-xl hover:bg-sky-50 transition-colors inline-block">
                지금 시작하기 →
              </a>
            </div>
          )}
        </div>
      </main>

      <style>{`
        .gradient-bg { background: linear-gradient(180deg, #1e3a5f 0%, #0f2544 100%); }
        .sidebar-item { transition: all 0.15s; }
        .sidebar-item:hover { background: rgba(255,255,255,0.1); }
        .sidebar-item.active { background: rgba(255,255,255,0.15); }
        .line-clamp-1 { overflow: hidden; display: -webkit-box; -webkit-line-clamp: 1; -webkit-box-orient: vertical; }
      `}</style>
    </div>,
    { title: '업무 아카이브 | BizReady' }
  )
})

export default archive
