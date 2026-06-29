import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sendExpiryReminder } from '../../lib/email/resend';

global.fetch = vi.fn();

describe('Resend Wrapper', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    process.env.RESEND_API_KEY = 'test_key';
  });

  it('rejects invalid emails', async () => {
    const res = await sendExpiryReminder({
      toEmail: 'invalid-email',
      toName: 'Test',
      ccEmail: null,
      documentName: 'Doc',
      docType: 'Type',
      expiryDate: new Date().toISOString(),
      daysRemaining: 1,
      familyName: 'Fam',
    });
    
    expect(res.error).toBe('Invalid toEmail address');
  });

  it('rejects invalid ccEmail', async () => {
    const res = await sendExpiryReminder({
      toEmail: 'test@example.com',
      toName: 'Test',
      ccEmail: 'invalid-email',
      documentName: 'Doc',
      docType: 'Type',
      expiryDate: new Date().toISOString(),
      daysRemaining: 1,
      familyName: 'Fam',
    });
    
    expect(res.error).toBe('Invalid ccEmail address');
  });

  it('sends correctly configured email', async () => {
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'email_id' })
    });

    const res = await sendExpiryReminder({
      toEmail: 'test@example.com',
      toName: 'Test Name',
      ccEmail: 'cc@example.com',
      documentName: 'My Passport',
      docType: 'Passport',
      expiryDate: '2026-07-29T00:00:00.000Z',
      daysRemaining: 30,
      familyName: 'Smiths',
    });

    expect(res.error).toBeUndefined();
    expect(res.id).toBe('email_id');

    expect(global.fetch).toHaveBeenCalledWith('https://api.resend.com/emails', expect.objectContaining({
      method: 'POST',
      headers: {
        'Authorization': `Bearer test_key`,
        'Content-Type': 'application/json',
      }
    }));

    const callArgs = (global.fetch as any).mock.calls[0][1];
    const body = JSON.parse(callArgs.body);

    expect(body.to).toContain('test@example.com');
    expect(body.cc).toContain('cc@example.com');
    expect(body.subject).toBe('[FamilyVault] Your Passport expires in 30 day(s)');
    expect(body.html).toContain('My Passport');
    expect(body.html).toContain('Smiths');
  });
});
