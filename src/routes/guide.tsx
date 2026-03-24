import { Hono } from 'hono'
import { renderer } from '../renderer'
import { parseSessionCookie } from '../lib/session'
import { getSupabaseClientWithToken } from '../lib/supabase'
import { Sidebar } from '../lib/sidebar'
import type { Env } from '../lib/supabase'

const guide = new Hono<{ Bindings: Env }>()
guide.use(renderer)

// ── 파일 아이콘 헬퍼 ──────────────────────────────────────
function getFileIcon(fileName: string): string {
  const ext = fileName?.split('.').pop()?.toLowerCase() ?? ''
  if (['xlsx', 'xls', 'csv'].includes(ext)) {
    return '<span class="inline-flex items-center justify-center w-8 h-8 bg-green-100 rounded-lg text-green-700 text-sm font-bold flex-shrink-0">XLS</span>'
  }
  if (['zip', 'rar', '7z'].includes(ext)) {
    return '<span class="inline-flex items-center justify-center w-8 h-8 bg-orange-100 rounded-lg text-orange-700 text-sm font-bold flex-shrink-0">ZIP</span>'
  }
  if (ext === 'pdf') {
    return '<span class="inline-flex items-center justify-center w-8 h-8 bg-red-100 rounded-lg text-red-700 text-sm font-bold flex-shrink-0">PDF</span>'
  }
  if (['docx', 'doc'].includes(ext)) {
    return '<span class="inline-flex items-center justify-center w-8 h-8 bg-blue-100 rounded-lg text-blue-700 text-sm font-bold flex-shrink-0">DOC</span>'
  }
  if (['hwp', 'hwpx'].includes(ext)) {
    return '<span class="inline-flex items-center justify-center w-8 h-8 bg-teal-100 rounded-lg text-teal-700 text-sm font-bold flex-shrink-0">HWP</span>'
  }
  return '<span class="inline-flex items-center justify-center w-8 h-8 bg-gray-100 rounded-lg text-gray-600 text-xs font-bold flex-shrink-0">FILE</span>'
}

// ── 근로기준법 링크 변환 ──────────────────────────────────
// 텍스트 내 [근로기준법 제XX조] 패턴을 링크로 변환
function injectLawLinks(html: string): string {
  return html.replace(
    /\[?(근로기준법|최저임금법|고용보험법|산업재해보상보험법|남녀고용평등법|노동조합법|파견근로자보호법)\s*(제(\d+)조(?:의(\d+))?(?:\s*제(\d+)항)?)\]?/g,
    (match, lawName: string, articleText: string, articleNum: string) => {
      const lawCodes: Record<string, string> = {
        '근로기준법': 'LAW-000001',
        '최저임금법': 'LAW-000438',
        '고용보험법': 'LAW-000603',
        '산업재해보상보험법': 'LAW-000682',
        '남녀고용평등법': 'LAW-000329',
        '노동조합법': 'LAW-000346',
        '파견근로자보호법': 'LAW-003967',
      }
      const code = lawCodes[lawName] || 'LAW-000001'
      const url = `https://www.law.go.kr/법령/${encodeURIComponent(lawName)}/(${code},${articleNum})`
      return `<a href="${url}" target="_blank" rel="noopener" class="law-link inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 underline decoration-dotted font-medium text-sm" title="${lawName} ${articleText} - 국가법령정보센터에서 보기"><i class="fas fa-landmark text-xs"></i>${lawName} ${articleText}</a>`
    }
  )
}

