// LaTeX generation utilities for both .txt and .docx files
// Combines the proven table generation from the .txt processor with enhanced features

import { Analysis, TableData, ProcessingConfig } from '../types/DocumentTypes';

// Comprehensive abbreviation dictionary for IEEE compression
const abbreviationMap: Record<string, string> = {
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
  'anti-spoofing': 'Anti-spoof',
  'implementation': 'Impl.',
  'algorithm': 'Algo.',
  'architecture': 'Arch.',
  'optimization': 'Opt.',
  'evaluation': 'Eval.',
  'experiment': 'Exp.',
  'comparison': 'Comp.',
  'analysis': 'Anal.',
  'methodology': 'Method.',
  'approach': 'App.',
  'technique': 'Tech.',
  'solution': 'Sol.',
  'application': 'App.',
  'development': 'Dev.'
};

// Apply text compression for IEEE format AND escape percent signs
export const compressText = (text: string, config: ProcessingConfig): string => {
  if (!text) return '';
  
  // FIRST: Escape percent signs to prevent LaTeX comment issues
  let processed = text.replace(/%/g, '\\%');
  
  // THEN: Apply compression if enabled for IEEE
  if (config.enableCompression && config.selectedTemplate === 'ieee') {
    Object.entries(abbreviationMap).forEach(([full, abbrev]) => {
      const regex = new RegExp(`\\b${full}\\b`, 'gi');
      processed = processed.replace(regex, abbrev);
    });
  }
  
  return processed;
};

// Helper function to format equations for LaTeX based on their type
const formatEquationForLatex = (eq: { type: string; latexEquivalent?: string; content: string }): string => {
  if (!eq.latexEquivalent) return eq.content;
  
  // Format based on equation type
  if (eq.type.includes('display') || eq.type.includes('fraction') || eq.type.includes('omml')) {
    return `\\[${eq.latexEquivalent}\\]`;
  } else if (eq.type.includes('inline') || eq.type.includes('latex')) {
    return `$${eq.latexEquivalent}$`;
  } else {
    // For other types, use inline math as default
    return `$${eq.latexEquivalent}$`;
  }
};

// Helper function removed - no longer needed since equations are directly embedded

// Generate IEEE Table - Superior mechanism from Latex_working_table_09072025.tsx
export const generateIEEETable = (table: TableData, config: ProcessingConfig): string => {
  const { data: rows } = table;
  if (!rows || rows.length === 0) return '';
  
  const colCount = rows[0].length;
  const processedRows = rows.map(row => 
    row.map(cell => compressText(cell || '', config))
  );
  
  // EXACT original IEEE format that was working correctly
  const colSpec = Array(colCount).fill('|>{\\centering\\arraybackslash}p{0.15\\linewidth}').join('');
  
  // Add placement control ONLY when compression is enabled to prevent floating
  const placementSpec = config.enableCompression && config.selectedTemplate === 'ieee' ? '[!htb]' : '[]';
  
  let latex = `\\begin{table}${placementSpec}\n`;
  latex += `    \\centering\n`;
  latex += `    \\caption{\\textbf{${table.caption || `Table ${table.id}`}}}\n`;
  latex += `    \\label{${table.label || `tab:table${table.id}`}}\n`;
  latex += `    \\begin{tabular}{${colSpec}|} \\hline\n`;
  
  // Header row
  latex += `        ${processedRows[0].join(' & ')} \\\\ \\hline\n`;
  
  // Data rows
  for (let i = 1; i < processedRows.length; i++) {
    latex += `        ${processedRows[i].join(' & ')} \\\\ \\hline\n`;
  }
  
  latex += `    \\end{tabular}\n`;
  latex += `\\end{table}\n`;
  
  return latex;
};

