import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
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

  // 2. Kontrollera IP-blockering (Vattentätt skydd)
  const forwarded = request.headers.get('x-forwarded-for')
  const ip = forwarded ? forwarded.split(',')[0].trim() : '127.0.0.1'

  // Undanta kända adresser (localhost)
  if (ip !== '127.0.0.1' && ip !== '::1') {
    const { data: isBlocked } = await supabase
      .from('blocked_ips')
      .select('ip, reason')
      .eq('ip', ip)
      .single()

    if (isBlocked) {
      // Omdirigera till en spärrsida eller returnera 403
      // Vi returnerar en enkel text för snabbhet
      return new NextResponse(
        `Åtkomst nekad: Din IP-adress (${ip}) är spärrad från Facechat. Anledning: ${isBlocked.reason || 'Ingen angiven'}`,
        { status: 403 }
      )
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
     * - api/ (om vi inte vill kontrollera API, men det vill vi oftast)
     * - _next/static (statiska filer)
     * - _next/image (bildoptimering)
     * - favicon.ico (favicon)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
