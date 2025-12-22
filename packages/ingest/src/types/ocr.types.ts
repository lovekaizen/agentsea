/**
 * OCR Types
 *
 * Type definitions for optical character recognition.
 */

import type { BoundingBox } from './document.types.js';

/**
 * OCR engine types
 */
export type OCREngineType =
  | 'tesseract'
  | 'google_vision'
  | 'aws_textract'
  | 'azure_vision'
  | 'custom';

/**
 * OCR configuration
 */
export interface OCRConfig {
  /** OCR engine to use */
  engine: OCREngineType;
  /** Languages to detect */
  languages?: string[];
  /** Page segmentation mode */
  pageSegMode?: PageSegmentationMode;
  /** Engine-specific configuration */
  engineConfig?: Record<string, unknown>;
  /** Preprocessing options */
  preprocessing?: OCRPreprocessingOptions;
  /** Confidence threshold (0-1) */
  confidenceThreshold?: number;
}

/**
 * Page segmentation modes
 */
export type PageSegmentationMode =
  | 'auto'
  | 'single_block'
  | 'single_column'
  | 'single_line'
  | 'single_word'
  | 'single_char'
  | 'sparse_text';

/**
 * OCR preprocessing options
 */
export interface OCRPreprocessingOptions {
  /** Apply deskew correction */
  deskew?: boolean;
  /** Apply denoising */
  denoise?: boolean;
  /** Apply binarization */
  binarize?: boolean;
  /** Binarization threshold (0-255) */
  binarizeThreshold?: number;
  /** Scale factor for image */
  scale?: number;
  /** Apply contrast enhancement */
  enhanceContrast?: boolean;
  /** Remove borders */
  removeBorders?: boolean;
}

/**
 * OCR result
 */
export interface OCRResult {
  /** Extracted text */
  text: string;
  /** Overall confidence (0-1) */
  confidence: number;
  /** Detected language */
  language?: string;
  /** Text blocks */
  blocks?: OCRBlock[];
  /** Processing time (ms) */
  processingTime: number;
  /** Engine used */
  engine: OCREngineType;
}

/**
 * OCR text block
 */
export interface OCRBlock {
  /** Block type */
  type: OCRBlockType;
  /** Block text */
  text: string;
  /** Block confidence (0-1) */
  confidence: number;
  /** Bounding box */
  bbox: BoundingBox;
  /** Child elements */
  children?: OCRElement[];
}

/**
 * OCR block types
 */
export type OCRBlockType =
  | 'paragraph'
  | 'line'
  | 'word'
  | 'table'
  | 'figure'
  | 'unknown';

/**
 * OCR element (word/character level)
 */
export interface OCRElement {
  /** Element type */
  type: 'line' | 'word' | 'character';
  /** Element text */
  text: string;
  /** Element confidence (0-1) */
  confidence: number;
  /** Bounding box */
  bbox: BoundingBox;
  /** Font information */
  font?: OCRFontInfo;
}

/**
 * OCR font information
 */
export interface OCRFontInfo {
  /** Font name */
  name?: string;
  /** Font size (points) */
  size?: number;
  /** Is bold */
  bold?: boolean;
  /** Is italic */
  italic?: boolean;
  /** Is underlined */
  underline?: boolean;
  /** Is monospace */
  monospace?: boolean;
}

/**
 * OCR engine interface
 */
export interface OCREngine {
  /** Engine name */
  readonly name: string;
  /** Engine type */
  readonly type: OCREngineType;
  /** Supported languages */
  readonly supportedLanguages: string[];

  /** Initialize the engine */
  initialize(): Promise<void>;

  /** Check if initialized */
  isInitialized(): boolean;

  /** Recognize text from image buffer */
  recognize(image: Buffer, options?: OCROptions): Promise<OCRResult>;

  /** Recognize text from image URL */
  recognizeUrl?(url: string, options?: OCROptions): Promise<OCRResult>;

  /** Batch recognize multiple images */
  recognizeBatch?(images: Buffer[], options?: OCROptions): Promise<OCRResult[]>;

  /** Detect text regions without full OCR */
  detectTextRegions?(image: Buffer): Promise<BoundingBox[]>;

  /** Cleanup resources */
  terminate(): Promise<void>;
}

/**
 * OCR options for recognition
 */
export interface OCROptions {
  /** Languages to use */
  languages?: string[];
  /** Page segmentation mode */
  pageSegMode?: PageSegmentationMode;
  /** Include block/word level details */
  includeDetails?: boolean;
  /** Apply preprocessing */
  preprocessing?: OCRPreprocessingOptions;
  /** Region of interest */
  roi?: BoundingBox;
}

/**
 * Tesseract-specific configuration
 */
export interface TesseractConfig {
  /** Tesseract data path */
  dataPath?: string;
  /** Worker count */
  workerCount?: number;
  /** Cache workers */
  cacheWorkers?: boolean;
  /** OEM (OCR Engine Mode) */
  oem?: 0 | 1 | 2 | 3;
  /** PSM (Page Segmentation Mode) */
  psm?: number;
  /** Whitelist characters */
  whitelist?: string;
  /** Blacklist characters */
  blacklist?: string;
}

/**
 * Google Vision configuration
 */
export interface GoogleVisionConfig {
  /** API key or credentials path */
  credentials?: string | Record<string, unknown>;
  /** Features to detect */
  features?: GoogleVisionFeature[];
  /** Image context */
  imageContext?: {
    languageHints?: string[];
    cropHintsParams?: { aspectRatios: number[] };
  };
}

/**
 * Google Vision features
 */
export type GoogleVisionFeature =
  | 'TEXT_DETECTION'
  | 'DOCUMENT_TEXT_DETECTION'
  | 'LABEL_DETECTION'
  | 'LOGO_DETECTION'
  | 'FACE_DETECTION';

/**
 * AWS Textract configuration
 */
export interface AWSTextractConfig {
  /** AWS region */
  region?: string;
  /** AWS credentials */
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
  };
  /** Feature types */
  featureTypes?: ('TABLES' | 'FORMS' | 'QUERIES' | 'SIGNATURES' | 'LAYOUT')[];
}

/**
 * Azure Vision configuration
 */
export interface AzureVisionConfig {
  /** Azure endpoint */
  endpoint: string;
  /** API key */
  apiKey: string;
  /** Read API version */
  apiVersion?: string;
  /** Model version */
  modelVersion?: 'latest' | '2022-04-30' | '2023-02-28-preview';
}

/**
 * OCR engine factory configuration
 */
export interface OCREngineFactoryConfig {
  /** Default engine type */
  defaultEngine: OCREngineType;
  /** Engine configurations */
  engines?: {
    tesseract?: TesseractConfig;
    google_vision?: GoogleVisionConfig;
    aws_textract?: AWSTextractConfig;
    azure_vision?: AzureVisionConfig;
  };
}

/**
 * OCR quality metrics
 */
export interface OCRQualityMetrics {
  /** Average confidence */
  averageConfidence: number;
  /** Low confidence word count */
  lowConfidenceWords: number;
  /** Detected noise level */
  noiseLevel: 'low' | 'medium' | 'high';
  /** Suggested improvements */
  suggestions?: string[];
}
