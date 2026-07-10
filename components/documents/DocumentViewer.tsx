'use client';

import React, { useEffect, useRef, useState } from 'react';
import mammoth from 'mammoth';
import PDFViewer from './PDFViewer';
import { supabase } from '@/lib/supabase/client';
import { useVaultStore } from '@/store/vault.store';
import { unwrapKey, decryptFile } from '@/lib/crypto';
import { logAuditEvent } from '@/lib/audit';
import DecryptProgress, { DecryptStatus } from './DecryptProgress';

/**
 * Helper to convert a Base64 string back to an ArrayBuffer.
 * Used for preparing the wrapped key and IV for WebCrypto decryption.
 */
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binary_string = window.atob(base64);
  const len = binary_string.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binary_string.charCodeAt(i);
  }
  return bytes.buffer;
}

interface DocumentRecord {
  id: string;
  owner_id: string;
  family_id: string;
  file_name: string;
  file_path: string;
  mime_type: string;
  iv: string;
  doc_type: string;
  expiry_date: string | null;
  uploaded_at: string;
  file_size_bytes: number;
  extracted_name?: string | null;
  extracted_doc_number?: string | null;
}

interface DocumentViewerProps {
  documentId: string;
  onDocumentLoaded?: (doc: DocumentRecord) => void;
}

const DOCX_MIME = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const DOC_MIME  = 'application/msword';

/** Shared download button rendered alongside every viewer type */
function DownloadButton({ blobUrl, fileName }: { blobUrl: string; fileName: string }) {
  return (
    <a
      href={blobUrl}
      download={fileName}
      className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/20 dark:text-blue-400 dark:hover:bg-blue-900/40 rounded-lg transition-colors border border-blue-200 dark:border-blue-800"
      title={`Download ${fileName}`}
    >
      <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
          d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
      </svg>
      Download
    </a>
  );
}

/**
 * DocumentViewer Client Component
 *
 * Handles the complete secure viewing lifecycle for a document:
 * 1. Fetches metadata and access lists
 * 2. Unwraps the AES-GCM key using the user's masterKey or familyKey
 * 3. Downloads the encrypted file blob via a Supabase signed URL
 * 4. Decrypts the file locally in memory using WebCrypto (AES-256-GCM)
 * 5. Renders the decrypted content using the appropriate strategy:
 *    - Images  → <img> tag  + download button
 *    - PDF     → unsandboxed <iframe> (blob: is same-origin, safe) + download button
 *    - DOCX    → mammoth → HTML → sandboxed <iframe srcdoc> + download button
 *    - TXT     → TextDecoder → styled <pre> + download button
 *    - .doc    → download-only button (legacy binary, not renderable in-browser)
 *    - unknown → download-only button
 *
 * NOTE on PDF sandbox: Chrome's built-in PDF viewer (Chrome 105+) is no longer a
 * plugin — it is a Chromium component that navigates internally, opens popup helpers,
 * and submits forms. Any sandbox attribute that restricts those capabilities results
 * in a blank/broken viewer. Since the iframe source is always a blob: URL we created
 * ourselves from the already-decrypted buffer, removing sandbox here is safe.
 */
