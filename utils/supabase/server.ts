import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              // Ensure sessions are persistent (30 days) instead of just session-based
              const persistentOptions = {
                ...options,
                maxAge: 60 * 60 * 24 * 30, // 30 days
                path: '/',
              }
              cookieStore.set(name, value, persistentOptions)
            })
          } catch (error) {
            // Server Component-felet catchas här. Middleware hanterar det faktiska sattet.
          }
        },
      },
    }
  )
}
