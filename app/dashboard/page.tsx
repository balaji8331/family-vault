import React, { Suspense } from 'react';
import DashboardStats from '@/components/dashboard/DashboardStats';
import ExpiryPanel from '@/components/dashboard/ExpiryPanel';
import SharedWithMePanel from '@/components/dashboard/SharedWithMePanel';

// Icons
function UploadIcon(props: React.SVGProps<SVGSVGElement>) { return <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>; }

export default function DashboardPage() {
  return (
    <div className="max-w-6xl mx-auto space-y-8">
      {/* Client component wrapper for Zustand state */}
      <DashboardStats />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <Suspense fallback={<div className="h-64 bg-white dark:bg-gray-800 rounded-3xl animate-pulse"></div>}>
          <ExpiryPanel />
        </Suspense>

        <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 shadow-sm border border-gray-100 dark:border-gray-700 text-center flex flex-col justify-center">
          <h3 className="text-xl font-semibold text-gray-800 dark:text-white mb-4">Quick Upload</h3>
          <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-sm mx-auto">
            Securely encrypt and upload a new identity document, insurance policy, or property deed to your family vault.
          </p>
          <div>
            <a href="/dashboard/upload" className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-xl text-white bg-blue-600 hover:bg-blue-700 shadow-sm transition-colors">
              <UploadIcon className="w-5 h-5 mr-2" />
              Upload Document
            </a>
          </div>
        </div>
      </div>

      {/* Shared With Me Panel */}
      <Suspense fallback={<div className="h-48 bg-white dark:bg-gray-800 rounded-3xl animate-pulse"></div>}>
        <SharedWithMePanel />
      </Suspense>
    </div>
  );
}
