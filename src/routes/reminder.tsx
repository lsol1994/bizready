import { Hono } from 'hono'
import { getSupabaseAdmin, getSupabaseClientWithToken } from '../lib/supabase'
import { parseSessionCookie } from '../lib/session'
import type { Env } from '../lib/supabase'

const reminder = new Hono<{ Bindings: Env }>()

// ── 카테고리 타입 ────────────────────────────────────────
type ScheduleCategory = 'finance' | 'labor' | 'general'

// calendar_events.category → ScheduleCategory 매핑
function mapCategory(cat: string): ScheduleCategory {
  if (cat === 'labor')                    return 'labor'
  if (cat === 'tax' || cat === 'finance') return 'finance'
  return 'general'
}

// ── 캘린더 DB에서 D-day 해당 일정 조회 ───────────────────
async function fetchTodaySchedules(
  admin: ReturnType<typeof getSupabaseAdmin>,
  today: Date,
  alertDays: number[]
): Promise<{ title: string; deadline: string; category: ScheduleCategory; dday: number }[]> {
  const maxDay = Math.max(...alertDays)
  const futureLimit = new Date(today)
  futureLimit.setDate(futureLimit.getDate() + maxDay)

  const { data: events, error } = await admin
    .from('calendar_events')
    .select('title, start_date, category')
    .gte('start_date', today.toISOString().slice(0, 10))
    .lte('start_date', futureLimit.toISOString().slice(0, 10))
    .order('start_date', { ascending: true })

  if (error || !events) return []

  return events
    .map((e: any) => {
      const cat  = mapCategory(e.category ?? 'general')
      const dday = calcDday(e.start_date, today)
      return { title: e.title, deadline: e.start_date, category: cat, dday }
    })
    .filter(e => alertDays.includes(e.dday))
}

// ── 카테고리 한글명 / 색상 ────────────────────────────────
const CAT_META: Record<ScheduleCategory, { label: string; color: string; emoji: string }> = {
  finance: { label: '재무·세금',   color: '#ef4444', emoji: '🔴' },
  labor:   { label: '노무·4대보험', color: '#ca8a04', emoji: '🟡' },
  general: { label: '총무·행정',   color: '#3b82f6', emoji: '🔵' },
}

// ── D-day 계산 ────────────────────────────────────────────
function calcDday(deadline: string, today: Date): number {
  const d = new Date(deadline)
  d.setHours(0, 0, 0, 0)
  const t = new Date(today)
  t.setHours(0, 0, 0, 0)
  return Math.ceil((d.getTime() - t.getTime()) / (1000 * 60 * 60 * 24))
}

// ── user_settings 타입 정의 ───────────────────────────────
interface UserSettings {
  notify_finance: boolean
  notify_labor:   boolean
  notify_general: boolean
  notify_d7:      boolean
  notify_d3:      boolean
  notify_d1:      boolean
  notify_d0:      boolean
  dnd_start:      string | null
  dnd_end:        string | null
  email_reminder: boolean
}

const DEFAULT_SETTINGS: UserSettings = {
  notify_finance: true, notify_labor: true, notify_general: true,
  notify_d7: true, notify_d3: true, notify_d1: true, notify_d0: true,
  dnd_start: null, dnd_end: null, email_reminder: true,
}

// user_settings 조회 (없으면 기본값)
async function getUserSettings(
  admin: ReturnType<typeof getSupabaseAdmin>,
  userId: string
): Promise<UserSettings> {
  const { data } = await admin.from('user_settings').select('*').eq('id', userId).single()
  if (!data) return { ...DEFAULT_SETTINGS }
  return {
    notify_finance: data.notify_finance ?? true,
    notify_labor:   data.notify_labor   ?? true,
    notify_general: data.notify_general ?? true,
    notify_d7:      data.notify_d7      ?? true,
    notify_d3:      data.notify_d3      ?? true,
    notify_d1:      data.notify_d1      ?? true,
    notify_d0:      data.notify_d0      ?? true,
    dnd_start:      data.dnd_start      ?? null,
    dnd_end:        data.dnd_end        ?? null,
    email_reminder: data.email_reminder ?? true,
  }
}

// DND(수신 거부 기간) 포함 여부 확인
function isInDnd(settings: UserSettings, today: Date): boolean {
  if (!settings.dnd_start || !settings.dnd_end) return false
  const todayStr = today.toISOString().slice(0, 10)
  return todayStr >= settings.dnd_start && todayStr <= settings.dnd_end
}

