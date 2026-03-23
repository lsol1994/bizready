import { Hono } from 'hono'
import { parseSessionCookie } from '../lib/session'
import { getSupabaseAdmin, getSupabaseClientWithToken } from '../lib/supabase'
import type { Env } from '../lib/supabase'

const paymentApi = new Hono<{ Bindings: Env }>()

// ── POST /api/payment/complete ────────────────────────────
// 결제 완료 후 브라우저에서 호출 → 포트원 서버에서 검증 → DB 업데이트
paymentApi.post('/complete', async (c) => {
  // 1. 세션 확인
  const cookie = c.req.header('Cookie') ?? ''
  const sessionStr = parseSessionCookie(cookie)
  if (!sessionStr) return c.json({ ok: false, error: 'unauthorized' }, 401)

  let sessionUserId = ''
  try {
    const sessionObj = JSON.parse(decodeURIComponent(sessionStr))
    const supabase = getSupabaseClientWithToken(c.env, sessionObj.access_token)
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return c.json({ ok: false, error: 'session_expired' }, 401)
    sessionUserId = user.id
  } catch {
    return c.json({ ok: false, error: 'session_invalid' }, 401)
  }

  // 2. 요청 바디 파싱
  const { paymentId, planId, userId } = await c.req.json<{
    paymentId: string
    planId: string
    userId: string
  }>()

  // 3. 세션 사용자와 요청 사용자 일치 확인 (위변조 방지)
  if (sessionUserId !== userId) {
    return c.json({ ok: false, error: 'user_mismatch' }, 403)
  }

  // 4. 포트원 서버에서 결제 내역 검증
  try {
    const portoneRes = await fetch(
      `https://api.portone.io/payments/${encodeURIComponent(paymentId)}`,
      {
        headers: {
          Authorization: `PortOne ${c.env.PORTONE_V2_API_SECRET}`,
          'Content-Type': 'application/json',
        },
      }
    )

    if (!portoneRes.ok) {
      const errText = await portoneRes.text()
      console.error('PortOne API error:', errText)
      return c.json({ ok: false, error: 'portone_api_failed' }, 500)
    }

    const paymentData = await portoneRes.json() as any

    // 5. 결제 상태 확인
    if (paymentData.status !== 'PAID') {
      return c.json({
        ok: false,
        error: `payment_not_completed: ${paymentData.status}`
      }, 400)
    }

    // 6. 금액 검증 (위변조 방지)
    const expectedAmounts: Record<string, number> = {
      monthly: 9900,
      yearly: 79000,
    }
    const expectedAmount = expectedAmounts[planId]
    if (!expectedAmount) {
      return c.json({ ok: false, error: 'invalid_plan' }, 400)
    }
    if (paymentData.amount?.total !== expectedAmount) {
      console.error(`Amount mismatch: expected ${expectedAmount}, got ${paymentData.amount?.total}`)
      return c.json({ ok: false, error: 'amount_mismatch' }, 400)
    }

    // 7. Supabase admin으로 is_paid 업데이트 (RLS 우회)
    const admin = getSupabaseAdmin(c.env)

    const { error: updateError } = await admin
      .from('user_profiles')
      .update({
        is_paid: true,
        plan_type: planId,
        paid_at: new Date().toISOString(),
      })
      .eq('id', userId)

    if (updateError) {
      console.error('Supabase update error:', updateError)
      return c.json({ ok: false, error: 'db_update_failed' }, 500)
    }

    // 8. 결제 내역 로그 저장 (선택적 — 추후 payment_logs 테이블로 확장 가능)
    console.log(`[PAYMENT] user=${userId} plan=${planId} paymentId=${paymentId} amount=${paymentData.amount?.total}`)

    return c.json({ ok: true, plan: planId })

  } catch (err: any) {
    console.error('Payment complete error:', err)
    return c.json({ ok: false, error: err.message }, 500)
  }
})

export default paymentApi
