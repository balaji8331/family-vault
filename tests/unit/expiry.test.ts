import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processExpiryReminders } from '../../supabase/functions/expiry-reminder/processor';

vi.mock('../../lib/email/resend', () => ({
  sendExpiryReminder: vi.fn().mockResolvedValue({ id: 'mock-id' })
}));

import { sendExpiryReminder } from '../../lib/email/resend';

describe('Expiry Reminder Processor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const createMockSupabase = (overrides = {}) => {
    const mockMaybeSingle = vi.fn().mockResolvedValue({ data: null });
    const mockSingle = vi.fn().mockResolvedValue({ data: null });
    const mockContains = vi.fn().mockReturnThis();
    const mockEq = vi.fn().mockReturnThis();
    const mockGte = vi.fn().mockReturnThis();
    const mockLte = vi.fn().mockReturnThis();
    const mockNot = vi.fn().mockReturnThis();
    const mockSelect = vi.fn().mockReturnThis();
    const mockInsert = vi.fn().mockResolvedValue({ data: null, error: null });

    const defaultMock = {
      from: vi.fn((table: string) => {
        return {
          select: mockSelect,
          insert: mockInsert,
          not: mockNot,
          gte: mockGte,
          lte: mockLte,
          eq: mockEq,
          contains: mockContains,
          maybeSingle: mockMaybeSingle,
          single: mockSingle,
          ...((overrides as any)[table] || {})
        };
      })
    };
    return { ...defaultMock, mocks: { mockMaybeSingle, mockSingle, mockInsert } };
  };

  it('skips document if audit log exists (duplicate check)', async () => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const thirtyDaysFromNow = new Date(today);
    thirtyDaysFromNow.setUTCDate(thirtyDaysFromNow.getUTCDate() + 30);

    const supabase = createMockSupabase({
      documents: {
        select: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({
          data: [{
            id: 'doc-1',
            owner_id: 'user-1',
            family_id: 'fam-1',
            file_name: 'Test Doc',
            doc_type: 'Passport',
            expiry_date: thirtyDaysFromNow.toISOString()
          }],
          error: null
        })
      },
      audit_logs: {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        contains: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'existing-log-id' } }) // MOCK EXISTING LOG
      }
    });

    const result = await processExpiryReminders(supabase as any);
    
    expect(result.sent).toBe(0);
    expect(result.failed).toBe(0);
    expect(sendExpiryReminder).not.toHaveBeenCalled();
  });

  it('sends email and logs audit if no duplicate exists', async () => {
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    const sevenDaysFromNow = new Date(today);
    sevenDaysFromNow.setUTCDate(sevenDaysFromNow.getUTCDate() + 7);

    const supabase = createMockSupabase({
      documents: {
        select: vi.fn().mockReturnThis(),
        not: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        lte: vi.fn().mockResolvedValue({
          data: [{
            id: 'doc-2',
            owner_id: 'user-1',
            family_id: 'fam-1',
            file_name: 'Test Doc 2',
            doc_type: 'ID',
            expiry_date: sevenDaysFromNow.toISOString()
          }],
          error: null
        })
      },
      audit_logs: {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        contains: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null }), // NO EXISTING LOG
        insert: vi.fn().mockResolvedValue({ error: null })
      },
      users: {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { email: 'owner@test.com', full_name: 'Owner' } }),
        single: vi.fn().mockResolvedValue({ data: { email: 'admin@test.com' } })
      },
      families: {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        single: vi.fn().mockResolvedValue({ data: { name: 'Test Fam', created_by: 'admin-1' } })
      }
    });

    const result = await processExpiryReminders(supabase as any);

    expect(result.sent).toBe(1);
    expect(sendExpiryReminder).toHaveBeenCalledWith(expect.objectContaining({
      toEmail: 'owner@test.com',
      ccEmail: 'admin@test.com',
      daysRemaining: 7
    }));

    // Verify audit log was inserted correctly
    expect(supabase.from('audit_logs').insert).toHaveBeenCalledWith(expect.objectContaining({
      action: 'expiry_reminder_sent',
      target_id: 'doc-2',
      metadata: {
        interval: '7d',
        email_sent_to: 'owner@test.com',
        document_name: 'Test Doc 2'
      }
    }));
  });
});
