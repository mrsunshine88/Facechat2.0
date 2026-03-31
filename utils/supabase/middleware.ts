import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

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
          
          supabaseResponse = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          
          cookiesToSet.forEach(({ name, value, options }) => {
            supabaseResponse.cookies.set(name, value, options)
          })
        },
      },
    }
  )

  // Uppdatera sessionen genom att hämta nuvarande användare.
  const { data: { user } } = await supabase.auth.getUser()

  const isPublicRoute = request.nextUrl.pathname.startsWith('/login') || request.nextUrl.pathname.startsWith('/auth/callback')
  const isUpdatePasswordRoute = request.nextUrl.pathname.startsWith('/update-password')
  const isWebManifest = request.nextUrl.pathname.endsWith('.json') || request.nextUrl.pathname.endsWith('.png')

  // Skydda alla privata routes
  if (!user && !isPublicRoute && !isUpdatePasswordRoute && !isWebManifest) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Omdirigera inloggade FRÅN login till startsidan (men rör inte update-password)
  if (user && request.nextUrl.pathname.startsWith('/login')) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}
