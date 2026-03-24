import { Hono } from 'hono'
import type { Env } from '../lib/supabase'
import { getSupabaseAdmin } from '../lib/supabase'
import { parseSessionCookie } from '../lib/session'

const fileApi = new Hono<{ Bindings: Env }>()
const ADMIN_EMAIL = 'lsol3264@gmail.com'
const BUCKET = 'guide-files'

async function requireAdmin(c: any) {
  const cookie = c.req.header('Cookie') ?? ''
  const sessionStr = parseSessionCookie(cookie)
  if (!sessionStr) return null
  try {
    let sessionObj: any
    try { sessionObj = JSON.parse(sessionStr) }
    catch { sessionObj = JSON.parse(decodeURIComponent(sessionStr)) }
    if (!sessionObj?.access_token) return null
    const { getSupabaseClientWithToken } = await import('../lib/supabase')
    const supabase = getSupabaseClientWithToken(c.env, sessionObj.access_token)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user || user.email !== ADMIN_EMAIL) return null
    return { user }
  } catch { return null }
}

// POST /api/files/upload/:guideId/:slot (slot: 1|2|3)
fileApi.post('/upload/:guideId/:slot', async (c) => {
  const auth = await requireAdmin(c)
  if (!auth) return c.json({ ok: false, error: 'unauthorized' }, 401)

  const guideId = c.req.param('guideId')
  const slot = c.req.param('slot') // '1','2','3'
  if (!['1','2','3'].includes(slot)) return c.json({ ok: false, error: 'invalid slot' }, 400)

  const db = getSupabaseAdmin(c.env)

  // multipart/form-data 파싱
  let formData: FormData
  try {
    formData = await c.req.formData()
  } catch {
    return c.json({ ok: false, error: 'Invalid form data' }, 400)
  }
  const file = formData.get('file') as File | null
  if (!file) return c.json({ ok: false, error: 'No file provided' }, 400)

  // 20MB 체크
  if (file.size > 20 * 1024 * 1024) {
    return c.json({ ok: false, error: '파일 크기가 20MB를 초과합니다' }, 400)
  }

  // 확장자 체크
  const allowed = ['.xlsx', '.xls', '.zip', '.rar', '.pdf', '.docx', '.hwp']
  const ext = '.' + file.name.split('.').pop()?.toLowerCase()
  if (!allowed.includes(ext)) {
    return c.json({ ok: false, error: `허용되지 않는 파일 형식입니다. 허용: ${allowed.join(', ')}` }, 400)
  }

  // 파일명 보존 + 고유성을 위해 타임스탬프 prefix
  const timestamp = Date.now()
  const safeFileName = file.name.replace(/[^a-zA-Z0-9가-힣._-]/g, '_')
  const storagePath = `guides/${guideId}/${timestamp}_${safeFileName}`

  // Supabase Storage 업로드
  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadErr } = await db.storage
    .from(BUCKET)
    .upload(storagePath, arrayBuffer, {
      contentType: file.type || 'application/octet-stream',
      upsert: true
    })

  if (uploadErr) {
    console.error('[File Upload] Storage error:', uploadErr.message)
    return c.json({ ok: false, error: uploadErr.message }, 500)
  }

  // Public URL 가져오기
  const { data: urlData } = db.storage.from(BUCKET).getPublicUrl(storagePath)
  const publicUrl = urlData?.publicUrl

  // guides 테이블 업데이트
  const updateData: any = {
    [`file_url_${slot}`]: publicUrl,
    [`file_name_${slot}`]: file.name, // 원본 파일명 보존
    updated_by: auth.user.email,
    updated_at: new Date().toISOString(),
  }
  const { error: dbErr } = await db.from('guides').update(updateData).eq('id', guideId)
  if (dbErr) return c.json({ ok: false, error: dbErr.message }, 500)

  return c.json({ ok: true, url: publicUrl, name: file.name, slot })
})

// DELETE /api/files/delete/:guideId/:slot
fileApi.delete('/delete/:guideId/:slot', async (c) => {
  const auth = await requireAdmin(c)
  if (!auth) return c.json({ ok: false, error: 'unauthorized' }, 401)

  const guideId = c.req.param('guideId')
  const slot = c.req.param('slot')
  if (!['1','2','3'].includes(slot)) return c.json({ ok: false, error: 'invalid slot' }, 400)

  const db = getSupabaseAdmin(c.env)

  // 현재 URL 가져와서 Storage에서도 삭제
  const { data: guide } = await db.from('guides')
    .select(`file_url_${slot}`)
    .eq('id', guideId)
    .single()

  const fileUrl = guide?.[`file_url_${slot}`]
  if (fileUrl) {
    // URL에서 path 추출
    const urlParts = fileUrl.split('/storage/v1/object/public/' + BUCKET + '/')
    if (urlParts[1]) {
      await db.storage.from(BUCKET).remove([urlParts[1]])
    }
  }

  // DB에서 URL 제거
  const updateData: any = {
    [`file_url_${slot}`]: null,
    [`file_name_${slot}`]: null,
    updated_by: auth.user.email,
    updated_at: new Date().toISOString(),
  }
  const { error } = await db.from('guides').update(updateData).eq('id', guideId)
  if (error) return c.json({ ok: false, error: error.message }, 500)

  return c.json({ ok: true })
})

// GET /api/files/download-proxy?url=... (직접 다운로드 프록시)
fileApi.get('/download-proxy', async (c) => {
  const url = c.req.query('url')
  const name = c.req.query('name') || 'download'
  if (!url) return c.json({ error: 'No URL' }, 400)

  // Supabase Storage URL만 허용 (보안)
  if (!url.includes('supabase.co') && !url.includes('supabase.in')) {
    return c.json({ error: 'Invalid URL' }, 403)
  }

  const response = await fetch(url)
  if (!response.ok) return c.json({ error: 'File not found' }, 404)

  const blob = await response.arrayBuffer()
  const contentType = response.headers.get('content-type') || 'application/octet-stream'

  c.header('Content-Type', contentType)
  c.header('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(name)}`)
  c.header('Content-Length', blob.byteLength.toString())

  return new Response(blob, {
    headers: {
      'Content-Type': contentType,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
    }
  })
})

export default fileApi
