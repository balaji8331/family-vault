import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
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

    const { name } = await request.json();
    if (!name) {
      return NextResponse.json({ error: 'Family name is required' }, { status: 400 });
    }

    // 1. Create family (trigger generates family_code).
    // key_seed is the family's secret from which every member locally derives the
    // ONE shared family key (see lib/crypto.ts deriveFamilyKey). 256 bits of entropy.
    const keySeed = randomBytes(32).toString('base64');
    const { data: newFamily, error: familyError } = await supabaseAdmin
      .from('families')
      .insert({ name, created_by: session.user.id, key_seed: keySeed })
      .select()
      .single();

    if (familyError || !newFamily) {
      console.error(familyError);
      return NextResponse.json({ error: 'Failed to create family space' }, { status: 500 });
    }

    // 2. Set current user as family_admin (unless they are a super_admin) and assign family_id
    const { data: currentUser } = await supabaseAdmin.from('users').select('role').eq('id', session.user.id).single();
    const newRole = currentUser?.role === 'super_admin' ? 'super_admin' : 'family_admin';

    const { error: userError } = await supabaseAdmin
      .from('users')
      .update({ family_id: newFamily.id, role: newRole })
      .eq('id', session.user.id);

    if (userError) {
      console.error(userError);
      return NextResponse.json({ error: 'Failed to assign user to new family' }, { status: 500 });
    }

    // 3. Log Audit
    await logAuditEvent('create_family', 'family', newFamily.id, undefined, session.user.id, newFamily.id);

    return NextResponse.json({ 
      family_code: newFamily.family_code, 
      family_id: newFamily.id, 
      name: newFamily.name 
    });

  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
