import React from 'react';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { Share2, FileText } from 'lucide-react';

export default async function SharedWithMePanel() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) return null;

  // Fetch all document_access rows granted to this user with document and sharer details
  const { data: shares, error: sharesError } = await supabase
    .from('document_access')
    .select(`
      id,
      granted_at,
      document:documents!document_id (
        id,
        file_name,
        doc_type,
        owner_id
      ),
      granter:users!granted_by (
        full_name
      )
    `)
    .eq('granted_to', user.id)
    .order('granted_at', { ascending: false })
    .limit(5);

  if (sharesError) {
    console.error('SharedWithMePanel error:', sharesError);
    return null;
  }

  // Filter out rows where the document owner is the current user (their own access row)
  const filtered = (shares || []).filter((s: any) => s.document?.owner_id !== user.id);

  if (filtered.length === 0) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-sm border border-gray-100 dark:border-gray-700">
      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center">
        <Share2 className="w-5 h-5 mr-2 text-purple-500" />
        Shared With Me
      </h3>

      <div className="space-y-3">
        {filtered.map((share: any) => {
          const doc = share.document;
          const granter = share.granter;
          if (!doc) return null;

          return (
            <div
              key={share.id}
              className="flex items-center justify-between p-4 rounded-2xl border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-purple-50 dark:bg-purple-900/30 text-purple-500 flex items-center justify-center shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-gray-900 dark:text-white truncate max-w-[180px]">
                    {doc.file_name}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                    <span className="capitalize">{doc.doc_type?.replace(/_/g, ' ')}</span>
                    {granter?.full_name && (
                      <> · by <span className="font-medium text-gray-600 dark:text-gray-300">{granter.full_name}</span></>
                    )}
                    <> · {new Date(share.granted_at).toLocaleDateString()}</>
                  </p>
                </div>
              </div>

              <Link
                href={`/dashboard/documents/${doc.id}`}
                className="px-3 py-1.5 text-sm font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/30 dark:hover:bg-purple-900/50 dark:text-purple-400 rounded-xl transition-colors whitespace-nowrap"
              >
                Open
              </Link>
            </div>
          );
        })}
      </div>

      {filtered.length >= 5 && (
        <div className="mt-5 text-center">
          <Link
            href="/dashboard/documents"
            className="text-sm text-purple-600 dark:text-purple-400 font-medium hover:underline"
          >
            View all shared documents →
          </Link>
        </div>
      )}
    </div>
  );
}