export default function DocumentViewer({ documentId, onDocumentLoaded }: DocumentViewerProps) {
  const currentUser = useVaultStore((state) => state.currentUser);
  const masterKey   = useVaultStore((state) => state.masterKey);
  const familyKey   = useVaultStore((state) => state.familyKey);

  const [documentMeta, setDocumentMeta] = useState<DocumentRecord | null>(null);
  const [blobUrl,      setBlobUrl]      = useState<string | null>(null);
  const [pdfBuffer,    setPdfBuffer]    = useState<ArrayBuffer | null>(null);
  const [textContent,  setTextContent]  = useState<string | null>(null);
  const [docxHtml,     setDocxHtml]     = useState<string | null>(null);
  // We always keep a blob URL even for DOCX/TXT so the download button works.
  const [downloadUrl,  setDownloadUrl]  = useState<string | null>(null);
  const [status,       setStatus]       = useState<DecryptStatus>('fetching');
  const [errorMsg,     setErrorMsg]     = useState<string | null>(null);

  // Ref tracks ALL active blob URLs for safe cleanup regardless of async timing.
  const blobUrlsRef = useRef<string[]>([]);

  /** Registers a new blob URL and returns it, tracking it for cleanup */
  function trackBlobUrl(url: string): string {
    blobUrlsRef.current.push(url);
    return url;
  }

  const executeDecryption = async () => {
    // Revoke all previously created blob URLs before starting fresh
    blobUrlsRef.current.forEach(u => URL.revokeObjectURL(u));
    blobUrlsRef.current = [];

    setBlobUrl(null);
    setPdfBuffer(null);
    setTextContent(null);
    setDocxHtml(null);
    setDownloadUrl(null);

    if (!documentId) return;

    if (!currentUser || !masterKey) {
      setStatus('error');
      setErrorMsg('Vault is locked. Please re-authenticate.');
      return;
    }

    try {
      setStatus('fetching');
      setErrorMsg(null);

      // 1. Fetch document record
      const { data: doc, error: docError } = await supabase
        .from('documents')
        .select('*')
        .eq('id', documentId)
        .single();

      if (docError || !doc) throw new Error('Document not found or access denied.');

      setDocumentMeta(doc);
      if (onDocumentLoaded) onDocumentLoaded(doc);

      // 2. Fetch wrapped key from document_access
      let accessData = null;
      let unwrappingKey = masterKey;

      if (doc.owner_id === currentUser.id) {
        const { data: personalAccess } = await supabase
          .from('document_access')
          .select('wrapped_key')
          .eq('document_id', documentId)
          .eq('granted_to', currentUser.id)
          .maybeSingle();

        if (personalAccess) {
          accessData    = personalAccess;
          unwrappingKey = masterKey;
        }
      } else {
        // Shared document — key was wrapped with the family key (or master key fallback)
        const { data: familyAccess } = await supabase
          .from('document_access')
          .select('wrapped_key')
          .eq('document_id', documentId)
          .eq('granted_to', currentUser.id)
          .maybeSingle();

        if (familyAccess) {
          accessData    = familyAccess;
          unwrappingKey = familyKey || masterKey;
        }
      }

      if (!accessData) {
        throw new Error('Encryption key not found. You may not have access.');
      }

      setStatus('decrypting');

      // 3. Unwrap document key (AES-GCM unwrapKey — IV prepended to wrapped key)
      const wrappedKeyBuffer = base64ToArrayBuffer(accessData.wrapped_key);
      let docKey: CryptoKey;
      try {
        docKey = await unwrapKey(wrappedKeyBuffer, unwrappingKey);
      } catch (unwrapErr) {
        console.error('Unwrap failed:', unwrapErr);
        throw new Error('Decryption failed. Your key does not match this document.');
      }

      // 4. Fetch encrypted file via Signed URL (30-min expiry)
      const { data: signedData, error: signedError } = await supabase.storage
        .from('documents')
        .createSignedUrl(doc.file_path, 1800);

      if (signedError || !signedData?.signedUrl) throw new Error('Failed to retrieve file securely.');

      const response = await fetch(signedData.signedUrl);
      if (response.status === 400 || response.status === 403) {
        throw new Error('Session expired. Please refresh.');
      }
      if (!response.ok) throw new Error('Failed to download encrypted file.');

      const encryptedArrayBuffer = await response.arrayBuffer();

      // 5. Decrypt locally — AES-256-GCM — server never saw the plaintext
      const ivBuffer        = base64ToArrayBuffer(doc.iv);
      const decryptedBuffer = await decryptFile(encryptedArrayBuffer, new Uint8Array(ivBuffer), docKey);

      setStatus('rendering');

      const mime = doc.mime_type;

      // Always create a download blob URL in the original MIME type so the
      // "Download" button restores the file to its exact pre-upload format.
      const downloadBlob = new Blob([decryptedBuffer], { type: mime });
      const dlUrl = trackBlobUrl(URL.createObjectURL(downloadBlob));
      setDownloadUrl(dlUrl);

      if (mime.startsWith('image/')) {
        // Images — blob URL → <img>
        const blob = new Blob([decryptedBuffer], { type: mime });
        setBlobUrl(trackBlobUrl(URL.createObjectURL(blob)));

      } else if (mime === 'application/pdf') {
        // PDFs — pass the raw ArrayBuffer to PDFViewer to avoid blob: URL fetch errors
        setPdfBuffer(decryptedBuffer);

      } else if (mime === DOCX_MIME || doc.file_name.toLowerCase().endsWith('.docx')) {
        // DOCX — mammoth converts to styled HTML entirely in-browser
        const { value: html } = await mammoth.convertToHtml({ arrayBuffer: decryptedBuffer });
        setDocxHtml(html);

      } else if (mime === 'text/plain') {
        // TXT — decode bytes to string
        const text = new TextDecoder('utf-8').decode(decryptedBuffer);
        setTextContent(text);

      } else {
        // Legacy .doc or unknown — download-only; no in-browser renderer
        const blob = new Blob([decryptedBuffer], { type: mime });
        setBlobUrl(trackBlobUrl(URL.createObjectURL(blob)));
      }

      setStatus('ready');

      // Log view event
      await logAuditEvent('view', 'document', documentId);

    } catch (err: any) {
      console.error(err);
      setStatus('error');
      setErrorMsg(err.message || 'An unexpected error occurred while decrypting the document.');
    }
  };

  useEffect(() => {
    executeDecryption();

    return () => {
      // Revoke all tracked blob URLs on unmount — ref is always up-to-date
      blobUrlsRef.current.forEach(u => URL.revokeObjectURL(u));
      blobUrlsRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, currentUser?.id, masterKey, familyKey]);

  if (status !== 'ready') {
    return <DecryptProgress status={status} errorMsg={errorMsg} onRetry={executeDecryption} />;
  }

  if (!documentMeta) {
    return <DecryptProgress status="error" errorMsg="Failed to render document." />;
  }

  const mime = documentMeta.mime_type;
  const fileName = documentMeta.file_name;

  // ── Render: Image ──────────────────────────────────────────────────────────
  if (mime.startsWith('image/') && blobUrl) {
    return (
      <div className="w-full h-full flex flex-col items-center gap-3 overflow-auto rounded-xl p-4">
        <div className="self-end">
          {downloadUrl && <DownloadButton blobUrl={downloadUrl} fileName={fileName} />}
        </div>
        <img
          src={blobUrl}
          alt={fileName}
          className="max-w-full max-h-[760px] object-contain rounded shadow-sm"
        />
      </div>
    );
  }

  // ── Render: PDF (PDF.js canvas) ──────────────────────────────────────────
  if (mime === 'application/pdf' && pdfBuffer) {
    return (
      <div className="w-full h-full flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs text-gray-400 dark:text-gray-500">{fileName}</span>
          {downloadUrl && <DownloadButton blobUrl={downloadUrl} fileName={fileName} />}
        </div>
        {/*
          PDFViewer renders each page to an HTML <canvas> via PDF.js.
          No iframe, no embed, no chrome-extension:// navigation, no CSP conflict.
        */}
        <PDFViewer pdfData={new Uint8Array(pdfBuffer)} />
      </div>
    );
  }

  // ── Render: DOCX (mammoth → HTML) ──────────────────────────────────────────
  if ((mime === DOCX_MIME || fileName.toLowerCase().endsWith('.docx')) && docxHtml !== null) {
    const srcdoc = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8"/>
<style>
  body { font-family: Georgia, serif; font-size: 14px; line-height: 1.7;
         color: #1a1a1a; padding: 2rem 3rem; max-width: 860px; margin: 0 auto; }
  h1,h2,h3,h4,h5,h6 { font-family: system-ui, sans-serif; font-weight: 700; margin-top: 1.5em; }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; }
  td, th { border: 1px solid #d1d5db; padding: 0.5em 0.75em; }
  th { background: #f3f4f6; }
  img { max-width: 100%; height: auto; }
  p { margin: 0.6em 0; }
</style>
</head>
<body>${docxHtml}</body>
</html>`;

    return (
      <div className="w-full h-full flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs text-gray-400 dark:text-gray-500">{fileName}</span>
          {downloadUrl && <DownloadButton blobUrl={downloadUrl} fileName={fileName} />}
        </div>
        <iframe
          srcDoc={srcdoc}
          sandbox="allow-same-origin"
          className="w-full h-[800px] rounded shadow-sm bg-white border border-gray-200 dark:border-gray-700"
          title="DOCX Viewer"
        />
      </div>
    );
  }

  // ── Render: Plain Text ─────────────────────────────────────────────────────
  if (mime === 'text/plain' && textContent !== null) {
    return (
      <div className="w-full h-full flex flex-col gap-2">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs text-gray-400 dark:text-gray-500">{fileName}</span>
          {downloadUrl && <DownloadButton blobUrl={downloadUrl} fileName={fileName} />}
        </div>
        <div className="overflow-auto rounded-xl bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-700 flex-1">
          <pre className="p-6 text-sm font-mono text-gray-800 dark:text-gray-200 whitespace-pre-wrap break-words leading-relaxed">
            {textContent}
          </pre>
        </div>
      </div>
    );
  }

  // ── Render: Legacy .doc / Unknown — Download Only ──────────────────────────
  if (blobUrl) {
    const isLegacyDoc = mime === DOC_MIME || fileName.toLowerCase().endsWith('.doc');
    return (
      <div className="w-full h-full flex flex-col items-center justify-center gap-6 text-center p-8">
        <div className="w-20 h-20 rounded-2xl bg-blue-50 dark:bg-blue-900/30 text-blue-500 flex items-center justify-center">
          <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <div>
          <p className="text-base font-semibold text-gray-800 dark:text-white mb-1">
            {isLegacyDoc
              ? 'Legacy .doc format cannot be previewed in-browser'
              : 'Preview not available for this file type'}
          </p>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {isLegacyDoc
              ? 'Download the file and open it in Microsoft Word or LibreOffice.'
              : 'Download the file to view it on your device.'}
          </p>
        </div>
        <a
          href={downloadUrl ?? blobUrl}
          download={fileName}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-sm transition-colors inline-flex items-center gap-2"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download {fileName}
        </a>
      </div>
    );
  }

  return <DecryptProgress status="error" errorMsg="Failed to render document." />;
}
