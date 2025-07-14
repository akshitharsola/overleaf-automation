import React, { useState } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, Eye, Search } from 'lucide-react';
import './DocxAnalyzer.css';

interface Equation {
  id: number;
  content: string;
  originalMatch?: string;
  type: string;
  confidence: number;
  source?: string;
  startPosition?: number;
  contextBefore?: string;
  contextAfter?: string;
}

interface Section {
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
}

interface TableData {
  id: number;
  rows: number;
  columns: number;
  data: string[][];
  confidence: number;
}

interface DetectedElement {
  text: string;
  confidence: number;
  reasoning: string;
}

interface TextLine {
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

interface Analysis {
  title: DetectedElement | null;
  authors: DetectedElement | null;
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
}

const DocxAnalyzer: React.FC = () => {
  const [file, setFile] = useState<File | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('upload');

  const loadMammoth = (): Promise<any> => {
    return new Promise((resolve, reject) => {
      if ((window as any).mammoth) {
        resolve((window as any).mammoth);
        return;
      }
      
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js';
      script.onload = () => resolve((window as any).mammoth);
      script.onerror = reject;
      document.head.appendChild(script);
    });
  };

  const loadJSZip = (): Promise<any> => {
    return new Promise((resolve, reject) => {
      if ((window as any).JSZip) {
        resolve((window as any).JSZip);
        return;
      }
      
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
      script.onload = () => resolve((window as any).JSZip);
      script.onerror = reject;
      document.head.appendChild(script);
    });
  };

  // Enhanced OMML to LaTeX converter with proper namespace handling
  const convertOMMLToLatex = (ommlXml: string): string => {
    try {
      // Add proper XML namespace declaration for OMML
      const xmlWithNamespace = `<?xml version="1.0" encoding="UTF-8"?>
<root xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" 
      xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
${ommlXml}
</root>`;
      
      const parser = new DOMParser();
      const doc = parser.parseFromString(xmlWithNamespace, 'text/xml');
      
      // Check for parsing errors
      const parseError = doc.querySelector('parsererror');
      if (parseError) {
        console.warn('XML parsing error, falling back to text extraction');
        return extractTextFromOMML(ommlXml);
      }
      
      // Helper function to recursively convert OMML elements
      const convertElement = (element: Element): string => {
        const tagName = element.tagName.toLowerCase();
        const localName = element.localName?.toLowerCase() || '';
        const textContent = element.textContent?.trim() || '';
        
        // Handle both namespaced and non-namespaced elements
        const elementType = localName || tagName.replace('m:', '');
        
        switch (elementType) {
          case 'omath':
            // Process all children of the math element
            return Array.from(element.children)
              .map(child => convertElement(child))
              .join(' ');
            
          case 'f': // Fraction
            const num = element.querySelector('[*|localName="num"], num');
            const den = element.querySelector('[*|localName="den"], den');
            if (num && den) {
              return `\\frac{${convertElement(num)}}{${convertElement(den)}}`;
            }
            break;
            
          case 'sup': // Superscript
            const base = element.querySelector('[*|localName="e"], e');
            const sup = element.querySelector('[*|localName="sup"], sup');
            if (base && sup) {
              return `${convertElement(base)}^{${convertElement(sup)}}`;
            }
            break;
            
          case 'sub': // Subscript
            const baseEl = element.querySelector('[*|localName="e"], e');
            const sub = element.querySelector('[*|localName="sub"], sub');
            if (baseEl && sub) {
              return `${convertElement(baseEl)}_{${convertElement(sub)}}`;
            }
            break;
            
          case 'rad': // Square root
            const deg = element.querySelector('[*|localName="deg"], deg');
            const radicand = element.querySelector('[*|localName="e"], e');
            if (radicand) {
              if (deg && deg.textContent?.trim()) {
                return `\\sqrt[${convertElement(deg)}]{${convertElement(radicand)}}`;
              } else {
                return `\\sqrt{${convertElement(radicand)}}`;
              }
            }
            break;
            
          case 'ssup': // Subscript and superscript
            const ssBase = element.querySelector('[*|localName="e"], e');
            const ssSup = element.querySelector('[*|localName="sup"], sup');
            const ssSub = element.querySelector('[*|localName="sub"], sub');
            if (ssBase) {
              let result = convertElement(ssBase);
              if (ssSub) result += `_{${convertElement(ssSub)}}`;
              if (ssSup) result += `^{${convertElement(ssSup)}}`;
              return result;
            }
            break;
            
          case 'd': // Delimiter (parentheses, brackets, etc.)
            const dE = element.querySelector('[*|localName="e"], e');
            if (dE) {
              return `\\left(${convertElement(dE)}\\right)`;
            }
            break;
            
          case 't': // Text element
            return textContent;
            
          case 'r': // Run (contains text and formatting)
            // Look for text elements within the run
            const tElements = element.querySelectorAll('[*|localName="t"], t');
            if (tElements.length > 0) {
              return Array.from(tElements)
                .map(t => t.textContent?.trim() || '')
                .join('');
            }
            // If no text elements, return the text content
            return textContent;
            
          default:
            // For unknown elements, try to process children
            if (element.children.length > 0) {
              return Array.from(element.children)
                .map(child => convertElement(child))
                .join('');
            }
            return textContent;
        }
        
        return textContent;
      };
      
      const rootMath = doc.querySelector('[*|localName="oMath"], oMath, m\\:oMath');
      if (rootMath) {
        const result = convertElement(rootMath);
        console.log('🔄 OMML conversion result:', result);
        return result;
      }
      
      // Fallback to text extraction
      return extractTextFromOMML(ommlXml);
    } catch (error) {
      console.error('OMML conversion error:', error);
      return extractTextFromOMML(ommlXml);
    }
  };

  // Fallback function to extract text from OMML when XML parsing fails
  const extractTextFromOMML = (ommlXml: string): string => {
    try {
      // Simple text extraction using regex to find text elements
      const textMatches = ommlXml.match(/<m:t[^>]*>(.*?)<\/m:t>/g);
      if (textMatches) {
        const extractedText = textMatches
          .map(match => match.replace(/<[^>]*>/g, ''))
          .join('')
          .trim();
        console.log('📝 Extracted text from OMML:', extractedText);
        return extractedText;
      }
      
      // If no m:t elements, try to extract any text content
      const cleanText = ommlXml
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      
      console.log('📝 Fallback text extraction:', cleanText);
      return cleanText;
    } catch (error) {
      console.error('Text extraction error:', error);
      return ommlXml;
    }
  };

  // Extract equations directly from DOCX XML
  const extractEquationsFromDocxXml = async (file: File): Promise<Equation[]> => {
    try {
      const JSZip = await loadJSZip();
      const zip = new JSZip();
      const docx = await zip.loadAsync(file);
      
      const equations: Equation[] = [];
      
      // Extract document.xml which contains the main content
      const documentXml = await docx.file('word/document.xml')?.async('string');
      if (!documentXml) {
        throw new Error('Could not find document.xml in DOCX file');
      }
      
      console.log('📄 Document XML length:', documentXml.length);
      
      // Save XML to window for debugging
      (window as any).debugDocumentXml = documentXml;
      console.log('💾 Raw XML saved to window.debugDocumentXml for inspection');
      
      // Debug: Check what XML namespaces are present
      const hasOMMLNamespace = documentXml.includes('xmlns:m=');
      const hasMathMLNamespace = documentXml.includes('<math');
      console.log('🔍 OMML namespace found:', hasOMMLNamespace);
      console.log('🔍 MathML elements found:', hasMathMLNamespace);
      
      // Check for any equation-related content
      const hasEquationText = documentXml.includes('equation');
      const hasMathText = documentXml.includes('math');
      const hasFormulaText = documentXml.includes('formula');
      console.log('📝 Contains "equation":', hasEquationText);
      console.log('📝 Contains "math":', hasMathText);
      console.log('📝 Contains "formula":', hasFormulaText);
      
      // Enhanced OMML detection with multiple patterns
      const ommlPatterns = [
        /<m:oMath[^>]*>[\s\S]*?<\/m:oMath>/g,
        /<w:object[^>]*>[\s\S]*?<\/w:object>/g, // Embedded objects
        /<w:pict[^>]*>[\s\S]*?<\/w:pict>/g,     // Pictures (equations as images)
        /<oMath[^>]*>[\s\S]*?<\/oMath>/g        // Without namespace prefix
      ];
      
      ommlPatterns.forEach((pattern, patternIndex) => {
        const matches = documentXml.match(pattern);
        if (matches) {
          console.log(`🎯 Pattern ${patternIndex + 1} found ${matches.length} matches`);
          matches.forEach((match: string, index: number) => {
            console.log(`📝 Processing match ${index + 1}:`, match.substring(0, 100) + '...');
            
            try {
              // Convert OMML to LaTeX
              const latexContent = convertOMMLToLatex(match);
              console.log(`🔄 Converted to LaTeX:`, latexContent);
              
              // Clean up the LaTeX content
              const cleanContent = latexContent
                .replace(/\s+/g, ' ')
                .replace(/\\ +/g, ' ')
                .trim();
              
              if (cleanContent && cleanContent.length > 1) {
                equations.push({
                  id: equations.length + 1,
                  content: cleanContent,
                  originalMatch: match.substring(0, 500), // Limit size for display
                  type: `omml_pattern_${patternIndex + 1}`,
                  confidence: 0.98,
                  source: `OMML Pattern ${patternIndex + 1} extraction`,
                  startPosition: index
                });
                console.log(`✅ Added equation: ${cleanContent}`);
              } else {
                console.log(`❌ Rejected empty content: "${cleanContent}"`);
              }
            } catch (error) {
              console.error(`❌ Error processing equation ${index}:`, error);
            }
          });
        }
      });
      
      // Look for math-related elements more broadly
      const mathElementPatterns = [
        /<w:r[^>]*>[\s\S]*?<w:sym[^>]*>[\s\S]*?<\/w:r>/g, // Symbol elements
        /<w:fldSimple[^>]*>[\s\S]*?EQ[\s\S]*?<\/w:fldSimple>/g, // Equation fields
        /<w:instrText[^>]*>[\s\S]*?EQ[\s\S]*?<\/w:instrText>/g // Instruction text with equations
      ];
      
      mathElementPatterns.forEach((pattern, patternIndex) => {
        const matches = documentXml.match(pattern);
        if (matches) {
          console.log(`🔍 Math pattern ${patternIndex + 1} found ${matches.length} matches`);
          matches.forEach((match: string, index: number) => {
            console.log(`📐 Math element ${index + 1}:`, match.substring(0, 100) + '...');
            
            // Extract any mathematical content
            const textContent = match.replace(/<[^>]*>/g, ' ').trim();
            if (textContent && textContent.length > 2) {
              equations.push({
                id: equations.length + 1,
                content: textContent,
                originalMatch: match.substring(0, 300),
                type: `math_element_${patternIndex + 1}`,
                confidence: 0.75,
                source: `Math Element Pattern ${patternIndex + 1}`,
                startPosition: index + 2000
              });
            }
          });
        }
      });
      
      // Also look for MathML elements (alternative format)
      const mathmlRegex = /<math[^>]*>[\s\S]*?<\/math>/g;
      const mathmlMatches = documentXml.match(mathmlRegex);
      
      if (mathmlMatches) {
        console.log(`🧮 Found ${mathmlMatches.length} MathML elements`);
        mathmlMatches.forEach((match: string, index: number) => {
          try {
            // Basic MathML to text conversion
            const parser = new DOMParser();
            const mathDoc = parser.parseFromString(match, 'text/xml');
            const textContent = mathDoc.documentElement.textContent?.trim() || '';
            
            if (textContent && textContent.length > 1) {
              equations.push({
                id: equations.length + 1,
                content: textContent,
                originalMatch: match,
                type: 'mathml_equation',
                confidence: 0.95,
                source: 'MathML extraction from DOCX XML',
                startPosition: index + 1000 // Offset to distinguish from OMML
              });
              console.log(`✅ Added MathML equation: ${textContent}`);
            }
          } catch (error) {
            console.error(`Error processing MathML equation ${index}:`, error);
          }
        });
      }
      
      console.log(`🎯 Total equations extracted: ${equations.length}`);
      return equations;
    } catch (error) {
      console.error('Error extracting equations from DOCX:', error);
      return [];
    }
  };

  const detectAllEquations = (html: string, rawText: string, ommlEquations: Equation[] = []): Equation[] => {
    const equations: Equation[] = [...ommlEquations]; // Start with OMML equations
    
    // Method 1: LaTeX Dollar Sign Detection (for manually typed LaTeX)
    const latexPatterns = [
      {
        name: 'LaTeX Dollar Inline',
        pattern: /\$([^$\n]+)\$/g,
        type: 'latex_inline',
        confidence: 0.95
      },
      {
        name: 'LaTeX Double Dollar Display',
        pattern: /\$\$([^$]+)\$\$/g,
        type: 'latex_display',
        confidence: 0.98
      },
      {
        name: 'LaTeX Fraction',
        pattern: /\\frac\{[^}]+\}\{[^}]+\}/g,
        type: 'latex_fraction',
        confidence: 0.95
      },
      {
        name: 'LaTeX Summation',
        pattern: /\\[Ss]igma|∑|\\sum/g,
        type: 'summation',
        confidence: 0.85
      }
    ];

