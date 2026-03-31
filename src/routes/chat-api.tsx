// ============================================================
// POST /api/chat  — Gemini 스트리밍 API
// ============================================================
import { Hono } from 'hono'
import { parseSessionCookie } from '../lib/session'
import { getSupabaseClientWithToken } from '../lib/supabase'
import { callAI } from '../lib/ai-chat'
import type { ChatMessage } from '../lib/ai-chat'
import type { Env } from '../lib/supabase'

const chatApi = new Hono<{ Bindings: Env }>()

chatApi.post('/', async (c) => {
  // ── 1. 세션 인증 ───────────────────────────────────────
  const cookie = c.req.header('Cookie') ?? ''
  const sessionStr = parseSessionCookie(cookie)
  if (!sessionStr) {
    return c.json({ ok: false, error: 'unauthorized' }, 401)
  }

  let isPaid = false
  try {
    const sessionObj = JSON.parse(decodeURIComponent(sessionStr))
    const supabase = getSupabaseClientWithToken(c.env, sessionObj.access_token)

    const { data: { user }, error: userErr } = await supabase.auth.getUser()
    if (userErr || !user) {
      return c.json({ ok: false, error: 'session_expired' }, 401)
    }

    // ── 2. 프리미엄 확인 ─────────────────────────────────
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('is_paid')
      .eq('id', user.id)
      .single()

    isPaid = profile?.is_paid ?? false
  } catch {
    return c.json({ ok: false, error: 'session_invalid' }, 401)
  }

  if (!isPaid) {
    return c.json({ ok: false, error: 'premium_required' }, 403)
  }

  // ── 3. 요청 바디 파싱 ─────────────────────────────────
  let messages: ChatMessage[]
  try {
    const body = await c.req.json<{ messages: ChatMessage[] }>()
    messages = body.messages
    if (!Array.isArray(messages) || messages.length === 0) {
      return c.json({ ok: false, error: 'messages required' }, 400)
    }
  } catch {
    return c.json({ ok: false, error: 'invalid json' }, 400)
  }

  // ── 4. AI 스트리밍 호출 ───────────────────────────────
  try {
    const stream = await callAI(messages, c.env)
    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'X-Accel-Buffering': 'no',
      },
    })
  } catch (e: any) {
    console.error('[chat-api] callAI error:', e?.message)
    return c.json({ ok: false, error: 'ai_error' }, 500)
  }
})

export default chatApi
