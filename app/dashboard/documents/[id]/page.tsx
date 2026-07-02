'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase/client';
import { useVaultStore } from '@/store/vault.store';
import ExpiryBadge from '@/components/documents/ExpiryBadge';
import ShareModal from '@/components/documents/ShareModal';
import { logAuditEvent } from '@/lib/audit';
import DocumentViewer from '@/components/documents/DocumentViewer';

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
  extracted_name?: string | null;
  extracted_doc_number?: string | null;
  file_size_bytes: number;
}

interface AccessRecord {
  granted_to: string;
  users: {
    full_name: string;
  };
}

export default function DocumentViewerPage() {
  const { id } = useParams();
  const router = useRouter();
  const currentUser = useVaultStore((state) => state.currentUser);

  const [document, setDocument] = useState<DocumentRecord | null>(null);
  const [showShareModal, setShowShareModal] = useState(false);
  const [accessList, setAccessList] = useState<AccessRecord[]>([]);

  useEffect(() => {
    if (!id) return;
    // Fetch access list
    const fetchAccess = async () => {
      const { data: aList } = await supabase
        .from('document_access')
        .select('granted_to, users!document_access_granted_to_fkey(full_name)')
        .eq('document_id', id);
      if (aList) setAccessList(aList);
    };
    fetchAccess();
  }, [id]);

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
              {document?.owner_id === currentUser?.id && (
                <>
                  <button onClick={() => setShowShareModal(true)} className="shrink-0 flex items-center px-4 py-2 bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400 rounded-lg text-sm font-medium transition-colors">
                    <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-5.368m0 5.368l5.662 3.775a3 3 0 10.985-1.472l-5.663-3.775m0-5.368l5.663-3.775a3 3 0 11-.985 1.472l-5.662 3.775m-5.662 3.775L3 12l5.684-3.342" /></svg>
                    Share
                  </button>
                </>
              )}
            </div>
          </div>
          
          <div className="flex-1 bg-gray-100 dark:bg-gray-900 relative flex items-center justify-center p-4">
            <DocumentViewer 
              documentId={id as string} 
              onDocumentLoaded={setDocument} 
            />
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
