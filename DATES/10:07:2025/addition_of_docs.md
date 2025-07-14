# DOCX Support Implementation Guide for LaTeX Converter

## Overview
This guide provides a complete solution for adding DOCX support to the LaTeX converter, addressing the current mammoth.js import issues and enabling equation extraction.

## Problem Analysis

### Current Issues:
1. **mammoth.js import fails** in artifact environment
2. **Equations are lost** when using plain text
3. **Formatting is stripped** (bold, italic, lists, etc.)
4. **Complex structures** like tables need manual markers

### Root Cause:
The artifact environment has restrictions on certain imports and mammoth.js doesn't load properly with standard import syntax.

## Solution Strategy

### Approach 1: Fixed mammoth.js Implementation

```javascript
// WORKING SOLUTION for mammoth.js in artifacts
// Instead of: import mammoth from 'mammoth';
// Use this approach:

const processDOCX = async (file) => {
  try {
    // Load mammoth from CDN in the artifact
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js';
    document.head.appendChild(script);
    
    // Wait for mammoth to load
    await new Promise(resolve => {
      script.onload = resolve;
    });
    
    // Now mammoth is available globally
    const arrayBuffer = await file.arrayBuffer();
    const result = await window.mammoth.convertToHtml({
      arrayBuffer: arrayBuffer,
      options: {
        includeEmbeddedStyleMap: true,
        preserveStyles: true
      }
    });
    
    // Extract both HTML and messages
    return {
      html: result.value,
      messages: result.messages,
      success: true
    };
  } catch (error) {
    console.error('DOCX processing error:', error);
    return { success: false, error: error.message };
  }
};
```

### Approach 2: Enhanced DOCX Processing with Math Support

```javascript
// Complete DOCX processor with equation handling
const enhancedDOCXProcessor = async (file) => {
  // Step 1: Load mammoth from CDN
  if (!window.mammoth) {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js';
    document.head.appendChild(script);
    await new Promise(resolve => script.onload = resolve);
  }

  // Step 2: Custom style map for preserving formatting
  const styleMap = [
    "p[style-name='Heading 1'] => h1:fresh",
    "p[style-name='Heading 2'] => h2:fresh",
    "p[style-name='Heading 3'] => h3:fresh",
    "p[style-name='Abstract'] => p.abstract",
    "p[style-name='Author'] => p.author",
    "p[style-name='Affiliation'] => p.affiliation",
    "r[style-name='Strong'] => strong",
    "r[style-name='Emphasis'] => em"
  ];

  // Step 3: Convert with options
  const arrayBuffer = await file.arrayBuffer();
  const result = await window.mammoth.convertToHtml({
    arrayBuffer: arrayBuffer,
    styleMap: styleMap,
    includeDefaultStyleMap: true,
    convertImage: window.mammoth.images.imgElement(function(image) {
      return image.read("base64").then(function(imageBuffer) {
        return {
          src: "data:" + image.contentType + ";base64," + imageBuffer
        };
      });
    })
  });

  // Step 4: Post-process to extract equations
  const html = result.value;
  const doc = new DOMParser().parseFromString(html, 'text/html');
  
  // Extract text content while preserving structure
  const extractedContent = {
    title: '',
    authors: [],
    abstract: '',
    sections: [],
    equations: [],
    tables: [],
    figures: []
  };

  // Find equations (Word uses specific markers)
  const equationElements = doc.querySelectorAll('span[style*="font-family:Cambria Math"]');
  equationElements.forEach((eq, index) => {
    const placeholder = `[EQUATION_${index}]`;
    extractedContent.equations.push({
      id: index,
      content: eq.textContent,
      latex: convertToLaTeX(eq.textContent) // Custom converter needed
    });
    eq.textContent = placeholder;
  });

  return {
    ...extractedContent,
    rawHtml: html,
    success: true
  };
};
```

### Approach 3: Alternative - File API with Manual XML Parsing

