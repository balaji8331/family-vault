import { create } from 'zustand'

export interface CurrentUser {
  id: string
  role: string
  family_id: string | null
  full_name: string
  email: string
}

interface VaultState {
  masterKey: CryptoKey | null
  familyKey: CryptoKey | null
  sessionReady: boolean
  currentUser: CurrentUser | null
  
  setMasterKey: (key: CryptoKey | null) => void
  setFamilyKey: (key: CryptoKey | null) => void
  setCurrentUser: (user: CurrentUser | null) => void
  clearSession: () => void
}

/**
 * Zustand store for managing the client-side state of the vault.
 * Specifically configured NOT to use localStorage persistence 
 * to ensure that master and family keys only live in memory.
 */
export const useVaultStore = create<VaultState>((set) => ({
  masterKey: null,
  familyKey: null,
  sessionReady: false,
  currentUser: null,
  
  setMasterKey: (key) => set((state) => ({ 
    masterKey: key, 
    // Session is ready when we have both a user and their decrypted master key
    sessionReady: key !== null && state.currentUser !== null 
  })),
  
  setFamilyKey: (key) => set({ 
    familyKey: key 
  }),
  
  setCurrentUser: (user) => set((state) => ({ 
    currentUser: user,
    // Session is ready when we have both a user and their decrypted master key
    sessionReady: user !== null && state.masterKey !== null
  })),
  
  clearSession: () => set({ 
    masterKey: null, 
    familyKey: null, 
    sessionReady: false, 
    currentUser: null 
  }),
}))
