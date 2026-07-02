import React from 'react';

export interface AuditLogEntry {
  id: string;
  family_id: string | null;
  action: string;
  target_type: string;
  target_id: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
  actor_name: string | null;
  actor_role: string | null;
}

interface AuditLogRowProps {
  log: AuditLogEntry;
  onClick: (log: AuditLogEntry) => void;
}

const ACTION_COLORS: Record<string, string> = {
  login: 'bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  logout: 'bg-gray-50 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  auto_logout: 'bg-gray-50 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
  upload: 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  view: 'bg-purple-50 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  share: 'bg-cyan-50 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  revoke: 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  revoke_device: 'bg-orange-50 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  recovery: 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  expiry_reminder_sent: 'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400',
  invite: 'bg-teal-50 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  promote: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  remove: 'bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-400',
};

function formatRelativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

export default function AuditLogRow({ log, onClick }: AuditLogRowProps) {
  const actionColor = ACTION_COLORS[log.action] || 'bg-gray-50 text-gray-600 dark:bg-gray-700 dark:text-gray-300';
  const actorInitial = (log.actor_name || '?').charAt(0).toUpperCase();

  return (
    <tr
      onClick={() => onClick(log)}
      className="cursor-pointer hover:bg-blue-50/50 dark:hover:bg-gray-700/50 transition-colors border-b border-gray-100 dark:border-gray-700 last:border-0"
    >
      {/* Timestamp */}
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="text-sm font-medium text-gray-900 dark:text-white">
          {formatRelativeTime(log.created_at)}
        </div>
        <div className="text-xs text-gray-400 dark:text-gray-500 font-mono mt-0.5">
          {new Date(log.created_at).toLocaleString()}
        </div>
      </td>

      {/* Actor */}
      <td className="px-4 py-3 whitespace-nowrap">
        <div className="flex items-center">
          <div className="w-8 h-8 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center text-sm font-bold mr-2 shrink-0">
            {actorInitial}
          </div>
          <div>
            <div className="text-sm font-medium text-gray-900 dark:text-white truncate max-w-[120px]">
              {log.actor_name || 'Unknown'}
            </div>
            <div className="text-xs text-gray-400 dark:text-gray-500 capitalize">{log.actor_role}</div>
          </div>
        </div>
      </td>

      {/* Action */}
      <td className="px-4 py-3 whitespace-nowrap">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${actionColor}`}>
          {log.action.replace(/_/g, ' ')}
        </span>
      </td>

      {/* Target Type */}
      <td className="px-4 py-3 whitespace-nowrap">
        <span className="text-sm text-gray-600 dark:text-gray-300 capitalize">{log.target_type}</span>
      </td>

      {/* Target ID */}
      <td className="px-4 py-3">
        <span className="text-xs text-gray-400 dark:text-gray-500 font-mono truncate block max-w-[120px]" title={log.target_id}>
          {log.target_id.length > 8 ? `${log.target_id.slice(0, 8)}…` : log.target_id}
        </span>
      </td>

      {/* Details arrow */}
      <td className="px-4 py-3 text-right">
        <span className="text-gray-300 dark:text-gray-600 text-lg select-none">›</span>
      </td>
    </tr>
  );
}
