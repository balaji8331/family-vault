import { serve } from "https://deno.land/std@0.192.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const APP_URL = Deno.env.get("NEXT_PUBLIC_APP_URL") || "https://familyvault.com";
const MSG91_AUTH_KEY = Deno.env.get("MSG91_AUTH_KEY");
const MSG91_WHATSAPP_INTEGRATED_NUMBER = Deno.env.get("MSG91_WHATSAPP_INTEGRATED_NUMBER");

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

async function sendExpiryEmail(to: string, documentName: string, daysRemaining: number, dashboardUrl: string) {
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "FamilyVault <notifications@resend.dev>",
      to: [to],
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
      `,
    }),
  });
  
  if (!res.ok) {
    console.error("Resend error:", await res.text());
  }
}

async function sendWhatsAppMessage(phone: string, templateName: string, variables: string[]) {
  if (!MSG91_AUTH_KEY || !MSG91_WHATSAPP_INTEGRATED_NUMBER) return;
  try {
    const formattedPhone = phone.replace(/^\+/, '');
    const res = await fetch('https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'authkey': MSG91_AUTH_KEY
      },
      body: JSON.stringify({
        integrated_number: MSG91_WHATSAPP_INTEGRATED_NUMBER,
        content_type: 'template',
        payload: {
          messaging_product: 'whatsapp',
          type: 'template',
          template: {
            name: templateName,
            language: { code: 'en', policy: 'deterministic' },
            components: [{
              type: 'body',
              parameters: variables.map(v => ({ type: 'text', text: v }))
            }]
          },
          to_and_components: [{
            to: [formattedPhone],
            components: {
              body_1: { type: 'text', value: variables[0] || '' },
              body_2: { type: 'text', value: variables[1] || '' },
              body_3: { type: 'text', value: variables[2] || '' },
              body_4: { type: 'text', value: variables[3] || '' }
            }
          }]
        }
      })
    });
    if (!res.ok) console.error("MSG91 error:", await res.text());
  } catch (err) {
    console.error("Failed to send WhatsApp:", err);
  }
}

serve(async (req) => {
  try {
    // Basic auth check if needed, but cron jobs usually invoke with service key or we can just verify headers
    // For now, assume it's triggered securely by pg_cron or Supabase schedule

    // Fetch all documents with expiry dates and notifications enabled
    const { data: documents, error: docsError } = await supabase
      .from('documents')
      .select('id, file_name, expiry_date, owner_id, users!documents_owner_id_fkey(email, phone, full_name)')
      .eq('notify_enabled', true)
      .not('expiry_date', 'is', null);

    if (docsError) throw docsError;

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const targetDays = [30, 7, 1];
    let emailsSent = 0;

    for (const doc of documents) {
      if (!doc.expiry_date) continue;
      
      const expiry = new Date(doc.expiry_date);
      expiry.setHours(0, 0, 0, 0);
      
      const diffTime = expiry.getTime() - today.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (targetDays.includes(diffDays)) {
        // Prepare list of recipients (owner + shared users)
        const recipients = new Map<string, { email: string; phone?: string; full_name: string }>();
        
        // 1. Add owner email
        if (doc.users && doc.users.email) {
          recipients.set(doc.owner_id, { email: doc.users.email, phone: doc.users.phone, full_name: doc.users.full_name || 'User' });
        }

        // 2. Add shared recipients
        const { data: sharedData } = await supabase
          .from('document_access')
          .select('granted_to, users!document_access_granted_to_fkey(email, phone, full_name)')
          .eq('document_id', doc.id);
          
        if (sharedData) {
          for (const share of sharedData) {
            if (share.users?.email) {
              recipients.set(share.granted_to, { email: share.users.email, phone: share.users.phone, full_name: share.users.full_name || 'User' });
            }
          }
        }

        // Send emails and WhatsApp
        const dashboardUrl = `${APP_URL}/dashboard/documents/${doc.id}`;
        
        for (const [userId, user] of recipients) {
          await sendExpiryEmail(user.email, doc.file_name, diffDays, dashboardUrl);
          
          if (user.phone) {
            await sendWhatsAppMessage(user.phone, 'familyvault_expiry_reminder', [
              user.full_name,
              doc.file_name,
              diffDays.toString(),
              dashboardUrl
            ]);
          }
          emailsSent++;
          
          // Log audit event
          await supabase.from('audit_logs').insert({
            actor_id: doc.owner_id, // System action, but attributed to owner's document
            action: 'expiry_reminder_sent',
            target_type: 'document',
            target_id: doc.id,
            metadata: {
              sent_to: email,
              days_remaining: diffDays
            }
          });
        }
      }
    }

    return new Response(JSON.stringify({ success: true, emailsSent }), {
      headers: { "Content-Type": "application/json" },
      status: 200,
    });

  } catch (error: any) {
    console.error("Function error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { "Content-Type": "application/json" },
      status: 500,
    });
  }
});
