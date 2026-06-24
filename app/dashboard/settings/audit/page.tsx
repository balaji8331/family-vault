'use client';

import React, { useState, useMemo } from 'react';
import { supabase } from '@/lib/supabase/client';
import { useVaultStore } from '@/store/vault.store';
import { 
  QueryClient, 
  QueryClientProvider, 
  useQuery 
} from '@tanstack/react-query';
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  ColumnDef,
  flexRender,
  SortingState,
} from '@tanstack/react-table';
import { DownloadIcon, XIcon, SearchIcon, FilterIcon } from 'lucide-react';
import { format } from 'date-fns';

const queryClient = new QueryClient();

function AuditTable() {
  const currentUser = useVaultStore((state) => state.currentUser);
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [selectedLog, setSelectedLog] = useState<any | null>(null);

  const { data: logs = [], isLoading } = useQuery({
    queryKey: ['auditLogs', currentUser?.id],
    queryFn: async () => {
      if (!currentUser) return [];
      
      let query = supabase
        .from('audit_logs')
        .select('*, actor:users!actor_id(full_name)');

      if (currentUser.role === 'family_admin') {
        query = query.eq('family_id', currentUser.family_id);
      } else if (currentUser.role !== 'super_admin') {
        query = query.eq('actor_id', currentUser.id);
      }

      const { data, error } = await query.order('created_at', { ascending: false }).limit(1000);
      if (error) throw error;
      return data || [];
    },
    enabled: !!currentUser
  });

  const columns = useMemo<ColumnDef<any>[]>(
    () => [
      {
        accessorKey: 'created_at',
        header: 'Date & Time',
        cell: info => format(new Date(info.getValue() as string), 'MMM d, yyyy HH:mm:ss'),
      },
      {
        accessorKey: 'actor.full_name',
        header: 'Actor',
        cell: info => <span className="font-medium text-gray-900 dark:text-white">{info.getValue() as string || 'System / Unknown'}</span>,
      },
      {
        accessorKey: 'action',
        header: 'Action',
        cell: info => {
          const action = info.getValue() as string;
          const map: Record<string, string> = {
            upload: 'bg-blue-100 text-blue-800',
            view: 'bg-gray-100 text-gray-800',
            share: 'bg-green-100 text-green-800',
            revoke_access: 'bg-red-100 text-red-800',
            login: 'bg-emerald-100 text-emerald-800',
            logout: 'bg-amber-100 text-amber-800',
            expiry_reminder_sent: 'bg-purple-100 text-purple-800',
          };
          const color = map[action] || 'bg-gray-100 text-gray-800';
          return <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${color}`}>{action.replace('_', ' ')}</span>;
        },
        filterFn: 'equalsString',
      },
      {
        accessorKey: 'target_type',
        header: 'Target',
        cell: info => <span className="capitalize">{info.getValue() as string}</span>,
      },
    ],
    []
  );

  const table = useReactTable({
    data: logs,
    columns,
    state: {
      sorting,
      globalFilter,
    },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
  });

  // Apply Action Filter manually by updating column filter
  React.useEffect(() => {
    if (actionFilter) {
      table.getColumn('action')?.setFilterValue(actionFilter);
    } else {
      table.getColumn('action')?.setFilterValue(undefined);
    }
  }, [actionFilter, table]);

  const handleExportCSV = () => {
    if (!logs.length) return;
    
    const headers = ['ID', 'Date', 'Actor', 'Action', 'Target Type', 'Target ID', 'Metadata'];
    const csvContent = [
      headers.join(','),
      ...logs.map(l => [
        l.id,
        new Date(l.created_at).toISOString(),
        `"${l.actor?.full_name || 'Unknown'}"`,
        l.action,
        l.target_type,
        l.target_id || '',
        `"${JSON.stringify(l.metadata || {}).replace(/"/g, '""')}"`
      ].join(','))
    ].join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `audit_logs_${format(new Date(), 'yyyyMMdd')}.csv`;
    link.click();
  };

  return (
    <div className="max-w-6xl mx-auto py-8 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Security & Audit Logs</h1>
          <p className="text-gray-600 dark:text-gray-400 mt-2">Monitor all activity across your secure vault.</p>
        </div>
        <button 
          onClick={handleExportCSV}
          className="flex items-center px-4 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400 rounded-xl font-medium transition-colors"
        >
          <DownloadIcon className="w-4 h-4 mr-2" />
          Export CSV
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 shadow-sm border border-gray-200 dark:border-gray-700 rounded-2xl overflow-hidden flex flex-col">
        {/* Toolbar */}
        <div className="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50 flex flex-col sm:flex-row gap-4 justify-between">
          <div className="relative w-full sm:w-72">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search logs..."
              value={globalFilter ?? ''}
              onChange={e => setGlobalFilter(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div className="relative w-full sm:w-48">
            <FilterIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={actionFilter}
              onChange={e => setActionFilter(e.target.value)}
              className="w-full pl-9 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-sm focus:ring-2 focus:ring-blue-500 appearance-none"
            >
              <option value="">All Actions</option>
              <option value="upload">Upload</option>
              <option value="view">View</option>
              <option value="share">Share</option>
              <option value="revoke_access">Revoke Access</option>
              <option value="login">Login</option>
              <option value="logout">Logout</option>
              <option value="expiry_reminder_sent">Expiry Reminder</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900/80">
              {table.getHeaderGroups().map(headerGroup => (
                <tr key={headerGroup.id}>
                  {headerGroup.headers.map(header => (
                    <th 
                      key={header.id} 
                      onClick={header.column.getToggleSortingHandler()}
                      className="px-6 py-4 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                      <div className="flex items-center">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {{
                          asc: ' 🔼',
                          desc: ' 🔽',
                        }[header.column.getIsSorted() as string] ?? null}
                      </div>
                    </th>
                  ))}
                </tr>
              ))}
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {isLoading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                    <div className="inline-block animate-spin w-6 h-6 border-2 border-gray-300 border-t-blue-600 rounded-full"></div>
                    <p className="mt-2 text-sm">Loading logs...</p>
                  </td>
                </tr>
              ) : table.getRowModel().rows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-12 text-center text-gray-500">No matching logs found.</td>
                </tr>
              ) : (
                table.getRowModel().rows.map(row => (
                  <tr 
                    key={row.id} 
                    onClick={() => setSelectedLog(row.original)}
                    className="hover:bg-blue-50/50 dark:hover:bg-blue-900/20 cursor-pointer transition-colors"
                  >
                    {row.getVisibleCells().map(cell => (
                      <td key={cell.id} className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="px-6 py-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between bg-gray-50 dark:bg-gray-900/50">
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Page <span className="font-medium">{table.getState().pagination.pageIndex + 1}</span> of <span className="font-medium">{table.getPageCount() || 1}</span>
          </span>
          <div className="space-x-2">
            <button 
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm disabled:opacity-50 font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors bg-white dark:bg-gray-900"
            >
              Previous
            </button>
            <button 
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg text-sm disabled:opacity-50 font-medium hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors bg-white dark:bg-gray-900"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Log Details Modal */}
      {selectedLog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[85vh]">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center bg-gray-50 dark:bg-gray-900">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Audit Log Details</h3>
              <button onClick={() => setSelectedLog(null)} className="p-1 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-full text-gray-500">
                <XIcon className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto space-y-6">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-gray-500 mb-1">Date & Time</p>
                  <p className="font-medium">{format(new Date(selectedLog.created_at), 'PPP pp')}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Actor</p>
                  <p className="font-medium">{selectedLog.actor?.full_name || 'System'}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Action</p>
                  <p className="font-medium capitalize">{selectedLog.action.replace('_', ' ')}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-1">Target</p>
                  <p className="font-medium capitalize">{selectedLog.target_type} {selectedLog.target_id && <span className="text-gray-400 font-mono text-xs ml-1">({selectedLog.target_id})</span>}</p>
                </div>
              </div>
              
              <div>
                <p className="text-gray-500 mb-2 text-sm font-medium">Metadata Payload (JSON)</p>
                <div className="bg-gray-900 text-green-400 p-4 rounded-xl font-mono text-sm overflow-x-auto shadow-inner">
                  <pre>{JSON.stringify(selectedLog.metadata, null, 2)}</pre>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AuditLogsPageWrapper() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuditTable />
    </QueryClientProvider>
  );
}
