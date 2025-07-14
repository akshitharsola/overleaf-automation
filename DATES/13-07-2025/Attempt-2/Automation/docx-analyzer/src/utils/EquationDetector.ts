// Enhanced equation detection combining .txt pattern matching and .docx OMML extraction
import { Equation } from '../types/DocumentTypes';

// Enhanced OMML to LaTeX converter with proper namespace handling
export const convertOMMLToLatex = (ommlXml: string): string => {
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
export const extractEquationsFromDocxXml = async (file: File): Promise<Equation[]> => {
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
          try {
            // Convert OMML to LaTeX
            const latexContent = convertOMMLToLatex(match);
            
            // Clean up the LaTeX content
            const cleanContent = latexContent
              .replace(/\s+/g, ' ')
              .replace(/\\ +/g, ' ')
              .trim();
            
            if (cleanContent && cleanContent.length > 1) {
              equations.push({
                id: equations.length + 1,
                content: cleanContent,
                originalMatch: match.substring(0, 500),
                type: `omml_pattern_${patternIndex + 1}`,
                confidence: 0.98,
                source: `OMML Pattern ${patternIndex + 1} extraction`,
                startPosition: index,
                latexEquivalent: cleanContent
              });
              console.log(`✅ Added equation: ${cleanContent}`);
            }
          } catch (error) {
            console.error(`❌ Error processing equation ${index}:`, error);
          }
        });
      }
    });
    
    console.log(`🎯 Total equations extracted: ${equations.length}`);
    return equations;
  } catch (error) {
    console.error('Error extracting equations from DOCX:', error);
    return [];
  }
};

// Detect equations in text files using pattern matching
export const detectTextEquations = (rawText: string): Equation[] => {
  const equations: Equation[] = [];
  
  // Helper function to check if content is a citation (exclude from equations)
  const isCitation = (content: string): boolean => {
    // Patterns for citations: {Author2023}, {Smith et al. 2021}, etc.
    const citationPatterns = [
      /^{[A-Za-z]+\d{4}}$/,                    // {Author2023}
      /^{[A-Za-z\s&,.]+\d{4}}$/,              // {Smith et al. 2021}
      /^{[A-Za-z]+\s*\d{4}[a-z]?}$/,          // {Smith 2023a}
      /^\\[A-Za-z]+\{\d{4}\}$/,               // \cite{2023}
      /^\\[A-Za-z]+\{[A-Za-z\s,&.]+\d{4}[a-z]?\}$/  // \cite{Author2023}
    ];
    
    return citationPatterns.some(pattern => pattern.test(content.trim()));
  };
  
  // LaTeX pattern detection (enhanced from original .txt processor)
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
    },
    {
      name: 'LaTeX Integral',
      pattern: /\\int|∫/g,
      type: 'integral',
      confidence: 0.85
    },
    {
      name: 'LaTeX Square Root',
      pattern: /\\sqrt\{[^}]+\}|√/g,
      type: 'square_root',
      confidence: 0.85
    }
  ];

  // Process each pattern
  latexPatterns.forEach(patternInfo => {
    const matches = Array.from(rawText.matchAll(patternInfo.pattern));
    
    matches.forEach((match) => {
      const content = match[1] || match[0];
      if (content && content.trim().length > 1 && !isCitation(content)) {
        // Check for duplicates
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
            contextAfter: rawText.substring(match.index! + match[0].length, match.index! + match[0].length + 50),
            latexEquivalent: convertToLaTeX(cleanContent)
          });
        }
      }
    });
  });

  // Mathematical symbols detection
  const mathSymbolPatterns = [
    {
      name: 'Greek Letters',
      pattern: /[αβγδεζηθικλμνξοπρστυφχψωΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ]/g,
      type: 'greek_symbols',
      confidence: 0.70
    },
    {
      name: 'Mathematical Operators',
      pattern: /[±×÷≤≥≠≈∞∑∏∫√∂∇]/g,
      type: 'math_operators',
      confidence: 0.75
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
      if (content && content.trim().length > 1 && !isCitation(content)) {
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
            contextAfter: rawText.substring(match.index! + match[0].length, match.index! + match[0].length + 30),
            latexEquivalent: convertToLaTeX(content.trim())
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

// Universal equation detection for both file types
export const detectAllEquations = (html: string, rawText: string, fileType: 'txt' | 'docx', ommlEquations: Equation[] = []): Equation[] => {
  let equations: Equation[] = [];
  
  if (fileType === 'docx') {
    // Start with OMML equations for DOCX files
    equations = [...ommlEquations];
    
    // Add HTML-based detection for Cambria Math font
    try {
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
              source: 'Cambria Math font detection',
              latexEquivalent: convertToLaTeX(content)
            });
          }
        }
      });
    } catch (error) {
      console.error('HTML parsing error:', error);
    }
  }
  
  // Add text-based equation detection for both file types
  const textEquations = detectTextEquations(rawText);
  
  // Merge and deduplicate
  textEquations.forEach(textEq => {
    const isDuplicate = equations.some(eq => 
      eq.content.includes(textEq.content) || 
      textEq.content.includes(eq.content) ||
      Math.abs((eq.startPosition || 0) - (textEq.startPosition || 0)) < 10
    );
    
    if (!isDuplicate) {
      equations.push(textEq);
    }
  });
  
  return equations
    .filter(eq => eq.confidence > 0.60)
    .sort((a, b) => {
      if (b.confidence !== a.confidence) return b.confidence - a.confidence;
      return (a.startPosition || 0) - (b.startPosition || 0);
    });
};

