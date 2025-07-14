import React, { useState, useCallback } from 'react';
import { Upload, Download, Copy, AlertCircle, CheckCircle, FileText, Table, Settings } from 'lucide-react';

const LaTeXTableProcessor = () => {
  const [activeTab, setActiveTab] = useState('upload');
  const [inputText, setInputText] = useState('');
  const [parsedData, setParsedData] = useState(null);
  const [selectedTemplate, setSelectedTemplate] = useState('ieee');
  const [enableCompression, setEnableCompression] = useState(false);
  const [generatedLaTeX, setGeneratedLaTeX] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);

  // Template configurations - CORRECTED ACM AND TABLE FORMATTING
  const templates = {
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
      singleColumn: false, // ACM is two-column format
      documentClass: 'acmart',
      options: 'sigconf'
    },
    springer: {
      name: 'Springer LNCS',
      tableStyle: 'springer', 
      packages: ['booktabs'],
      singleColumn: false, // Springer can be single or double
      documentClass: 'llncs',
      options: ''
    }
  };

  // Comprehensive abbreviation dictionary for IEEE compression
  const abbreviationMap = {
    'advantages': 'Advs.',
    'limitations': 'Limits',
    'performance': 'Perf.',
    'security': 'Sec.',
    'accuracy': 'Acc.',
    'real-time': 'RT',
    'environment': 'Env.',
    'dependent': 'Dep.',
    'detection': 'Det.',
    'interference': 'Interf.',
    'processing': 'Proc.',
    'intensive': 'Intens.',
    'comprehensive': 'Comp.',
    'framework': 'FW',
    'resource': 'Res.',
    'management': 'Mgmt.',
    'integrate': 'Integ.',
    'biometric': 'Bio.',
    'systems': 'Sys.',
    'methods': 'Meth.',
    'authentication': 'Auth.',
    'validation': 'Valid.',
    'presence': 'Pres.',
    'proximity': 'Prox.',
    'physical': 'Phys.',
    'anti-spoofing': 'Anti-spoof'
  };

  // Parse text with table detection using ||====|| format
  const parseText = useCallback((text) => {
    if (!text.trim()) return null;
    
    const lines = text.split('\n').map(line => line.trim()).filter(line => line);
    
    const result = {
      title: '',
      authors: '',
      abstract: '',
      keywords: '',
      sections: [],
      tables: [],
      rawText: text
    };
    
    let currentIndex = 0;
    
    // Extract title (first line)
    if (lines.length > 0) {
      result.title = lines[0].replace(/^title:\s*/i, '').trim() || 'Document Title';
      currentIndex = 1;
    }
    
    // Extract authors (line before abstract or second line)
    for (let i = currentIndex; i < lines.length; i++) {
      const line = lines[i];
      if (/^abstract[:\-—]/i.test(line)) {
        if (i > currentIndex) {
          result.authors = lines[i - 1] || 'Author Name';
        }
        break;
      }
    }
    
    if (!result.authors && lines.length > 1) {
      result.authors = lines[1] || 'Author Name';
    }
    
    // Extract abstract
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^abstract[:\-—]/i.test(line)) {
        let abstractContent = line.replace(/^abstract[:\-—]\s*/i, '');
        
        for (let j = i + 1; j < lines.length; j++) {
          const nextLine = lines[j];
          if (/^(keywords|index terms)[:\-—]/i.test(nextLine) || 
              /^\d+\.?\s*/.test(nextLine) || 
              /^[IVX]+\.?\s*/.test(nextLine)) {
            break;
          }
          abstractContent += ' ' + nextLine;
        }
        
        result.abstract = abstractContent.trim();
        break;
      }
    }
    
    // Extract keywords
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^(keywords|index terms)[:\-—]/i.test(line)) {
        let keywordContent = line.replace(/^(keywords|index terms)[:\-—]\s*/i, '');
        
        for (let j = i + 1; j < lines.length; j++) {
          const nextLine = lines[j];
          if (/^\d+\.?\s*/.test(nextLine) || /^[IVX]+\.?\s*/.test(nextLine)) {
            break;
          }
          keywordContent += ' ' + nextLine;
        }
        
        result.keywords = keywordContent.trim();
        break;
      }
    }
    
    // Extract tables using ||====|| format - ENHANCED WITH INTERNAL CAPTION DETECTION
    let tableStartIndex = -1;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (line === '||====||') {
        if (tableStartIndex === -1) {
          tableStartIndex = i;
        } else {
          // Found table end
          const tableLines = lines.slice(tableStartIndex + 1, i);
          const tableRows = [];
          let internalCaption = null;
          
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
            // Priority: 1) Internal caption, 2) External caption, 3) Default
            let caption = `Table ${result.tables.length + 1}`;
            let label = `tab:table${result.tables.length + 1}`;
            
            if (internalCaption) {
              caption = internalCaption;
            } else {
              // Look for table caption BEFORE the table start (fallback)
              for (let j = Math.max(0, tableStartIndex - 3); j < tableStartIndex; j++) {
                const potentialCaption = lines[j];
                if (potentialCaption && 
                    (potentialCaption.toLowerCase().includes('table') || 
                     potentialCaption.includes(':') || 
                     potentialCaption.toLowerCase().includes('analysis'))) {
                  caption = potentialCaption;
                  break;
                }
              }
            }
            
            // Generate clean label from caption
            const cleanCaption = caption.toLowerCase()
              .replace(/[^a-z0-9\s]/g, '')
              .replace(/\s+/g, '_')
              .substring(0, 20);
            label = `tab:${cleanCaption}`;
            
            result.tables.push({
              id: result.tables.length + 1,
              rows: tableRows,
              startLine: tableStartIndex,
              endLine: i,
              caption: caption,
              label: label
            });
          }
          
          tableStartIndex = -1;
        }
      }
    }
    
    // Extract sections (numbered and Roman) - FIXED SUBSECTION DETECTION
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Enhanced regex to catch ALL subsection formats: 4, 4.1, 4.1.1, etc.
      const numberedMatch = line.match(/^(\d+(?:\.\d+)*\.?)\s*(.+)$/);
      const romanMatch = line.match(/^([IVX]+\.?)\s*(.+)$/);
      
      let sectionMatch = null;
      let fullNumber = '';
      let sectionTitle = '';
      let level = 1;
      
      if (numberedMatch) {
        sectionMatch = numberedMatch;
        fullNumber = numberedMatch[1].replace(/\.$/, ''); // Remove trailing dot for processing
        sectionTitle = numberedMatch[2];
        // Calculate level based on number of dots: 4=1, 4.1=2, 4.1.1=3
        level = (fullNumber.match(/\./g) || []).length + 1;
      } else if (romanMatch) {
        sectionMatch = romanMatch;
        fullNumber = romanMatch[1];
        sectionTitle = romanMatch[2];
        level = 1;
      }
      
      if (sectionMatch) {
        let content = '';
        let usedTableIds = new Set();
        
        for (let j = i + 1; j < lines.length; j++) {
          const nextLine = lines[j];
          if (/^\d+(?:\.\d+)*\.?\s*/.test(nextLine) || /^[IVX]+\.?\s*/.test(nextLine)) {
            break;
          }
          
          const tableIndex = result.tables.findIndex(table => 
            j >= table.startLine && j <= table.endLine
          );
          
          if (tableIndex !== -1 && !usedTableIds.has(tableIndex)) {
            content += `[TABLE_${tableIndex + 1}] `;
            usedTableIds.add(tableIndex);
          } else if (tableIndex === -1) {
            content += nextLine + ' ';
          }
        }
        
        if (content.trim().length > 5) {
          result.sections.push({
            number: fullNumber + '.',
            title: sectionTitle,
            content: content.trim(),
            level: level,
            type: numberedMatch ? 'numbered' : 'roman'
          });
        }
      }
    }
    
    return result;
  }, []);

  // Apply text compression for IEEE format AND escape percent signs
  const compressText = (text) => {
    if (!text) return '';
    
    // FIRST: Escape percent signs to prevent LaTeX comment issues
    let processed = text.replace(/%/g, '\\%');
    
    // THEN: Apply compression if enabled
    if (enableCompression && selectedTemplate === 'ieee') {
      Object.entries(abbreviationMap).forEach(([full, abbrev]) => {
        const regex = new RegExp(`\\b${full}\\b`, 'gi');
        processed = processed.replace(regex, abbrev);
      });
    }
    
    return processed;
  };

  // Generate IEEE Table - RESTORED ORIGINAL + COMPRESSION PLACEMENT FIX
  const generateIEEETable = (table) => {
    const { rows } = table;
    if (!rows || rows.length === 0) return '';
    
    const colCount = rows[0].length;
    const processedRows = rows.map(row => 
      row.map(cell => compressText(cell || ''))
    );
    
    // EXACT original IEEE format that was working correctly
    const colSpec = Array(colCount).fill('|>{\\centering\\arraybackslash}p{0.15\\linewidth}').join('');
    
    // Add placement control ONLY when compression is enabled to prevent floating
    const placementSpec = enableCompression && selectedTemplate === 'ieee' ? '[!htb]' : '[]';
    
    let latex = `\\begin{table}${placementSpec}\n`;
    latex += `    \\centering\n`;
    latex += `     \\caption{\\textbf{${table.caption}}}\n`;
    latex += `    \\label{${table.label}}\n`;
    latex += `    \\begin{tabular}{${colSpec}|} \\hline\n`;
    
    // Header row
    latex += ` ${processedRows[0].join('& ')}\\\\ \\hline\n`;
    
    // Data rows
    for (let i = 1; i < processedRows.length; i++) {
      latex += `         ${processedRows[i].join('& ')}\\\\ \\hline\n`;
    }
    
    latex += `    \\end{tabular}\n`;
    latex += `   \n`;
    latex += `\\end{table}\n`;
    
    return latex;
  };

  // Generate ACM Table - FIXED POSITIONING
  const generateACMTable = (table) => {
    const { rows } = table;
    if (!rows || rows.length === 0) return '';
    
    const colCount = rows[0].length;
    const processedRows = rows.map(row => 
      row.map(cell => compressText(cell || ''))
    );
    
    // Calculate proper column width to prevent touching right edge
    const colWidth = Math.floor(90 / colCount); // Use 90% width with margins
    const colSpec = Array(colCount).fill(`p{0.${colWidth}\\linewidth}`).join('');
    
    let latex = `\\begin{table}[!htbp]\n`;
    latex += `  \\centering\n`;
    latex += `  \\caption{${table.caption}}\n`;
    latex += `  \\label{${table.label}}\n`;
    latex += `  \\begin{tabular}{${colSpec}}\n`;
    latex += `    \\toprule\n`;
    
    // Header row
    latex += `    ${processedRows[0].join(' & ')}\\\\\n`;
    latex += `    \\midrule\n`;
    
    // Data rows
    for (let i = 1; i < processedRows.length; i++) {
      latex += `    ${processedRows[i].join(' & ')}\\\\\n`;
    }
    
    latex += `    \\bottomrule\n`;
    latex += `  \\end{tabular}\n`;
    latex += `\\end{table}\n`;
    
    return latex;
  };

  // Generate Springer Table - FIXED POSITIONING
  const generateSpringerTable = (table) => {
    const { rows } = table;
    if (!rows || rows.length === 0) return '';
    
    const colCount = rows[0].length;
    const processedRows = rows.map(row => 
      row.map(cell => compressText(cell || ''))
    );
    
    // Calculate proper column width to prevent touching right edge
    const colWidth = Math.floor(85 / colCount); // Use 85% width with margins
    const colSpec = Array(colCount).fill(`p{0.${colWidth}\\linewidth}`).join('');
    
    let latex = `\\begin{table}[!htbp]\n`;
    latex += `\\centering\n`;
    latex += `\\caption{${table.caption}}\\label{${table.label}}\n`;
    latex += `\\begin{tabular}{${colSpec}}\n`;
    latex += `\\toprule\n`;
    
    // Header row
    latex += `${processedRows[0].join(' & ')} \\\\\n`;
    latex += `\\midrule\n`;
    
    // Data rows
    for (let i = 1; i < processedRows.length; i++) {
      latex += `${processedRows[i].join(' & ')} \\\\\n`;
    }
    
    latex += `\\bottomrule\n`;
    latex += `\\end{tabular}\n`;
    latex += `\\end{table}\n`;
    
    return latex;
  };

  // Main table generator that routes to specific formats
  const generateTable = (table, template) => {
    switch (template) {
      case 'ieee':
        return generateIEEETable(table);
      case 'acm':
        return generateACMTable(table);
      case 'springer':
        return generateSpringerTable(table);
      default:
        return generateIEEETable(table);
    }
  };

  // Generate complete LaTeX document
  const generateLaTeX = useCallback(() => {
    if (!parsedData) return '';
    
    const template = templates[selectedTemplate];
    let latex = '';
    
    // Document class and packages
    if (selectedTemplate === 'ieee') {
      latex += `\\documentclass[conference]{IEEEtran}\n`;
      latex += `\\usepackage{array}\n`;
      latex += `\\usepackage{booktabs}\n`;
      latex += `\\usepackage{graphicx}\n\n`;
    } else if (selectedTemplate === 'acm') {
      latex += `\\documentclass[sigconf]{acmart}\n`;
      latex += `\\usepackage{booktabs}\n`;
      latex += `\\usepackage{tabularx}\n\n`;
    } else if (selectedTemplate === 'springer') {
      latex += `\\documentclass{llncs}\n`;
      latex += `\\usepackage{booktabs}\n\n`;
    }
    
    latex += `\\begin{document}\n\n`;
    
    // Title and authors
    latex += `\\title{${parsedData.title}}\n`;
    if (selectedTemplate === 'ieee') {
      latex += `\\author{${parsedData.authors}}\n`;
    } else if (selectedTemplate === 'acm') {
      latex += `\\author{${parsedData.authors}}\n`;
      latex += `\\affiliation{%\n  \\institution{Your Institution}\n  \\country{Your Country}\n}\n`;
    } else if (selectedTemplate === 'springer') {
      latex += `\\author{${parsedData.authors}}\n`;
      latex += `\\institute{Your Institute \\email{your.email@domain.com}}\n`;
    }
    
    latex += `\\maketitle\n\n`;
    
    // Abstract
    if (parsedData.abstract) {
      latex += `\\begin{abstract}\n${parsedData.abstract}\n\\end{abstract}\n\n`;
    }
    
    // Keywords
    if (parsedData.keywords) {
      if (selectedTemplate === 'ieee') {
        latex += `\\begin{IEEEkeywords}\n${parsedData.keywords}\n\\end{IEEEkeywords}\n\n`;
      } else {
        latex += `\\keywords{${parsedData.keywords}}\n\n`;
      }
    }
    
    // Sections with tables - FIXED SECTION COMMANDS FOR PROPER HIERARCHY
    parsedData.sections.forEach(section => {
      // Map section levels to proper LaTeX commands
      let sectionCommand;
      if (section.level === 1) {
        sectionCommand = '\\section';
      } else if (section.level === 2) {
        sectionCommand = '\\subsection';
      } else if (section.level === 3) {
        sectionCommand = '\\subsubsection';
      } else {
        sectionCommand = '\\paragraph'; // For level 4 and beyond
      }
      
      latex += `${sectionCommand}{${section.title}}\n`;
      
      let content = section.content;
      
      // Replace table placeholders with actual tables
      parsedData.tables.forEach(table => {
        const placeholder = `[TABLE_${table.id}]`;
        if (content.includes(placeholder)) {
          const tableLatex = generateTable(table, selectedTemplate);
          content = content.replace(placeholder, `\n\n${tableLatex}\n`);
        }
      });
      
      latex += `${compressText(content)}\n\n`;
    });
    
    // Add any remaining tables not included in sections
    parsedData.tables.forEach(table => {
      let tableUsed = false;
      parsedData.sections.forEach(section => {
        if (section.content.includes(`[TABLE_${table.id}]`)) {
          tableUsed = true;
        }
      });
      
      if (!tableUsed) {
        latex += generateTable(table, selectedTemplate) + '\n';
      }
    });
    
    latex += `\\end{document}`;
    
    return latex;
  }, [parsedData, selectedTemplate, enableCompression]);

  // Handle file upload
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file && file.type === 'text/plain') {
      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target.result;
        setInputText(text);
        setActiveTab('preview');
      };
      reader.readAsText(file);
    }
  };

  // Handle text parsing
  const handleParse = () => {
    const parsed = parseText(inputText);
    setParsedData(parsed);
    setActiveTab('parse');
  };

  // Handle LaTeX generation
  const handleGenerate = () => {
    const latex = generateLaTeX();
    setGeneratedLaTeX(latex);
    setActiveTab('latex');
  };

  // Copy to clipboard
  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedLaTeX);
    setCopySuccess(true);
    setTimeout(() => setCopySuccess(false), 2000);
  };

  // Download LaTeX file
  const downloadLaTeX = () => {
    const blob = new Blob([generatedLaTeX], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${parsedData?.title || 'document'}.tex`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-white">
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white p-6 rounded-lg mb-6">
        <h1 className="text-3xl font-bold mb-2">LaTeX Table Processor</h1>
        <p className="text-blue-100">Convert structured text with tables to publication-ready LaTeX</p>
      </div>

      {/* Template Selection */}
      <div className="mb-6 p-4 bg-gray-50 rounded-lg">
        <div className="flex flex-wrap gap-4 items-center">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-gray-600" />
            <span className="font-medium">Template:</span>
          </div>
          {Object.entries(templates).map(([key, template]) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <input
                type="radio"
                name="template"
                value={key}
                checked={selectedTemplate === key}
                onChange={(e) => setSelectedTemplate(e.target.value)}
                className="text-blue-600"
              />
              <span className="text-sm">{template.name}</span>
            </label>
          ))}
        </div>
        
        {selectedTemplate === 'ieee' && (
          <div className="mt-3 pt-3 border-t border-gray-200">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={enableCompression}
                onChange={(e) => setEnableCompression(e.target.checked)}
                className="text-blue-600"
              />
              <span className="text-sm">Enable content compression for IEEE format</span>
              <span className="text-xs text-gray-500">(abbreviates common terms)</span>
            </label>
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="flex space-x-1 mb-6 bg-gray-100 p-1 rounded-lg">
        {[
          { id: 'upload', label: 'Upload', icon: Upload },
          { id: 'preview', label: 'Preview', icon: FileText },
          { id: 'parse', label: 'Parse', icon: Table },
          { id: 'latex', label: 'LaTeX', icon: Download }
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
              activeTab === id
                ? 'bg-blue-600 text-white'
                : 'text-gray-600 hover:bg-gray-200'
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="border rounded-lg p-6">
        {activeTab === 'upload' && (
          <div className="space-y-4">
            <div className="text-center">
              <input
                type="file"
                accept=".txt"
                onChange={handleFileUpload}
                className="hidden"
                id="fileInput"
              />
              <label
                htmlFor="fileInput"
                className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg cursor-pointer hover:bg-blue-700 transition-colors"
              >
                <Upload className="w-5 h-5" />
                Upload Text File
              </label>
            </div>
            
            <div className="text-center text-gray-500">or</div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Paste your text content:
              </label>
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Paste your document content here..."
                className="w-full h-64 p-3 border border-gray-300 rounded-md resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            
            {/* Format Instructions - UPDATED WITH INTERNAL CAPTION RULE */}
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-semibold text-blue-900 mb-2">Table Format Instructions:</h3>
              <div className="text-sm text-blue-800 space-y-1">
                <p>• Use <code>||====||</code> to mark table start and end</p>
                <p>• Use <code>|| content | content | content ||</code> for table rows</p>
                <p>• <strong>NEW:</strong> Add table caption/heading INSIDE the table boundaries (between ||====||)</p>
                <p>• Example:</p>
                <pre className="bg-white p-2 rounded mt-2 text-xs">
{`||====||
Table 1: Analysis of Existing Attendance Systems and Their Limitations
||Author | Method | Advantages | Limitations||
||Wang et al. | QR tokens | Simple, Strong | Single factor, Sharable||
||Fu et al. | Facial recognition | High accuracy | Environment dependent||
||====||`}
                </pre>
            <div className="bg-amber-50 p-4 rounded-lg">
              <h3 className="font-semibold text-amber-900 mb-2">⚠️ IEEE Two-Column Layout Notice:</h3>
              <div className="text-sm text-amber-800 space-y-2">
                <p><strong>Table Placement Control:</strong></p>
                <ul className="list-disc ml-4 space-y-1">
                  <li><strong>Small Tables</strong>: Stay within single column using <code>table[!htb]</code></li>
                  <li><strong>Large Tables</strong>: Automatically use <code>table*[!htbp]</code> to span both columns</li>
                  <li><strong>Placement Priority</strong>: Here → Top → Bottom (avoids floating to wrong sections)</li>
                  <li><strong>Size Detection</strong>: Based on content length and column count</li>
                </ul>
                <p className="text-amber-700 font-medium">✅ This prevents tables from appearing in wrong sections (e.g., Table 1 in Introduction when discussed in Literature Review)</p>
              </div>
            </div>
              </div>
            </div>
            
            <button
              onClick={() => setActiveTab('preview')}
              disabled={!inputText.trim()}
              className="w-full px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              Preview Content
            </button>
          </div>
        )}

        {activeTab === 'preview' && (
          <div className="space-y-4">
            <div className="bg-gray-50 p-4 rounded-lg">
              <pre className="whitespace-pre-wrap text-sm text-gray-800 max-h-96 overflow-y-auto">
                {inputText}
              </pre>
            </div>
            
            <div className="flex gap-4">
              <button
                onClick={handleParse}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Parse Document
              </button>
              <button
                onClick={() => setActiveTab('upload')}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Back to Edit
              </button>
            </div>
          </div>
        )}

        {activeTab === 'parse' && parsedData && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="font-semibold text-green-900 mb-2">Document Structure</h3>
                <div className="text-sm text-green-800 space-y-1">
                  <p>Title: {parsedData.title ? '✓' : '✗'}</p>
                  <p>Authors: {parsedData.authors ? '✓' : '✗'}</p>
                  <p>Abstract: {parsedData.abstract ? '✓' : '✗'}</p>
                  <p>Keywords: {parsedData.keywords ? '✓' : '✗'}</p>
                  <p>Sections: {parsedData.sections.length}</p>
                  <p>Tables: {parsedData.tables.length}</p>
                </div>
              </div>
              
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-2">Template: {templates[selectedTemplate].name}</h3>
                <div className="text-sm text-blue-800 space-y-1">
                  <p>Style: {templates[selectedTemplate].tableStyle}</p>
                  <p>Single Column: {templates[selectedTemplate].singleColumn ? 'Yes' : 'No'}</p>
                  <p>Compression: {enableCompression ? 'Enabled' : 'Disabled'}</p>
                </div>
              </div>
            </div>
            
            {parsedData.tables.length > 0 && (
              <div className="bg-yellow-50 p-4 rounded-lg">
                <h3 className="font-semibold text-yellow-900 mb-2">Detected Tables:</h3>
                {parsedData.tables.map(table => (
                  <div key={table.id} className="mb-3">
                    <p className="text-sm text-yellow-800">
                      Table {table.id}: {table.rows.length} rows × {table.rows[0]?.length || 0} columns
                    </p>
                    <div className="bg-white p-2 rounded mt-1 text-xs">
                      <table className="w-full border-collapse">
                        <tbody>
                          {table.rows.slice(0, 3).map((row, i) => (
                            <tr key={i}>
                              {row.map((cell, j) => (
                                <td key={j} className="border p-1 text-xs">
                                  {enableCompression && selectedTemplate === 'ieee' ? compressText(cell) : cell}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {table.rows.length > 3 && (
                        <p className="text-center text-gray-500 mt-1">... and {table.rows.length - 3} more rows</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            
            <button
              onClick={handleGenerate}
              className="w-full px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              Generate LaTeX
            </button>
          </div>
        )}

        {activeTab === 'latex' && (
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-semibold">Generated LaTeX Code</h3>
              <div className="flex gap-2">
                <button
                  onClick={copyToClipboard}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  {copySuccess ? <CheckCircle className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  {copySuccess ? 'Copied!' : 'Copy'}
                </button>
                <button
                  onClick={downloadLaTeX}
                  className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                >
                  <Download className="w-4 h-4" />
                  Download
                </button>
              </div>
            </div>
            
            <div className="bg-gray-50 p-4 rounded-lg">
              <pre className="whitespace-pre-wrap text-sm text-gray-800 max-h-96 overflow-y-auto">
                {generatedLaTeX}
              </pre>
            </div>
            
            <div className="flex gap-4">
              <button
                onClick={() => setActiveTab('parse')}
                className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
              >
                Back to Parse
              </button>
              <button
                onClick={() => window.open('https://www.overleaf.com', '_blank')}
                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
              >
                Open in Overleaf
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LaTeXTableProcessor;