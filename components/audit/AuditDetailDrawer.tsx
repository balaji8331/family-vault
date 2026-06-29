'use client';

import React, { useEffect } from 'react';
import { X, Shield, Clock, Target } from 'lucide-react';
import type { AuditLogEntry } from './AuditLogRow';

interface AuditDetailDrawerProps {
  log: AuditLogEntry | null;
  onClose: () => void;
}

const ROLE_BADGE: Record<string, string> = {
  super_admin: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  family_admin: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  member: 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300',
};

export default function AuditDetailDrawer({ log, onClose }: AuditDetailDrawerProps) {
  // Close on Escape key
  useEffect(() => {
    if (!log) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [log, onClose]);

  if (!log) return null;

  // Safely serialize metadata as text — NEVER use dangerouslySetInnerHTML
  let metadataText = '(none)';
  if (log.metadata) {
    try {
      metadataText = JSON.stringify(log.metadata, null, 2);
    } catch {
      metadataText = String(log.metadata);
    }
  }

  const roleBadgeClass = ROLE_BADGE[log.actor_role || ''] || ROLE_BADGE.member;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
        aria-label="Close drawer"
      />

      {/* Drawer */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-white dark:bg-gray-900 shadow-2xl border-l border-gray-200 dark:border-gray-700 flex flex-col animate-in slide-in-from-right duration-300">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100 dark:border-gray-800">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white">Audit Log Detail</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 bg-gray-50 hover:bg-gray-100 dark:bg-gray-800 dark:hover:bg-gray-700 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
          {/* Timestamp */}
          <div>
            <div className="flex items-center text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
              <Clock className="w-3.5 h-3.5 mr-1.5" /> Timestamp
            </div>
            <p className="text-sm text-gray-900 dark:text-white font-mono">
              {new Date(log.created_at).toISOString()}
            </p>
            <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
              {new Date(log.created_at).toLocaleString(undefined, { timeZoneName: 'short' })}
            </p>
          </div>

          {/* Actor */}
          <div>
            <div className="flex items-center text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
              <Shield className="w-3.5 h-3.5 mr-1.5" /> Actor
            </div>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center text-base font-bold shrink-0">
                {(log.actor_name || '?').charAt(0).toUpperCase()}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-white">{log.actor_name || 'Unknown'}</p>
                {log.actor_role && (
                  <span className={`inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium capitalize ${roleBadgeClass}`}>
                    {log.actor_role.replace(/_/g, ' ')}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Action */}
          <div>
            <div className="flex items-center text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
              Action
            </div>
            <p className="text-sm font-mono font-medium text-gray-900 dark:text-white bg-gray-50 dark:bg-gray-800 px-3 py-2 rounded-lg">
              {log.action}
            </p>
          </div>

          {/* Target */}
          <div>
            <div className="flex items-center text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
              <Target className="w-3.5 h-3.5 mr-1.5" /> Target
            </div>
            <div className="bg-gray-50 dark:bg-gray-800 rounded-lg px-3 py-2 space-y-1">
              <p className="text-xs text-gray-500 dark:text-gray-400">Type: <span className="font-medium text-gray-700 dark:text-gray-300 capitalize">{log.target_type}</span></p>
              <p className="text-xs text-gray-500 dark:text-gray-400">ID: <span className="font-mono text-gray-700 dark:text-gray-300 break-all">{log.target_id}</span></p>
            </div>
          </div>

          {/* Metadata — rendered as plain text, NEVER dangerouslySetInnerHTML */}
          <div>
            <div className="flex items-center text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider mb-2">
              Metadata
            </div>
            <pre
              className="text-xs font-mono text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-gray-800 rounded-xl p-4 overflow-auto max-h-60 whitespace-pre-wrap break-all border border-gray-100 dark:border-gray-700"
            >
              {metadataText}
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 dark:border-gray-800">
          <p className="text-xs text-gray-400 dark:text-gray-500 font-mono truncate">Log ID: {log.id}</p>
        </div>
      </div>
    </>
  );
}
