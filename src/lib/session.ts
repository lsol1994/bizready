// 세션 쿠키 유틸리티
export function parseSessionObj(sessionStr: string): any {
  try {
    return JSON.parse(sessionStr)
  } catch {
    return JSON.parse(decodeURIComponent(sessionStr))
  }
}

export function parseSessionCookie(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null
  // sb-session= 이후 ; 전까지 모두 가져옴 (URL인코딩된 = 포함)
  const match = cookieHeader.match(/(?:^|;\s*)sb-session=([^;]*)/)
  if (!match) return null
  const raw = match[1]
  if (!raw) return null
  try {
    const decoded = decodeURIComponent(raw)
    // JSON 파싱 가능한지 검증
    JSON.parse(decoded)
    return decoded
  } catch {
    return raw
  }
}

export function setSessionCookie(token: string, maxAge = 60 * 60 * 24 * 7): string {
  return `sb-session=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=${maxAge}`
}

export function clearSessionCookie(): string {
  return `sb-session=; Path=/; HttpOnly; SameSite=None; Secure; Max-Age=0`
}
