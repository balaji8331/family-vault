import { create } from 'zustand';

interface VaultState {
  masterKey: ArrayBuffer | null;
  familyKey: ArrayBuffer | null;
  currentUser: any | null;
  sessionReady: boolean;
  isUploading: boolean;
  setMasterKey: (key: ArrayBuffer | null) => void;
  setFamilyKey: (key: ArrayBuffer | null) => void;
  setCurrentUser: (user: any | null) => void;
  setSessionReady: (ready: boolean) => void;
  setIsUploading: (uploading: boolean) => void;
  clearKeys: () => void;
}

export const useVaultStore = create<VaultState>((set) => ({
  masterKey: null,
  familyKey: null,
  currentUser: null,
  sessionReady: false,
  isUploading: false,
  setMasterKey: (key) => set({ masterKey: key }),
  setFamilyKey: (key) => set({ familyKey: key }),
  setCurrentUser: (user) => set({ currentUser: user }),
  setSessionReady: (ready) => set({ sessionReady: ready }),
  setIsUploading: (uploading) => set({ isUploading: uploading }),
  clearKeys: () => set({ masterKey: null, familyKey: null, sessionReady: false }),
}));
