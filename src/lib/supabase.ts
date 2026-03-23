// Supabase 클라이언트 - 서버사이드 (Cloudflare Workers 환경)
import { createClient } from '@supabase/supabase-js'

export type Env = {
  SUPABASE_URL: string
  SUPABASE_ANON_KEY: string
  SUPABASE_SERVICE_ROLE_KEY: string
  PORTONE_STORE_ID: string
  PORTONE_CHANNEL_KEY_KAKAO: string
  PORTONE_CHANNEL_KEY_TOSS: string
  PORTONE_API_SECRET: string
}

// 일반 사용자 권한 (anon key)
export function getSupabaseClient(env: Env) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })
}

// 사용자 토큰 기반 (RLS 적용)
export function getSupabaseClientWithToken(env: Env, accessToken: string) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  })
}

// 관리자 권한 (service_role — RLS 우회, 결제 완료 처리용)
export function getSupabaseAdmin(env: Env) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