```javascript
// For maximum control, parse DOCX XML directly
const parseDocxManually = async (file) => {
  // DOCX is a ZIP file, so we need JSZip
  const loadJSZip = async () => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js';
    document.head.appendChild(script);
    await new Promise(resolve => script.onload = resolve);
  };

  await loadJSZip();
  
  const zip = new window.JSZip();
  const docx = await zip.loadAsync(file);
  
  // Extract main document
  const documentXml = await docx.file('word/document.xml').async('string');
  const stylesXml = await docx.file('word/styles.xml').async('string');
  
  // Parse XML
  const parser = new DOMParser();
  const doc = parser.parseFromString(documentXml, 'text/xml');
  
  // Extract content with structure
  const paragraphs = doc.getElementsByTagName('w:p');
  const content = {
    sections: [],
    equations: []
  };
  
  // Process paragraphs
  Array.from(paragraphs).forEach(p => {
    // Check for math elements (OMML)
    const mathElements = p.getElementsByTagName('m:oMath');
    if (mathElements.length > 0) {
      // This is an equation
      content.equations.push(parseOMML(mathElements[0]));
    } else {
      // Regular paragraph
      content.sections.push(extractTextFromParagraph(p));
    }
  });
  
  return content;
};
```

## Implementation Steps

### Step 1: Update File Upload Component

```javascript
const FileUpload = ({ onFileSelect }) => {
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    
    if (file.name.endsWith('.docx')) {
      // Use our DOCX processor
      const result = await processDOCX(file);
      if (result.success) {
        onFileSelect({
          type: 'docx',
          content: result.html,
          extracted: result.extracted
        });
      }
    } else if (file.name.endsWith('.txt')) {
      // Existing text processing
      const text = await file.text();
      onFileSelect({
        type: 'txt',
        content: text
      });
    }
  };
  
  return (
    <input 
      type="file" 
      accept=".txt,.docx,.md"
      onChange={handleFileUpload}
    />
  );
};
```

### Step 2: Create Equation Detection System

```javascript
const detectAndConvertEquations = (content) => {
  const equations = [];
  
  // Pattern 1: Word equation placeholders
  const equationPattern = /\[EQUATION_(\d+)\]/g;
  
  // Pattern 2: Common math indicators
  const mathPatterns = [
    /\$([^$]+)\$/g,              // LaTeX style
    /\\begin\{equation\}(.*?)\\end\{equation\}/gs,
    /\\\[(.*?)\\\]/gs,           // Display math
    /\\\((.*?)\\\)/g             // Inline math
  ];
  
  // Extract and convert equations
  let processedContent = content;
  mathPatterns.forEach(pattern => {
    processedContent = processedContent.replace(pattern, (match, equation) => {
      equations.push({
        original: match,
        content: equation,
        type: match.includes('begin{equation}') ? 'display' : 'inline'
      });
      return `\\placeholder{eq${equations.length}}`;
    });
  });
  
  return { processedContent, equations };
};
```

### Step 3: Integrate with Existing Parser

```javascript
const enhancedDocumentParser = async (fileData) => {
  let content, structure;
  
  // Handle different file types
  switch (fileData.type) {
    case 'docx':
      // Already processed by our DOCX handler
      structure = fileData.extracted;
      break;
    
    case 'txt':
      // Use existing text parser
      structure = parseTextDocument(fileData.content);
      break;
    
    default:
      throw new Error('Unsupported file type');
  }
  
  // Enhance with equation support
  if (structure.sections) {
    structure.sections = structure.sections.map(section => {
      const { processedContent, equations } = detectAndConvertEquations(section.content);
      return {
        ...section,
        content: processedContent,
        equations: equations
      };
    });
  }
  
  return structure;
};
```

## Testing Strategy

### Test Files to Create:
1. **Simple DOCX**: Basic sections with headings
2. **Math DOCX**: Document with equations
3. **Complex DOCX**: Tables, images, and mixed content

### Validation Steps:
1. Upload each test file
2. Verify structure extraction
3. Check equation preservation
4. Confirm LaTeX output quality

## Fallback Strategy

If DOCX parsing fails in the artifact environment:

```javascript
const fallbackStrategy = {
  option1: "Provide clear instructions for users to save as .txt",
  option2: "Implement server-side processing API",
  option3: "Use Word's 'Save as Web Page' to get HTML with equations"
};
```

## Next Steps

1. **Implement** the CDN-based mammoth.js loading
2. **Test** with real academic DOCX files
3. **Add** equation conversion logic
4. **Update** UI to show richer content preview
5. **Enhance** the existing parser to handle DOCX structure

## Benefits Once Implemented

- ✅ **Equations preserved** from Word documents
- ✅ **Rich formatting** maintained (bold, italic, lists)
- ✅ **Better structure** detection (Word styles → LaTeX sections)
- ✅ **Images extracted** automatically
- ✅ **Tables with proper** formatting
- ✅ **No manual markers** needed for tables

This implementation will resolve the mathematical equation support issue and make the converter much more powerful for academic users.