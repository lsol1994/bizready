import { Hono } from 'hono'
import { parseSessionCookie, parseSessionObj } from '../lib/session'
import { getSupabaseClientWithToken } from '../lib/supabase'
import type { Env } from '../lib/supabase'

const checklistApi = new Hono<{ Bindings: Env }>()

// 세션에서 인증된 Supabase 클라이언트와 user_id를 반환
async function getAuthedClient(c: any) {
  const cookie = c.req.header('Cookie') ?? ''
  const sessionStr = parseSessionCookie(cookie)
  if (!sessionStr) return null
  try {
    const sessionObj = parseSessionObj(sessionStr)
    if (!sessionObj?.access_token) return null
    const supabase = getSupabaseClientWithToken(c.env, sessionObj.access_token)
    const { data: { user }, error } = await supabase.auth.getUser()
    if (error || !user) return null
    return { supabase, userId: user.id }
  } catch {
    return null
  }
}

// ── POST /api/checklist/custom — 커스텀 항목 추가 ──────────
checklistApi.post('/custom', async (c) => {
  const auth = await getAuthedClient(c)
  if (!auth) return c.json({ ok: false, error: 'unauthorized' }, 401)

  let label: string
  try {
    const body = await c.req.json<{ label: string }>()
    label = (body.label ?? '').trim()
  } catch {
    return c.json({ ok: false, error: 'invalid_body' }, 400)
  }

  if (!label) return c.json({ ok: false, error: 'label_required' }, 400)
  if (label.length > 100) return c.json({ ok: false, error: 'label_too_long' }, 400)

  const itemKey = `custom_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`

  const { error } = await auth.supabase.from('checklists').insert({
    user_id: auth.userId,
    item_key: itemKey,
    label,
    is_done: false,
  })

  if (error) return c.json({ ok: false, error: error.message }, 500)
  return c.json({ ok: true, item_key: itemKey, label })
})

// ── DELETE /api/checklist/custom/:key — 커스텀 항목 삭제 ──
checklistApi.delete('/custom/:key', async (c) => {
  const auth = await getAuthedClient(c)
  if (!auth) return c.json({ ok: false, error: 'unauthorized' }, 401)

  const key = c.req.param('key')
  if (!key.startsWith('custom_')) return c.json({ ok: false, error: 'invalid_key' }, 400)

  const { error } = await auth.supabase
    .from('checklists')
    .delete()
    .eq('user_id', auth.userId)
    .eq('item_key', key)

  if (error) return c.json({ ok: false, error: error.message }, 500)
  return c.json({ ok: true })
})

export default checklistApi
