import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * MASTER SECURITY MIDDLEWARE (proxy.ts)
 * Note: Framework requires the filename to be proxy.ts and the function to be named 'proxy'.
 */
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
    // --- 1. ROOT-BYPASS (SÄKERHET FÖR MRSUNSHINE88) ---
    // Hämtar IP för apersson508@gmail.com
    const { data: rootIp, error: rootError } = await supabase.rpc('get_root_admin_ip');
    
    if (rootError) {
      console.error(`[PROXY] Fel vid hämtning av Root-IP: ${rootError.message}`);
    }

    if (rootIp) {
      const cleanRootIp = rootIp.replace(/^.*:ffff:/, '');
      if (ip === cleanRootIp) {
        // Om det är ägarens IP, släpp förbi direkt (Total Immunitet)
        // console.log(`[PROXY] 🛡️ Root Bypass aktiv: ${ip}`);
        return response;
      }
    }

    // --- 2. KOLLA SPÄRRILISTAN (HUVUDSKYDD) ---
    const { data: isBlocked, error: blockError } = await supabase
      .from('blocked_ips')
      .select('ip, reason')
      .eq('ip', ip)
      .single();

    if (blockError && blockError.code !== 'PGRST116') {
      console.error(`[PROXY] Databasfel vid IP-kontroll (!): ${blockError.message}`);
      // Tips: Om du ser Permission Denied här, kör fix_ip_blocking_rls.sql
    }

    if (isBlocked) {
      console.log(`[PROXY] 🛑 BLOCKERAT IP FÖRSÖKER ANSLUTA: ${ip} (Anledning: ${isBlocked.reason})`);
      return NextResponse.redirect(new URL('/blocked', request.url));
    }
  }



  // 3. Uppdatera session
  await supabase.auth.getUser()

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|blocked|favicon.ico).*)',
  ],
}

