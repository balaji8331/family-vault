import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { sendSharedDocumentEmail } from '@/lib/email';
import { sendWhatsAppMessage } from '@/lib/whatsapp';
import { ratelimit, getRealIP } from '@/lib/ratelimit';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const ip = getRealIP(request);
    const { success } = await ratelimit.limit(ip);
    if (!success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await request.json();
    const { recipientIds, documentId, documentName, sharerId } = body;

    if (!recipientIds || !documentId || !sharerId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Fetch sharer details
    const { data: sharer, error: sharerError } = await supabaseAdmin
      .from('users')
      .select('full_name')
      .eq('id', sharerId)
      .single();

    if (sharerError || !sharer) {
      return NextResponse.json({ error: 'Sharer not found' }, { status: 404 });
    }

    // 2. Fetch recipients' emails and phones
    const { data: recipients, error: recipientsError } = await supabaseAdmin
      .from('users')
      .select('email, phone, full_name')
      .in('id', recipientIds);

    if (recipientsError || !recipients) {
      return NextResponse.json({ error: 'Recipients not found' }, { status: 404 });
    }

    const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/documents/${documentId}`;

    // 3. Send emails and WhatsApp messages
    const emailPromises = recipients.map(r => 
      sendSharedDocumentEmail(r.email, sharer.full_name || 'A family member', documentName || 'a secure document', dashboardUrl)
    );

    const whatsappPromises = recipients
      .filter(r => r.phone)
      .map(r => 
        sendWhatsAppMessage(r.phone, 'familyvault_share_notify', [
          r.full_name || 'User',
          sharer.full_name || 'A family member',
          documentName || 'a secure document',
          dashboardUrl
        ])
      );

    await Promise.all([...emailPromises, ...whatsappPromises]);

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Notify Share Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