// ── Markdown → HTML (강화버전) ──────────────────────────────
function markdownToHtml(md: string): string {
  let html = md
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

  // 근로기준법 링크 주입
  html = injectLawLinks(html)
  return html
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
    let sessionObj: any
    try { sessionObj = JSON.parse(sessionStr) }
    catch { sessionObj = JSON.parse(decodeURIComponent(sessionStr)) }

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

    if (data.is_premium && !isPaid) {
      return c.redirect('/dashboard/archive#upgrade')
    }

    guideData = data

    await supabase.from('guides')
      .update({ view_count: (data.view_count ?? 0) + 1 })
      .eq('id', guideId)

    const { data: noteData } = await supabase
      .from('user_notes').select('*').eq('user_id', user.id).eq('guide_id', guideId).single()
    userNote = noteData
  } catch {
    return c.redirect('/login?error=session_expired')
  }

  const contentHtml = markdownToHtml(guideData.content)

  // 첨부 파일 목록 구성
  const attachments: Array<{ slot: number; url: string; name: string }> = []
  for (const slot of [1, 2, 3]) {
    const url = guideData[`file_url_${slot}`]
    const name = guideData[`file_name_${slot}`] || `첨부파일 ${slot}`
    if (url) attachments.push({ slot, url, name })
  }

  const hasAttachments = attachments.length > 0

  // 카테고리 색상
  const catColors: Record<string, string> = {
    '세무회계': 'bg-blue-100 text-blue-700',
    '인사노무': 'bg-purple-100 text-purple-700',
    '총무': 'bg-green-100 text-green-700',
    '회계·세무': 'bg-blue-100 text-blue-700',
    '인사·노무': 'bg-purple-100 text-purple-700',
    '총무·행정': 'bg-green-100 text-green-700',
    '세금·신고': 'bg-orange-100 text-orange-700',
    '급여관리': 'bg-teal-100 text-teal-700',
    '입사 체크리스트': 'bg-red-100 text-red-700',
  }
  const catColor = catColors[guideData.category] ?? 'bg-gray-100 text-gray-700'

  return c.render(
    <div class="flex h-screen overflow-hidden">
      {/* 공통 사이드바 */}
      <Sidebar
        userName={userName}
        userInitial={userInitial}
        isPaid={isPaid}
        currentPath="/dashboard/guide"
      />

      {/* 메인 */}
      <main class="flex-1 overflow-y-auto bg-gray-50">
        {/* 상단 브레드크럼 */}
        <header class="bg-white border-b border-gray-200 px-8 py-3 flex items-center gap-3 sticky top-0 z-10">
          <a href="/dashboard/archive" class="text-gray-400 hover:text-gray-600 text-sm flex items-center gap-1">
            <i class="fas fa-chevron-left"></i> 아카이브
          </a>
          <span class="text-gray-300">/</span>
          <span class={`text-xs px-2 py-0.5 rounded-full font-medium ${catColor}`}>{guideData.category}</span>
          {guideData.subcategory && (
            <>
              <span class="text-gray-300">/</span>
              <span class="text-gray-500 text-xs">{guideData.subcategory}</span>
            </>
          )}
          <span class="text-gray-300">/</span>
          <span class="text-gray-800 text-sm font-medium truncate max-w-xs">{guideData.title}</span>
        </header>

        <div class="px-8 py-6 max-w-5xl">
          <div class="flex gap-6">
            {/* 본문 (좌측) */}
            <article class="flex-1 min-w-0 space-y-5">
              {/* 가이드 헤더 카드 */}
              <div class="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
                <div class="flex items-start justify-between gap-4 mb-4">
                  <div class="flex-1">
                    <div class="flex flex-wrap items-center gap-2 mb-3">
                      <span class={`text-xs px-2 py-1 rounded-full font-medium ${catColor}`}>{guideData.category}</span>
                      {guideData.subcategory && (
                        <span class="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">{guideData.subcategory}</span>
                      )}
                      {guideData.is_premium && (
                        <span class="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-medium">
                          <i class="fas fa-crown mr-1"></i>PRO
                        </span>
                      )}
                    </div>
                    <h1 class="text-2xl font-bold text-gray-900 mb-2">{guideData.title}</h1>
                    <p class="text-gray-500 text-sm">{guideData.summary}</p>
                  </div>
                </div>
                <div class="flex items-center gap-4 text-xs text-gray-400 border-t border-gray-50 pt-3">
                  <span><i class="fas fa-eye mr-1"></i>{guideData.view_count}회 조회</span>
                  <span><i class="fas fa-clock mr-1"></i>{guideData.updated_at ? new Date(guideData.updated_at).toLocaleDateString('ko-KR') : '-'}</span>
                  {guideData.updated_by && (
                    <span><i class="fas fa-user-edit mr-1"></i>{guideData.updated_by}</span>
                  )}
                </div>
              </div>

              {/* ── 실무 양식 다운로드 섹션 ── */}
              {hasAttachments && (
                <div class="bg-gradient-to-br from-emerald-50 to-teal-50 border border-emerald-200 rounded-2xl p-6 shadow-sm">
                  <div class="flex items-center gap-3 mb-4">
                    <div class="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center">
                      <i class="fas fa-file-download text-white"></i>
                    </div>
                    <div>
                      <h3 class="font-bold text-emerald-900 text-base">📥 실무 양식 다운로드</h3>
                      <p class="text-emerald-600 text-xs mt-0.5">중소기업(SME) 실무에 바로 쓰는 엑셀 양식</p>
                    </div>
                  </div>
                  <div class="space-y-3">
                    {attachments.map(att => (
                      <a
                        href={`/api/files/download-proxy?url=${encodeURIComponent(att.url)}&name=${encodeURIComponent(att.name)}`}
                        class="flex items-center gap-3 bg-white rounded-xl px-4 py-3 border border-emerald-100 hover:border-emerald-400 hover:shadow-md transition-all group cursor-pointer"
                        download={att.name}
                      >
                        <span dangerouslySetInnerHTML={{ __html: getFileIcon(att.name) }} />
                        <div class="flex-1 min-w-0">
                          <div class="font-medium text-gray-800 text-sm truncate group-hover:text-emerald-700">{att.name}</div>
                          <div class="text-xs text-gray-400 mt-0.5">클릭하면 즉시 다운로드</div>
                        </div>
                        <div class="flex-shrink-0">
                          <span class="text-xs bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full font-medium group-hover:bg-emerald-500 group-hover:text-white transition-colors">
                            <i class="fas fa-download mr-1"></i>다운로드
                          </span>
                        </div>
                      </a>
                    ))}
                  </div>
                  <p class="text-xs text-emerald-500 mt-3">
                    <i class="fas fa-info-circle mr-1"></i>
                    업무에 바로 활용할 수 있는 실무 양식입니다. 다운로드 후 회사 실정에 맞게 수정하여 사용하세요.
                  </p>
                </div>
              )}

              {/* 본문 */}
              <div class="bg-white rounded-2xl border border-gray-100 p-8 shadow-sm">
                <div
                  class="prose-bizready text-gray-700 leading-relaxed"
                  dangerouslySetInnerHTML={{ __html: contentHtml }}
                />
                {/* 태그 */}
                {guideData.tags && (guideData.tags as string[]).length > 0 && (
                  <div class="flex flex-wrap gap-2 mt-8 pt-6 border-t border-gray-100">
                    {(guideData.tags as string[]).map((tag: string) => (
                      <a href={`/dashboard/search?q=${encodeURIComponent(tag)}`}
                         class="text-xs bg-gray-100 hover:bg-blue-100 hover:text-blue-700 text-gray-500 px-3 py-1 rounded-full transition-colors">
                        #{tag}
                      </a>
                    ))}
                  </div>
                )}
              </div>

              {/* 법령 안내 (인사노무 카테고리) */}
              {(guideData.category === '인사노무' || guideData.category === '인사·노무') && (
                <div class="bg-blue-50 border border-blue-200 rounded-xl p-4">
                  <div class="flex items-start gap-3">
                    <i class="fas fa-landmark text-blue-500 mt-0.5"></i>
                    <div>
                      <div class="font-medium text-blue-800 text-sm mb-1">법령 조항 안내</div>
                      <p class="text-blue-600 text-xs leading-relaxed">
                        본 가이드의 <strong class="underline decoration-dotted">근로기준법 조항 링크</strong>를 클릭하면 국가법령정보센터에서 원문을 확인할 수 있습니다.
                        법령은 개정될 수 있으니 중요한 의사결정 시 전문가 상담을 권장합니다.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </article>

            {/* 우측 사이드바 */}
            <aside class="w-64 flex-shrink-0 space-y-4">
              {/* 메모 카드 */}
              <div class="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm sticky top-20">
                <h3 class="font-bold text-gray-800 mb-3 flex items-center gap-2 text-sm">
                  <i class="fas fa-sticky-note text-yellow-500"></i> 내 메모
                </h3>
                <textarea
                  id="memo-area"
                  rows={6}
                  placeholder="이 가이드에 대한 메모를 남겨보세요..."
                  class="w-full text-sm border border-gray-200 rounded-lg p-3 resize-none focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-700"
                >{userNote?.memo ?? ''}</textarea>
                <button
                  id="save-memo-btn"
                  class="w-full mt-2 bg-blue-600 text-white text-sm font-medium py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <i class="fas fa-save mr-1"></i> 저장
                </button>
                <div id="memo-msg" class="text-xs text-center mt-2 hidden"></div>

                <hr class="my-3 border-gray-100" />
                <button
                  id="bookmark-btn"
                  class={`w-full text-sm font-medium py-2 rounded-lg transition-colors border ${userNote?.is_bookmarked ? 'bg-amber-50 text-amber-700 border-amber-300' : 'border-gray-200 text-gray-600 hover:border-amber-300 hover:text-amber-600'}`}
                >
                  <i class="fas fa-bookmark mr-1"></i>
                  <span id="bookmark-label">{userNote?.is_bookmarked ? '북마크 됨' : '북마크 추가'}</span>
                </button>

                {/* 파일 없을 때 빈 영역 안내 */}
                {!hasAttachments && (
                  <div class="mt-4 bg-gray-50 rounded-xl p-3 text-center">
                    <i class="fas fa-file-excel text-gray-300 text-2xl mb-2 block"></i>
                    <p class="text-xs text-gray-400">아직 첨부된 실무 양식이 없습니다</p>
                  </div>
                )}
              </div>
            </aside>
          </div>
        </div>
      </main>

      <style>{`
        .gradient-bg { background: linear-gradient(180deg, #1e3a5f 0%, #0f2544 100%); }
        .sidebar-item { transition: all 0.15s; }
        .sidebar-item:hover { background: rgba(255,255,255,0.1); }
        .sidebar-item.active { background: rgba(255,255,255,0.15); }
        .law-link { background: rgba(59,130,246,0.08); padding: 1px 6px; border-radius: 4px; }
        .law-link:hover { background: rgba(59,130,246,0.15); }
        .prose-bizready table { border-collapse: collapse; }
        .prose-bizready thead th { background: #f8fafc; font-weight: 600; color: #374151; padding: 8px 16px; border-bottom: 2px solid #e5e7eb; }
      `}</style>

      <script dangerouslySetInnerHTML={{ __html: `
const SUPABASE_URL = '${c.env.SUPABASE_URL}'
const SUPABASE_ANON_KEY = '${c.env.SUPABASE_ANON_KEY}'
const GUIDE_ID = '${guideData.id}'
const USER_ID = '${userId}'
let isBookmarked = ${userNote?.is_bookmarked ?? false}

// Supabase CDN
const script = document.createElement('script')
script.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js'
script.onload = () => {
  const { createClient } = supabase
  const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

  // 메모 저장
  document.getElementById('save-memo-btn').addEventListener('click', async () => {
    const memo = document.getElementById('memo-area').value
    const msg = document.getElementById('memo-msg')
    const { error } = await client.from('user_notes').upsert({
      user_id: USER_ID, guide_id: GUIDE_ID, memo,
      is_bookmarked: isBookmarked, updated_at: new Date().toISOString()
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
      user_id: USER_ID, guide_id: GUIDE_ID, memo,
      is_bookmarked: isBookmarked, updated_at: new Date().toISOString()
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
}
document.head.appendChild(script)
` }} />
    </div>,
    { title: `${guideData.title} | BizReady` }
  )
})

export default guide
