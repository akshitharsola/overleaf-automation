import React, { useState } from 'react';
import { Upload, FileText, Copy, Download, AlertCircle, CheckCircle } from 'lucide-react';

const SimpleTextParser = () => {
  const [fileContent, setFileContent] = useState('');
  const [parsedContent, setParsedContent] = useState(null);
  const [latexOutput, setLatexOutput] = useState('');
  const [activeTab, setActiveTab] = useState('upload');

  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setFileContent(e.target.result);
        setActiveTab('preview');
      };
      reader.readAsText(file);
    }
  };

  const parseContent = () => {
    if (!fileContent) return;

    const lines = fileContent.split('\n').map(line => line.trim()).filter(line => line);
    const result = {
      title: '',
      authors: '',
      abstract: '',
      keywords: '',
      sections: []
    };

    let abstractMode = false;
    let keywordsMode = false;
    let foundFirstSection = false;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      // First non-empty line is usually the title
      if (!result.title && line.length > 0 && !line.match(/^\d+\./) && !line.match(/^[IVX]+\./)) {
        result.title = line;
        continue;
      }

      // Abstract detection - look for "Abstract" keyword with various separators
      if (line.toLowerCase().includes('abstract') && !abstractMode) {
        abstractMode = true;
        keywordsMode = false;
        // Check if abstract content is on the same line - handle various separators
        const abstractMatch = line.match(/abstract[\s]*[:\-—–]?\s*(.+)/i);
        if (abstractMatch && abstractMatch[1].trim()) {
          result.abstract = abstractMatch[1].trim();
        }
        continue;
      }

      // If we're in abstract mode, collect content until we hit keywords or sections
      if (abstractMode && !line.toLowerCase().includes('keywords') && !line.toLowerCase().includes('index terms') && !line.match(/^\d+\./) && !line.match(/^[IVX]+\./)) {
        if (result.abstract) {
          result.abstract += ' ' + line;
        } else {
          result.abstract = line;
        }
        continue;
      }

      // Keywords detection
      if (line.toLowerCase().includes('keywords') || line.toLowerCase().includes('index terms')) {
        abstractMode = false;
        keywordsMode = true;
        // Check if keywords are on the same line
        const keywordsMatch = line.match(/(?:keywords|index terms)[:\-—]?\s*(.+)/i);
        if (keywordsMatch && keywordsMatch[1].trim()) {
          result.keywords = keywordsMatch[1].trim();
          keywordsMode = false;
        }
        continue;
      }

      // If we're in keywords mode and haven't found section headers
      if (keywordsMode && !line.match(/^\d+\./) && !line.match(/^[IVX]+\./)) {
        result.keywords = line;
        keywordsMode = false;
        continue;
      }

      // Section detection - numbered (1., 1.1, 1.1.1) or Roman (I., II., III.)
      const numberedMatch = line.match(/^(\d+(?:\.\d+)*)\.?\s*(.+)$/);
      const romanMatch = line.match(/^([IVX]+)\.?\s*(.+)$/);
      
      if (numberedMatch || romanMatch) {
        abstractMode = false;
        keywordsMode = false;
        foundFirstSection = true;
        
        const sectionMatch = numberedMatch || romanMatch;
        const number = sectionMatch[1];
        const title = sectionMatch[2];
        
        // Determine level based on dots in numbered sections
        const level = numberedMatch ? number.split('.').length : 1;
        
        // Collect content until next section
        let content = '';
        for (let j = i + 1; j < lines.length; j++) {
          const nextLine = lines[j];
          if (nextLine.match(/^\d+(?:\.\d+)*\.?\s*/) || nextLine.match(/^[IVX]+\.?\s*/)) {
            break;
          }
          
          // Handle all caps text (likely future work or acknowledgments)
          if (nextLine === nextLine.toUpperCase() && nextLine.length > 10) {
            content += `\\textbf{${nextLine}} `;
          } else {
            content += nextLine + ' ';
          }
        }
        
        result.sections.push({
          number: number + '.',
          title: title,
          content: content.trim(),
          level: level
        });
      }
      
      // If we haven't found sections yet and this looks like author info (after title but before abstract)
      if (!foundFirstSection && !abstractMode && !keywordsMode && !result.authors && result.title && 
          line.length > 0 && !line.toLowerCase().includes('abstract') && 
          !line.match(/^\d+\./) && !line.match(/^[IVX]+\./)) {
        result.authors = line;
      }
    }

    // Set default values if not found
    if (!result.authors) {
      result.authors = 'Author Name';
    }
    if (!result.abstract) {
      result.abstract = 'Abstract content goes here.';
    }

    setParsedContent(result);
    setActiveTab('parsed');
  };

  const [templateType, setTemplateType] = useState('ieee');

  const generateLatex = () => {
    if (!parsedContent) return;

    const templates = {
              ieee: {
        documentClass: '\\documentclass[conference]{IEEEtran}',
        packages: `\\usepackage{cite}
\\usepackage{amsmath,amssymb,amsfonts}
\\usepackage{algorithmic}
\\usepackage{graphicx}
\\usepackage{textcomp}
\\usepackage{xcolor}`,
        abstractEnv: 'abstract',
        keywordsEnv: 'IEEEkeywords',
        authorFormat: 'ieee'
      },
      springer: {
        documentClass: '\\documentclass{llncs}',
        packages: `\\usepackage{cite}
\\usepackage{amsmath,amssymb,amsfonts}
\\usepackage{graphicx}
\\usepackage{url}
\\usepackage[T1]{fontenc}`,
        abstractEnv: 'abstract',
        keywordsEnv: 'keywords',
        authorFormat: 'springer'
      },
      acm: {
        documentClass: '\\documentclass[sigconf]{acmart}',
        packages: `\\usepackage{cite}
\\usepackage{amsmath,amssymb,amsfonts}
\\usepackage{algorithmic}
\\usepackage{graphicx}
\\usepackage{textcomp}
\\usepackage{balance}`,
        abstractEnv: 'abstract',
        keywordsEnv: 'keywords',
        authorFormat: 'acm'
      }
    };

    const template = templates[templateType];
    
    // Format author section based on template
    let authorSection = '';
    if (templateType === 'ieee') {
      authorSection = `\\author{
${parsedContent.authors || 'Author Name'}
}`;
    } else if (templateType === 'springer') {
      authorSection = `\\author{${parsedContent.authors || 'Author Name'}}
\\institute{Institution Name \\\\
\\email{author@institution.edu}}`;
    } else if (templateType === 'acm') {
      authorSection = `\\author{${parsedContent.authors || 'Author Name'}}
\\affiliation{
  \\institution{Institution Name}
  \\city{City}
  \\country{Country}
}
\\email{author@institution.edu}`;
    }

    // Handle keywords section based on template
    let keywordsSection = '';
    if (parsedContent.keywords) {
      if (templateType === 'ieee') {
        keywordsSection = `\\begin{IEEEkeywords}
${parsedContent.keywords}
\\end{IEEEkeywords}

`;
      } else if (templateType === 'acm') {
        keywordsSection = `\\keywords{${parsedContent.keywords}}

`;
      } else { // springer
        keywordsSection = `\\keywords{${parsedContent.keywords}}

`;
      }
    }
    
    const latex = `${template.documentClass}
${template.packages}

\\begin{document}

\\title{${parsedContent.title || 'Your Title Here'}}

${authorSection}

\\maketitle

\\begin{${template.abstractEnv}}
${parsedContent.abstract}
\\end{${template.abstractEnv}}

${keywordsSection}${parsedContent.sections.map(section => {
  const sectionCmd = section.level === 1 ? '\\section' : 
                     section.level === 2 ? '\\subsection' : 
                     section.level === 3 ? '\\subsubsection' : '\\paragraph';
  
  return `${sectionCmd}{${section.title}}
${section.content}

`;
}).join('')}

\\begin{thebibliography}{1}
\\bibitem{ref1} 
Author, A. A. (Year). Title of work. \\textit{Journal Name}, Volume(Issue), pages.
\\end{thebibliography}

\\end{document}`;

    setLatexOutput(latex);
    setActiveTab('latex');
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(latexOutput);
  };

  const downloadLatex = () => {
    const blob = new Blob([latexOutput], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'document.tex';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="max-w-6xl mx-auto p-6 bg-gray-50 min-h-screen">
      <div className="bg-white rounded-lg shadow-lg">
        <div className="p-6 border-b border-gray-200">
          <h1 className="text-2xl font-bold text-gray-800">Simple Text to LaTeX Parser</h1>
          <p className="text-gray-600 mt-2">Upload a .txt file and parse title, authors, keywords, sections, and subsections</p>
        </div>

        {/* Tab Navigation */}
        <div className="border-b border-gray-200">
          <nav className="flex space-x-8">
            {['upload', 'preview', 'parsed', 'latex'].map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-1 border-b-2 font-medium text-sm ${
                  activeTab === tab
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Upload Tab */}
          {activeTab === 'upload' && (
            <div className="space-y-6">
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                <Upload className="mx-auto h-12 w-12 text-gray-400" />
                <div className="mt-4">
                  <label className="cursor-pointer">
                    <span className="mt-2 block text-sm font-medium text-gray-900">
                      Upload your .txt file
                    </span>
                    <input
                      type="file"
                      accept=".txt"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </div>
                <p className="mt-2 text-sm text-gray-500">
                  Supported format: .txt files with structured content
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h3 className="font-medium text-blue-900 mb-2">File Format Guidelines:</h3>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• First line: Document title</li>
                  <li>• Line before "Abstract": Authors (if present)</li>
                  <li>• "Abstract" line: followed by abstract content (supports "Abstract:", "Abstract-", "Abstract—")</li>
                  <li>• Keywords line: "Keywords: keyword1, keyword2, ..."</li>
                  <li>• Sections: "1. Introduction", "2. Methods", etc.</li>
                  <li>• Subsections: "1.1 Overview", "1.2 Details", etc.</li>
                  <li>• Roman numerals also supported: "I. Introduction"</li>
                  <li>• ALL CAPS TEXT will be formatted as bold</li>
                </ul>
              </div>
            </div>
          )}

          {/* Preview Tab */}
          {activeTab === 'preview' && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-medium">File Preview</h2>
                <button
                  onClick={parseContent}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  Parse Content
                </button>
              </div>
              <div className="bg-gray-100 rounded-lg p-4">
                <pre className="text-sm text-gray-700 whitespace-pre-wrap overflow-auto max-h-96">
                  {fileContent}
                </pre>
              </div>
            </div>
          )}

          {/* Parsed Tab */}
          {activeTab === 'parsed' && parsedContent && (
            <div className="space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-medium">Parsed Content</h2>
                <div className="flex items-center space-x-4">
                  <select
                    value={templateType}
                    onChange={(e) => setTemplateType(e.target.value)}
                    className="px-3 py-2 border border-gray-300 rounded-md"
                  >
                    <option value="ieee">IEEE Conference</option>
                    <option value="springer">Springer LNCS</option>
                    <option value="acm">ACM</option>
                  </select>
                  <button
                    onClick={generateLatex}
                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                  >
                    Generate LaTeX
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="font-medium text-gray-900 mb-2">Title</h3>
                    <p className="text-gray-700">{parsedContent.title || 'No title found'}</p>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="font-medium text-gray-900 mb-2">Authors</h3>
                    <p className="text-gray-700">{parsedContent.authors}</p>
                  </div>

                  <div className="bg-gray-50 p-4 rounded-lg">
                    <h3 className="font-medium text-gray-900 mb-2">Keywords</h3>
                    <p className="text-gray-700">{parsedContent.keywords || 'No keywords found'}</p>
                  </div>
                </div>

                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-medium text-gray-900 mb-2">Sections ({parsedContent.sections.length})</h3>
                  <div className="space-y-2 max-h-80 overflow-y-auto">
                    {parsedContent.sections.map((section, index) => (
                      <div key={index} className="bg-white p-3 rounded border">
                        <h4 className="font-medium text-sm text-gray-900">
                          {section.number} {section.title}
                        </h4>
                        <p className="text-xs text-gray-600 mt-1">
                          Level {section.level} • {section.content.length} characters
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* LaTeX Tab */}
          {activeTab === 'latex' && latexOutput && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <h2 className="text-lg font-medium">Generated LaTeX</h2>
                <div className="flex space-x-2">
                  <button
                    onClick={copyToClipboard}
                    className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  >
                    <Copy className="h-4 w-4 mr-2" />
                    Copy
                  </button>
                  <button
                    onClick={downloadLatex}
                    className="flex items-center px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </button>
                </div>
              </div>

              <div className="bg-gray-100 rounded-lg p-4">
                <pre className="text-sm text-gray-700 whitespace-pre-wrap overflow-auto max-h-96">
                  {latexOutput}
                </pre>
              </div>

              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-600 mr-2" />
                  <span className="text-green-800 font-medium">LaTeX Generated Successfully!</span>
                </div>
                <p className="text-green-700 text-sm mt-2">
                  You can now copy this LaTeX code and compile it with your preferred LaTeX editor or online service like Overleaf.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SimpleTextParser;