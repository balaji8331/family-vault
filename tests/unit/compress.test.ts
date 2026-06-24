import { describe, it, expect, vi } from 'vitest';
import { compressImage, compressPDF } from '@/lib/compress';

// Mock browser-image-compression to avoid complex canvas/worker dependencies in node
vi.mock('browser-image-compression', () => {
  return {
    default: vi.fn().mockImplementation(async (file) => {
      // Return a smaller blob to simulate compression
      return new Blob(["compressed"], { type: file.type });
    })
  };
});

describe('Compress Module', () => {
  it('compressImage reduces file size for JPEG input', async () => {
    // Generate a 1MB string
    const largeData = 'a'.repeat(1024 * 1024);
    const file = new File([largeData], 'large.jpg', { type: 'image/jpeg' });
    
    const compressed = await compressImage(file);
    
    expect(compressed.size).toBeLessThan(file.size);
    expect(compressed.name).toBe('large.jpg');
    expect(compressed.type).toBe('image/jpeg');
  });

  it('compressImage returns original file for PDF input', async () => {
    const file = new File(['fake-pdf'], 'doc.pdf', { type: 'application/pdf' });
    const compressed = await compressImage(file);
    
    // Should return original since it's not an image
    expect(compressed).toBe(file);
  });

  it('compressImage handles zero-byte file without throwing', async () => {
    const file = new File([], 'empty.png', { type: 'image/png' });
    const compressed = await compressImage(file);
    
    expect(compressed).toBeInstanceOf(File);
  });

  it('compressPDF returns a File object', async () => {
    // A minimal valid PDF structure string
    const minimalPdf = `%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\nxref\n0 3\n0000000000 65535 f \n0000000009 00000 n \n0000000058 00000 n \ntrailer\n<< /Size 3 /Root 1 0 R >>\nstartxref\n111\n%%EOF`;
    const file = new File([minimalPdf], 'test.pdf', { type: 'application/pdf' });
    
    const compressed = await compressPDF(file);
    
    expect(compressed).toBeInstanceOf(File);
    expect(compressed.name).toBe('test.pdf');
  });

  it('output file has same mime type as input', async () => {
    const file = new File(['a'.repeat(100)], 'test.webp', { type: 'image/webp' });
    const compressed = await compressImage(file);
    
    expect(compressed.type).toBe('image/webp');
  });
});
