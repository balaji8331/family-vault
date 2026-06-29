import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getDocumentsByType, getUploadActivity, getExpiryTimeline, getStorageUsage } from '@/lib/analytics';
import { supabase } from '@/lib/supabase/client';

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  }
}));

describe('Analytics Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('getDocumentsByType returns correct grouping', async () => {
    const mockChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ 
        data: [{ doc_type: 'passport' }, { doc_type: 'passport' }, { doc_type: 'id' }], 
        error: null 
      })
    };
    (supabase.from as any).mockReturnValue(mockChain);

    const res = await getDocumentsByType('f1');
    expect(res).toEqual([
      { doc_type: 'passport', count: 2 },
      { doc_type: 'id', count: 1 }
    ]);
  });

  it('getStorageUsage sums bytes correctly', async () => {
    const mockChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ 
        data: [
          { doc_type: 'passport', file_size_bytes: 1000 }, 
          { doc_type: 'id', file_size_bytes: 500 }
        ], 
        error: null 
      })
    };
    (supabase.from as any).mockReturnValue(mockChain);

    const res = await getStorageUsage('f1');
    expect(res.total_bytes).toBe(1500);
    expect(res.by_type).toEqual([
      { doc_type: 'passport', bytes: 1000 },
      { doc_type: 'id', bytes: 500 }
    ]);
  });

  it('all functions return empty on Supabase error', async () => {
    const mockChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB Error' } }),
      not: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB Error' } })
    };
    (supabase.from as any).mockReturnValue(mockChain);

    const res1 = await getDocumentsByType('f1');
    expect(res1).toEqual([]);
    
    const res2 = await getStorageUsage('f1');
    expect(res2.total_bytes).toBe(0);
  });
});