// 사용자 설정에 따라 포함된 일정 필터
function filterByUserSettings(
  items: { title: string; deadline: string; category: ScheduleCategory; dday: number }[],
  settings: UserSettings
): { title: string; deadline: string; category: ScheduleCategory; dday: number }[] {
  return items.filter(item => {
    // 카테고리 필터
    if (item.category === 'finance' && !settings.notify_finance) return false
    if (item.category === 'labor'   && !settings.notify_labor)   return false
    if (item.category === 'general' && !settings.notify_general) return false
    // D-day 필터
    if (item.dday === 7 && !settings.notify_d7) return false
    if (item.dday === 3 && !settings.notify_d3) return false
    if (item.dday === 1 && !settings.notify_d1) return false
    if (item.dday === 0 && !settings.notify_d0) return false
    return true
  })
}

// ── 이메일 HTML 템플릿 ────────────────────────────────────
function buildEmailHtml(
  userName: string,
  items: { title: string; deadline: string; category: ScheduleCategory; dday: number }[]
): string {
  const itemsHtml = items.map(item => {
    const meta = CAT_META[item.category]
    const ddayLabel = item.dday === 0 ? 'D-DAY' : `D-${item.dday}`
    const deadlineStr = new Date(item.deadline).toLocaleDateString('ko-KR', {
      year: 'numeric', month: 'long', day: 'numeric', weekday: 'short'
    })
    const urgency = item.dday === 0 ? '🚨 오늘 마감!' : item.dday === 1 ? '⚠️ 내일 마감!' : item.dday === 3 ? '📌 3일 남았어요' : '📅 7일 남았어요'
    return `
      <tr>
        <td style="padding:12px 16px; border-bottom:1px solid #f1f5f9;">
          <table width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="vertical-align:middle;">
                <span style="
                  display:inline-block;
                  background:${meta.color}20;
                  color:${meta.color};
                  font-size:11px;
                  font-weight:600;
                  padding:2px 8px;
                  border-radius:20px;
                  margin-bottom:4px;
                ">${meta.emoji} ${meta.label}</span>
                <div style="font-size:15px; font-weight:600; color:#1e293b; margin-bottom:2px;">${item.title}</div>
                <div style="font-size:12px; color:#64748b;">📅 마감일: ${deadlineStr}</div>
                <div style="font-size:12px; color:#94a3b8; margin-top:2px;">${urgency}</div>
              </td>
              <td style="vertical-align:middle; text-align:right; width:80px;">
                <span style="
                  display:inline-block;
                  background:${item.dday === 0 ? '#ef4444' : item.dday <= 3 ? '#f97316' : '#3b82f6'};
                  color:white;
                  font-size:18px;
                  font-weight:800;
                  padding:8px 14px;
                  border-radius:10px;
                  letter-spacing:-0.5px;
                ">${ddayLabel}</span>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    `
  }).join('')

  return `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BizReady 세무 일정 알림</title>
</head>
<body style="margin:0; padding:0; background:#f8fafc; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','Noto Sans KR',sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f8fafc; padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="560" cellpadding="0" cellspacing="0" style="max-width:560px; width:100%;">

          <!-- 헤더 -->
          <tr>
            <td style="
              background:linear-gradient(135deg,#1e3a5f 0%,#0f2544 100%);
              border-radius:16px 16px 0 0;
              padding:28px 32px;
              text-align:center;
            ">
              <div style="font-size:24px; font-weight:800; color:white; letter-spacing:-0.5px;">
                📋 BizReady
              </div>
              <div style="font-size:13px; color:#93c5fd; margin-top:4px;">
                세무·노무·총무 일정 리마인더
              </div>
            </td>
          </tr>

          <!-- 인사말 -->
          <tr>
            <td style="background:white; padding:24px 32px 8px;">
              <p style="margin:0; font-size:15px; color:#334155; line-height:1.7;">
                안녕하세요, <strong style="color:#1e3a5f;">${userName}</strong>님! 👋<br>
                곧 마감되는 <strong style="color:#ef4444;">업무 일정</strong>을 안내해 드립니다.<br>
                놓치지 말고 미리 준비하세요.
              </p>
            </td>
          </tr>

          <!-- 일정 목록 -->
          <tr>
            <td style="background:white; padding:16px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e2e8f0; border-radius:12px; overflow:hidden;">
                <tr>
                  <td style="background:#f8fafc; padding:10px 16px; border-bottom:1px solid #e2e8f0;">
                    <span style="font-size:12px; font-weight:700; color:#64748b; letter-spacing:0.5px;">
                      ⏰ 임박한 업무 일정 (${items.length}건)
                    </span>
                  </td>
                </tr>
                ${itemsHtml}
              </table>
            </td>
          </tr>

          <!-- CTA 버튼 -->
          <tr>
            <td style="background:white; padding:8px 32px 28px; text-align:center;">
              <a href="https://bizready.pages.dev/dashboard/calendar"
                 style="
                   display:inline-block;
                   background:linear-gradient(135deg,#1e3a5f,#2563eb);
                   color:white;
                   font-size:14px;
                   font-weight:700;
                   text-decoration:none;
                   padding:12px 32px;
                   border-radius:10px;
                   margin-top:4px;
                 ">
                📅 캘린더에서 전체 일정 확인하기 →
              </a>
            </td>
          </tr>

          <!-- 알림 설정 링크 -->
          <tr>
            <td style="background:white; padding:0 32px 20px; text-align:center;">
              <a href="https://bizready.pages.dev/dashboard/settings"
                 style="font-size:11px; color:#94a3b8; text-decoration:underline;">
                알림 설정 변경하기
              </a>
            </td>
          </tr>

          <!-- 푸터 -->
          <tr>
            <td style="
              background:#f1f5f9;
              border-radius:0 0 16px 16px;
              padding:16px 32px;
              text-align:center;
            ">
              <p style="margin:0; font-size:11px; color:#94a3b8; line-height:1.6;">
                이 이메일은 BizReady에서 자동 발송되었습니다.<br>
                © 2026 BizReady — 경영지원 올인원 아카이브
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim()
}

// ── 이메일 발송 함수 (Resend API) ─────────────────────────
async function sendReminderEmail(
  apiKey: string,
  to: string,
  userName: string,
  items: { title: string; deadline: string; category: ScheduleCategory; dday: number }[]
): Promise<{ ok: boolean; error?: string }> {
  const ddayNums = [...new Set(items.map(i => i.dday))].sort((a, b) => a - b)
  const subject = ddayNums[0] === 0
    ? `🚨 [BizReady] 오늘 마감! ${items[0].title} 외 ${items.length - 1}건`
    : `⏰ [BizReady] D-${ddayNums[0]} 세무·업무 일정 알림 (${items.length}건)`

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'BizReady <onboarding@resend.dev>',
      to: [to],
      subject,
      html: buildEmailHtml(userName, items),
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    return { ok: false, error: err }
  }
  return { ok: true }
}

// ── GET /api/reminder/send — 수동 트리거 / Cron 진입점 ──
reminder.get('/send', async (c) => {
  const today = new Date()
  const admin = getSupabaseAdmin(c.env)

  // 캘린더 DB에서 D-7, D-3, D-1, D-0 해당 일정 조회
  const ALERT_DAYS = [7, 3, 1, 0]
  const allTodayItems = await fetchTodaySchedules(admin, today, ALERT_DAYS)

  if (allTodayItems.length === 0) {
    return c.json({ ok: true, message: '오늘 발송할 리마인더 없음', date: today.toISOString().slice(0, 10) })
  }

  // Supabase에서 전체 유저 조회 (service_role)
  const { data: profiles, error: userErr } = await admin
    .from('user_profiles')
    .select('id')

  if (userErr || !profiles) {
    return c.json({ ok: false, error: userErr?.message ?? 'user fetch failed' }, 500)
  }

  const results: { email: string; ok: boolean; skipped?: boolean; reason?: string; error?: string }[] = []

  for (const profile of profiles) {
    // 사용자 설정 조회
    const settings = await getUserSettings(admin, profile.id)

    // 전체 이메일 알림 OFF이면 건너뜀
    if (!settings.email_reminder) {
      results.push({ email: profile.id, skipped: true, reason: 'email_reminder=off', ok: true })
      continue
    }

    // DND 기간 중이면 건너뜀
    if (isInDnd(settings, today)) {
      results.push({ email: profile.id, skipped: true, reason: 'dnd_period', ok: true })
      continue
    }

    // 개인 설정에 맞게 일정 필터
    const userItems = filterByUserSettings(allTodayItems, settings)
    if (userItems.length === 0) {
      results.push({ email: profile.id, skipped: true, reason: 'no_matching_schedules', ok: true })
      continue
    }

    // auth.users에서 이메일 가져오기
    const { data: authUser } = await admin.auth.admin.getUserById(profile.id)
    if (!authUser?.user?.email) continue

    const email    = authUser.user.email
    const userName = authUser.user.user_metadata?.full_name || email.split('@')[0]

    const result = await sendReminderEmail(c.env.RESEND_API_KEY, email, userName, userItems)
    results.push({ email, ...result })
  }

  const sent    = results.filter(r => r.ok && !r.skipped).length
  const skipped = results.filter(r => r.skipped).length
  const failed  = results.filter(r => !r.ok).length

  return c.json({
    ok: true,
    date: today.toISOString().slice(0, 10),
    schedules: allTodayItems.map(i => ({ title: i.title, dday: i.dday })),
    sent,
    skipped,
    failed,
    results,
  })
})

// ── POST /api/reminder/test — 테스트 이메일 발송 (로그인 사용자 전용) ──
reminder.post('/test', async (c) => {
  const rawSession = parseSessionCookie(c.req.header('Cookie') ?? '')
  if (!rawSession) return c.json({ ok: false, error: 'unauthorized' }, 401)

  try {
    let sessionObj: any
    try { sessionObj = JSON.parse(rawSession) }
    catch { sessionObj = JSON.parse(decodeURIComponent(rawSession)) }

    const supabase = getSupabaseClientWithToken(c.env, sessionObj.access_token)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return c.json({ ok: false, error: 'unauthorized' }, 401)

    const admin = getSupabaseAdmin(c.env)
    const today = new Date()

    // DB에서 가장 가까운 일정 3개로 테스트 이메일
    const futureLimit = new Date(today)
    futureLimit.setDate(futureLimit.getDate() + 90)
    const { data: events } = await admin
      .from('calendar_events')
      .select('title, start_date, category')
      .gte('start_date', today.toISOString().slice(0, 10))
      .lte('start_date', futureLimit.toISOString().slice(0, 10))
      .order('start_date', { ascending: true })
      .limit(3)

    const testItems = (events ?? []).map((e: any) => ({
      title:    e.title,
      deadline: e.start_date,
      category: mapCategory(e.category ?? 'general'),
      dday:     calcDday(e.start_date, today),
    }))

    if (testItems.length === 0) {
      return c.json({ ok: false, error: '전송할 일정이 없습니다.' })
    }

    const email    = user.email!
    const userName = (user.user_metadata?.full_name as string) || email.split('@')[0]
    const result   = await sendReminderEmail(c.env.RESEND_API_KEY, email, userName, testItems)
    return c.json(result)
  } catch (e: any) {
    return c.json({ ok: false, error: e.message }, 500)
  }
})

// ── GET /api/reminder/preview — 이메일 미리보기 (개발용) ──
reminder.get('/preview', async (c) => {
  const today = new Date()
  const admin = getSupabaseAdmin(c.env)

  // DB에서 가장 가까운 일정 3개로 미리보기
  const futureLimit = new Date(today)
  futureLimit.setDate(futureLimit.getDate() + 90)
  const { data: events } = await admin
    .from('calendar_events')
    .select('title, start_date, category')
    .gte('start_date', today.toISOString().slice(0, 10))
    .lte('start_date', futureLimit.toISOString().slice(0, 10))
    .order('start_date', { ascending: true })
    .limit(3)

  const sampleItems = (events ?? []).map((e: any) => ({
    title:    e.title,
    deadline: e.start_date,
    category: mapCategory(e.category ?? 'general'),
    dday:     calcDday(e.start_date, today),
  }))

  // DB 일정 없으면 샘플 데이터로 폴백
  const previewItems = sampleItems.length > 0 ? sampleItems : [
    { title: '원천세 신고·납부',    deadline: '2026-04-10', category: 'finance' as ScheduleCategory, dday: 7 },
    { title: '4대보험 EDI 정산',    deadline: '2026-04-07', category: 'labor'   as ScheduleCategory, dday: 3 },
    { title: '비품 구매 예산 신청', deadline: '2026-04-15', category: 'general' as ScheduleCategory, dday: 1 },
  ]

  const html = buildEmailHtml('솔', previewItems)
  return c.html(html)
})

export default reminder
