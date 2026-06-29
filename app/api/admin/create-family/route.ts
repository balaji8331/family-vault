import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const { name, adminId } = await request.json();

    if (!name || !adminId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Verify super admin
    const { data: adminData, error: adminError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', adminId)
      .single();

    if (adminError || adminData?.role !== 'super_admin') {
      return NextResponse.json({ error: 'Unauthorized. Super Admin only.' }, { status: 403 });
    }

    // 2. Create family (trigger generates family_code)
    const { data: newFamily, error: familyError } = await supabaseAdmin
      .from('families')
      .insert({ name, created_by: adminId })
      .select()
      .single();

    if (familyError || !newFamily) {
      console.error(familyError);
      return NextResponse.json({ error: 'Failed to create family space' }, { status: 500 });
    }

    // 3. Log Audit
    await supabaseAdmin.from('audit_logs').insert({
      actor_id: adminId,
      family_id: newFamily.id,
      action: 'admin_provision_family',
      target_type: 'family',
      target_id: newFamily.id,
      metadata: { name: newFamily.name }
    });

    return NextResponse.json({ 
      success: true,
      family: newFamily
    });

  } catch (error: any) {
    console.error('Create Family Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
