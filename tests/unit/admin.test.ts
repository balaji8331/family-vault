import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('next/server', () => {
  return {
    NextResponse: {
      json: vi.fn().mockImplementation((body, init) => ({ body, status: init?.status || 200 }))
    }
  };
});

const { mockAdminChain, mockStorage, mockAuthAdmin } = vi.hoisted(() => {
  const adminChain: any = {};
  adminChain.select = vi.fn().mockReturnValue(adminChain);
  adminChain.eq = vi.fn().mockReturnValue(adminChain);
  adminChain.single = vi.fn().mockResolvedValue({ data: { role: 'super_admin' }, error: null });
  adminChain.insert = vi.fn().mockResolvedValue({ error: null });
  adminChain.delete = vi.fn().mockReturnValue(adminChain);
  adminChain.in = vi.fn().mockResolvedValue({ error: null });
  adminChain.update = vi.fn().mockReturnValue(adminChain);
  adminChain.neq = vi.fn().mockReturnValue(adminChain);
  // Add a then method so it can be awaited directly
  adminChain.then = function(resolve: any) {
    resolve({ data: [{ id: 'd1', file_path: 'p1', thumbnail_path: 't1' }, { id: 'u1' }], error: null });
  };

  const storage = {
    from: vi.fn().mockReturnValue({
      remove: vi.fn().mockResolvedValue({ error: null })
    })
  };

  const authAdmin = {
    admin: {
      deleteUser: vi.fn().mockResolvedValue({ error: null })
    }
  };

  return { mockAdminChain: adminChain, mockStorage: storage, mockAuthAdmin: authAdmin };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn().mockReturnValue({
    from: vi.fn().mockImplementation(() => mockAdminChain),
    storage: mockStorage,
    auth: mockAuthAdmin
  })
}));

import { POST as deleteFamily } from '@/app/api/admin/delete-family/route';
import { POST as suspendFamily } from '@/app/api/admin/suspend-family/route';

describe('Admin API Routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('super_admin can fetch all families (simulated via API role check)', async () => {
    mockAdminChain.single.mockResolvedValueOnce({ data: { role: 'super_admin' }, error: null });
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ familyId: 'f1', adminId: 'a1' })
    });
    
    const res = await suspendFamily(req);
    expect(res.status).toBe(200);
  });

  it('family_admin cannot access admin routes', async () => {
    mockAdminChain.single.mockResolvedValueOnce({ data: { role: 'family_admin' }, error: null });
    
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ familyId: 'f1', adminId: 'a1' })
    });
    
    const res = await deleteFamily(req);
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: 'Unauthorized. Super Admin only.' });
  });

  it('delete-family cascades correctly', async () => {
    mockAdminChain.single.mockResolvedValueOnce({ data: { role: 'super_admin' }, error: null });
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ familyId: 'f1', adminId: 'a1' })
    });
    
    const res = await deleteFamily(req);
    expect(res.status).toBe(200);
    expect(mockStorage.from).toHaveBeenCalledWith('documents');
    // The mocked NextResponse.json stores the payload directly on `.body`.
    expect((res as any).body.success).toBe(true);
  });

  it('suspend-family blocks member access (simulated)', async () => {
    mockAdminChain.single.mockResolvedValueOnce({ data: { role: 'super_admin' }, error: null });
    const req = new Request('http://localhost', {
      method: 'POST',
      body: JSON.stringify({ familyId: 'f1', adminId: 'a1' })
    });
    
    await suspendFamily(req);
    expect(mockAdminChain.update).toHaveBeenCalledWith({ suspended: true });
  });
});
