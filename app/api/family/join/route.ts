import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { logAuditEvent } from '@/lib/audit';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { family_code } = await request.json();
    if (!family_code) {
      return NextResponse.json({ error: 'Family code is required' }, { status: 400 });
    }

    // Check if user is already in a family
    const { data: currentUser } = await supabaseAdmin.from('users').select('family_id').eq('id', session.user.id).single();
    if (currentUser?.family_id) {
      return NextResponse.json({ error: 'You are already in a family' }, { status: 400 });
    }

    // Look up family by code
    const { data: family, error: familyError } = await supabaseAdmin
      .from('families')
      .select('id, name')
      .eq('family_code', family_code.toUpperCase())
      .single();

    if (familyError || !family) {
      return NextResponse.json({ error: 'Invalid family code' }, { status: 404 });
    }

    // Add user to family as member
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ family_id: family.id, role: 'member' })
      .eq('id', session.user.id);

    if (updateError) throw updateError;

    await logAuditEvent('join_family', 'family', family.id, session.user.id, family.id);

    return NextResponse.json({ success: true, family_name: family.name, family_id: family.id });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
