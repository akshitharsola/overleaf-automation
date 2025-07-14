// Unified document parser for both .txt and .docx files
// Combines table parsing from .txt processor with advanced DOCX analysis

import { Analysis, Section, TableData, DetectedElement, TextLine, Equation } from '../types/DocumentTypes';
import { detectAllEquations, extractEquationsFromDocxXml } from './EquationDetector';

// Helper function to clean table captions by removing "Table X:" prefix
const cleanTableCaption = (caption: string): string => {
  if (!caption) return caption;
  
  // Remove "Table X:" or "Table X." or "Table X -" patterns from the beginning
  const cleaned = caption.replace(/^Table\s+\d+\s*[:\-.]\s*/i, '').trim();
  
  // If the cleaned version is empty or too short, return original
  if (cleaned.length < 5) {
    return caption;
  }
  
  return cleaned;
};

// Helper function to calculate text similarity (for smart table filtering)
const calculateTextSimilarity = (text1: string, text2: string): number => {
  const words1 = text1.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  const words2 = text2.toLowerCase().split(/\s+/).filter(w => w.length > 2);
  
  if (words1.length === 0 || words2.length === 0) return 0;
  
  const intersection = words1.filter(word => words2.includes(word));
  const allWords = words1.concat(words2);
  const uniqueWords = allWords.filter((word, index) => allWords.indexOf(word) === index);
  
  return intersection.length / uniqueWords.length; // Jaccard similarity
};

// Helper function to check if a table row contains the table number/caption and should be removed
const isTableCaptionRow = (row: string[], tableNumber: number, originalCaption?: string): boolean => {
  if (!row || row.length === 0) return false;
  
  const rowText = row.join(' ').toLowerCase().trim();
  
  // Check for "Table X" patterns
  const tableNumberPattern = new RegExp(`table\\s+${tableNumber}\\b`, 'i');
  if (tableNumberPattern.test(rowText)) {
    return true;
  }
  
  // Check if row contains significant part of the original caption
  if (originalCaption && originalCaption.length > 10) {
    const captionWords = originalCaption.toLowerCase().split(/\s+/).filter(word => word.length > 3);
    const rowWords = rowText.split(/\s+/);
    const matchingWords = captionWords.filter(word => 
      rowWords.some(rowWord => rowWord.includes(word) || word.includes(rowWord))
    );
    
    // Remove row if it contains more than 70% of caption words
    if (matchingWords.length >= captionWords.length * 0.7) {
      return true;
    }
  }
  
  return false;
};

// Note: Using placeholder-based equation placement for exact positioning

// Helper function to load mammoth dynamically
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

// Parse .txt files using the enhanced table format from the original processor
export const parseTxtFile = async (file: File): Promise<Analysis> => {
  const text = await file.text();
  const fileType: 'txt' = 'txt';
  
  // Initialize analysis structure
  const analysis: Analysis = {
    title: null,
    authors: null,
    abstract: null,
    keywords: null,
    sections: [],
    tables: [],
    equations: [],
    textLines: [],
    tableContent: new Set<string>(),
    detectionMethod: 'txt_parsing',
    rawHtml: '',
    rawText: text,
    fileName: file.name,
    fileSize: file.size,
    fileType
  };

  // Step 1: Parse tables using the ||====|| format from the original processor
  analysis.tables = parseTxtTables(text);
  
  // Step 2: Extract table content for filtering
  analysis.tables.forEach(table => {
    table.data.forEach(row => {
      row.forEach(cell => {
        if (cell && cell.trim().length > 0) {
          analysis.tableContent.add(cell.toLowerCase().trim());
          analysis.tableContent.add(cell.toLowerCase().replace(/[^\w\s]/g, '').trim());
        }
      });
    });
  });

  // Step 3: Split text into lines for analysis
  const textLines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
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
      containsEquation: false // Will be updated after equation detection
    };
  });

  // Step 4: Detect equations (text-based patterns)
  analysis.equations = detectAllEquations('', text, fileType);
  console.log(`🔬 Detected ${analysis.equations.length} equations in .txt file:`);
  analysis.equations.forEach(eq => {
    console.log(`  - Equation ${eq.id}: "${eq.content}" -> LaTeX: "${eq.latexEquivalent}"`);
  });
  
  // Update containsEquation flags
  analysis.textLines.forEach(line => {
    line.containsEquation = analysis.equations.some(eq => 
      line.fullText.includes(eq.content) || 
      (eq.originalMatch && line.fullText.includes(eq.originalMatch))
    );
  });

  // Step 5: Detect sections (enhanced from original processor)
  analysis.sections = detectTxtSections(analysis.textLines, analysis.tableContent, analysis.tables, analysis.equations);
  analysis.detectionMethod = analysis.sections.length > 0 ? 'success' : 'failed';

  // Step 6: Detect document elements
  detectDocumentElements(analysis);

  // Step 7: Section-equation mapping no longer needed - equations are placed via placeholders

  return analysis;
};

