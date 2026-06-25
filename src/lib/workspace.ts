import { cookies } from 'next/headers'

export const WORKSPACE_COOKIE = 'wsid'

/**
 * Resolve the current request's workspace id from the `wsid` cookie.
 *
 * `middleware.ts` guarantees the cookie is present (it sets one on first visit
 * and forwards it to the same request), so this normally just reads it. The
 * fallback only guards against the cookie being stripped; it intentionally
 * isolates such requests into a throwaway bucket rather than a shared one.
 */
export async function getWorkspaceId(): Promise<string> {
  const store = await cookies()
  return store.get(WORKSPACE_COOKIE)?.value ?? 'no-session'
}
