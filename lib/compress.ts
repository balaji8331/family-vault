import imageCompression from 'browser-image-compression';
import { PDFDocument } from 'pdf-lib';

/** MIME types we actively compress. Everything else passes through unchanged. */
const COMPRESSIBLE_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Compresses an image file in the browser before encryption.
 * Unsupported image types are passed through unchanged.
 *
 * @param file The image File to compress.
 * @returns A promise that resolves to the compressed (or original) File.
 */
export async function compressImage(file: File): Promise<File> {
  if (!COMPRESSIBLE_IMAGE_TYPES.includes(file.type)) {
    return file;
  }

  const options = {
    maxSizeMB: 0.3,
    maxWidthOrHeight: 1920,
    useWebWorker: true,
  };

  try {
    const compressedBlob = await imageCompression(file, options);
    return new File([compressedBlob], file.name, {
      type: file.type,
      lastModified: Date.now(),
    });
  } catch (error) {
    console.error('Image compression failed:', error);
    return file; // Fallback to original
  }
}

/**
 * Compresses a PDF file in the browser before encryption.
 * Re-saving with pdf-lib strips unused object streams and metadata,
 * producing a marginally smaller file. Heavy image-based PDFs won't
 * shrink significantly — that requires a server-side pipeline.
 *
 * @param file The PDF File to compress.
 * @returns A promise that resolves to the re-saved (or original) File.
 */
export async function compressPDF(file: File): Promise<File> {
  if (file.type !== 'application/pdf') return file;

  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);

    const compressedBytes = await pdfDoc.save({ useObjectStreams: false });

    // pdf-lib returns Uint8Array<ArrayBufferLike>; it is a valid BlobPart at runtime.
    return new File([compressedBytes as BlobPart], file.name, {
      type: 'application/pdf',
      lastModified: Date.now(),
    });
  } catch (error) {
    console.error('PDF compression failed:', error);
    return file; // Fallback to original
  }
}

/**
 * Pass-through for DOCX files.
 *
 * DOCX is already a ZIP archive internally. Re-compressing it in-browser
 * without a WASM deflate pipeline yields negligible savings and risks
 * corrupting the internal XML structure. The file is passed directly to
 * the AES-GCM encryption step unchanged.
 *
 * @param file The DOCX File.
 * @returns The same File unchanged.
 */
export async function compressDOCX(file: File): Promise<File> {
  // Intentional no-op — DOCX is already ZIP-compressed.
  return file;
}

/**
 * Pass-through for plain-text files.
 *
 * TXT files are typically small enough that compression overhead
 * outweighs the benefit. Passed directly to the encryption step.
 *
 * @param file The TXT File.
 * @returns The same File unchanged.
 */
export async function compressTXT(file: File): Promise<File> {
  // Intentional no-op — text files are already tiny.
  return file;
}
