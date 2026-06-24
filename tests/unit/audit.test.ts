import { describe, it, expect, vi, beforeEach } from 'vitest';
import { logAuditEvent } from '@/lib/audit';
import { supabase } from '@/lib/supabase/client';
import { useVaultStore } from '@/store/vault.store';

describe('Audit Module', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('logAuditEvent inserts correct row to audit_logs', async () => {
    await logAuditEvent('test_action', 'test_target', 'target_123');
    
    expect(supabase.from).toHaveBeenCalledWith('audit_logs');
    // from() returns the mockChain, so we can assert on what it returned
    expect((supabase.from('audit_logs') as any).insert).toHaveBeenCalledWith({
      actor_id: 'test-user-id',
      family_id: 'test-family-id',
      action: 'test_action',
      target_type: 'test_target',
      target_id: 'target_123',
      metadata: {}
    });
  });

  it('logAuditEvent does not throw if Supabase insert fails', async () => {
    // Mock failure
    (supabase.from('audit_logs') as any).insert.mockResolvedValueOnce({ error: { message: "DB Error" } });
    
    // Should resolve without throwing
    await expect(logAuditEvent('action', 'type', 'id')).resolves.not.toThrow();
  });

  it('logAuditEvent reads actor_id from vault store', async () => {
    useVaultStore.setState({ currentUser: { id: 'custom-actor-id', family_id: 'fam-id', role: 'member' } });
    
    await logAuditEvent('action', 'type', 'id');
    
    expect((supabase.from('audit_logs') as any).insert).toHaveBeenCalledWith(expect.objectContaining({
      actor_id: 'custom-actor-id'
    }));
  });

  it('logAuditEvent reads family_id from vault store', async () => {
    useVaultStore.setState({ currentUser: { id: 'custom-actor-id', family_id: 'custom-family-id', role: 'member' } });
    
    await logAuditEvent('action', 'type', 'id');
    
    expect((supabase.from('audit_logs') as any).insert).toHaveBeenCalledWith(expect.objectContaining({
      family_id: 'custom-family-id'
    }));
  });

  it('logAuditEvent includes metadata in insert', async () => {
    const meta = { extra_info: 'test' };
    await logAuditEvent('action', 'type', 'id', meta);
    
    expect((supabase.from('audit_logs') as any).insert).toHaveBeenCalledWith(expect.objectContaining({
      metadata: meta
    }));
  });
});
