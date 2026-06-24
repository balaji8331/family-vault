'use client';

import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useVaultStore } from '@/store/vault.store';
import ExpiryBadge from '@/components/documents/ExpiryBadge';
import { useRouter } from 'next/navigation';

export default function DocumentsPage() {
  const router = useRouter();
  const currentUser = useVaultStore((state) => state.currentUser);
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<any[]>([]);

  useEffect(() => {
    async function fetchDocs() {
      if (!currentUser?.id) return;
      try {
        const { data: ownDocs, error: err1 } = await supabase
          .from('documents')
          .select('*')
          .eq('owner_id', currentUser.id)
          .order('uploaded_at', { ascending: false });

        const { data: accessData } = await supabase
          .from('document_access')
          .select('document_id')
          .eq('granted_to', currentUser.id);

        let sharedDocs: any[] = [];
        if (accessData && accessData.length > 0) {
          const docIds = accessData.map((a: any) => a.document_id);
          const { data: sDocs } = await supabase
            .from('documents')
            .select('*')
            .in('id', docIds)
            .order('uploaded_at', { ascending: false });
          if (sDocs) sharedDocs = sDocs;
        }

        if (err1) {
          console.error('Error fetching documents:', err1);
        } else {
          const allDocs = [...(ownDocs || []), ...sharedDocs];
          const uniqueDocs = Array.from(new Map(allDocs.map(item => [item.id, item])).values());
          uniqueDocs.sort((a, b) => new Date(b.uploaded_at).getTime() - new Date(a.uploaded_at).getTime());
          
          setDocuments(uniqueDocs);
        }
      } catch (err) {
        console.error('Failed to load documents:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchDocs();
  }, [currentUser]);

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="h-8 bg-gray-200 dark:bg-gray-800 rounded w-1/4 animate-pulse"></div>
        <div className="h-64 bg-white dark:bg-gray-800 rounded-2xl animate-pulse"></div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Documents</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">Manage your secure identity and family files.</p>
        </div>
        <button onClick={() => router.push('/dashboard/upload')} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl shadow-sm transition-colors flex items-center min-h-[48px]">
          <UploadIcon className="w-5 h-5 md:mr-2" />
          <span className="hidden md:inline">Upload New</span>
        </button>
      </div>

      {documents.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 border border-dashed border-gray-300 dark:border-gray-600 rounded-3xl p-12 text-center flex flex-col items-center justify-center min-h-[400px]">
          <div className="w-20 h-20 bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-full flex items-center justify-center mb-6">
            <DocumentIcon className="w-10 h-10" />
          </div>
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">No documents yet</h3>
          <p className="text-gray-500 dark:text-gray-400 max-w-md mx-auto mb-8">
            You haven't uploaded any documents to your secure vault. Start by uploading an identity card, passport, or policy.
          </p>
          <button onClick={() => router.push('/dashboard/upload')} className="px-6 py-3 min-h-[48px] bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl shadow-sm transition-colors inline-flex items-center">
            <UploadIcon className="w-5 h-5 mr-2" />
            Upload Document
          </button>
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden md:block bg-white dark:bg-gray-800 shadow-sm border border-gray-100 dark:border-gray-700 rounded-2xl overflow-hidden">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-900/50">
                <tr>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">File Name</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Type</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Date</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">Expiry</th>
                  <th scope="col" className="relative px-6 py-4"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {documents.map((doc: any) => (
                  <tr 
                    key={doc.id} 
                    onClick={() => router.push(`/dashboard/documents/${doc.id}`)}
                    className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors cursor-pointer"
                  >
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white flex items-center">
                      <DocumentIcon className="w-5 h-5 mr-3 text-gray-400" />
                      {doc.file_name}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300 capitalize">
                      {doc.doc_type || 'Unknown'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      {new Date(doc.uploaded_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">
                      <ExpiryBadge expiryDate={doc.expiry_date} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <span className="text-blue-600 hover:text-blue-900 dark:text-blue-400 dark:hover:text-blue-300">View</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards with Swipe Actions */}
          <div className="md:hidden space-y-4 pb-24">
            {documents.map((doc: any) => (
              <SwipeableCard key={doc.id} doc={doc} currentUser={currentUser} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function SwipeableCard({ doc, currentUser }: { doc: any, currentUser: any }) {
  const router = useRouter();
  const [swipeOffset, setSwipeOffset] = useState(0);
  const startX = useRef<number | null>(null);
  const currentX = useRef<number | null>(null);

  const isOwner = currentUser?.id === doc.owner_id;
  const ACTION_WIDTH = isOwner ? 160 : 80; // 80px per action button

  const handleTouchStart = (e: React.TouchEvent) => {
    startX.current = e.touches[0].clientX;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (startX.current === null) return;
    currentX.current = e.touches[0].clientX;
    const diff = currentX.current - startX.current;
    
    // Only allow swiping left
    if (diff < 0) {
      // Add resistance
      const offset = Math.max(diff, -ACTION_WIDTH * 1.5);
      setSwipeOffset(offset);
    } else {
      setSwipeOffset(0);
    }
  };

  const handleTouchEnd = () => {
    if (swipeOffset < -(ACTION_WIDTH / 2)) {
      // Snap open
      setSwipeOffset(-ACTION_WIDTH);
    } else {
      // Snap closed
      setSwipeOffset(0);
    }
    startX.current = null;
    currentX.current = null;
  };

  return (
    <div className="relative w-full overflow-hidden rounded-2xl bg-gray-100 dark:bg-gray-800">
      {/* Background Actions */}
      <div className="absolute inset-y-0 right-0 flex">
        <button 
          onClick={() => router.push(`/dashboard/documents/${doc.id}`)} // Redirect to view where they can share
          className="w-20 bg-blue-500 text-white flex flex-col items-center justify-center font-medium text-xs"
        >
          <ShareIcon className="w-6 h-6 mb-1" />
          Share
        </button>
        {isOwner && (
          <button 
            onClick={() => router.push(`/dashboard/documents/${doc.id}`)} // Redirect to view where they can delete
            className="w-20 bg-red-500 text-white flex flex-col items-center justify-center font-medium text-xs"
          >
            <TrashIcon className="w-6 h-6 mb-1" />
            Delete
          </button>
        )}
      </div>

      {/* Foreground Card */}
      <div 
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={() => {
          if (swipeOffset === 0) {
            router.push(`/dashboard/documents/${doc.id}`);
          } else {
            setSwipeOffset(0);
          }
        }}
        className="relative bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-2xl p-4 shadow-sm transition-transform active:bg-gray-50 dark:active:bg-gray-800 min-h-[96px] flex flex-col justify-center"
        style={{ 
          transform: `translateX(${swipeOffset}px)`,
          transition: startX.current !== null ? 'none' : 'transform 0.2s ease-out'
        }}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
              <DocumentIcon className="w-6 h-6" />
            </div>
            <div className="overflow-hidden">
              <h3 className="font-semibold text-gray-900 dark:text-white truncate">{doc.file_name}</h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 capitalize mt-0.5">{doc.doc_type || 'Document'}</p>
            </div>
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between text-xs border-t border-gray-100 dark:border-gray-800 pt-3">
          <span className="text-gray-500 dark:text-gray-400">{new Date(doc.uploaded_at).toLocaleDateString()}</span>
          {doc.expiry_date && <ExpiryBadge expiryDate={doc.expiry_date} />}
        </div>
      </div>
    </div>
  );
}

// Icons
function DocumentIcon(props: React.SVGProps<SVGSVGElement>) { return <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>; }
function UploadIcon(props: React.SVGProps<SVGSVGElement>) { return <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>; }
function ShareIcon(props: React.SVGProps<SVGSVGElement>) { return <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.684 13.342C8.886 12.938 9 12.482 9 12c0-.482-.114-.938-.316-1.342m0 2.684a3 3 0 110-5.368m0 5.368l5.662 3.775a3 3 0 10.985-1.472l-5.663-3.775m0-5.368l5.663-3.775a3 3 0 11-.985 1.472l-5.662 3.775m-5.662 3.775L3 12l5.684-3.342" /></svg>; }
function TrashIcon(props: React.SVGProps<SVGSVGElement>) { return <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>; }
