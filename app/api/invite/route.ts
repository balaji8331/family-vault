import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { inviteRatelimit, getRealIP } from '@/lib/ratelimit';

// Initialize a Supabase admin client to bypass RLS and invite users
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(request: Request) {
  try {
    const ip = getRealIP(request);
    const { success } = await inviteRatelimit.limit(ip);
    if (!success) {
      return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
    }

    const body = await request.json();
    const { email, familyId, role, inviterId } = body;

    if (!email || !familyId || !role || !inviterId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // 1. Securely verify the inviter is allowed to invite (in a real app, verify server session here)
    const { data: inviterData, error: inviterError } = await supabaseAdmin
      .from('users')
      .select('role')
      .eq('id', inviterId)
      .single();

    if (inviterError || !['family_admin', 'super_admin'].includes(inviterData?.role)) {
      return NextResponse.json({ error: 'Unauthorized to invite members.' }, { status: 403 });
    }

    // 2. Invite user via Supabase Auth Admin API
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?setup=true`
    });

    if (authError) {
      return NextResponse.json({ error: authError.message }, { status: 400 });
    }

    // 3. Insert placeholder into our public.users table
    // When they accept the invite, their ID will already match because we insert it now using the ID from auth
    const { error: insertError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authData.user.id,
        family_id: familyId,
        full_name: 'Pending Member', // Placeholder
        role: role,
        passkey_registered: false
      });

    if (insertError) {
      // If user already exists in public table, we can just ignore or update them
      console.warn('Failed to insert user placeholder, they might already exist:', insertError);
    }

    return NextResponse.json({ success: true, user: authData.user });

  } catch (error: any) {
    console.error('Invite Error:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
