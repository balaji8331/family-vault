import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const { familyId, adminId } = await request.json();

    if (!familyId || !adminId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Verify super admin
    const { data: adminData, error: adminError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', adminId)
      .single();

    if (adminError || adminData?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized. Super Admin only.' }, { status: 403 });
    }

    const { error: updateError } = await supabaseAdmin
      .from('families')
      .update({ suspended: true })
      .eq('id', familyId);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    await supabaseAdmin.from('audit_logs').insert({
      actor_id: adminId,
      family_id: familyId,
      action: 'suspend_family',
      target_type: 'family',
      target_id: familyId,
    });

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Suspend Family Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
