'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'
import { logAuditEvent } from '@/lib/audit'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    const errorParam = searchParams.get('error')
    if (errorParam === 'unauthorized_email') {
      setError('Access Denied. Your Google account is not registered in our database. Please ask an admin to invite you first.')
    } else if (errorParam === 'exchange_failed') {
      setError('Failed to log in. Please try again.')
    } else if (errorParam === 'no_profile') {
      setError('Account not fully set up. Please contact an admin.')
    }
  }, [searchParams])

  const handleRoleRedirect = async (userId: string) => {
    const { data, error } = await supabase.rpc('get_user_role', {
      user_id: userId
    });

    if (error || !data || data.length === 0) {
      setError('Failed to fetch user role.')
      return
    }

    await logAuditEvent('login', 'system', userId);

    const role = data[0].role

    if (role === 'super_admin') {
      router.push('/admin')
    } else if (role === 'family_admin' || role === 'member') {
      router.push('/dashboard')
    } else {
      router.push('/dashboard')
    }
  }

  const handlePasskeyLogin = async () => {
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      // @ts-ignore - Handle missing TS definitions if using an older/beta supabase-js version
      const { data, error } = await supabase.auth.signInWithPasskey()
      
      if (error) throw error
      
      if (data?.user) {
        await handleRoleRedirect(data.user.id)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to sign in with Passkey')
    } finally {
      setLoading(false)
    }
  }

  const handleGoogleLogin = async () => {
    setLoading(true)
    setError(null)
    setMessage(null)
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      if (error) throw error
    } catch (err: any) {
      setError(err.message || 'Failed to initialize Google Login')
      setLoading(false)
    }
  }

  const handleMagicLink = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    if (!email.trim()) {
      setError('Please enter your email address.')
      setLoading(false)
      return
    }

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim(),
        options: {
          shouldCreateUser: false, // Ensure only existing members/admins can log in via email fallback
          emailRedirectTo: `${window.location.origin}/auth/callback`
        },
      })

      if (error) throw error
      
      setMessage('Check your email for the magic link!')
    } catch (err: any) {
      setError(err.message || 'Failed to send magic link')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Welcome Back</h1>
          <p className="text-xl text-gray-600">Sign in to your Family Vault</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded-xl text-center text-lg font-medium">
            {error}
          </div>
        )}

        {message && (
          <div className="bg-green-50 text-green-700 p-4 rounded-xl text-center text-lg font-medium">
            {message}
          </div>
        )}

        <div className="space-y-6">
          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="w-full flex justify-center items-center py-4 px-4 border border-gray-300 rounded-2xl shadow-sm text-lg font-semibold text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 transition-colors"
          >
            <svg className="w-6 h-6 mr-3" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

          <button
            onClick={handlePasskeyLogin}
            disabled={loading}
            className="w-full flex justify-center py-4 px-4 border border-transparent rounded-2xl shadow-md text-lg font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Processing...' : 'Use Passkey (Recommended)'}
          </button>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-lg">
              <span className="px-4 bg-white text-gray-500">Or use email</span>
            </div>
          </div>

          <form onSubmit={handleMagicLink} className="space-y-6">
            <div>
              <label htmlFor="email" className="block text-xl font-medium text-gray-800 mb-3">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full px-5 py-4 border border-gray-300 rounded-2xl shadow-sm text-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                disabled={loading}
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-5 px-4 border border-gray-300 rounded-2xl shadow-sm text-xl font-semibold text-gray-800 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
            >
              Send Magic Link
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

// useSearchParams() requires a Suspense boundary during static prerender (Next.js CSR
// bailout). Wrapping LoginForm keeps the /login route statically renderable.
export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
