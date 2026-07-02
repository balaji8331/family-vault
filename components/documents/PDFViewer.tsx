'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as pdfjsLib from 'pdfjs-dist';

/**
 * Use the locally bundled worker so no CDN request is needed.
 * The file is copied from node_modules/pdfjs-dist/build/pdf.worker.min.mjs
 * to public/pdf.worker.min.mjs at install time.
 * This completely bypasses Chrome's plugin-based PDF viewer and the CSP
 * chrome-extension:// navigation that caused "blocked by Chrome" errors.
 */
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs';

interface PDFViewerProps {
  /** The decrypted PDF bytes */
  pdfData: Uint8Array;
}

/**
 * PDFViewer — renders a PDF file entirely as HTML canvas elements using PDF.js.
 *
 * Why not <iframe> / <embed>?
 * Chrome's built-in PDF viewer internally navigates to chrome-extension://
 * (the PDF viewer extension). That URL is not in our CSP frame-src / object-src,
 * so Chrome blocks it. PDF.js renders each page to a <canvas> natively in JS —
 * no browser plugins, no extension navigation, no CSP conflict.
 */
export default function PDFViewer({ pdfData }: PDFViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [numPages,     setNumPages]    = useState(0);
  const [currentPage,  setCurrentPage] = useState(1);
  const [scale,        setScale]       = useState(1.5);
  const [loading,      setLoading]     = useState(true);
  const [error,        setError]       = useState<string | null>(null);
  const pdfRef = useRef<pdfjsLib.PDFDocumentProxy | null>(null);
  const renderTaskRef = useRef<pdfjsLib.RenderTask | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Load the PDF document from the blob URL
  useEffect(() => {
    let cancelled = false;

    async function loadPDF() {
      if (!pdfData || pdfData.length === 0) return;
      
      setLoading(true);
      setError(null);
      try {
        // Pass as a fresh Uint8Array to guarantee pdfjs-dist's internal byteLength checks pass
        const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(pdfData) });
        const pdf = await loadingTask.promise;
        if (cancelled) return;
        pdfRef.current = pdf;
        setNumPages(pdf.numPages);
        setCurrentPage(1);
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load PDF');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadPDF();
    return () => { cancelled = true; };
  }, [pdfData]);

  // Render the current page whenever page number or scale changes
  const renderPage = useCallback(async () => {
    const pdf = pdfRef.current;
    const canvas = canvasRef.current;
    if (!pdf || !canvas) return;

    // Cancel any in-progress render
    if (renderTaskRef.current) {
      renderTaskRef.current.cancel();
    }

    try {
      const page = await pdf.getPage(currentPage);
      const viewport = page.getViewport({ scale });
      const ctx = canvas.getContext('2d')!;

      // Size the canvas to the viewport
      canvas.width  = viewport.width;
      canvas.height = viewport.height;
      canvas.style.width  = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;

      const renderTask = page.render({ canvasContext: ctx, viewport });
      renderTaskRef.current = renderTask;
      await renderTask.promise;
    } catch (err: any) {
      if (err?.name !== 'RenderingCancelledException') {
        console.error('PDF page render error:', err);
      }
    }
  }, [currentPage, scale]);

  useEffect(() => {
    if (!loading && !error && numPages > 0) {
      renderPage();
    }
  }, [loading, error, numPages, renderPage]);

  const goToPrev = () => setCurrentPage(p => Math.max(1, p - 1));
  const goToNext = () => setCurrentPage(p => Math.min(numPages, p + 1));
  const zoomIn   = () => setScale(s => Math.min(3, +(s + 0.25).toFixed(2)));
  const zoomOut  = () => setScale(s => Math.max(0.5, +(s - 0.25).toFixed(2)));
  const resetZoom = () => setScale(1.5);

  if (loading) {
    return (
      <div className="w-full h-[600px] flex flex-col items-center justify-center gap-4">
        <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <p className="text-sm text-gray-500 dark:text-gray-400">Rendering PDF…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="w-full h-[400px] flex flex-col items-center justify-center gap-3 text-center p-8">
        <p className="text-sm text-red-500">{error}</p>
      </div>
    );
  }

  return (
    <div className="w-full flex flex-col gap-0 rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 shadow-sm">
      {/* ── Toolbar ─────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex-wrap gap-2">
        {/* Page navigation */}
        <div className="flex items-center gap-2">
          <button
            onClick={goToPrev}
            disabled={currentPage <= 1}
            className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Previous page"
          >
            <svg className="w-4 h-4 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300 tabular-nums select-none">
            {currentPage} / {numPages}
          </span>
          <button
            onClick={goToNext}
            disabled={currentPage >= numPages}
            className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Next page"
          >
            <svg className="w-4 h-4 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Zoom controls */}
        <div className="flex items-center gap-1">
          <button
            onClick={zoomOut}
            disabled={scale <= 0.5}
            className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Zoom out"
          >
            <svg className="w-4 h-4 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
            </svg>
          </button>
          <button
            onClick={resetZoom}
            className="px-2 py-1 text-xs font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors tabular-nums min-w-[3rem] text-center"
            title="Reset zoom"
          >
            {Math.round(scale * 100)}%
          </button>
          <button
            onClick={zoomIn}
            disabled={scale >= 3}
            className="p-1.5 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Zoom in"
          >
            <svg className="w-4 h-4 text-gray-600 dark:text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Canvas area ─────────────────────────────────────────────── */}
      <div
        ref={containerRef}
        className="overflow-auto bg-gray-200 dark:bg-gray-900 flex items-start justify-center p-4"
        style={{ maxHeight: '760px' }}
      >
        <canvas
          ref={canvasRef}
          className="shadow-lg rounded"
          style={{ display: 'block', background: 'white' }}
        />
      </div>
    </div>
  );
}
