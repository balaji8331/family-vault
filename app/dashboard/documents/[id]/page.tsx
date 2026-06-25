'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useVaultStore } from '@/store/vault.store';
import { unwrapKey, decryptFile } from '@/lib/crypto';
import ExpiryBadge from '@/components/documents/ExpiryBadge';
import ShareModal from '@/components/documents/ShareModal';
import { logAuditEvent } from '@/lib/audit';
import * as Dialog from '@radix-ui/react-dialog';

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

export default function DocumentViewerPage() {
  const { id } = useParams();
  const router = useRouter();
  const currentUser = useVaultStore((state) => state.currentUser);
  const masterKey = useVaultStore((state) => state.masterKey);
  const familyKey = useVaultStore((state) => state.familyKey);

  const [document, setDocument] = useState<any>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<'fetching' | 'decrypting' | 'rendering' | 'ready' | 'error'>('fetching');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [accessList, setAccessList] = useState<any[]>([]);

  useEffect(() => {
    let activeUrl: string | null = null;

    async function loadAndDecrypt() {
      if (!id || typeof id !== 'string') return;
      if (!currentUser || !masterKey) {
        setStatus('error');
        setErrorMsg('Vault is not unlocked. Please log in again.');
        return;
      }

      try {
        // 1. Fetch document record
        const { data: doc, error: docError } = await supabase
          .from('documents')
          .select('*')
          .eq('id', id)
          .single();

        if (docError || !doc) throw new Error('Document not found or access denied.');
        setDocument(doc);

        // Fetch access list
        const { data: aList } = await supabase
          .from('document_access')
          .select('granted_to, users!document_access_granted_to_fkey(full_name)')
          .eq('document_id', id);
        if (aList) setAccessList(aList);

        // 2. Fetch wrapped key from document_access
        let accessData = null;
        let unwrappingKey = masterKey;

        const { data: personalAccess } = await supabase
          .from('document_access')
          .select('wrapped_key')
          .eq('document_id', id)
          .eq('granted_to', currentUser.id)
          .maybeSingle();

        if (personalAccess) {
          accessData = personalAccess;
          unwrappingKey = masterKey;
        } else if (currentUser.family_id && familyKey) {
          const { data: familyAccess } = await supabase
            .from('document_access')
            .select('wrapped_key')
            .eq('document_id', id)
            .eq('granted_to', currentUser.family_id)
            .maybeSingle();
            
          if (familyAccess) {
            accessData = familyAccess;
            unwrappingKey = familyKey;
          }
        }

        if (!accessData) throw new Error('Encryption key not found. You may not have access.');
        const wrappedKeyBase64 = accessData.wrapped_key;

        setStatus('decrypting');

        // 3. Unwrap document key
        const wrappedKeyBuffer = base64ToArrayBuffer(wrappedKeyBase64);
        let docKey: CryptoKey;
        try {
          docKey = await unwrapKey(wrappedKeyBuffer, unwrappingKey);
        } catch (unwrapErr) {
          console.error("Unwrap failed:", unwrapErr);
          throw new Error("Failed to decrypt document. The encryption key is corrupted or invalid for your current session.");
        }

        // 4. Fetch encrypted file via Signed URL
        const { data: signedData, error: signedError } = await supabase.storage
          .from('documents')
          .createSignedUrl(doc.file_path, 60);

        if (signedError || !signedData?.signedUrl) throw new Error('Failed to retrieve file securely.');

        const response = await fetch(signedData.signedUrl);
        if (!response.ok) throw new Error('Failed to download encrypted file.');
        const encryptedArrayBuffer = await response.arrayBuffer();

        // 5. Decrypt file
        const ivBuffer = base64ToArrayBuffer(doc.iv);
        const decryptedBuffer = await decryptFile(encryptedArrayBuffer, new Uint8Array(ivBuffer), docKey);

        setStatus('rendering');

        // 6. Create Blob URL
        const blob = new Blob([decryptedBuffer], { type: doc.mime_type });
        activeUrl = URL.createObjectURL(blob);
        setBlobUrl(activeUrl);
        
        setStatus('ready');
        
        // Log view event
        await logAuditEvent('view', 'document', id as string);

      } catch (err: any) {
        console.error(err);
        setStatus('error');
        setErrorMsg(err.message || 'An unexpected error occurred while decrypting the document.');
      }
    }

    loadAndDecrypt();

    return () => {
      // Clean up blob URL on unmount to prevent memory leaks
      if (activeUrl) {
        URL.revokeObjectURL(activeUrl);
      }
    };
  }, [id, currentUser, masterKey]);

  const handleDownload = () => {
    if (!blobUrl || !document) return;
    const a = window.document.createElement('a');
    a.href = blobUrl;
    a.download = document.file_name || 'decrypted_document';
    window.document.body.appendChild(a);
    a.click();
    window.document.body.removeChild(a);
  };

  const handleRevoke = async (grantedTo: string) => {
    try {
      await supabase
        .from('document_access')
        .delete()
        .eq('document_id', id)
        .eq('granted_to', grantedTo);
        
      setAccessList(prev => prev.filter(a => a.granted_to !== grantedTo));
      await logAuditEvent('revoke_access', 'document', id as string, { revoked_user: grantedTo });
    } catch (err) {
      console.error('Failed to revoke access', err);
    }
  };

  const handleNotifyToggle = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.checked;
    try {
      await supabase
        .from('documents')
        .update({ notify_enabled: newValue })
        .eq('id', id);
      setDocument({ ...document, notify_enabled: newValue });
    } catch (err) {
      console.error('Failed to update notify_enabled', err);
    }
  };



  if (status === 'error') {
    return (
      <div className="max-w-4xl mx-auto p-8 text-center bg-red-50 rounded-3xl border border-red-100 mt-10">
        <h2 className="text-2xl font-bold text-red-700 mb-2">Decryption Failed</h2>
        <p className="text-red-600">{errorMsg}</p>
        <button onClick={() => router.push('/dashboard/documents')} className="mt-6 px-6 py-2 bg-red-600 text-white rounded-xl">Go Back</button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto pb-10">
      <button 
        onClick={() => router.push('/dashboard/documents')}
        className="mb-6 flex items-center text-sm font-medium text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white"
      >
        <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" /></svg>
        Back to Documents
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Main Viewer Area */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-800 rounded-3xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm flex flex-col min-h-[600px]">
          <div className="p-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900/50">
            <h2 className="font-semibold text-gray-900 dark:text-white truncate pr-4">
              {document?.file_name || 'Loading Document...'}
            </h2>
            <div className="flex space-x-2">
              {document?.owner_id === currentUser?.id && status === 'ready' && (
                <>
                  <button onClick={() => setShowShareModal(true)} className="shrink-0 flex items-center px-4 py-2 bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 rounded-lg text-sm font-medium transition-colors">
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-5.368m0 5.368l5.662 3.775a3 3 0 10.985-1.472l-5.663-3.775m0-5.368l5.663-3.775a3 3 0 11-.985 1.472l-5.662 3.775m-5.662 3.775L3 12l5.684-3.342" /></svg>
                    Share
                  </button>
                </>
              )}
              {status === 'ready' && (
                <button onClick={handleDownload} className="shrink-0 flex items-center px-4 py-2 bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 rounded-lg text-sm font-medium transition-colors">
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" /></svg>
                  Download
                </button>
              )}
            </div>
          </div>
          
          <div className="flex-1 bg-gray-100 dark:bg-gray-900 relative flex items-center justify-center p-4">
            {status !== 'ready' ? (
              <div className="text-center space-y-4">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
                <p className="text-gray-500 font-medium animate-pulse">
                  {status === 'fetching' && 'Securely fetching encrypted blob...'}
                  {status === 'decrypting' && 'Decrypting locally with your key...'}
                  {status === 'rendering' && 'Preparing viewer...'}
                </p>
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center overflow-auto rounded-xl">
                {document?.mime_type?.startsWith('image/') ? (
                  <img src={blobUrl!} alt={document?.file_name} className="max-w-full max-h-[800px] object-contain rounded shadow-sm" />
                ) : document?.mime_type === 'application/pdf' ? (
                  <iframe src={`${blobUrl}#toolbar=0`} className="w-full h-[800px] rounded shadow-sm bg-white" title="PDF Viewer" />
                ) : (
                  <div className="text-gray-500 flex flex-col items-center">
                    <svg className="w-16 h-16 mb-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>
                    <p>Preview not available for this file type.</p>
                    <button onClick={handleDownload} className="mt-4 text-blue-500 hover:underline">Download to view</button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Metadata Sidebar */}
        <div className="space-y-6">
          <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
            <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-6 flex items-center">
              <svg className="w-5 h-5 mr-2 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
              Document Details
            </h3>

            {document ? (
              <div className="space-y-5">
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Type</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-white capitalize">{document.doc_type || 'Unknown'}</p>
                </div>
                
                <div>
                  <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Status</p>
                  <div>
                    {document.expiry_date ? (
                      <ExpiryBadge expiryDate={document.expiry_date} />
                    ) : (
                      <span className="text-sm text-gray-500">No expiration date</span>
                    )}
                  </div>
                </div>

                {document.expiry_date && (
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">Expiry Reminders</p>
                      <p className="text-xs text-gray-500">Get emails before it expires</p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input 
                        type="checkbox" 
                        className="sr-only peer" 
                        checked={document.notify_enabled} 
                        onChange={handleNotifyToggle}
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </label>
                  </div>
                )}

                <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Extracted Metadata (OCR)</h4>
                  
                  <div className="space-y-4">
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Name on Document</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white">
                        {document.extracted_name || <span className="text-gray-400 italic">Not detected</span>}
                      </p>
                    </div>
                    
                    <div>
                      <p className="text-xs text-gray-400 mb-1">Document Number</p>
                      <p className="text-sm font-medium text-gray-900 dark:text-white font-mono bg-gray-50 dark:bg-gray-900 px-2 py-1 rounded inline-block">
                        {document.extracted_doc_number || <span className="text-gray-400 italic">Not detected</span>}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-4 border-t border-gray-100 dark:border-gray-700">
                  <p className="text-xs text-gray-400 mb-1">Uploaded</p>
                  <p className="text-sm text-gray-900 dark:text-white">
                    {new Date(document.uploaded_at).toLocaleString()}
                  </p>
                  <p className="text-xs text-gray-400 mt-2 mb-1">Size</p>
                  <p className="text-sm text-gray-900 dark:text-white">
                    {(document.file_size_bytes / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>

              </div>
            ) : (
              <div className="animate-pulse space-y-4">
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/2"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-3/4"></div>
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-2/3"></div>
              </div>
            )}
          </div>
          
          <div className="bg-green-50 dark:bg-green-900/20 rounded-3xl p-6 border border-green-100 dark:border-green-900/50 flex items-start">
            <svg className="w-6 h-6 text-green-600 dark:text-green-400 mr-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            <div>
              <h4 className="text-sm font-bold text-green-800 dark:text-green-400 mb-1">Zero-Knowledge Secured</h4>
              <p className="text-xs text-green-700 dark:text-green-500">This document was decrypted locally on your device. The server never saw the contents.</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Access List Section */}
      {accessList.length > 0 && (
        <div className="mt-8 bg-white dark:bg-gray-800 rounded-3xl p-6 border border-gray-200 dark:border-gray-700 shadow-sm">
          <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Shared With</h3>
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {accessList.map(access => (
              <div key={access.granted_to} className="py-3 flex justify-between items-center">
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {access.users?.full_name || 'Unknown User'}
                </span>
                {(currentUser?.role === 'family_admin' || document?.owner_id === currentUser?.id) && (
                  <button 
                    onClick={() => handleRevoke(access.granted_to)}
                    className="text-xs text-red-600 hover:text-red-800 bg-red-50 hover:bg-red-100 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    Revoke Access
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {showShareModal && document && (
        <ShareModal 
          documentId={document.id} 
          documentName={document.file_name} 
          onClose={() => {
            setShowShareModal(false);
            // Refresh access list
            supabase.from('document_access').select('granted_to, users!document_access_granted_to_fkey(full_name)').eq('document_id', document.id)
              .then(({data}) => { if (data) setAccessList(data); });
          }} 
        />
      )}



    </div>
  );
}
