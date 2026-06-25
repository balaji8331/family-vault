import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/dashboard'
  
  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=exchange_failed`)
  }

  const cookieStore = await cookies()
  
  const supabase = createServerClient(
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
              cookieStore.set(name, value, options)
            })
          } catch (error) {
            // The `set` method was called from a Server Component context.
            // In Route Handlers this should work, but catching the error
            // ensures we don't crash if called incorrectly elsewhere.
            console.error('Error setting cookies in auth callback:', error)
          }
        },
      },
    }
  )

  const { data: sessionData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code)

  if (exchangeError) {
    console.error('Supabase Auth Exchange Error:', exchangeError)
    return NextResponse.redirect(`${origin}/login?error=exchange_failed`)
  }

  const user = sessionData.session?.user

  if (!user) {
    console.error('Exchange successful but no user found in session.')
    return NextResponse.redirect(`${origin}/login?error=exchange_failed`)
  }

  const { data: userData, error: dbError } = await supabase
    .from('users')
    .select('role, family_id')
    .eq('id', user.id)
    .single()

  if (dbError || !userData) {
    console.error('Database query error or no user data:', dbError)
    await supabase.auth.signOut()
    return NextResponse.redirect(`${origin}/login?error=unauthorized_email`)
  }

  const { role, family_id } = userData

  // Redirect based on role and family status
  if (role === 'super_admin') {
    return NextResponse.redirect(`${origin}/admin`)
  } else if (!family_id) {
    return NextResponse.redirect(`${origin}/dashboard/family`)
  } else {
    return NextResponse.redirect(`${origin}${next}`)
  }
}