    // Process each pattern
    latexPatterns.forEach(patternInfo => {
      const matches = Array.from(rawText.matchAll(patternInfo.pattern));
      
      matches.forEach((match) => {
        const content = match[1] || match[0];
        if (content && content.trim().length > 1) {
          // Check for duplicates with OMML equations
          const isDuplicate = equations.some(eq => 
            eq.content.includes(content.trim()) || content.trim().includes(eq.content)
          );
          
          if (!isDuplicate) {
            // Clean up content
            const cleanContent = content.trim()
              .replace(/\s+/g, ' ')
              .replace(/\\ +/g, ' ')
              .trim();
            
            equations.push({
              id: equations.length + 1,
              content: cleanContent,
              originalMatch: match[0],
              type: patternInfo.type,
              confidence: patternInfo.confidence,
              source: patternInfo.name,
              startPosition: match.index,
              contextBefore: rawText.substring(Math.max(0, match.index! - 50), match.index),
              contextAfter: rawText.substring(match.index! + match[0].length, match.index! + match[0].length + 50)
            });
          }
        }
      });
    });

    // Method 2: Word Cambria Math Font Detection (backup method)
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const mathElements = doc.querySelectorAll('span[style*="Cambria Math"]');
    
    mathElements.forEach((element) => {
      const content = element.textContent?.trim();
      if (content && content.length > 1) {
        const isDuplicate = equations.some(eq => 
          eq.content.includes(content) || content.includes(eq.content)
        );
        if (!isDuplicate) {
          equations.push({
            id: equations.length + 1,
            content: content,
            type: 'word_math_font',
            confidence: 0.90,
            source: 'Cambria Math font detection'
          });
        }
      }
    });

