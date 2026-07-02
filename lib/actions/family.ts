'use server';

import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

// Helper to get authenticated user and their DB row
async function getAuthenticatedUser() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Not authenticated');

  const { data: dbUser, error: dbError } = await supabase
    .from('users')
    .select('id, role, family_id, full_name')
    .eq('id', user.id)
    .single();
    
  if (dbError || !dbUser) throw new Error('User record not found');
  
  return { user, dbUser };
}

// Log audit event from server action
async function logAction(actorId: string, familyId: string, action: string, targetType: string, targetId: string, metadata: any = {}) {
  await supabaseAdmin.from('audit_logs').insert({
    actor_id: actorId,
    family_id: familyId,
    action,
    target_type: targetType,
    target_id: targetId,
    metadata
  });
}

export async function inviteMember(familyId: string, fullName: string, email: string): Promise<{ error?: string }> {
  try {
    const { dbUser } = await getAuthenticatedUser();

    // Verification
    if (dbUser.role !== 'super_admin' && (dbUser.role !== 'family_admin' || dbUser.family_id !== familyId)) {
      return { error: 'Unauthorized to invite to this family' };
    }

    // Check if user already exists
    const { data: existingUser } = await supabaseAdmin.from('users').select('id').eq('email', email).maybeSingle();
    if (existingUser) {
      return { error: 'Email already exists' };
    }

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback?setup=true`
    });

    if (authError) return { error: authError.message };

    const { error: insertError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authData.user.id,
        email: email,
        family_id: familyId,
        full_name: fullName,
        role: 'member',
        passkey_registered: false
      });

    if (insertError) return { error: insertError.message };

    await logAction(dbUser.id, familyId, 'invite', 'user', authData.user.id, { email, role: 'member' });
    
    return {};
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function removeMember(userId: string): Promise<{ error?: string }> {
  try {
    const { dbUser } = await getAuthenticatedUser();

    const { data: targetUser } = await supabaseAdmin.from('users').select('id, family_id, role').eq('id', userId).single();
    if (!targetUser) return { error: 'User not found' };

    // Prevent removing super_admin
    if (targetUser.role === 'super_admin') return { error: 'Cannot remove a super admin' };

    // Verification
    if (dbUser.role !== 'super_admin') {
      if (dbUser.role !== 'family_admin' || dbUser.family_id !== targetUser.family_id) {
        return { error: 'Unauthorized to remove this member' };
      }
    }

    // Soft delete / remove from family
    const { error } = await supabaseAdmin.from('users').update({ family_id: null, role: 'member' }).eq('id', userId);
    if (error) return { error: error.message };

    await logAction(dbUser.id, targetUser.family_id || '', 'remove', 'user', userId, {});
    
    return {};
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function promoteMember(userId: string, newRole: string): Promise<{ error?: string }> {
  try {
    const { dbUser } = await getAuthenticatedUser();

    if (newRole === 'super_admin') return { error: 'Cannot promote to super_admin' };
    if (!['family_admin', 'member'].includes(newRole)) return { error: 'Invalid role' };

    const { data: targetUser } = await supabaseAdmin.from('users').select('id, family_id, role').eq('id', userId).single();
    if (!targetUser) return { error: 'User not found' };

    // Prevent altering super_admin
    if (targetUser.role === 'super_admin') return { error: 'Cannot alter a super admin' };

    // Verification
    if (dbUser.role !== 'super_admin') {
      if (dbUser.role !== 'family_admin' || dbUser.family_id !== targetUser.family_id) {
        return { error: 'Unauthorized to promote this member' };
      }
    }

    const { error } = await supabaseAdmin.from('users').update({ role: newRole }).eq('id', userId);
    if (error) return { error: error.message };

    await logAction(dbUser.id, targetUser.family_id || '', 'promote', 'user', userId, { newRole });
    
    return {};
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function revokeTrustedDevice(userId: string): Promise<{ error?: string }> {
  try {
    const { dbUser } = await getAuthenticatedUser();

    const { data: targetUser } = await supabaseAdmin.from('users').select('id, family_id, role').eq('id', userId).single();
    if (!targetUser) return { error: 'User not found' };

    // Verification
    if (dbUser.role !== 'super_admin') {
      if (dbUser.role !== 'family_admin' || dbUser.family_id !== targetUser.family_id) {
        return { error: 'Unauthorized to modify this member' };
      }
    }

    const { error } = await supabaseAdmin.from('users').update({ 
      trusted_device_token: null, 
      trusted_device_expires_at: null 
    }).eq('id', userId);
    if (error) return { error: error.message };

    await logAction(dbUser.id, targetUser.family_id || '', 'revoke_device', 'user', userId, {});
    
    return {};
  } catch (err: any) {
    return { error: err.message };
  }
}

export async function createFamily(name: string, adminEmail: string, adminFullName: string): Promise<{ familyId?: string, error?: string }> {
  try {
    const { dbUser } = await getAuthenticatedUser();

    if (dbUser.role !== 'super_admin') {
      return { error: 'Only super admins can create families from this interface' };
    }

    // Check if email is already in use
    const { data: existingUser } = await supabaseAdmin.from('users').select('id').eq('email', adminEmail).maybeSingle();
    if (existingUser) return { error: 'Admin email already exists' };

    // Create family
    const { data: family, error: familyError } = await supabaseAdmin
      .from('families')
      .insert({ name: name, created_by: dbUser.id })
      .select('id')
      .single();

    if (familyError || !family) return { error: familyError?.message || 'Failed to create family' };

    // Invite user via Supabase Auth Admin API
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.inviteUserByEmail(adminEmail, {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/auth/callback?setup=true`
    });

    if (authError) {
      // Rollback family creation ideally, but for now just return error
      return { error: authError.message };
    }

    const { error: insertError } = await supabaseAdmin
      .from('users')
      .insert({
        id: authData.user.id,
        email: adminEmail,
        family_id: family.id,
        full_name: adminFullName,
        role: 'family_admin',
        passkey_registered: false
      });

    if (insertError) return { error: insertError.message };

    await logAction(dbUser.id, family.id, 'create', 'family', family.id, { name, adminEmail });

    return { familyId: family.id };
  } catch (err: any) {
    return { error: err.message };
  }
}
