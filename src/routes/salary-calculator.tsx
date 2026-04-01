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
                <p class="text-xs text-gray-500 mt-0.5">2026년 4대보험 요율 기준 · 세후 실수령액 계산</p>
              </div>
              <span class="ml-auto text-xs px-2.5 py-1 bg-violet-100 text-violet-700 rounded-full font-semibold">2026년 기준</span>
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
              <p>본 계산기는 2026년 기준 참고용이며 실제 급여와 다를 수 있습니다. 소득세는 근로소득 간이세액표 공식 기반 근사값입니다. 정확한 계산은 급여 담당자 또는 세무사에게 문의하세요.</p>
            </div>

          </div>
        </div>
      </div>

      <script dangerouslySetInnerHTML={{ __html: `
(function () {
  // ════════════════════════════════════════════════════
  //  2026년 4대보험 요율 상수
  // ════════════════════════════════════════════════════
  var RATES = {
    // 국민연금
    NP_EMPLOYEE:  0.045,          // 근로자 4.5%
    NP_EMPLOYER:  0.045,          // 사업주 4.5%
    NP_MAX_BASE:  6170000,        // 기준소득월액 상한
    NP_MIN_BASE:  370000,         // 기준소득월액 하한

    // 건강보험
    HI_EMPLOYEE:  0.03545,        // 근로자 3.545%
    HI_EMPLOYER:  0.03545,        // 사업주 3.545%
    LTC_RATE:     0.1295,         // 장기요양: 건강보험료 × 12.95%

    // 고용보험
    EI_EMPLOYEE:  0.009,          // 근로자 0.9%
    EI_EMPLOYER:  0.0115,         // 사업주 1.15% (150인 미만)
  }

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
  //  소득세 계산 (간이세액표 공식 기반)
  // ════════════════════════════════════════════════════
  function calcIncomeTax(monthlySalary, nonTaxable, dependents) {
    // 1. 과세 월급여
    var taxableMonthly = Math.max(0, monthlySalary - nonTaxable)
    // 2. 연간 과세급여
    var annual = taxableMonthly * 12

    // 3. 근로소득공제
    var ded
    if      (annual <= 5000000)   ded = annual * 0.70
    else if (annual <= 15000000)  ded = 3500000  + (annual - 5000000)   * 0.40
    else if (annual <= 45000000)  ded = 7500000  + (annual - 15000000)  * 0.15
    else if (annual <= 100000000) ded = 12000000 + (annual - 45000000)  * 0.05
    else                          ded = 14750000
    ded = Math.min(ded, 20000000)  // 한도 2,000만원

    // 4. 근로소득금액
    var earnedIncome = annual - ded

    // 5. 인적공제 (본인1 + 부양가족)
    var persons = 1 + dependents
    var personalDed = persons * 1500000

    // 6. 과세표준
    var taxBase = Math.max(0, earnedIncome - personalDed)

    // 7. 누진세율 적용
    var tax
    if      (taxBase <= 14000000)   tax = taxBase * 0.06
    else if (taxBase <= 50000000)   tax = 840000    + (taxBase - 14000000)   * 0.15
    else if (taxBase <= 88000000)   tax = 6240000   + (taxBase - 50000000)   * 0.24
    else if (taxBase <= 150000000)  tax = 15360000  + (taxBase - 88000000)   * 0.35
    else if (taxBase <= 300000000)  tax = 37060000  + (taxBase - 150000000)  * 0.38
    else if (taxBase <= 500000000)  tax = 94060000  + (taxBase - 300000000)  * 0.40
    else if (taxBase <= 1000000000) tax = 174060000 + (taxBase - 500000000)  * 0.42
    else                            tax = 384060000 + (taxBase - 1000000000) * 0.45

    // 8. 근로소득세액공제
    var credit
    if (tax <= 1300000) credit = tax * 0.55
    else                credit = 715000 + (tax - 1300000) * 0.30

    // 세액공제 한도
    var creditLimit
    if      (annual <= 33000000) creditLimit = 740000
    else if (annual <= 70000000) creditLimit = Math.max(660000, 740000 - (annual - 33000000) * 0.008)
    else                         creditLimit = Math.max(500000, 660000 - (annual - 70000000) * 0.5)
    credit = Math.min(credit, creditLimit)

    // 9. 결정세액 → 월할 (10원 단위 절사)
    var finalTax = Math.max(0, tax - credit)
    return round10(finalTax / 12)
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
    // 장기요양 (건강보험료 기준, 근로자/사업주 각 50%)
    var ltcBase     = (hiEmployee + hiEmployer)   // 건보 합계
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
      ['장기요양보험', '건보료 × 12.95% × 50%', ltcEmployee],
      ['고용보험', fmtPct(RATES.EI_EMPLOYEE), eiEmployee],
      ['소득세', '간이세액표 기준', incomeTax],
      ['지방소득세', '소득세 × 10%', localTax],
    ]
    var empHtml = empRows.map(function(r) {
      return '<tr class="border-b border-gray-50 hover:bg-gray-50">' +
        '<td class="px-5 py-2.5 text-gray-700">' + r[0] + '</td>' +
        '<td class="px-5 py-2.5 text-right text-gray-400 text-xs">' + r[1] + '</td>' +
        '<td class="px-5 py-2.5 text-right font-medium text-gray-800">' + fmt(r[2]) + '</td>' +
        '</tr>'
    }).join('')
    document.getElementById('employee-table').innerHTML = empHtml

    // ── 렌더링: 사업주 부담표 ─────────────────────
    var emplRows = [
      ['국민연금', fmtPct(RATES.NP_EMPLOYER) + (npCapped ? ' (상한 적용)' : ''), npEmployer],
      ['건강보험', fmtPct(RATES.HI_EMPLOYER), hiEmployer],
      ['장기요양보험', '건보료 × 12.95% × 50%', ltcEmployer],
      ['고용보험', fmtPct(RATES.EI_EMPLOYER) + ' (150인 미만)', eiEmployer],
      ['산재보험', '업종별 상이', null],
    ]
    var emplHtml = emplRows.map(function(r) {
      var amtCell = r[2] !== null
        ? '<td class="px-5 py-2.5 text-right font-medium text-gray-800">' + fmt(r[2]) + '</td>'
        : '<td class="px-5 py-2.5 text-right text-xs text-amber-600 font-medium">별도 확인</td>'
      return '<tr class="border-b border-gray-50 hover:bg-gray-50">' +
        '<td class="px-5 py-2.5 text-gray-700">' + r[0] + '</td>' +
        '<td class="px-5 py-2.5 text-right text-gray-400 text-xs">' + r[1] + '</td>' +
        amtCell +
        '</tr>'
    }).join('')
    document.getElementById('employer-table').innerHTML = emplHtml

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
