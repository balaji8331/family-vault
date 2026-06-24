import { createBrowserClient } from '@supabase/ssr'

/**
 * Creates and returns a browser-side Supabase client.
 * Using createBrowserClient ensures that the PKCE flow uses cookies 
 * instead of localStorage, allowing the server-side callback to access the code verifier.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        flowType: 'pkce',
        detectSessionInUrl: true,
        experimental: {
          passkey: true
        }
      }
    }
  )
}

/**
 * Singleton Supabase client for browser-side usage.
 */
export const supabase = createClient()
