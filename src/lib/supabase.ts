// Supabase 클라이언트 - 서버사이드 (Cloudflare Workers 환경)
import { createClient } from '@supabase/supabase-js'

export type Env = {
  SUPABASE_URL: string
  SUPABASE_ANON_KEY: string
}

export function getSupabaseClient(env: Env) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
      detectSessionInUrl: false,
    },
  })
}

export function getSupabaseClientWithToken(env: Env, accessToken: string) {
  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
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
  return supabase
}
