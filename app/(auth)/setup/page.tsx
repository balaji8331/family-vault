'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase/client'

export default function SetupPage() {
  const router = useRouter()
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (!fullName.trim()) {
      setError('Please enter your full name.')
      setLoading(false)
      return
    }

    try {
      // 1. Register the passkey biometric
      // @ts-ignore - Handle missing TS definitions if using an older/beta supabase-js version
      const { data: passkeyData, error: passkeyError } = await supabase.auth.registerPasskey()
      
      if (passkeyError) throw passkeyError

      // 2. Ensure we have an active session for the invited admin
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      
      if (userError || !user) {
        throw new Error('No active session found. Please accept your invite link first.')
      }

      // 3. Update the users table with the full name
      const { error: updateError } = await supabase
        .from('users')
        .update({ full_name: fullName.trim() })
        .eq('id', user.id)

      if (updateError) throw updateError

      // 4. Redirect to the dashboard upon successful setup
      router.push('/dashboard')
    } catch (err: any) {
      setError(err.message || 'An error occurred during setup.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-6 bg-gray-50">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl p-8 space-y-8">
        <div className="text-center">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Family Setup</h1>
          <p className="text-xl text-gray-600">Complete your profile to get started</p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded-xl text-center text-lg font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSetup} className="space-y-6">
          <div>
            <label htmlFor="fullName" className="block text-xl font-medium text-gray-800 mb-3">
              Full Name
            </label>
            <input
              id="fullName"
              type="text"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="Jane Doe"
              className="w-full px-5 py-4 border border-gray-300 rounded-2xl shadow-sm text-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              disabled={loading}
              required
            />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-5 px-4 border border-transparent rounded-2xl shadow-md text-xl font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Setting up...' : 'Register Passkey & Finish'}
          </button>
        </form>
      </div>
    </div>
  )
}
