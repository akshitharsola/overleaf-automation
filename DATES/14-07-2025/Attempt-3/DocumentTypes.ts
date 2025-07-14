// Unified data interfaces for cross-format document processing
// Combines the best of .txt table processing and .docx equation detection

export interface Equation {
  id: number;
  content: string;
  originalMatch?: string;
  type: string;
  confidence: number;
  source?: string;
  startPosition?: number;
  contextBefore?: string;
  contextAfter?: string;
  latexEquivalent?: string;
}

export interface Section {
  number: string;
  title: string;
  content: string;
  contentPreview: string;
  level: number;
  type: string;
  confidence: number;
  reasoning: string;
  originalText: string;
  wordCount: number;
  startLineIndex?: number; // For equation placement
  endLineIndex?: number;   // For equation placement
}

export interface TableData {
  id: number;
  rows: number;
  columns: number;
  data: string[][];
  confidence: number;
  caption?: string;
  label?: string;
  startLine?: number;
  endLine?: number;
}

export interface DetectedElement {
  text: string;
  confidence: number;
  reasoning: string;
}

export interface AuthorInfo {
  names: string[];
  departments: string[];
  university: string;
  emails: string[];
  correspondingAuthors: number[]; // indices of corresponding authors
}

export interface TextLine {
  index: number;
  text: string;
  fullText: string;
  startsWithNumber: boolean;
  startsWithSubNumber: boolean;
  startsWithSubSubNumber: boolean;
  startsWithRoman: boolean;
  containsAbstract: boolean;
  containsKeywords: boolean;
  isInTable: boolean;
  containsEquation?: boolean;
}

export interface Analysis {
  title: DetectedElement | null;
  authors: DetectedElement | null;
  authorInfo: AuthorInfo | null;
  abstract: DetectedElement | null;
  keywords: DetectedElement | null;
  sections: Section[];
  tables: TableData[];
  equations: Equation[];
  textLines: TextLine[];
  tableContent: Set<string>;
  detectionMethod: string;
  rawHtml: string;
  rawText: string;
  fileName: string;
  fileSize: number;
  fileType: 'txt' | 'docx';
  sectionEquationMap?: Map<number, number[]>; // Maps section index to equation indices
}

// LaTeX Template Configuration
export interface LaTeXTemplate {
  name: string;
  tableStyle: string;
  packages: string[];
  singleColumn: boolean;
  documentClass: string;
  options: string;
}

export const LATEX_TEMPLATES: Record<string, LaTeXTemplate> = {
  ieee: {
    name: 'IEEE Conference',
    tableStyle: 'ieee',
    packages: ['array', 'booktabs'],
    singleColumn: true,
    documentClass: 'IEEEtran',
    options: 'conference'
  },
  acm: {
    name: 'ACM Conference', 
    tableStyle: 'acm',
    packages: ['booktabs'],
    singleColumn: false,
    documentClass: 'acmart',
    options: 'sigconf'
  },
  springer: {
    name: 'Springer Nature',
    tableStyle: 'springer', 
    packages: ['graphicx', 'multirow', 'amsmath', 'amssymb', 'amsfonts', 'amsthm', 'array', 'mathrsfs', 'appendix', 'xcolor', 'textcomp', 'manyfoot', 'booktabs', 'natbib', 'cite', 'algorithm', 'algorithmicx', 'algpseudocode', 'listings'],
    singleColumn: false,
    documentClass: 'sn-jnl',
    options: ''
  }
};

// Processing Configuration
export interface ProcessingConfig {
  selectedTemplate: string;
  enableCompression: boolean;
  fileType: 'txt' | 'docx' | 'auto';
  generateLatex: boolean;
  detectEquations: boolean;
  parseTables: boolean;
}

// File Upload Result
export interface UploadResult {
  success: boolean;
  analysis?: Analysis;
  error?: string;
  processingTime?: number;
}