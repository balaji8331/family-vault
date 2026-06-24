'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const handleRoleRedirect = async (userId: string) => {
    const { data, error } = await supabase.rpc('get_user_role', {
      user_id: userId
    });

    if (error || !data || data.length === 0) {
      setError('Failed to fetch user role.')
      return
    }

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
            onClick={handlePasskeyLogin}
            disabled={loading}
            className="w-full flex justify-center py-5 px-4 border border-transparent rounded-2xl shadow-md text-xl font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Processing...' : 'Use Passkey (Recommended)'}
          </button>

          <div className="relative my-8">
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
