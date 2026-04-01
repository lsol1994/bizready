// ============================================================
// GET /dashboard/salary-calculator — 급여 계산기
// ============================================================
import { Hono } from 'hono'
import { renderer } from '../renderer'
import { parseSessionCookie } from '../lib/session'
import { getSupabaseClientWithToken } from '../lib/supabase'
import { Sidebar, MobileMenuButton } from '../lib/sidebar'
import type { Env } from '../lib/supabase'

const salaryCalcRoute = new Hono<{ Bindings: Env }>()
salaryCalcRoute.use(renderer)

salaryCalcRoute.get('/', async (c) => {
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

  return c.render(
    <div class="flex h-screen overflow-hidden">
      <Sidebar userName={userName} userInitial={userInitial} isPaid={isPaid} currentPath="/dashboard/salary-calculator" />

      <div class="flex-1 flex flex-col overflow-hidden">
        {/* 모바일 헤더 */}
        <div class="md:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-gray-200 flex-shrink-0">
          <MobileMenuButton userName={userName} userInitial={userInitial} title="급여 계산기" />
        </div>

        {/* 본문 */}
        <div class="flex-1 overflow-y-auto bg-gray-50">
          <div class="max-w-3xl mx-auto px-4 py-6">

            {/* 헤더 */}
            <div class="flex items-center gap-3 mb-6">
              <div class="w-11 h-11 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-sm flex-shrink-0">
                <i class="fas fa-coins text-white"></i>
              </div>
              <div>
                <h1 class="text-xl font-bold text-gray-800">급여 계산기</h1>
                <p class="text-xs text-gray-500 mt-0.5">4대보험 및 원천세 공제 후 실수령액 계산</p>
              </div>
              <span id="year-badge" class="ml-auto text-xs px-2.5 py-1 bg-violet-100 text-violet-700 rounded-full font-semibold">—년 기준</span>
            </div>

            {/* 적용 기준 정보 배너 */}
            <div id="basis-banner" class="mb-4 bg-blue-50 border border-blue-100 rounded-xl px-4 py-3 text-xs text-blue-700 space-y-1 hidden">
              <div class="flex items-center gap-1.5">
                <i class="fas fa-shield-alt flex-shrink-0"></i>
                <span id="ins-basis-text"></span>
              </div>
              <div class="flex items-center gap-1.5">
                <i class="fas fa-file-invoice flex-shrink-0"></i>
                <span id="tax-basis-text"></span>
              </div>
            </div>

            {/* 입력 폼 */}
            <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mb-4">
              <h2 class="font-bold text-gray-800 mb-5 text-sm flex items-center gap-2">
                <i class="fas fa-sliders-h text-violet-500"></i>급여 정보 입력
              </h2>
              <div class="grid sm:grid-cols-3 gap-4">
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1.5">
                    월 급여 (세전) <span class="text-red-500">*</span>
                  </label>
                  <div class="relative">
                    <input
                      id="salary-input"
                      type="number"
                      min="0"
                      step="10000"
                      placeholder="3,000,000"
                      class="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm pr-8 focus:outline-none focus:ring-2 focus:ring-violet-400"
                    />
                    <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">원</span>
                  </div>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1.5">
                    비과세 금액
                    <span class="text-xs text-gray-400 font-normal ml-1">(식대 등)</span>
                  </label>
                  <div class="relative">
                    <input
                      id="nontax-input"
                      type="number"
                      min="0"
                      step="10000"
                      value="200000"
                      class="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm pr-8 focus:outline-none focus:ring-2 focus:ring-violet-400"
                    />
                    <span class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">원</span>
                  </div>
                  <p class="text-xs text-gray-400 mt-1">식대 최대 20만원 비과세</p>
                </div>
                <div>
                  <label class="block text-sm font-medium text-gray-700 mb-1.5">
                    부양가족 수
                    <span class="text-xs text-gray-400 font-normal ml-1">(본인 제외)</span>
                  </label>
                  <select
                    id="dependent-input"
                    class="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
                  >
                    {[0,1,2,3,4,5,6,7,8,9,10].map(n => (
                      <option value={String(n)}>{n}명</option>
                    ))}
                  </select>
                  <p class="text-xs text-gray-400 mt-1">인적공제 산정 기준</p>
                </div>
              </div>
            </div>

            {/* 결과 영역 */}
            <div id="result-area" class="hidden space-y-4">

              {/* 실수령액 강조 카드 */}
              <div id="net-card" class="bg-gradient-to-r from-violet-600 to-purple-600 rounded-2xl p-5 text-white shadow-md">
                <div class="flex items-center justify-between">
                  <div>
                    <p class="text-violet-200 text-sm mb-1">세후 실수령액</p>
                    <p id="net-salary" class="text-3xl font-bold tracking-tight">—</p>
                  </div>
                  <div class="text-right">
                    <p class="text-violet-200 text-xs mb-1">총 공제액</p>
                    <p id="total-deduction" class="text-xl font-semibold">—</p>
                    <p class="text-violet-300 text-xs mt-0.5">공제율 <span id="deduction-rate">—</span></p>
                  </div>
                </div>
              </div>

              {/* 근로자 공제 내역 */}
              <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h3 class="font-bold text-gray-800 text-sm">
                    <i class="fas fa-user mr-2 text-violet-500"></i>근로자 공제 내역
                  </h3>
                  <span class="text-xs text-gray-400">월급여에서 공제</span>
                </div>
                <table class="w-full text-sm">
                  <thead class="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th class="text-left px-5 py-3 text-xs text-gray-500 font-medium">항목</th>
                      <th class="text-right px-5 py-3 text-xs text-gray-500 font-medium">요율</th>
                      <th class="text-right px-5 py-3 text-xs text-gray-500 font-medium">공제액</th>
                    </tr>
                  </thead>
                  <tbody id="employee-table">
                  </tbody>
                  <tfoot class="border-t-2 border-gray-200 bg-violet-50">
                    <tr>
                      <td class="px-5 py-3 font-bold text-gray-800 text-sm" colspan={2}>총 공제액</td>
                      <td class="px-5 py-3 text-right font-bold text-violet-700" id="tfoot-total">—</td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              {/* 사업주 부담 참고 */}
              <div class="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
                <div class="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h3 class="font-bold text-gray-800 text-sm">
                    <i class="fas fa-building mr-2 text-blue-500"></i>사업주 부담 (참고)
                  </h3>
                  <span class="text-xs text-gray-400">별도 부담 · 급여 공제 아님</span>
                </div>
                <table class="w-full text-sm">
                  <thead class="bg-gray-50 border-b border-gray-100">
                    <tr>
                      <th class="text-left px-5 py-3 text-xs text-gray-500 font-medium">항목</th>
                      <th class="text-right px-5 py-3 text-xs text-gray-500 font-medium">요율</th>
                      <th class="text-right px-5 py-3 text-xs text-gray-500 font-medium">부담액</th>
                    </tr>
                  </thead>
                  <tbody id="employer-table">
                  </tbody>
                  <tfoot class="border-t-2 border-gray-200 bg-blue-50">
                    <tr>
                      <td class="px-5 py-3 font-bold text-gray-800 text-sm" colspan={2}>총 사업주 부담</td>
                      <td class="px-5 py-3 text-right font-bold text-blue-700" id="employer-total">—</td>
                    </tr>
                  </tfoot>
                </table>
                <div class="px-5 py-3 bg-amber-50 border-t border-amber-100 text-xs text-amber-700 flex items-start gap-1.5">
                  <i class="fas fa-info-circle mt-0.5 flex-shrink-0"></i>
                  <span>산재보험은 업종별 요율이 다르며 위 표에 포함되지 않습니다. 고용노동부 고시 기준으로 별도 확인하세요.</span>
                </div>
              </div>

              {/* 과세 기준 요약 */}
              <div id="tax-summary" class="bg-gray-50 rounded-2xl border border-gray-100 px-5 py-4 text-xs text-gray-500 space-y-1">
              </div>

            </div>

            {/* 빈 상태 (초기) */}
            <div id="empty-state" class="bg-white rounded-2xl border border-gray-100 shadow-sm p-10 text-center text-gray-400">
              <i class="fas fa-coins text-4xl mb-3 block text-gray-200"></i>
              <p class="font-medium text-gray-500">월 급여를 입력하면 자동으로 계산됩니다</p>
              <p class="text-sm mt-1">4대보험 공제 후 실수령액을 바로 확인하세요</p>
            </div>

            {/* 법적 고지 */}
            <div class="mt-5 flex items-start gap-2 text-xs text-gray-400">
              <i class="fas fa-info-circle mt-0.5 flex-shrink-0"></i>
              <p>본 계산기는 참고용이며 실제 급여와 다를 수 있습니다. 소득세는 근로소득 간이세액표 기반 근사값입니다. 정확한 계산은 급여 담당자 또는 세무사에게 문의하세요.</p>
            </div>

          </div>
        </div>
      </div>

      <script dangerouslySetInnerHTML={{ __html: `
(function () {
  // ════════════════════════════════════════════════════
  //  연도별 4대보험 요율 테이블 (매년 1월 1일 기준)
  // ════════════════════════════════════════════════════
  var INSURANCE_RATES = {
    2025: {
      NP_EMPLOYEE: 0.045, NP_EMPLOYER: 0.045,
      NP_MAX_BASE: 5900000, NP_MIN_BASE: 370000,
      HI_EMPLOYEE: 0.03545, HI_EMPLOYER: 0.03545,
      LTC_RATE: 0.1295,
      EI_EMPLOYEE: 0.009, EI_EMPLOYER: 0.0115,
    },
    2026: {
      NP_EMPLOYEE: 0.045, NP_EMPLOYER: 0.045,
      NP_MAX_BASE: 6370000, NP_MIN_BASE: 390000,
      HI_EMPLOYEE: 0.03545, HI_EMPLOYER: 0.03545,
      LTC_RATE: 0.1295,
      EI_EMPLOYEE: 0.009, EI_EMPLOYER: 0.0115,
    },
  }

  // ════════════════════════════════════════════════════
  //  연도별 소득세 간이세액표 (매년 3월 31일 기준 적용)
  //  bracket: { max, pct, minus } — 과세 월급여 기준, 부양가족 1인(본인만) 기준
  // ════════════════════════════════════════════════════
  var TAX_TABLES = {
    2025: [
      { max: 1060000,  pct: 0,    minus: 0       },
      { max: 1500000,  pct: 0.025, minus: 26500  },
      { max: 3000000,  pct: 0.050, minus: 64000  },
      { max: 4500000,  pct: 0.150, minus: 364000 },
      { max: 7000000,  pct: 0.200, minus: 589000 },
      { max: 10000000, pct: 0.300, minus: 1289000},
      { max: Infinity, pct: 0.350, minus: 1789000},
    ],
    2026: [
      { max: 1060000,  pct: 0,    minus: 0       },
      { max: 1500000,  pct: 0.025, minus: 26500  },
      { max: 3000000,  pct: 0.050, minus: 64000  },
      { max: 4500000,  pct: 0.150, minus: 364000 },
      { max: 7000000,  pct: 0.200, minus: 589000 },
      { max: 10000000, pct: 0.300, minus: 1289000},
      { max: Infinity, pct: 0.350, minus: 1789000},
    ],
  }

  // ════════════════════════════════════════════════════
  //  적용 연도 결정
  // ════════════════════════════════════════════════════
  var today     = new Date()
  var curYear   = today.getFullYear()
  var curMonth  = today.getMonth() + 1  // 1-12
  var curDay    = today.getDate()

  // 4대보험: 1월 1일 기준 → 현재 연도 요율 사용
  var insYears  = Object.keys(INSURANCE_RATES).map(Number).sort()
  var insYear   = INSURANCE_RATES[curYear]
    ? curYear
    : insYears[insYears.length - 1]  // fallback: 가장 최신 연도
  var RATES     = INSURANCE_RATES[insYear]

  // 소득세 간이세액표: 3월 31일 이후면 해당 연도, 이전이면 전년도
  var after331  = curMonth > 3 || (curMonth === 3 && curDay >= 31)
  var taxYearCandidate = after331 ? curYear : curYear - 1
  var taxYears  = Object.keys(TAX_TABLES).map(Number).sort()
  var taxYear   = TAX_TABLES[taxYearCandidate]
    ? taxYearCandidate
    : taxYears[taxYears.length - 1]  // fallback: 가장 최신 연도
  var BRACKETS  = TAX_TABLES[taxYear]

  // ── 배너 & 배지 업데이트 ─────────────────────────
  document.getElementById('year-badge').textContent = insYear + '년 기준'
  document.getElementById('ins-basis-text').textContent =
    insYear + '년 4대보험 요율 적용 중 (기준일: ' + insYear + '.01.01)'
  document.getElementById('tax-basis-text').textContent =
    taxYear + '년 원천세 간이세액표 적용 중 (기준일: ' + taxYear + '.03.31)'
  document.getElementById('basis-banner').classList.remove('hidden')

  // ── 이벤트 바인딩 ─────────────────────────────────
  document.getElementById('salary-input').addEventListener('input', calculate)
  document.getElementById('nontax-input').addEventListener('input', calculate)
  document.getElementById('dependent-input').addEventListener('change', calculate)

  // ── 포맷 헬퍼 ────────────────────────────────────
  function fmt(n) {
    return Math.round(n).toLocaleString('ko-KR') + '원'
  }
  function fmtPct(r) {
    return (r * 100).toFixed(3).replace(/\\.?0+$/, '') + '%'
  }
  function round10(n) {
    return Math.floor(n / 10) * 10
  }

  // ════════════════════════════════════════════════════
  //  소득세 계산 (간이세액표 브래킷 기반)
  //  - 과세 월급여(taxable)로 브래킷 조회 → 기본세액 산출 (부양가족 1인=본인만)
  //  - 부양가족 추가 시: 1인당 연 150만원 인적공제 상당액을 브래킷 요율로 월할 공제
  // ════════════════════════════════════════════════════
  function calcIncomeTax(monthlySalary, nonTaxable, dependents) {
    var taxable = Math.max(0, monthlySalary - nonTaxable)

    // 브래킷 조회 (부양가족 1인 = 본인만 기준)
    var bracket = BRACKETS[BRACKETS.length - 1]
    for (var i = 0; i < BRACKETS.length; i++) {
      if (taxable < BRACKETS[i].max) { bracket = BRACKETS[i]; break }
    }
    var baseTax = Math.max(0, taxable * bracket.pct - bracket.minus)

    // 추가 부양가족 인적공제: 연 150만원 × 브래킷 요율 / 12 (월할)
    if (dependents > 0) {
      var perDep = round10(1500000 * bracket.pct / 12)
      baseTax = Math.max(0, baseTax - dependents * perDep)
    }

    return round10(baseTax)
  }

  // ════════════════════════════════════════════════════
  //  메인 계산 함수
  // ════════════════════════════════════════════════════
  function calculate() {
    var salary     = parseFloat(document.getElementById('salary-input').value) || 0
    var nonTaxable = parseFloat(document.getElementById('nontax-input').value)  || 0
    var dependents = parseInt(document.getElementById('dependent-input').value)  || 0

    if (salary <= 0) {
      document.getElementById('result-area').classList.add('hidden')
      document.getElementById('empty-state').classList.remove('hidden')
      return
    }

    // ── 국민연금 ────────────────────────────────────
    var npBase     = Math.min(Math.max(salary, RATES.NP_MIN_BASE), RATES.NP_MAX_BASE)
    var npEmployee = round10(npBase * RATES.NP_EMPLOYEE)
    var npEmployer = round10(npBase * RATES.NP_EMPLOYER)
    var npCapped   = salary > RATES.NP_MAX_BASE

    // ── 건강보험 ────────────────────────────────────
    var hiEmployee  = round10(salary * RATES.HI_EMPLOYEE)
    var hiEmployer  = round10(salary * RATES.HI_EMPLOYER)
    // 장기요양 (건강보험료 합계 기준, 근로자/사업주 각 50%)
    var ltcBase     = hiEmployee + hiEmployer
    var ltcEmployee = round10(ltcBase * RATES.LTC_RATE * 0.5)
    var ltcEmployer = round10(ltcBase * RATES.LTC_RATE * 0.5)

    // ── 고용보험 ────────────────────────────────────
    var eiEmployee = round10(salary * RATES.EI_EMPLOYEE)
    var eiEmployer = round10(salary * RATES.EI_EMPLOYER)

    // ── 소득세 / 지방소득세 ─────────────────────────
    var incomeTax   = calcIncomeTax(salary, nonTaxable, dependents)
    var localTax    = round10(incomeTax * 0.10)

    // ── 합계 ────────────────────────────────────────
    var totalEmployee = npEmployee + hiEmployee + ltcEmployee + eiEmployee + incomeTax + localTax
    var totalEmployer = npEmployer + hiEmployer + ltcEmployer + eiEmployer
    var netSalary     = salary - totalEmployee
    var deductionRate = (totalEmployee / salary * 100).toFixed(1) + '%'

    // ── 렌더링: 근로자 공제표 ─────────────────────
    var empRows = [
      ['국민연금', fmtPct(RATES.NP_EMPLOYEE) + (npCapped ? ' (상한 적용)' : ''), npEmployee],
      ['건강보험', fmtPct(RATES.HI_EMPLOYEE), hiEmployee],
      ['장기요양보험', '건보료 합계 × ' + (RATES.LTC_RATE * 100).toFixed(2) + '% × 50%', ltcEmployee],
      ['고용보험', fmtPct(RATES.EI_EMPLOYEE), eiEmployee],
      ['소득세', taxYear + '년 간이세액표 기준', incomeTax],
      ['지방소득세', '소득세 × 10%', localTax],
    ]
    document.getElementById('employee-table').innerHTML = empRows.map(function(r) {
      return '<tr class="border-b border-gray-50 hover:bg-gray-50">' +
        '<td class="px-5 py-2.5 text-gray-700">' + r[0] + '</td>' +
        '<td class="px-5 py-2.5 text-right text-gray-400 text-xs">' + r[1] + '</td>' +
        '<td class="px-5 py-2.5 text-right font-medium text-gray-800">' + fmt(r[2]) + '</td>' +
        '</tr>'
    }).join('')

    // ── 렌더링: 사업주 부담표 ─────────────────────
    var emplRows = [
      ['국민연금', fmtPct(RATES.NP_EMPLOYER) + (npCapped ? ' (상한 적용)' : ''), npEmployer],
      ['건강보험', fmtPct(RATES.HI_EMPLOYER), hiEmployer],
      ['장기요양보험', '건보료 합계 × ' + (RATES.LTC_RATE * 100).toFixed(2) + '% × 50%', ltcEmployer],
      ['고용보험', fmtPct(RATES.EI_EMPLOYER) + ' (150인 미만)', eiEmployer],
      ['산재보험', '업종별 상이', null],
    ]
    document.getElementById('employer-table').innerHTML = emplRows.map(function(r) {
      var amtCell = r[2] !== null
        ? '<td class="px-5 py-2.5 text-right font-medium text-gray-800">' + fmt(r[2]) + '</td>'
        : '<td class="px-5 py-2.5 text-right text-xs text-amber-600 font-medium">별도 확인</td>'
      return '<tr class="border-b border-gray-50 hover:bg-gray-50">' +
        '<td class="px-5 py-2.5 text-gray-700">' + r[0] + '</td>' +
        '<td class="px-5 py-2.5 text-right text-gray-400 text-xs">' + r[1] + '</td>' +
        amtCell +
        '</tr>'
    }).join('')

    // ── 렌더링: 실수령액 카드 ─────────────────────
    document.getElementById('net-salary').textContent       = fmt(netSalary)
    document.getElementById('total-deduction').textContent  = fmt(totalEmployee)
    document.getElementById('deduction-rate').textContent   = deductionRate
    document.getElementById('tfoot-total').textContent      = fmt(totalEmployee)
    document.getElementById('employer-total').textContent   = fmt(totalEmployer) + ' + 산재'

    // ── 렌더링: 과세 기준 요약 ────────────────────
    var taxable = Math.max(0, salary - nonTaxable)
    document.getElementById('tax-summary').innerHTML =
      '<div class="flex flex-wrap gap-x-6 gap-y-1">' +
        '<span><span class="text-gray-400">월 급여(세전)</span> <strong class="text-gray-600">' + fmt(salary) + '</strong></span>' +
        '<span><span class="text-gray-400">비과세</span> <strong class="text-gray-600">' + fmt(nonTaxable) + '</strong></span>' +
        '<span><span class="text-gray-400">과세 급여</span> <strong class="text-gray-600">' + fmt(taxable) + '</strong></span>' +
        '<span><span class="text-gray-400">국민연금 기준소득</span> <strong class="text-gray-600">' + fmt(npBase) + (npCapped ? ' (상한)' : '') + '</strong></span>' +
        '<span><span class="text-gray-400">부양가족</span> <strong class="text-gray-600">본인 포함 ' + (1 + dependents) + '인</strong></span>' +
      '</div>'

    // ── 화면 전환 ─────────────────────────────────
    document.getElementById('empty-state').classList.add('hidden')
    document.getElementById('result-area').classList.remove('hidden')
  }
})()
      `}} />
    </div>,
    { title: '급여 계산기 | BizReady' }
  )
})

export default salaryCalcRoute
