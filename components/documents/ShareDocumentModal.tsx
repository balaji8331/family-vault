'use client';

import React, { useState, useEffect, useTransition } from 'react';
import { X, Share2, Loader2, CheckCircle, UserX, Shield } from 'lucide-react';
import { useVaultStore } from '@/store/vault.store';
import { supabase } from '@/lib/supabase/client';
import { unwrapKey, wrapKey } from '@/lib/crypto';
import { shareDocument, revokeShare, getShareStatus, type ShareRecord } from '@/lib/actions/sharing';

interface FamilyMember {
  id: string;
  full_name: string;
  role: string;
}

interface ShareDocumentModalProps {
  documentId: string;
  documentName: string;
  ownerId: string;
  onClose: () => void;
}

/** Convert ArrayBuffer to base64 string */
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

/** Convert base64 string to ArrayBuffer */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary_string = window.atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

export default function ShareDocumentModal({
  documentId,
  documentName,
  ownerId,
  onClose,
}: ShareDocumentModalProps) {
  const currentUser = useVaultStore((state) => state.currentUser);
  const masterKey = useVaultStore((state) => state.masterKey);
  const familyKey = useVaultStore((state) => state.familyKey);

  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [currentShares, setCurrentShares] = useState<ShareRecord[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // Load family members and current share status
  useEffect(() => {
    async function loadData() {
      if (!currentUser?.family_id) return;
      try {
        const [membersResult, sharesResult] = await Promise.all([
          supabase
            .from('users')
            .select('id, full_name, role')
            .eq('family_id', currentUser.family_id)
            .neq('id', currentUser.id) // Exclude self
            .order('full_name'),
          getShareStatus(documentId),
        ]);

        setMembers(membersResult.data || []);
        setCurrentShares(sharesResult.shares);
      } catch (err) {
        console.error('Failed to load share data:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [documentId, currentUser]);

  const isSharedWith = (memberId: string) =>
    currentShares.some((s) => s.granted_to === memberId);

  const handleShare = () => {
    if (selected.size === 0) {
      setErrorMsg('Please select at least one member to share with.');
      return;
    }
    if (!masterKey || !familyKey) {
      setErrorMsg('Vault is locked. Please re-authenticate.');
      return;
    }

    setErrorMsg(null);
    setSuccessMsg(null);

    startTransition(async () => {
      try {
        // Step 1: Fetch the sharer's own wrapped_key for this document
        const { data: ownAccess, error: accessError } = await supabase
          .from('document_access')
          .select('wrapped_key')
          .eq('document_id', documentId)
          .eq('granted_to', currentUser!.id)
          .maybeSingle();

        if (accessError || !ownAccess?.wrapped_key) {
          setErrorMsg('Could not find your encryption key for this document.');
          return;
        }

        // Step 2: Unwrap the document key using the sharer's masterKey
        const wrappedKeyBuffer = base64ToArrayBuffer(ownAccess.wrapped_key);
        let documentKey: CryptoKey;
        try {
          documentKey = await unwrapKey(wrappedKeyBuffer, masterKey);
        } catch {
          setErrorMsg('Failed to unlock document key. Your vault may need to be re-authenticated.');
          return;
        }

        // Step 3 & 4: For each selected recipient, re-wrap doc key with familyKey
        // familyKey stays in browser memory — only the wrapped output goes to the server
        const shareErrors: string[] = [];
        let shareCount = 0;

        for (const recipientId of Array.from(selected)) {
          try {
            const wrappedForRecipient = await wrapKey(documentKey, familyKey);
            const wrappedBase64 = arrayBufferToBase64(wrappedForRecipient);

            const { error } = await shareDocument(documentId, recipientId, wrappedBase64, 'view');
            if (error) {
              shareErrors.push(error);
            } else {
              shareCount++;
            }
          } catch (e: any) {
            shareErrors.push(e.message);
          }
        }

        if (shareErrors.length > 0) {
          setErrorMsg(`Some shares failed: ${shareErrors.join(', ')}`);
        }
        if (shareCount > 0) {
          setSuccessMsg(`Shared with ${shareCount} member${shareCount > 1 ? 's' : ''} successfully.`);
          // Refresh share status
          const sharesResult = await getShareStatus(documentId);
          setCurrentShares(sharesResult.shares);
          setSelected(new Set());
        }
      } catch (err: any) {
        setErrorMsg(err.message || 'An unexpected error occurred during sharing.');
      }
    });
  };

  const handleRevoke = (recipientId: string, recipientName: string) => {
    if (!confirm(`Revoke access for ${recipientName}? They will no longer be able to open this document.`)) return;

    startTransition(async () => {
      const { error } = await revokeShare(documentId, recipientId);
      if (error) {
        setErrorMsg(error);
      } else {
        setSuccessMsg(`Access revoked for ${recipientName}.`);
        const sharesResult = await getShareStatus(documentId);
        setCurrentShares(sharesResult.shares);
      }
    });
  };

  const toggleSelect = (memberId: string) => {
    if (isSharedWith(memberId)) return; // Already shared — use revoke instead
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(memberId)) next.delete(memberId);
      else next.add(memberId);
      return next;
    });
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white dark:bg-gray-900 rounded-3xl w-full max-w-lg shadow-2xl border border-gray-100 dark:border-gray-800 overflow-hidden relative max-h-[90vh] flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-gray-800 shrink-0">
            <div>
              <h2 className="text-xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
                <Share2 className="w-5 h-5 text-blue-500" />
                Share Document
              </h2>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5 truncate max-w-xs" title={documentName}>
                {documentName}
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-full transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto px-6 py-5">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
              </div>
            ) : members.length === 0 ? (
              <p className="text-center text-gray-400 py-8">No other family members found.</p>
            ) : (
              <div className="space-y-2">
                {members.map((member) => {
                  const alreadyShared = isSharedWith(member.id);
                  const isChecked = selected.has(member.id) || alreadyShared;
                  const shareRecord = currentShares.find((s) => s.granted_to === member.id);

                  return (
                    <div
                      key={member.id}
                      className={`flex items-center justify-between p-3.5 rounded-2xl border transition-colors ${
                        alreadyShared
                          ? 'border-green-200 dark:border-green-800 bg-green-50/50 dark:bg-green-900/10'
                          : selected.has(member.id)
                          ? 'border-blue-300 dark:border-blue-700 bg-blue-50/50 dark:bg-blue-900/10'
                          : 'border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer'
                      }`}
                      onClick={() => !alreadyShared && toggleSelect(member.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className="relative">
                          <div className="w-9 h-9 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold">
                            {member.full_name.charAt(0).toUpperCase()}
                          </div>
                          {alreadyShared && (
                            <CheckCircle className="w-4 h-4 text-green-500 absolute -bottom-0.5 -right-0.5 bg-white dark:bg-gray-900 rounded-full" />
                          )}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-gray-900 dark:text-white">{member.full_name}</p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            {member.role === 'family_admin' && (
                              <Shield className="w-3 h-3 text-amber-500" />
                            )}
                            <p className="text-xs text-gray-400 dark:text-gray-500 capitalize">
                              {member.role.replace('_', ' ')}
                              {alreadyShared && <span className="ml-1.5 text-green-600 dark:text-green-400">· Shared</span>}
                            </p>
                          </div>
                        </div>
                      </div>

                      {alreadyShared ? (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleRevoke(member.id, member.full_name); }}
                          disabled={isPending}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 rounded-lg transition-colors disabled:opacity-50"
                        >
                          <UserX className="w-3.5 h-3.5" />
                          Revoke
                        </button>
                      ) : (
                        <input
                          type="checkbox"
                          checked={selected.has(member.id)}
                          onChange={() => toggleSelect(member.id)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4 accent-blue-600 rounded cursor-pointer"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {errorMsg && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 text-sm rounded-xl border border-red-100 dark:border-red-800">
                {errorMsg}
              </div>
            )}
            {successMsg && (
              <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/30 text-green-600 dark:text-green-400 text-sm rounded-xl border border-green-100 dark:border-green-800 flex items-center gap-2">
                <CheckCircle className="w-4 h-4 shrink-0" />
                {successMsg}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800 shrink-0">
            <button
              onClick={handleShare}
              disabled={isPending || selected.size === 0 || loading}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-semibold rounded-xl shadow-sm transition-colors flex items-center justify-center"
            >
              {isPending ? (
                <><Loader2 className="w-5 h-5 animate-spin mr-2" /> Encrypting & Sharing…</>
              ) : (
                <><Share2 className="w-5 h-5 mr-2" /> Share with {selected.size} member{selected.size !== 1 ? 's' : ''}</>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