    // Method 3: Look for mathematical symbols and patterns in raw text
    const mathSymbolPatterns = [
      {
        name: 'Mathematical Symbols',
        pattern: /[±×÷≤≥≠≈∞∑∏∫√∂∇αβγδεθλμπσωΑΒΓΔΘΛΞΠΣΦΨΩ]/g,
        type: 'math_symbols',
        confidence: 0.70
      },
      {
        name: 'Equation Structure',
        pattern: /[a-zA-Z]\s*[=]\s*[^a-zA-Z\s]{2,}/g,
        type: 'equation_structure',
        confidence: 0.75
      }
    ];

    mathSymbolPatterns.forEach(patternInfo => {
      const matches = Array.from(rawText.matchAll(patternInfo.pattern));
      
      matches.forEach((match) => {
        const content = match[0];
        if (content && content.trim().length > 2) {
          const isDuplicate = equations.some(eq => 
            eq.content.includes(content.trim()) || content.trim().includes(eq.content)
          );
          
          if (!isDuplicate) {
            equations.push({
              id: equations.length + 1,
              content: content.trim(),
              originalMatch: match[0],
              type: patternInfo.type,
              confidence: patternInfo.confidence,
              source: patternInfo.name,
              startPosition: match.index,
              contextBefore: rawText.substring(Math.max(0, match.index! - 30), match.index),
              contextAfter: rawText.substring(match.index! + match[0].length, match.index! + match[0].length + 30)
            });
          }
        }
      });
    });

