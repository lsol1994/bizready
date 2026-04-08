import { Hono } from 'hono'
import { renderer } from '../renderer'
import { parseSessionCookie } from '../lib/session'
import { getSupabaseClientWithToken, getSupabaseAdmin } from '../lib/supabase'
import { Sidebar, MobileMenuButton } from '../lib/sidebar'
import type { Env } from '../lib/supabase'

const calendarRoute = new Hono<{ Bindings: Env }>()
calendarRoute.use(renderer)

// ── 카테고리 색상 정의 (재무/회계=빨강, 노무=노랑, 총무=파랑) ──────────
// finance : 세금·세무·급여 → 빨강 계열
// labor   : 4대보험·노무·연말정산 → 노랑 계열
// general : 비품·행정·이벤트 → 파랑 계열
// company : 사내 행사 → 파랑 (general과 동일 계열)
// team    : 팀 이벤트 → 초록
// exec    : 임원 일정 → 주황
const CATEGORY_COLOR: Record<string, string> = {
  finance: '#ef4444',  // 빨강 - 재무/회계/세금/급여
  labor:   '#ca8a04',  // 노랑(진) - 노무/4대보험/고용
  general: '#3b82f6',  // 파랑 - 총무/행정/비품/이벤트
  company: '#3b82f6',  // 파랑 - 사내 행사
  team:    '#22c55e',  // 초록 - 팀 이벤트
  exec:    '#f59e0b',  // 주황 - 임원 일정
}

// ── 국세청 2026 세무·법정 일정 (카테고리별 색상 적용) ────────────────────
const LEGAL_EVENTS = [
  // ─ 1월 ─
  { title: '원천세 반기납부 (7~12월)',          month: 1, day: 10, category: 'finance', note: '7~12월 원천세 반기납부 (소규모 사업장)' },
  { title: '지급명세서 제출 (근로·사업소득)',    month: 1, day: 31, category: 'finance', note: '근로소득·사업소득 지급명세서 홈택스 제출' },
  { title: '부가세 2기 확정 신고·납부',          month: 1, day: 25, category: 'finance', note: '2025년 7~12월분 부가가치세 신고·납부 (일반과세자)' },
  { title: '부가세 2기 확정 신고 (간이과세자)',  month: 1, day: 25, category: 'finance', note: '2025년 1~12월분 간이과세자 부가세 신고' },
  // ─ 2월 ─
  { title: '연말정산 환급/추징 급여 반영',       month: 2, day: 28, category: 'labor',   note: '2월 급여에 연말정산 결과 반영, 원천징수영수증 발급' },
  { title: '4대보험 보수총액 신고',              month: 2, day: 28, category: 'labor',   note: '2025년 건강보험·고용보험 보수총액 신고 (2.28 마감)' },
  // ─ 3월 ─
  { title: '법인세 신고·납부',                   month: 3, day: 31, category: 'finance', note: '12월 결산 법인 2025년도 법인세 신고·납부' },
  // ─ 4월 ─
  { title: '부가세 1기 예정 신고·납부',          month: 4, day: 25, category: 'finance', note: '2026년 1~3월분 부가가치세 예정 신고 (법인 사업자)' },
  { title: '4대보험 EDI 정산',                   month: 4, day: 7,  category: 'labor',   note: '4대보험 EDI 공단 정산 처리' },
  { title: '비품 구매 예산 신청',                month: 4, day: 15, category: 'general', note: '상반기 비품·소모품 예산 신청 및 승인' },
  { title: '고용보험 지원금 신청',               month: 4, day: 30, category: 'labor',   note: '고용유지지원금, 청년고용 지원금 등 신청 마감' },
  // ─ 5월 ─
  { title: '종합소득세 확정 신고·납부',          month: 5, day: 31, category: 'finance', note: '2025년 귀속 종합소득세 신고·납부' },
  { title: '개인지방소득세 신고·납부',           month: 5, day: 31, category: 'finance', note: '2025년 귀속 개인지방소득세 신고 (위택스)' },
  { title: '4대보험 보수총액 신고 확정',         month: 5, day: 15, category: 'labor',   note: '건강보험·고용보험 보수총액 최종 확정 신고' },
  { title: '차량 정기 점검',                     month: 5, day: 10, category: 'general', note: '법인 차량 정기 점검 및 보험 갱신 확인' },
  // ─ 6월 ─
  { title: '상반기 급여 정산 검토',              month: 6, day: 30, category: 'labor',   note: '4대보험 보수월액 중간 검토, 직원 변동사항 정비' },
  { title: '상반기 비품·소모품 재고 점검',       month: 6, day: 20, category: 'general', note: '사무용품·소모품 상반기 재고 현황 파악 및 발주 준비' },
  // ─ 7월 ─
  { title: '부가세 1기 확정 신고·납부',          month: 7, day: 25, category: 'finance', note: '2026년 1~6월분 부가가치세 확정 신고·납부' },
  { title: '원천세 반기납부 (1~6월)',            month: 7, day: 10, category: 'finance', note: '2026년 1~6월 원천세 반기납부 (소규모 사업장)' },
  // ─ 8월 ─
  { title: '재산세 1기 납부',                    month: 8, day: 31, category: 'finance', note: '건물·주택(1/2) 재산세 납부 기한' },
  // ─ 9월 ─
  { title: '4대보험 보수총액 신고 (6월결산법인)', month: 9, day: 30, category: 'labor',   note: '6월 결산 법인 건강보험 보수총액 신고' },
  // ─ 10월 ─
  { title: '부가세 2기 예정 신고·납부',          month: 10, day: 25, category: 'finance', note: '2026년 7~9월분 부가가치세 예정 신고 (법인 사업자)' },
  { title: '하반기 이벤트·행사 계획 수립',       month: 10, day: 10, category: 'general', note: '연말 행사, 송년회, 워크숍 등 하반기 일정 계획 수립' },
  // ─ 11월 ─
  { title: '재산세 2기 납부',                    month: 11, day: 30, category: 'finance', note: '토지·주택(1/2) 재산세 납부 기한' },
  { title: '종합부동산세 신고·납부',             month: 11, day: 30, category: 'finance', note: '2026년 종합부동산세 납부 기한' },
  { title: '연말 소모품·비품 재고 점검',         month: 11, day: 15, category: 'general', note: '연간 소모품 사용량 결산, 내년도 구매 계획 수립' },
  // ─ 12월 ─
  { title: '연말정산 간소화 자료 수집 시작',     month: 12, day: 1,  category: 'labor',   note: '직원 공제 서류 제출 안내 시작 (1월 15일 간소화 서비스 개시)' },
  { title: '연간 인건비·세무 점검',              month: 12, day: 20, category: 'labor',   note: '연간 인건비 정리, 비과세 항목 검토, 연말 가산세 방지 점검' },
  { title: '연말 비품·소모품 발주 마감',         month: 12, day: 10, category: 'general', note: '연말 정기 발주 마감 및 재고 최종 확인' },
]

