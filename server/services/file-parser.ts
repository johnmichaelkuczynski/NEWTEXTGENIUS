import mammoth from 'mammoth';
import { pdfToText } from 'pdf-ts';

export class FileParser {
  static async parseFile(file: Buffer, filename: string): Promise<string> {
    if (!file || file.length === 0) {
      throw new Error('File is empty or corrupted');
    }

    const extension = filename.toLowerCase().split('.').pop();
    console.log('Parsing file:', { filename, extension, size: file.length });

    if (!extension) {
      throw new Error('File has no extension. Please use TXT, DOC, DOCX, or PDF files.');
    }

    try {
      switch (extension) {
        case 'txt':
          const text = file.toString('utf-8');
          if (!text || text.trim().length === 0) {
            throw new Error('Text file appears to be empty');
          }
          return text;
        
        case 'pdf':
          console.log('Parsing PDF document...');
          try {
            // Use pdf-ts for reliable text extraction
            const extractedText = await pdfToText(file);
            
            if (!extractedText || extractedText.trim().length === 0) {
              throw new Error('PDF appears to be empty or contains no readable text. This may be a scanned PDF (image-based) which requires OCR processing.');
            }
            
            // Clean up the extracted text - remove excessive whitespace and normalize line breaks
            const processedText = extractedText
              .replace(/\s+/g, ' ') // Replace multiple whitespace with single space
              .replace(/\n\s*\n/g, '\n\n') // Normalize paragraph breaks
              .trim();
            
            console.log(`Successfully parsed PDF: ${processedText.length} characters extracted`);
            return processedText;
          } catch (pdfError) {
            console.error('PDF parsing failed:', pdfError);
            if (pdfError instanceof Error && pdfError.message.includes('Invalid PDF')) {
              throw new Error('Invalid or corrupted PDF file. Please ensure the file is a valid PDF document.');
            }
            if (pdfError instanceof Error && pdfError.message.includes('password')) {
              throw new Error('Password-protected PDF files are not supported. Please remove the password protection and try again.');
            }
            throw new Error(`Failed to extract text from PDF: ${pdfError instanceof Error ? pdfError.message : 'Unknown error'}`);
          }
        
        case 'doc':
        case 'docx':
          console.log('Parsing Word document...');
          const result = await mammoth.extractRawText({ buffer: file });
          if (!result.value || result.value.trim().length === 0) {
            throw new Error('Word document appears to be empty or contains no readable text');
          }
          return result.value;
        
        default:
          throw new Error(`Unsupported file type: .${extension}. Please use TXT, DOC, DOCX, or PDF files.`);
      }
    } catch (error) {
      console.error('File parsing error:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error(`Failed to parse ${extension.toUpperCase()} file: ${error}`);
    }
  }

  static validateFileType(filename: string): boolean {
    const extension = filename.toLowerCase().split('.').pop();
    return ['txt', 'doc', 'docx', 'pdf'].includes(extension || '');
  }

  static validateFileSize(file: Buffer, maxSizeMB: number = 10): boolean {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    return file.length <= maxSizeBytes;
  }

  static validatePDFMimeType(mimeType: string): boolean {
    return mimeType === 'application/pdf';
  }

  static getFileSize(file: Buffer): number {
    return file.length;
  }
}
