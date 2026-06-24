import { supabase } from './supabase/client';
import { useVaultStore } from '@/store/vault.store';

/**
 * Robust utility to securely log audit events to the database.
 * Fails silently so it doesn't break the application flow.
 */
export async function logAuditEvent(
  action: string,
  targetType: string,
  targetId: string,
  metadata?: object
): Promise<void> {
  try {
    const { currentUser } = useVaultStore.getState();
    
    let actorId = currentUser?.id;
    let familyId = currentUser?.family_id;

    if (!actorId) {
      // Fallback for login/logout events where store might be empty
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        actorId = session.user.id;
        // Fetch family_id
        const { data } = await supabase.from('users').select('family_id').eq('id', actorId).single();
        if (data) familyId = data.family_id;
      }
    }
    
    if (!actorId) return; // Cannot log if no user session

    const { error } = await supabase.from('audit_logs').insert({
      actor_id: actorId,
      family_id: familyId,
      action: action,
      target_type: targetType,
      target_id: targetId,
      metadata: metadata || {},
    });

    if (error) {
      console.warn('Audit log failed silently:', error);
    }
  } catch (err) {
    console.error('Audit log encountered an exception:', err);
  }
}
