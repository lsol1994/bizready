import { Hono } from 'hono'
import { renderer } from '../renderer'
import { parseSessionCookie } from '../lib/session'
import { getSupabaseClientWithToken, getSupabaseAdmin } from '../lib/supabase'
import { Sidebar } from '../lib/sidebar'
import type { Env } from '../lib/supabase'

const calendarRoute = new Hono<{ Bindings: Env }>()
calendarRoute.use(renderer)

// ── 국세청 2026 세무·법정 일정 (확충 버전) ───────────────
const LEGAL_EVENTS = [
  // ─ 1월 ─
  { title: '원천세 반기납부 (7~12월)', month: 1, day: 10, color: '#f97316', category: 'tax', note: '7~12월 원천세 반기납부 (소규모 사업장)' },
  { title: '지급명세서 제출 (근로·사업소득)', month: 1, day: 31, color: '#ef4444', category: 'tax', note: '근로소득·사업소득 지급명세서 홈택스 제출' },
  { title: '부가세 2기 확정 신고·납부', month: 1, day: 25, color: '#ef4444', category: 'tax', note: '2025년 7~12월분 부가가치세 신고·납부 (일반과세자)' },
  { title: '부가세 2기 확정 신고 (간이과세자)', month: 1, day: 25, color: '#dc2626', category: 'tax', note: '2025년 1~12월분 간이과세자 부가세 신고' },
  // ─ 2월 ─
  { title: '연말정산 환급/추징 급여 반영', month: 2, day: 28, color: '#f97316', category: 'labor', note: '2월 급여에 연말정산 결과 반영, 원천징수영수증 발급' },
  { title: '4대보험 보수총액 신고', month: 2, day: 28, color: '#8b5cf6', category: 'labor', note: '2025년 건강보험·고용보험 보수총액 신고 (2.28 마감)' },
  // ─ 3월 ─
  { title: '법인세 신고·납부', month: 3, day: 31, color: '#ef4444', category: 'tax', note: '12월 결산 법인 2025년도 법인세 신고·납부' },
  // ─ 4월 ─
  { title: '부가세 1기 예정 신고·납부', month: 4, day: 25, color: '#ef4444', category: 'tax', note: '2026년 1~3월분 부가가치세 예정 신고 (법인 사업자)' },
  // ─ 5월 ─
  { title: '종합소득세 확정 신고·납부', month: 5, day: 31, color: '#ef4444', category: 'tax', note: '2025년 귀속 종합소득세 신고·납부' },
  { title: '개인지방소득세 신고·납부', month: 5, day: 31, color: '#f97316', category: 'tax', note: '2025년 귀속 개인지방소득세 신고 (위택스)' },
  // ─ 6월 ─
  { title: '상반기 급여 정산 검토', month: 6, day: 30, color: '#8b5cf6', category: 'labor', note: '4대보험 보수월액 중간 검토, 직원 변동사항 정비' },
  // ─ 7월 ─
  { title: '부가세 1기 확정 신고·납부', month: 7, day: 25, color: '#ef4444', category: 'tax', note: '2026년 1~6월분 부가가치세 확정 신고·납부' },
  { title: '원천세 반기납부 (1~6월)', month: 7, day: 10, color: '#f97316', category: 'tax', note: '2026년 1~6월 원천세 반기납부 (소규모 사업장)' },
  // ─ 8월 ─
  { title: '재산세 1기 납부', month: 8, day: 31, color: '#ef4444', category: 'tax', note: '건물·주택(1/2) 재산세 납부 기한' },
  // ─ 9월 ─
  { title: '4대보험 보수총액 신고 (6월결산법인)', month: 9, day: 30, color: '#8b5cf6', category: 'labor', note: '6월 결산 법인 건강보험 보수총액 신고' },
  // ─ 10월 ─
  { title: '부가세 2기 예정 신고·납부', month: 10, day: 25, color: '#ef4444', category: 'tax', note: '2026년 7~9월분 부가가치세 예정 신고 (법인 사업자)' },
  // ─ 11월 ─
  { title: '재산세 2기 납부', month: 11, day: 30, color: '#ef4444', category: 'tax', note: '토지·주택(1/2) 재산세 납부 기한' },
  { title: '종합부동산세 신고·납부', month: 11, day: 30, color: '#ef4444', category: 'tax', note: '2026년 종합부동산세 납부 기한' },
  // ─ 12월 ─
  { title: '연말정산 간소화 자료 수집 시작', month: 12, day: 1, color: '#8b5cf6', category: 'labor', note: '직원 공제 서류 제출 안내 시작 (1월 15일 간소화 서비스 개시)' },
  { title: '연간 인건비·세무 점검', month: 12, day: 20, color: '#f97316', category: 'labor', note: '연간 인건비 정리, 비과세 항목 검토, 연말 가산세 방지 점검' },
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
        <header class="bg-white border-b border-gray-200 px-8 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
          <div>
            <h1 class="text-xl font-bold text-gray-800"><i class="fas fa-calendar-alt text-blue-500 mr-2"></i>사내 주요 일정</h1>
            <p class="text-gray-500 text-xs mt-0.5">세무·노무 법정 기한 + 사내 일정 통합 캘린더</p>
          </div>
          {isAdmin && (
            <button onclick="openAddEventModal()"
              class="bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2">
              <i class="fas fa-plus"></i>일정 추가
            </button>
          )}
        </header>

        <div class="px-6 py-5 max-w-6xl mx-auto">
          {/* 범례 */}
          <div class="flex flex-wrap gap-3 mb-4">
            {[
              { color: 'bg-red-500', label: '세무·신고 기한', note: '지각 시 가산세' },
              { color: 'bg-orange-500', label: '원천세·납부', note: '매월 처리' },
              { color: 'bg-purple-500', label: '인사·노무', note: '처리 기한 있음' },
              { color: 'bg-blue-500', label: '사내 행사', note: '전사 이벤트' },
              { color: 'bg-green-500', label: '팀 이벤트', note: '부서별 일정' },
              { color: 'bg-yellow-500', label: '임원 일정', note: '이사회 등' },
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

      {/* ── 일정 추가/수정 모달 (관리자 전용) ── */}
      <div id="add-event-modal" class="fixed inset-0 bg-black/50 z-50 hidden flex items-center justify-center p-4">
        <div class="bg-white rounded-2xl w-full max-w-md shadow-2xl">
          <div class="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
            <h3 id="event-modal-title" class="font-bold text-gray-800">일정 추가</h3>
            <button onclick="closeAddEventModal()" class="text-gray-400 hover:text-gray-600"><i class="fas fa-times text-xl"></i></button>
          </div>
          <div class="p-6 space-y-4">
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
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1">종료일</label>
                <input id="ev-end" type="date"
                  class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">분류</label>
              <select id="ev-category" class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="tax">🔴 세무·신고</option>
                <option value="labor">🟣 인사·노무</option>
                <option value="company">🔵 사내 행사</option>
                <option value="team">🟢 팀 이벤트</option>
                <option value="exec">🟡 임원 일정</option>
              </select>
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1">메모</label>
              <textarea id="ev-note" rows={2} placeholder="상세 설명 (선택)"
                class="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"></textarea>
            </div>
            <div id="ev-error" class="hidden text-red-500 text-sm bg-red-50 p-2 rounded-lg"></div>
          </div>
          <div class="px-6 py-4 border-t border-gray-100 flex gap-3 justify-end">
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
        #calendar .fc-toolbar-title { font-size: 1.1rem; font-weight: 700; }
        #calendar .fc-event { cursor: pointer; border-radius: 4px; font-size: 11px; }
        #calendar .fc-daygrid-event { padding: 2px 4px; }
        #calendar .fc-button { background: #1e40af; border-color: #1e40af; }
        #calendar .fc-button:hover { background: #1d4ed8; }
        #calendar .fc-button-active { background: #1e3a8a !important; }
        #calendar .fc-today-button { background: #059669; border-color: #059669; }
        #calendar .fc-day-today { background: rgba(59,130,246,0.06) !important; }
      `}</style>

      <script dangerouslySetInnerHTML={{ __html: `
// ── 법정 반복 이벤트 ────────────────────────────
const LEGAL = ${JSON.stringify(LEGAL_EVENTS)};
const IS_ADMIN = ${isAdmin};

const CAT_COLORS = {
  tax:     '#ef4444',
  labor:   '#8b5cf6',
  company: '#3b82f6',
  team:    '#22c55e',
  exec:    '#f59e0b',
};

function buildLegalEvents() {
  const now  = new Date();
  const year = now.getFullYear();
  const events = [];
  for (let y = year - 1; y <= year + 1; y++) {
    LEGAL.forEach(e => {
      const m = String(e.month).padStart(2,'0');
      const d = String(e.day).padStart(2,'0');
      events.push({
        id: 'legal_' + y + '_' + e.title,
        title: e.title,
        start: y + '-' + m + '-' + d,
        color: e.color,
        extendedProps: { note: e.note, category: e.category, isLegal: true }
      });
    });
  }
  return events;
}

// ── FullCalendar 초기화 ───────────────────────────
let calendar;
let customEvents = [];

async function loadCustomEvents() {
  try {
    const res = await fetch('/api/calendar/events');
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

async function initCalendar() {
  await loadCustomEvents();
  const el = document.getElementById('calendar');
  calendar = new FullCalendar.Calendar(el, {
    locale: 'ko',
    initialView: 'dayGridMonth',
    headerToolbar: {
      left:   'prev,next today',
      center: 'title',
      right:  'dayGridMonth,timeGridWeek,listMonth'
    },
    buttonText: { today: '오늘', month: '월', week: '주', list: '목록' },
    events: [...buildLegalEvents(), ...customEvents.map(mapCustomToFC)],
    eventClick: function(info) {
      showEventDetail(info.event);
    },
    datesSet: function(info) {
      updateUpcomingList(info.start, info.end);
    },
    eventDidMount: function(info) {
      if (info.event.extendedProps.isLegal) {
        const today     = new Date();
        const eventDate = new Date(info.event.start);
        const diffDays  = Math.ceil((eventDate - today) / (1000*60*60*24));
        if (diffDays >= 0 && diffDays <= 3) {
          info.el.style.outline = '2px solid #fbbf24';
          info.el.title = '⚠️ D-' + diffDays + ' ' + info.event.title;
        }
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
  const catLabel = { tax:'세무·신고', labor:'인사·노무', company:'사내 행사', team:'팀 이벤트', exec:'임원 일정' };

  document.getElementById('ev-detail-body').innerHTML =
    '<div class="space-y-3 text-sm">'
    + '<div class="flex items-center gap-2"><i class="fas fa-calendar text-blue-500 w-4"></i><span>'
    + d.toLocaleDateString('ko-KR', { year:'numeric', month:'long', day:'numeric', weekday:'long' })
    + '</span></div>'
    + (diffDays >= 0
      ? '<div class="flex items-center gap-2"><i class="fas fa-hourglass-half text-amber-500 w-4"></i><span class="font-medium">'
        + (diffDays === 0 ? '오늘!' : 'D-' + diffDays) + '</span></div>'
      : '')
    + (event.extendedProps.category
      ? '<div class="flex items-center gap-2"><i class="fas fa-tag text-gray-400 w-4"></i><span class="text-gray-600">'
        + (catLabel[event.extendedProps.category] || event.extendedProps.category) + '</span></div>'
      : '')
    + (event.extendedProps.note
      ? '<div class="bg-gray-50 rounded-lg p-3 text-gray-700 leading-relaxed">' + event.extendedProps.note + '</div>'
      : '')
    + (event.extendedProps.isLegal
      ? '<div class="bg-red-50 border border-red-200 rounded-lg p-2 text-xs text-red-700">'
        + '<i class="fas fa-exclamation-triangle mr-1"></i>법정 기한입니다. 기한 초과 시 가산세가 발생할 수 있습니다.</div>'
      : '')
    + '</div>';

  // 관리자이고 커스텀 이벤트인 경우 수정/삭제 버튼 표시
  const adminActions = document.getElementById('ev-detail-admin-actions');
  if (IS_ADMIN && !event.extendedProps.isLegal && _currentEventDbId) {
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

// ── 일정 추가 모달 ────────────────────────────────
function openAddEventModal() {
  document.getElementById('ev-edit-id').value = '';
  document.getElementById('event-modal-title').textContent = '일정 추가';
  document.getElementById('ev-title').value    = '';
  document.getElementById('ev-start').value    = new Date().toISOString().split('T')[0];
  document.getElementById('ev-end').value      = '';
  document.getElementById('ev-category').value = 'company';
  document.getElementById('ev-note').value     = '';
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

  const payload = {
    title,
    start_date: start,
    end_date:   document.getElementById('ev-end').value || null,
    category:   document.getElementById('ev-category').value,
    note:       document.getElementById('ev-note').value.trim(),
  };

  let res;
  if (editId) {
    res = await fetch('/api/calendar/events/' + editId, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  } else {
    res = await fetch('/api/calendar/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }
  const data = await res.json();

  if (data.ok) {
    closeAddEventModal();
    const cat   = payload.category;
    const color = CAT_COLORS[cat] || '#3b82f6';

    if (editId) {
      // 기존 이벤트 업데이트
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
      // 새 이벤트 즉시 추가
      calendar.addEvent({
        id:    String(data.id),
        title: payload.title,
        start: payload.start_date,
        end:   payload.end_date || null,
        color,
        extendedProps: { note: payload.note, category: cat, isLegal: false, dbId: data.id }
      });
    }

    // 목록 패널 즉시 갱신
    updateUpcomingList(calendar.view.activeStart, calendar.view.activeEnd);
  } else {
    errEl.textContent = '저장 실패: ' + (data.error || '알 수 없는 오류');
    errEl.classList.remove('hidden');
    btn.innerHTML = '<i class="fas fa-save"></i> 저장';
    btn.disabled  = false;
  }
}

async function deleteCustomEvent(dbId, title, fcId) {
  if (!confirm('"' + title + '" 일정을 삭제하시겠습니까?')) return;
  closeEventDetail();
  const res  = await fetch('/api/calendar/events/' + dbId, { method: 'DELETE' });
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

// ── 캘린더 이벤트 API ──────────────────────────────────
// GET /api/calendar/events
calendarRoute.get('/api/events', async (c) => {
  const db = getSupabaseAdmin(c.env)
  const { data, error } = await db.from('calendar_events')
    .select('*')
    .order('start_date', { ascending: true })
  if (error) return c.json({ ok: false, error: error.message }, 500)
  return c.json({ ok: true, events: data ?? [] })
})

// POST /api/calendar/events
calendarRoute.post('/api/events', async (c) => {
  const cookie     = c.req.header('Cookie') ?? ''
  const sessionStr = parseSessionCookie(cookie)
  if (!sessionStr) return c.json({ ok: false, error: 'unauthorized' }, 401)

  try {
    let sessionObj: any
    try { sessionObj = JSON.parse(sessionStr) }
    catch { sessionObj = JSON.parse(decodeURIComponent(sessionStr)) }

    const supabase = getSupabaseClientWithToken(c.env, sessionObj.access_token)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.email !== 'lsol3264@gmail.com') {
      return c.json({ ok: false, error: '관리자만 일정을 추가할 수 있습니다.' }, 403)
    }

    const body = await c.req.json<any>()
    if (!body.title?.trim() || !body.start_date) {
      return c.json({ ok: false, error: '제목과 시작일은 필수입니다.' }, 400)
    }

    const db = getSupabaseAdmin(c.env)
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

// PUT /api/calendar/events/:id  (수정)
calendarRoute.put('/api/events/:id', async (c) => {
  const cookie     = c.req.header('Cookie') ?? ''
  const sessionStr = parseSessionCookie(cookie)
  if (!sessionStr) return c.json({ ok: false, error: 'unauthorized' }, 401)

  try {
    let sessionObj: any
    try { sessionObj = JSON.parse(sessionStr) }
    catch { sessionObj = JSON.parse(decodeURIComponent(sessionStr)) }

    const supabase = getSupabaseClientWithToken(c.env, sessionObj.access_token)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.email !== 'lsol3264@gmail.com') {
      return c.json({ ok: false, error: '관리자만 수정할 수 있습니다.' }, 403)
    }

    const id   = c.req.param('id')
    const body = await c.req.json<any>()
    if (!body.title?.trim() || !body.start_date) {
      return c.json({ ok: false, error: '제목과 시작일은 필수입니다.' }, 400)
    }

    const db = getSupabaseAdmin(c.env)
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

// DELETE /api/calendar/events/:id
calendarRoute.delete('/api/events/:id', async (c) => {
  const cookie     = c.req.header('Cookie') ?? ''
  const sessionStr = parseSessionCookie(cookie)
  if (!sessionStr) return c.json({ ok: false, error: 'unauthorized' }, 401)

  try {
    let sessionObj: any
    try { sessionObj = JSON.parse(sessionStr) }
    catch { sessionObj = JSON.parse(decodeURIComponent(sessionStr)) }

    const supabase = getSupabaseClientWithToken(c.env, sessionObj.access_token)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.email !== 'lsol3264@gmail.com') {
      return c.json({ ok: false, error: '관리자만 삭제할 수 있습니다.' }, 403)
    }

    const id = c.req.param('id')
    const db = getSupabaseAdmin(c.env)
    const { error } = await db.from('calendar_events').delete().eq('id', id)
    if (error) return c.json({ ok: false, error: error.message }, 500)
    return c.json({ ok: true })
  } catch (e: any) {
    return c.json({ ok: false, error: e.message }, 500)
  }
})

export default calendarRoute
