'use server';

import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export interface ShareRecord {
  id: string;
  document_id: string;
  granted_to: string;
  granted_by: string;
  wrapped_key: string;
  granted_at: string;
  recipient_name?: string | null;
  recipient_role?: string | null;
}

// Helper: get authenticated caller and their DB row
async function getAuthenticatedUser() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) throw new Error('Not authenticated');

  const { data: dbUser, error: dbError } = await supabase
    .from('users')
    .select('id, role, family_id')
    .eq('id', user.id)
    .single();

  if (dbError || !dbUser) throw new Error('User record not found');
  return { user, dbUser };
}

/**
 * Share a document with a recipient.
 * The wrappedKey is produced entirely in the browser — familyKey never touches the server.
 */
export async function shareDocument(
  documentId: string,
  recipientId: string,
  wrappedKey: string,
  permission: 'view'
): Promise<{ error?: string }> {
  try {
    const { dbUser } = await getAuthenticatedUser();

    // Self-share guard
    if (recipientId === dbUser.id) {
      return { error: 'You cannot share a document with yourself.' };
    }

    // Fetch document to verify ownership and family scope
    const { data: doc, error: docError } = await supabaseAdmin
      .from('documents')
      .select('id, owner_id, family_id')
      .eq('id', documentId)
      .single();

    if (docError || !doc) return { error: 'Document not found.' };

    // Caller must own the document OR be a family_admin in the same family
    const isOwner = doc.owner_id === dbUser.id;
    const isFamilyAdmin = dbUser.role === 'family_admin' && dbUser.family_id === doc.family_id;
    const isSuperAdmin = dbUser.role === 'super_admin';

    if (!isOwner && !isFamilyAdmin && !isSuperAdmin) {
      return { error: 'You do not have permission to share this document.' };
    }

    // Recipient must be in the same family as the document
    const { data: recipient, error: recipientError } = await supabaseAdmin
      .from('users')
      .select('id, family_id, role')
      .eq('id', recipientId)
      .single();

    if (recipientError || !recipient) return { error: 'Recipient not found.' };

    if (recipient.family_id !== doc.family_id) {
      return { error: 'Recipient must be in the same family as the document.' };
    }

    // Upsert document_access row — wrappedKey is the familyKey-wrapped document key
    const { error: upsertError } = await supabaseAdmin
      .from('document_access')
      .upsert({
        document_id: documentId,
        granted_to: recipientId,
        granted_by: dbUser.id,
        wrapped_key: wrappedKey,
        granted_at: new Date().toISOString(),
      }, {
        onConflict: 'document_id,granted_to',
      });

    if (upsertError) return { error: upsertError.message };

    // Audit log — NEVER include wrapped_key in metadata
    await supabaseAdmin.from('audit_logs').insert({
      actor_id: dbUser.id,
      family_id: doc.family_id,
      action: 'share',
      target_type: 'document',
      target_id: documentId,
      metadata: {
        recipient_id: recipientId,
        permission,
      },
    });

    return {};
  } catch (err: any) {
    return { error: err.message };
  }
}

/**
 * Revoke a recipient's access to a document.
 * Deletes BOTH the document_access row AND any encryption_keys rows for the recipient.
 */
export async function revokeShare(
  documentId: string,
  recipientId: string
): Promise<{ error?: string }> {
  try {
    const { dbUser } = await getAuthenticatedUser();

    // Fetch document
    const { data: doc, error: docError } = await supabaseAdmin
      .from('documents')
      .select('id, owner_id, family_id')
      .eq('id', documentId)
      .single();

    if (docError || !doc) return { error: 'Document not found.' };

    // Caller must own the document OR be a family_admin in the same family
    const isOwner = doc.owner_id === dbUser.id;
    const isFamilyAdmin = dbUser.role === 'family_admin' && dbUser.family_id === doc.family_id;
    const isSuperAdmin = dbUser.role === 'super_admin';

    if (!isOwner && !isFamilyAdmin && !isSuperAdmin) {
      return { error: 'You do not have permission to revoke access to this document.' };
    }

    // 1. Delete the document_access row
    const { error: accessDeleteError } = await supabaseAdmin
      .from('document_access')
      .delete()
      .eq('document_id', documentId)
      .eq('granted_to', recipientId);

    if (accessDeleteError) return { error: accessDeleteError.message };

    // 2. Delete recipient's encryption_keys rows for this user
    // (key_type matching covers any keys they might have been issued for this doc)
    // Since encryption_keys has no document_id, we clean up by user_id scoped to their access.
    // The recipient's personal key is in encryption_keys WHERE user_id = recipientId.
    // We delete it to ensure they cannot reconstruct access via a cached key.
    await supabaseAdmin
      .from('encryption_keys')
      .delete()
      .eq('user_id', recipientId);
    // Note: This removes all encryption keys for the user. This is intentionally broad
    // because encryption_keys has no document_id column to scope the deletion.
    // The user will re-derive their masterKey on next login.

    // Audit log — no key material in metadata
    await supabaseAdmin.from('audit_logs').insert({
      actor_id: dbUser.id,
      family_id: doc.family_id,
      action: 'revoke',
      target_type: 'document',
      target_id: documentId,
      metadata: {
        revoked_from: recipientId,
      },
    });

    return {};
  } catch (err: any) {
    return { error: err.message };
  }
}

/**
 * Get the current share status for a document.
 */
export async function getShareStatus(
  documentId: string
): Promise<{ shares: ShareRecord[]; error?: string }> {
  try {
    const { dbUser } = await getAuthenticatedUser();

    // Fetch document
    const { data: doc, error: docError } = await supabaseAdmin
      .from('documents')
      .select('id, owner_id, family_id')
      .eq('id', documentId)
      .single();

    if (docError || !doc) return { shares: [], error: 'Document not found.' };

    // Caller must own the document OR be a family_admin
    const isOwner = doc.owner_id === dbUser.id;
    const isFamilyAdmin = dbUser.role === 'family_admin' && dbUser.family_id === doc.family_id;
    const isSuperAdmin = dbUser.role === 'super_admin';

    if (!isOwner && !isFamilyAdmin && !isSuperAdmin) {
      return { shares: [], error: 'Unauthorized.' };
    }

    // Fetch shares with recipient details — exclude wrapped_key from join select
    const { data: shares, error: sharesError } = await supabaseAdmin
      .from('document_access')
      .select(`
        id,
        document_id,
        granted_to,
        granted_by,
        granted_at,
        recipient:users!granted_to (
          full_name,
          role
        )
      `)
      .eq('document_id', documentId)
      .neq('granted_to', doc.owner_id); // Exclude owner's own access row

    if (sharesError) return { shares: [], error: sharesError.message };

    const shareRecords: ShareRecord[] = (shares || []).map((s: any) => ({
      id: s.id,
      document_id: s.document_id,
      granted_to: s.granted_to,
      granted_by: s.granted_by,
      wrapped_key: '', // Never return key material to client
      granted_at: s.granted_at,
      recipient_name: s.recipient?.full_name ?? null,
      recipient_role: s.recipient?.role ?? null,
    }));

    return { shares: shareRecords };
  } catch (err: any) {
    return { shares: [], error: err.message };
  }
}
