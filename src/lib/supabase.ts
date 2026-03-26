// ============================================================
// Supabase 클라이언트 + 환경변수 타입 정의
// ⚠️  SERVICE_ROLE_KEY / PORTONE_V2_API_SECRET 는
//     이 파일(서버사이드)에서만 사용 — 브라우저로 절대 노출 금지
// ============================================================
import { createClient } from '@supabase/supabase-js'

export type Env = {
  // ── Supabase ──────────────────────────────────────────────
  SUPABASE_URL: string               // 프로젝트 URL (브라우저 노출 허용)
  SUPABASE_ANON_KEY: string          // anon/publishable 키 (브라우저 노출 허용)
  SUPABASE_SERVICE_ROLE_KEY: string  // ❌ 서버사이드 전용 — 절대 브라우저 노출 금지

  // ── Google OAuth (Supabase가 처리, 직접 사용 안 함) ────────
  GOOGLE_CLIENT_ID: string           // OAuth 클라이언트 ID
  GOOGLE_CLIENT_SECRET: string       // ❌ 서버사이드 전용

  // ── Resend (이메일 발송) ───────────────────────────────────
  RESEND_API_KEY: string                // ❌ 서버사이드 전용

  // ── 포트원 V2 ─────────────────────────────────────────────
  PORTONE_V2_STORE_ID: string           // Store ID (브라우저 노출 허용)
  PORTONE_V2_CHANNEL_KEY_KAKAO: string  // 카카오페이 채널 키 (브라우저 노출 허용)
  PORTONE_V2_CHANNEL_KEY_TOSS: string   // 토스 채널 키 (브라우저 노출 허용)
  PORTONE_V2_API_SECRET: string         // ❌ 서버사이드 전용 — 절대 브라우저 노출 금지
}

// ── 일반 사용자 권한 (anon key) ────────────────────────────
export function getSupabaseClient(env: Env) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  })
}

// ── 사용자 토큰 기반 (RLS 적용) ───────────────────────────
export function getSupabaseClientWithToken(env: Env, accessToken: string) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    global: { headers: { Authorization: `Bearer ${accessToken}` } },
  })
}

// ── 관리자 권한 (service_role) ─────────────────────────────
// ⚠️  결제 완료 처리 등 서버사이드 로직에서만 호출
// ⚠️  이 함수의 반환값을 절대 브라우저로 전달하지 말 것
export function getSupabaseAdmin(env: Env) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}
