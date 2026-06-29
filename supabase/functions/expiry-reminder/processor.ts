// Extracted to be testable in Node/Vitest environments without Deno APIs
import { sendExpiryReminder } from '../../../lib/email/resend';

export async function processExpiryReminders(supabase: any) {
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  
  const thirtyOneDays = new Date(today);
  thirtyOneDays.setUTCDate(thirtyOneDays.getUTCDate() + 31);

  const { data: documents, error: docsError } = await supabase
    .from('documents')
    .select('id, owner_id, family_id, file_name, doc_type, expiry_date')
    .not('expiry_date', 'is', null)
    .gte('expiry_date', today.toISOString())
    .lte('expiry_date', thirtyOneDays.toISOString());

  if (docsError) throw docsError;
  
  let sent = 0;
  let failed = 0;
  let errors: string[] = [];

  const familyAdminsMap = new Map<string, string>();

  for (const doc of documents || []) {
    const expiry = new Date(doc.expiry_date);
    expiry.setUTCHours(0, 0, 0, 0);
    
    const diffTime = expiry.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 30 || diffDays === 7 || diffDays === 1) {
      const intervalKey = `${diffDays}d`;
      const { data: existingLog } = await supabase
        .from('audit_logs')
        .select('id')
        .eq('action', 'expiry_reminder_sent')
        .eq('target_id', doc.id)
        .contains('metadata', { interval: intervalKey })
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .maybeSingle();

      if (existingLog) {
        continue;
      }

      const { data: owner } = await supabase
        .from('users')
        .select('full_name, email')
        .eq('id', doc.owner_id)
        .maybeSingle();

      if (!owner || !owner.email) {
        errors.push(`Missing owner or email for document ${doc.id}`);
        failed++;
        continue;
      }

      if (!familyAdminsMap.has(doc.family_id)) {
        const { data: family } = await supabase.from('families').select('name, created_by').eq('id', doc.family_id).single();
        let adminEmail = null;
        if (family?.created_by) {
          const { data: admin } = await supabase.from('users').select('email').eq('id', family.created_by).single();
          if (admin?.email) adminEmail = admin.email;
        }
        familyAdminsMap.set(doc.family_id, JSON.stringify({ adminEmail, name: family?.name || 'Your Family' }));
      }

      const familyInfoStr = familyAdminsMap.get(doc.family_id);
      const familyInfo = familyInfoStr ? JSON.parse(familyInfoStr) : { adminEmail: null, name: 'Your Family' };
      
      const { error: emailError } = await sendExpiryReminder({
        toEmail: owner.email,
        toName: owner.full_name,
        ccEmail: familyInfo.adminEmail !== owner.email ? familyInfo.adminEmail : null,
        documentName: doc.file_name,
        docType: doc.doc_type,
        expiryDate: doc.expiry_date,
        daysRemaining: diffDays,
        familyName: familyInfo.name
      });

      if (emailError) {
        errors.push(`Failed to send to ${owner.email} for doc ${doc.id}: ${emailError}`);
        failed++;
        continue;
      }

      await supabase.from('audit_logs').insert({
        actor_id: doc.owner_id,
        family_id: doc.family_id,
        action: 'expiry_reminder_sent',
        target_type: 'document',
        target_id: doc.id,
        metadata: {
          interval: intervalKey,
          email_sent_to: owner.email,
          document_name: doc.file_name
        }
      });

      sent++;
    }
  }

  return { sent, failed, errors };
}