    // Return sorted by confidence and position
    return equations
      .filter(eq => eq.confidence > 0.60)
      .sort((a, b) => {
        if (b.confidence !== a.confidence) return b.confidence - a.confidence;
        return (a.startPosition || 0) - (b.startPosition || 0);
      });
  };

  const analyzeDocumentStructure = (html: string, rawText: string, ommlEquations: Equation[] = []): Omit<Analysis, 'rawHtml' | 'rawText' | 'fileName' | 'fileSize'> => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    const analysis = {
      title: null as DetectedElement | null,
      authors: null as DetectedElement | null,
      abstract: null as DetectedElement | null,
      keywords: null as DetectedElement | null,
      sections: [] as Section[],
      tables: [] as TableData[],
      equations: [] as Equation[],
      textLines: [] as TextLine[],
      tableContent: new Set<string>(),
      detectionMethod: 'none'
    };

    // Step 1: Detect equations FIRST (including OMML equations)
    analysis.equations = detectAllEquations(html, rawText, ommlEquations);

    // Step 2: Extract all table content first to avoid false section detection
    const tables = Array.from(doc.querySelectorAll('table'));
    tables.forEach((table, tableIndex) => {
      const rows = Array.from(table.querySelectorAll('tr'));
      const tableData = rows.map(row => 
        Array.from(row.querySelectorAll('td, th')).map(cell => {
          const cellText = cell.textContent?.trim() || '';
          // Add all table text to exclusion set
          if (cellText.length > 0) {
            analysis.tableContent.add(cellText.toLowerCase());
            // Also add variations for better matching
            analysis.tableContent.add(cellText.toLowerCase().replace(/[^\w\s]/g, ''));
          }
          return cellText;
        })
      );
      
      analysis.tables.push({
        id: tableIndex + 1,
        rows: tableData.length,
        columns: tableData[0] ? tableData[0].length : 0,
        data: tableData.slice(0, 5), // Show first 5 rows
        confidence: 1.0
      });
    });

    // Step 3: Split raw text into lines for analysis
    const textLines = rawText.split(/\r?\n/).filter(line => line.trim().length > 0);
    analysis.textLines = textLines.map((line, index) => {
      const trimmedLine = line.trim();
      return {
        index,
        text: trimmedLine.length > 100 ? trimmedLine.substring(0, 100) + '...' : trimmedLine,
        fullText: trimmedLine,
        startsWithNumber: /^\d+\./.test(trimmedLine),
        startsWithSubNumber: /^\d+\.\d+/.test(trimmedLine),
        startsWithSubSubNumber: /^\d+\.\d+\.\d+/.test(trimmedLine),
        startsWithRoman: /^[IVX]+\./i.test(trimmedLine),
        containsAbstract: /^abstract[\s\-:—]/i.test(trimmedLine),
        containsKeywords: /^(keywords|index terms)[\s\-:—]/i.test(trimmedLine),
        isInTable: analysis.tableContent.has(trimmedLine.toLowerCase()),
        containsEquation: analysis.equations.some(eq => 
          trimmedLine.includes(eq.content) || 
          eq.content.includes(trimmedLine) ||
          (eq.originalMatch && trimmedLine.includes(eq.originalMatch))
        )
      };
    });

    // Step 4: Detect sections with manual numbering (excluding table content)
    let sectionsFound: Array<{
      number: string;
      title: string;
      fullText: string;
      type: string;
      level: number;
      confidence: number;
      lineIndex: number;
      reasoning: string;
      content?: string;
      contentPreview?: string;
      wordCount?: number;
    }> = [];
    
    analysis.textLines.forEach((line, index) => {
      const text = line.fullText;
      
      // Skip if this text appears in tables
      if (line.isInTable) {
        return;
      }
      
      // Pattern matching for manually typed sections
      const pattern1 = text.match(/^(\d+)\.\s+(.+)$/);           // "1. Introduction"
      const pattern2 = text.match(/^(\d+\.\d+)\s+(.+)$/);        // "4.1 Performance Metrics"
      const pattern3 = text.match(/^(\d+\.\d+\.\d+)\s+(.+)$/);   // "4.1.1 Implementation"
      const pattern4 = text.match(/^([IVX]+)\.\s+(.+)$/i);       // "I. Introduction"
      
      if (pattern1 || pattern2 || pattern3 || pattern4) {
        const match = pattern1 || pattern2 || pattern3 || pattern4;
        const title = match![2];
        
        // Additional table content filtering - check if title appears in any table
        const titleInTable = Array.from(analysis.tableContent).some(tableText => 
          tableText.includes(title.toLowerCase()) || 
          title.toLowerCase().includes(tableText)
        );
        
        if (!titleInTable) {
          sectionsFound.push({
            number: match![1],
            title: title,
            fullText: text,
            type: pattern1 ? 'numbered' : pattern2 ? 'subsection' : pattern3 ? 'subsubsection' : 'roman',
            level: pattern1 ? 1 : pattern2 ? 2 : pattern3 ? 3 : 1,
            confidence: 0.95,
            lineIndex: index,
            reasoning: `Manual ${pattern1 ? 'numbered' : pattern2 ? 'subsection' : pattern3 ? 'sub-subsection' : 'roman'} section`
          });
        }
      }
    });

    // Step 5: Extract content for each section
    sectionsFound.forEach((section) => {
      let content = '';
      let contentWordCount = 0;
      const maxWords = 25;
      
      // Start from the line after the section heading
      for (let i = section.lineIndex + 1; i < analysis.textLines.length; i++) {
        const nextLine = analysis.textLines[i];
        const nextText = nextLine.fullText;
        
        // Stop if we hit another section
        const isNextSection = /^(\d+\.|\d+\.\d+\.|\d+\.\d+\.\d+\.?|[IVX]+\.)\s+/.test(nextText);
        if (isNextSection) break;
        
        // Skip table content
        if (nextLine.isInTable) continue;
        
        // Add content
        const words = nextText.split(/\s+/);
        const remainingWords = maxWords - contentWordCount;
        
        if (remainingWords <= 0) {
          content += '...';
          break;
        }
        
        const wordsToAdd = words.slice(0, remainingWords);
        content += (content ? ' ' : '') + wordsToAdd.join(' ');
        contentWordCount += wordsToAdd.length;
        
        if (words.length > remainingWords) {
          content += '...';
          break;
        }
      }
      
      section.content = content.trim() || 'No content detected';
      section.contentPreview = content.trim().substring(0, 150) + (content.length > 150 ? '...' : '');
      section.wordCount = contentWordCount;
    });

    // Convert to final format
    analysis.sections = sectionsFound.map(section => ({
      number: section.number + (section.type === 'numbered' ? '.' : ''),
      title: section.title,
      content: section.content!,
      contentPreview: section.contentPreview!,
      level: section.level,
      type: section.type,
      confidence: section.confidence,
      reasoning: section.reasoning,
      originalText: section.fullText,
      wordCount: section.wordCount!
    }));

    analysis.detectionMethod = sectionsFound.length > 0 ? 'success' : 'failed';

    // Step 6: Detect other document elements
    
    // Title detection (first substantial line, not in table, not a section)
    const titleCandidate = analysis.textLines.find(line => 
      line.index < 5 && 
      line.fullText.length > 10 &&
      line.fullText.length < 200 &&
      !line.containsAbstract &&
      !line.startsWithNumber &&
      !line.startsWithRoman &&
      !line.isInTable
    );
    
    if (titleCandidate) {
      analysis.title = {
        text: titleCandidate.fullText,
        confidence: 0.85,
        reasoning: 'First substantial line not in table or section format'
      };
    }

    // Author detection (line after title, short, not in table)
    if (analysis.title) {
      const authorCandidate = analysis.textLines.find(line => 
        line.index > titleCandidate!.index && 
        line.index < titleCandidate!.index + 3 &&
        line.fullText.length > 2 &&
        line.fullText.length < 60 &&
        !line.containsAbstract &&
        !line.startsWithNumber &&
        !line.isInTable &&
        !line.fullText.toLowerCase().includes('university') &&
        !line.fullText.toLowerCase().includes('department')
      );
      
      if (authorCandidate) {
        analysis.authors = {
          text: authorCandidate.fullText,
          confidence: 0.75,
          reasoning: 'Short line after title, not in table'
        };
      }
    }

    // Abstract detection
    const abstractLine = analysis.textLines.find(line => line.containsAbstract);
    if (abstractLine) {
      analysis.abstract = {
        text: abstractLine.fullText,
        confidence: 0.95,
        reasoning: 'Line starts with "Abstract"'
      };
    }

    // Keywords detection
    const keywordLine = analysis.textLines.find(line => line.containsKeywords);
    if (keywordLine) {
      analysis.keywords = {
        text: keywordLine.fullText,
        confidence: 0.95,
        reasoning: 'Line starts with keyword indicators'
      };
    }

    return analysis;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.docx')) {
      setError('Please upload a .docx file');
      return;
    }

    setFile(selectedFile);
    setLoading(true);
    setError(null);

    try {
      // Step 1: Extract equations directly from DOCX XML (OMML/MathML)
      console.log('🔍 Extracting equations from DOCX XML...');
      const ommlEquations = await extractEquationsFromDocxXml(selectedFile);
      console.log(`✅ Found ${ommlEquations.length} OMML/MathML equations`);

      // Step 2: Use mammoth for text and HTML extraction
      const mammoth = await loadMammoth();
      const arrayBuffer = await selectedFile.arrayBuffer();
      
      const htmlResult = await mammoth.convertToHtml({
        arrayBuffer: arrayBuffer,
        options: {
          includeDefaultStyleMap: true,
          preserveStyles: true
        }
      });

      const textResult = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });

      // Step 3: Analyze document structure with OMML equations included
      const documentAnalysis = analyzeDocumentStructure(htmlResult.value, textResult.value, ommlEquations);
      
      setAnalysis({
        ...documentAnalysis,
        rawHtml: htmlResult.value,
        rawText: textResult.value,
        fileName: selectedFile.name,
        fileSize: selectedFile.size
      });
      
      setActiveTab('analysis');
    } catch (err: any) {
      console.error('Error processing file:', err);
      setError(`Error processing file: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const renderConfidenceBar = (confidence: number) => {
    const percentage = Math.round(confidence * 100);
    const confidenceClass = confidence > 0.8 ? 'confidence-high' : confidence > 0.6 ? 'confidence-medium' : 'confidence-low';
    
    return (
      <div className="confidence-bar">
        <div className="confidence-track">
          <div 
            className={`confidence-fill ${confidenceClass}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="text-sm font-medium">{percentage}%</span>
      </div>
    );
  };

  const renderDetectionCard = (title: string, data: DetectedElement | null, icon: React.ReactNode) => {
    if (!data) {
      return (
        <div className="card" style={{ backgroundColor: '#f9fafb', borderStyle: 'dashed' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            {icon}
            <span className="font-medium" style={{ color: '#6b7280' }}>{title}</span>
          </div>
          <p className="text-sm" style={{ color: '#9ca3af' }}>Not detected</p>
        </div>
      );
    }

    return (
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
          {icon}
          <span className="font-medium" style={{ color: '#1f2937' }}>{title}</span>
          {renderConfidenceBar(data.confidence)}
        </div>
        <div className="text-sm" style={{ color: '#6b7280', marginBottom: '8px' }}>
          <strong>Reasoning:</strong> {data.reasoning}
        </div>
        <div className="code" style={{ backgroundColor: '#dbeafe', padding: '12px', borderRadius: '4px' }}>
          <strong>Content:</strong> {data.text.substring(0, 200)}
          {data.text.length > 200 && '...'}
        </div>
      </div>
    );
  };

  return (
    <div className="container">
      <div className="header">
        <h1 className="title">
          DOCX Analyzer v4.0 - Enhanced Equation Detection
        </h1>
        <p className="subtitle">
          Advanced document analysis with equation detection and section parsing
        </p>
      </div>

      <div className="tabs">
        <button
          onClick={() => setActiveTab('upload')}
          className={`tab ${activeTab === 'upload' ? 'active' : 'inactive'}`}
        >
          <Upload size={16} />
          Upload
        </button>
        <button
          onClick={() => setActiveTab('analysis')}
          disabled={!analysis}
          className={`tab ${activeTab === 'analysis' && analysis ? 'active' : 'inactive'}`}
        >
          <Eye size={16} />
          Analysis
        </button>
        <button
          onClick={() => setActiveTab('debug')}
          disabled={!analysis}
          className={`tab ${activeTab === 'debug' && analysis ? 'active' : 'inactive'}`}
        >
          <Search size={16} />
          Debug
        </button>
      </div>

      {activeTab === 'upload' && (
        <div>
          <div className="upload-area">
            <FileText size={48} style={{ color: '#9ca3af', margin: '0 auto 16px' }} />
            <h3 style={{ fontSize: '18px', fontWeight: '500', color: '#1f2937', marginBottom: '8px' }}>Upload DOCX File</h3>
            <p style={{ color: '#6b7280', marginBottom: '16px' }}>
              Upload your document with equations and sections for analysis
            </p>
            
            <div style={{ backgroundColor: '#f0fdf4', padding: '16px', borderRadius: '8px', marginBottom: '16px', textAlign: 'left' }}>
              <h4 className="font-medium" style={{ color: '#166534', marginBottom: '8px' }}>✅ Supported Features:</h4>
              <div className="text-sm" style={{ color: '#166534' }}>
                <p>• <strong>Equations:</strong> LaTeX ($equation$), Word equations, mathematical symbols</p>
                <p>• <strong>Sections:</strong> "1. Introduction", "4.1 Performance", Roman numerals</p>
                <p>• <strong>Document elements:</strong> Title, authors, abstract, keywords</p>
                <p>• <strong>Tables:</strong> Automatic detection and content filtering</p>
              </div>
            </div>
            
            <input
              type="file"
              accept=".docx"
              onChange={handleFileUpload}
              className="upload-input"
              id="docx-upload"
            />
            <label htmlFor="docx-upload" className="upload-button">
              Choose DOCX File
            </label>
            
            {file && (
              <div className="mt-4" style={{ padding: '12px', backgroundColor: '#f0fdf4', borderRadius: '8px' }}>
                <p style={{ color: '#166534' }}>
                  <strong>File:</strong> {file.name} ({Math.round(file.size / 1024)} KB)
                </p>
              </div>
            )}
          </div>

          {loading && (
            <div className="loading">
              <div className="spinner"></div>
              <p style={{ color: '#6b7280' }}>Processing document with advanced detection algorithms...</p>
            </div>
          )}

          {error && (
            <div className="card error-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertCircle size={20} style={{ color: '#dc2626' }} />
                <span className="font-medium" style={{ color: '#dc2626' }}>Error</span>
              </div>
              <p style={{ color: '#dc2626', marginTop: '8px' }}>{error}</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'analysis' && analysis && (
        <div>
          <div className={`card ${analysis.detectionMethod === 'success' ? 'success-card' : 'error-card'}`}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {analysis.detectionMethod === 'success' ? (
                <CheckCircle size={20} style={{ color: '#059669' }} />
              ) : (
                <AlertCircle size={20} style={{ color: '#dc2626' }} />
              )}
              <span className="font-medium" style={{ 
                color: analysis.detectionMethod === 'success' ? '#059669' : '#dc2626' 
              }}>
                Analysis: {analysis.detectionMethod === 'success' ? 'Success' : 'Partial'}
              </span>
            </div>
            <p className="text-sm" style={{ 
              marginTop: '8px',
              color: analysis.detectionMethod === 'success' ? '#059669' : '#dc2626' 
            }}>
              Found {analysis.equations.length} equations, {analysis.sections.length} sections, {analysis.tables.length} tables
            </p>
          </div>

          <div className="card">
            <h3 className="font-medium mb-2">Document Statistics</h3>
            <div className="grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '16px' }}>
              <div className="text-sm"><strong>File:</strong> {analysis.fileName}</div>
              <div className="text-sm"><strong>Size:</strong> {Math.round(analysis.fileSize / 1024)} KB</div>
              <div className="text-sm"><strong>Equations:</strong> {analysis.equations.length}</div>
              <div className="text-sm"><strong>Sections:</strong> {analysis.sections.length}</div>
              <div className="text-sm"><strong>Tables:</strong> {analysis.tables.length}</div>
            </div>
          </div>

          <div className="grid grid-2">
            {renderDetectionCard('Title', analysis.title, <CheckCircle size={20} style={{ color: '#059669' }} />)}
            {renderDetectionCard('Authors', analysis.authors, <FileText size={20} style={{ color: '#2563eb' }} />)}
            {renderDetectionCard('Abstract', analysis.abstract, <FileText size={20} style={{ color: '#7c3aed' }} />)}
            {renderDetectionCard('Keywords', analysis.keywords, <FileText size={20} style={{ color: '#ea580c' }} />)}
          </div>

          {analysis.equations.length > 0 ? (
            <div className="card">
              <h3 className="font-medium mb-4">
                Mathematical Equations Detected ({analysis.equations.length})
              </h3>
              <div>
                {analysis.equations.map((equation, index) => (
                  <div key={index} className="equation-card">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                      <span className="font-medium">Equation {equation.id}</span>
                      <span className="tag tag-blue">
                        {equation.type.toUpperCase()}
                      </span>
                      <span className="text-sm" style={{ color: '#6b7280' }}>
                        {Math.round(equation.confidence * 100)}% confidence
                      </span>
                      {equation.source && (
                        <span className="text-xs" style={{ color: '#9ca3af' }}>
                          via {equation.source}
                        </span>
                      )}
                    </div>
                    
                    <div style={{ marginBottom: '12px' }}>
                      <div className="text-sm font-medium mb-2">Detected Content:</div>
                      <div className="code" style={{ backgroundColor: '#dbeafe' }}>
                        {equation.content}
                      </div>
                    </div>
                    
                    {equation.originalMatch && equation.originalMatch.length < 500 && (
                      <div style={{ marginBottom: '12px' }}>
                        <div className="text-sm font-medium mb-2">
                          {equation.type === 'omml_equation' ? 'OMML Source:' : 'Original Match:'}
                        </div>
                        <div className="code text-xs" style={{ backgroundColor: '#fef3c7', maxHeight: '150px', overflow: 'auto' }}>
                          {equation.originalMatch.length > 200 
                            ? equation.originalMatch.substring(0, 200) + '...' 
                            : equation.originalMatch}
                        </div>
                      </div>
                    )}
                    
                    {equation.contextBefore && equation.contextAfter && (
                      <div>
                        <div className="text-sm font-medium mb-2">Context:</div>
                        <div className="text-xs code" style={{ backgroundColor: '#f3e8ff' }}>
                          <span style={{ color: '#6b7280' }}>...{equation.contextBefore}</span>
                          <span className="font-bold" style={{ color: '#7c3aed' }}>[EQUATION]</span>
                          <span style={{ color: '#6b7280' }}>{equation.contextAfter}...</span>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="card" style={{ backgroundColor: '#fef3c7', borderColor: '#f59e0b' }}>
              <h3 className="font-medium mb-2" style={{ color: '#92400e' }}>
                ⚠️ No Equations Found
              </h3>
              <div className="text-sm" style={{ color: '#92400e' }}>
                <p className="mb-2">The analyzer searched for:</p>
                <ul style={{ paddingLeft: '20px' }}>
                  <li>• <strong>OMML equations</strong> (Word's native math format)</li>
                  <li>• <strong>MathML equations</strong> (XML math markup)</li>
                  <li>• <strong>LaTeX patterns</strong> ($equation$, fractions, etc.)</li>
                  <li>• <strong>Mathematical symbols</strong> (±, ×, ÷, √, etc.)</li>
                  <li>• <strong>Equation structures</strong> (x = formula patterns)</li>
                </ul>
                <p className="mt-2">Check the Debug tab for detailed analysis.</p>
              </div>
            </div>
          )}

          {analysis.sections.length > 0 && (
            <div className="card">
              <h3 className="font-medium mb-4">Sections Detected ({analysis.sections.length})</h3>
              <div>
                {analysis.sections.map((section, index) => (
                  <div key={index} className="section-card">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="font-bold" style={{ fontSize: '18px', color: '#1f2937' }}>
                          {section.number} {section.title}
                        </span>
                        <span className="tag tag-blue">
                          {section.type} | Level {section.level}
                        </span>
                        <span className="tag tag-green">
                          {section.wordCount} words
                        </span>
                      </div>
                      {renderConfidenceBar(section.confidence)}
                    </div>
                    
                    <div className="text-sm" style={{ color: '#6b7280', marginBottom: '12px' }}>
                      <strong>Detection:</strong> {section.reasoning}
                    </div>
                    
                    <div className="code">
                      <div className="text-sm" style={{ color: '#1f2937', marginBottom: '8px' }}>
                        <strong>Original:</strong> "{section.originalText}"
                      </div>
                      {section.content !== 'No content detected' && (
                        <div className="text-sm" style={{ color: '#374151', backgroundColor: '#dbeafe', padding: '8px', borderRadius: '4px' }}>
                          <strong>Content Preview:</strong> {section.contentPreview}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === 'debug' && analysis && (
        <div>
          <div className="card">
            <h3 className="font-medium mb-4">🔍 Line-by-Line Analysis</h3>
            <div className="scrollable">
              {analysis.textLines.slice(0, 100).map((line, index) => {
                const hasManualPattern = /^(\d+\.|\d+\.\d+\.?|\d+\.\d+\.\d+\.?|[IVX]+\.)\s+/.test(line.fullText);
                let debugClass = 'debug-line';
                if (hasManualPattern && !line.isInTable) debugClass += ' section';
                else if (line.isInTable) debugClass += ' table';
                else if (line.containsEquation) debugClass += ' equation';
                
                return (
                  <div key={index} className={debugClass}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                      <span className="font-medium" style={{ color: '#6b7280' }}>Line {index + 1}:</span>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {hasManualPattern && !line.isInTable && <span className="tag tag-green">✅ SECTION</span>}
                        {line.isInTable && <span className="tag tag-red">Table</span>}
                        {line.containsEquation && <span className="tag tag-purple">Equation</span>}
                        {line.startsWithNumber && <span className="tag tag-blue">Numbered</span>}
                        {line.containsAbstract && <span className="tag tag-yellow">Abstract</span>}
                      </div>
                    </div>
                    <div className="code text-xs">
                      "{line.fullText}"
                    </div>
                  </div>
                );
              })}
              {analysis.textLines.length > 100 && (
                <p className="text-sm" style={{ color: '#6b7280', textAlign: 'center', marginTop: '16px' }}>
                  ... and {analysis.textLines.length - 100} more lines
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocxAnalyzer;