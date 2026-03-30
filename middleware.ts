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

  // 1. Skapa Supabase-klient (Standard Original Logic)
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

  const isStatic = request.nextUrl.pathname.startsWith('/_next') || 
                   request.nextUrl.pathname.startsWith('/api') ||
                   request.nextUrl.pathname.includes('.') ||
                   request.nextUrl.pathname === '/favicon.ico';

  if (!isStatic && !request.nextUrl.pathname.startsWith('/blocked')) {
    const isLogin = request.nextUrl.pathname === '/login';
    const hasAuthCookies = request.cookies.getAll().some(c => c.name.startsWith('sb-'));
    const shouldCheckAuth = hasAuthCookies || !isLogin;

    // 2. Kolla IP-blockering (Endast för dynamiska sidor)
    const reqIp = (request as any).ip;
    const xfwd = request.headers.get('x-forwarded-for');
    const xreal = request.headers.get('x-real-ip');
    const rawIp = reqIp || (xfwd ? xfwd.split(',')[0].trim() : (xreal || '127.0.0.1'));
    const ip = rawIp.replace(/^.*:ffff:/, '');

    const [rootResult, blockResult, authResult] = await Promise.all([
      shouldCheckAuth ? supabase.rpc('get_root_admin_ip') : Promise.resolve({ data: null, error: null }),
      supabase.from('blocked_ips').select('ip, reason').eq('ip', ip).single(),
      shouldCheckAuth ? supabase.auth.getUser() : Promise.resolve({ data: { user: null }, error: null })
    ]);

    const rootIp = rootResult.data;
    const isBlocked = blockResult.data;
    const user = authResult.data?.user;

    // ROOT-BYPASS
    if (rootIp && ip === rootIp.replace(/^.*:ffff:/, '')) {
       return response;
    }

    // IP-SPÄRR
    if (isBlocked) {
      const redirectRes = NextResponse.redirect(new URL('/blocked', request.url));
      response.cookies.getAll().forEach(c => redirectRes.cookies.set(c));
      return redirectRes;
    }

    // AUTH-GUARD
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
  ],
}
