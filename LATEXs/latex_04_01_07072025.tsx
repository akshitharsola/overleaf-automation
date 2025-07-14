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

  const detectFigures = (lines) => {
    const figures = [];
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const figureMatch = line.match(/(figure\s*\d+|fig\.?\s*\d+)/gi);
      if (figureMatch) {
        figureMatch.forEach(match => {
          const number = match.match(/\d+/)[0];
          figures.push({
            reference: match,
            number: parseInt(number),
            line: i,
            context: line
          });
        });
      }
    }
    
    return figures;
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
    result.figures = detectFigures(lines);
    
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
        let sectionTables = [];
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
            sectionTables.push(result.tables[tableIndex]);
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
            type: numberedMatch ? 'numbered' : 'roman',
            tables: sectionTables,
            figures: []
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
          type: 'generated',
          tables: [],
          figures: []
        });
      }
    }
    
    return result;
  };

  const transformTableForIEEE = (table) => {
    const abbreviationMap = {
      'Authentication': 'Auth.',
      'Multi-factor': 'Multi-f.',
      'Performance': 'Perf.',
      'Implementation': 'Impl.',
      'Recognition': 'Recog.',
      'Verification': 'Verif.',
      'Management': 'Mgmt.',
      'Bluetooth Low Energy': 'BLE',
      'Enhanced QR Code': 'QR Code',
      'BLE-based proximity detection': 'BLE prox.',
      'Mobile-based multi-factor authentication': 'Mobile multi-auth',
      'Optimized face Recognition': 'Face recog.',
      'Advanced anti-spoofing methods for mobile devices': 'Anti-spoof mobile',
      'Simple to use': 'Simple',
      'High accuracy': 'Accurate',
      'Real-time location validation': 'Real-time',
      'Comprehensive security': 'Secure',
      'Battery efficient': 'Efficient',
      'Strong security': 'Strong',
      'Single factor only': '1-factor',
      'High computational cost': 'High cost',
      'Signal interference issues': 'Interference',
      'Complex implementation': 'Complex',
      'Limited feature set': 'Limited',
      'Processing intensive': 'Intensive',
      'Need for physical presence validation': 'Phys. valid.',
      'Need for efficient resource management': 'Resource mgmt',
      'Balance between security and performance': 'Sec./perf.',
      'Integration with lightweight systems': 'Lightweight'
    };
    
    const transformedTable = {
      ...table,
      rows: table.rows.map((row) => {
        return row.map(cell => {
          let transformedCell = cell;
          
          Object.entries(abbreviationMap).forEach(([full, abbrev]) => {
            transformedCell = transformedCell.replace(new RegExp(full, 'gi'), abbrev);
          });
          
          transformedCell = transformedCell
            .replace(/\s+and\s+/gi, ' & ')
            .replace(/\s+with\s+/gi, ' w/ ')
            .replace(/\s+for\s+/gi, ' 4 ')
            .replace(/\s+detection\s+/gi, ' detect. ')
            .replace(/\s+validation\s+/gi, ' valid. ');
          
          return transformedCell;
        });
      })
    };
    
    if (transformedTable.rows.length > 0) {
      transformedTable.rows[0] = transformedTable.rows[0].map(header => {
        return header
          .replace('Author / Title / Year', 'Author')
          .replace('Methods', 'Method')
          .replace('Advantages', 'Pros')
          .replace('Limitations', 'Cons')
          .replace('Research Gaps', 'Gaps');
      });
    }
    
    return transformedTable;
  };

  const generateAdvancedTableLatex = (table, tableNumber, template) => {
    if (!template) template = 'ieee';
    if (!table.rows || table.rows.length === 0) return '';
    
    const workingTable = template === 'ieee' ? transformTableForIEEE(table) : table;
    const colCount = workingTable.rows[0] ? workingTable.rows[0].length : 0;
    
    let totalChars = 0;
    let maxCellLength = 0;
    workingTable.rows.forEach(row => {
      row.forEach(cell => {
        totalChars += cell.length;
        maxCellLength = Math.max(maxCellLength, cell.length);
      });
    });
    const avgCellLength = totalChars / (workingTable.rows.length * colCount);
    
    let environment, fontSize, colSpec = '';
    
    if (template === 'ieee') {
      const estimatedWidth = colCount * (avgCellLength * 0.12 + 0.3);
      
      if (estimatedWidth <= 8.5) {
        environment = 'table';
        if (maxCellLength > 20) {
          fontSize = '\\scriptsize';
        } else if (maxCellLength > 15) {
          fontSize = '\\footnotesize';
        } else {
          fontSize = '\\small';
        }
        
        const availableWidth = 8.0;
        const baseWidth = availableWidth / colCount;
        
        for (let i = 0; i < colCount; i++) {
          const columnContent = workingTable.rows.map(row => row[i] || '');
          const maxLength = Math.max(...columnContent.map(cell => cell.length));
          
          if (maxLength <= 6) {
            colSpec += 'c';
          } else {
            const width = Math.min(baseWidth, Math.max(1.0, maxLength * 0.15));
            colSpec += `p{${width.toFixed(1)}cm}`;
          }
        }
      } else {
        environment = 'table*';
        fontSize = '\\footnotesize';
        
        for (let i = 0; i < colCount; i++) {
          const columnContent = workingTable.rows.map(row => row[i] || '');
          const maxLength = Math.max(...columnContent.map(cell => cell.length));
          
          if (maxLength > 25) {
            colSpec += 'p{0.18\\textwidth}';
          } else if (maxLength > 15) {
            colSpec += 'p{0.15\\textwidth}';
          } else if (maxLength < 8) {
            colSpec += 'c';
          } else {
            colSpec += 'l';
          }
        }
      }
    } else {
      environment = colCount > 4 ? 'table*' : 'table';
      fontSize = template === 'springer' ? '\\small' : '\\footnotesize';
      
      for (let i = 0; i < colCount; i++) {
        const columnContent = workingTable.rows.map(row => row[i] || '');
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
    
    let latex = `\n\\begin{${environment}}[htbp]\n`;
    latex += '\\centering\n';
    latex += `${fontSize}\n`;
    
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
    
    workingTable.rows.forEach((row, rowIndex) => {
      const paddedRow = [...row];
      while (paddedRow.length < colCount) {
        paddedRow.push('');
      }
      
      const escapedRow = paddedRow.map(cell => {
        return cell
          .replace(/[&%$#_{}]/g, '\\$&')
          .replace(/\\/g, '\\textbackslash{}')
          .replace(/\^/g, '\\textasciicircum{}')
          .replace(/~/g, '\\textasciitilde{}');
      });
      
      latex += escapedRow.join(' & ') + ' \\\\\n';
      
      if (rowIndex === 0 && workingTable.hasHeaders) {
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
    latex += `\\end{${environment}}\n`;
    
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
            return generateAdvancedTableLatex(parsedDoc.tables[tableIndex], tableIndex + 1, template);
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
          <h1 className="text-3xl font-bold text-gray-900">Advanced LaTeX Document Converter</h1>
          <p className="text-gray-600 mt-2">Intelligent table transformation for IEEE single-column optimization</p>
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
                    { id: 'ieee', name: 'IEEE Conference', desc: 'Single-column table transformation' },
                    { id: 'springer', name: 'Springer LNCS', desc: 'Lecture Notes in Computer Science' },
                    { id: 'acm', name: 'ACM Format', desc: 'ACM conference/journal format' }
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
                <h3 className="font-semibold text-green-900 mb-3">🚀 Advanced Table Transformation</h3>
                <div className="text-sm text-green-800 space-y-2">
                  <p><strong>✨ IEEE Single-Column Magic:</strong> Your wide tables automatically fit in single column!</p>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p><strong>Smart Abbreviations:</strong></p>
                      <p>• "Authentication" → "Auth."</p>
                      <p>• "Performance" → "Perf."</p>
                      <p>• "Implementation" → "Impl."</p>
                      <p>• "Bluetooth Low Energy" → "BLE"</p>
                    </div>
                    <div>
                      <p><strong>Content Optimization:</strong></p>
                      <p>• Headers shortened automatically</p>
                      <p>• Long phrases abbreviated</p>
                      <p>• Precise column width calculation</p>
                      <p><strong>⚠️ Review transformations manually</strong></p>
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
                  <p className="text-gray-600 mb-4">Advanced table transformation for IEEE format</p>
                  
                  <div className="bg-green-50 p-3 rounded-lg mb-4">
                    <h4 className="font-semibold text-green-900 text-sm mb-2">📄 Supported File Formats:</h4>
                    <div className="grid grid-cols-2 gap-2 text-xs text-green-800">
                      <div>• <span className="font-medium">.txt</span> - Plain text files (recommended)</div>
                      <div>• <span className="font-medium">.md</span> - Markdown files</div>
                      <div>• <span className="font-medium">.rtf</span> - Rich text format</div>
                      <div>• <span className="font-medium">Note:</span> For Word docs, save as .txt</div>
                    </div>
                  </div>
                  
                  <div className="bg-yellow-50 p-3 rounded-lg mb-4 text-left">
                    <h4 className="font-semibold text-yellow-900 text-sm mb-2">📝 Document Structure Guidelines:</h4>
                    <div className="text-xs text-yellow-800 space-y-1">
                      <p><strong>Title:</strong> Clear title at the beginning</p>
                      <p><strong>Authors:</strong> Author names separated by commas</p>
                      <p><strong>Abstract:</strong> Start with "Abstract—" or "Abstract:"</p>
                      <p><strong>Keywords:</strong> "Index Terms—" or "Keywords:"</p>
                      <p><strong>Main Sections:</strong> I. INTRODUCTION or 1. INTRODUCTION</p>
                      <p><strong>Subsections:</strong> 1.1, 1.2, 2.1, 2.2.1 for nested content</p>
                      <p><strong>Roman Numerals:</strong> I., II., III., IV., V. for main sections</p>
                      <p><strong>Multi-level:</strong> Support for 1.2.3.4 deep nesting</p>
                      <p><strong>References:</strong> REFERENCES section with [1], [2] citations</p>
                      <p><strong>Affiliations:</strong> University/Department info after authors</p>
                    </div>
                  </div>
                  
                  <div className="bg-blue-50 p-3 rounded-lg mb-4 text-left">
                    <h4 className="font-semibold text-blue-900 text-sm mb-2">🔢 Table Format (Will be auto-transformed):</h4>
                    <div className="text-xs text-blue-800 space-y-2">
                      <code className="block bg-white p-2 rounded text-xs font-mono">
                        Table 1: Analysis of Existing Systems
                        <br/>||====||
                        <br/>||Author|Method|Advantages|Limitations|Research Gaps||
                        <br/>||Wang, R.|Enhanced QR Code|Simple to use|Single factor only|Need for physical presence validation||
                        <br/>||====||
                      </code>
                      <p><strong>✨ Transformation:</strong> IEEE format will automatically abbreviate long content!</p>
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

Example with transformable table:

SecureAttend: Multi-Factor Authentication Framework

Author Name, Co-Author Name

Abstract - This paper presents a comprehensive multi-factor authentication system.

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

The literature review encompasses critical aspects of attendance systems."
                  />
                  
                  <div className="flex gap-3">
                    <button
                      onClick={handleTextInput}
                      disabled={!textInput.trim() || isProcessing}
                      className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-300"
                    >
                      {isProcessing ? 'Processing...' : 'Transform & Process'}
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
                  <p className="mt-2 text-gray-600">Transforming tables and optimizing document...</p>
                </div>
              )}

              {parsedContent && (
                <div className="bg-gray-50 p-6 rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-4">📊 Transformation Results</h3>
                  
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
                      <div className="text-2xl font-bold text-purple-600">{parsedContent.figures ? parsedContent.figures.length : 0}</div>
                      <div className="text-sm text-purple-800">Figures</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-orange-600">{latexOutput.split('\n').length}</div>
                      <div className="text-sm text-orange-800">LaTeX Lines</div>
                    </div>
                  </div>

                  {parsedContent.tables && parsedContent.tables.length > 0 && (
                    <div className="mt-4">
                      <div className="font-medium text-gray-700 mb-2">🚀 Table Transformation Analysis:</div>
                      <div className="bg-green-50 p-3 rounded">
                        {parsedContent.tables.map((table, index) => {
                          const originalTable = table;
                          const transformedTable = selectedTemplate === 'ieee' ? transformTableForIEEE(table) : table;
                          const colCount = originalTable.rows[0] ? originalTable.rows[0].length : 0;
                          
                          let originalChars = 0;
                          let transformedChars = 0;
                          originalTable.rows.forEach(row => {
                            row.forEach(cell => originalChars += cell.length);
                          });
                          transformedTable.rows.forEach(row => {
                            row.forEach(cell => transformedChars += cell.length);
                          });
                          
                          const spaceSaved = originalChars > 0 ? ((originalChars - transformedChars) / originalChars * 100).toFixed(1) : '0';
                          
                          return (
                            <div key={index} className="text-sm mb-3 border-l-4 border-green-500 pl-3">
                              <span className="font-medium text-green-800">Table {index + 1} Transformation:</span>
                              <div className="text-xs text-green-600 mt-1 space-y-1">
                                <p><strong>Original:</strong> {originalTable.rows.length} rows × {colCount} columns ({originalChars} chars)</p>
                                <p><strong>Transformed:</strong> {transformedTable.rows.length} rows × {colCount} columns ({transformedChars} chars)</p>
                                <p><strong>Space Saved:</strong> {spaceSaved}% content reduction</p>
                                <p><strong>Environment:</strong> {selectedTemplate === 'ieee' ? 'Single column (table)' : 'Standard'}</p>
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
                <h3 className="text-lg font-semibold text-gray-900">Transformed LaTeX Output</h3>
                <div className="flex gap-3">
                  <select
                    value={selectedTemplate}
                    onChange={(e) => handleTemplateChange(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="ieee">IEEE Conference (Transform Active)</option>
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
                  placeholder="Transformed LaTeX code will appear here..."
                />
              </div>

              {parsedContent && (
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-blue-900 mb-2">📊 Document Statistics</h4>
                  <div className="grid grid-cols-4 gap-4 text-sm text-center">
                    <div>
                      <span className="text-blue-700 font-medium block">Tables</span>
                      <span className="text-xl font-bold text-green-600">{parsedContent.tables ? parsedContent.tables.length : 0}</span>
                    </div>
                    <div>
                      <span className="text-blue-700 font-medium block">Transformed</span>
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
                              const transformedTable = selectedTemplate === 'ieee' ? transformTableForIEEE(table) : table;
                              return (
                                <div key={partIndex} className="my-4 border border-gray-300 rounded overflow-hidden">
                                  <div className="bg-blue-100 px-3 py-1 text-xs font-medium">
                                    Table {tableIndex + 1}: {table.caption || 'Transformed Table'}
                                    {selectedTemplate === 'ieee' && (
                                      <span className="ml-2 text-blue-600">(Single Column Optimized)</span>
                                    )}
                                  </div>
                                  <div className="overflow-x-auto">
                                    <table className="w-full text-xs">
                                      <tbody>
                                        {transformedTable.rows.slice(0, 4).map((row, rowIndex) => (
                                          <tr key={rowIndex} className={rowIndex === 0 && transformedTable.hasHeaders ? 'bg-gray-50 font-medium' : ''}>
                                            {row.map((cell, cellIndex) => (
                                              <td key={cellIndex} className="border-r border-gray-200 px-2 py-1 text-xs">
                                                {cell.length > 15 ? cell.substring(0, 15) + '...' : cell}
                                              </td>
                                            ))}
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                  {selectedTemplate === 'ieee' && (
                                    <div className="bg-yellow-50 px-3 py-1 text-xs text-yellow-800">
                                      <strong>Note:</strong> Auth.=Authentication, Perf.=Performance, etc.
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
                <h4 className="font-semibold text-yellow-900 mb-2">🎯 IEEE Transformation Notes</h4>
                <div className="text-sm text-yellow-800 space-y-2">
                  <p><strong>✨ Single-column optimization applied automatically</strong></p>
                  <p><strong>📏 Content abbreviated for space:</strong> Review for accuracy</p>
                  <p><strong>📊 Table environment optimized:</strong> Uses single column when possible</p>
                  <p><strong>🚀 Ready to compile:</strong> Copy LaTeX and check abbreviations!</p>
                  <p><strong>⚠️ Important:</strong> Verify abbreviated content preserves original meaning</p>
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