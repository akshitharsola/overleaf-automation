import React, { useState } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, Eye, Search } from 'lucide-react';

const DocxAnalyzer = () => {
  const [file, setFile] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('upload');

  const loadMammoth = () => {
    return new Promise((resolve, reject) => {
      if (window.mammoth) {
        resolve(window.mammoth);
        return;
      }
      
      const script = document.createElement('script');
      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js';
      script.onload = () => resolve(window.mammoth);
      script.onerror = reject;
      document.head.appendChild(script);
    });
  };

  const analyzeDocumentStructure = (html, rawText) => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    
    const analysis = {
      title: null,
      authors: null,
      abstract: null,
      keywords: null,
      sections: [],
      tables: [],
      equations: [],
      textLines: [],
      tableContent: new Set(),
      detectionMethod: 'none'
    };

    // Step 1: Extract all table content first to avoid false section detection
    const tables = Array.from(doc.querySelectorAll('table'));
    tables.forEach((table, tableIndex) => {
      const rows = Array.from(table.querySelectorAll('tr'));
      const tableData = rows.map(row => 
        Array.from(row.querySelectorAll('td, th')).map(cell => {
          const cellText = cell.textContent.trim();
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

    // Step 2: Split raw text into lines for analysis
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
        isInTable: analysis.tableContent.has(trimmedLine.toLowerCase())
      };
    });

    // Step 3: Detect sections with manual numbering (excluding table content)
    let sectionsFound = [];
    
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
        const title = match[2];
        
        // Additional table content filtering - check if title appears in any table
        const titleInTable = Array.from(analysis.tableContent).some(tableText => 
          tableText.includes(title.toLowerCase()) || 
          title.toLowerCase().includes(tableText)
        );
        
        if (!titleInTable) {
          sectionsFound.push({
            number: match[1],
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

    // Step 4: Extract content for each section
    sectionsFound.forEach((section, sectionIndex) => {
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
      content: section.content,
      contentPreview: section.contentPreview,
      level: section.level,
      type: section.type,
      confidence: section.confidence,
      reasoning: section.reasoning,
      originalText: section.fullText,
      wordCount: section.wordCount
    }));

    analysis.detectionMethod = sectionsFound.length > 0 ? 'success' : 'failed';

    // Step 5: Detect other document elements
    
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

    // Equation detection
    const dollarMatches = (html.match(/\$[^$]+\$/g) || []);
    analysis.equations = dollarMatches.map((eq, index) => ({
      id: index + 1,
      content: eq,
      type: 'latex_math',
      confidence: 0.95
    }));

    return analysis;
  };

  const handleFileUpload = async (event) => {
    const selectedFile = event.target.files[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith('.docx')) {
      setError('Please upload a .docx file');
      return;
    }

    setFile(selectedFile);
    setLoading(true);
    setError(null);

    try {
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

      const documentAnalysis = analyzeDocumentStructure(htmlResult.value, textResult.value);
      
      setAnalysis({
        ...documentAnalysis,
        rawHtml: htmlResult.value,
        rawText: textResult.value,
        fileName: selectedFile.name,
        fileSize: selectedFile.size
      });
      
      setActiveTab('analysis');
    } catch (err) {
      setError(`Error processing file: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const renderConfidenceBar = (confidence) => {
    const percentage = Math.round(confidence * 100);
    const color = confidence > 0.8 ? 'bg-green-500' : confidence > 0.6 ? 'bg-yellow-500' : 'bg-red-500';
    
    return (
      <div className="flex items-center gap-2">
        <div className="w-20 bg-gray-200 rounded-full h-2">
          <div 
            className={`h-2 rounded-full ${color}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="text-sm font-medium">{percentage}%</span>
      </div>
    );
  };

  const renderDetectionCard = (title, data, icon) => {
    if (!data) {
      return (
        <div className="bg-gray-50 p-4 rounded-lg border-2 border-dashed border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            {icon}
            <span className="font-medium text-gray-500">{title}</span>
          </div>
          <p className="text-sm text-gray-400">Not detected</p>
        </div>
      );
    }

    return (
      <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm">
        <div className="flex items-center gap-2 mb-2">
          {icon}
          <span className="font-medium text-gray-800">{title}</span>
          {renderConfidenceBar(data.confidence)}
        </div>
        <div className="text-sm text-gray-600 mb-2">
          <strong>Reasoning:</strong> {data.reasoning}
        </div>
        <div className="bg-blue-50 p-3 rounded text-sm">
          <strong>Content:</strong> {data.text.substring(0, 200)}
          {data.text.length > 200 && '...'}
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          DOCX Analyzer v4.0 - Manual Numbering Focused
        </h1>
        <p className="text-gray-600">
          Optimized for manually typed section numbers with table content filtering
        </p>
      </div>

      <div className="flex gap-4 mb-6">
        <button
          onClick={() => setActiveTab('upload')}
          className={`px-4 py-2 rounded-lg font-medium ${
            activeTab === 'upload' ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
          }`}
        >
          <Upload className="w-4 h-4 inline mr-2" />
          Upload
        </button>
        <button
          onClick={() => setActiveTab('analysis')}
          disabled={!analysis}
          className={`px-4 py-2 rounded-lg font-medium ${
            activeTab === 'analysis' && analysis ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50'
          }`}
        >
          <Eye className="w-4 h-4 inline mr-2" />
          Analysis
        </button>
        <button
          onClick={() => setActiveTab('debug')}
          disabled={!analysis}
          className={`px-4 py-2 rounded-lg font-medium ${
            activeTab === 'debug' && analysis ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-700 hover:bg-gray-300 disabled:opacity-50'
          }`}
        >
          <Search className="w-4 h-4 inline mr-2" />
          Debug
        </button>
      </div>

      {activeTab === 'upload' && (
        <div className="space-y-6">
          <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
            <FileText className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">Upload DOCX File</h3>
            <p className="text-gray-600 mb-4">
              Upload your document with manually typed section numbers (1. Introduction, 2. Methods, etc.)
            </p>
            
            <div className="bg-green-50 p-4 rounded-lg mb-4 text-left">
              <h4 className="font-semibold text-green-900 mb-2">✅ Supported Section Formats:</h4>
              <div className="text-sm text-green-800 space-y-1">
                <p>• <strong>Main sections:</strong> "1. Introduction", "2. Methodology"</p>
                <p>• <strong>Subsections:</strong> "4.1 Performance Analysis", "4.2 Results"</p>
                <p>• <strong>Sub-subsections:</strong> "4.1.1 Implementation Details"</p>
                <p>• <strong>Roman numerals:</strong> "I. Introduction", "II. Methods"</p>
              </div>
            </div>
            
            <input
              type="file"
              accept=".docx"
              onChange={handleFileUpload}
              className="hidden"
              id="docx-upload"
            />
            <label
              htmlFor="docx-upload"
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 cursor-pointer inline-block"
            >
              Choose DOCX File
            </label>
            
            {file && (
              <div className="mt-4 p-3 bg-green-50 rounded-lg">
                <p className="text-green-700">
                  <strong>File:</strong> {file.name} ({Math.round(file.size / 1024)} KB)
                </p>
              </div>
            )}
          </div>

          {loading && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
              <p className="text-gray-600">Processing document with table-aware section detection...</p>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                <span className="text-red-800 font-medium">Error</span>
              </div>
              <p className="text-red-700 mt-2">{error}</p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'analysis' && analysis && (
        <div className="space-y-6">
          <div className={`p-4 rounded-lg border-2 ${
            analysis.detectionMethod === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center gap-2">
              {analysis.detectionMethod === 'success' ? (
                <CheckCircle className="w-5 h-5 text-green-600" />
              ) : (
                <AlertCircle className="w-5 h-5 text-red-600" />
              )}
              <span className={`font-medium ${
                analysis.detectionMethod === 'success' ? 'text-green-800' : 'text-red-800'
              }`}>
                Section Detection: {analysis.detectionMethod === 'success' ? 'Success' : 'Failed'}
              </span>
            </div>
            <p className={`mt-2 text-sm ${
              analysis.detectionMethod === 'success' ? 'text-green-700' : 'text-red-700'
            }`}>
              {analysis.detectionMethod === 'success' 
                ? `Found ${analysis.sections.length} sections (table content excluded)`
                : 'No manually numbered sections detected. Check Debug tab for analysis.'}
            </p>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-gray-800 mb-2">Document Statistics</h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm">
              <div><strong>File:</strong> {analysis.fileName}</div>
              <div><strong>Size:</strong> {Math.round(analysis.fileSize / 1024)} KB</div>
              <div><strong>Tables:</strong> {analysis.tables.length}</div>
              <div><strong>Table Items:</strong> {analysis.tableContent.size}</div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {renderDetectionCard('Title', analysis.title, <CheckCircle className="w-5 h-5 text-green-600" />)}
            {renderDetectionCard('Authors', analysis.authors, <FileText className="w-5 h-5 text-blue-600" />)}
            {renderDetectionCard('Abstract', analysis.abstract, <FileText className="w-5 h-5 text-purple-600" />)}
            {renderDetectionCard('Keywords', analysis.keywords, <FileText className="w-5 h-5 text-orange-600" />)}
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-gray-800 mb-4">Sections Detected ({analysis.sections.length})</h3>
            {analysis.sections.length === 0 ? (
              <div className="text-center py-8">
                <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500 mb-2">No sections detected</p>
                <p className="text-sm text-gray-400">
                  Make sure you have manually typed section numbers like "1. Introduction"
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {analysis.sections.map((section, index) => (
                  <div key={index} className="bg-gray-50 p-4 rounded border-l-4 border-blue-500">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900 text-lg">
                          {section.number} {section.title}
                        </span>
                        <div className="flex gap-1">
                          <span className={`px-2 py-1 rounded text-xs font-medium ${
                            section.type === 'numbered' ? 'bg-blue-100 text-blue-800' :
                            section.type === 'subsection' ? 'bg-cyan-100 text-cyan-800' :
                            section.type === 'subsubsection' ? 'bg-indigo-100 text-indigo-800' :
                            'bg-purple-100 text-purple-800'
                          }`}>
                            {section.type} | Level {section.level}
                          </span>
                          <span className="px-2 py-1 rounded text-xs font-medium bg-green-100 text-green-800">
                            {section.wordCount} words
                          </span>
                        </div>
                      </div>
                      {renderConfidenceBar(section.confidence)}
                    </div>
                    
                    <div className="text-sm text-gray-600 mb-3">
                      <strong>Detection:</strong> {section.reasoning}
                    </div>
                    
                    <div className="bg-white p-3 rounded border border-gray-200">
                      <div className="text-sm text-gray-800 mb-2">
                        <strong>Original:</strong> "{section.originalText}"
                      </div>
                      {section.content !== 'No content detected' && (
                        <div className="text-sm text-gray-700 bg-blue-50 p-2 rounded">
                          <strong>Content Preview:</strong> {section.contentPreview}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {analysis.tables.length > 0 && (
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <h3 className="font-semibold text-gray-800 mb-4">Tables Detected ({analysis.tables.length})</h3>
              {analysis.tables.map((table, index) => (
                <div key={index} className="bg-gray-50 p-3 rounded mb-3">
                  <div className="text-sm font-medium text-gray-800 mb-2">
                    Table {table.id}: {table.rows} rows × {table.columns} columns
                  </div>
                  <div className="text-xs bg-white p-2 rounded border overflow-x-auto">
                    <table className="min-w-full border-collapse">
                      {table.data.map((row, rowIndex) => (
                        <tr key={rowIndex}>
                          {row.map((cell, cellIndex) => (
                            <td key={cellIndex} className="border border-gray-300 px-2 py-1 text-xs">
                              {cell.substring(0, 30)}{cell.length > 30 ? '...' : ''}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </table>
                  </div>
                </div>
              ))}
            </div>
          )}

          {analysis.equations.length > 0 && (
            <div className="bg-white p-4 rounded-lg border border-gray-200">
              <h3 className="font-semibold text-gray-800 mb-4">Equations Detected ({analysis.equations.length})</h3>
              {analysis.equations.map((equation, index) => (
                <div key={index} className="bg-gray-50 p-3 rounded mb-3">
                  <div className="text-sm font-medium text-gray-800 mb-2">
                    Equation {equation.id} ({equation.type})
                  </div>
                  <div className="text-xs bg-white p-2 rounded border font-mono">
                    {equation.content}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'debug' && analysis && (
        <div className="space-y-6">
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-gray-800 mb-4">🔍 Section Detection Analysis</h3>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {analysis.textLines.map((line, index) => {
                const hasManualPattern = /^(\d+\.|\d+\.\d+\.?|\d+\.\d+\.\d+\.?|[IVX]+\.)\s+/.test(line.fullText);
                return (
                  <div key={index} className={`p-3 rounded text-sm border-l-4 ${
                    hasManualPattern && !line.isInTable ? 'bg-green-50 border-green-500' : 
                    line.isInTable ? 'bg-red-50 border-red-300' :
                    hasManualPattern ? 'bg-yellow-50 border-yellow-500' :
                    'bg-gray-50 border-gray-300'
                  }`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium text-gray-600">Line {index + 1}:</span>
                      <div className="flex gap-1">
                        {hasManualPattern && !line.isInTable && <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">✅ SECTION</span>}
                        {hasManualPattern && line.isInTable && <span className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs">⚠️ TABLE SECTION</span>}
                        {line.isInTable && <span className="px-1 py-0.5 bg-red-100 text-red-800 rounded text-xs">In Table</span>}
                        {line.startsWithNumber && <span className="px-1 py-0.5 bg-blue-100 text-blue-800 rounded text-xs">Numbered</span>}
                        {line.startsWithSubNumber && <span className="px-1 py-0.5 bg-cyan-100 text-cyan-800 rounded text-xs">Sub</span>}
                        {line.startsWithRoman && <span className="px-1 py-0.5 bg-purple-100 text-purple-800 rounded text-xs">Roman</span>}
                        {line.containsAbstract && <span className="px-1 py-0.5 bg-pink-100 text-pink-800 rounded text-xs">Abstract</span>}
                        {line.containsKeywords && <span className="px-1 py-0.5 bg-indigo-100 text-indigo-800 rounded text-xs">Keywords</span>}
                      </div>
                    </div>
                    <div className="text-gray-800 font-mono text-xs bg-white p-2 rounded border">
                      "{line.fullText}"
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-gray-800 mb-4">📊 Table Content Filter</h3>
            <div className="text-sm text-gray-600 mb-2">
              <strong>Table content excluded from section detection ({analysis.tableContent.size} items):</strong>
            </div>
            <div className="bg-gray-50 p-3 rounded max-h-32 overflow-y-auto">
              <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-xs">
                {Array.from(analysis.tableContent).slice(0, 50).map((item, index) => (
                  <span key={index} className="bg-white px-2 py-1 rounded border text-gray-700">
                    "{item}"
                  </span>
                ))}
                {analysis.tableContent.size > 50 && (
                  <span className="text-gray-500 italic">... and {analysis.tableContent.size - 50} more</span>
                )}
              </div>
            </div>
          </div>

          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <h3 className="font-semibold text-gray-800 mb-4">📄 Raw Text Preview</h3>
            <pre className="text-xs bg-gray-50 p-3 rounded overflow-x-auto whitespace-pre-wrap max-h-64">
              {analysis.rawText.substring(0, 2000)}
              {analysis.rawText.length > 2000 && '\n\n... (truncated)'}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocxAnalyzer;