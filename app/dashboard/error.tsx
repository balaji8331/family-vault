'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { logAuditEvent } from '@/lib/audit';
import { useVaultStore } from '@/store/vault.store';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Dashboard Error Caught:', error);
    const user = useVaultStore.getState().currentUser;
    if (user) {
      logAuditEvent('error_boundary', 'system', user.id, { error: error.message }).catch(console.error);
    }
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center p-8 bg-white dark:bg-gray-800 rounded-[2rem] border border-gray-100 dark:border-gray-700 shadow-sm min-h-[400px]">
      <div className="w-20 h-20 bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 rounded-full flex items-center justify-center mb-6">
        <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
        </svg>
      </div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-3 text-center">Dashboard Error</h2>
      <p className="text-gray-600 dark:text-gray-400 mb-8 text-center max-w-md">
        We encountered a problem loading this part of your vault. Your data remains secure.
      </p>
      <div className="flex space-x-4">
        <button
          onClick={() => reset()}
          className="py-3 px-6 bg-purple-600 hover:bg-purple-700 text-white font-semibold rounded-xl transition-colors shadow-md"
        >
          Try again
        </button>
        <Link
          href="/dashboard"
          className="py-3 px-6 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-semibold rounded-xl transition-colors"
        >
          Go to Home
        </Link>
      </div>
    </div>
  );
}
