import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY || 're_placeholder');

export async function sendExpiryWarningEmail(to: string, documentName: string, daysRemaining: number, dashboardUrl: string) {
  try {
    const data = await resend.emails.send({
      from: 'FamilyVault <notifications@resend.dev>',
      to,
      subject: `Action Required: ${documentName} expires in ${daysRemaining} days`,
      html: `
        <div style="font-family: sans-serif; max-w-xl; margin: 0 auto; color: #333;">
          <h2 style="color: #4F46E5;">Document Expiry Warning</h2>
          <p>Hello,</p>
          <p>This is an automated secure notification from FamilyVault. Your encrypted document <strong>${documentName}</strong> is expiring in <strong>${daysRemaining}</strong> days.</p>
          <p>Please log in to your dashboard to review and update your document.</p>
          <a href="${dashboardUrl}" style="display: inline-block; padding: 10px 20px; background-color: #4F46E5; color: #fff; text-decoration: none; border-radius: 5px; margin-top: 15px;">View Document</a>
          <p style="margin-top: 30px; font-size: 12px; color: #888;">You can disable these notifications in the document settings.</p>
        </div>
      `
    });
    return { success: true, data };
  } catch (error) {
    console.error('Failed to send expiry email:', error);
    return { success: false, error };
  }
}

export async function sendSharedDocumentEmail(to: string, sharedBy: string, documentName: string, dashboardUrl: string) {
  try {
    const data = await resend.emails.send({
      from: 'FamilyVault <notifications@resend.dev>',
      to,
      subject: `${sharedBy} shared a document with you`,
      html: `
        <div style="font-family: sans-serif; max-w-xl; margin: 0 auto; color: #333;">
          <h2 style="color: #4F46E5;">New Secure Document</h2>
          <p>Hello,</p>
          <p><strong>${sharedBy}</strong> has securely shared <strong>${documentName}</strong> with you.</p>
          <p>You can now decrypt and view this document locally on your device.</p>
          <a href="${dashboardUrl}" style="display: inline-block; padding: 10px 20px; background-color: #4F46E5; color: #fff; text-decoration: none; border-radius: 5px; margin-top: 15px;">View Document</a>
        </div>
      `
    });
    return { success: true, data };
  } catch (error) {
    console.error('Failed to send share email:', error);
    return { success: false, error };
  }
}