// Generate ACM Table - Enhanced formatting
export const generateACMTable = (table: TableData, config: ProcessingConfig): string => {
  const { data: rows } = table;
  if (!rows || rows.length === 0) return '';
  
  const colCount = rows[0].length;
  const processedRows = rows.map(row => 
    row.map(cell => compressText(cell || '', config))
  );
  
  // Calculate proper column width to prevent touching right edge
  const colWidth = Math.floor(90 / colCount);
  const colSpec = Array(colCount).fill(`p{0.${colWidth}\\linewidth}`).join('');
  
  let latex = `\\begin{table}[!htbp]\n`;
  latex += `  \\centering\n`;
  latex += `  \\caption{${table.caption || `Table ${table.id}`}}\n`;
  latex += `  \\label{${table.label || `tab:table${table.id}`}}\n`;
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

// Generate Springer Table - Enhanced formatting
export const generateSpringerTable = (table: TableData, config: ProcessingConfig): string => {
  const { data: rows } = table;
  if (!rows || rows.length === 0) return '';
  
  const colCount = rows[0].length;
  const processedRows = rows.map(row => 
    row.map(cell => compressText(cell || '', config))
  );
  
  // Calculate proper column width
  const colWidth = Math.floor(85 / colCount);
  const colSpec = Array(colCount).fill(`p{0.${colWidth}\\linewidth}`).join('');
  
  let latex = `\\begin{table}[!htbp]\n`;
  latex += `\\centering\n`;
  latex += `\\caption{${table.caption || `Table ${table.id}`}}\\label{${table.label || `tab:table${table.id}`}}\n`;
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
export const generateTable = (table: TableData, config: ProcessingConfig): string => {
  switch (config.selectedTemplate) {
    case 'ieee':
      return generateIEEETable(table, config);
    case 'acm':
      return generateACMTable(table, config);
    case 'springer':
      return generateSpringerTable(table, config);
    default:
      return generateIEEETable(table, config);
  }
};

// Generate complete LaTeX document from analysis
export const generateLaTeX = (analysis: Analysis, config: ProcessingConfig): string => {
  let latex = '';
  
  // Document class and packages
  if (config.selectedTemplate === 'ieee') {
    latex += `\\documentclass[conference]{IEEEtran}\n`;
    latex += `\\usepackage{array}\n`;
    latex += `\\usepackage{booktabs}\n`;
    latex += `\\usepackage{graphicx}\n`;
    latex += `\\usepackage{amsmath}\n`;
    latex += `\\usepackage{amssymb}\n\n`;
  } else if (config.selectedTemplate === 'acm') {
    latex += `\\documentclass[sigconf]{acmart}\n`;
    latex += `\\usepackage{booktabs}\n`;
    latex += `\\usepackage{tabularx}\n`;
    latex += `\\usepackage{amsmath}\n`;
    latex += `\\usepackage{amssymb}\n\n`;
  } else if (config.selectedTemplate === 'springer') {
    latex += `\\documentclass{llncs}\n`;
    latex += `\\usepackage{booktabs}\n`;
    latex += `\\usepackage{amsmath}\n`;
    latex += `\\usepackage{amssymb}\n\n`;
  }
  
  latex += `\\begin{document}\n\n`;
  
  // Title and authors
  latex += `\\title{${analysis.title?.text || 'Document Title'}}\n`;
  if (config.selectedTemplate === 'ieee') {
    latex += `\\author{${analysis.authors?.text || 'Author Name'}}\n`;
  } else if (config.selectedTemplate === 'acm') {
    latex += `\\author{${analysis.authors?.text || 'Author Name'}}\n`;
    latex += `\\affiliation{%\n  \\institution{Your Institution}\n  \\country{Your Country}\n}\n`;
  } else if (config.selectedTemplate === 'springer') {
    latex += `\\author{${analysis.authors?.text || 'Author Name'}}\n`;
    latex += `\\institute{Your Institute \\email{your.email@domain.com}}\n`;
  }
  
  latex += `\\maketitle\n\n`;
  
  // Abstract
  if (analysis.abstract) {
    latex += `\\begin{abstract}\n${compressText(analysis.abstract.text, config)}\n\\end{abstract}\n\n`;
  }
  
  // Keywords
  if (analysis.keywords) {
    if (config.selectedTemplate === 'ieee') {
      latex += `\\begin{IEEEkeywords}\n${compressText(analysis.keywords.text, config)}\n\\end{IEEEkeywords}\n\n`;
    } else {
      latex += `\\keywords{${compressText(analysis.keywords.text, config)}}\n\n`;
    }
  }
  
  // Sections with tables and equations using fixed placeholder system  
  const usedEquations = new Set<number>(); // Track which equations have been placed
  
  analysis.sections.forEach((section, sectionIndex) => {
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
    analysis.tables.forEach(table => {
      const placeholder = `[TABLE_${table.id}]`;
      if (content.includes(placeholder)) {
        const tableLatex = generateTable(table, config);
        content = content.replace(placeholder, `\n\n${tableLatex}\n`);
      }
    });
    
    // Replace equation placeholders with actual LaTeX equations at their exact positions
    analysis.equations.forEach(eq => {
      if (!eq.latexEquivalent || usedEquations.has(eq.id)) return;
      
      const equationPlaceholder = `[EQUATION_${eq.id}]`;
      
      // Check if this equation's placeholder exists in the section content
      if (content.includes(equationPlaceholder)) {
        // Replace placeholder with formatted LaTeX equation
        content = content.replace(equationPlaceholder, formatEquationForLatex(eq));
        usedEquations.add(eq.id);
        console.log(`✅ Placed equation ${eq.id} at exact position in section "${section.title}"`);
      }
    });
    
    latex += `${compressText(content, config)}\n\n`;
  });
  
  // Add any remaining tables not included in sections
  analysis.tables.forEach(table => {
    let tableUsed = false;
    analysis.sections.forEach(section => {
      if (section.content.includes(`[TABLE_${table.id}]`)) {
        tableUsed = true;
      }
    });
    
    if (!tableUsed) {
      latex += generateTable(table, config) + '\n';
    }
  });
  
  // Handle remaining unplaced equations by adding them to the most appropriate section
  const unplacedEquations = analysis.equations.filter(eq => 
    eq.confidence > 0.75 && 
    eq.latexEquivalent && 
    !usedEquations.has(eq.id)
  );
  
  if (unplacedEquations.length > 0 && analysis.sections.length > 0) {
    console.log(`📝 Adding ${unplacedEquations.length} unplaced equations to the last section`);
    // Add unplaced equations to the end of the last section
    unplacedEquations.forEach(eq => {
      latex += `\n${formatEquationForLatex(eq)}\n`;
    });
  }
  
  latex += `\\end{document}`;
  
  return latex;
};

// Generate LaTeX for tables only (useful for partial exports)
export const generateTablesOnlyLaTeX = (tables: TableData[], config: ProcessingConfig): string => {
  let latex = `% LaTeX Tables Generated from ${config.selectedTemplate.toUpperCase()} Template\n\n`;
  
  tables.forEach(table => {
    latex += generateTable(table, config) + '\n\n';
  });
  
  return latex;
};

// Generate LaTeX for equations only
export const generateEquationsOnlyLaTeX = (equations: Array<{ content: string; latexEquivalent?: string; confidence: number }>): string => {
  let latex = `% Mathematical Expressions in LaTeX Format\n\n`;
  
  equations
    .filter(eq => eq.confidence > 0.7 && eq.latexEquivalent)
    .forEach((eq, index) => {
      latex += `\\begin{equation}\n${eq.latexEquivalent}\n\\label{eq:${index + 1}}\n\\end{equation}\n`;
      latex += `% Original: ${eq.content}\n\n`;
    });
  
  return latex;
};

// Validate LaTeX content for common issues
export const validateLaTeX = (latex: string): { isValid: boolean; warnings: string[]; errors: string[] } => {
  const warnings: string[] = [];
  const errors: string[] = [];
  
  // Check for unescaped special characters
  const unescapedPercent = latex.match(/[^\\]%/g);
  if (unescapedPercent) {
    warnings.push(`Found ${unescapedPercent.length} unescaped percent signs (%) that may cause comments`);
  }
  
  // Check for unmatched braces
  const openBraces = (latex.match(/\{/g) || []).length;
  const closeBraces = (latex.match(/\}/g) || []).length;
  if (openBraces !== closeBraces) {
    errors.push(`Unmatched braces: ${openBraces} opening vs ${closeBraces} closing`);
  }
  
  // Check for unmatched dollar signs
  const dollarSigns = (latex.match(/\$/g) || []).length;
  if (dollarSigns % 2 !== 0) {
    warnings.push('Odd number of dollar signs detected - may cause math mode issues');
  }
  
  // Check for required document structure
  if (!latex.includes('\\begin{document}')) {
    errors.push('Missing \\begin{document}');
  }
  if (!latex.includes('\\end{document}')) {
    errors.push('Missing \\end{document}');
  }
  
  // Check for table environment consistency
  const beginTables = (latex.match(/\\begin\{table\}/g) || []).length;
  const endTables = (latex.match(/\\end\{table\}/g) || []).length;
  if (beginTables !== endTables) {
    errors.push(`Unmatched table environments: ${beginTables} begin vs ${endTables} end`);
  }
  
  return {
    isValid: errors.length === 0,
    warnings,
    errors
  };
};