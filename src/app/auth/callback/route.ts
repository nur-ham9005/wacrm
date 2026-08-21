import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Auth callback — handles the `?code=...` redirect from Supabase
 * password-recovery (and any future email-link) flows. Exchanges the
 * code for a session, then sends the user on to the `next` target
 * (e.g. /reset-password). The forgotten-password form points here via
 * `redirectTo: /auth/callback?next=/reset-password`.
 *
 * `next` is sanitised to a same-origin path before redirecting so a
 * crafted link can't be abused as an open redirector.
 */
export async function GET(request: NextRequest) {
  const url = new URL(request.url)
  const code = url.searchParams.get('code')
  const next = url.searchParams.get('next') ?? '/dashboard'

  const safeNext =
    next.startsWith('/') && !next.startsWith('//') ? next : '/dashboard'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(new URL(safeNext, request.url))
    }
  }

  return NextResponse.redirect(new URL('/login', request.url))
}
