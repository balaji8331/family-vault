'use client';

import React, { useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

const ACTION_OPTIONS = [
  { value: '', label: 'All Actions' },
  { value: 'login', label: 'Login' },
  { value: 'upload', label: 'Upload' },
  { value: 'view', label: 'View' },
  { value: 'share', label: 'Share' },
  { value: 'revoke', label: 'Revoke' },
  { value: 'recovery', label: 'Recovery' },
  { value: 'expiry_reminder_sent', label: 'Expiry Reminder' },
  { value: 'invite', label: 'Invite' },
  { value: 'promote', label: 'Promote' },
  { value: 'remove', label: 'Remove' },
  { value: 'revoke_device', label: 'Revoke Device' },
  { value: 'auto_logout', label: 'Auto Logout' },
  { value: 'logout', label: 'Logout' },
];

const TARGET_TYPE_OPTIONS = [
  { value: '', label: 'All Target Types' },
  { value: 'document', label: 'Document' },
  { value: 'user', label: 'User' },
  { value: 'family', label: 'Family' },
  { value: 'session', label: 'Session' },
  { value: 'system', label: 'System' },
];

interface AuditFiltersProps {
  families?: { id: string; name: string }[];
  isSuperAdmin?: boolean;
}

export default function AuditFilters({ families, isSuperAdmin }: AuditFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  const updateParam = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set(key, value);
    } else {
      params.delete(key);
    }
    // Reset page when filters change
    params.delete('page');
    router.replace(`/dashboard/audit?${params.toString()}`);
  }, [router, searchParams]);

  const handleReset = () => {
    router.replace('/dashboard/audit');
  };

  const hasFilters = searchParams.toString().length > 0 && searchParams.toString() !== 'page=0';

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 p-5 mb-6 shadow-sm">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {/* Date From */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">
            From
          </label>
          <input
            type="date"
            value={searchParams.get('from') || ''}
            onChange={(e) => updateParam('from', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
          />
        </div>

        {/* Date To */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">
            To
          </label>
          <input
            type="date"
            value={searchParams.get('to') || ''}
            onChange={(e) => updateParam('to', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
          />
        </div>

        {/* Action Type */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">
            Action
          </label>
          <select
            value={searchParams.get('action') || ''}
            onChange={(e) => updateParam('action', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
          >
            {ACTION_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Target Type */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">
            Target Type
          </label>
          <select
            value={searchParams.get('targetType') || ''}
            onChange={(e) => updateParam('targetType', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
          >
            {TARGET_TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Actor Name */}
        <div>
          <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">
            Actor
          </label>
          <input
            type="text"
            placeholder="Search by name…"
            value={searchParams.get('actor') || ''}
            onChange={(e) => updateParam('actor', e.target.value)}
            className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
          />
        </div>

        {/* Super Admin: Family Filter */}
        {isSuperAdmin && families && families.length > 0 && (
          <div>
            <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1.5 uppercase tracking-wider">
              Family
            </label>
            <select
              value={searchParams.get('familyFilter') || ''}
              onChange={(e) => updateParam('familyFilter', e.target.value)}
              className="w-full px-3 py-2 text-sm border border-gray-200 dark:border-gray-600 rounded-xl bg-gray-50 dark:bg-gray-900 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
            >
              <option value="">All Families</option>
              {families.map((fam) => (
                <option key={fam.id} value={fam.id}>{fam.name}</option>
              ))}
            </select>
          </div>
        )}
      </div>

      {hasFilters && (
        <div className="mt-4 flex justify-end">
          <button
            onClick={handleReset}
            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium transition-colors"
          >
            Reset Filters
          </button>
        </div>
      )}
    </div>
  );
}
