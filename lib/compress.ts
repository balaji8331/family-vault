import imageCompression from 'browser-image-compression';
import { PDFDocument } from 'pdf-lib';

/**
 * Compresses an image file in the browser before encryption.
 */
export async function compressImage(file: File): Promise<File> {
  // Only compress supported image types
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
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
 * Note: pdf-lib doesn't aggressively compress internal images, 
 * but resaving it strips some unneeded metadata and object streams.
 */
export async function compressPDF(file: File): Promise<File> {
  if (file.type !== 'application/pdf') return file;
  
  try {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    
    const compressedBytes = await pdfDoc.save({ useObjectStreams: false });
    
    return new File([compressedBytes], file.name, {
      type: 'application/pdf',
      lastModified: Date.now(),
    });
  } catch (error) {
    console.error('PDF compression failed:', error);
    return file; // Fallback to original
  }
}
