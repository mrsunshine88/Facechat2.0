import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * MASTER SECURITY MIDDLEWARE (middleware.ts) - TOTAL ÅTERSTÄLLNING
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // 1. Snabb-bypass för statiska filer och Server Actions
  const isStatic = request.nextUrl.pathname.startsWith('/_next') || 
                   request.nextUrl.pathname.startsWith('/api') ||
                   request.nextUrl.pathname.includes('.') ||
                   request.nextUrl.pathname === '/favicon.ico';
                   
  const isAction = request.headers.get('next-action');

  if (isStatic || isAction) return response;

  try {
    // 2. Skapa Supabase-klient
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              request.cookies.set(name, value)
            })
            
            response = NextResponse.next({
              request,
            })
            
            cookiesToSet.forEach(({ name, value, options }) => {
              response.cookies.set(name, value, {
                ...options,
                maxAge: 60 * 60 * 24 * 30, // 30 dagar för mobilen
                path: '/',
              })
            })
          },
        },
      }
    )

    if (!request.nextUrl.pathname.startsWith('/blocked')) {
      const isLogin = request.nextUrl.pathname === '/login';
      const hasAuthCookies = request.cookies.getAll().some(c => c.name.startsWith('sb-'));
      const shouldCheckAuth = hasAuthCookies || !isLogin;

      // 3. IP-vakt (Hämta klient-IP)
      const reqIp = (request as any).ip;
      const xfwd = request.headers.get('x-forwarded-for');
      const xreal = request.headers.get('x-real-ip');
      const rawIp = reqIp || (xfwd ? xfwd.split(',')[0].trim() : (xreal || '127.0.0.1'));
      const ip = rawIp.replace(/^.*:ffff:/, '');

      // 4. KONSOLIDERAD SÄKERHETSKONTROLL (BANG! 🚀)
      // Vi kör alla kontroller (IP, Root, Ban, Session) i ETT ENDA anrop istället för fyra.
      const cookieSess = request.cookies.get('facechat_session_key')?.value || null;
      
      // OPTIMERING: Hämta användaren (Bara om det behövs för session-matchning)
      // Om vi inte har en session-cookie och är på en publik route, kan vi skippa getUser() ibland.
      const { data: { user } } = await supabase.auth.getUser();

      const { data: access, error: accessErr } = await supabase.rpc('check_request_access', {
        test_ip: ip,
        test_user_id: user?.id || null,
        test_session_key: cookieSess
      });

      if (accessErr) {
        console.error('[Middleware] Säkerhetskontroll misslyckades:', accessErr);
        return response; // Fallback: Tillåt åtkomst om databasen är nere (Säkerhetsrisk vs Användarupplevelse)
      }

      // ROOT-BYPASS (Säkrat IP / Master-Admin)
      if (access.is_root_ip) {
         return response;
      }

      // IP-SPÄRR (Server-side)
      if (access.is_blocked_ip) {
        const redirectRes = NextResponse.redirect(new URL('/blocked', request.url));
        response.cookies.getAll().forEach(c => redirectRes.cookies.set(c));
        return redirectRes;
      }

      // 4. SESSIONS-VAKT & AUTH
      const isPublicRoute = request.nextUrl.pathname.startsWith('/login') || 
                            request.nextUrl.pathname.startsWith('/auth/callback') ||
                            request.nextUrl.pathname.startsWith('/update-password');

      if (!user && !isPublicRoute) {
        // RESILIENS VID KALLSTART (MOBIL 📱): Om vi inte ser en session direkt på servern, 
        // så låter vi sidan laddas istället för att tvärstoppa med en omdirigering till /login.
        // Detta ger mobilens webbläsare chansen att "hitta" sina sparade kakor i bakgrunden.
        // Skulle användaren genuint vara utloggad kommer klientsidan (UserContext) att skicka dem till login.
        return response;
      }

      if (user && !isPublicRoute) {
        // Kontrollera om användaren är bannad eller har en ogiltig session
        if (access.is_banned_user) {
          await supabase.auth.signOut();
          const redirectRes = NextResponse.redirect(new URL('/login?error=blocked', request.url))
          response.cookies.getAll().forEach(c => redirectRes.cookies.set(c))
          return redirectRes
        }

        if (!access.session_match) {
          await supabase.auth.signOut();
          const redirectRes = NextResponse.redirect(new URL('/login?error=session_conflict', request.url))
          response.cookies.getAll().forEach(c => redirectRes.cookies.set(c))
          return redirectRes
        }
      }

      if (user && request.nextUrl.pathname.startsWith('/login')) {
        return NextResponse.redirect(new URL('/', request.url))
      }

      // 5. PROAKTIV KAK-HÄRDNING (FÖR MOBILEN 📱)
      // Vi tvingar alla inloggnings-kakor att vara permanenta (30 dagar) 
      // även om Supabase-klienten på mobilen råkade sätta dem som tillfälliga.
      if (user) {
        request.cookies.getAll().forEach(cookie => {
          if (cookie.name.startsWith('sb-') || cookie.name === 'facechat_session_key') {
            response.cookies.set(cookie.name, cookie.value, {
              path: '/',
              maxAge: 60 * 60 * 24 * 30,
              httpOnly: cookie.name === 'facechat_session_key',
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax'
            });
          }
        });
      }
    }
  } catch (err) {
    console.error('[Middleware] Recovery mode:', err);
    return response;
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * Feel free to modify this pattern to include more paths.
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}

