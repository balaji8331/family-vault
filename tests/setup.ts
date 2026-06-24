import '@testing-library/jest-dom';
import { vi } from 'vitest';
import crypto from 'crypto';

// 1. Mock window.crypto.subtle using Node's crypto
if (typeof window !== 'undefined') {
  Object.defineProperty(window, 'crypto', {
    value: {
      subtle: crypto.webcrypto.subtle,
      getRandomValues: (arr: any) => crypto.webcrypto.getRandomValues(arr),
      randomUUID: () => crypto.randomUUID()
    }
  });
}

// 2. Mock Supabase Client
const mockChain = {
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockResolvedValue({ data: {}, error: null }),
  update: vi.fn().mockResolvedValue({ data: {}, error: null }),
  delete: vi.fn().mockReturnThis(),
  eq: vi.fn().mockReturnThis(),
  in: vi.fn().mockReturnThis(),
  single: vi.fn().mockResolvedValue({ data: {}, error: null }),
  order: vi.fn().mockReturnThis(),
};

const mockStorageChain = {
  upload: vi.fn().mockResolvedValue({ data: { path: 'test/path.enc' }, error: null }),
  remove: vi.fn().mockResolvedValue({ data: {}, error: null }),
  createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: 'http://test-url.com' }, error: null }),
};

vi.mock('@/lib/supabase/client', () => {
  return {
    supabase: {
      from: vi.fn().mockReturnValue(mockChain),
      storage: {
        from: vi.fn().mockReturnValue(mockStorageChain),
      },
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'test-user-id' } } }, error: null }),
      }
    }
  };
});

// Mock URL methods used by Blob rendering
if (typeof window !== 'undefined') {
  window.URL.createObjectURL = vi.fn(() => 'blob:http://localhost/test');
  window.URL.revokeObjectURL = vi.fn();
}

// 3. Mock Zustand Vault Store
vi.mock('@/store/vault.store', () => {
  let state = {
    currentUser: { id: 'test-user-id', family_id: 'test-family-id', role: 'member' },
    masterKey: null as CryptoKey | null,
    familyKey: null as CryptoKey | null,
    sessionReady: true,
    isUploading: false,
    setIsUploading: vi.fn(),
  };

  return {
    useVaultStore: Object.assign(
      (selector: any) => selector(state),
      {
        getState: () => state,
        setState: (newState: any) => { state = { ...state, ...newState }; },
      }
    )
  };
});
