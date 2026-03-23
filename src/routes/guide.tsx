import { Hono } from 'hono'
import { renderer } from '../renderer'
import { parseSessionCookie } from '../lib/session'
import { getSupabaseClientWithToken } from '../lib/supabase'
import type { Env } from '../lib/supabase'

const guide = new Hono<{ Bindings: Env }>()
guide.use(renderer)

// Markdown → HTML (서버사이드 경량 변환)
function markdownToHtml(md: string): string {
  return md
    .replace(/^## (.+)$/gm, '<h2 class="text-xl font-bold text-gray-800 mt-8 mb-3 pb-2 border-b border-gray-100">$1</h2>')
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-bold text-gray-700 mt-6 mb-2">$1</h3>')
    .replace(/^#### (.+)$/gm, '<h4 class="text-sm font-bold text-gray-700 mt-4 mb-1">$1</h4>')
    .replace(/\*\*(.+?)\*\*/g, '<strong class="font-semibold text-gray-900">$1</strong>')
    .replace(/`(.+?)`/g, '<code class="bg-gray-100 text-blue-700 px-1.5 py-0.5 rounded text-sm font-mono">$1</code>')
    .replace(/^> (.+)$/gm, '<blockquote class="border-l-4 border-blue-400 pl-4 py-1 bg-blue-50 rounded-r-lg my-3 text-sm text-gray-700">$1</blockquote>')
    .replace(/^- \[ \] (.+)$/gm, '<li class="flex items-start gap-2 py-1"><span class="w-4 h-4 mt-0.5 border-2 border-gray-300 rounded flex-shrink-0 inline-block"></span><span>$1</span></li>')
    .replace(/^- \[x\] (.+)$/gm, '<li class="flex items-start gap-2 py-1"><span class="w-4 h-4 mt-0.5 bg-blue-500 border-2 border-blue-500 rounded flex-shrink-0 inline-block flex items-center justify-center text-white text-xs">✓</span><span class="text-gray-500 line-through">$1</span></li>')
    .replace(/^- (.+)$/gm, '<li class="flex items-start gap-2 py-0.5"><span class="text-blue-500 mt-1.5 flex-shrink-0">•</span><span>$1</span></li>')
    .replace(/^\d+\. (.+)$/gm, '<li class="list-decimal ml-4 py-0.5 text-gray-700">$1</li>')
    .replace(/^(✅|❌|⚠️|💡) (.+)$/gm, '<p class="py-0.5">$1 $2</p>')
    // 테이블 처리
    .replace(/^\|(.+)\|$/gm, (match) => {
      const cells = match.split('|').filter((_, i, a) => i > 0 && i < a.length - 1)
      const isHeader = cells.some(c => /^[-: ]+$/.test(c.trim()))
      if (isHeader) return ''
      const tag = match.includes('---') ? '' : cells.map(c => `<td class="px-4 py-2 text-sm text-gray-700 border-b border-gray-100">${c.trim()}</td>`).join('')
      return tag ? `<tr>${tag}</tr>` : ''
    })
    .replace(/(<tr>.+<\/tr>)/gs, '<div class="overflow-x-auto my-4"><table class="w-full border border-gray-200 rounded-lg overflow-hidden">$1</table></div>')
    .replace(/(<li.+<\/li>\n?)+/gs, (m) => `<ul class="space-y-0.5 my-3">${m}</ul>`)
    .replace(/^(?!<[h|b|u|l|p|d|t|c]).+$/gm, (line) => line.trim() ? `<p class="text-gray-700 leading-relaxed my-1">${line}</p>` : '<div class="my-2"></div>')
}

guide.get('/:id', async (c) => {
  const cookie = c.req.header('Cookie') ?? ''
  const sessionStr = parseSessionCookie(cookie)
  if (!sessionStr) return c.redirect('/login?error=unauthorized')

  const guideId = c.req.param('id')
  let guideData: any = null
  let userNote: any = null
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

    const { data, error } = await supabase
      .from('guides').select('*').eq('id', guideId).single()

    if (error || !data) return c.redirect('/dashboard/archive')

    // 프리미엄 가이드 접근 제어
    if (data.is_premium && !isPaid) {
      return c.redirect('/dashboard/archive#upgrade')
    }

    guideData = data

    // 조회수 증가
    await supabase.from('guides')
      .update({ view_count: (data.view_count ?? 0) + 1 })
      .eq('id', guideId)

    // 개인 메모 가져오기
    const { data: noteData } = await supabase
      .from('user_notes')
      .select('*')
      .eq('user_id', user.id)
      .eq('guide_id', guideId)
      .single()
    userNote = noteData
  } catch {
    return c.redirect('/login?error=session_expired')
  }

  const contentHtml = markdownToHtml(guideData.content)

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
        {/* 상단 네비 */}
        <header class="bg-white border-b border-gray-200 px-8 py-3 flex items-center gap-3 sticky top-0 z-10">
          <a href="/dashboard/archive" class="text-gray-400 hover:text-gray-600 text-sm flex items-center gap-1">
            <i class="fas fa-chevron-left"></i> 아카이브
          </a>
          <span class="text-gray-300">/</span>
          <span class="text-gray-600 text-sm">{guideData.category}</span>
          <span class="text-gray-300">/</span>
          <span class="text-gray-800 text-sm font-medium truncate max-w-xs">{guideData.title}</span>
        </header>

        <div class="px-8 py-6 max-w-4xl flex gap-6">
          {/* 본문 */}
          <article class="flex-1 min-w-0">
            <div class="bg-white rounded-2xl border border-gray-100 p-8">
              {/* 헤더 */}
              <div class="mb-6">
                <div class="flex items-center gap-2 mb-3">
                  <span class="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">{guideData.category}</span>
                  {guideData.is_premium && (
                    <span class="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-medium">
                      <i class="fas fa-crown mr-1"></i>PRO
                    </span>
                  )}
                </div>
                <h1 class="text-2xl font-bold text-gray-900 mb-2">{guideData.title}</h1>
                <p class="text-gray-500 text-sm">{guideData.summary}</p>
                <div class="flex items-center gap-4 mt-3 text-xs text-gray-400">
                  <span><i class="fas fa-eye mr-1"></i>{guideData.view_count}회 조회</span>
                  <span><i class="fas fa-clock mr-1"></i>{new Date(guideData.updated_at).toLocaleDateString('ko-KR')}</span>
                </div>
              </div>
              <hr class="border-gray-100 mb-6" />
              {/* 마크다운 본문 */}
              <div
                class="prose-bizready text-gray-700 leading-relaxed"
                dangerouslySetInnerHTML={{ __html: contentHtml }}
              />
              {/* 태그 */}
              <div class="flex flex-wrap gap-2 mt-8 pt-6 border-t border-gray-100">
                {(guideData.tags as string[]).map((tag: string) => (
                  <a href={`/dashboard/search?q=${encodeURIComponent(tag)}`}
                     class="text-xs bg-gray-100 hover:bg-blue-100 hover:text-blue-700 text-gray-500 px-3 py-1 rounded-full transition-colors">
                    #{tag}
                  </a>
                ))}
              </div>
            </div>
          </article>

          {/* 사이드: 개인 메모 */}
          <aside class="w-64 flex-shrink-0">
            <div class="bg-white rounded-2xl border border-gray-100 p-5 sticky top-20">
              <h3 class="font-bold text-gray-800 mb-3 flex items-center gap-2">
                <i class="fas fa-sticky-note text-yellow-500"></i> 내 메모
              </h3>
              <textarea
                id="memo-area"
                rows={8}
                placeholder="이 가이드에 대한 메모를 남겨보세요..."
                class="w-full text-sm border border-gray-200 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
              >{userNote?.memo ?? ''}</textarea>
              <button
                id="save-memo-btn"
                class="w-full mt-3 bg-blue-600 text-white text-sm font-medium py-2 rounded-lg hover:bg-blue-700 transition-colors"
              >
                <i class="fas fa-save mr-1"></i> 저장
              </button>
              <div id="memo-msg" class="text-xs text-center mt-2 hidden"></div>

              {/* 북마크 */}
              <hr class="my-4 border-gray-100" />
              <button
                id="bookmark-btn"
                class={`w-full text-sm font-medium py-2 rounded-lg transition-colors border ${userNote?.is_bookmarked ? 'bg-amber-50 text-amber-700 border-amber-300' : 'border-gray-200 text-gray-600 hover:border-amber-300 hover:text-amber-600'}`}
              >
                <i class={`fas fa-bookmark mr-1`}></i>
                <span id="bookmark-label">{userNote?.is_bookmarked ? '북마크 됨' : '북마크 추가'}</span>
              </button>
            </div>
          </aside>
        </div>
      </main>

      <script dangerouslySetInnerHTML={{ __html: `
const SUPABASE_URL = '${c.env.SUPABASE_URL}'
const SUPABASE_ANON_KEY = '${c.env.SUPABASE_ANON_KEY}'
const { createClient } = supabase
const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
const GUIDE_ID = '${guideData.id}'
const USER_ID = '${userId}'
let isBookmarked = ${userNote?.is_bookmarked ?? false}

// 메모 저장
document.getElementById('save-memo-btn').addEventListener('click', async () => {
  const memo = document.getElementById('memo-area').value
  const msg = document.getElementById('memo-msg')
  const { error } = await client.from('user_notes').upsert({
    user_id: USER_ID,
    guide_id: GUIDE_ID,
    memo,
    is_bookmarked: isBookmarked,
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_id,guide_id' })
  msg.classList.remove('hidden')
  if (error) {
    msg.className = 'text-xs text-center mt-2 text-red-500'
    msg.textContent = '저장 실패: ' + error.message
  } else {
    msg.className = 'text-xs text-center mt-2 text-green-600'
    msg.textContent = '✅ 저장되었습니다!'
    setTimeout(() => msg.classList.add('hidden'), 2000)
  }
})

// 북마크 토글
document.getElementById('bookmark-btn').addEventListener('click', async () => {
  isBookmarked = !isBookmarked
  const memo = document.getElementById('memo-area').value
  await client.from('user_notes').upsert({
    user_id: USER_ID, guide_id: GUIDE_ID,
    memo, is_bookmarked: isBookmarked,
    updated_at: new Date().toISOString()
  }, { onConflict: 'user_id,guide_id' })
  const btn = document.getElementById('bookmark-btn')
  const lbl = document.getElementById('bookmark-label')
  if (isBookmarked) {
    btn.className = 'w-full text-sm font-medium py-2 rounded-lg transition-colors border bg-amber-50 text-amber-700 border-amber-300'
    lbl.textContent = '북마크 됨'
  } else {
    btn.className = 'w-full text-sm font-medium py-2 rounded-lg transition-colors border border-gray-200 text-gray-600'
    lbl.textContent = '북마크 추가'
  }
})
` }} />
    </div>,
    { title: `${guideData.title} | BizReady` }
  )
})

export default guide