// Convert Unicode symbols to LaTeX equivalents
export const convertToLaTeX = (content: string): string => {
  if (!content) return content;
  
  let latex = content;
  
  const conversions: Record<string, string> = {
    // Greek letters
    'α': '\\alpha', 'β': '\\beta', 'γ': '\\gamma', 'δ': '\\delta',
    'ε': '\\varepsilon', 'ζ': '\\zeta', 'η': '\\eta', 'θ': '\\theta',
    'ι': '\\iota', 'κ': '\\kappa', 'λ': '\\lambda', 'μ': '\\mu',
    'ν': '\\nu', 'ξ': '\\xi', 'ο': '\\omicron', 'π': '\\pi',
    'ρ': '\\rho', 'σ': '\\sigma', 'τ': '\\tau', 'υ': '\\upsilon',
    'φ': '\\phi', 'χ': '\\chi', 'ψ': '\\psi', 'ω': '\\omega',
    
    // Uppercase Greek letters
    'Α': '\\Alpha', 'Β': '\\Beta', 'Γ': '\\Gamma', 'Δ': '\\Delta',
    'Ε': '\\Epsilon', 'Ζ': '\\Zeta', 'Η': '\\Eta', 'Θ': '\\Theta',
    'Ι': '\\Iota', 'Κ': '\\Kappa', 'Λ': '\\Lambda', 'Μ': '\\Mu',
    'Ν': '\\Nu', 'Ξ': '\\Xi', 'Ο': '\\Omicron', 'Π': '\\Pi',
    'Ρ': '\\Rho', 'Σ': '\\Sigma', 'Τ': '\\Tau', 'Υ': '\\Upsilon',
    'Φ': '\\Phi', 'Χ': '\\Chi', 'Ψ': '\\Psi', 'Ω': '\\Omega',
    
    // Mathematical operators
    '±': '\\pm', '∓': '\\mp', '×': '\\times', '÷': '\\div',
    '≤': '\\leq', '≥': '\\geq', '≠': '\\neq', '≈': '\\approx',
    '∞': '\\infty', '∑': '\\sum', '∏': '\\prod', '∫': '\\int',
    '√': '\\sqrt', '∂': '\\partial', '∇': '\\nabla',
    
    // Clean up extra spaces
    '\\ ': ' ', '\\  ': ' '
  };
  
  // Apply conversions with global replacement
  Object.entries(conversions).forEach(([unicode, latexCmd]) => {
    const escapedUnicode = unicode.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    latex = latex.replace(new RegExp(escapedUnicode, 'g'), latexCmd);
  });
  
  // Additional safety conversions for common problematic characters
  const additionalConversions: Record<string, string> = {
    'θ': '\\theta',    // Ensure theta is converted
    'Σ': '\\Sigma',    // Ensure capital sigma is converted  
    '∞': '\\infty',    // Ensure infinity is converted
    'π': '\\pi',       // Ensure pi is converted
    'ε': '\\varepsilon', // Ensure epsilon is converted
    'Π': '\\Pi',       // Ensure capital pi is converted
    '∑': '\\sum',      // Ensure summation is converted
    '∫': '\\int',      // Ensure integral is converted
    '√': '\\sqrt{}',   // Square root with braces
    '±': '\\pm',       // Plus-minus
    '≤': '\\leq',      // Less than or equal
    '≥': '\\geq'       // Greater than or equal
  };
  
  Object.entries(additionalConversions).forEach(([unicode, latexCmd]) => {
    latex = latex.replace(new RegExp(unicode, 'g'), latexCmd);
  });
  
  return latex.replace(/\s+/g, ' ').trim();
};

// Helper function to load JSZip dynamically
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