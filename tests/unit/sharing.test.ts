import { describe, it, expect, vi, beforeEach } from 'vitest';
import { shareDocument, revokeShare, getShareStatus } from '../../lib/actions/sharing';

// Mock Supabase clients
vi.mock('../../lib/supabase/server', () => ({ createClient: vi.fn() }));
vi.mock('../../lib/supabase/admin', () => ({ supabaseAdmin: null }));

import { createClient } from '../../lib/supabase/server';
import * as adminModule from '../../lib/supabase/admin';

// ── helpers ──────────────────────────────────────────────────────────────────

function buildSessionClient(userId: string, role: string, familyId: string) {
  const supabase: any = {
    auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }) },
    from: vi.fn().mockImplementation(() => ({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: { id: userId, role, family_id: familyId }, error: null }),
    })),
  };
  return supabase;
}

function buildAdminClient(overrides: Record<string, any> = {}) {
  const insertFn = vi.fn().mockResolvedValue({ error: null });
  const deleteFn = vi.fn().mockResolvedValue({ error: null });
  const upsertFn = vi.fn().mockResolvedValue({ error: null });

  const admin: any = {
    _inserts: insertFn,
    _deletes: deleteFn,
    _upserts: upsertFn,
    from: vi.fn().mockImplementation((table: string) => {
      const tableOverride = overrides[table];
      const base = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        neq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: null, error: null }),
        maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
        insert: insertFn,
        upsert: upsertFn,
        delete: vi.fn().mockReturnThis(),
      };
      // patch delete to also have eq
      base.delete = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ eq: deleteFn }) });
      return tableOverride ? { ...base, ...tableOverride } : base;
    }),
  };
  return admin;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('shareDocument server action', () => {
  beforeEach(() => vi.clearAllMocks());

  it('blocks self-share', async () => {
    (createClient as any).mockResolvedValue(
      buildSessionClient('user-1', 'member', 'fam-1')
    );
    const admin = buildAdminClient();
    (adminModule as any).supabaseAdmin = admin;

    const result = await shareDocument('doc-1', 'user-1', 'wrappedKey', 'view');
    expect(result.error).toBe('You cannot share a document with yourself.');
  });

  it('blocks non-owner member from sharing', async () => {
    (createClient as any).mockResolvedValue(
      buildSessionClient('user-1', 'member', 'fam-1')
    );

    const admin = buildAdminClient({
      documents: {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({
          data: { id: 'doc-1', owner_id: 'other-user', family_id: 'fam-1' },
          error: null,
        }),
      },
    });
    (adminModule as any).supabaseAdmin = admin;

    const result = await shareDocument('doc-1', 'user-2', 'wrappedKey', 'view');
    expect(result.error).toContain('do not have permission');
  });

  it('blocks cross-family share — recipient in different family', async () => {
    (createClient as any).mockResolvedValue(
      buildSessionClient('owner-1', 'member', 'fam-1')
    );

    let callCount = 0;
    const admin = buildAdminClient({
      documents: {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            // document query
            return Promise.resolve({ data: { id: 'doc-1', owner_id: 'owner-1', family_id: 'fam-1' }, error: null });
          }
          // user query
          return Promise.resolve({ data: { id: 'recipient-1', family_id: 'fam-DIFFERENT', role: 'member' }, error: null });
        }),
      },
      users: {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { id: 'recipient-1', family_id: 'fam-DIFFERENT', role: 'member' }, error: null }),
      },
    });
    (adminModule as any).supabaseAdmin = admin;

    const result = await shareDocument('doc-1', 'recipient-1', 'wrappedKey', 'view');
    expect(result.error).toBe('Recipient must be in the same family as the document.');
  });

  it('does not include wrapped_key in audit log metadata', async () => {
    (createClient as any).mockResolvedValue(
      buildSessionClient('owner-1', 'member', 'fam-1')
    );

    const insertSpy = vi.fn().mockResolvedValue({ error: null });
    const admin: any = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'documents') {
          return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: 'doc-1', owner_id: 'owner-1', family_id: 'fam-1' }, error: null }) };
        }
        if (table === 'users') {
          return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: 'recipient-1', family_id: 'fam-1', role: 'member' }, error: null }) };
        }
        if (table === 'document_access') {
          return { upsert: vi.fn().mockResolvedValue({ error: null }) };
        }
        if (table === 'audit_logs') {
          return { insert: insertSpy };
        }
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: null, error: null }) };
      }),
    };
    (adminModule as any).supabaseAdmin = admin;

    await shareDocument('doc-1', 'recipient-1', 'SECRET_WRAPPED_KEY_VALUE', 'view');

    // Verify audit log was called and did NOT include wrapped_key
    expect(insertSpy).toHaveBeenCalled();
    const auditPayload = insertSpy.mock.calls[0][0];
    expect(auditPayload.action).toBe('share');
    expect(JSON.stringify(auditPayload.metadata)).not.toContain('SECRET_WRAPPED_KEY_VALUE');
    expect(JSON.stringify(auditPayload.metadata)).not.toContain('wrapped_key');
  });
});