// ── 메인 캘린더 GET ────────────────────────────────────
calendarRoute.get('/', async (c) => {
  const cookie     = c.req.header('Cookie') ?? ''
  const sessionStr = parseSessionCookie(cookie)
  if (!sessionStr) return c.redirect('/login?error=unauthorized')

  let userName    = '사용자'
  let userInitial = 'U'
  let isPaid      = false
  let isAdmin     = false

  try {
    let sessionObj: any
    try { sessionObj = JSON.parse(sessionStr) }
    catch { sessionObj = JSON.parse(decodeURIComponent(sessionStr)) }

    const supabase = getSupabaseClientWithToken(c.env, sessionObj.access_token)
    const { data: { user }, error: userErr } = await supabase.auth.getUser()
    if (userErr || !user) return c.redirect('/login?error=session_expired')

    userName    = (user.user_metadata?.full_name as string) || user.email?.split('@')[0] || '사용자'
    userInitial = userName.charAt(0).toUpperCase()
    isAdmin     = user.email === 'lsol3264@gmail.com'

    const { data: profile } = await supabase
      .from('user_profiles').select('is_paid').eq('id', user.id).single()
    isPaid = profile?.is_paid ?? false
  } catch {
    return c.redirect('/login?error=session_expired')
  }

  return c.render(
    <div class="flex h-screen overflow-hidden">
      <Sidebar
        userName={userName}
        userInitial={userInitial}
        isPaid={isPaid}
        currentPath="/dashboard/calendar"
      />

      {/* ── 메인 ── */}
      <main class="flex-1 overflow-y-auto bg-gray-50">
        <header class="bg-white border-b border-gray-200 px-4 md:px-8 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
          <div class="flex items-center gap-2">
            <MobileMenuButton />
            <div>
            <h1 class="text-lg md:text-xl font-bold text-gray-800"><i class="fas fa-calendar-alt text-blue-500 mr-2"></i>사내 주요 일정</h1>
            <p class="text-gray-500 text-xs mt-0.5 hidden sm:block">세무·노무 법정 기한 + 사내 일정 통합 캘린더</p>
            </div>
          </div>
          <button onclick="openAddEventModal()"
            class="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
            <i class="fas fa-plus"></i>일정 추가
          </button>
        </header>

        <div class="px-6 py-5 max-w-6xl mx-auto">
          {/* 범례 */}
          <div class="flex flex-wrap gap-3 mb-4">
            {[
              { color: 'bg-red-500',    label: '재무·회계·세금', note: '신고 기한 필수' },
              { color: 'bg-yellow-500', label: '노무·4대보험',    note: '기한 초과 시 과태료' },
              { color: 'bg-blue-500',   label: '총무·행정·비품',  note: '사내 업무 일정' },
              { color: 'bg-green-500',  label: '팀 이벤트',       note: '부서별 일정' },
              { color: 'bg-orange-400', label: '임원 일정',       note: '이사회 등' },
            ].map(l => (
              <div class="flex items-center gap-1.5 bg-white rounded-lg px-3 py-1.5 border border-gray-100 shadow-sm">
                <div class={`w-3 h-3 rounded-full ${l.color}`}></div>
                <span class="text-xs font-medium text-gray-700">{l.label}</span>
                <span class="text-xs text-gray-400">({l.note})</span>
              </div>
            ))}
          </div>

          {/* FullCalendar */}
          <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <div id="calendar"></div>
          </div>

          {/* 이번 달 주요 일정 요약 */}
          <div class="mt-5 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <h3 class="font-bold text-gray-800 mb-3 flex items-center gap-2">
              <i class="fas fa-bell text-amber-500"></i>
              <span id="upcoming-title">이번 달 주요 일정</span>
            </h3>
            <div id="upcoming-list" class="space-y-2">
              <div class="text-center py-4 text-gray-400 text-sm">
                <i class="fas fa-spinner fa-spin mr-2"></i>불러오는 중...
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* ── 일정 추가/수정 모달 ── */}
      <div id="add-event-modal" class="fixed inset-0 bg-black/50 z-50 hidden flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl w-full max-w-md shadow-2xl flex flex-col max-h-[92vh]">
          <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between flex-shrink-0">
            <h3 id="event-modal-title" class="font-bold text-gray-800">일정 추가</h3>
            <button onclick="closeAddEventModal()" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times text-xl"></i></button>
          </div>
          <div class="p-6 space-y-4 overflow-y-auto flex-1">
            <input type="hidden" id="ev-edit-id" value="" />
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">일정 제목 <span class="text-red-500">*</span></label>
              <input id="ev-title" type="text" placeholder="일정 제목"
                class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">시작일 <span class="text-red-500">*</span></label>
                <input id="ev-start" type="date"
                  class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div id="ev-end-wrap">
                <label class="block text-sm font-medium text-gray-700 mb-1">종료일</label>
                <input id="ev-end" type="date"
                  class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">분류</label>
              <select id="ev-category" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="finance">🔴 재무·회계·세금</option>
                <option value="labor">🟡 노무·4대보험</option>
                <option value="general">🔵 총무·행정·비품</option>
                <option value="company">🔵 사내 행사</option>
                <option value="team">🟢 팀 이벤트</option>
                <option value="exec">🟠 임원 일정</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">메모</label>
              <textarea id="ev-note" rows={2} placeholder="상세 설명 (선택)"
                class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"></textarea>
            </div>

            {/* ── 반복 유형 ── */}
            <div id="ev-recurring-wrap">
              <label class="block text-sm font-medium text-gray-700 mb-1">반복 유형</label>
              <select id="ev-recurring-type" onchange="toggleRecurring()"
                class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="none">반복 없음</option>
                <option value="weekly">매주 반복</option>
                <option value="monthly">매월 반복</option>
                <option value="yearly">매년 반복</option>
              </select>
            </div>

            {/* 매주 패널 */}
            <div id="ev-recurring-weekly" class="hidden bg-blue-50 rounded-xl p-4 space-y-3 border border-blue-100">
              <div>
                <label class="block text-xs font-semibold text-gray-600 mb-2">반복 요일 (다중 선택)</label>
                <div class="flex flex-wrap gap-2">
                  {[{v:0,l:'일'},{v:1,l:'월'},{v:2,l:'화'},{v:3,l:'수'},{v:4,l:'목'},{v:5,l:'금'},{v:6,l:'토'}].map(d => (
                    <label class="flex items-center gap-1 cursor-pointer">
                      <input type="checkbox" id={`ev-weekday-${d.v}`} value={String(d.v)}
                        class="rounded border-gray-300 text-blue-600" />
                      <span class={`text-sm font-medium ${d.v === 0 ? 'text-red-500' : d.v === 6 ? 'text-blue-600' : 'text-gray-700'}`}>{d.l}</span>
                    </label>
                  ))}
                </div>
              </div>
              <div>
                <label class="block text-xs font-semibold text-gray-600 mb-1">종료 날짜 <span class="text-red-500">*</span></label>
                <input id="ev-recurring-until" type="date"
                  class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
              </div>
            </div>

            {/* 매월 패널 */}
            <div id="ev-recurring-monthly" class="hidden bg-blue-50 rounded-xl p-4 space-y-3 border border-blue-100">
              <div>
                <label class="block text-xs font-semibold text-gray-600 mb-1">기준일 (1~31) <span class="text-red-500">*</span></label>
                <input id="ev-recurring-day" type="number" min="1" max="31" placeholder="10"
                  class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
              </div>
              <div>
                <label class="block text-xs font-semibold text-gray-600 mb-1">종료 날짜 <span class="text-red-500">*</span></label>
                <input id="ev-recurring-month-until" type="date"
                  class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
              </div>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" id="ev-skip-weekend" class="rounded border-gray-300 text-blue-600" />
                <span class="text-xs text-gray-600">주말이면 다음 월요일로 자동 이동</span>
              </label>
            </div>

            {/* 매년 패널 */}
            <div id="ev-recurring-yearly" class="hidden bg-blue-50 rounded-xl p-4 space-y-3 border border-blue-100">
              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block text-xs font-semibold text-gray-600 mb-1">기준 월 <span class="text-red-500">*</span></label>
                  <select id="ev-recurring-month"
                    class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
                    {['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월'].map((m, i) => (
                      <option value={String(i)}>{m}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label class="block text-xs font-semibold text-gray-600 mb-1">기준 일 <span class="text-red-500">*</span></label>
                  <input id="ev-recurring-year-day" type="number" min="1" max="31" placeholder="31"
                    class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                </div>
              </div>
              <div>
                <label class="block text-xs font-semibold text-gray-600 mb-1">종료 연도 <span class="text-red-500">*</span></label>
                <input id="ev-recurring-end-year" type="number" min="2025" max="2035"
                  class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
              </div>
              <label class="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" id="ev-skip-weekend-yearly" class="rounded border-gray-300 text-blue-600" />
                <span class="text-xs text-gray-600">주말이면 다음 월요일로 자동 이동</span>
              </label>
            </div>

            <div id="ev-error" class="hidden text-red-500 text-sm bg-red-50 p-2 rounded-lg"></div>
          </div>
          <div class="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end flex-shrink-0">
            <button onclick="closeAddEventModal()" class="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">취소</button>
            <button onclick="saveEvent()" id="save-ev-btn"
              class="px-5 py-2 text-sm bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 flex items-center gap-2">
              <i class="fas fa-save"></i>저장
            </button>
          </div>
        </div>
      </div>

      {/* ── 일정 상세 모달 ── */}
      <div id="event-detail-modal" class="fixed inset-0 bg-black/50 z-50 hidden flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl w-full max-w-sm shadow-2xl">
          <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 id="ev-detail-title" class="font-bold text-gray-800 text-base"></h3>
            <button onclick="closeEventDetail()" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times"></i></button>
          </div>
          <div id="ev-detail-body" class="p-6"></div>
          <div id="ev-detail-admin-actions" class="hidden px-6 pb-4 flex gap-2 justify-end">
            <button id="ev-edit-btn" onclick="" class="px-3 py-1.5 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 flex items-center gap-1.5">
              <i class="fas fa-edit text-xs"></i>수정
            </button>
            <button id="ev-delete-btn" onclick="" class="px-3 py-1.5 text-sm bg-red-50 text-red-500 rounded-lg hover:bg-red-100 flex items-center gap-1.5">
              <i class="fas fa-trash text-xs"></i>삭제
            </button>
          </div>
        </div>
      </div>

      {/* FullCalendar CSS + JS */}
      <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/fullcalendar@6.1.11/index.global.min.css" />
      <script src="https://cdn.jsdelivr.net/npm/fullcalendar@6.1.11/index.global.min.js"></script>

      <style>{`
        .gradient-bg { background: linear-gradient(180deg, #1e3a5f 0%, #0f2544 100%); }
        .sidebar-item { transition: all 0.15s; }
        .sidebar-item:hover { background: rgba(255,255,255,0.1); }
        .sidebar-item.active { background: rgba(255,255,255,0.15); }

        /* ── iOS 캘린더 스타일 ── */
        #calendar .fc { background: #fff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; }

        /* 헤더 */
        #calendar .fc-toolbar-title { font-size: 18px; font-weight: 700; color: #1c1c1e; }
        #calendar .fc-toolbar.fc-header-toolbar { margin-bottom: 8px; }
        #calendar .fc-button-group { gap: 0; }
        #calendar .fc-button, #calendar .fc-button-primary {
          background: transparent !important;
          border: none !important;
          box-shadow: none !important;
          color: #007aff !important;
          font-size: 22px !important;
          padding: 2px 10px !important;
          line-height: 1 !important;
        }
        #calendar .fc-button:hover, #calendar .fc-button-primary:hover {
          background: #f0f0f0 !important;
          border-radius: 6px !important;
        }
        #calendar .fc-button:focus, #calendar .fc-button-primary:focus {
          box-shadow: none !important;
        }

        /* 요일 헤더 */
        #calendar .fc-col-header-cell { padding: 6px 0; border: none !important; }
        #calendar .fc-col-header-cell-cushion {
          font-size: 12px; font-weight: 400; color: #8e8e93;
          text-decoration: none !important;
        }
        #calendar .fc-col-header-cell.fc-day-sun .fc-col-header-cell-cushion { color: #ff3b30; }
        #calendar .fc-col-header-cell.fc-day-sat .fc-col-header-cell-cushion { color: #007aff; }

        /* 날짜 숫자 */
        #calendar .fc-daygrid-day-number {
          font-size: 16px; font-weight: 400; color: #1c1c1e;
          padding: 4px 8px; text-decoration: none !important;
        }
        #calendar .fc-day-sun .fc-daygrid-day-number { color: #ff3b30; }
        #calendar .fc-day-sat .fc-daygrid-day-number { color: #007aff; }

        /* 오늘 날짜 */
        #calendar .fc-day-today { background: transparent !important; }
        #calendar .fc-day-today .fc-daygrid-day-number {
          background: #ff3b30 !important;
          color: #fff !important;
          border-radius: 50% !important;
          width: 28px !important; height: 28px !important;
          display: flex !important; align-items: center !important; justify-content: center !important;
          padding: 0 !important;
          margin: 2px !important;
        }

        /* 이벤트 */
        #calendar .fc-event {
          cursor: pointer;
          border: none !important;
          border-radius: 4px !important;
          padding: 1px 4px !important;
          font-size: 11px !important;
        }
        #calendar .fc-event-title {
          font-weight: 500;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        #calendar .fc-daygrid-event-dot { display: none !important; }

        /* +N개 더보기 */
        #calendar .fc-daygrid-more-link { font-size: 11px; color: #8e8e93; }

        /* 셀 경계선 */
        #calendar .fc td, #calendar .fc th { border-color: #e5e5ea !important; }
        #calendar .fc-scrollgrid { border-color: #e5e5ea !important; }

        /* 모바일 */
        @media (max-width: 768px) {
          #calendar .fc-toolbar-title { font-size: 15px; }
          #calendar .fc-daygrid-day-number { font-size: 14px; padding: 2px 6px; }
          #calendar .fc-event { font-size: 10px !important; }
          #calendar .fc-day-today .fc-daygrid-day-number { width: 24px !important; height: 24px !important; }
          #calendar .fc-button, #calendar .fc-button-primary { font-size: 18px !important; padding: 2px 6px !important; }
        }
      `}</style>

      <script dangerouslySetInnerHTML={{ __html: `
// ── DB 기반 이벤트만 사용 (법정기한도 DB에서 관리)
const IS_ADMIN = ${isAdmin};
// 세무(finance)/노무(labor) 분류는 관리자만 추가·수정·삭제 가능
const ADMIN_ONLY_CATS = ['finance', 'labor'];

// 카테고리별 색상 (재무/회계=빨강, 노무=노랑, 총무/행정=파랑)
const CAT_COLORS = {
  finance: '#ef4444',  // 빨강 - 재무/회계/세금/급여
  labor:   '#ca8a04',  // 노랑(진) - 노무/4대보험/고용
  general: '#3b82f6',  // 파랑 - 총무/행정/비품
  company: '#3b82f6',  // 파랑 - 사내 행사
  team:    '#22c55e',  // 초록 - 팀 이벤트
  exec:    '#f59e0b',  // 주황 - 임원 일정
  // 하위호환 (기존 데이터 대응)
  tax:     '#ef4444',
};



// ── FullCalendar 초기화 ───────────────────────────
let calendar;
let customEvents = [];

async function loadCustomEvents() {
  try {
    const res = await fetch('/dashboard/calendar/api/events');
    const data = await res.json();
    if (data.ok) customEvents = data.events || [];
  } catch(e) { console.warn('커스텀 이벤트 로드 실패', e); }
}

function mapCustomToFC(e) {
  return {
    id: String(e.id),
    title: e.title,
    start: e.start_date,
    end: e.end_date || null,
    color: CAT_COLORS[e.category] || '#3b82f6',
    extendedProps: { note: e.note, category: e.category, isLegal: false, dbId: e.id }
  };
}

// buildLegalEvents 제거 — 법정기한 일정은 DB(calendar_events)에서 관리

async function initCalendar() {
  await loadCustomEvents();
  const el = document.getElementById('calendar');
  calendar = new FullCalendar.Calendar(el, {
    locale: 'ko',
    initialView: 'dayGridMonth',
    headerToolbar: {
      left:   'prev',
      center: 'title',
      right:  'next'
    },
    height: 'auto',
    fixedWeekCount: false,
    showNonCurrentDates: false,
    dayMaxEvents: 3,
    moreLinkText: function(n) { return '+' + n + '개'; },
    events: customEvents.map(mapCustomToFC),
    eventClick: function(info) {
      showEventDetail(info.event);
    },
    datesSet: function(info) {
      updateUpcomingList(info.start, info.end);
    },
    eventDidMount: function(info) {
      // D-3 이내 일정 강조 (법정기한 여부 무관)
      const today     = new Date();
      const eventDate = new Date(info.event.start);
      const diffDays  = Math.ceil((eventDate - today) / (1000*60*60*24));
      if (diffDays >= 0 && diffDays <= 3) {
        info.el.style.outline = '2px solid #fbbf24';
        info.el.title = '⚠️ D-' + diffDays + ' ' + info.event.title;
      }
    }
  });
  calendar.render();
  updateUpcomingList(calendar.view.activeStart, calendar.view.activeEnd);
}

// ── 이번 달 일정 목록 ─────────────────────────────
function updateUpcomingList(start, end) {
  const today  = new Date();
  const events = calendar.getEvents().filter(e => {
    const d = new Date(e.start);
    return d >= start && d < end;
  }).sort((a, b) => new Date(a.start) - new Date(b.start));

  const list = document.getElementById('upcoming-list');
  if (!list) return;
  if (events.length === 0) {
    list.innerHTML = '<div class="text-center py-4 text-gray-400 text-sm">이 기간에 등록된 일정이 없습니다.</div>';
    return;
  }

  list.innerHTML = events.map(e => {
    const d        = new Date(e.start);
    const isToday  = d.toDateString() === today.toDateString();
    const isPast   = d < today && !isToday;
    const diffDays = Math.ceil((d - today) / (1000*60*60*24));
    const badge    = diffDays === 0
      ? '<span class="text-xs bg-red-500 text-white px-1.5 py-0.5 rounded font-bold ml-1">TODAY</span>'
      : (diffDays > 0 && diffDays <= 3
        ? '<span class="text-xs bg-amber-400 text-white px-1.5 py-0.5 rounded font-bold ml-1">D-' + diffDays + '</span>'
        : '');
    return '<div class="flex items-center gap-3 py-2 border-b border-gray-50 last:border-0 ' + (isPast ? 'opacity-40' : '') + '">'
      + '<div style="background:' + e.backgroundColor + '" class="w-2.5 h-2.5 rounded-full flex-shrink-0"></div>'
      + '<div class="flex-1 min-w-0">'
      + '<div class="text-sm font-medium text-gray-800 truncate">' + e.title + badge + '</div>'
      + '<div class="text-xs text-gray-400">' + d.toLocaleDateString('ko-KR', { month:'long', day:'numeric', weekday:'short' }) + '</div>'
      + '</div>'
      + (e.extendedProps.note ? '<div class="text-xs text-gray-400 max-w-xs truncate hidden md:block">' + e.extendedProps.note + '</div>' : '')
      + '</div>';
  }).join('');
}

// ── 이벤트 상세 팝업 ─────────────────────────────
let _currentEventId = null;
let _currentEventDbId = null;

function showEventDetail(event) {
  _currentEventId   = event.id;
  _currentEventDbId = event.extendedProps.dbId || null;

  document.getElementById('ev-detail-title').textContent = event.title;
  const d        = new Date(event.start);
  const today    = new Date();
  const diffDays = Math.ceil((d - today) / (1000*60*60*24));
  const cat      = event.extendedProps.category || '';
  const catLabel = {
    finance:'재무·회계·세금',
    labor:'노무·4대보험',
    general:'총무·행정',
    company:'사내 행사',
    team:'팀 이벤트',
    exec:'임원 일정',
    tax:'세무·신고', // 하위호환
  };

  // 법정 경고문 (세무/노무 카테고리)
  const legalWarning = (cat === 'finance' || cat === 'labor' || cat === 'tax')
    ? '<div class="mt-3 bg-amber-50 border border-amber-200 rounded-lg p-3">'
      + '<div class="flex items-start gap-2">'
      + '<i class="fas fa-exclamation-triangle text-amber-500 mt-0.5 flex-shrink-0"></i>'
      + '<div class="text-xs text-amber-800 leading-relaxed">'
      + '<strong class="font-bold">법정 기한 주의</strong><br>'
      + (cat === 'finance' ? '세금 신고·납부 기한을 놓치면 가산세(무신고 20%, 납부 0.022%/일)가 부과됩니다.' : '')
      + (cat === 'labor' ? '4대보험 및 노무 기한을 초과하면 과태료(최대 500만 원) 및 연체금이 부과됩니다.' : '')
      + (cat === 'tax' ? '세금 신고·납부 기한을 놓치면 가산세가 부과됩니다.' : '')
      + '</div></div></div>'
    : '';

  document.getElementById('ev-detail-body').innerHTML =
    '<div class="space-y-3 text-sm">'
    + '<div class="flex items-center gap-2"><i class="fas fa-calendar text-blue-500 w-4"></i><span>'
    + d.toLocaleDateString('ko-KR', { year:'numeric', month:'long', day:'numeric', weekday:'long' })
    + '</span></div>'
    + (diffDays >= 0
      ? '<div class="flex items-center gap-2"><i class="fas fa-hourglass-half text-amber-500 w-4"></i><span class="font-medium">'
        + (diffDays === 0 ? '오늘!' : 'D-' + diffDays) + '</span></div>'
      : '')
    + (cat
      ? '<div class="flex items-center gap-2"><i class="fas fa-tag text-gray-400 w-4"></i><span class="text-gray-600">'
        + (catLabel[cat] || cat) + '</span></div>'
      : '')
    + (event.extendedProps.note
      ? '<div class="bg-gray-50 rounded-lg p-3 text-gray-700 leading-relaxed">' + event.extendedProps.note + '</div>'
      : '')
    + legalWarning
    + '</div>';

  // RBAC: admin은 모든 일정 수정/삭제 가능
  // 일반 사용자는 general/company/team/exec 카테고리만 수정/삭제 가능
  const adminActions = document.getElementById('ev-detail-admin-actions');
  const canEdit = _currentEventDbId && (IS_ADMIN || !ADMIN_ONLY_CATS.includes(cat));
  if (canEdit) {
    adminActions.classList.remove('hidden');
    document.getElementById('ev-edit-btn').onclick = function() {
      closeEventDetail();
      openEditEventModal(event);
    };
    document.getElementById('ev-delete-btn').onclick = function() {
      deleteCustomEvent(_currentEventDbId, event.title, event.id);
    };
  } else {
    adminActions.classList.add('hidden');
  }

  document.getElementById('event-detail-modal').classList.remove('hidden');
}
function closeEventDetail() {
  document.getElementById('event-detail-modal').classList.add('hidden');
}

// ── 반복 유형 토글 ────────────────────────────────
function toggleRecurring() {
  const type = document.getElementById('ev-recurring-type').value;
  document.getElementById('ev-recurring-weekly').classList.toggle('hidden', type !== 'weekly');
  document.getElementById('ev-recurring-monthly').classList.toggle('hidden', type !== 'monthly');
  document.getElementById('ev-recurring-yearly').classList.toggle('hidden', type !== 'yearly');
  // 반복 시 종료일 숨김
  document.getElementById('ev-end-wrap').classList.toggle('hidden', type !== 'none');
}

function resetRecurringFields() {
  document.getElementById('ev-recurring-type').value = 'none';
  toggleRecurring();
  [0,1,2,3,4,5,6].forEach(function(d) {
    const cb = document.getElementById('ev-weekday-' + d);
    if (cb) cb.checked = false;
  });
  document.getElementById('ev-recurring-until').value       = '';
  document.getElementById('ev-recurring-day').value         = '';
  document.getElementById('ev-recurring-month-until').value = '';
  document.getElementById('ev-skip-weekend').checked        = false;
  document.getElementById('ev-recurring-month').value       = '0';
  document.getElementById('ev-recurring-year-day').value    = '';
  document.getElementById('ev-recurring-end-year').value    = String(new Date().getFullYear() + 1);
  document.getElementById('ev-skip-weekend-yearly').checked = false;
}

// ── 일정 추가 모달 ────────────────────────────────
function openAddEventModal() {
  document.getElementById('ev-edit-id').value = '';
  document.getElementById('event-modal-title').textContent = '일정 추가';
  document.getElementById('ev-title').value    = '';
  document.getElementById('ev-start').value    = new Date().toISOString().split('T')[0];
  document.getElementById('ev-end').value      = '';
  document.getElementById('ev-category').value = IS_ADMIN ? 'company' : 'general';
  Array.from(document.querySelectorAll('#ev-category option')).forEach(function(opt) {
    const val = opt.value;
    if (!IS_ADMIN && ADMIN_ONLY_CATS.includes(val)) {
      opt.disabled = true; opt.style.color = '#9ca3af';
    } else {
      opt.disabled = false; opt.style.color = '';
    }
  });
  document.getElementById('ev-note').value = '';
  resetRecurringFields();
  document.getElementById('ev-recurring-wrap').classList.remove('hidden');
  document.getElementById('ev-error').classList.add('hidden');
  const btn = document.getElementById('save-ev-btn');
  btn.innerHTML = '<i class="fas fa-save"></i>저장';
  btn.disabled  = false;
  document.getElementById('add-event-modal').classList.remove('hidden');
}
function openEditEventModal(event) {
  document.getElementById('ev-edit-id').value  = String(event.extendedProps.dbId);
  document.getElementById('event-modal-title').textContent = '일정 수정';
  document.getElementById('ev-title').value    = event.title;
  document.getElementById('ev-start').value    = event.startStr.split('T')[0];
  document.getElementById('ev-end').value      = event.endStr ? event.endStr.split('T')[0] : '';
  document.getElementById('ev-category').value = event.extendedProps.category || 'company';
  document.getElementById('ev-note').value     = event.extendedProps.note || '';
  // 수정 시 반복 UI 숨김 (단건 수정만 지원)
  resetRecurringFields();
  document.getElementById('ev-recurring-wrap').classList.add('hidden');
  document.getElementById('ev-error').classList.add('hidden');
  const btn = document.getElementById('save-ev-btn');
  btn.innerHTML = '<i class="fas fa-save"></i>수정';
  btn.disabled  = false;
  document.getElementById('add-event-modal').classList.remove('hidden');
}
function closeAddEventModal() {
  document.getElementById('add-event-modal').classList.add('hidden');
}

async function saveEvent() {
  const editId = document.getElementById('ev-edit-id').value.trim();
  const title  = document.getElementById('ev-title').value.trim();
  const start  = document.getElementById('ev-start').value;
  const errEl  = document.getElementById('ev-error');
  if (!title) { errEl.textContent='제목을 입력해주세요.'; errEl.classList.remove('hidden'); return; }
  if (!start) { errEl.textContent='시작일을 선택해주세요.'; errEl.classList.remove('hidden'); return; }
  errEl.classList.add('hidden');

  const btn = document.getElementById('save-ev-btn');
  btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 저장 중...';
  btn.disabled  = true;

  const recurringType = document.getElementById('ev-recurring-type').value;
  const payload = {
    title,
    start_date:     start,
    end_date:       document.getElementById('ev-end').value || null,
    category:       document.getElementById('ev-category').value,
    note:           document.getElementById('ev-note').value.trim(),
    recurring_type: recurringType,
  };

  // 반복 파라미터 수집
  if (recurringType === 'weekly') {
    payload.recurring_weekdays = [0,1,2,3,4,5,6].filter(function(d) {
      const cb = document.getElementById('ev-weekday-' + d);
      return cb && cb.checked;
    });
    payload.recurring_until = document.getElementById('ev-recurring-until').value;
    if (!payload.recurring_until) {
      errEl.textContent = '종료 날짜를 선택해주세요.'; errEl.classList.remove('hidden');
      btn.innerHTML = '<i class="fas fa-save"></i>저장'; btn.disabled = false; return;
    }
    if (payload.recurring_weekdays.length === 0) {
      errEl.textContent = '반복 요일을 선택해주세요.'; errEl.classList.remove('hidden');
      btn.innerHTML = '<i class="fas fa-save"></i>저장'; btn.disabled = false; return;
    }
  } else if (recurringType === 'monthly') {
    payload.recurring_day   = parseInt(document.getElementById('ev-recurring-day').value);
    payload.recurring_until = document.getElementById('ev-recurring-month-until').value;
    payload.skip_weekend    = document.getElementById('ev-skip-weekend').checked;
    if (!payload.recurring_day || !payload.recurring_until) {
      errEl.textContent = '기준일과 종료 날짜를 입력해주세요.'; errEl.classList.remove('hidden');
      btn.innerHTML = '<i class="fas fa-save"></i>저장'; btn.disabled = false; return;
    }
  } else if (recurringType === 'yearly') {
    payload.recurring_month    = parseInt(document.getElementById('ev-recurring-month').value);
    payload.recurring_day      = parseInt(document.getElementById('ev-recurring-year-day').value);
    payload.recurring_end_year = parseInt(document.getElementById('ev-recurring-end-year').value);
    payload.skip_weekend       = document.getElementById('ev-skip-weekend-yearly').checked;
    if (!payload.recurring_day || !payload.recurring_end_year) {
      errEl.textContent = '기준일과 종료 연도를 입력해주세요.'; errEl.classList.remove('hidden');
      btn.innerHTML = '<i class="fas fa-save"></i>저장'; btn.disabled = false; return;
    }
  }

  let res;
  if (editId) {
    res = await fetch('/dashboard/calendar/api/events/' + editId, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } else {
    res = await fetch('/dashboard/calendar/api/events', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }
  const data = await res.json();

  if (data.ok) {
    closeAddEventModal();

    // 반복 일정: 다건 생성 → 전체 리로드
    if (data.count && data.count > 1) {
      alert(data.message);
      await loadCustomEvents();
      calendar.removeAllEvents();
      customEvents.map(mapCustomToFC).forEach(function(e) { calendar.addEvent(e); });
    } else {
      const cat   = payload.category;
      const color = CAT_COLORS[cat] || '#3b82f6';
      if (editId) {
        const existing = calendar.getEventById(String(editId));
        if (existing) {
          existing.setProp('title',  payload.title);
          existing.setProp('color',  color);
          existing.setStart(payload.start_date);
          existing.setEnd(payload.end_date || null);
          existing.setExtendedProp('note',     payload.note);
          existing.setExtendedProp('category', cat);
        }
      } else {
        calendar.addEvent({
          id:    String(data.id),
          title: payload.title,
          start: payload.start_date,
          end:   payload.end_date || null,
          color,
          extendedProps: { note: payload.note, category: cat, isLegal: false, dbId: data.id }
        });
      }
    }
    updateUpcomingList(calendar.view.activeStart, calendar.view.activeEnd);
  } else {
    errEl.textContent = '저장 실패: ' + (data.error || '알 수 없는 오류');
    errEl.classList.remove('hidden');
    btn.innerHTML = '<i class="fas fa-save"></i>저장';
    btn.disabled  = false;
  }
}

async function deleteCustomEvent(dbId, title, fcId) {
  if (!confirm('"' + title + '" 일정을 삭제하시겠습니까?')) return;
  closeEventDetail();
  const res  = await fetch('/dashboard/calendar/api/events/' + dbId, { method: 'DELETE' });
  const data = await res.json();
  if (data.ok) {
    const ev = calendar.getEventById(String(fcId));
    if (ev) ev.remove();
    updateUpcomingList(calendar.view.activeStart, calendar.view.activeEnd);
  } else {
    alert('삭제 실패: ' + (data.error || '알 수 없는 오류'));
  }
}

// 초기화
document.addEventListener('DOMContentLoaded', initCalendar);
      `}} />
    </div>,
    { title: '사내 주요 일정 | BizReady' }
  )
})

// ── 반복 일정 날짜 생성 헬퍼 ──────────────────────────────
function adjustWeekend(date: Date, skip: boolean): Date {
  if (!skip) return date
  const dow = date.getDay()
  if (dow === 6) date.setDate(date.getDate() + 2)
  else if (dow === 0) date.setDate(date.getDate() + 1)
  return date
}

function generateWeekly(start: Date, end: Date, weekdays: number[]): Date[] {
  const dates: Date[] = []
  const cur = new Date(start)
  while (cur <= end) {
    if (weekdays.includes(cur.getDay())) dates.push(new Date(cur))
    cur.setDate(cur.getDate() + 1)
  }
  return dates
}

function generateMonthly(
  startYear: number, startMonth: number,
  endYear: number, endMonth: number,
  day: number, skipWeekend: boolean
): Date[] {
  const dates: Date[] = []
  let y = startYear, m = startMonth
  while (y < endYear || (y === endYear && m <= endMonth)) {
    let d = new Date(y, m, day)
    if (d.getMonth() !== m) d = new Date(y, m + 1, 0)
    dates.push(adjustWeekend(new Date(d), skipWeekend))
    m++; if (m > 11) { m = 0; y++ }
  }
  return dates
}

function generateYearly(
  startYear: number, endYear: number,
  month: number, day: number, skipWeekend: boolean
): Date[] {
  const dates: Date[] = []
  for (let y = startYear; y <= endYear; y++) {
    let d = new Date(y, month, day)
    if (d.getMonth() !== month) d = new Date(y, month + 1, 0)
    dates.push(adjustWeekend(new Date(d), skipWeekend))
  }
  return dates
}

function toDateStr(d: Date): string {
  const y = d.getFullYear()
  const mo = String(d.getMonth() + 1).padStart(2, '0')
  const da = String(d.getDate()).padStart(2, '0')
  return `${y}-${mo}-${da}`
}

// ── 캘린더 이벤트 API ──────────────────────────────────
// GET /dashboard/calendar/api/events
calendarRoute.get('/api/events', async (c) => {
  const db = getSupabaseAdmin(c.env)
  const { data, error } = await db.from('calendar_events')
    .select('*')
    .order('start_date', { ascending: true })
  if (error) return c.json({ ok: false, error: error.message }, 500)
  return c.json({ ok: true, events: data ?? [] })
})

// POST /dashboard/calendar/api/events
calendarRoute.post('/api/events', async (c) => {
  const cookie     = c.req.header('Cookie') ?? ''
  const sessionStr = parseSessionCookie(cookie)
  if (!sessionStr) return c.json({ ok: false, error: 'unauthorized' }, 401)

  const ADMIN_ONLY_CATEGORIES = ['finance', 'labor', 'tax']

  try {
    let sessionObj: any
    try { sessionObj = JSON.parse(sessionStr) }
    catch { sessionObj = JSON.parse(decodeURIComponent(sessionStr)) }

    const supabase = getSupabaseClientWithToken(c.env, sessionObj.access_token)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return c.json({ ok: false, error: 'unauthorized' }, 401)

    const isAdmin = user.email === 'lsol3264@gmail.com'

    const body = await c.req.json<any>()
    if (!body.title?.trim() || !body.start_date) {
      return c.json({ ok: false, error: '제목과 시작일은 필수입니다.' }, 400)
    }

    // 세무/노무 카테고리는 관리자만 추가 가능
    if (ADMIN_ONLY_CATEGORIES.includes(body.category ?? '') && !isAdmin) {
      return c.json({ ok: false, error: '세무·노무 카테고리는 관리자만 추가할 수 있습니다.' }, 403)
    }

    const db = getSupabaseAdmin(c.env)
    const recurringType: string = body.recurring_type ?? 'none'

    // ── 반복 일정 처리 ──
    if (recurringType !== 'none') {
      const startDate = new Date(body.start_date)
      const DAY_NAMES = ['일','월','화','수','목','금','토']
      const MONTH_NAMES = ['1월','2월','3월','4월','5월','6월','7월','8월','9월','10월','11월','12월']
      let dates: Date[] = []
      let descLabel = ''

      if (recurringType === 'weekly') {
        const weekdays: number[] = body.recurring_weekdays ?? []
        if (weekdays.length === 0) return c.json({ ok: false, error: '반복 요일을 선택해주세요.' }, 400)
        if (!body.recurring_until) return c.json({ ok: false, error: '종료 날짜를 선택해주세요.' }, 400)
        dates = generateWeekly(startDate, new Date(body.recurring_until), weekdays)
        descLabel = '매주 ' + weekdays.map((d: number) => DAY_NAMES[d]).join('/')

      } else if (recurringType === 'monthly') {
        const day = Number(body.recurring_day ?? 1)
        if (!body.recurring_until) return c.json({ ok: false, error: '종료 날짜를 선택해주세요.' }, 400)
        const until = new Date(body.recurring_until)
        dates = generateMonthly(
          startDate.getFullYear(), startDate.getMonth(),
          until.getFullYear(), until.getMonth(),
          day, body.skip_weekend ?? false
        )
        descLabel = `매월 ${day}일` + (body.skip_weekend ? ' (주말→월)' : '')

      } else if (recurringType === 'yearly') {
        const month = Number(body.recurring_month ?? 0)
        const day   = Number(body.recurring_day ?? 1)
        const endYear = Number(body.recurring_end_year ?? startDate.getFullYear())
        dates = generateYearly(startDate.getFullYear(), endYear, month, day, body.skip_weekend ?? false)
        descLabel = `매년 ${MONTH_NAMES[month]} ${day}일` + (body.skip_weekend ? ' (주말→월)' : '')
      }

      if (dates.length === 0) return c.json({ ok: false, error: '생성할 날짜가 없습니다.' }, 400)
      if (dates.length > 500) return c.json({ ok: false, error: '최대 500개까지 생성 가능합니다.' }, 400)

      const rows = dates.map(d => ({
        title:      body.title.trim(),
        start_date: toDateStr(d),
        end_date:   null,
        category:   body.category || 'company',
        note:       body.note || '',
        created_by: user.email,
      }))

      const { data: inserted, error: insErr } = await db.from('calendar_events').insert(rows).select('id')
      if (insErr) return c.json({ ok: false, error: insErr.message }, 500)

      const count = inserted?.length ?? 0
      return c.json({
        ok: true,
        count,
        ids: inserted?.map((r: any) => r.id) ?? [],
        message: `총 ${count}개의 반복 일정이 추가되었습니다. (${descLabel})`
      })
    }

    // ── 단일 일정 ──
    const { data, error } = await db.from('calendar_events').insert({
      title:      body.title.trim(),
      start_date: body.start_date,
      end_date:   body.end_date || null,
      category:   body.category || 'company',
      note:       body.note || '',
      created_by: user.email,
    }).select('id').single()

    if (error) return c.json({ ok: false, error: error.message }, 500)
    return c.json({ ok: true, id: data?.id })
  } catch (e: any) {
    return c.json({ ok: false, error: e.message }, 500)
  }
})

// PUT /dashboard/calendar/api/events/:id  (수정)
calendarRoute.put('/api/events/:id', async (c) => {
  const cookie     = c.req.header('Cookie') ?? ''
  const sessionStr = parseSessionCookie(cookie)
  if (!sessionStr) return c.json({ ok: false, error: 'unauthorized' }, 401)

  const ADMIN_ONLY_CATEGORIES = ['finance', 'labor', 'tax']

  try {
    let sessionObj: any
    try { sessionObj = JSON.parse(sessionStr) }
    catch { sessionObj = JSON.parse(decodeURIComponent(sessionStr)) }

    const supabase = getSupabaseClientWithToken(c.env, sessionObj.access_token)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return c.json({ ok: false, error: 'unauthorized' }, 401)

    const isAdmin = user.email === 'lsol3264@gmail.com'
    const id   = c.req.param('id')
    const db   = getSupabaseAdmin(c.env)

    // 기존 이벤트의 카테고리 확인
    const { data: existing } = await db.from('calendar_events').select('category, created_by').eq('id', id).single()
    if (existing && ADMIN_ONLY_CATEGORIES.includes(existing.category ?? '') && !isAdmin) {
      return c.json({ ok: false, error: '세무·노무 일정은 관리자만 수정할 수 있습니다.' }, 403)
    }

    const body = await c.req.json<any>()
    if (!body.title?.trim() || !body.start_date) {
      return c.json({ ok: false, error: '제목과 시작일은 필수입니다.' }, 400)
    }

    // 변경하려는 카테고리도 admin_only면 admin만 허용
    if (ADMIN_ONLY_CATEGORIES.includes(body.category ?? '') && !isAdmin) {
      return c.json({ ok: false, error: '세무·노무 카테고리는 관리자만 설정할 수 있습니다.' }, 403)
    }

    const { error } = await db.from('calendar_events').update({
      title:      body.title.trim(),
      start_date: body.start_date,
      end_date:   body.end_date || null,
      category:   body.category || 'company',
      note:       body.note || '',
    }).eq('id', id)

    if (error) return c.json({ ok: false, error: error.message }, 500)
    return c.json({ ok: true })
  } catch (e: any) {
    return c.json({ ok: false, error: e.message }, 500)
  }
})

// DELETE /dashboard/calendar/api/events/:id
calendarRoute.delete('/api/events/:id', async (c) => {
  const cookie     = c.req.header('Cookie') ?? ''
  const sessionStr = parseSessionCookie(cookie)
  if (!sessionStr) return c.json({ ok: false, error: 'unauthorized' }, 401)

  const ADMIN_ONLY_CATEGORIES = ['finance', 'labor', 'tax']

  try {
    let sessionObj: any
    try { sessionObj = JSON.parse(sessionStr) }
    catch { sessionObj = JSON.parse(decodeURIComponent(sessionStr)) }

    const supabase = getSupabaseClientWithToken(c.env, sessionObj.access_token)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return c.json({ ok: false, error: 'unauthorized' }, 401)

    const isAdmin = user.email === 'lsol3264@gmail.com'
    const id = c.req.param('id')
    const db = getSupabaseAdmin(c.env)

    // 이벤트 카테고리 확인: finance/labor이면 admin만 삭제 가능
    const { data: existing } = await db.from('calendar_events').select('category, created_by').eq('id', id).single()
    if (existing && ADMIN_ONLY_CATEGORIES.includes(existing.category ?? '') && !isAdmin) {
      return c.json({ ok: false, error: '세무·노무 일정은 관리자만 삭제할 수 있습니다.' }, 403)
    }

    const { error } = await db.from('calendar_events').delete().eq('id', id)
    if (error) return c.json({ ok: false, error: error.message }, 500)
    return c.json({ ok: true })
  } catch (e: any) {
    return c.json({ ok: false, error: e.message }, 500)
  }
})

export default calendarRoute
