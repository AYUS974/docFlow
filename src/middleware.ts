import { NextRequest, NextResponse } from 'next/server'

const COOKIE = 'wsid'
const MAX_AGE = 60 * 60 * 24 * 7 // 7 days

/**
 * Ensure every visitor has an anonymous workspace id (`wsid`) cookie.
 *
 * On the first request without one we mint a random id, set it as an httpOnly
 * cookie, AND forward it on the incoming request headers so this same request's
 * route handlers (which read the cookie via next/headers) already see it.
 */
export function middleware(req: NextRequest) {
  if (req.cookies.get(COOKIE)?.value) return NextResponse.next()

  const wsid = crypto.randomUUID()

  const requestHeaders = new Headers(req.headers)
  const prior = req.headers.get('cookie')
  requestHeaders.set('cookie', prior ? `${prior}; ${COOKIE}=${wsid}` : `${COOKIE}=${wsid}`)

  const res = NextResponse.next({ request: { headers: requestHeaders } })
  res.cookies.set(COOKIE, wsid, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE,
  })
  return res
}

export const config = {
  // Run on pages and API routes; skip Next internals and static assets.
  matcher: ['/((?!_next/static|_next/image|favicon.svg|fonts/|pdf-worker/).*)'],
}