describe('revokeShare server action', () => {
  beforeEach(() => vi.clearAllMocks());

  it('deletes both document_access and encryption_keys rows', async () => {
    (createClient as any).mockResolvedValue(
      buildSessionClient('owner-1', 'member', 'fam-1')
    );

    const accessDeleteEq2 = vi.fn().mockResolvedValue({ error: null });
    const accessDeleteEq1 = vi.fn().mockReturnValue({ eq: accessDeleteEq2 });
    const accessDelete = vi.fn().mockReturnValue({ eq: accessDeleteEq1 });

    const keysDeleteEq = vi.fn().mockResolvedValue({ error: null });
    const keysDelete = vi.fn().mockReturnValue({ eq: keysDeleteEq });

    const insertSpy = vi.fn().mockResolvedValue({ error: null });

    const admin: any = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'documents') {
          return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: 'doc-1', owner_id: 'owner-1', family_id: 'fam-1' }, error: null }) };
        }
        if (table === 'document_access') return { delete: accessDelete };
        if (table === 'encryption_keys') return { delete: keysDelete };
        if (table === 'audit_logs') return { insert: insertSpy };
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: null, error: null }) };
      }),
    };
    (adminModule as any).supabaseAdmin = admin;

    const result = await revokeShare('doc-1', 'recipient-1');
    expect(result.error).toBeUndefined();

    // Both deletions must have been triggered
    expect(accessDelete).toHaveBeenCalled();
    expect(keysDelete).toHaveBeenCalled();
  });
});

describe('getShareStatus', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns empty shares for unauthorized caller', async () => {
    (createClient as any).mockResolvedValue(
      buildSessionClient('user-1', 'member', 'fam-1')
    );

    const admin: any = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'documents') {
          return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: 'doc-1', owner_id: 'other-owner', family_id: 'fam-2' }, error: null }) };
        }
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: null, error: null }) };
      }),
    };
    (adminModule as any).supabaseAdmin = admin;

    const result = await getShareStatus('doc-1');
    expect(result.error).toBeDefined();
    expect(result.shares).toHaveLength(0);
  });

  it('never returns wrapped_key in share records', async () => {
    (createClient as any).mockResolvedValue(
      buildSessionClient('owner-1', 'member', 'fam-1')
    );

    const admin: any = {
      from: vi.fn().mockImplementation((table: string) => {
        if (table === 'documents') {
          return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: { id: 'doc-1', owner_id: 'owner-1', family_id: 'fam-1' }, error: null }) };
        }
        if (table === 'document_access') {
          return {
            select: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            neq: vi.fn().mockResolvedValue({
              data: [{ id: 'access-1', document_id: 'doc-1', granted_to: 'user-2', granted_by: 'owner-1', granted_at: new Date().toISOString(), wrapped_key: 'REAL_SECRET_KEY', recipient: { full_name: 'Member', role: 'member' } }],
              error: null,
            }),
          };
        }
        return { select: vi.fn().mockReturnThis(), eq: vi.fn().mockReturnThis(), single: vi.fn().mockResolvedValue({ data: null, error: null }) };
      }),
    };
    (adminModule as any).supabaseAdmin = admin;

    const result = await getShareStatus('doc-1');
    expect(result.shares.length).toBeGreaterThan(0);
    result.shares.forEach((share) => {
      expect(share.wrapped_key).toBe(''); // Always empty — never expose key material
    });
  });
});
