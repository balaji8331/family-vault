'use client';

import React, { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useVaultStore } from '@/store/vault.store';
import { unwrapKey, decryptFile } from '@/lib/crypto';
import { logAuditEvent } from '@/lib/audit';
import DecryptProgress, { DecryptStatus } from './DecryptProgress';

/**
 * Helper to convert a Base64 string back to an ArrayBuffer.
 * Used for preparing the wrapped key and IV for WebCrypto decryption.
 * @param base64 The base64 encoded string
 * @returns ArrayBuffer representing the binary data
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary_string = window.atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

interface DocumentRecord {
  id: string;
  owner_id: string;
  family_id: string;
  file_name: string;
  file_path: string;
  mime_type: string;
  iv: string;
  doc_type: string;
  expiry_date: string | null;
  uploaded_at: string;
}

interface DocumentViewerProps {
  documentId: string;
  onDocumentLoaded?: (doc: DocumentRecord) => void;
}

/**
 * DocumentViewer Client Component
 * 
 * Handles the complete secure viewing lifecycle for a document:
 * 1. Fetches metadata and access lists
 * 2. Unwraps the AES-GCM key using the user's masterKey or familyKey
 * 3. Downloads the encrypted file blob via a Supabase signed URL
 * 4. Decrypts the file locally in memory using WebCrypto
 * 5. Renders the decrypted file via a revoked Blob URL inside a sandboxed iframe
 * 
 * @param props DocumentViewerProps
 * @param props.documentId The UUID of the document to view
 * @param props.onDocumentLoaded Optional callback fired when document metadata is successfully fetched
 */
export default function DocumentViewer({ documentId, onDocumentLoaded }: DocumentViewerProps) {
  const currentUser = useVaultStore((state) => state.currentUser);
  const masterKey = useVaultStore((state) => state.masterKey);
  const familyKey = useVaultStore((state) => state.familyKey);

  const [documentMeta, setDocumentMeta] = useState<DocumentRecord | null>(null);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [status, setStatus] = useState<DecryptStatus>('fetching');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const executeDecryption = async () => {
    let activeUrl: string | null = null;
    
    if (!documentId) return;
    
    if (!currentUser || !masterKey) {
      setStatus('error');
      setErrorMsg('Vault is locked. Please re-authenticate.');
      return;
    }

    try {
      setStatus('fetching');
      setErrorMsg(null);
      
      // 1. Fetch document record
      const { data: doc, error: docError } = await supabase
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .single();

      if (docError || !doc) throw new Error('Document not found or access denied.');
      
      setDocumentMeta(doc);
      if (onDocumentLoaded) onDocumentLoaded(doc);

      // 2. Fetch wrapped key from document_access
      let accessData = null;
      let unwrappingKey = masterKey;

      if (doc.owner_id === currentUser.id) {
        // Find our personal wrapped key
        const { data: personalAccess } = await supabase
          .from('document_access')
          .select('wrapped_key')
          .eq('document_id', documentId)
          .eq('granted_to', currentUser.id)
          .maybeSingle();
        
        if (personalAccess) {
          accessData = personalAccess;
          unwrappingKey = masterKey;
        }
      } else {
        // It's a shared document.
        const { data: familyAccess } = await supabase
          .from('document_access')
          .select('wrapped_key')
          .eq('document_id', documentId)
          .eq('granted_to', currentUser.id)
          .maybeSingle();
          
        if (familyAccess) {
          accessData = familyAccess;
          unwrappingKey = familyKey || masterKey;
        }
      }

      if (!accessData) {
        throw new Error('Encryption key not found. You may not have access.');
      }
      
      const wrappedKeyBase64 = accessData.wrapped_key;

      setStatus('decrypting');

      // 3. Unwrap document key
      const wrappedKeyBuffer = base64ToArrayBuffer(wrappedKeyBase64);
      let docKey: CryptoKey;
      try {
        docKey = await unwrapKey(wrappedKeyBuffer, unwrappingKey);
      } catch (unwrapErr) {
        console.error("Unwrap failed:", unwrapErr);
        throw new Error("Decryption failed. Your key does not match this document.");
      }

      // 4. Fetch encrypted file via Signed URL
      // Use 30 mins (1800 seconds) expiry as specified
      const { data: signedData, error: signedError } = await supabase.storage
        .from('documents')
        .createSignedUrl(doc.file_path, 1800);

      if (signedError || !signedData?.signedUrl) throw new Error('Failed to retrieve file securely.');

      const response = await fetch(signedData.signedUrl);
      if (response.status === 400 || response.status === 403) {
        throw new Error('Session expired. Please refresh.');
      }
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
      await logAuditEvent('view', 'document', documentId);

    } catch (err: any) {
      console.error(err);
      setStatus('error');
      setErrorMsg(err.message || 'An unexpected error occurred while decrypting the document.');
    }
    
    return activeUrl;
  };

  useEffect(() => {
    let activeUrl: string | null = null;
    
    executeDecryption().then(url => {
      if (url) activeUrl = url;
    });

    return () => {
      // Clean up blob URL on unmount to prevent memory leaks
      if (activeUrl) {
        URL.revokeObjectURL(activeUrl);
      } else if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
      }
    };
  }, [documentId, currentUser, masterKey, familyKey]);

  if (status !== 'ready') {
    return <DecryptProgress status={status} errorMsg={errorMsg} onRetry={executeDecryption} />;
  }

  if (!blobUrl || !documentMeta) {
    return <DecryptProgress status="error" errorMsg="Failed to render document." />;
  }

  return (
    <div className="w-full h-full flex flex-col items-center justify-center overflow-auto rounded-xl">
      {documentMeta.mime_type?.startsWith('image/') ? (
        <img 
          src={blobUrl} 
          alt={documentMeta.file_name} 
          className="max-w-full max-h-[800px] object-contain rounded shadow-sm" 
        />
      ) : documentMeta.mime_type === 'application/pdf' ? (
        <iframe 
          src={`${blobUrl}#toolbar=0`} 
          sandbox="allow-same-origin"
          className="w-full h-[800px] rounded shadow-sm bg-white" 
          title="PDF Viewer" 
        />
      ) : (
        <div className="text-gray-500 flex flex-col items-center">
          <svg className="w-16 h-16 mb-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p>Preview not available for this file type.</p>
        </div>
      )}
    </div>
  );
}
