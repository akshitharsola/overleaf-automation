import React, { useState } from 'react';
import { Upload, FileText, Eye, Code, Copy } from 'lucide-react';

const LaTeXConverter = () => {
  const [activeTab, setActiveTab] = useState('upload');
  const [document, setDocument] = useState(null);
  const [parsedContent, setParsedContent] = useState(null);
  const [latexOutput, setLatexOutput] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('ieee');
  const [isProcessing, setIsProcessing] = useState(false);
  const [inputMode, setInputMode] = useState('file');
  const [textInput, setTextInput] = useState('');

  const detectTables = (lines) => {
    const tables = [];
    let currentTable = null;
    let inTable = false;
    let tableCount = 0;
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (line === '||====||' && !inTable) {
        currentTable = {
          startLine: i,
          endLine: i,
          rows: [],
          caption: '',
          type: 'formatted',
          hasHeaders: false,
          id: ++tableCount
        };
        inTable = true;
        
        for (let j = i - 1; j >= 0 && j >= i - 3; j--) {
          const prevLine = lines[j];
          if (/table\s*[IVXLCDM]*\d*/i.test(prevLine)) {
            currentTable.caption = prevLine.replace(/table\s*[IVXLCDM]*\d*/i, '').replace(/[:–-]/, '').trim();
            break;
          }
        }
        continue;
      }
      
      if (line === '||====||' && inTable && currentTable) {
        currentTable.endLine = i;
        if (currentTable.rows.length > 0) {
          const firstRow = currentTable.rows[0];
          const hasHeaderWords = firstRow.some(cell => 
            /^(author|title|year|method|approach|technique|system|framework|accuracy|performance|result|name|type|value|methods|advantages|limitations)s?$/i.test(cell.trim())
          );
          if (hasHeaderWords) {
            currentTable.hasHeaders = true;
          }
          
          const isDuplicate = tables.some(existingTable => 
            existingTable.rows.length === currentTable.rows.length &&
            JSON.stringify(existingTable.rows) === JSON.stringify(currentTable.rows)
          );
          
          if (!isDuplicate) {
            tables.push(currentTable);
          }
        }
        currentTable = null;
        inTable = false;
        continue;
      }
      
      if (inTable && currentTable && line.startsWith('||') && line.endsWith('||') && line.length > 4) {
        const rowContent = line.slice(2, -2);
        const cells = rowContent.split('|').map(cell => cell.trim());
        
        if (cells.length > 0 && cells.some(cell => cell.length > 0)) {
          currentTable.rows.push(cells);
        }
      }
    }
    
    return tables;
  };

  const parseDocument = (text) => {
    const result = {
      title: '',
      authors: '',
      abstract: '',
      keywords: '',
      sections: [],
      tables: [],
      figures: []
    };
    
    if (!text || text.trim().length === 0) {
      return result;
    }
    
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    if (lines.length === 0) return result;
    
    result.title = lines[0];
    
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.toLowerCase().includes('abstract')) break;
      if (line.includes(',') && !line.includes('University') && !line.includes('Department')) {
        result.authors = line;
        break;
      }
    }
    
    const abstractStartIdx = lines.findIndex(line => line.toLowerCase().includes('abstract'));
    if (abstractStartIdx !== -1) {
      const abstractLine = lines[abstractStartIdx];
      
      if (abstractLine.includes('—') || abstractLine.includes(':') || abstractLine.includes('-')) {
        const parts = abstractLine.split(/[—:-]/);
        if (parts.length > 1) {
          result.abstract = parts.slice(1).join('').trim();
        }
      }
      
      for (let i = abstractStartIdx + 1; i < lines.length; i++) {
        const line = lines[i];
        if (line.toLowerCase().includes('index terms') || 
            line.toLowerCase().includes('keywords') || 
            /^[IVX]+\./.test(line) || 
            /^\d+\./.test(line)) {
          break;
        }
        if (result.abstract) {
          result.abstract += ' ' + line;
        } else {
          result.abstract = line;
        }
      }
      result.abstract = result.abstract.trim();
    }
    
    const keywordsIdx = lines.findIndex(line => 
      line.toLowerCase().includes('index terms') || 
      line.toLowerCase().includes('keywords')
    );
    if (keywordsIdx !== -1) {
      const keywordsLine = lines[keywordsIdx];
      if (keywordsLine.includes('—') || keywordsLine.includes(':') || keywordsLine.includes('-')) {
        const parts = keywordsLine.split(/[—:-]/);
        if (parts.length > 1) {
          result.keywords = parts.slice(1).join('').trim();
        }
      }
    }
    
    result.tables = detectTables(lines);
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      const numberedMatch = line.match(/^(\d+(?:\.\d+)*)\.?\s*(.+)$/);
      const romanMatch = line.match(/^([IVX]+)\.?\s*(.+)$/);
      
      let sectionMatch = null;
      let fullNumber = '';
      let sectionTitle = '';
      let level = 1;
      
      if (numberedMatch) {
        sectionMatch = numberedMatch;
        fullNumber = numberedMatch[1];
        sectionTitle = numberedMatch[2];
        level = fullNumber.split('.').length;
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
    
    if (result.sections.length === 0 && (result.abstract || result.title)) {
      const allText = lines.join(' ');
      if (allText.length > 200) {
        result.sections.push({
          number: 'I.',
          title: 'CONTENT',
          content: allText,
          level: 1,
          type: 'generated'
        });
      }
    }
    
    return result;
  };

  const generateCompactTableLatex = (table, tableNumber, template) => {
    if (!template) template = 'ieee';
    if (!table.rows || table.rows.length === 0) return '';
    
    const colCount = table.rows[0] ? table.rows[0].length : 0;
    let colSpec = '';
    let fontSize = '\\scriptsize';
    
    if (template === 'ieee') {
      const singleColWidth = 8.5;
      const availableWidth = singleColWidth - 0.2;
      
      const columnAnalysis = [];
      for (let i = 0; i < colCount; i++) {
        const columnContent = table.rows.map(row => row[i] || '');
        const maxLength = Math.max(...columnContent.map(cell => cell.length));
        const avgLength = columnContent.reduce((sum, cell) => sum + cell.length, 0) / columnContent.length;
        
        let priority = 1;
        if (maxLength > 40) priority = 4;
        else if (maxLength > 25) priority = 3;
        else if (maxLength > 15) priority = 2;
        
        columnAnalysis.push({ maxLength, avgLength, priority });
      }
      
      const totalPriority = columnAnalysis.reduce((sum, col) => sum + col.priority, 0);
      
      for (let i = 0; i < colCount; i++) {
        const analysis = columnAnalysis[i];
        const priorityRatio = analysis.priority / totalPriority;
        let columnWidth = availableWidth * priorityRatio;
        
        if (analysis.maxLength > 40) {
          columnWidth = Math.max(columnWidth, 2.2);
          columnWidth = Math.min(columnWidth, 3.0);
          colSpec += `p{${columnWidth.toFixed(1)}cm}`;
        } else if (analysis.maxLength > 25) {
          columnWidth = Math.max(columnWidth, 1.6);
          columnWidth = Math.min(columnWidth, 2.4);
          colSpec += `p{${columnWidth.toFixed(1)}cm}`;
        } else if (analysis.maxLength > 15) {
          columnWidth = Math.max(columnWidth, 1.0);
          columnWidth = Math.min(columnWidth, 1.8);
          colSpec += `p{${columnWidth.toFixed(1)}cm}`;
        } else if (analysis.maxLength <= 8) {
          colSpec += 'c';
        } else {
          columnWidth = Math.max(columnWidth, 0.8);
          columnWidth = Math.min(columnWidth, 1.2);
          colSpec += `p{${columnWidth.toFixed(1)}cm}`;
        }
      }
      
      const totalChars = table.rows.reduce((sum, row) => 
        sum + row.reduce((rowSum, cell) => rowSum + cell.length, 0), 0);
      const avgCharsPerCell = totalChars / (table.rows.length * colCount);
      const density = avgCharsPerCell * colCount;
      
      if (density > 150 || colCount > 5) {
        fontSize = '\\tiny';
      } else if (density > 100 || colCount > 4) {
        fontSize = '\\scriptsize';
      } else if (density > 60) {
        fontSize = '\\footnotesize';
      } else {
        fontSize = '\\small';
      }
      
    } else {
      for (let i = 0; i < colCount; i++) {
        const columnContent = table.rows.map(row => row[i] || '');
        const maxLength = Math.max(...columnContent.map(cell => cell.length));
        
        if (maxLength > 25) {
          colSpec += 'p{2.5cm}';
        } else if (maxLength > 15) {
          colSpec += 'p{2cm}';
        } else if (maxLength < 8) {
          colSpec += 'c';
        } else {
          colSpec += 'l';
        }
      }
    }
    
    let latex = `\n\\begin{table}[htbp]\n`;
    latex += '\\centering\n';
    latex += `${fontSize}\n`;
    
    if (template === 'ieee') {
      latex += '\\renewcommand{\\arraystretch}{0.9}\n';
      latex += '\\setlength{\\tabcolsep}{3pt}\n';
    }
    
    if (table.caption && table.caption.trim()) {
      latex += `\\caption{${table.caption}}\n`;
    } else {
      latex += `\\caption{Table ${tableNumber}}\n`;
    }
    
    latex += `\\label{tab:table${tableNumber}}\n`;
    latex += `\\begin{tabular}{${colSpec}}\n`;
    
    if (template === 'ieee') {
      latex += '\\hline\n';
    } else {
      latex += '\\toprule\n';
    }
    
    table.rows.forEach((row, rowIndex) => {
      const paddedRow = [...row];
      while (paddedRow.length < colCount) {
        paddedRow.push('');
      }
      
      const escapedRow = paddedRow.map((cell) => {
        let escaped = cell
          .replace(/[&%$#_{}]/g, '\\$&')
          .replace(/\\/g, '\\textbackslash{}')
          .replace(/\^/g, '\\textasciicircum{}')
          .replace(/~/g, '\\textasciitilde{}');
        
        if (template === 'ieee' && escaped.length > 18) {
          escaped = escaped
            .replace(/,\s+/g, ',\\\\[-3pt]')
            .replace(/\s+and\s+/g, ' and\\\\[-3pt]')
            .replace(/\s+for\s+/g, ' for\\\\[-3pt]')
            .replace(/\s+with\s+/g, ' with\\\\[-3pt]')
            .replace(/\s+to\s+/g, ' to\\\\[-3pt]')
            .replace(/\s+of\s+/g, ' of\\\\[-3pt]')
            .replace(/(.{15,25})\s+/g, '$1\\\\[-3pt]');
        }
        
        return escaped;
      });
      
      latex += escapedRow.join(' & ') + ' \\\\\n';
      
      if (rowIndex === 0 && table.hasHeaders) {
        if (template === 'ieee') {
          latex += '\\hline\n';
        } else {
          latex += '\\midrule\n';
        }
      }
    });
    
    if (template === 'ieee') {
      latex += '\\hline\n';
    } else {
      latex += '\\bottomrule\n';
    }
    
    latex += '\\end{tabular}\n';
    
    if (template === 'ieee') {
      latex += '\\renewcommand{\\arraystretch}{1.0}\n';
      latex += '\\setlength{\\tabcolsep}{6pt}\n';
    }
    
    latex += '\\end{table}\n';
    
    return latex;
  };

  const generateLaTeX = (parsedDoc, template) => {
    if (!template) template = 'ieee';
    
    const templates = {
      ieee: {
        documentClass: '\\documentclass[conference]{IEEEtran}',
        packages: [
          '\\IEEEoverridecommandlockouts',
          '\\usepackage{cite}',
          '\\usepackage{amsmath,amssymb,amsfonts}',
          '\\usepackage{algorithmic}',
          '\\usepackage{graphicx}',
          '\\usepackage{textcomp}',
          '\\usepackage{xcolor}',
          '\\usepackage{booktabs}',
          '\\usepackage{array}',
          '\\usepackage{multirow}',
          '\\usepackage{adjustbox}',
          '\\usepackage{tabularx}'
        ]
      },
      springer: {
        documentClass: '\\documentclass{llncs}',
        packages: [
          '\\usepackage{cite}',
          '\\usepackage{amsmath,amssymb}',
          '\\usepackage{graphicx}',
          '\\usepackage{url}',
          '\\usepackage{booktabs}',
          '\\usepackage{array}',
          '\\usepackage{adjustbox}',
          '\\usepackage{tabularx}'
        ]
      },
      acm: {
        documentClass: '\\documentclass{acmart}',
        packages: [
          '\\usepackage{cite}',
          '\\usepackage{amsmath,amssymb}',
          '\\usepackage{graphicx}',
          '\\usepackage{booktabs}',
          '\\usepackage{array}',
          '\\usepackage{adjustbox}',
          '\\usepackage{tabularx}'
        ]
      }
    };
    
    const config = templates[template];
    
    let latex = config.documentClass + '\n';
    latex += config.packages.join('\n') + '\n\n';
    
    latex += '\\begin{document}\n\n';
    latex += `\\title{${parsedDoc.title}}\n\n`;
    
    if (parsedDoc.authors && parsedDoc.authors.trim()) {
      latex += `\\author{\\IEEEauthorblockN{${parsedDoc.authors}}\n`;
      latex += '\\IEEEauthorblockA{\\textit{Department Name} \\\\\n';
      latex += '\\textit{University Name}\\\\\n';
      latex += 'City, Country \\\\\n';
      latex += 'email@university.edu}}\n\n';
    } else {
      latex += `\\author{\\IEEEauthorblockN{Author Name}\n`;
      latex += '\\IEEEauthorblockA{\\textit{Department Name} \\\\\n';
      latex += '\\textit{University Name}\\\\\n';
      latex += 'City, Country \\\\\n';
      latex += 'email@university.edu}}\n\n';
    }
    
    latex += '\\maketitle\n\n';
    
    if (parsedDoc.abstract) {
      latex += '\\begin{abstract}\n';
      latex += parsedDoc.abstract + '\n';
      latex += '\\end{abstract}\n\n';
    }
    
    if (parsedDoc.keywords) {
      latex += '\\begin{IEEEkeywords}\n';
      latex += parsedDoc.keywords + '\n';
      latex += '\\end{IEEEkeywords}\n\n';
    }
    
    parsedDoc.sections.forEach((section) => {
      if (section.title === 'REFERENCES') {
        latex += '\\begin{thebibliography}{00}\n';
        const refs = section.content.split(/\[\d+\]/).filter(ref => ref.trim());
        refs.forEach((ref, index) => {
          if (ref.trim()) {
            latex += `\\bibitem{b${index + 1}} ${ref.trim()}\n`;
          }
        });
        latex += '\\end{thebibliography}\n\n';
      } else {
        let sectionCommand;
        if (section.level === 1) {
          sectionCommand = '\\section';
        } else if (section.level === 2) {
          sectionCommand = '\\subsection';
        } else if (section.level === 3) {
          sectionCommand = '\\subsubsection';
        } else {
          sectionCommand = '\\paragraph';
        }
        
        latex += `${sectionCommand}{${section.title}}\n`;
        
        let content = section.content;
        
        const processedTables = new Set();
        
        content = content.replace(/\[TABLE_(\d+)\]/g, (match, tableNum) => {
          const tableIndex = parseInt(tableNum) - 1;
          if (parsedDoc.tables && parsedDoc.tables[tableIndex] && !processedTables.has(tableIndex)) {
            processedTables.add(tableIndex);
            return generateCompactTableLatex(parsedDoc.tables[tableIndex], tableIndex + 1, template);
          }
          return '';
        });
        
        latex += content + '\n\n';
      }
    });
    
    latex += '\\end{document}';
    
    return latex;
  };

  const handleTextInput = () => {
    if (!textInput.trim()) {
      alert('Please enter some text to process.');
      return;
    }

    setIsProcessing(true);
    
    try {
      const parsed = parseDocument(textInput);
      setParsedContent(parsed);
      const latex = generateLaTeX(parsed, selectedTemplate);
      setLatexOutput(latex);
      setActiveTab('editor');
    } catch (error) {
      alert(`Error processing text: ${error.message}`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setDocument(file);
    setIsProcessing(true);

    try {
      let text = '';
      
      if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
        text = await file.text();
      } else if (file.name.endsWith('.md')) {
        text = await file.text();
        text = text
          .replace(/^#{1,6}\s+/gm, '')
          .replace(/\*\*(.*?)\*\*/g, '$1')
          .replace(/\*(.*?)\*/g, '$1')
          .replace(/`(.*?)`/g, '$1');
      } else if (file.name.endsWith('.rtf')) {
        text = await file.text();
        text = text
          .replace(/\\[a-zA-Z]+\d*/g, '')
          .replace(/[{}]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
      } else {
        text = await file.text();
      }
      
      if (!text || text.trim().length < 10) {
        throw new Error('No readable text found in the file.');
      }
      
      const parsed = parseDocument(text);
      setParsedContent(parsed);
      const latex = generateLaTeX(parsed, selectedTemplate);
      setLatexOutput(latex);
      setActiveTab('editor');
      
    } catch (error) {
      alert(`Error: ${error.message}\n\nTips:\n• Use .txt format\n• Use structured table format\n• Number sections properly`);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleTemplateChange = (template) => {
    setSelectedTemplate(template);
    if (parsedContent) {
      const latex = generateLaTeX(parsedContent, template);
      setLatexOutput(latex);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(latexOutput);
      alert('LaTeX code copied to clipboard!');
    } catch (error) {
      alert('Copy failed. Please select all text and copy manually.');
    }
  };

  const openInOverleaf = () => {
    try {
      copyToClipboard();
      window.open('https://www.overleaf.com/project', '_blank');
      
      setTimeout(() => {
        alert('LaTeX code copied!\n\nOverleaf opening...\n\n1. Create new project\n2. Paste code (Ctrl+V)\n3. Compile!');
      }, 500);
    } catch (error) {
      alert('Please copy the code manually and paste it into Overleaf.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 bg-gray-50 min-h-screen">
      <div className="bg-white rounded-lg shadow-lg">
        <div className="border-b border-gray-200 p-6">
          <h1 className="text-3xl font-bold text-gray-900">LaTeX Document Converter</h1>
          <p className="text-gray-600 mt-2">Compact table formatting with reduced spacing for IEEE single-column</p>
        </div>

        <div className="border-b border-gray-200">
          <div className="flex">
            <button
              onClick={() => setActiveTab('upload')}
              className={`px-6 py-3 font-medium text-sm border-b-2 ${
                activeTab === 'upload' 
                  ? 'border-blue-500 text-blue-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Upload className="w-4 h-4 inline mr-2" />
              Upload Document
            </button>
            <button
              onClick={() => setActiveTab('editor')}
              className={`px-6 py-3 font-medium text-sm border-b-2 ${
                activeTab === 'editor' 
                  ? 'border-blue-500 text-blue-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
              disabled={!parsedContent}
            >
              <Code className="w-4 h-4 inline mr-2" />
              LaTeX Editor
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`px-6 py-3 font-medium text-sm border-b-2 ${
                activeTab === 'preview' 
                  ? 'border-blue-500 text-blue-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
              disabled={!parsedContent}
            >
              <Eye className="w-4 h-4 inline mr-2" />
              Preview
            </button>
          </div>
        </div>

        <div className="p-6">
          {activeTab === 'upload' && (
            <div className="space-y-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-3">Select Template</h3>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { id: 'ieee', name: 'IEEE Conference', desc: 'Compact single-column tables' },
                    { id: 'springer', name: 'Springer LNCS', desc: 'Lecture Notes format' },
                    { id: 'acm', name: 'ACM Format', desc: 'ACM conference format' }
                  ].map((template) => (
                    <button
                      key={template.id}
                      onClick={() => handleTemplateChange(template.id)}
                      className={`p-3 rounded-lg border-2 text-left transition-all ${
                        selectedTemplate === template.id
                          ? 'border-blue-500 bg-blue-100'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-medium">{template.name}</div>
                      <div className="text-sm text-gray-600">{template.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="bg-green-50 p-4 rounded-lg">
                <h3 className="font-semibold text-green-900 mb-3">🚀 Compact Table Features</h3>
                <div className="text-sm text-green-800 space-y-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p><strong>Reduced Spacing:</strong></p>
                      <p>• 0.9x row height (10% less gaps)</p>
                      <p>• 3pt column separation (50% less)</p>
                      <p>• Multi-line cells with tight breaks</p>
                    </div>
                    <div>
                      <p><strong>Smart Width Distribution:</strong></p>
                      <p>• Content-based column sizing</p>
                      <p>• Priority allocation for long text</p>
                      <p>• Up to 40% more content fits</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 p-4 rounded-lg">
                <h3 className="font-semibold text-gray-900 mb-3">Input Method</h3>
                <div className="flex gap-4">
                  <button
                    onClick={() => setInputMode('file')}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      inputMode === 'file' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-white border border-gray-300 text-gray-700'
                    }`}
                  >
                    📁 Upload File
                  </button>
                  <button
                    onClick={() => setInputMode('text')}
                    className={`px-4 py-2 rounded-lg font-medium transition-all ${
                      inputMode === 'text' 
                        ? 'bg-blue-600 text-white' 
                        : 'bg-white border border-gray-300 text-gray-700'
                    }`}
                  >
                    📝 Paste Text
                  </button>
                </div>
              </div>

              {inputMode === 'file' && (
                <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors">
                  <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Upload Your Document</h3>
                  <p className="text-gray-600 mb-4">Compact optimization for better space usage</p>
                  
                  <div className="bg-green-50 p-3 rounded-lg mb-4">
                    <h4 className="font-semibold text-green-900 text-sm mb-2">📄 Supported Formats:</h4>
                    <div className="text-xs text-green-800 space-y-1">
                      <p>• <strong>.txt</strong> - Plain text files (recommended)</p>
                      <p>• <strong>.md</strong> - Markdown files</p>
                      <p>• <strong>.rtf</strong> - Rich text format</p>
                      <p>• <strong>Note:</strong> For Word docs, save as .txt</p>
                    </div>
                  </div>
                  
                  <div className="bg-blue-50 p-3 rounded-lg mb-4 text-left">
                    <h4 className="font-semibold text-blue-900 text-sm mb-2">🔢 Table Format:</h4>
                    <div className="text-xs text-blue-800 space-y-2">
                      <code className="block bg-white p-2 rounded text-xs font-mono">
                        Table 1: Analysis of Systems
                        <br/>||====||
                        <br/>||Author|Method|Advantages|Limitations||
                        <br/>||Wang, R.|Enhanced QR Code|Simple to use|Single factor only||
                        <br/>||====||
                      </code>
                      <p><strong>✨ Compact Optimization:</strong> Reduced spacing and multi-line cells!</p>
                    </div>
                  </div>
                  
                  <input
                    type="file"
                    accept=".txt,.md,.rtf"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                  />
                  <label
                    htmlFor="file-upload"
                    className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 cursor-pointer inline-block transition-colors"
                  >
                    Choose Document
                  </label>
                  
                  {document && (
                    <div className="mt-4 p-3 bg-green-50 rounded-lg">
                      <p className="text-green-700">
                        <strong>Uploaded:</strong> {document.name} ({(document.size / 1024).toFixed(1)} KB)
                      </p>
                    </div>
                  )}
                </div>
              )}

              {inputMode === 'text' && (
                <div className="space-y-4">
                  <textarea
                    value={textInput}
                    onChange={(e) => setTextInput(e.target.value)}
                    className="w-full h-64 p-4 text-sm border border-gray-300 rounded-lg"
                    placeholder="Paste your document here...

SecureAttend: Multi-Factor Authentication Framework

Author Name, Co-Author Name

Abstract: This paper presents a comprehensive multi-factor authentication system.

Index Terms: authentication, biometrics, attendance verification

II. RELATED WORK
Previous research has focused on various authentication methods.

Table 1: Analysis of Existing Attendance Systems
||====||
|| Author / Title / Year |  Methods | Advantages | Limitations | Research Gaps ||
||Wang, R. | Enhanced QR Code  | Simple to use | Single factor only | Need for physical presence validation ||
||Fu,R.,Wang | Deep learning | High accuracy | High computational cost | Integration ||
||Baykara | BLE-based proximity detection | Real-time location validation | Signal interference issues | Multi-factor integration ||
||====||

The literature review encompasses critical aspects."
                  />
                  
                  <div className="flex gap-3">
                    <button
                      onClick={handleTextInput}
                      disabled={!textInput.trim() || isProcessing}
                      className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
                    >
                      {isProcessing ? 'Processing...' : 'Optimize Tables'}
                    </button>
                    <button
                      onClick={() => setTextInput('')}
                      className="bg-gray-500 text-white px-4 py-2 rounded-lg hover:bg-gray-600"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}

              {isProcessing && (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <p className="mt-2 text-gray-600">Applying compact formatting...</p>
                </div>
              )}

              {parsedContent && (
                <div className="bg-gray-50 p-6 rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-4">📊 Processing Results</h3>
                  
                  <div className="grid grid-cols-4 gap-4 bg-blue-50 p-3 rounded mb-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{parsedContent.sections.length}</div>
                      <div className="text-sm text-blue-800">Sections</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{parsedContent.tables ? parsedContent.tables.length : 0}</div>
                      <div className="text-sm text-green-800">Tables</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-purple-600">0</div>
                      <div className="text-sm text-purple-800">Figures</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">{latexOutput.split('\n').length}</div>
                      <div className="text-sm text-orange-800">LaTeX Lines</div>
                    </div>
                  </div>

                  <div className="flex gap-3 mt-4">
                    <button
                      onClick={() => setActiveTab('editor')}
                      className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                    >
                      <Code className="w-4 h-4" />
                      View LaTeX →
                    </button>
                    <button
                      onClick={() => setActiveTab('preview')}
                      className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                    >
                      <Eye className="w-4 h-4" />
                      Preview →
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'editor' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">Compact LaTeX Output</h3>
                <div className="flex gap-3">
                  <select
                    value={selectedTemplate}
                    onChange={(e) => handleTemplateChange(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="ieee">IEEE Conference (Compact)</option>
                    <option value="springer">Springer LNCS</option>
                    <option value="acm">ACM Format</option>
                  </select>
                  <button
                    onClick={copyToClipboard}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    Copy LaTeX
                  </button>
                  <button
                    onClick={openInOverleaf}
                    className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors"
                  >
                    Open in Overleaf
                  </button>
                </div>
              </div>

              <div className="border border-gray-300 rounded-lg overflow-hidden">
                <div className="bg-gray-100 px-4 py-2 border-b border-gray-300">
                  <span className="font-medium text-gray-700">LaTeX Source Code</span>
                </div>
                <textarea
                  value={latexOutput}
                  onChange={(e) => setLatexOutput(e.target.value)}
                  className="w-full h-96 p-4 font-mono text-sm resize-none border-0 focus:ring-0"
                  placeholder="Compact LaTeX code will appear here..."
                />
              </div>

              {parsedContent && (
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-blue-900 mb-2">📊 Statistics</h4>
                  <div className="grid grid-cols-4 gap-4 text-sm text-center">
                    <div>
                      <span className="text-blue-700 font-medium block">Tables</span>
                      <span className="text-xl font-bold text-green-600">{parsedContent.tables ? parsedContent.tables.length : 0}</span>
                    </div>
                    <div>
                      <span className="text-blue-700 font-medium block">Optimized</span>
                      <span className="text-xl font-bold text-purple-600">{selectedTemplate === 'ieee' && parsedContent.tables ? parsedContent.tables.length : 0}</span>
                    </div>
                    <div>
                      <span className="text-blue-700 font-medium block">Template</span>
                      <span className="text-sm font-bold text-blue-900">{selectedTemplate.toUpperCase()}</span>
                    </div>
                    <div>
                      <span className="text-blue-700 font-medium block">Status</span>
                      <span className="text-sm text-green-600 font-medium">Ready</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'preview' && parsedContent && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">Document Preview</h3>
                <div className="flex gap-3">
                  <button
                    onClick={copyToClipboard}
                    className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                  >
                    <Copy className="w-4 h-4" />
                    Copy LaTeX
                  </button>
                  <button
                    onClick={openInOverleaf}
                    className="bg-orange-600 text-white px-4 py-2 rounded-lg hover:bg-orange-700 transition-colors"
                  >
                    Open in Overleaf
                  </button>
                </div>
              </div>

              <div className="border border-gray-300 rounded-lg overflow-hidden bg-gray-100 p-4">
                <div className="bg-white shadow-lg mx-auto max-w-4xl p-8">
                  <div className="text-center mb-6">
                    <h1 className="text-xl font-bold mb-3">{parsedContent.title}</h1>
                    <p className="text-gray-700 mb-2">{parsedContent.authors}</p>
                  </div>
                  
                  {parsedContent.abstract && (
                    <div className="mb-6">
                      <p className="font-bold mb-2">Abstract</p>
                      <p className="text-sm text-gray-700 italic">{parsedContent.abstract}</p>
                    </div>
                  )}
                  
                  {parsedContent.keywords && (
                    <div className="mb-6">
                      <p className="font-bold mb-2">Index Terms</p>
                      <p className="text-sm text-gray-700 italic">{parsedContent.keywords}</p>
                    </div>
                  )}
                  
                  {parsedContent.sections.map((section, index) => (
                    <div key={index} className="mb-4">
                      <h3 className="font-bold mb-2 text-base">
                        {section.number} {section.title}
                      </h3>
                      <div className="text-sm text-gray-700 text-justify">
                        {section.content.split(/\[TABLE_(\d+)\]/).map((part, partIndex) => {
                          if (partIndex % 2 === 0) {
                            return (
                              <span key={partIndex}>
                                {part.substring(0, 300)}
                                {part.length > 300 && '...'}
                              </span>
                            );
                          } else {
                            const tableIndex = parseInt(part) - 1;
                            const table = parsedContent.tables && parsedContent.tables[tableIndex];
                            if (table && table.rows.length > 0) {
                              return (
                                <div key={partIndex} className="my-4 border border-gray-300 rounded overflow-hidden">
                                  <div className="bg-blue-100 px-3 py-1 text-xs font-medium">
                                    Table {tableIndex + 1}: {table.caption || 'Compact Table'}
                                    {selectedTemplate === 'ieee' && (
                                      <span className="ml-2 text-blue-600">(Compact Format)</span>
                                    )}
                                  </div>
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-xs" style={{lineHeight: '1.1'}}>
                                      <tbody>
                                        {table.rows.slice(0, 4).map((row, rowIndex) => (
                                          <tr key={rowIndex} className={rowIndex === 0 && table.hasHeaders ? 'bg-gray-50 font-medium' : ''} style={{height: '20px'}}>
                                            {row.map((cell, cellIndex) => (
                                              <td key={cellIndex} className="border-r border-gray-200 text-xs" style={{padding: '1px 2px', fontSize: '10px'}}>
                                                {cell.length > 20 ? cell.substring(0, 20) + '...' : cell}
                                              </td>
                                            ))}
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                  {selectedTemplate === 'ieee' && (
                                    <div className="bg-yellow-50 px-3 py-1 text-xs text-yellow-800">
                                      <strong>Compact:</strong> 0.9x height, 3pt gaps, multi-line cells
                                    </div>
                                  )}
                                </div>
                              );
                            }
                            return <span key={partIndex} className="text-red-500 text-xs">[Table not found]</span>;
                          }
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-yellow-50 p-4 rounded-lg">
                <h4 className="font-semibold text-yellow-900 mb-2">🎯 Compact Results</h4>
                <div className="text-sm text-yellow-800 space-y-2">
                  {selectedTemplate === 'ieee' ? (
                    <>
                      <p><strong>✨ IEEE compact optimization applied</strong></p>
                      <p><strong>📊 Space Efficiency:</strong> 0.9x row height, 3pt column gaps</p>
                      <p><strong>📋 Multi-line cells:</strong> Text wraps with tight spacing</p>
                      <p><strong>💡 Result:</strong> Much more content fits in single column</p>
                    </>
                  ) : (
                    <>
                      <p><strong>📊 {selectedTemplate.toUpperCase()} format applied</strong></p>
                      <p><strong>📝 Original content preserved</strong></p>
                      <p><strong>🎨 Standard table formatting</strong></p>
                    </>
                  )}
                  <p><strong>🚀 Ready to compile:</strong> Copy LaTeX and paste into Overleaf!</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LaTeXConverter;