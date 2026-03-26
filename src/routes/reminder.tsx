import { Hono } from 'hono'
import { getSupabaseAdmin } from '../lib/supabase'
import type { Env } from '../lib/supabase'

const reminder = new Hono<{ Bindings: Env }>()

// ── 세무 일정 마스터 (dashboard.tsx 와 동일하게 유지) ──────
type ScheduleCategory = 'finance' | 'labor' | 'general'

const TAX_SCHEDULES: { title: string; deadline: string; category: ScheduleCategory }[] = [
  // 재무/회계/세금/급여
  { title: '원천세 신고·납부',         deadline: '2026-04-10', category: 'finance' },
  { title: '부가세 1기 예정신고·납부', deadline: '2026-04-25', category: 'finance' },
  { title: '급여 지급',                deadline: '2026-04-25', category: 'finance' },
  { title: '법인세 신고·납부',         deadline: '2026-05-31', category: 'finance' },
  { title: '종합소득세 확정신고',      deadline: '2026-05-31', category: 'finance' },
  // 노무/4대보험/고용
  { title: '4대보험 EDI 정산',         deadline: '2026-04-07', category: 'labor'   },
  { title: '고용보험 지원금 신청',     deadline: '2026-04-30', category: 'labor'   },
  { title: '4대보험 보수총액 신고',    deadline: '2026-05-15', category: 'labor'   },
  // 총무/행정
  { title: '비품 구매 예산 신청',      deadline: '2026-04-15', category: 'general' },
  { title: '차량 정기 점검',           deadline: '2026-05-10', category: 'general' },
  { title: '사무용품 재고 점검',       deadline: '2026-04-20', category: 'general' },
]

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
    const urgency = item.dday === 1 ? '⚠️ 내일 마감!' : item.dday === 3 ? '📌 3일 남았어요' : '📅 7일 남았어요'
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
// ?secret=xxx 로 간단 인증 (Cron은 헤더로 처리)
reminder.get('/send', async (c) => {
  const today = new Date()

  // 오늘 기준 D-7, D-3, D-1, D-0 에 해당하는 일정 추출
  const ALERT_DAYS = [7, 3, 1, 0]
  const todayItems = TAX_SCHEDULES
    .map(s => ({ ...s, dday: calcDday(s.deadline, today) }))
    .filter(s => ALERT_DAYS.includes(s.dday))

  if (todayItems.length === 0) {
    return c.json({ ok: true, message: '오늘 발송할 리마인더 없음', date: today.toISOString().slice(0, 10) })
  }

  // Supabase에서 전체 유저 이메일 조회 (service_role)
  const admin = getSupabaseAdmin(c.env)
  const { data: users, error: userErr } = await admin
    .from('user_profiles')
    .select('id, email_reminder')

  if (userErr || !users) {
    return c.json({ ok: false, error: userErr?.message ?? 'user fetch failed' }, 500)
  }

  // auth.users에서 이메일 조회
  const results: { email: string; ok: boolean; error?: string }[] = []

  for (const profile of users) {
    // email_reminder 컬럼이 false이면 건너뜀 (없으면 기본 발송)
    if (profile.email_reminder === false) continue

    // auth.users에서 이메일 가져오기
    const { data: authUser } = await admin.auth.admin.getUserById(profile.id)
    if (!authUser?.user?.email) continue

    const email = authUser.user.email
    const userName = authUser.user.user_metadata?.full_name || email.split('@')[0]

    const result = await sendReminderEmail(c.env.RESEND_API_KEY, email, userName, todayItems)
    results.push({ email, ...result })
  }

  const sent    = results.filter(r => r.ok).length
  const failed  = results.filter(r => !r.ok).length

  return c.json({
    ok: true,
    date: today.toISOString().slice(0, 10),
    schedules: todayItems.map(i => ({ title: i.title, dday: i.dday })),
    sent,
    failed,
    results,
  })
})

// ── GET /api/reminder/preview — 이메일 미리보기 (개발용) ──
reminder.get('/preview', async (c) => {
  const today = new Date()
  // 미리보기용: 실제 D-day 무관하게 첫 3개 항목으로 샘플 생성
  const sampleItems = TAX_SCHEDULES.slice(0, 3).map(s => ({
    ...s,
    dday: calcDday(s.deadline, today),
  }))
  const html = buildEmailHtml('솔', sampleItems)
  return c.html(html)
})

export default reminder
