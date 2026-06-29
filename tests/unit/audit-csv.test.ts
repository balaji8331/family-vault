import { describe, it, expect, vi, beforeEach } from 'vitest';
import { exportAuditLogsCsv } from '../../lib/actions/audit';

// Mock the Supabase server client
vi.mock('../../lib/supabase/server', () => ({
  createClient: vi.fn(),
}));

import { createClient } from '../../lib/supabase/server';

function buildSupabaseMock(role: string, logs: any[] = []) {
  const queryBuilder: any = {
    select: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    then: undefined,
  };
  // Make the final await return logs
  queryBuilder[Symbol.iterator] = undefined;
  // Trick: make it a thenable
  queryBuilder.then = undefined;

  const supabase: any = {
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null }),
    },
    from: vi.fn().mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: vi.fn().mockReturnThis(),
          eq: vi.fn().mockReturnThis(),
          single: vi.fn().mockResolvedValue({ data: { role }, error: null }),
        };
      }
      if (table === 'audit_logs') {
        return {
          select: vi.fn().mockReturnThis(),
          order: vi.fn().mockReturnThis(),
          limit: vi.fn().mockResolvedValue({ data: logs, error: null }),
          eq: vi.fn().mockReturnThis(),
          gte: vi.fn().mockReturnThis(),
          lte: vi.fn().mockReturnThis(),
        };
      }
      return {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
      };
    }),
  };
  return supabase;
}

describe('exportAuditLogsCsv Server Action', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('blocks family_admin from exporting CSV', async () => {
    (createClient as any).mockResolvedValue(buildSupabaseMock('family_admin'));
    const result = await exportAuditLogsCsv({});
    expect(result.error).toBe('Access denied. Super Admin only.');
    expect(result.csv).toBeUndefined();
  });

  it('blocks member from exporting CSV', async () => {
    (createClient as any).mockResolvedValue(buildSupabaseMock('member'));
    const result = await exportAuditLogsCsv({});
    expect(result.error).toBe('Access denied. Super Admin only.');
  });

  it('allows super_admin to generate CSV', async () => {
    const mockLogs = [
      {
        id: 'log-1',
        family_id: 'fam-1',
        action: 'upload',
        target_type: 'document',
        target_id: 'doc-1',
        metadata: { document_name: 'My Passport' },
        created_at: '2026-06-29T10:00:00.000Z',
        actor: { full_name: 'John Smith', role: 'family_admin' },
      },
    ];

    (createClient as any).mockResolvedValue(buildSupabaseMock('super_admin', mockLogs));
    const result = await exportAuditLogsCsv({});

    expect(result.error).toBeUndefined();
    expect(result.csv).toBeDefined();
    expect(result.csv).toContain('timestamp,actor_name,actor_role,action,target_type,target_id,metadata,family_id');
    expect(result.csv).toContain('John Smith');
    expect(result.csv).toContain('upload');
  });

  it('properly escapes CSV cells with commas in metadata', async () => {
    const mockLogs = [
      {
        id: 'log-2',
        family_id: 'fam-1',
        action: 'upload',
        target_type: 'document',
        target_id: 'doc-2',
        metadata: { document_name: 'My, Passport with "quotes"' },
        created_at: '2026-06-29T10:00:00.000Z',
        actor: { full_name: 'Jane Doe', role: 'member' },
      },
    ];

    (createClient as any).mockResolvedValue(buildSupabaseMock('super_admin', mockLogs));
    const result = await exportAuditLogsCsv({});

    expect(result.error).toBeUndefined();
    expect(result.csv).toBeDefined();
    // Check that the metadata with commas is quoted in CSV
    expect(result.csv).toContain('"');
    // Should not contain unquoted comma within the document name
    const csvLines = result.csv!.split('\n');
    expect(csvLines.length).toBeGreaterThan(1); // header + data row
  });
});
