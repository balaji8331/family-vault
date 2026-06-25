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

    const { data: currentUser } = await supabaseAdmin.from('users').select('family_id, role').eq('id', session.user.id).single();
    if (!currentUser?.family_id) {
      return NextResponse.json({ error: 'You are not in a family' }, { status: 400 });
    }

    const familyId = currentUser.family_id;

    // Check if user is the only admin
    if (currentUser.role === 'family_admin') {
      const { data: admins } = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('family_id', familyId)
        .eq('role', 'family_admin');
        
      if (admins && admins.length === 1) {
        return NextResponse.json({ error: 'You are the only admin. Transfer ownership before leaving.' }, { status: 400 });
      }
    }

    // Leave family
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ family_id: null, role: 'member' })
      .eq('id', session.user.id);

    if (updateError) throw updateError;

    await logAuditEvent('leave_family', 'family', familyId, session.user.id, familyId);

    return NextResponse.json({ success: true });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
