'use client';

import React, { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useVaultStore } from '@/store/vault.store';
import { unwrapKey, wrapKey } from '@/lib/crypto';
import { logAuditEvent } from '@/lib/audit';

// Helper to convert an ArrayBuffer to a Base64 string for database storage.
function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

// Helper to convert Base64 string back to ArrayBuffer
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary_string = window.atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

interface ShareModalProps {
  documentId: string;
  documentName: string;
  onClose: () => void;
}

export default function ShareModal({ documentId, documentName, onClose }: ShareModalProps) {
  const currentUser = useVaultStore(state => state.currentUser);
  const masterKey = useVaultStore(state => state.masterKey);
  const familyKey = useVaultStore(state => state.familyKey);

  const [members, setMembers] = useState<any[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function fetchEligibleMembers() {
      if (!currentUser?.family_id) {
        setMembers([]);
        setLoading(false);
        return;
      }
      try {
        // 1. Fetch all family members
        const { data: familyMembers, error: membersError } = await supabase
          .from('users')
          .select('id, full_name, role')
          .eq('family_id', currentUser.family_id);

        if (membersError) throw membersError;

        // 2. Fetch members who already have access
        const { data: accessData, error: accessError } = await supabase
          .from('document_access')
          .select('granted_to')
          .eq('document_id', documentId);

        if (accessError) throw accessError;

        const alreadyGrantedIds = new Set(accessData.map(a => a.granted_to));
        
        // Filter out current user and those who already have access
        const eligible = familyMembers.filter(
          m => m.id !== currentUser.id && !alreadyGrantedIds.has(m.id)
        );

        setMembers(eligible);
      } catch (err: any) {
        console.error('Failed to fetch members:', err);
        setError('Failed to load family members.');
      } finally {
        setLoading(false);
      }
    }
    fetchEligibleMembers();
  }, [currentUser, documentId]);

  const toggleMember = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleShare = async () => {
    if (selectedIds.size === 0) return;
    if (!currentUser || !masterKey || !familyKey) {
      setError('Missing encryption keys. Please relogin to sync your vault.');
      return;
    }

    setSharing(true);
    setError(null);

    try {
      // 1. Fetch the document's wrapped key from encryption_keys (owner's personal key)
      const { data: keyData, error: keyError } = await supabase
        .from('encryption_keys')
        .select('encrypted_key')
        .eq('user_id', currentUser.id)
        .limit(1)
        .single();

      if (keyError || !keyData) throw new Error('Could not find your encryption key for this document.');

      // 2. Unwrap the docKey using the masterKey
      const personalWrappedBuffer = base64ToArrayBuffer(keyData.encrypted_key);
      const docKey = await unwrapKey(personalWrappedBuffer, masterKey);

      // 3. Re-wrap the docKey using the familyKey
      const familyWrappedBuffer = await wrapKey(docKey, familyKey);
      const wrappedKeyBase64 = arrayBufferToBase64(familyWrappedBuffer);

      // 4. Insert into document_access for each selected recipient
      const inserts = Array.from(selectedIds).map(recipientId => ({
        document_id: documentId,
        granted_to: recipientId,
        granted_by: currentUser.id,
        wrapped_key: wrappedKeyBase64
      }));

      const { error: insertError } = await supabase
        .from('document_access')
        .insert(inserts);

      if (insertError) throw insertError;

      // Log audit events
      for (const recipientId of selectedIds) {
        await logAuditEvent('share', 'document', documentId, { granted_to: recipientId });
      }

      // Send email notifications asynchronously (don't wait for it to finish)
      fetch('/api/notify/share', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipientIds: Array.from(selectedIds),
          documentId,
          documentName,
          sharerId: currentUser.id
        })
      }).catch(err => console.error('Failed to trigger share emails:', err));

      setSuccess(true);
      setTimeout(() => onClose(), 1500);

    } catch (err: any) {
      console.error('Share failed:', err);
      setError(err.message || 'An error occurred while sharing the document.');
    } finally {
      setSharing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
      <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-2xl max-w-md w-full p-6 border border-gray-200 dark:border-gray-700">
        
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="text-xl font-bold text-gray-900 dark:text-white">Share Document</h3>
            <p className="text-sm text-gray-500 truncate max-w-[250px]">{documentName}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 bg-gray-50 hover:bg-gray-100 rounded-full p-2 transition-colors">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-xl">
            {error}
          </div>
        )}

        {success ? (
          <div className="py-8 text-center animate-in zoom-in">
            <div className="w-16 h-16 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
            </div>
            <h4 className="text-lg font-bold text-gray-900 dark:text-white">Successfully Shared!</h4>
            <p className="text-gray-500 text-sm mt-1">They can now decrypt it securely.</p>
          </div>
        ) : (
          <>
            <div className="max-h-64 overflow-y-auto mb-6 pr-2 space-y-2">
              {loading ? (
                <div className="text-center py-8 text-gray-500 text-sm animate-pulse">Loading family members...</div>
              ) : members.length === 0 ? (
                <div className="text-center py-8 text-gray-500 text-sm">Everyone in your family already has access!</div>
              ) : (
                members.map(member => (
                  <label key={member.id} className="flex items-center p-3 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-700/50 border border-transparent hover:border-gray-200 dark:hover:border-gray-600 cursor-pointer transition-colors">
                    <input 
                      type="checkbox" 
                      checked={selectedIds.has(member.id)}
                      onChange={() => toggleMember(member.id)}
                      className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-900 dark:text-white">{member.full_name}</p>
                      <p className="text-xs text-gray-500 capitalize">{member.role.replace('_', ' ')}</p>
                    </div>
                  </label>
                ))
              )}
            </div>

            <button
              onClick={handleShare}
              disabled={sharing || selectedIds.size === 0}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold rounded-xl shadow-sm transition-colors flex justify-center items-center"
            >
              {sharing ? (
                <>
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin mr-2"></div>
                  Sharing Securely...
                </>
              ) : (
                `Share with ${selectedIds.size} ${selectedIds.size === 1 ? 'member' : 'members'}`
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
