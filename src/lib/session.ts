// 세션 쿠키 유틸리티
export function parseSessionCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null
  const match = cookieHeader.match(/sb-session=([^;]+)/)
  return match ? decodeURIComponent(match[1]) : null
}

export function setSessionCookie(token: string, maxAge = 60 * 60 * 24 * 7): string {
  return `sb-session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`
}

export function clearSessionCookie(): string {
  return `sb-session=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`
}
