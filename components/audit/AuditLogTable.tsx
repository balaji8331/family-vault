'use client';

import React, { useState, useTransition } from 'react';
import AuditLogRow, { type AuditLogEntry } from './AuditLogRow';
import AuditDetailDrawer from './AuditDetailDrawer';
import { exportAuditLogsCsv, type AuditFilters } from '@/lib/actions/audit';
import { Download, Loader2 } from 'lucide-react';

interface AuditLogTableProps {
  logs: AuditLogEntry[];
  isSuperAdmin: boolean;
  currentFilters: AuditFilters;
  currentPage: number;
  totalCount: number;
  onPageChange: (page: number) => void;
}

export default function AuditLogTable({
  logs,
  isSuperAdmin,
  currentFilters,
  currentPage,
  totalCount,
  onPageChange,
}: AuditLogTableProps) {
  const [selectedLog, setSelectedLog] = useState<AuditLogEntry | null>(null);
  const [csvPending, startCsvTransition] = useTransition();
  const [csvError, setCsvError] = useState<string | null>(null);

  const totalPages = Math.ceil(totalCount / 50);

  const handleExportCsv = () => {
    setCsvError(null);
    startCsvTransition(async () => {
      const { csv, error } = await exportAuditLogsCsv(currentFilters);
      if (error || !csv) {
        setCsvError(error || 'Export failed');
        return;
      }
      // Trigger browser download
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  };

  return (
    <>
      {/* Table header with export */}
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {totalCount} total log{totalCount !== 1 ? 's' : ''}
          {totalPages > 1 && ` · Page ${currentPage + 1} of ${totalPages}`}
        </p>

        {isSuperAdmin && (
          <div className="flex items-center gap-3">
            {csvError && (
              <span className="text-sm text-red-500">{csvError}</span>
            )}
            <button
              onClick={handleExportCsv}
              disabled={csvPending}
              className="flex items-center px-4 py-2 text-sm font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl shadow-sm transition-colors disabled:opacity-50"
            >
              {csvPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : (
                <Download className="w-4 h-4 mr-2" />
              )}
              Export CSV
            </button>
          </div>
        )}
      </div>

      {/* Table */}
      <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 shadow-sm overflow-hidden">
        {logs.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-gray-400 dark:text-gray-500 text-lg">No audit logs found for the selected filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead>
                <tr className="bg-gray-50 dark:bg-gray-900/50 border-b border-gray-100 dark:border-gray-700">
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Timestamp</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Actor</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Action</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Target Type</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider">Target ID</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <AuditLogRow key={log.id} log={log} onClick={setSelectedLog} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-3 mt-6">
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 0}
            className="px-4 py-2 text-sm font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            ← Previous
          </button>

          <span className="text-sm text-gray-500 dark:text-gray-400 px-2">
            {currentPage + 1} / {totalPages}
          </span>

          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage >= totalPages - 1}
            className="px-4 py-2 text-sm font-medium bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-700 rounded-xl shadow-sm transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Next →
          </button>
        </div>
      )}

      {/* Detail Drawer */}
      <AuditDetailDrawer log={selectedLog} onClose={() => setSelectedLog(null)} />
    </>
  );
}
