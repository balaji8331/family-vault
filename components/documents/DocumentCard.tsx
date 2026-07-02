'use client';

import React from 'react';
import { FileText, Trash2, Share2, Image, File, FileType } from 'lucide-react';
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

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const DOC_MIME  = 'application/msword';

/**
 * Returns an appropriate Lucide icon and colour token for a given MIME type.
 * Used to give each document card a distinctive visual cue at a glance.
 */
function getFileIconMeta(mimeType: string, fileName: string): {
  Icon: React.ElementType;
  bgClass: string;
  iconClass: string;
  label: string;
} {
  if (mimeType.startsWith('image/')) {
    return { Icon: Image, bgClass: 'bg-emerald-100 dark:bg-emerald-900/30', iconClass: 'text-emerald-600 dark:text-emerald-400', label: 'Image' };
  }
  if (mimeType === 'application/pdf') {
    return { Icon: FileText, bgClass: 'bg-red-100 dark:bg-red-900/30', iconClass: 'text-red-600 dark:text-red-400', label: 'PDF' };
  }
  if (mimeType === DOCX_MIME || fileName.toLowerCase().endsWith('.docx')) {
    return { Icon: FileType, bgClass: 'bg-blue-100 dark:bg-blue-900/30', iconClass: 'text-blue-600 dark:text-blue-400', label: 'DOCX' };
  }
  if (mimeType === DOC_MIME || fileName.toLowerCase().endsWith('.doc')) {
    return { Icon: FileType, bgClass: 'bg-blue-100 dark:bg-blue-900/30', iconClass: 'text-blue-600 dark:text-blue-400', label: 'DOC' };
  }
  if (mimeType === 'text/plain') {
    return { Icon: FileText, bgClass: 'bg-gray-100 dark:bg-gray-800', iconClass: 'text-gray-600 dark:text-gray-300', label: 'TXT' };
  }
  // Fallback
  return { Icon: File, bgClass: 'bg-gray-100 dark:bg-gray-800', iconClass: 'text-gray-500 dark:text-gray-400', label: 'File' };
}

export default function DocumentCard({ doc, isShared, onView, onDelete, onShare, canShare }: DocumentCardProps) {
  const { Icon, bgClass, iconClass, label } = getFileIconMeta(doc.mime_type, doc.file_name);

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors group">
      <div className="flex items-center space-x-3 mb-3 sm:mb-0">
        <div className={`w-10 h-10 rounded-lg ${bgClass} flex items-center justify-center shrink-0`} title={label}>
          <Icon className={`w-5 h-5 ${iconClass}`} />
        </div>
        <div>
          <h4 className="font-medium text-sm text-gray-900 dark:text-white line-clamp-1">{doc.file_name}</h4>
          <div className="flex items-center flex-wrap gap-x-2 gap-y-1 mt-1">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wide">{label}</span>
            <span className="text-xs text-gray-400">·</span>
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
