'use client';

import React from 'react';
import { FileText, Trash2, Share2 } from 'lucide-react';
import ExpiryBadge from '@/components/documents/ExpiryBadge';

import { DocumentRecord } from '@/app/dashboard/documents/page';

interface DocumentCardProps {
  doc: DocumentRecord;
  isShared: boolean;
  onView: (id: string) => void;
  onDelete?: (doc: DocumentRecord) => void;
  onShare?: (doc: DocumentRecord) => void;
  canShare?: boolean;
}

export default function DocumentCard({ doc, isShared, onView, onDelete, onShare, canShare }: DocumentCardProps) {
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group">
      <div className="flex items-center space-x-3 mb-3 sm:mb-0">
        <div className="w-10 h-10 rounded-lg bg-gray-100 dark:bg-gray-800 flex items-center justify-center shrink-0">
          <FileText className="w-5 h-5 text-gray-500" />
        </div>
        <div>
          <h4 className="font-medium text-sm text-gray-900 dark:text-white line-clamp-1">{doc.file_name}</h4>
          <div className="flex items-center space-x-2 mt-1">
            <span className="text-xs text-gray-500">{new Date(doc.uploaded_at).toLocaleDateString()}</span>
            {doc.expiry_date && <ExpiryBadge expiryDate={doc.expiry_date} />}
            {isShared && (
              <span className="text-xs text-blue-500 dark:text-blue-400 font-medium flex items-center gap-1">
                <Share2 className="w-3 h-3" />
                Shared
              </span>
            )}
          </div>
        </div>
      </div>
      <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
        <button
          onClick={() => onView(doc.id)}
          className="px-3 py-1.5 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 rounded-lg transition-colors"
        >
          View
        </button>

        {/* Share button — visible to owner and family_admin */}
        {canShare && onShare && (
          <button
            onClick={() => onShare(doc)}
            className="px-3 py-1.5 text-sm font-medium text-purple-600 bg-purple-50 hover:bg-purple-100 dark:bg-purple-900/20 dark:text-purple-400 rounded-lg transition-colors flex items-center gap-1"
          >
            <Share2 className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Share</span>
          </button>
        )}

        {!isShared && onDelete && (
          <button
            onClick={() => onDelete(doc)}
            className="px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-400 rounded-lg transition-colors flex items-center"
          >
            <Trash2 className="w-4 h-4 md:mr-1" />
            <span className="hidden md:inline">Delete</span>
          </button>
        )}
      </div>
    </div>
  );
}
