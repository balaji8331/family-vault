import { supabase } from './supabase/client';
import { useVaultStore } from '@/store/vault.store';

/**
 * Robust utility to securely log audit events to the database.
 * Fails silently so it doesn't break the application flow.
 *
 * Actor/family resolution:
 *  - Client calls (the common case) omit `explicitActorId`/`explicitFamilyId`; the actor is
 *    read from the vault store, falling back to the Supabase session.
 *  - Server calls (e.g. the family/* API routes) MUST pass `explicitActorId`/`explicitFamilyId`,
 *    because the vault store and the browser Supabase client have no session on the server.
 *    Previously those routes passed the ids in the `metadata`/extra positions, which both
 *    failed to type-check and silently produced no audit row at runtime.
 */
export async function logAuditEvent(
  action: string,
  targetType: string,
  targetId: string,
  metadata?: object,
  explicitActorId?: string,
  explicitFamilyId?: string | null,
): Promise<void> {
  try {
    let actorId = explicitActorId;
    let familyId: string | null | undefined = explicitFamilyId;

    if (!actorId) {
      const { currentUser } = useVaultStore.getState();
      actorId = currentUser?.id;
      familyId = currentUser?.family_id;
    }

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
