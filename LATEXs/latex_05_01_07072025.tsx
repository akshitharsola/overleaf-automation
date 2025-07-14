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

  // NEW ADAPTIVE TABLE SYSTEM
  const analyzeTableContent = (table) => {
    const analysis = { 
      columns: [], 
      totalDensity: 0
    };
    
    const colCount = table.rows[0] ? table.rows[0].length : 0;
    
    for (let col = 0; col < colCount; col++) {
      const columnData = table.rows.map(row => row[col] || '');
      const maxLen = Math.max(...columnData.map(cell => cell.length));
      const avgLen = columnData.reduce((sum, cell) => sum + cell.length, 0) / columnData.length;
      
      let density, priority, needsProcessing;
      if (maxLen > 70) { 
        density = 'extreme'; priority = 6.0; needsProcessing = 'aggressive';
      } else if (maxLen > 50) { 
        density = 'very_high'; priority = 5.0; needsProcessing = 'aggressive';
      } else if (maxLen > 35) { 
        density = 'high'; priority = 4.0; needsProcessing = 'moderate';
      } else if (maxLen > 20) { 
        density = 'medium'; priority = 3.0; needsProcessing = 'light';
      } else if (maxLen > 10) { 
        density = 'low'; priority = 2.0; needsProcessing = 'none';
      } else { 
        density = 'very_low'; priority = 1.0; needsProcessing = 'none';
      }
      
      analysis.columns.push({
        index: col,
        maxLength: maxLen,
        avgLength: avgLen,
        density: density,
        priority: priority,
        needsProcessing: needsProcessing,
        alignment: maxLen < 10 ? 'center' : 'left'
      });
    }
    
    analysis.totalDensity = analysis.columns.reduce((sum, col) => sum + col.maxLength, 0);
    return analysis;
  };

  const calculateOptimalWidths = (analysis, template = 'ieee') => {
    const constraints = {
      ieee: { 
        totalWidth: 0.85,
        minColWidth: 0.08,
        maxColWidth: 0.30
      },
      springer: { 
        totalWidth: 0.90, 
        minColWidth: 0.10, 
        maxColWidth: 0.35
      },
      acm: {
        totalWidth: 0.88,
        minColWidth: 0.09,
        maxColWidth: 0.32
      }
    };
    
    const constraint = constraints[template];
    const totalPriority = analysis.columns.reduce((sum, col) => sum + col.priority, 0);
    
    let widths = analysis.columns.map(col => {
      const proportionalWidth = (col.priority / totalPriority) * constraint.totalWidth;
      return Math.max(constraint.minColWidth, Math.min(constraint.maxColWidth, proportionalWidth));
    });
    
    const currentTotal = widths.reduce((sum, w) => sum + w, 0);
    if (currentTotal > constraint.totalWidth) {
      const scale = constraint.totalWidth / currentTotal;
      widths = widths.map(w => w * scale);
    }
    
    const colSpecs = widths.map((width, index) => {
      const fraction = width.toFixed(3);
      const alignment = analysis.columns[index].alignment === 'center' ? 
        'centering' : 'raggedright';
      return `>{\\${alignment}\\arraybackslash}p{${fraction}\\linewidth}`;
    });
    
    return {
      widths: widths,
      colSpecs: colSpecs,
      totalUsed: currentTotal
    };
  };

  const selectOptimalFormat = (analysis) => {
    const totalDensity = analysis.totalDensity;
    const colCount = analysis.columns.length;
    const hasExtreme = analysis.columns.some(col => col.density === 'extreme');
    const hasVeryHigh = analysis.columns.some(col => col.density === 'very_high');
    
    if (hasExtreme || totalDensity > 300 || colCount > 6) {
      return {
        environment: 'table*',
        fontSize: '\\tiny',
        spacing: 'ultra-compact',
        arrayStretch: '0.7',
        abbreviationLevel: 'aggressive',
        needsLineBreaks: true,
        borderStyle: 'hline'
      };
    } else if (hasVeryHigh || totalDensity > 200 || colCount > 5) {
      return {
        environment: 'table*',
        fontSize: '\\scriptsize',
        spacing: 'compact',
        arrayStretch: '0.8',
        abbreviationLevel: 'moderate',
        needsLineBreaks: false,
        borderStyle: 'hline'
      };
    } else if (totalDensity > 150 || colCount > 4) {
      return {
        environment: 'table',
        fontSize: '\\scriptsize',
        spacing: 'compact',
        arrayStretch: '0.9',
        abbreviationLevel: 'light',
        needsLineBreaks: false,
        borderStyle: 'hline'
      };
    } else if (totalDensity > 100) {
      return {
        environment: 'table',
        fontSize: '\\footnotesize',
        spacing: 'normal',
        arrayStretch: '1.0',
        abbreviationLevel: 'minimal',
        needsLineBreaks: false,
        borderStyle: 'hline'
      };
    } else {
      return {
        environment: 'table',
        fontSize: '\\small',
        spacing: 'normal',
        arrayStretch: '1.0',
        abbreviationLevel: 'none',
        needsLineBreaks: false,
        borderStyle: 'hline'
      };
    }
  };

  const processTableContent = (table, analysis, format) => {
    const abbreviationMaps = {
      aggressive: {
        'Mobile-based multi-factor authentication': 'Mobile MFA',
        'Advanced anti-spoofing methods for mobile devices': 'Adv. anti-spoof',
        'Need for efficient resource management': 'Resource mgmt',
        'Balance between security and performance': 'Sec./perf.',
        'Integration with lightweight systems': 'Lightweight',
        'Real-time location validation': 'Real-time',
        'Comprehensive security': 'Secure',
        'Complex implementation': 'Complex',
        'Processing intensive': 'Intensive',
        'Single factor only': '1-factor',
        'High computational cost': 'High cost',
        'BLE-based proximity detection': 'BLE prox.',
        'Enhanced QR Code': 'QR Code'
      },
      moderate: {
        'Mobile-based multi-factor authentication': 'Mobile MFA framework',
        'Advanced anti-spoofing methods': 'Advanced anti-spoofing',
        'Need for efficient resource management': 'Efficient resource mgmt',
        'Balance between security and performance': 'Security-performance balance',
        'BLE-based proximity detection': 'BLE proximity detection'
      },
      light: {
        'Mobile-based': 'Mobile',
        'multi-factor': 'MFA',
        'authentication': 'auth.',
        'implementation': 'impl.',
        'performance': 'perf.',
        'detection': 'detect.'
      }
    };
    
    const abbrevMap = abbreviationMaps[format.abbreviationLevel] || {};
    
    return table.rows.map((row, rowIndex) => {
      return row.map((cell, colIndex) => {
        let processedCell = cell;
        
        Object.entries(abbrevMap).forEach(([full, abbrev]) => {
          processedCell = processedCell.replace(new RegExp(full, 'gi'), abbrev);
        });
        
        if (format.needsLineBreaks && processedCell.length > 40) {
          const words = processedCell.split(' ');
          let result = '';
          let currentLine = '';
          
          words.forEach(word => {
            if ((currentLine + word).length > 25) {
              result += currentLine.trim() + '\\\\[-2pt] ';
              currentLine = word + ' ';
            } else {
              currentLine += word + ' ';
            }
          });
          
          result += currentLine.trim();
          processedCell = result;
        }
        
        return processedCell;
      });
    });
  };

  const generateAdaptiveIEEETable = (table, tableNumber, template) => {
    const analysis = analyzeTableContent(table);
    const layout = calculateOptimalWidths(analysis, template);
    const format = selectOptimalFormat(analysis);
    const processedTable = processTableContent(table, analysis, format);
    
    let latex = `\\begin{${format.environment}}[htbp]\n`;
    latex += '\\centering\n';
    latex += `${format.fontSize}\n`;
    
    if (format.spacing === 'ultra-compact') {
      latex += '\\setlength{\\tabcolsep}{1pt}\n';
      latex += `\\renewcommand{\\arraystretch}{${format.arrayStretch}}\n`;
    } else if (format.spacing === 'compact') {
      latex += '\\setlength{\\tabcolsep}{3pt}\n';
      latex += `\\renewcommand{\\arraystretch}{${format.arrayStretch}}\n`;
    }
    
    if (table.caption && table.caption.trim()) {
      latex += `\\caption{${table.caption}}\n`;
    } else {
      latex += `\\caption{Table ${tableNumber}}\n`;
    }
    latex += `\\label{tab:table${tableNumber}}\n`;
    
    const colSpec = '|' + layout.colSpecs.join('|') + '|';
    latex += `\\begin{tabular}{${colSpec}}\n`;
    latex += '\\hline\n';
    
    processedTable.forEach((row, rowIndex) => {
      const escapedRow = row.map(cell => {
        return cell
          .replace(/[&%$#_{}]/g, '\\$&')
          .replace(/\\/g, '\\textbackslash{}')
          .replace(/\^/g, '\\textasciicircum{}')
          .replace(/~/g, '\\textasciitilde{}');
      });
      
      latex += escapedRow.join(' & ') + ' \\\\\n';
      
      if (rowIndex === 0 && table.hasHeaders) {
        latex += '\\hline\n';
      }
    });
    
    latex += '\\hline\n';
    latex += '\\end{tabular}\n';
    
    if (format.spacing !== 'normal') {
      latex += '\\setlength{\\tabcolsep}{6pt}\n';
      latex += '\\renewcommand{\\arraystretch}{1.0}\n';
    }
    
    latex += `\\end{${format.environment}}\n`;
    
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
          '\\usepackage{array}',
          '\\usepackage{tabularx}',
          '\\usepackage{multirow}',
          '\\usepackage{adjustbox}'
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
            return generateAdaptiveIEEETable(parsedDoc.tables[tableIndex], tableIndex + 1, template);
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
          <h1 className="text-3xl font-bold text-gray-900">🚀 Adaptive LaTeX Document Converter</h1>
          <p className="text-gray-600 mt-2">Smart table formatting with content-aware density analysis and IEEE compliance</p>
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
                    { id: 'ieee', name: '🏆 IEEE Conference', desc: 'Adaptive smart table formatting' },
                    { id: 'springer', name: 'Springer LNCS', desc: 'Lecture Notes format' },
                    { id: 'acm', name: 'ACM Format', desc: 'Conference format' }
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
                <h3 className="font-semibold text-green-900 mb-3">🧠 Smart Adaptive Table Features</h3>
                <div className="text-sm text-green-800 space-y-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p><strong>✨ Content Analysis:</strong></p>
                      <p>• Density detection: very_low → extreme</p>
                      <p>• Smart width allocation based on content</p>
                      <p>• Automatic environment selection</p>
                    </div>
                    <div>
                      <p><strong>🎯 Adaptive Formatting:</strong></p>
                      <p>• Font: \\small → \\tiny based on density</p>
                      <p>• Environment: table vs table* auto-select</p>
                      <p>• IEEE \\hline borders (not booktabs)</p>
                    </div>
                  </div>
                  <div className="bg-white p-2 rounded mt-2">
                    <p className="text-xs"><strong>🔥 NEW:</strong> Your table will automatically get optimal formatting regardless of content density!</p>
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
                  <p className="text-gray-600 mb-4">Smart adaptive table processing for any content density</p>
                  
                  <div className="bg-green-50 p-3 rounded-lg mb-4">
                    <h4 className="font-semibold text-green-900 text-sm mb-2">📄 Supported Formats:</h4>
                    <div className="text-xs text-green-800 space-y-1">
                      <p>• <strong>.txt</strong> - Plain text files (recommended)</p>
                      <p>• <strong>.md</strong> - Markdown files</p>
                      <p>• <strong>.rtf</strong> - Rich text format</p>
                      <p>• <strong>Note:</strong> For Word docs, save as .txt for best results</p>
                    </div>
                  </div>
                  
                  <div className="bg-blue-50 p-3 rounded-lg mb-4 text-left">
                    <h4 className="font-semibold text-blue-900 text-sm mb-2">🔢 Table Format (Auto-Optimized):</h4>
                    <div className="text-xs text-blue-800 space-y-2">
                      <code className="block bg-white p-2 rounded text-xs font-mono">
                        Table 1: Analysis of Existing Systems
                        <br/>||====||
                        <br/>||Author|Method|Advantages|Limitations|Research Gaps||
                        <br/>||Wang, R.|Enhanced QR Code|Simple to use|Single factor only|Need for physical presence validation||
                        <br/>||Ali, N.S|Mobile-based multi-factor authentication|Comprehensive security|Complex implementation|Need for efficient resource management||
                        <br/>||====||
                      </code>
                      <p><strong>🚀 Smart Processing:</strong> Automatic content analysis, width calculation, and format selection!</p>
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

Example with adaptive table optimization:

SecureAttend: Multi-Factor Authentication Framework

Author Name, Co-Author Name

Abstract: This paper presents a comprehensive multi-factor authentication system.

Index Terms: authentication, biometrics, attendance verification

II. RELATED WORK
Previous research has focused on various authentication methods.

Table 1: Analysis of Existing Attendance Systems and Their Limitations
||====||
|| Author / Title / Year |  Methods | Advantages | Limitations | Research Gaps ||
||Wang, R. | Enhanced QR Code  | Simple to use | Single factor only | Need for physical presence validation ||
||Fu,R.,Wang | Deep learning | High accuracy | High computational cost | Integration ||
||Baykara | BLE-based proximity detection | Real-time location validation | Signal interference issues | Multi-factor integration ||
||Ali, N.S | Mobile-based multi-factor authentication | Comprehensive security | Complex implementation | Need for efficient resource management ||
||Bhattacharya | Optimized face Recognition | Battery efficient | Limited feature set | Balance between security and performance||
||Li, Y. | Advanced anti-spoofing methods for mobile devices | Strong security | Processing intensive | Integration with lightweight systems ||
||====||

III. METHODOLOGY
Our proposed approach combines multiple authentication factors."
                  />
                  
                  <div className="flex gap-3">
                    <button
                      onClick={handleTextInput}
                      disabled={!textInput.trim() || isProcessing}
                      className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
                    >
                      {isProcessing ? 'Processing...' : '🚀 Smart Process'}
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
                  <p className="mt-2 text-gray-600">🧠 Analyzing content density and optimizing tables...</p>
                </div>
              )}

              {parsedContent && (
                <div className="bg-gray-50 p-6 rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-4">📊 Smart Analysis Results</h3>
                  
                  <div className="grid grid-cols-4 gap-4 bg-blue-50 p-3 rounded mb-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{parsedContent.sections.length}</div>
                      <div className="text-sm text-blue-800">Sections</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{parsedContent.tables ? parsedContent.tables.length : 0}</div>
                      <div className="text-sm text-green-800">Smart Tables</div>
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

                  {parsedContent.tables && parsedContent.tables.length > 0 && (
                    <div className="mt-4">
                      <div className="font-medium text-gray-700 mb-2">🧠 Smart Table Analysis:</div>
                      <div className="bg-green-50 p-3 rounded">
                        {parsedContent.tables.map((table, index) => {
                          const analysis = analyzeTableContent(table);
                          const format = selectOptimalFormat(analysis);
                          
                          return (
                            <div key={index} className="text-sm mb-3 border-l-4 border-green-500 pl-3">
                              <span className="font-medium text-green-800">Table {index + 1} - Smart Analysis:</span>
                              <div className="text-xs text-green-600 mt-1 space-y-1">
                                <p><strong>Columns:</strong> {analysis.columns.length} detected</p>
                                <p><strong>Density Score:</strong> {analysis.totalDensity.toFixed(0)} (Total content length)</p>
                                <p><strong>Environment:</strong> {format.environment} (auto-selected)</p>
                                <p><strong>Font Size:</strong> {format.fontSize} (optimized)</p>
                                <p><strong>Abbreviation:</strong> {format.abbreviationLevel} level applied</p>
                                <div className="bg-white p-1 rounded mt-1">
                                  <strong>Column Widths:</strong> {calculateOptimalWidths(analysis, selectedTemplate).widths.map((w, i) => `${i+1}:${(w*100).toFixed(1)}%`).join(', ')}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-3 mt-4">
                    <button
                      onClick={() => setActiveTab('editor')}
                      className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                    >
                      <Code className="w-4 h-4" />
                      View Optimized LaTeX →
                    </button>
                    <button
                      onClick={() => setActiveTab('preview')}
                      className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                    >
                      <Eye className="w-4 h-4" />
                      Preview Results →
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'editor' && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">🚀 Smart-Optimized LaTeX Output</h3>
                <div className="flex gap-3">
                  <select
                    value={selectedTemplate}
                    onChange={(e) => handleTemplateChange(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="ieee">🏆 IEEE Conference (Smart)</option>
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
                  <span className="font-medium text-gray-700">Smart-Optimized LaTeX Source Code</span>
                </div>
                <textarea
                  value={latexOutput}
                  onChange={(e) => setLatexOutput(e.target.value)}
                  className="w-full h-96 p-4 font-mono text-sm resize-none border-0 focus:ring-0"
                  placeholder="Smart-optimized LaTeX code will appear here..."
                />
              </div>

              {parsedContent && (
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-blue-900 mb-2">📊 Smart Optimization Statistics</h4>
                  <div className="grid grid-cols-4 gap-4 text-sm text-center">
                    <div>
                      <span className="text-blue-700 font-medium block">Tables</span>
                      <span className="text-xl font-bold text-green-600">{parsedContent.tables ? parsedContent.tables.length : 0}</span>
                      <div className="text-xs text-green-600">Optimized</div>
                    </div>
                    <div>
                      <span className="text-blue-700 font-medium block">Environment</span>
                      <span className="text-sm font-bold text-purple-600">
                        {parsedContent.tables && parsedContent.tables.length > 0 
                          ? selectOptimalFormat(analyzeTableContent(parsedContent.tables[0])).environment
                          : 'N/A'}
                      </span>
                      <div className="text-xs text-purple-600">Auto-selected</div>
                    </div>
                    <div>
                      <span className="text-blue-700 font-medium block">Template</span>
                      <span className="text-sm font-bold text-blue-900">{selectedTemplate.toUpperCase()}</span>
                      <div className="text-xs text-blue-600">IEEE Compliant</div>
                    </div>
                    <div>
                      <span className="text-blue-700 font-medium block">Status</span>
                      <span className="text-sm text-green-600 font-medium">✅ Optimized</span>
                      <div className="text-xs text-green-600">Ready to compile</div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'preview' && parsedContent && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">📄 Smart-Optimized Document Preview</h3>
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
                              const analysis = analyzeTableContent(table);
                              const format = selectOptimalFormat(analysis);
                              const processedTable = processTableContent(table, analysis, format);
                              
                              return (
                                <div key={partIndex} className="my-4 border border-gray-300 rounded overflow-hidden">
                                  <div className="bg-blue-100 px-3 py-1 text-xs font-medium">
                                    Table {tableIndex + 1}: {table.caption || 'Smart-Optimized Table'}
                                    <span className="ml-2 text-blue-600">
                                      (🧠 {format.environment}, {format.fontSize}, {format.abbreviationLevel} abbrev.)
                                    </span>
                                  </div>
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                      <tbody>
                                        {processedTable.slice(0, 4).map((row, rowIndex) => (
                                          <tr key={rowIndex} className={rowIndex === 0 && table.hasHeaders ? 'bg-gray-50 font-medium' : ''}>
                                            {row.map((cell, cellIndex) => (
                                              <td key={cellIndex} className="border-r border-gray-200 px-2 py-1 text-xs">
                                                {cell.length > 20 ? cell.substring(0, 20) + '...' : cell}
                                              </td>
                                            ))}
                                          </tr>
                                        ))}
                                        {processedTable.length > 4 && (
                                          <tr>
                                            <td colSpan={processedTable[0]?.length || 1} className="text-center text-gray-500 py-1 text-xs">
                                              ... +{processedTable.length - 4} more rows
                                            </td>
                                          </tr>
                                        )}
                                      </tbody>
                                    </table>
                                  </div>
                                  <div className="bg-green-50 px-3 py-1 text-xs text-green-800">
                                    <strong>🚀 Smart Optimization:</strong> Content density analyzed, widths calculated, format auto-selected
                                  </div>
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
                <h4 className="font-semibold text-yellow-900 mb-2">🎯 Smart Optimization Success!</h4>
                <div className="text-sm text-yellow-800 space-y-2">
                  <p><strong>✨ Content Analysis Applied:</strong> Each table analyzed for optimal formatting</p>
                  <p><strong>📊 Dynamic Width Allocation:</strong> Columns sized based on content density</p>
                  <p><strong>🎨 Format Auto-Selection:</strong> Environment, font, and spacing optimized</p>
                  <p><strong>🏆 IEEE Compliance:</strong> Proper \\hline borders and caption formatting</p>
                  <p><strong>🚀 Ready to Compile:</strong> Copy LaTeX and compile in Overleaf for perfect results!</p>
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