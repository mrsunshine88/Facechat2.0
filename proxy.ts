import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * MASTER SECURITY MIDDLEWARE (proxy.ts)
 * Note: Framework requires the filename to be proxy.ts and the function to be named 'proxy'.
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({
    request,
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
          response.cookies.set({ 
            name, 
            value, 
            ...options,
            maxAge: 60 * 60 * 24 * 30, // 30 days
            path: '/', 
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({ name, value: '', ...options })
          response.cookies.set({ 
            name, 
            value: '', 
            ...options,
            maxAge: 0,
            path: '/',
          })
        },
      },
    }
  )

  // 2. Kontrollera IP-blockering (Förbättrad detektering)
  // Vi kollar request.ip först (Next.js standard), sen vanliga headers
  const reqIp = (request as any).ip;
  const xfwd = request.headers.get('x-forwarded-for');
  const xreal = request.headers.get('x-real-ip');
  
  // Rensa IP från ::ffff: prefix (IPv4-mapped IPv6)
  const rawIp = reqIp || (xfwd ? xfwd.split(',')[0].trim() : (xreal || '127.0.0.1'));
  const ip = rawIp.replace(/^.*:ffff:/, '');

  // Logga ALLA relevanta headers om vi misstänker att det inte funkar
  if (!request.nextUrl.pathname.startsWith('/_next')) {
     console.log(`[PROXY] Path: ${request.nextUrl.pathname} | Detected: ${ip} | Raw: ${rawIp}`);
  }

  // Undanta statiska filer och spärrsidan
  const isStatic = request.nextUrl.pathname.startsWith('/_next') || 
                   request.nextUrl.pathname.startsWith('/api') ||
                   request.nextUrl.pathname.includes('.') ||
                   request.nextUrl.pathname === '/favicon.ico';

  if (!isStatic && !request.nextUrl.pathname.startsWith('/blocked')) {
    // --- PARALLELLISERA KONTROLLER FÖR ATT MINSKA LATENCY (FÖRBÄTTRING) ---
    // Try-catch skyddar mot att hela sidan kraschar (500) om databasen laggar!
    let rootIp: string | null = null;
    let isBlocked: any = null;
    let user: any = null;

    try {
      const [rootResult, blockResult, authResult] = await Promise.all([
        supabase.rpc('get_root_admin_ip'),
        supabase.from('blocked_ips').select('ip, reason').eq('ip', ip).single(),
        supabase.auth.getUser()
      ]);

      rootIp = rootResult.data;
      isBlocked = blockResult.data;
      user = authResult.data?.user;

      if (rootResult.error) console.error(`[PROXY] Root-IP Fel: ${rootResult.error.message}`);
      if (blockResult.error && blockResult.error.code !== 'PGRST116') {
         console.error(`[PROXY] IP-spärr Fel: ${blockResult.error.message}`);
      }
    } catch (e: any) {
      console.error("[PROXY] Akut fel i säkerhetskontroll:", e.message);
      // Vid extremt fel (databasen helt nere), tillåt passage för att inte låsa ut alla, 
      // men logga felet så det kan åtgärdas.
    }

    // 1. ROOT-BYPASS (Logik för apersson508@gmail.com)
    if (rootIp) {
      const cleanRootIp = rootIp.replace(/^.*:ffff:/, '');
      if (ip === cleanRootIp) {
         if (user && request.nextUrl.pathname.startsWith('/login')) {
            return NextResponse.redirect(new URL('/', request.url));
         }
         return response;
      }
    }

    // 2. KOLLA SPÄRRILISTAN (HUVUDSKYDD)
    if (isBlocked) {
      console.log(`[PROXY] 🛑 BLOCKERAT IP FÖRSÖKER ANSLUTA: ${ip} (Anledning: ${isBlocked.reason})`);
      return NextResponse.redirect(new URL('/blocked', request.url));
    }

    // 3. SMART REDIRECT FÖR INLOGGADE
    if (user && request.nextUrl.pathname.startsWith('/login')) {
      return NextResponse.redirect(new URL('/', request.url))
    }
  }
 else {
    // Om det är en statisk fil, kolla bara login-redirect (vid behov)
    // Men oftast behövs inte auth-check vid statiska filer pga prestanda
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|blocked|favicon.ico).*)',
  ],
}

