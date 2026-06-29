import { describe, it, expect, vi, beforeEach } from 'vitest';
import { searchDocuments } from '@/lib/search';
import { supabase } from '@/lib/supabase/client';

// Mock Supabase client
vi.mock('@/lib/supabase/client', () => ({
  supabase: {
    from: vi.fn(),
  }
}));

describe('Search Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('empty query returns empty array without hitting DB', async () => {
    const results = await searchDocuments('   ', 'family-1', 'user-1');
    expect(results).toEqual([]);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('searchDocuments respects RLS (only owned + shared docs)', async () => {
    // Mock document_access response
    const mockAccessChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [{ document_id: 'doc-2' }], error: null })
    };
    
    // Mock documents response
    const mockOrder = vi.fn().mockResolvedValue({ 
      data: [{ id: 'doc-1' }, { id: 'doc-2' }], 
      error: null 
    });
    
    const mockOr = vi.fn().mockReturnValue({ order: mockOrder });
    
    const mockTextSearch = vi.fn().mockReturnValue({
      or: mockOr,
      eq: vi.fn().mockReturnValue({ order: mockOrder }) // Fallback if or is not called
    });
    
    const mockDocsChain = {
      select: vi.fn().mockReturnThis(),
      textSearch: mockTextSearch
    };

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'document_access') return mockAccessChain;
      if (table === 'documents') return mockDocsChain;
    });

    const results = await searchDocuments('test', 'family-1', 'user-1');
    
    expect(supabase.from).toHaveBeenCalledWith('document_access');
    expect(mockAccessChain.eq).toHaveBeenCalledWith('granted_to', 'user-1');
    
    expect(supabase.from).toHaveBeenCalledWith('documents');
    expect(mockTextSearch).toHaveBeenCalledWith('search_vector', 'test', { type: 'websearch' });
    expect(mockOr).toHaveBeenCalledWith('owner_id.eq.user-1,id.in.(doc-2)');
    expect(results.length).toBe(2);
  });

  it('searchDocuments returns empty array on error', async () => {
    const mockAccessChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: null, error: { message: 'DB Error' } })
    };
    
    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'document_access') return mockAccessChain;
    });

    const results = await searchDocuments('test', 'family-1', 'user-1');
    expect(results).toEqual([]);
  });

  it('special characters in query don\'t break the search', async () => {
    const mockAccessChain = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockResolvedValue({ data: [], error: null })
    };
    
    const mockOrder = vi.fn().mockResolvedValue({ data: [], error: null });
    const mockEq = vi.fn().mockReturnValue({ order: mockOrder });
    
    const mockTextSearch = vi.fn().mockReturnValue({
      eq: mockEq,
      or: vi.fn().mockReturnValue({ order: mockOrder })
    });
    
    const mockDocsChain = {
      select: vi.fn().mockReturnThis(),
      textSearch: mockTextSearch
    };

    (supabase.from as any).mockImplementation((table: string) => {
      if (table === 'document_access') return mockAccessChain;
      if (table === 'documents') return mockDocsChain;
    });

    await searchDocuments('!@#$%^&*()', 'family-1', 'user-1');
    expect(mockTextSearch).toHaveBeenCalledWith('search_vector', '!@#$%^&*()', { type: 'websearch' });
  });
});
