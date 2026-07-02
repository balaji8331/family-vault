export async function sendExpiryReminder(params: {
  toEmail: string
  toName: string
  ccEmail: string | null
  documentName: string
  docType: string
  expiryDate: string
  daysRemaining: number
  familyName: string
}): Promise<{ id?: string; error?: string }> {
  try {
    let RESEND_API_KEY = process.env.RESEND_API_KEY;
    if (!RESEND_API_KEY && typeof Deno !== 'undefined') {
      RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    }
    
    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY is missing');
    }

    // Validate email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(params.toEmail)) {
      return { error: 'Invalid toEmail address' };
    }
    if (params.ccEmail && !emailRegex.test(params.ccEmail)) {
      return { error: 'Invalid ccEmail address' };
    }

    const urgencyText = params.daysRemaining <= 1 ? 'URGENT' : params.daysRemaining <= 7 ? 'Action Required' : 'Reminder';
    const subject = `[FamilyVault] Your ${params.docType} expires in ${params.daysRemaining} day(s)`;
    
    let appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl && typeof Deno !== 'undefined') {
      appUrl = Deno.env.get('NEXT_PUBLIC_APP_URL');
    }
    appUrl = appUrl || 'https://familyvault.example.com';

    const htmlBody = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eaeaea; border-radius: 10px;">
        <h2 style="color: #333; margin-top: 0;">FamilyVault Reminder</h2>
        <p style="color: #555; font-size: 16px;">Hi ${params.toName},</p>
        <p style="color: #555; font-size: 16px;">
          This is an automated reminder that a document in your family vault (<strong>${params.familyName}</strong>) is expiring soon.
        </p>
        
        <div style="background-color: #f9f9f9; border-left: 4px solid #3b82f6; padding: 15px; margin: 20px 0; border-radius: 0 8px 8px 0;">
          <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;"><strong>Document:</strong> ${params.documentName}</p>
          <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;"><strong>Type:</strong> ${params.docType}</p>
          <p style="margin: 0 0 10px 0; font-size: 14px; color: #666;"><strong>Expiry Date:</strong> ${new Date(params.expiryDate).toLocaleDateString()}</p>
          <p style="margin: 0; font-size: 14px; color: ${params.daysRemaining <= 7 ? '#dc2626' : '#d97706'};">
            <strong>Days Remaining:</strong> ${params.daysRemaining} day(s)
          </p>
        </div>
        
        <p style="color: #555; font-size: 16px;">
          Please review and renew this document as soon as possible. Once renewed, you can upload the updated version to FamilyVault.
        </p>
        
        <div style="margin-top: 30px; text-align: center;">
          <a href="${appUrl}/dashboard" style="display: inline-block; background-color: #2563eb; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 16px;">
            Open FamilyVault
          </a>
        </div>
        
        <hr style="border: none; border-top: 1px solid #eaeaea; margin: 30px 0 20px 0;" />
        <p style="color: #999; font-size: 12px; text-align: center; margin: 0;">
          This is an automated message from your FamilyVault. Please do not reply directly to this email.
        </p>
      </div>
    `;

    const payload: any = {
      from: 'FamilyVault <noreply@familyvault.example.com>',
      to: [params.toEmail],
      subject: subject,
      html: htmlBody,
    };

    if (params.ccEmail) {
      payload.cc = [params.ccEmail];
    }

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const result = await response.json();

    if (!response.ok) {
      return { error: result.message || 'Failed to send email via Resend' };
    }

    return { id: result.id };
  } catch (error: any) {
    return { error: error.message || 'Internal error in sendExpiryReminder' };
  }
}
