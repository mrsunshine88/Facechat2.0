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

      // 3. IP-vakt (Server-side)
      const reqIp = (request as any).ip;
      const xfwd = request.headers.get('x-forwarded-for');
      const xreal = request.headers.get('x-real-ip');
      const rawIp = reqIp || (xfwd ? xfwd.split(',')[0].trim() : (xreal || '127.0.0.1'));
      const ip = rawIp.replace(/^.*:ffff:/, '');

      const [isRootIpResult, blockResult, authResult] = await Promise.all([
        supabase.rpc('check_is_root_ip', { test_ip: ip }),
        supabase.from('blocked_ips').select('ip, reason').eq('ip', ip).maybeSingle(),
        shouldCheckAuth ? supabase.auth.getUser() : Promise.resolve({ data: { user: null }, error: null })
      ]);

      const isRootIp = isRootIpResult.data;
      const isBlocked = blockResult.data;
      const user = authResult.data?.user;

      // ROOT-BYPASS (Säkrat IP)
      if (isRootIp) {
         return response;
      }

      // IP-SPÄRR (Server-side)
      if (isBlocked) {
        const redirectRes = NextResponse.redirect(new URL('/blocked', request.url));
        response.cookies.getAll().forEach(c => redirectRes.cookies.set(c));
        return redirectRes;
      }

      // 4. SESSIONS-VAKT & AUTH
      const isPublicRoute = request.nextUrl.pathname.startsWith('/login') || 
                            request.nextUrl.pathname.startsWith('/auth/callback') ||
                            request.nextUrl.pathname.startsWith('/update-password');

      if (!user && !isPublicRoute) {
        const redirectRes = NextResponse.redirect(new URL('/login', request.url))
        response.cookies.getAll().forEach(c => redirectRes.cookies.set(c))
        return redirectRes
      }

      if (user && !isPublicRoute) {
        // Kolla om användaren är bannad eller har en ogiltig session i REALTID
        const { data: prof } = await supabase.from('profiles').select('session_key, is_banned').eq('id', user.id).maybeSingle();
        
        if (prof?.is_banned) {
          await supabase.auth.signOut();
          return NextResponse.redirect(new URL('/login?error=blocked', request.url));
        }

        // SESSION LOCK: Om cookien 'facechat_session_key' inte matchar databasen -> Logga ut
        const cookieSess = request.cookies.get('facechat_session_key')?.value;
        if (prof?.session_key && cookieSess && prof.session_key !== cookieSess) {
          await supabase.auth.signOut();
          return NextResponse.redirect(new URL('/login?error=session_conflict', request.url));
        }
      }

      if (user && request.nextUrl.pathname.startsWith('/login')) {
        return NextResponse.redirect(new URL('/', request.url))
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

