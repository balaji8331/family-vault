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
  isUploading: boolean
  
  setMasterKey: (key: CryptoKey | null) => void
  setFamilyKey: (key: CryptoKey | null) => void
  setCurrentUser: (user: CurrentUser | null) => void
  setIsUploading: (isUploading: boolean) => void
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
  isUploading: false,
  
  setMasterKey: (key) => set({ 
    masterKey: key 
  }),
  
  setFamilyKey: (key) => set({ 
    familyKey: key 
  }),
  
  setCurrentUser: (user) => set({ 
    currentUser: user
  }),
  
  setIsUploading: (isUploading) => set({ isUploading }),
  
  clearSession: () => set({ 
    masterKey: null, 
    familyKey: null, 
    sessionReady: false, 
    currentUser: null 
  }),
}))
