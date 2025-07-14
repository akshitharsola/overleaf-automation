// Unified Document Processor - Combines .txt table processing with .docx equation detection
// Merges the best features from both applications into a single, comprehensive tool

import React, { useState, useCallback } from 'react';
import { Upload, Download, Copy, AlertCircle, CheckCircle, FileText, Table, Settings, Calculator, Eye, Search } from 'lucide-react';
import { Analysis, ProcessingConfig, LATEX_TEMPLATES, UploadResult } from '../types/DocumentTypes';
import { parseDocument } from '../utils/DocumentParser';
import { generateLaTeX, generateTablesOnlyLaTeX, generateEquationsOnlyLaTeX, validateLaTeX } from '../utils/LatexGenerator';
import './UnifiedDocumentProcessor.css';

const UnifiedDocumentProcessor: React.FC = () => {
  const [activeTab, setActiveTab] = useState('upload');
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [generatedLaTeX, setGeneratedLaTeX] = useState('');
  const [copySuccess, setCopySuccess] = useState(false);
  
  // Processing configuration
  const [config, setConfig] = useState<ProcessingConfig>({
    selectedTemplate: 'ieee',
    enableCompression: false,
    fileType: 'auto',
    generateLatex: true,
    detectEquations: true,
    parseTables: true
  });

  // Handle file upload with unified processing
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;

    // Validate file type
    const fileName = selectedFile.name.toLowerCase();
    if (!fileName.endsWith('.txt') && !fileName.endsWith('.docx')) {
      setError('Please upload a .txt or .docx file');
      return;
    }

    setLoading(true);
    setError(null);
    
    const startTime = Date.now();

    try {
      console.log(`🚀 Processing ${selectedFile.name} (${Math.round(selectedFile.size / 1024)} KB)`);
      
      // Use unified document parser
      const result = await parseDocument(selectedFile);
      const processingTime = Date.now() - startTime;
      
      console.log(`✅ Processing completed in ${processingTime}ms`);
      console.log(`📊 Results: ${result.equations.length} equations, ${result.sections.length} sections, ${result.tables.length} tables`);
      
      setAnalysis(result);
      setActiveTab('analysis');
      
    } catch (err: any) {
      console.error('❌ Processing error:', err);
      setError(`Error processing file: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Generate LaTeX output
  const handleGenerateLaTeX = useCallback(() => {
    if (!analysis) return;
    
    try {
      const latex = generateLaTeX(analysis, config);
      const validation = validateLaTeX(latex);
      
      if (!validation.isValid) {
        console.warn('⚠️ LaTeX validation warnings:', validation.warnings);
        console.error('❌ LaTeX validation errors:', validation.errors);
      }
      
      setGeneratedLaTeX(latex);
      setActiveTab('latex');
    } catch (err: any) {
      setError(`Error generating LaTeX: ${err.message}`);
    }
  }, [analysis, config]);

  // Copy LaTeX to clipboard
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
    a.download = `${analysis?.title?.text?.replace(/[^a-zA-Z0-9]/g, '_') || analysis?.fileName.replace(/\.[^/.]+$/, "") || 'document'}.tex`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Render confidence bar
  const renderConfidenceBar = (confidence: number) => {
    const percentage = Math.round(confidence * 100);
    const confidenceClass = confidence > 0.8 ? 'confidence-high' : confidence > 0.6 ? 'confidence-medium' : 'confidence-low';
    
    return (
      <div className="confidence-bar">
        <div className="confidence-track">
          <div 
            className={`confidence-fill ${confidenceClass}`}
            style={{ width: `${percentage}%` }}
          />
        </div>
        <span className="confidence-text">{percentage}%</span>
      </div>
    );
  };

  // Render detection card
  const renderDetectionCard = (title: string, data: any, icon: React.ReactNode) => {
    if (!data) {
      return (
        <div className="detection-card detection-card-empty">
          <div className="detection-header">
            {icon}
            <span className="detection-title">{title}</span>
          </div>
          <p className="detection-empty">Not detected</p>
        </div>
      );
    }

    return (
      <div className="detection-card">
        <div className="detection-header">
          {icon}
          <span className="detection-title">{title}</span>
          {renderConfidenceBar(data.confidence)}
        </div>
        <div className="detection-reasoning">
          <strong>Reasoning:</strong> {data.reasoning}
        </div>
        <div className="detection-content">
          <strong>Content:</strong> {data.text.substring(0, 200)}
          {data.text.length > 200 && '...'}
        </div>
      </div>
    );
  };

  return (
    <div className="unified-processor">
      <div className="header">
        <h1 className="title">
          Unified Document Processor v1.0
        </h1>
        <p className="subtitle">
          Advanced document analysis with LaTeX generation - Supports both .txt tables and .docx equations
        </p>
      </div>

      {/* Template Configuration */}
      <div className="config-panel">
        <div className="config-row">
          <div className="config-group">
            <Settings className="config-icon" />
            <span className="config-label">Template:</span>
            {Object.entries(LATEX_TEMPLATES).map(([key, template]) => (
              <label key={key} className="config-option">
                <input
                  type="radio"
                  name="template"
                  value={key}
                  checked={config.selectedTemplate === key}
                  onChange={(e) => setConfig({...config, selectedTemplate: e.target.value})}
                />
                <span className="config-text">{template.name}</span>
              </label>
            ))}
          </div>
        </div>
        
        {config.selectedTemplate === 'ieee' && (
          <div className="config-row">
            <label className="config-compression">
              <input
                type="checkbox"
                checked={config.enableCompression}
                onChange={(e) => setConfig({...config, enableCompression: e.target.checked})}
              />
              <span className="config-text">Enable content compression for IEEE format</span>
              <span className="config-hint">(abbreviates common academic terms)</span>
            </label>
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="tabs">
        {[
          { id: 'upload', label: 'Upload', icon: Upload },
          { id: 'analysis', label: 'Analysis', icon: Eye, disabled: !analysis },
          { id: 'latex', label: 'LaTeX', icon: Download, disabled: !analysis }
        ].map(({ id, label, icon: Icon, disabled }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            disabled={disabled}
            className={`tab ${activeTab === id ? 'tab-active' : 'tab-inactive'} ${disabled ? 'tab-disabled' : ''}`}
          >
            <Icon size={16} />
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="tab-content">
        {activeTab === 'upload' && (
          <div className="upload-section">
            <div className="upload-area">
              <FileText size={48} className="upload-icon" />
              <h3 className="upload-title">Upload Document</h3>
              <p className="upload-description">
                Upload .txt or .docx files for analysis and LaTeX generation
              </p>
              
              <div className="feature-grid">
                <div className="feature-card feature-txt">
                  <h4 className="feature-title">📄 .txt File Support</h4>
                  <ul className="feature-list">
                    <li>Table parsing with <code>||====||</code> format</li>
                    <li>Section detection: "1. Introduction", "4.1 Methods"</li>
                    <li>LaTeX equation patterns: $x = y + z$</li>
                    <li>Mathematical symbols: α, β, π, ∑, ∫, √</li>
                  </ul>
                </div>
                
                <div className="feature-card feature-docx">
                  <h4 className="feature-title">📝 .docx File Support</h4>
                  <ul className="feature-list">
                    <li>OMML/MathML equation extraction</li>
                    <li>Word table detection</li>
                    <li>Advanced document structure analysis</li>
                    <li>Cambria Math font detection</li>
                  </ul>
                </div>
              </div>
              
              <input
                type="file"
                accept=".txt,.docx"
                onChange={handleFileUpload}
                className="upload-input"
                id="file-upload"
                disabled={loading}
              />
              <label htmlFor="file-upload" className={`upload-button ${loading ? 'upload-button-disabled' : ''}`}>
                {loading ? 'Processing...' : 'Choose File'}
              </label>
            </div>

            {loading && (
              <div className="loading">
                <div className="spinner"></div>
                <p className="loading-text">
                  {analysis?.fileType === 'docx' 
                    ? 'Extracting equations and analyzing document structure...' 
                    : 'Processing document with advanced pattern detection...'}
                </p>
              </div>
            )}

            {error && (
              <div className="error-card">
                <AlertCircle size={20} className="error-icon" />
                <div className="error-content">
                  <span className="error-title">Error</span>
                  <p className="error-message">{error}</p>
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'analysis' && analysis && (
          <div className="analysis-section">
            <div className={`analysis-summary ${analysis.detectionMethod === 'success' ? 'analysis-success' : 'analysis-partial'}`}>
              <div className="analysis-header">
                {analysis.detectionMethod === 'success' ? (
                  <CheckCircle size={20} className="analysis-icon-success" />
                ) : (
                  <AlertCircle size={20} className="analysis-icon-warning" />
                )}
                <span className="analysis-status">
                  Analysis: {analysis.detectionMethod === 'success' ? 'Success' : 'Partial'}
                </span>
              </div>
              <div className="analysis-stats">
                <div className="stat">
                  <strong>File Type:</strong> {analysis.fileType.toUpperCase()}
                </div>
                <div className="stat">
                  <strong>Equations:</strong> {analysis.equations.length}
                </div>
                <div className="stat">
                  <strong>Sections:</strong> {analysis.sections.length}
                </div>
                <div className="stat">
                  <strong>Tables:</strong> {analysis.tables.length}
                </div>
              </div>
            </div>

            <div className="document-stats">
              <h3 className="stats-title">Document Statistics</h3>
              <div className="stats-grid">
                <div className="stat-item">
                  <strong>File:</strong> {analysis.fileName}
                </div>
                <div className="stat-item">
                  <strong>Size:</strong> {Math.round(analysis.fileSize / 1024)} KB
                </div>
                <div className="stat-item">
                  <strong>Text Lines:</strong> {analysis.textLines.length}
                </div>
                <div className="stat-item">
                  <strong>Processing:</strong> {analysis.fileType} format
                </div>
              </div>
            </div>

            <div className="detection-grid">
              {renderDetectionCard('Title', analysis.title, <CheckCircle size={20} />)}
              {renderDetectionCard('Authors', analysis.authors, <FileText size={20} />)}
              {renderDetectionCard('Abstract', analysis.abstract, <FileText size={20} />)}
              {renderDetectionCard('Keywords', analysis.keywords, <FileText size={20} />)}
            </div>

            {analysis.sections.length > 0 && (
              <div className="sections-card">
                <h3 className="sections-title">Sections Detected ({analysis.sections.length})</h3>
                <div className="sections-list">
                  {analysis.sections.slice(0, 5).map((section, index) => (
                    <div key={index} className="section-item">
                      <div className="section-header">
                        <div className="section-info">
                          <span className="section-number-title">
                            {section.number} {section.title}
                          </span>
                          <span className={`section-badge section-badge-${section.type}`}>
                            {section.type} | Level {section.level}
                          </span>
                          <span className="section-words">
                            {section.wordCount} words
                          </span>
                        </div>
                        {renderConfidenceBar(section.confidence)}
                      </div>
                      
                      <div className="section-reasoning">
                        <strong>Detection:</strong> {section.reasoning}
                      </div>
                      
                      <div className="section-content">
                        <div className="section-original">
                          <strong>Original:</strong> "{section.originalText}"
                        </div>
                        {section.content !== 'No content detected' && (
                          <div className="section-preview">
                            <strong>Content Preview:</strong> {section.contentPreview}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                  {analysis.sections.length > 5 && (
                    <div className="sections-more">
                      ... and {analysis.sections.length - 5} more sections
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Equations Section - Moved from separate tab */}
            <div className="equations-section">
              <div className={`equations-summary ${analysis.equations.length > 0 ? 'equations-found' : 'equations-none'}`}>
                <div className="equations-header">
                  <Calculator size={20} />
                  <span className="equations-title">
                    Mathematical Equations Detected: {analysis.equations.length}
                  </span>
                </div>
                <div className="equations-description">
                  {analysis.fileType === 'docx' 
                    ? 'Advanced detection using OMML extraction, LaTeX patterns, and Unicode symbols'
                    : 'Pattern-based detection using LaTeX syntax and mathematical symbols'}
                </div>
              </div>

              {analysis.equations.length > 0 ? (
                <div className="equations-list">
                  {analysis.equations.map((equation, index) => (
                    <div key={index} className="equation-card">
                      <div className="equation-header">
                        <span className="equation-id">Equation {equation.id}</span>
                        <span className={`equation-type equation-type-${equation.type}`}>
                          {equation.type.replace('_', ' ')}
                        </span>
                        <div className="confidence-bar">
                          <div className="confidence-track">
                            <div 
                              className={`confidence-fill ${
                                equation.confidence >= 0.8 ? 'confidence-high' : 
                                equation.confidence >= 0.6 ? 'confidence-medium' : 'confidence-low'
                              }`}
                              style={{ width: `${equation.confidence * 100}%` }}
                            ></div>
                          </div>
                          <span className="confidence-text">{Math.round(equation.confidence * 100)}%</span>
                        </div>
                      </div>
                      
                      <div className="equation-content">
                        <div className="equation-detected">
                          <div className="equation-label">Detected Content:</div>
                          <div className="equation-value">{equation.content}</div>
                        </div>
                        
                        {equation.latexEquivalent && (
                          <div className="equation-latex">
                            <div className="equation-label">LaTeX Equivalent:</div>
                            <div className="equation-value">{equation.latexEquivalent}</div>
                          </div>
                        )}
                        
                        {equation.originalMatch && equation.originalMatch !== equation.content && (
                          <div className="equation-original">
                            <div className="equation-label">Original Match:</div>
                            <div className="equation-value equation-value-small">{equation.originalMatch}</div>
                          </div>
                        )}
                        
                        <div className="equation-details">
                          <div className="equation-label">Detection Details:</div>
                          <div className="equation-meta">
                            <div><strong>Source:</strong> {equation.source}</div>
                            <div><strong>Type:</strong> {equation.type}</div>
                            <div><strong>Confidence:</strong> {Math.round(equation.confidence * 100)}%</div>
                            {equation.startPosition && <div><strong>Position:</strong> Character {equation.startPosition}</div>}
                          </div>
                        </div>
                        
                        {equation.contextBefore && equation.contextAfter && (
                          <div className="equation-context">
                            <div className="equation-label">Context:</div>
                            <div className="equation-context-text">
                              <span className="context-before">...{equation.contextBefore}</span>
                              <span className="context-equation">[EQUATION]</span>
                              <span className="context-after">{equation.contextAfter}...</span>
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="equations-empty">
                  <Calculator size={64} className="equations-empty-icon" />
                  <h3 className="equations-empty-title">No Equations Found</h3>
                  <div className="equations-empty-description">
                    <p>The analyzer searched for:</p>
                    <ul>
                      <li>LaTeX equations ($equation$, $$equation$$)</li>
                      <li>LaTeX commands (\\frac, \\sum, \\int, etc.)</li>
                      <li>Unicode mathematical symbols (α, β, π, ∑, ∫, √)</li>
                      <li>Mathematical operators and structures</li>
                      {analysis.fileType === 'docx' && <li>OMML/MathML equations from Word</li>}
                    </ul>
                    <p>Try uploading a document with mathematical content.</p>
                  </div>
                </div>
              )}
            </div>

            <div className="action-buttons">
              <button onClick={handleGenerateLaTeX} className="action-button action-primary">
                Generate LaTeX
              </button>
            </div>
          </div>
        )}


        {activeTab === 'latex' && (
          <div className="latex-section">
            <div className="latex-header">
              <h3 className="latex-title">Generated LaTeX Code</h3>
              <div className="latex-actions">
                <button onClick={copyToClipboard} className="latex-button latex-copy">
                  {copySuccess ? <CheckCircle size={16} /> : <Copy size={16} />}
                  {copySuccess ? 'Copied!' : 'Copy'}
                </button>
                <button onClick={downloadLaTeX} className="latex-button latex-download">
                  <Download size={16} />
                  Download
                </button>
              </div>
            </div>
            
            <div className="latex-content">
              <pre className="latex-code">{generatedLaTeX}</pre>
            </div>
            
            <div className="latex-footer">
              <button onClick={() => setActiveTab('analysis')} className="latex-button latex-back">
                Back to Analysis
              </button>
              <button 
                onClick={() => window.open('https://www.overleaf.com', '_blank')} 
                className="latex-button latex-overleaf"
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

export default UnifiedDocumentProcessor;