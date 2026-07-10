import Tesseract from 'tesseract.js';
import mammoth from 'mammoth';

interface OCRResult {
  extracted_name: string | null;
  extracted_doc_number: string | null;
  expiry_date: string | null;
}

/** MIME types that carry structured identity text we can attempt to parse. */
const IDENTITY_DOC_TYPES = ['aadhar', 'pan', 'passport', 'driving_license', 'voter_id'];

/**
 * Runs the shared regex extractors against a block of plain text.
 * Used by both the TXT and DOCX branches to avoid code duplication.
 */
function extractFromText(text: string, docType: string): OCRResult {
  const result: OCRResult = {
    extracted_name: null,
    extracted_doc_number: null,
    expiry_date: null,
  };

  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const joinedText = lines.join(' ');

  // 1. Extract Name
  const nameMatch = joinedText.match(/(?:Name|नाम)\s*[:\-]?\s*([A-Z\s]{3,40})/i);
  if (nameMatch?.[1]) {
    result.extracted_name = nameMatch[1].trim();
  }

  // 2. Extract Document Number based on type
  const normalizedType = docType.toLowerCase();

  if (normalizedType.includes('aadhar')) {
    const m = joinedText.match(/\b\d{4}\s?\d{4}\s?\d{4}\b/);
    if (m) result.extracted_doc_number = m[0].replace(/\s/g, '');
  } else if (normalizedType.includes('pan')) {
    const m = joinedText.match(/\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b/i);
    if (m) result.extracted_doc_number = m[0].toUpperCase();
  } else if (normalizedType.includes('passport')) {
    const m = joinedText.match(/\b[A-PR-WYa-pr-wy][1-9]\d\s?\d{4}[1-9]\b/i);
    if (m) result.extracted_doc_number = m[0].replace(/\s/g, '').toUpperCase();
  }

  // 3. Extract Expiry Date (DD/MM/YYYY)
  const allDates = [...joinedText.matchAll(/\b(\d{2}\/\d{2}\/\d{4})\b/g)];
  if (allDates.length > 0) {
    const lastDate = allDates[allDates.length - 1][1];
    const [day, month, year] = lastDate.split('/');
    result.expiry_date = `${year}-${month}-${day}`;
  }

  return result;
}

/**
 * Extracts document metadata from a file using OCR (images), direct text
 * decoding (TXT), or mammoth text extraction (DOCX).
 *
 * Never throws — always returns an OCRResult (fields may be null).
 *
 * @param file         The file to extract metadata from.
 * @param docType      The user-selected document type slug (e.g. 'aadhar').
 * @param onProgress   Optional callback receiving 0–100 progress (images only).
 */
export async function extractDocumentMetadata(
  file: File,
  docType: string,
  onProgress?: (progress: number) => void
): Promise<OCRResult> {
  const emptyResult: OCRResult = {
    extracted_name: null,
    extracted_doc_number: null,
    expiry_date: null,
  };

  try {
    // ── Branch 1: Plain text ──────────────────────────────────────────────
    if (file.type === 'text/plain') {
      if (onProgress) onProgress(50);
      const raw = await file.text();
      if (onProgress) onProgress(100);
      return extractFromText(raw, docType);
    }

    // ── Branch 2: DOCX ───────────────────────────────────────────────────
    if (
      file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
      file.name.toLowerCase().endsWith('.docx')
    ) {
      if (onProgress) onProgress(30);
      const arrayBuffer = await file.arrayBuffer();
      if (onProgress) onProgress(60);
      // mammoth extracts raw paragraphs as plain text — no HTML overhead needed for OCR
      const { value: rawText } = await mammoth.extractRawText({ arrayBuffer });
      if (onProgress) onProgress(100);
      // Only attempt extraction for identity-style doc types
      const isIdentityDoc = IDENTITY_DOC_TYPES.some(t => docType.toLowerCase().includes(t));
      if (!isIdentityDoc) return emptyResult;
      return extractFromText(rawText, docType);
    }

    // ── Branch 3: PDF ────────────────────────────────────────────────────
    if (file.type === 'application/pdf') {
      // Full PDF rasterisation for OCR requires pdfjs-dist (heavy WASM).
      // We skip it to prevent crashes and keep the bundle lean.
      console.warn('Client-side OCR for PDFs requires pdfjs-dist. Skipping OCR.');
      return emptyResult;
    }

    // ── Branch 4: Images (Tesseract) ─────────────────────────────────────
    if (file.type.startsWith('image/')) {
      const imageUrl = URL.createObjectURL(file);
      let worker;
      try {
        // tesseract.js v7: createWorker(langs, oem, options) loads + initializes the
        // language in one call. The separate loadLanguage()/initialize() steps were
        // removed in v5+, and the logger now lives in the options (3rd) argument.
        worker = await Tesseract.createWorker('eng', undefined, {
          logger: (m: { status: string; progress: number }) => {
            if (m.status === 'recognizing text' && onProgress) {
              onProgress(Math.round(m.progress * 100));
            }
          },
        });

        const { data: { text } } = await worker.recognize(imageUrl);
        return extractFromText(text, docType);
      } finally {
        if (worker) await worker.terminate();
        URL.revokeObjectURL(imageUrl);
      }
    }

    // Unsupported type — return empty gracefully
    return emptyResult;

  } catch (error) {
    console.error('OCR Extraction failed:', error);
    return emptyResult; // Never throw — always return object
  }
}
