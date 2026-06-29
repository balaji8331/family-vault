'use client';

import React from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

interface AuditPaginationProps {
  currentPage: number;
  totalPages: number;
}

export default function AuditPagination({ currentPage, totalPages }: AuditPaginationProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const goToPage = (page: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(page));
    router.replace(`/dashboard/audit?${params.toString()}`);
  };

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-3 mt-6">
      <button
        onClick={() => goToPage(currentPage - 1)}
        disabled={currentPage === 0}
        className="px-4 py-2 text-sm font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        ← Previous
      </button>

      <span className="text-sm text-gray-500 dark:text-gray-400 px-2">
        {currentPage + 1} / {totalPages}
      </span>

      <button
        onClick={() => goToPage(currentPage + 1)}
        disabled={currentPage >= totalPages - 1}
        className="px-4 py-2 text-sm font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        Next →
      </button>
    </div>
  );
}
