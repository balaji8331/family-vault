import Tesseract from 'tesseract.js';

interface OCRResult {
  extracted_name: string | null;
  extracted_doc_number: string | null;
  expiry_date: string | null;
}

export async function extractDocumentMetadata(
  file: File,
  docType: string,
  onProgress?: (progress: number) => void
): Promise<OCRResult> {
  const result: OCRResult = {
    extracted_name: null,
    extracted_doc_number: null,
    expiry_date: null,
  };

  try {
    let imageUrl: string | null = null;

    if (file.type.startsWith('image/')) {
      imageUrl = URL.createObjectURL(file);
    } else if (file.type === 'application/pdf') {
      // Note: pdf-lib does not support rasterizing PDFs to images for OCR.
      // Full PDF text extraction/rendering would require pdfjs-dist.
      // Skipping OCR for PDFs on the client-side to prevent crashes.
      console.warn("Client-side OCR for PDFs requires pdfjs-dist. Skipping OCR.");
      return result;
    }

    if (!imageUrl) return result;

    let worker;
    try {
      worker = await Tesseract.createWorker({
        logger: (m) => {
          if (m.status === 'recognizing text' && onProgress) {
            onProgress(Math.round(m.progress * 100));
          }
        },
      });

      await worker.loadLanguage('eng');
      await worker.initialize('eng');
      
      const { data: { text } } = await worker.recognize(imageUrl);
      
      // Parse the raw text
      const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);
      const joinedText = lines.join(' ');
      
      // 1. Extract Name
      // Look for lines that might be names (very basic heuristic)
      // Often names are near the top or after "Name:" or "नाम"
      const nameMatch = joinedText.match(/(?:Name|नाम)\s*[:\-]?\s*([A-Z\s]{3,40})/i);
      if (nameMatch && nameMatch[1]) {
        result.extracted_name = nameMatch[1].trim();
      }

      // 2. Extract Document Number based on type
      const normalizedType = docType.toLowerCase();
      
      if (normalizedType.includes('aadhar')) {
        // 12 digits, possibly with spaces
        const aadharMatch = joinedText.match(/\b\d{4}\s?\d{4}\s?\d{4}\b/);
        if (aadharMatch) result.extracted_doc_number = aadharMatch[0].replace(/\s/g, '');
      } else if (normalizedType.includes('pan')) {
        // 5 letters, 4 numbers, 1 letter
        const panMatch = joinedText.match(/\b[A-Z]{5}[0-9]{4}[A-Z]{1}\b/i);
        if (panMatch) result.extracted_doc_number = panMatch[0].toUpperCase();
      } else if (normalizedType.includes('passport')) {
        // 1 letter, 7 numbers
        const passportMatch = joinedText.match(/\b[A-PR-WYa-pr-wy][1-9]\d\s?\d{4}[1-9]\b/i);
        if (passportMatch) result.extracted_doc_number = passportMatch[0].replace(/\s/g, '').toUpperCase();
      }

      // 3. Extract Expiry Date (DD/MM/YYYY or MM/YYYY)
      const dateMatch = joinedText.match(/\b(\d{2}\/\d{2}\/\d{4})\b/);
      if (dateMatch) {
        // Usually multiple dates exist (DOB, Issue Date, Expiry). 
        // We just grab the last valid looking date as a simple heuristic for expiry.
        const allDates = [...joinedText.matchAll(/\b(\d{2}\/\d{2}\/\d{4})\b/g)];
        if (allDates.length > 0) {
          // Assume the last date is expiry if there are multiple
          const lastDate = allDates[allDates.length - 1][1];
          // Convert DD/MM/YYYY to YYYY-MM-DD for database
          const [day, month, year] = lastDate.split('/');
          result.expiry_date = `${year}-${month}-${day}`;
        }
      }

    } finally {
      if (worker) await worker.terminate();
      URL.revokeObjectURL(imageUrl);
    }

    return result;
  } catch (error) {
    console.error('OCR Extraction failed:', error);
    return result; // Never throw, always return object
  }
}
