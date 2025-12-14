/**
 * DOCUMENT QUALITY ANALYZER
 *
 * Detects document quality issues that may affect analysis accuracy:
 * - Scanned PDFs without text layer
 * - Low text extraction
 * - Image-heavy documents
 * - Corrupted or unreadable files
 */

// ════════════════════════════════════════════════════════════════════════════
// TYPES
// ════════════════════════════════════════════════════════════════════════════

export interface DocumentQualityResult {
  isLowText: boolean;
  isLikelyScanned: boolean;
  textCharacterCount: number;
  estimatedPages: number;
  charsPerPage: number;
  qualityScore: number; // 0-100
  warnings: string[];
  recommendations: string[];
}

export interface DocumentQualityWarning {
  documentId: string;
  documentName: string;
  warning: string;
  severity: 'LOW' | 'MEDIUM' | 'HIGH';
  recommendation: string;
}

// ════════════════════════════════════════════════════════════════════════════
// THRESHOLDS
// ════════════════════════════════════════════════════════════════════════════

const THRESHOLDS = {
  // Minimum characters per page to consider text-extractable
  MIN_CHARS_PER_PAGE: 200,

  // Minimum total characters for a document to be useful
  MIN_TOTAL_CHARS: 500,

  // Characters per page that indicates good text extraction
  GOOD_CHARS_PER_PAGE: 1000,

  // Maximum file size to character ratio indicating image-heavy PDF
  MAX_BYTES_PER_CHAR: 100,

  // Typical pages based on file size (rough estimate for PDFs)
  BYTES_PER_PAGE_ESTIMATE: 50000, // 50KB per page average
};

// ════════════════════════════════════════════════════════════════════════════
// ANALYSIS FUNCTIONS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Analyze document quality based on extracted text and file metadata
 */
export function analyzeDocumentQuality(
  extractedText: string,
  fileSize: number,
  fileName: string,
  mimeType: string
): DocumentQualityResult {
  const warnings: string[] = [];
  const recommendations: string[] = [];

  const textCharacterCount = extractedText.length;
  const estimatedPages = Math.max(1, Math.ceil(fileSize / THRESHOLDS.BYTES_PER_PAGE_ESTIMATE));
  const charsPerPage = Math.round(textCharacterCount / estimatedPages);

  // Check if likely scanned
  const isLikelyScanned = charsPerPage < THRESHOLDS.MIN_CHARS_PER_PAGE;
  const isLowText = textCharacterCount < THRESHOLDS.MIN_TOTAL_CHARS;

  // Calculate quality score
  let qualityScore = 100;

  if (isLowText) {
    qualityScore -= 50;
    warnings.push('Very little text extracted from document');
    recommendations.push('Provide text-based PDF or run OCR on the document');
  }

  if (isLikelyScanned) {
    qualityScore -= 30;
    warnings.push('Document appears to be a scanned image PDF');
    recommendations.push('Request a text-searchable PDF version');
  }

  // Check for image-heavy PDF
  if (fileSize > 0 && textCharacterCount > 0) {
    const bytesPerChar = fileSize / textCharacterCount;
    if (bytesPerChar > THRESHOLDS.MAX_BYTES_PER_CHAR) {
      qualityScore -= 10;
      warnings.push('Document is image-heavy with limited text');
    }
  }

  // Check file type
  if (mimeType.includes('image/')) {
    qualityScore -= 40;
    warnings.push('Document is an image file, not a text document');
    recommendations.push('Convert to PDF with text layer or provide text document');
  }

  // Normalize score
  qualityScore = Math.max(0, Math.min(100, qualityScore));

  return {
    isLowText,
    isLikelyScanned,
    textCharacterCount,
    estimatedPages,
    charsPerPage,
    qualityScore,
    warnings,
    recommendations,
  };
}

/**
 * Analyze quality of snippets retrieved from a document
 */
export function analyzeSnippetQuality(
  snippets: Array<{ text: string; score?: number }>,
  expectedMinSnippets: number = 3
): {
  isLowQuality: boolean;
  snippetCount: number;
  averageLength: number;
  warning: string | null;
} {
  const snippetCount = snippets.length;
  const totalLength = snippets.reduce((sum, s) => sum + s.text.length, 0);
  const averageLength = snippetCount > 0 ? Math.round(totalLength / snippetCount) : 0;

  const isLowQuality = snippetCount < expectedMinSnippets || averageLength < 100;

  let warning: string | null = null;
  if (snippetCount === 0) {
    warning = 'No text snippets could be extracted. Document may be scanned/image-only.';
  } else if (snippetCount < expectedMinSnippets) {
    warning = `Only ${snippetCount} snippet(s) extracted. Document may have limited searchable content.`;
  } else if (averageLength < 100) {
    warning = 'Extracted snippets are very short. Text quality may be poor.';
  }

  return {
    isLowQuality,
    snippetCount,
    averageLength,
    warning,
  };
}

/**
 * Generate quality warnings for all documents in a deal
 */
