// ============================================================
// GET /dashboard/leave-calculator — 연차 계산기
// ============================================================
import { Hono } from 'hono'
import { renderer } from '../renderer'
import { parseSessionCookie } from '../lib/session'
import { getSupabaseClientWithToken } from '../lib/supabase'
import { Sidebar, MobileMenuButton } from '../lib/sidebar'
import type { Env } from '../lib/supabase'

const leaveCalcRoute = new Hono<{ Bindings: Env }>()
leaveCalcRoute.use(renderer)

leaveCalcRoute.get('/', async (c) => {
  const cookie = c.req.header('Cookie') ?? ''
  const sessionStr = parseSessionCookie(cookie)
  if (!sessionStr) return c.redirect('/login?error=unauthorized')

  let userName = '사용자', userInitial = 'U', isPaid = false

  try {
    const sessionObj = JSON.parse(decodeURIComponent(sessionStr))
    const supabase = getSupabaseClientWithToken(c.env, sessionObj.access_token)
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return c.redirect('/login?error=session_expired')
    userName = (user.user_metadata?.full_name as string) || user.email?.split('@')[0] || '사용자'
    userInitial = userName.charAt(0).toUpperCase()
    const { data: profile } = await supabase.from('user_profiles').select('is_paid').eq('id', user.id).single()
    isPaid = profile?.is_paid ?? false
  } catch {
    return c.redirect('/login?error=session_expired')
  }

  const today = new Date().toISOString().slice(0, 10)

  return c.render(
    <div class="flex h-screen overflow-hidden">
      <Sidebar userName={userName} userInitial={userInitial} isPaid={isPaid} currentPath="/dashboard/leave-calculator" />

      <div class="flex-1 flex flex-col overflow-hidden">
        {/* 모바일 헤더 */}
        <div class="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 flex-shrink-0">
          <MobileMenuButton userName={userName} userInitial={userInitial} title="연차 계산기" />
        </div>

        {/* 본문 */}
        <div class="flex-1 overflow-y-auto bg-gray-50">
          <div class="max-w-3xl mx-auto px-4 py-6">

            {/* 헤더 */}
            <div class="flex items-center gap-3 mb-6">
              <div class="w-11 h-11 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-sm flex-shrink-0">
                <i class="fas fa-calendar-check text-white"></i>
              </div>
              <div>
                <h1 class="text-xl font-bold text-gray-800">연차 계산기</h1>
                <p class="text-xs text-gray-500 mt-0.5">입사일 기준 근로기준법 개정 전·후 자동 적용</p>
              </div>
            </div>

            {/* 법령 기준 안내 카드 */}
            <div class="grid grid-cols-3 gap-3 mb-6 text-xs">
              {[
                { color: 'border-gray-300 bg-gray-50', badge: 'bg-gray-200 text-gray-700', title: '개정 전', period: '~ 2017. 5. 29.', desc: '월별 연차가 2년차 15일에서 차감' },
                { color: 'border-blue-200 bg-blue-50', badge: 'bg-blue-100 text-blue-700', title: '1차 개정', period: '2017. 5. 30. ~ 2020. 3. 30.', desc: '차감 없음, 각 연차별 1년 후 소멸' },
                { color: 'border-emerald-200 bg-emerald-50', badge: 'bg-emerald-100 text-emerald-700', title: '2차 개정', period: '2020. 3. 31. ~', desc: '차감 없음, 입사일 기준 1년 후 소멸' },
              ].map(item => (
                <div class={`border ${item.color} rounded-xl p-3`}>
                  <span class={`inline-block text-xs px-2 py-0.5 rounded-full font-semibold mb-1.5 ${item.badge}`}>{item.title}</span>
                  <div class="text-gray-500 text-xs mb-1">{item.period}</div>
                  <div class="text-gray-600">{item.desc}</div>
                </div>
              ))}
            </div>

            {/* 입력 폼 */}
            <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-4">
              <h2 class="font-bold text-gray-800 mb-4 text-sm"><i class="fas fa-sliders-h mr-2 text-emerald-500"></i>정보 입력</h2>
              <div class="grid sm:grid-cols-2 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1.5">
                    입사일 <span class="text-red-500">*</span>
                  </label>
                  <input
                    id="hire-date"
                    type="date"
                    class="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                  <p class="text-xs text-gray-400 mt-1">근로계약서상 입사일 기준</p>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1.5">
                    기준일 <span class="text-gray-400 text-xs font-normal">(기본값: 오늘)</span>
                  </label>
                  <input
                    id="ref-date"
                    type="date"
                    value={today}
                    class="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
                  />
                  <p class="text-xs text-gray-400 mt-1">연차 현황을 확인할 날짜</p>
                </div>
              </div>
              <div id="calc-error" class="hidden mt-3 text-sm text-red-500 bg-red-50 px-4 py-2.5 rounded-xl">
                <i class="fas fa-exclamation-circle mr-1"></i><span id="calc-error-msg"></span>
              </div>
              <button
                id="calc-btn"
                class="mt-5 w-full py-3 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-white font-semibold rounded-xl shadow-sm transition-all text-sm flex items-center justify-center gap-2"
              >
                <i class="fas fa-calculator"></i>연차 계산하기
              </button>
            </div>

            {/* 결과 영역 (JS로 채워짐) */}
            <div id="result-area" class="hidden"></div>

            {/* 법적 고지 */}
            <div class="mt-6 flex items-start gap-2 text-xs text-gray-400">
              <i class="fas fa-info-circle mt-0.5 flex-shrink-0"></i>
              <p>본 계산기는 참고용이며 100% 출근 가정 기준으로 계산됩니다. 실제 연차는 출근율, 소수점 처리 방식, 취업규칙 등에 따라 다를 수 있습니다. 중요한 사항은 노무사 또는 고용노동부에 확인하시기 바랍니다.</p>
            </div>

          </div>
        </div>
      </div>

      <script dangerouslySetInnerHTML={{ __html: `
(function () {
  // ── 날짜 유틸 ──────────────────────────────────────────
  function addMonths(date, n) {
    var d = new Date(date)
    d.setMonth(d.getMonth() + n)
    return d
  }
  function addYears(date, n) {
    var d = new Date(date)
    d.setFullYear(d.getFullYear() + n)
    return d
  }
  function monthsBetween(d1, d2) {
    var m = (d2.getFullYear() - d1.getFullYear()) * 12 + (d2.getMonth() - d1.getMonth())
    if (d2.getDate() < d1.getDate()) m--
    return Math.max(0, m)
  }
  function yearsBetween(d1, d2) {
    var y = d2.getFullYear() - d1.getFullYear()
    var md = d2.getMonth() - d1.getMonth()
    if (md < 0 || (md === 0 && d2.getDate() < d1.getDate())) y--
    return Math.max(0, y)
  }
  function fmtDate(d) {
    return d.getFullYear() + '. ' +
      String(d.getMonth() + 1).padStart(2, '0') + '. ' +
      String(d.getDate()).padStart(2, '0') + '.'
  }

  // ── 연도별 연차 일수 계산 ──────────────────────────────
  // serviceYear: 1 = 첫 번째 만 1년, 2 = 두 번째 만 1년, ...
  function getAnnualDays(serviceYear) {
    var extra = Math.floor((serviceYear - 1) / 2)
    return Math.min(15 + extra, 25)
  }

  // ── 초기화 ────────────────────────────────────────────
  var hireInput = document.getElementById('hire-date')
  var refInput  = document.getElementById('ref-date')
  var calcBtn   = document.getElementById('calc-btn')

  calcBtn.addEventListener('click', calculate)
  hireInput.addEventListener('change', function () { if (hireInput.value && refInput.value) calculate() })
  refInput.addEventListener('change',  function () { if (hireInput.value && refInput.value) calculate() })

  function showError(msg) {
    document.getElementById('calc-error').classList.remove('hidden')
    document.getElementById('calc-error-msg').textContent = msg
    document.getElementById('result-area').classList.add('hidden')
  }
  function hideError() {
    document.getElementById('calc-error').classList.add('hidden')
  }

  // ── 메인 계산 함수 ────────────────────────────────────
  function calculate() {
    var hireDateStr = hireInput.value
    var refDateStr  = refInput.value
    if (!hireDateStr || !refDateStr) return

    var hireDate = new Date(hireDateStr)
    var refDate  = new Date(refDateStr)
    if (isNaN(hireDate.getTime()) || isNaN(refDate.getTime())) return
    if (hireDate >= refDate) { showError('기준일은 입사일보다 이후여야 합니다.'); return }

    hideError()

    // ── 법령 케이스 판별 ──────────────────────────────
    var CASE1_CUTOFF = new Date('2017-05-29')  // 이 날짜까지 → 개정 전
    var CASE3_START  = new Date('2020-03-31')   // 이 날짜부터 → 2차 개정

    var legalCase
    if (hireDate <= CASE1_CUTOFF)      legalCase = 1
    else if (hireDate < CASE3_START)   legalCase = 2
    else                               legalCase = 3

    var totalMonths = monthsBetween(hireDate, refDate)

    if (totalMonths < 1) {
      renderEmpty()
      return
    }

    // ── 연차 발생 목록 구성 ───────────────────────────
    var periods = []

    // 1) 월별 연차 (입사 1~11개월차)
    for (var m = 1; m <= 11; m++) {
      var grantDate = addMonths(hireDate, m)
      if (grantDate > refDate) break

      var expiryDate
      if (legalCase === 2) {
        // 1차 개정: 발생일 기준 1년 후 소멸 (개별 소멸)
        expiryDate = addYears(grantDate, 1)
      } else {
        // 개정 전 & 2차 개정: 입사일 기준 1년 후 일괄 소멸
        expiryDate = addYears(hireDate, 1)
      }

      periods.push({
        label: '입사 ' + m + '개월차 (월별)',
        days: 1,
        grantDate: grantDate,
        expiryDate: expiryDate,
        expired: expiryDate <= refDate,
        isCase1Monthly: legalCase === 1
      })
    }

    // 2) 연간 연차 (만 1년·2년·3년... 시점)
    for (var yr = 1; yr <= 40; yr++) {
      var annualGrant = addYears(hireDate, yr)
      if (annualGrant > refDate) break

      var days = getAnnualDays(yr)
      var annualExpiry = addYears(annualGrant, 1)

      periods.push({
        label: '입사 ' + yr + '년차 (연간)',
        days: days,
        grantDate: annualGrant,
        expiryDate: annualExpiry,
        expired: annualExpiry <= refDate,
        isCase1Year1: legalCase === 1 && yr === 1
      })
    }

    // ── 합계 계산 ─────────────────────────────────────
    var totalGenerated = 0, totalExpired = 0, totalActive = 0
    for (var i = 0; i < periods.length; i++) {
      totalGenerated += periods[i].days
      if (periods[i].expired) totalExpired += periods[i].days
      else                    totalActive  += periods[i].days
    }

    renderResults(legalCase, hireDate, totalMonths, periods, totalGenerated, totalExpired, totalActive)
  }

  // ── 결과 렌더링 ───────────────────────────────────────
  function renderResults(legalCase, hireDate, totalMonths, periods, totalGenerated, totalExpired, totalActive) {
    var caseInfo = {
      1: { label: '개정 전', badgeCls: 'bg-gray-200 text-gray-700',       sub: '2017. 5. 29. 이전 입사',           borderCls: 'border-gray-200' },
      2: { label: '1차 개정', badgeCls: 'bg-blue-100 text-blue-700',      sub: '2017. 5. 30. ~ 2020. 3. 30. 입사', borderCls: 'border-blue-200' },
      3: { label: '2차 개정', badgeCls: 'bg-emerald-100 text-emerald-700', sub: '2020. 3. 31. 이후 입사',           borderCls: 'border-emerald-200' },
    }[legalCase]

    var yrs = Math.floor(totalMonths / 12)
    var mos = totalMonths % 12
    var serviceStr = (yrs > 0 ? yrs + '년 ' : '') + mos + '개월'

    // 테이블 행 생성
    var rows = ''
    for (var i = 0; i < periods.length; i++) {
      var p = periods[i]
      var expired = p.expired
      var daysCls = expired ? 'text-gray-300 line-through' : 'font-semibold text-gray-800'
      var labelCls = expired ? 'text-gray-400' : 'text-gray-700'
      var badge = expired
        ? '<span class="text-xs px-2 py-0.5 bg-gray-100 text-gray-400 rounded-full">소멸</span>'
        : '<span class="text-xs px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full">유효</span>'
      var note = ''
      if (p.isCase1Year1)   note = ' <span class="text-xs text-amber-500 font-normal">*월별 사용분 차감</span>'
      if (p.isCase1Monthly) note = ' <span class="text-xs text-amber-500 font-normal">*차감 대상</span>'

      rows += '<tr class="border-b border-gray-50 hover:bg-gray-50">' +
        '<td class="px-4 py-2.5 text-sm ' + labelCls + '">' + p.label + note + '</td>' +
        '<td class="px-4 py-2.5 text-sm text-center ' + daysCls + '">' + p.days + '일</td>' +
        '<td class="px-4 py-2.5 text-xs text-gray-400 hidden sm:table-cell">' + fmtDate(p.grantDate) + '</td>' +
        '<td class="px-4 py-2.5 text-xs text-gray-400 hidden sm:table-cell">' + fmtDate(p.expiryDate) + '</td>' +
        '<td class="px-4 py-2.5 text-center">' + badge + '</td>' +
        '</tr>'
    }

    // Case 1 경고
    var case1Warning = ''
    if (legalCase === 1) {
      case1Warning =
        '<div class="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-700 leading-relaxed">' +
        '<i class="fas fa-exclamation-triangle mr-1"></i>' +
        '<strong>개정 전 법령 주의:</strong> 입사 1년 내 실제 사용한 월별 연차 일수는 입사 1년차 연간 연차(15일)에서 차감됩니다. ' +
        '2년간 사용 가능한 연차 합계는 최대 15일입니다. 위 표의 총계는 차감 전 이론상 최대치입니다.' +
        '</div>'
    }

    var html =
      '<div class="space-y-4">' +

      // 요약 카드
      '<div class="bg-white rounded-2xl border ' + caseInfo.borderCls + ' shadow-sm p-5">' +
        '<div class="flex flex-wrap items-center gap-2 mb-4">' +
          '<span class="text-xs px-3 py-1 rounded-full font-semibold ' + caseInfo.badgeCls + '">' + caseInfo.label + ' 법령 적용</span>' +
          '<span class="text-xs text-gray-400">' + caseInfo.sub + '</span>' +
        '</div>' +
        '<div class="grid grid-cols-2 sm:grid-cols-4 gap-3">' +
          '<div class="bg-gray-50 rounded-xl p-3 text-center">' +
            '<div class="text-xs text-gray-400 mb-1">근속 기간</div>' +
            '<div class="font-bold text-gray-800 text-base">' + serviceStr + '</div>' +
          '</div>' +
          '<div class="bg-blue-50 rounded-xl p-3 text-center">' +
            '<div class="text-xs text-blue-400 mb-1">총 발생 연차</div>' +
            '<div class="font-bold text-blue-600 text-xl">' + totalGenerated + '일</div>' +
          '</div>' +
          '<div class="bg-red-50 rounded-xl p-3 text-center">' +
            '<div class="text-xs text-red-400 mb-1">소멸된 연차</div>' +
            '<div class="font-bold text-red-500 text-xl">' + totalExpired + '일</div>' +
          '</div>' +
          '<div class="bg-emerald-50 rounded-xl p-3 text-center">' +
            '<div class="text-xs text-emerald-500 mb-1">현재 사용 가능</div>' +
            '<div class="font-bold text-emerald-600 text-xl">' + totalActive + '일</div>' +
          '</div>' +
        '</div>' +
        case1Warning +
      '</div>' +

      // 발생 내역 테이블
      '<div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">' +
        '<div class="px-5 py-4 border-b border-gray-100">' +
          '<h3 class="font-bold text-gray-800 text-sm"><i class="fas fa-table mr-2 text-blue-500"></i>연도별 발생 연차 내역</h3>' +
          '<p class="text-xs text-gray-400 mt-0.5">100% 출근 가정 / 사용 이력 미반영 기준</p>' +
        '</div>' +
        '<div class="overflow-x-auto">' +
          '<table class="w-full text-sm">' +
            '<thead class="bg-gray-50 border-b border-gray-100">' +
              '<tr>' +
                '<th class="text-left px-4 py-3 text-xs text-gray-500 font-medium">구분</th>' +
                '<th class="text-center px-4 py-3 text-xs text-gray-500 font-medium">발생</th>' +
                '<th class="text-left px-4 py-3 text-xs text-gray-500 font-medium hidden sm:table-cell">발생일</th>' +
                '<th class="text-left px-4 py-3 text-xs text-gray-500 font-medium hidden sm:table-cell">소멸일</th>' +
                '<th class="text-center px-4 py-3 text-xs text-gray-500 font-medium">상태</th>' +
              '</tr>' +
            '</thead>' +
            '<tbody>' + rows + '</tbody>' +
          '</table>' +
        '</div>' +
      '</div>' +

      '</div>'

    var resultArea = document.getElementById('result-area')
    resultArea.innerHTML = html
    resultArea.classList.remove('hidden')
    setTimeout(function () {
      resultArea.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 50)
  }

  function renderEmpty() {
    var resultArea = document.getElementById('result-area')
    resultArea.innerHTML =
      '<div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-8 text-center text-gray-400">' +
      '<i class="fas fa-calendar text-3xl mb-3 block text-gray-200"></i>' +
      '<p class="font-medium">아직 연차가 발생하지 않았습니다</p>' +
      '<p class="text-sm mt-1">입사 후 1개월이 경과하면 첫 번째 연차가 발생합니다.</p>' +
      '</div>'
    resultArea.classList.remove('hidden')
  }
})()
      `}} />
    </div>,
    { title: '연차 계산기 | BizReady' }
  )
})

export default leaveCalcRoute
