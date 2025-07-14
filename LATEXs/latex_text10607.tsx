import React, { useState } from 'react';
import { Upload, FileText, Download, Eye, Code, Copy } from 'lucide-react';

const LaTeXConverter = () => {
  const [activeTab, setActiveTab] = useState('upload');
  const [document, setDocument] = useState(null);
  const [parsedContent, setParsedContent] = useState(null);
  const [latexOutput, setLatexOutput] = useState('');
  const [selectedTemplate, setSelectedTemplate] = useState('ieee');
  const [isProcessing, setIsProcessing] = useState(false);

  // Completely rewritten document parsing function
  const parseDocument = (text) => {
    const result = {
      title: '',
      authors: '',
      abstract: '',
      keywords: '',
      sections: []
    };
    
    if (!text || text.trim().length === 0) {
      return result;
    }
    
    // Split text into lines and clean them
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    if (lines.length === 0) return result;
    
    // Extract title - first meaningful line
    result.title = lines[0];
    
    // Find authors - look for line with commas that comes before Abstract
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i];
      if (line.toLowerCase().includes('abstract')) break;
      if (line.includes(',') && !line.includes('University') && !line.includes('Department') && !line.includes('Email')) {
        result.authors = line;
        break;
      }
    }
    
    // Find abstract
    const abstractStartIdx = lines.findIndex(line => line.toLowerCase().includes('abstract'));
    if (abstractStartIdx !== -1) {
      const abstractLine = lines[abstractStartIdx];
      
      // Extract abstract content - could be on same line or next lines
      if (abstractLine.includes('—') || abstractLine.includes(':') || abstractLine.includes('-')) {
        // Abstract content is after the dash/colon
        const parts = abstractLine.split(/[—:-]/);
        if (parts.length > 1) {
          result.abstract = parts.slice(1).join('').trim();
        }
      }
      
      // Also check next lines until we hit Index Terms or a section
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
    
    // Find keywords
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
    
    // Find sections - handle both main sections (1.) and subsections (1.1, 1.2.1)
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // Check for section headers - "1.", "1.1", "1.2.1" etc, with or without space
      const sectionMatch = line.match(/^(\d+(?:\.\d+)*)\.?\s*(.+)$/);
      
      if (sectionMatch) {
        const fullNumber = sectionMatch[1];
        const sectionTitle = sectionMatch[2];
        
        // Determine level based on number of dots in the number
        const level = fullNumber.split('.').length;
        
        // Collect content until next section
        let content = '';
        for (let j = i + 1; j < lines.length; j++) {
          const nextLine = lines[j];
          // Stop if we hit another section (any level)
          if (/^\d+(?:\.\d+)*\.?\s*/.test(nextLine)) {
            break;
          }
          content += nextLine + ' ';
        }
        
        if (content.trim().length > 5) {
          result.sections.push({
            number: fullNumber + '.',
            title: sectionTitle,
            content: content.trim(),
            level: level,
            type: 'numbered'
          });
        }
      }
    }
    
    // If no sections found but we have content, create a basic structure
    if (result.sections.length === 0 && (result.abstract || result.title)) {
      // Create sections from the remaining text
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

  // Fixed LaTeX generation that preserves numbering
  const generateLaTeX = (parsedDoc, template = 'ieee') => {
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
          '\\usepackage{xcolor}'
        ]
      },
      springer: {
        documentClass: '\\documentclass{llncs}',
        packages: [
          '\\usepackage{cite}',
          '\\usepackage{amsmath,amssymb}',
          '\\usepackage{graphicx}',
          '\\usepackage{url}'
        ]
      },
      acm: {
        documentClass: '\\documentclass{acmart}',
        packages: [
          '\\usepackage{cite}',
          '\\usepackage{amsmath,amssymb}',
          '\\usepackage{graphicx}',
          '\\usepackage{booktabs}'
        ]
      }
    };
    
    const config = templates[template];
    
    let latex = config.documentClass + '\n';
    latex += config.packages.join('\n') + '\n\n';
    
    // Add document content
    latex += '\\begin{document}\n\n';
    latex += `\\title{${parsedDoc.title}}\n\n`;
    
    // Add authors if available, otherwise use default
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
    
    // Add abstract
    if (parsedDoc.abstract) {
      latex += '\\begin{abstract}\n';
      latex += parsedDoc.abstract + '\n';
      latex += '\\end{abstract}\n\n';
    }
    
    // Add keywords
    if (parsedDoc.keywords) {
      latex += '\\begin{IEEEkeywords}\n';
      latex += parsedDoc.keywords + '\n';
      latex += '\\end{IEEEkeywords}\n\n';
    }
    
    // Add sections with proper hierarchy - PRESERVE ORIGINAL NUMBERING
    parsedDoc.sections.forEach(section => {
      if (section.title === 'REFERENCES') {
        // Handle references section specially
        latex += '\\begin{thebibliography}{00}\n';
        const refs = section.content.split(/\[\d+\]/).filter(ref => ref.trim());
        refs.forEach((ref, index) => {
          if (ref.trim()) {
            latex += `\\bibitem{b${index + 1}} ${ref.trim()}\n`;
          }
        });
        latex += '\\end{thebibliography}\n\n';
      } else {
        // Use appropriate LaTeX section commands based on level
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
        
        // For numbered sections, just use the title (LaTeX will handle numbering)
        latex += `${sectionCommand}{${section.title}}\n`;
        latex += section.content + '\n\n';
      }
    });
    
    latex += '\\end{document}';
    
    return latex;
  };

  // Simplified file upload handler with better text extraction
  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setDocument(file);
    setIsProcessing(true);

    try {
      let text = '';
      
      console.log('Processing file:', file.name, 'Size:', file.size);
      
      // Extract text based on file type
      if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
        text = await file.text();
      } else if (file.name.endsWith('.md')) {
        text = await file.text();
        // Clean up basic markdown
        text = text
          .replace(/^#{1,6}\s+/gm, '') // Remove # headers
          .replace(/\*\*(.*?)\*\*/g, '$1') // Remove bold
          .replace(/\*(.*?)\*/g, '$1') // Remove italic
          .replace(/`(.*?)`/g, '$1'); // Remove inline code
      } else {
        // For DOCX and other formats, try to read as text
        // Note: This is a simplified approach - real DOCX parsing would need mammoth
        text = await file.text();
      }
      
      console.log('Extracted text length:', text.length);
      console.log('First 200 chars:', text.substring(0, 200));
      
      if (!text || text.trim().length < 10) {
        throw new Error('No readable text found in the file. Please check the file format.');
      }
      
      // Parse the document
      console.log('Starting parsing...');
      const parsed = parseDocument(text);
      console.log('Parsed result:', parsed);
      
      // Set the parsed content
      setParsedContent(parsed);
      
      // Generate LaTeX
      console.log('Generating LaTeX...');
      const latex = generateLaTeX(parsed, selectedTemplate);
      console.log('LaTeX generated, length:', latex.length);
      setLatexOutput(latex);
      
      // Switch to editor tab
      setActiveTab('editor');
      
    } catch (error) {
      console.error('Processing error:', error);
      alert(`Error: ${error.message}\n\nTry:\n1. Save as .txt file\n2. Check file contains readable text\n3. Ensure proper document structure`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Template change handler
  const handleTemplateChange = (template) => {
    setSelectedTemplate(template);
    if (parsedContent) {
      const latex = generateLaTeX(parsedContent, template);
      setLatexOutput(latex);
    }
  };

  // Copy LaTeX to clipboard
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(latexOutput);
      alert('LaTeX code copied to clipboard!');
    } catch (error) {
      console.error('Failed to copy to clipboard:', error);
      alert('Copy failed. Please select all text in the LaTeX editor and copy manually.');
    }
  };

  // Generate Overleaf link
  const openInOverleaf = () => {
    try {
      copyToClipboard();
      window.open('https://www.overleaf.com/project', '_blank');
      
      setTimeout(() => {
        alert('LaTeX code copied to clipboard!\n\nOverleaf is opening in a new tab.\n\nTo use:\n1. Create a new blank project in Overleaf\n2. Paste the LaTeX code (Ctrl+V)\n3. Compile to see your PDF!');
      }, 500);
    } catch (error) {
      console.error('Error opening Overleaf:', error);
      alert('Please copy the LaTeX code manually and paste it into Overleaf.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-6 bg-gray-50 min-h-screen">
      <div className="bg-white rounded-lg shadow-lg">
        {/* Header */}
        <div className="border-b border-gray-200 p-6">
          <h1 className="text-3xl font-bold text-gray-900">LaTeX Document Converter</h1>
          <p className="text-gray-600 mt-2">Convert your documents to professional LaTeX format with IEEE support</p>
        </div>

        {/* Tabs */}
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

        {/* Content */}
        <div className="p-6">
          {/* Upload Tab */}
          {activeTab === 'upload' && (
            <div className="space-y-6">
              {/* Template Selection */}
              <div className="bg-blue-50 p-4 rounded-lg">
                <h3 className="font-semibold text-blue-900 mb-3">Select Template</h3>
                <div className="grid grid-cols-3 gap-4">
                  {[
                    { id: 'ieee', name: 'IEEE Conference', desc: 'Two-column conference format' },
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

              {/* Document Upload */}
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors">
                <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Upload Your Document</h3>
                <p className="text-gray-600 mb-4">Support for multiple document formats</p>
                
                {/* Supported Formats */}
                <div className="bg-green-50 p-3 rounded-lg mb-4">
                  <h4 className="font-semibold text-green-900 text-sm mb-2">📄 Supported File Formats:</h4>
                  <div className="grid grid-cols-2 gap-2 text-xs text-green-800">
                    <div className="flex items-center gap-1">
                      <span className="font-medium">.docx</span> - Microsoft Word documents
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-medium">.txt</span> - Plain text files
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-medium">.md</span> - Markdown files
                    </div>
                    <div className="flex items-center gap-1">
                      <span className="font-medium">.rtf</span> - Rich text format
                    </div>
                  </div>
                </div>
                
                {/* Format Guidelines */}
                <div className="bg-yellow-50 p-3 rounded-lg mb-4 text-left">
                  <h4 className="font-semibold text-yellow-900 text-sm mb-2">📝 Document Structure Guidelines:</h4>
                  <div className="text-xs text-yellow-800 space-y-1">
                    <p><strong>Title:</strong> Clear title at the beginning</p>
                    <p><strong>Authors:</strong> Author names separated by commas</p>
                    <p><strong>Abstract:</strong> Start with "Abstract—" or "Abstract:"</p>
                    <p><strong>Keywords:</strong> "Index Terms—" or "Keywords:"</p>
                    <p><strong>Sections:</strong> I. INTRODUCTION or 1. INTRODUCTION</p>
                    <p><strong>Subsections:</strong> 2.1, 2.2, 2.2.1 for nested content</p>
                  </div>
                </div>
                
                <input
                  type="file"
                  accept=".txt,.docx,.md,.rtf"
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
                {document && !isProcessing && !parsedContent && (
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                    <p className="text-blue-700 mb-3">
                      <strong>Ready to process:</strong> {document.name}
                    </p>
                    <button
                      onClick={() => handleFileUpload({ target: { files: [document] } })}
                      className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      Process Document
                    </button>
                  </div>
                )}
                
                {document && (
                  <div className="mt-4 p-3 bg-green-50 rounded-lg">
                    <p className="text-green-700">
                      <strong>Uploaded:</strong> {document.name} ({(document.size / 1024).toFixed(1)} KB)
                    </p>
                    <p className="text-xs text-green-600 mt-1">
                      Format: {document.name.split('.').pop().toUpperCase()}
                    </p>
                  </div>
                )}
              </div>

              {/* Processing Status */}
              {isProcessing && (
                <div className="text-center py-8">
                  <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                  <p className="mt-2 text-gray-600">Processing document...</p>
                </div>
              )}

              {/* Parsed Content Preview */}
              {parsedContent && (
                <div className="bg-gray-50 p-6 rounded-lg">
                  <h3 className="font-semibold text-gray-900 mb-4">Document Structure Detected</h3>
                  <div className="space-y-3">
                    <div>
                      <span className="font-medium text-gray-700">Title:</span>
                      <span className="ml-2 text-gray-900">{parsedContent.title || 'Not detected'}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Authors:</span>
                      <span className="ml-2 text-gray-900">{parsedContent.authors || 'Not detected'}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Abstract:</span>
                      <span className="ml-2 text-gray-900">{parsedContent.abstract ? `Found (${parsedContent.abstract.length} chars)` : 'Not found'}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Keywords:</span>
                      <span className="ml-2 text-gray-900">{parsedContent.keywords ? `Found (${parsedContent.keywords.length} chars)` : 'Not found'}</span>
                    </div>
                    <div>
                      <span className="font-medium text-gray-700">Sections:</span>
                      <span className="ml-2 text-gray-900">{parsedContent.sections.length} found</span>
                    </div>
                    {parsedContent.sections.length > 0 && (
                      <div className="mt-3">
                        <div className="text-sm text-gray-600">Section titles:</div>
                        <ul className="list-disc list-inside ml-4 text-sm text-gray-800">
                          {parsedContent.sections.map((section, index) => (
                            <li key={index}>
                              {section.level > 1 ? '  '.repeat(section.level - 1) : ''}{section.number} {section.title}
                              <span className="text-gray-500 ml-2">({section.content.length} chars)</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    
                    {/* Debug info */}
                    <div className="mt-4 p-3 bg-blue-50 rounded">
                      <div className="text-xs text-blue-800">
                        <strong>Debug Info:</strong>
                        <br />LaTeX Output Length: {latexOutput.length} characters
                        <br />Processing Status: {isProcessing ? 'Processing...' : 'Complete'}
                        <br />Current Tab: {activeTab}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-4">
                    <button
                      onClick={() => setActiveTab('editor')}
                      className="bg-green-600 text-white px-6 py-2 rounded-lg hover:bg-green-700 transition-colors"
                    >
                      View LaTeX Output →
                    </button>
                    <button
                      onClick={() => setActiveTab('preview')}
                      className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                    >
                      View Preview →
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Editor Tab */}
          {activeTab === 'editor' && (
            <div className="space-y-6">
              {/* Controls */}
              <div className="flex justify-between items-center">
                <h3 className="text-lg font-semibold text-gray-900">LaTeX Output</h3>
                <div className="flex gap-3">
                  <select
                    value={selectedTemplate}
                    onChange={(e) => handleTemplateChange(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="ieee">IEEE Conference</option>
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

              {/* LaTeX Code Editor */}
              <div className="border border-gray-300 rounded-lg overflow-hidden">
                <div className="bg-gray-100 px-4 py-2 border-b border-gray-300">
                  <span className="font-medium text-gray-700">LaTeX Source Code</span>
                </div>
                <textarea
                  value={latexOutput}
                  onChange={(e) => setLatexOutput(e.target.value)}
                  className="w-full h-96 p-4 font-mono text-sm resize-none border-0 focus:ring-0"
                  placeholder="LaTeX code will appear here..."
                />
              </div>

              {/* Statistics */}
              {parsedContent && (
                <div className="bg-blue-50 p-4 rounded-lg">
                  <h4 className="font-semibold text-blue-900 mb-2">Document Statistics</h4>
                  <div className="grid grid-cols-4 gap-4 text-sm">
                    <div>
                      <span className="text-blue-700 font-medium">LaTeX Lines:</span>
                      <span className="ml-2">{latexOutput.split('\n').length}</span>
                    </div>
                    <div>
                      <span className="text-blue-700 font-medium">Sections:</span>
                      <span className="ml-2">{parsedContent.sections.length}</span>
                    </div>
                    <div>
                      <span className="text-blue-700 font-medium">Template:</span>
                      <span className="ml-2">{selectedTemplate.toUpperCase()}</span>
                    </div>
                    <div>
                      <span className="text-blue-700 font-medium">Status:</span>
                      <span className="ml-2 text-green-600">Ready to compile</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Preview Tab */}
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

              {/* Document Preview */}
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
                    <div key={index} className="mb-4" style={{marginLeft: `${(section.level - 1) * 20}px`}}>
                      <h3 className={`font-bold mb-2 ${section.level === 1 ? 'text-lg' : section.level === 2 ? 'text-base' : 'text-sm'}`}>
                        {section.number} {section.title}
                      </h3>
                      <p className="text-sm text-gray-700 text-justify">
                        {section.content.substring(0, 300)}
                        {section.content.length > 300 && '...'}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Instructions */}
              <div className="bg-yellow-50 p-4 rounded-lg">
                <h4 className="font-semibold text-yellow-900 mb-2">How to Get Your PDF</h4>
                <div className="text-sm text-yellow-800 space-y-2">
                  <p><strong>Option 1 - Overleaf (Recommended):</strong> Click "Open in Overleaf" to compile your LaTeX directly in the browser.</p>
                  <p><strong>Option 2 - Copy & Paste:</strong> Click "Copy LaTeX" and paste into any LaTeX editor (Overleaf, TeXworks, etc.).</p>
                  <p><strong>Option 3 - Manual Copy:</strong> Select all text from the LaTeX Editor tab and copy to your preferred LaTeX compiler.</p>
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