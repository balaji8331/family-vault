'use client'

import { useState, useEffect } from 'react'
import { initializeMasterKey, loadFamilyKey, hasMasterValidationKey, setupMasterPassword, verifyMasterPassword } from '@/lib/keys'
import { useVaultStore } from '@/store/vault.store'
import { supabase } from '@/lib/supabase/client'

interface KeyInitModalProps {
  onSuccess?: () => void
}

export default function KeyInitModal({ onSuccess }: KeyInitModalProps) {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [needsSetup, setNeedsSetup] = useState<boolean | null>(null)
  
  const [userId, setUserId] = useState<string | null>(null)
  const [familyId, setFamilyId] = useState<string | null>(null)

  useEffect(() => {
    async function fetchUserContext() {
      const { data: { user } } = await supabase.auth.getUser()
      if (user) {
        setUserId(user.id)
        
        // Fetch required fields from the public users table to populate the store
        const { data } = await supabase
          .from('users')
          .select('family_id, role, full_name')
          .eq('id', user.id)
          .single()
          
        if (data) {
          setFamilyId(data.family_id)
          useVaultStore.getState().setCurrentUser({ 
            id: user.id, 
            family_id: data.family_id, 
            role: data.role,
            email: user.email || '',
            full_name: data.full_name || ''
          })
        }

        // Check if user has set up their master password
        try {
          const needs = !(await hasMasterValidationKey(user.id))
          setNeedsSetup(needs)
        } catch (err) {
          console.error(err)
        }
      }
    }
    fetchUserContext()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (!password) {
      setError('Password is required.')
      setLoading(false)
      return
    }

    if (needsSetup && password !== confirmPassword) {
      setError('Passwords do not match.')
      setLoading(false)
      return
    }

    if (!userId) {
      setError('User context not found. Please log in again.')
      setLoading(false)
      return
    }

    try {
      // 1. Initialize Master Key (Takes ~1 second due to PBKDF2 iterations)
      const masterKey = await initializeMasterKey(password, userId)
      
      // 2. Setup or Verify
      if (needsSetup) {
        await setupMasterPassword(userId, masterKey)
        setNeedsSetup(false)
      } else {
        await verifyMasterPassword(userId, masterKey)
      }

      // 3. Load the shared family key (derived from the family's key_seed)
      if (familyId) {
        await loadFamilyKey(familyId)
      }
      
      // 4. Mark session as fully ready
      useVaultStore.setState({ sessionReady: true })
      
      if (onSuccess) {
        onSuccess()
      }
    } catch (err: any) {
      setError(err.message || 'Failed to unlock vault.')
    } finally {
      setLoading(false)
    }
  }

  // Prevent rendering if user context isn't loaded yet
  if (!userId || needsSetup === null) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-8 space-y-6">
        <div className="text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            {needsSetup ? 'Create Master Password' : 'Unlock Vault'}
          </h2>
          <p className="text-lg text-gray-600">
            {needsSetup 
              ? 'This password encrypts everything. Do not lose it!' 
              : 'Enter your master password to decrypt your keys locally.'}
          </p>
        </div>

        {error && (
          <div className="bg-red-50 text-red-700 p-4 rounded-xl text-center text-lg font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="masterPassword" className="block text-xl font-medium text-gray-800 mb-3">
              Master Password
            </label>
            <input
              id="masterPassword"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-5 py-4 border border-gray-300 rounded-2xl shadow-sm text-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
              disabled={loading}
              autoFocus
            />
          </div>

          {needsSetup && (
            <div>
              <label htmlFor="confirmPassword" className="block text-xl font-medium text-gray-800 mb-3">
                Confirm Master Password
              </label>
              <input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-5 py-4 border border-gray-300 rounded-2xl shadow-sm text-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors"
                disabled={loading}
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex justify-center py-5 px-4 border border-transparent rounded-2xl shadow-md text-xl font-semibold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
          >
            {loading ? 'Processing...' : (needsSetup ? 'Set Password' : 'Unlock')}
          </button>
        </form>
      </div>
    </div>
  )
}
