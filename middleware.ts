import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * MASTER SECURITY MIDDLEWARE (middleware.ts)
 * This is the framework entry point for all security and session logic.
 */
export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request,
  })

  // 1. Skapa Supabase-klient för Middleware
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
              httpOnly: true,
              secure: true,
              sameSite: 'lax',
              maxAge: 60 * 60 * 24 * 30, // Force 30 days
              path: '/',
            })
          })
        },
      },
    }
  )


  // 2. Kontrollera IP-blockering
  const reqIp = (request as any).ip;
  const xfwd = request.headers.get('x-forwarded-for');
  const xreal = request.headers.get('x-real-ip');
  
  const rawIp = reqIp || (xfwd ? xfwd.split(',')[0].trim() : (xreal || '127.0.0.1'));
  const ip = rawIp.replace(/^.*:ffff:/, '');

  if (!request.nextUrl.pathname.startsWith('/_next')) {
     console.log(`[SECURITY] Path: ${request.nextUrl.pathname} | IP: ${ip}`);
  }

  const isStatic = request.nextUrl.pathname.startsWith('/_next') || 
                   request.nextUrl.pathname.startsWith('/api') ||
                   request.nextUrl.pathname.includes('.') ||
                   request.nextUrl.pathname === '/favicon.ico';

  if (!isStatic && !request.nextUrl.pathname.startsWith('/blocked')) {
    let rootIp: string | null = null;
    let isBlocked: any = null;
    let user: any = null;

    try {
      const isLogin = request.nextUrl.pathname === '/login';
      const hasAuthCookies = request.cookies.getAll().some(c => c.name.startsWith('sb-'));
      const shouldCheckAuth = hasAuthCookies || !isLogin;

      // --- OPTIMERAD PARALLELL-KÖRNING ---
      const [rootResult, blockResult, authResult] = await Promise.all([
        shouldCheckAuth ? supabase.rpc('get_root_admin_ip') : Promise.resolve({ data: null, error: null }),
        supabase.from('blocked_ips').select('ip, reason').eq('ip', ip).single(),
        shouldCheckAuth ? supabase.auth.getUser() : Promise.resolve({ data: { user: null }, error: null })
      ]);

      rootIp = rootResult.data;
      isBlocked = blockResult.data;
      user = authResult.data?.user;

      // --- AUTOMATISK IP-SYNK (Server-side) ---
      // Om användaren är inloggad, kolla om IP har ändrats och spara direkt i dörrvakten.
      if (user && ip && ip !== '127.0.0.1' && ip !== '::1') {
         // Vi hämtar profilen i bakgrunden (vi blockerar inte för detta)
         supabase.from('profiles').select('last_ip').eq('id', user.id).single().then(({data: prof}) => {
            if (prof && prof.last_ip !== ip) {
               console.log(`[SECURITY] 🔄 Uppdaterar IP för ${user.email}: ${prof.last_ip} -> ${ip}`);
               supabase.from('profiles').update({ last_ip: ip }).eq('id', user.id).then(() => {});
            }
         });
      }
    } catch (e: any) {
      console.error("[SECURITY] Middleware fault:", e.message);
    }


    // 1. ROOT-BYPASS
    if (rootIp) {
      const cleanRootIp = rootIp.replace(/^.*:ffff:/, '');
      if (ip === cleanRootIp) {
         if (user && request.nextUrl.pathname.startsWith('/login')) {
            const redirectRes = NextResponse.redirect(new URL('/', request.url));
            response.cookies.getAll().forEach(c => redirectRes.cookies.set(c));
            return redirectRes;
         }
         return response;
      }
    }

    // 2. IP-SPÄRR
    if (isBlocked) {
      console.log(`[SECURITY] 🛑 BLOCKED IP: ${ip}`);
      const redirectRes = NextResponse.redirect(new URL('/blocked', request.url));
      response.cookies.getAll().forEach(c => redirectRes.cookies.set(c));
      return redirectRes;
    }

    // 3. Omdirigeringar
    const isPublicRoute = request.nextUrl.pathname.startsWith('/login') || 
                          request.nextUrl.pathname.startsWith('/auth/callback') ||
                          request.nextUrl.pathname.startsWith('/update-password') ||
                          request.nextUrl.pathname.endsWith('.json') || 
                          request.nextUrl.pathname.endsWith('.png');

    if (!user && !isPublicRoute) {
      const redirectRes = NextResponse.redirect(new URL('/login', request.url))
      response.cookies.getAll().forEach(c => redirectRes.cookies.set(c))
      return redirectRes
    }

    if (user && request.nextUrl.pathname.startsWith('/login')) {
      const redirectRes = NextResponse.redirect(new URL('/', request.url))
      response.cookies.getAll().forEach(c => redirectRes.cookies.set(c))
      return redirectRes
    }

  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|blocked|favicon.ico).*)',
  ],
}
