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

  // Call Supabase RPC to get user role
  const { data, error: rpcError } = await supabase.rpc('get_user_role', { 
    user_id: user.id 
  })

  if (rpcError || !data || data.length === 0) {
    console.error('RPC get_user_role error or no data:', rpcError)
    return NextResponse.redirect(`${origin}/login?error=no_profile`)
  }

  const role = data[0].role

  // Redirect based on role
  if (role === 'super_admin') {
    return NextResponse.redirect(`${origin}/admin`)
  } else if (role === 'family_admin' || role === 'member') {
    return NextResponse.redirect(`${origin}${next}`)
  }

  // Fallback in case of unexpected role
  return NextResponse.redirect(`${origin}/login?error=no_profile`)
}