export function generateDocumentQualityWarnings(
  documents: Array<{
    id: string;
    name: string;
    mimeType: string;
    originalFileSize?: number | null;
    snippetCount?: number | null;
    textExtracted?: boolean;
    lowTextWarning?: boolean;
  }>
): DocumentQualityWarning[] {
  const warnings: DocumentQualityWarning[] = [];

  for (const doc of documents) {
    // Check for low text warning flag
    if (doc.lowTextWarning) {
      warnings.push({
        documentId: doc.id,
        documentName: doc.name,
        warning: 'Low text extraction detected',
        severity: 'HIGH',
        recommendation: 'This document may be scanned. Please provide a text-searchable version or run OCR.',
      });
    }

    // Check for zero snippets
    if (doc.snippetCount === 0) {
      warnings.push({
        documentId: doc.id,
        documentName: doc.name,
        warning: 'No searchable content found',
        severity: 'HIGH',
        recommendation: 'No text could be extracted from this document. It may be an image or corrupted file.',
      });
    }

    // Check for very low snippet count
    if (doc.snippetCount !== null && doc.snippetCount > 0 && doc.snippetCount < 3) {
      warnings.push({
        documentId: doc.id,
        documentName: doc.name,
        warning: 'Limited searchable content',
        severity: 'MEDIUM',
        recommendation: 'Only limited text was extracted. Check if document uploaded correctly.',
      });
    }

    // Check for image files
    if (doc.mimeType.startsWith('image/')) {
      warnings.push({
        documentId: doc.id,
        documentName: doc.name,
        warning: 'Image file uploaded',
        severity: 'MEDIUM',
        recommendation: 'Image files cannot be searched. Please provide a PDF or text document instead.',
      });
    }
  }

  return warnings;
}

/**
 * Check if OCR would benefit the analysis
 */
export function shouldRecommendOCR(
  documents: Array<{ lowTextWarning?: boolean; snippetCount?: number | null }>
): {
  recommend: boolean;
  affectedDocuments: number;
  message: string;
} {
  const lowTextDocs = documents.filter(d => d.lowTextWarning || d.snippetCount === 0);
  const affectedDocuments = lowTextDocs.length;
  const totalDocuments = documents.length;

  if (affectedDocuments === 0) {
    return {
      recommend: false,
      affectedDocuments: 0,
      message: 'All documents have good text extraction.',
    };
  }

  const percentAffected = Math.round((affectedDocuments / totalDocuments) * 100);

  if (percentAffected >= 50) {
    return {
      recommend: true,
      affectedDocuments,
      message: `${affectedDocuments} of ${totalDocuments} documents (${percentAffected}%) have low text extraction. OCR processing is strongly recommended for accurate analysis.`,
    };
  }

  return {
    recommend: true,
    affectedDocuments,
    message: `${affectedDocuments} document(s) may benefit from OCR processing to improve text extraction.`,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// TEXT PATTERN ANALYSIS
// ════════════════════════════════════════════════════════════════════════════

/**
 * Check if text looks like OCR garbage (common with failed OCR)
 */
export function detectOCRGarbage(text: string): boolean {
  // Common patterns in OCR garbage
  const garbagePatterns = [
    /[^\x00-\x7F]{10,}/, // Long sequences of non-ASCII
    /(.)\1{5,}/, // Same character repeated 5+ times
    /\s{10,}/, // Long sequences of whitespace
    /[^a-zA-Z0-9\s.,;:!?'"()-]{20,}/, // Long sequences without common chars
  ];

  for (const pattern of garbagePatterns) {
    if (pattern.test(text)) {
      return true;
    }
  }

  // Check character distribution
  const alphaNumericRatio = (text.match(/[a-zA-Z0-9]/g) || []).length / text.length;
  if (alphaNumericRatio < 0.5 && text.length > 100) {
    return true;
  }

  return false;
}

/**
 * Estimate document language from text sample
 */
export function detectLanguage(text: string): 'en' | 'de' | 'fr' | 'es' | 'it' | 'nl' | 'unknown' {
  const sample = text.toLowerCase().slice(0, 5000);

  const languagePatterns: Record<string, RegExp[]> = {
    en: [/\bthe\b/g, /\band\b/g, /\bof\b/g, /\bto\b/g, /\bis\b/g],
    de: [/\bund\b/g, /\bdie\b/g, /\bder\b/g, /\bdas\b/g, /\bist\b/g],
    fr: [/\ble\b/g, /\bla\b/g, /\bet\b/g, /\bde\b/g, /\best\b/g],
    es: [/\bel\b/g, /\bla\b/g, /\by\b/g, /\bde\b/g, /\bes\b/g],
    it: [/\bil\b/g, /\bla\b/g, /\be\b/g, /\bdi\b/g, /\bè\b/g],
    nl: [/\bde\b/g, /\ben\b/g, /\bvan\b/g, /\bhet\b/g, /\bis\b/g],
  };

  const scores: Record<string, number> = {};

  for (const [lang, patterns] of Object.entries(languagePatterns)) {
    scores[lang] = 0;
    for (const pattern of patterns) {
      const matches = sample.match(pattern);
      if (matches) {
        scores[lang] += matches.length;
      }
    }
  }

  const maxScore = Math.max(...Object.values(scores));
  if (maxScore < 10) return 'unknown';

  const detected = Object.entries(scores).find(([, score]) => score === maxScore);
  return (detected?.[0] as any) || 'unknown';
}
