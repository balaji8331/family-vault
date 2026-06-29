import React from 'react';
import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';
import { AlertCircle, AlertTriangle, Clock } from 'lucide-react';

export default async function ExpiryPanel() {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  
  if (authError || !user) {
    return null; // Not authenticated or error
  }

  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);

  const thirtyDaysFromNow = new Date(today);
  thirtyDaysFromNow.setUTCDate(thirtyDaysFromNow.getUTCDate() + 30);

  // Fetch documents expiring in the next 30 days
  const { data: expiringDocs, error: docsError } = await supabase
    .from('documents')
    .select('id, file_name, doc_type, expiry_date, owner_id')
    .eq('owner_id', user.id)
    .not('expiry_date', 'is', null)
    .gte('expiry_date', today.toISOString())
    .lte('expiry_date', thirtyDaysFromNow.toISOString())
    .order('expiry_date', { ascending: true });

  if (docsError) {
    console.error('Error fetching expiring docs in panel:', docsError);
    return null;
  }

  if (!expiringDocs || expiringDocs.length === 0) {
    return (
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-sm border border-gray-100 dark:border-gray-700 text-center">
        <div className="w-16 h-16 bg-green-50 dark:bg-green-900/30 text-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
          <Clock className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Up to date</h3>
        <p className="text-gray-500 dark:text-gray-400">All your documents are up to date.</p>
      </div>
    );
  }

  // We need to fetch user names if owner_id doesn't match the current user,
  // but since we query .eq('owner_id', user.id), the owner is always the current user.
  // We'll still fetch the user's name securely to fulfill "owner name" requirement.
  const { data: dbUser } = await supabase
    .from('users')
    .select('full_name')
    .eq('id', user.id)
    .single();

  const ownerName = dbUser?.full_name || 'You';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-sm border border-gray-100 dark:border-gray-700">
      <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-6 flex items-center">
        <Clock className="w-5 h-5 mr-2 text-blue-500" />
        Expiring Soon
      </h3>

      <div className="space-y-4">
        {expiringDocs.map((doc) => {
          const expiryDate = new Date(doc.expiry_date!);
          expiryDate.setUTCHours(0, 0, 0, 0);
          const diffTime = expiryDate.getTime() - today.getTime();
          const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

          let statusConfig = {
            color: 'bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400 border-green-200 dark:border-green-800',
            icon: <Clock className="w-4 h-4 mr-1.5" />,
            label: 'Upcoming'
          };

          if (diffDays <= 7) {
            statusConfig = {
              color: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400 border-red-200 dark:border-red-800',
              icon: <AlertCircle className="w-4 h-4 mr-1.5" />,
              label: 'Critical'
            };
          } else if (diffDays <= 14) {
            statusConfig = {
              color: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
              icon: <AlertTriangle className="w-4 h-4 mr-1.5" />,
              label: 'Warning'
            };
          }

          return (
            <div key={doc.id} className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl border border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors">
              <div className="mb-3 sm:mb-0">
                <div className="flex items-center flex-wrap gap-2 mb-1">
                  <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${statusConfig.color}`}>
                    {statusConfig.icon}
                    {statusConfig.label}
                  </span>
                  <span className="text-sm font-semibold text-gray-900 dark:text-white truncate max-w-[200px]">
                    {doc.file_name}
                  </span>
                </div>
                <div className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-2">
                  <span>{doc.doc_type}</span>
                  <span>&bull;</span>
                  <span>{ownerName}</span>
                </div>
              </div>

              <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
                <div className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {diffDays} day{diffDays !== 1 ? 's' : ''} left
                </div>
                <Link 
                  href={`/dashboard/documents/${doc.id}`}
                  className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 dark:hover:bg-blue-900/50 dark:text-blue-400 rounded-xl transition-colors whitespace-nowrap"
                >
                  View Doc
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
