import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import UploadPage from '@/app/dashboard/upload/page';
import { useVaultStore } from '@/store/vault.store';
import { supabase } from '@/lib/supabase/client';

// Mock useRouter
vi.mock('next/navigation', () => ({
  useRouter: () => ({ push: vi.fn() })
}));

// Mock crypto module
vi.mock('@/lib/crypto', () => ({
  generateDocumentKey: vi.fn().mockResolvedValue({}),
  encryptFile: vi.fn().mockResolvedValue({ encryptedData: new ArrayBuffer(10), iv: new Uint8Array(12) }),
  wrapKey: vi.fn().mockResolvedValue(new ArrayBuffer(32)),
}));

// Mock compress module
vi.mock('@/lib/compress', () => ({
  compressImage: vi.fn().mockImplementation(async (f) => f),
  compressPDF: vi.fn().mockImplementation(async (f) => f),
}));

// Mock ocr module
vi.mock('@/lib/ocr', () => ({
  extractDocumentMetadata: vi.fn().mockResolvedValue({
    extracted_name: 'Test Doc',
    extracted_doc_number: null,
    expiry_date: null
  }),
}));

// Mock audit module
vi.mock('@/lib/audit', () => ({
  logAuditEvent: vi.fn().mockResolvedValue(undefined),
}));

describe('Upload Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useVaultStore.setState({
      currentUser: { id: 'test-user', family_id: 'test-family' },
      masterKey: {} as CryptoKey,
    });
  });

  it('full pipeline works in order', async () => {
    render(<UploadPage />);
    
    // Select document type
    const aadharButton = await screen.findByText('Aadhar');
    fireEvent.click(aadharButton);
    
    // Select file
    const file = new File(['hello'], 'hello.png', { type: 'image/png' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    
    Object.defineProperty(input, 'files', {
      value: [file]
    });
    fireEvent.change(input);
    
    // Click Upload
    const uploadButton = await screen.findByText('Encrypt & Secure Document');
    fireEvent.click(uploadButton);
    
    // Wait for the pipeline to finish
    await waitFor(() => {
      expect(supabase.storage.from('documents').upload).toHaveBeenCalled();
    });
    
    expect((supabase.from('documents') as any).insert).toHaveBeenCalled();
    expect((supabase.from('encryption_keys') as any).insert).toHaveBeenCalled();
  });

  it('upload fails gracefully if storage upload fails', async () => {
    (supabase.storage.from('documents') as any).upload.mockResolvedValueOnce({
      error: { message: 'Storage Error' }
    });
    
    render(<UploadPage />);
    
    // Select document type
    const panButton = await screen.findByText('Pan');
    fireEvent.click(panButton);
    
    // Select file
    const file = new File(['hello'], 'hello.pdf', { type: 'application/pdf' });
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    Object.defineProperty(input, 'files', { value: [file] });
    fireEvent.change(input);
    
    // Click Upload
    const uploadButton = await screen.findByText('Encrypt & Secure Document');
    fireEvent.click(uploadButton);
    
    // It should display error and NOT insert metadata
    await waitFor(() => {
      expect(screen.getByText(/Storage Error/)).toBeInTheDocument();
    });
    
    expect((supabase.from('documents') as any).insert).not.toHaveBeenCalled();
    expect((supabase.from('encryption_keys') as any).insert).not.toHaveBeenCalled();
  });
});
