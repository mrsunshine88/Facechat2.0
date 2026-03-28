import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * MASTER SECURITY MIDDLEWARE
 * Handles:
 * 1. IP Blocking (Enforcement)
 * 2. Root/Admin IP Immunity (Bypass)
 * 3. Auth Session Logic
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // 1. Skapa Supabase-klient för Middleware
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({ name, value, ...options })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({ name, value, ...options })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({ name, value: '', ...options })
        },
      },
    }
  )

  // 2. Kontrollera IP-blockering (Vattentätt skydd + Root-bypass)
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1'

  // Undanta kända adresser (localhost) och den nya spärrsidan
  if (ip !== '127.0.0.1' && ip !== '::1' && !request.nextUrl.pathname.startsWith('/blocked')) {
    // --- ROOT-BYPASS: Kolla om detta är ägar-IP eller en Admin ---
    // Vi hämtar Root-IP från funktionen
    const { data: rootIp } = await supabase.rpc('get_root_admin_ip');
    
    // Om det är ägaren, släpp förbi direkt (Immunitet)
    if (rootIp && ip === rootIp) {
      return response;
    }

    // Kolla om IP-adressen finns i spärrlistan
    const { data: isBlocked } = await supabase
      .from('blocked_ips')
      .select('ip, reason')
      .eq('ip', ip)
      .single()

    if (isBlocked) {
      // Skicka till vår spärrsida
      return NextResponse.redirect(new URL('/blocked', request.url))
    }
  }

  // 3. Uppdatera session (vanlig Next.js Supabase auth logik)
  await supabase.auth.getUser()

  return response
}

export const config = {
  matcher: [
    /*
     * Matcha alla rutter utom de som börjar med:
     * - api/ (om vi inte vill kontrollera API)
     * - _next/static (statiska filer)
     * - _next/image (bildoptimering)
     * - favicon.ico (favicon)
     */
    '/((?!_next/static|_next/image|blocked|favicon.ico).*)',
  ],
}