// Parse .docx files using mammoth + OMML extraction
export const parseDocxFile = async (file: File): Promise<Analysis> => {
  const fileType: 'docx' = 'docx';
  
  try {
    // Step 1: Extract equations directly from DOCX XML (OMML/MathML)
    console.log('🔍 Extracting equations from DOCX XML...');
    const ommlEquations = await extractEquationsFromDocxXml(file);
    console.log(`✅ Found ${ommlEquations.length} OMML/MathML equations`);

    // Step 2: Use mammoth for text and HTML extraction
    const mammoth = await loadMammoth();
    const arrayBuffer = await file.arrayBuffer();
    
    const htmlResult = await mammoth.convertToHtml({
      arrayBuffer: arrayBuffer,
      options: {
        includeDefaultStyleMap: true,
        preserveStyles: true
      }
    });

    const textResult = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
    
    // Debug: Check what mammoth produces for equations
    console.log('🔍 HTML contains equation patterns:');
    const mathPatterns = ['math', 'equation', 'formula', 'f(x)', 'Σ', 'θ', 'cos', 'sin', 'π'];
    mathPatterns.forEach(pattern => {
      const htmlHas = htmlResult.value.toLowerCase().includes(pattern.toLowerCase());
      const textHas = textResult.value.toLowerCase().includes(pattern.toLowerCase());
      if (htmlHas || textHas) {
        console.log(`  - "${pattern}": HTML=${htmlHas}, Text=${textHas}`);
      }
    });
    
    // Check for OMML-related content
    if (htmlResult.value.includes('m:')) {
      console.log('🔍 HTML contains OMML namespace references');
    }
    
    // Look for equation indicators in the text
    const equationIndicators = textResult.value.match(/(equation|formula|f\(x\)|mathematical|below is)/gi);
    if (equationIndicators) {
      console.log('🔍 Found equation indicators in text:', equationIndicators);
    }

    // Step 3: Analyze document structure with OMML equations included
    const analysis = analyzeDocxStructure(htmlResult.value, textResult.value, ommlEquations, file);
    
    return {
      ...analysis,
      rawHtml: htmlResult.value,
      rawText: textResult.value,
      fileName: file.name,
      fileSize: file.size,
      fileType
    };
  } catch (error) {
    console.error('Error parsing DOCX file:', error);
    throw new Error(`Failed to parse DOCX file: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

// Parse tables from .txt files using ||====|| format
const parseTxtTables = (text: string): TableData[] => {
  const lines = text.split('\n').map(line => line.trim()).filter(line => line);
  const tables: TableData[] = [];
  let tableStartIndex = -1;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    
    if (line === '||====||') {
      if (tableStartIndex === -1) {
        tableStartIndex = i;
      } else {
        // Enhanced caption detection for .txt tables - look for heading BEFORE and AFTER table
        let externalCaption: string | null = null;
        
        // Check lines before table start for heading (expanded range)
        for (let j = tableStartIndex - 1; j >= Math.max(0, tableStartIndex - 5); j--) {
          const potentialHeading = lines[j];
          if (potentialHeading && 
              potentialHeading.trim().length > 10 && 
              potentialHeading.trim().length < 300 &&
              !potentialHeading.includes('||') &&
              !potentialHeading.match(/^\d+\./)) {
            // Enhanced pattern matching for table captions
            const trimmed = potentialHeading.trim();
            if (trimmed.match(/^Table\s+\d+\s*[:\-.]/)||
                (trimmed.toLowerCase().includes('table') && trimmed.includes(':')) ||
                (trimmed.toLowerCase().includes('analysis') || 
                 trimmed.toLowerCase().includes('comparison') ||
                 trimmed.toLowerCase().includes('results') ||
                 trimmed.toLowerCase().includes('summary') ||
                 trimmed.toLowerCase().includes('limitations'))) {
              externalCaption = trimmed;
              break;
            }
          }
        }
        
        // If no heading found before, check lines after table end (expanded range and improved patterns)
        if (!externalCaption) {
          for (let j = i + 1; j < Math.min(lines.length, i + 5); j++) {
            const potentialCaption = lines[j];
            if (potentialCaption && 
                potentialCaption.trim().length > 5 &&
                potentialCaption.trim().length < 300) {
              const trimmed = potentialCaption.trim();
              // Enhanced pattern matching for captions after tables
              if (trimmed.match(/^Table\s+\d+\s*[:\-.]/)||
                  (trimmed.toLowerCase().includes('table') && trimmed.includes(':')) ||
                  (trimmed.toLowerCase().includes('analysis') && trimmed.includes(':'))) {
                externalCaption = trimmed;
                break;
              }
            }
          }
        }
        
        const tableLines = lines.slice(tableStartIndex + 1, i);
        let tableRows: string[][] = [];
        let internalCaption: string | null = null;
        
        for (const tableLine of tableLines) {
          if (tableLine.startsWith('||') && tableLine.endsWith('||')) {
            const row = tableLine.slice(2, -2).split('|').map(cell => cell.trim());
            tableRows.push(row);
          } else if (tableLine.trim() && !internalCaption) {
            // This is likely a caption line inside the table boundaries
            internalCaption = tableLine.trim();
          }
        }
        
        if (tableRows.length > 0) {
          // Prefer external caption, then internal, then default
          let rawCaption = externalCaption || internalCaption || `Table ${tables.length + 1}`;
          let caption = rawCaption.startsWith('Table') && rawCaption !== `Table ${tables.length + 1}` 
            ? cleanTableCaption(rawCaption) 
            : rawCaption;
          let label = `tab:table${tables.length + 1}`;
          
          // Remove duplicate caption rows from table data using improved detection
          const originalCaption = externalCaption || internalCaption;
          if (originalCaption) {
            tableRows = tableRows.filter(row => 
              !isTableCaptionRow(row, tables.length + 1, originalCaption)
            );
          }
          
          // Generate clean label from caption
          const captionForLabel = externalCaption || internalCaption;
          if (captionForLabel) {
            const cleanCaption = captionForLabel.toLowerCase()
              .replace(/[^a-z0-9\s]/g, '')
              .replace(/\s+/g, '_')
              .substring(0, 20);
            label = `tab:${cleanCaption}`;
          }
          
          tables.push({
            id: tables.length + 1,
            rows: tableRows.length,
            columns: tableRows[0]?.length || 0,
            data: tableRows,
            confidence: 1.0,
            caption,
            label,
            startLine: tableStartIndex,
            endLine: i
          });
        }
        
        tableStartIndex = -1;
      }
    }
  }
  
  return tables;
};

// Detect sections in .txt files (enhanced from original)
const detectTxtSections = (textLines: TextLine[], tableContent: Set<string>, tables: TableData[] = [], equations: Equation[] = []): Section[] => {
  const sectionsFound: Array<{
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
    startLineIndex?: number;
    endLineIndex?: number;
  }> = [];
  
  textLines.forEach((line, index) => {
    const text = line.fullText;
    
    // Skip if this text appears in tables
    if (line.isInTable) {
      return;
    }
    
    // Enhanced pattern matching for manually typed sections
    const pattern1 = text.match(/^(\d+)\.\s+(.+)$/);           // "1. Introduction"
    const pattern2 = text.match(/^(\d+\.\d+)\s+(.+)$/);        // "4.1 Performance Metrics"
    const pattern3 = text.match(/^(\d+\.\d+\.\d+)\s+(.+)$/);   // "4.1.1 Implementation"
    const pattern4 = text.match(/^([IVX]+)\.\s+(.+)$/i);       // "I. Introduction"
    
    if (pattern1 || pattern2 || pattern3 || pattern4) {
      const match = pattern1 || pattern2 || pattern3 || pattern4;
      const title = match![2];
      
      // Additional table content filtering
      const titleInTable = Array.from(tableContent).some(tableText => 
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

  // Extract content for each section with direct equation replacement (no placeholders)
  sectionsFound.forEach((section) => {
    let content = '';
    let contentWordCount = 0;
    const maxWords = 500; // Increased from 25 to get full content for LaTeX
    
    // Store section boundaries for equation placement
    section.startLineIndex = section.lineIndex;
    const nextSectionIndex = sectionsFound.findIndex(s => s.lineIndex > section.lineIndex);
    section.endLineIndex = nextSectionIndex >= 0 ? sectionsFound[nextSectionIndex].lineIndex - 1 : textLines.length - 1;
    
    // Using placeholder approach for equations to avoid word count truncation issues
    
    // Start from the line after the section heading
    for (let i = section.lineIndex + 1; i < textLines.length; i++) {
      const nextLine = textLines[i];
      let nextText = nextLine.fullText;
      
      // Stop if we hit another section
      const isNextSection = /^(\d+\.|\d+\.\d+\.|\d+\.\d+\.\d+\.?|[IVX]+\.)\s+/.test(nextText);
      if (isNextSection) break;
      
      // Replace table content with placeholders
      if (nextLine.isInTable) {
        // Find which table this line belongs to
        const tableForLine = tables.find(table => 
          table.startLine && table.endLine && 
          i >= table.startLine && i <= table.endLine
        );
        
        if (tableForLine && !content.includes(`[TABLE_${tableForLine.id}]`)) {
          // Add table placeholder only once per table
          content += (content ? ' ' : '') + `[TABLE_${tableForLine.id}]`;
          contentWordCount += 2; // Count as 2 words
        }
        continue;
      }
      
      // STEP 1: Insert equation placeholders (to be replaced later in LaTeX generation)
      equations.forEach((equation) => {
        if (!equation.latexEquivalent) return;
        
        console.log(`🔍 Checking equation ${equation.id}: "${equation.content}" (latex: ${equation.latexEquivalent})`);
        console.log(`🔍 Line text: "${nextText}"`);
        
        // Try multiple matching strategies
        let matchFound = false;
        let matchType = '';
        const equationPlaceholder = `[EQUATION_${equation.id}]`;
        
        // Strategy 1: Exact content match
        if (nextText.includes(equation.content)) {
          nextText = nextText.replace(equation.content, equationPlaceholder);
          matchFound = true;
          matchType = 'exact content';
        }
        // Strategy 2: Original match if available
        else if (equation.originalMatch && nextText.includes(equation.originalMatch)) {
          nextText = nextText.replace(equation.originalMatch, equationPlaceholder);
          matchFound = true;
          matchType = 'original match';
        }
        // Strategy 3: Context-based matching (equation indicators)
        else if (nextText.match(/(below\s+is\s+my\s+.*?equation|here\s+is\s+.*?equation|equation\s+follows|mathematical\s+expression)/i)) {
          // This line indicates an equation should be placed here
          nextText = nextText + ` ${equationPlaceholder}`;
          matchFound = true;
          matchType = 'context indicator';
        }
        // Strategy 4: Normalized content match (remove extra spaces, special chars)
        else {
          const normalizedContent = equation.content.replace(/\s+/g, ' ').trim();
          const normalizedLine = nextText.replace(/\s+/g, ' ').trim();
          if (normalizedLine.includes(normalizedContent)) {
            nextText = nextText.replace(equation.content, equationPlaceholder);
            matchFound = true;
            matchType = 'normalized content';
          }
          // Strategy 5: Partial content match (for complex equations)
          else {
            const contentWords = equation.content.split(/\s+/).filter(w => w.length > 2);
            if (contentWords.length > 0) {
              const hasAllWords = contentWords.every(word => nextText.includes(word));
              if (hasAllWords && contentWords.length >= 2) {
                // Only replace if we can find the original content approximately
                const contentRegex = new RegExp(contentWords.join('\\s*.*?\\s*'), 'i');
                if (contentRegex.test(nextText)) {
                  nextText = nextText.replace(contentRegex, equationPlaceholder);
                  matchFound = true;
                  matchType = 'partial word match';
                }
              }
            }
          }
        }
        
        if (matchFound) {
          console.log(`✅ Placed equation ${equation.id} placeholder using ${matchType} in section "${section.title}" at line ${i}`);
        } else {
          console.log(`❌ No match found for equation ${equation.id} in line: "${nextText.substring(0, 100)}..."`);
        }
      });
      
      // STEP 2: Handle table references
      const tableReferences = nextText.match(/Table\s+(\d+)/gi);
      if (tableReferences) {
        for (const ref of tableReferences) {
          const tableNum = parseInt(ref.match(/\d+/)?.[0] || '0');
          if (tableNum > 0 && tableNum <= tables.length) {
            const placeholder = `[TABLE_${tableNum}]`;
            if (!content.includes(placeholder)) {
              // Insert table placeholder after the reference sentence
              nextText = nextText.replace(ref, `${ref} ${placeholder}`);
            }
          }
        }
      }
      
      // STEP 3: Smart table content filtering - only remove COMPLETE table headings, preserve references
      let isTableContentLine = false;
      
      // Check if this line IS the complete table heading that should be excluded
      tables.forEach(table => {
        if (table.caption && table.caption.trim().length > 10) {
          const captionText = table.caption.trim().toLowerCase();
          const lineTextLower = nextText.toLowerCase().trim();
          
          // Only exclude if this line IS the table caption (exact match or very close match)
          // NOT if it just contains a reference like "as shown in Table 1"
          const similarity = calculateTextSimilarity(lineTextLower, captionText);
          if (similarity > 0.8) { // 80% similarity means it's likely the actual heading
            isTableContentLine = true;
            console.log(`🚫 Filtering out table heading line (${Math.round(similarity*100)}% match): "${nextText.substring(0, 50)}..."`);
          }
          
          // Also check for exact table caption without "Table X:" prefix
          const cleanedCaption = table.caption.replace(/^Table\s+\d+\s*[:\-.]\s*/i, '').trim().toLowerCase();
          if (cleanedCaption.length > 10 && lineTextLower === cleanedCaption) {
            isTableContentLine = true;
            console.log(`🚫 Filtering out cleaned table caption: "${nextText.substring(0, 50)}..."`);
          }
        }
      });
      
      // Skip lines that are actual table headings (not references)
      if (isTableContentLine) {
        continue;
      }
      
      // STEP 4: Add content with word count management
      // Handle equation and table placeholders as single units when counting words
      const parts = nextText.split(/(\[EQUATION_\d+\]|\[TABLE_\d+\])/);
      let lineWordCount = 0;
      
      parts.forEach(part => {
        if (part.match(/^\[EQUATION_\d+\]$/) || part.match(/^\[TABLE_\d+\]$/)) {
          // Equation and table placeholders count as 1 unit each
          lineWordCount += 1;
        } else {
          // Regular text - count actual words
          const words = part.split(/\s+/).filter(word => word.trim().length > 0);
          lineWordCount += words.length;
        }
      });
      
      // Check if we have room for this line
      if (contentWordCount + lineWordCount > maxWords) {
        content += '...';
        break;
      }
      
      // Add the processed text
      content += (content ? ' ' : '') + nextText;
      contentWordCount += lineWordCount;
    }
    
    section.content = content.trim() || 'No content detected';
    section.contentPreview = content.trim().substring(0, 150) + (content.length > 150 ? '...' : '');
    section.wordCount = contentWordCount;
  });

  // Convert to final format
  return sectionsFound.map(section => ({
    number: section.number + (section.type === 'numbered' ? '.' : ''),
    title: section.title,
    content: section.content!,
    contentPreview: section.contentPreview!,
    level: section.level,
    type: section.type,
    confidence: section.confidence,
    reasoning: section.reasoning,
    originalText: section.fullText,
    wordCount: section.wordCount!,
    startLineIndex: section.startLineIndex,
    endLineIndex: section.endLineIndex
  }));
};

// Analyze DOCX document structure
const analyzeDocxStructure = (html: string, rawText: string, ommlEquations: Equation[], file: File): Omit<Analysis, 'rawHtml' | 'rawText' | 'fileName' | 'fileSize' | 'fileType'> & { sectionEquationMap: Map<number, number[]> } => {
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
    detectionMethod: 'none',
    sectionEquationMap: new Map<number, number[]>()
  };

  // Step 1: Detect equations FIRST (including OMML equations)
  analysis.equations = detectAllEquations(html, rawText, 'docx', ommlEquations);
  console.log(`🔬 Detected ${analysis.equations.length} equations in .docx file:`);
  analysis.equations.forEach(eq => {
    console.log(`  - Equation ${eq.id}: "${eq.content}" -> LaTeX: "${eq.latexEquivalent}"`);
  });

  // Step 2: Extract all table content first to avoid false section detection
  const tables = Array.from(doc.querySelectorAll('table'));
  tables.forEach((table, tableIndex) => {
    const rows = Array.from(table.querySelectorAll('tr'));
    let tableData = rows.map(row => 
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
    
    // Look for table caption in surrounding text
    let tableCaption = `Table ${tableIndex + 1}`;
    let tableLabel = `tab:table${tableIndex + 1}`;
    
    // Enhanced caption detection logic
    const findTableCaption = (): string | null => {
      // Method 1: Check immediate HTML siblings (expanded range)
      const tableParent = table.parentElement;
      if (tableParent) {
        // Look for previous siblings that might be captions (expanded to 7 elements)
        let prevElement = table.previousElementSibling;
        for (let i = 0; i < 7 && prevElement; i++) {
          const text = prevElement.textContent?.trim() || '';
          // Improved pattern matching for table captions
          if (text.match(/^Table\s+\d+\s*[:\-.]/)|| 
              (text.toLowerCase().includes('table') && text.includes(':') && text.length > 15 && text.length < 300) ||
              (text.length > 15 && text.length < 250 && text.toLowerCase().includes('analysis'))) {
            return text;
          }
          prevElement = prevElement.previousElementSibling;
        }
        
        // Check after table (expanded to 7 elements)
        let nextElement = table.nextElementSibling;
        for (let i = 0; i < 7 && nextElement; i++) {
          const text = nextElement.textContent?.trim() || '';
          if (text.match(/^Table\s+\d+\s*[:\-.]/)|| 
              (text.toLowerCase().includes('table') && text.includes(':') && text.length > 15 && text.length < 300)) {
            return text;
          }
          nextElement = nextElement.nextElementSibling;
        }
      }
      
      // Method 2: Search in raw text lines around table position
      const tableText = table.textContent?.trim() || '';
      if (tableText.length > 10) {
        // Find this table's position in the raw text
        const textLines = rawText.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
        
        // Look for table caption in nearby lines (within 10 lines before/after)
        for (let lineIndex = 0; lineIndex < textLines.length; lineIndex++) {
          const line = textLines[lineIndex];
          
          // Check if this line contains significant table content
          const tableWords = tableText.split(/\s+/).filter(word => word.length > 3);
          const lineContainsTableContent = tableWords.some(word => 
            line.toLowerCase().includes(word.toLowerCase())
          );
          
          if (lineContainsTableContent) {
            // Search around this line for captions
            for (let offset = -10; offset <= 10; offset++) {
              const checkIndex = lineIndex + offset;
              if (checkIndex >= 0 && checkIndex < textLines.length) {
                const checkLine = textLines[checkIndex];
                
                // Enhanced pattern for table captions
                if (checkLine.match(/^Table\s+\d+\s*[:\-.]/)||
                    (checkLine.toLowerCase().includes('table') && 
                     checkLine.includes(':') && 
                     checkLine.length > 20 && 
                     checkLine.length < 300 &&
                     (checkLine.toLowerCase().includes('analysis') || 
                      checkLine.toLowerCase().includes('comparison') ||
                      checkLine.toLowerCase().includes('results') ||
                      checkLine.toLowerCase().includes('summary') ||
                      checkLine.toLowerCase().includes('overview')))) {
                  return checkLine;
                }
              }
            }
            break; // Found table content, stop searching
          }
        }
      }
      
      return null;
    };
    
    const foundCaption = findTableCaption();
    if (foundCaption) {
      tableCaption = cleanTableCaption(foundCaption);
      
      // Remove duplicate caption rows from table data using improved detection
      tableData = tableData.filter(row => 
        !isTableCaptionRow(row, tableIndex + 1, foundCaption)
      );
    }
    
    // Generate clean label from caption
    if (tableCaption !== `Table ${tableIndex + 1}`) {
      const cleanCaption = tableCaption.toLowerCase()
        .replace(/[^a-z0-9\s]/g, '')
        .replace(/\s+/g, '_')
        .substring(0, 20);
      tableLabel = `tab:${cleanCaption}`;
    }
    
    analysis.tables.push({
      id: tableIndex + 1,
      rows: tableData.length,
      columns: tableData[0] ? tableData[0].length : 0,
      data: tableData, // Include all data, not just first 5 rows
      confidence: 1.0,
      caption: tableCaption,
      label: tableLabel
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
  analysis.sections = detectTxtSections(analysis.textLines, analysis.tableContent, analysis.tables, analysis.equations);
  analysis.detectionMethod = analysis.sections.length > 0 ? 'success' : 'failed';

  // Step 5: Detect document elements
  detectDocumentElements(analysis);

  // Step 6: Section-equation mapping no longer needed - equations are placed via placeholders

  return analysis;
};

// Detect document elements (title, authors, abstract, keywords)
const detectDocumentElements = (analysis: {
  textLines: TextLine[];
  title: DetectedElement | null;
  authors: DetectedElement | null;
  abstract: DetectedElement | null;
  keywords: DetectedElement | null;
}): void => {
  // Title detection (first substantial line, not in table, not a section)
  const titleCandidate = analysis.textLines.find((line: TextLine) => 
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
  if (analysis.title && titleCandidate) {
    const authorCandidate = analysis.textLines.find((line: TextLine) => 
      line.index > titleCandidate.index && 
      line.index < titleCandidate.index + 3 &&
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

  // Abstract detection - improved to handle multiple paragraphs
  const abstractLineIndex = analysis.textLines.findIndex((line: TextLine) => line.containsAbstract);
  if (abstractLineIndex !== -1) {
    const abstractLine = analysis.textLines[abstractLineIndex];
    let abstractText = abstractLine.fullText;
    
    // Remove the "Abstract" prefix and any separators (-, :, —)
    abstractText = abstractText.replace(/^abstract[\s\-:—]+/i, '');
    
    // Collect following paragraphs until we hit a section or keywords
    for (let i = abstractLineIndex + 1; i < analysis.textLines.length; i++) {
      const nextLine = analysis.textLines[i];
      
      // Stop if we hit keywords, sections, or another major element
      if (nextLine.containsKeywords || 
          nextLine.startsWithNumber || 
          nextLine.startsWithRoman ||
          nextLine.isInTable) {
        break;
      }
      
      // Add this paragraph to abstract
      if (nextLine.fullText.trim().length > 20) {
        abstractText += '\n' + nextLine.fullText;
      }
    }
    
    analysis.abstract = {
      text: abstractText.trim(),
      confidence: 0.95,
      reasoning: 'Multi-paragraph abstract detected starting with "Abstract"'
    };
  }

  // Keywords detection
  const keywordLine = analysis.textLines.find((line: TextLine) => line.containsKeywords);
  if (keywordLine) {
    let keywordText = keywordLine.fullText;
    
    // Remove the "Keywords" or "Index Terms" prefix and any separators (-, :, —)
    keywordText = keywordText.replace(/^(keywords|index terms)[\s\-:—]+/i, '');
    
    analysis.keywords = {
      text: keywordText.trim(),
      confidence: 0.95,
      reasoning: 'Keywords detected and prefix removed'
    };
  }
};

// Main parsing function that routes to appropriate parser
export const parseDocument = async (file: File): Promise<Analysis> => {
  const fileName = file.name.toLowerCase();
  
  if (fileName.endsWith('.txt')) {
    return await parseTxtFile(file);
  } else if (fileName.endsWith('.docx')) {
    return await parseDocxFile(file);
  } else {
    throw new Error('Unsupported file type. Please upload a .txt or .docx file.');
  }
};