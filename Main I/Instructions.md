# Overleaf Automation - Usage Instructions

## Overview
This guide provides comprehensive instructions for using the Overleaf Automation system to convert documents to LaTeX format with proper author handling for different academic templates.

## Getting Started

### 1. System Requirements
- Node.js (v14 or higher)
- React development environment
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Overleaf account for LaTeX compilation

### 2. Starting the Application
```bash
cd Automation/docx-analyzer
npm start
```
The application will run at `http://localhost:3000`

## Document Upload Instructions

### Supported File Formats
- **.txt files**: Basic text format with limited formatting
- **.docx files**: Microsoft Word documents with full formatting support

### File Size Limitations
- Maximum file size: 10MB recommended
- Large files may cause performance issues in browser environment

## Author Format Instructions

### Input Format
Use semicolon-separated format for multiple authors:

```
Name: akshit harsola ; Athak Shrivastava ; ankita chourasia ; alok tembhare
Department: cse ; it ; cse ; it  
University: medicaps university, indore, madhya pradesh
Mail: harsolaakshit@gmail.com* ; athakshrivatva@gmail.com ; anitachourasia@gmail.com ; aloktembhare@gmail.com
```

### Important Notes:
- **Names**: Separate multiple authors with semicolons (`;`)
- **Departments**: Use abbreviations (cse, it, ece, etc.) - system will expand them
- **University**: Single entry for all authors
- **Emails**: Add asterisk (`*`) after email for corresponding authors
- **Corresponding Authors**: Multiple corresponding authors supported

### Department Abbreviations
The system automatically expands:
- `cse` → Computer Science (IEEE) / Computer Science and Engineering (Springer)
- `it` → Information Technology
- `ece` → Electronics and Communication Engineering
- `eee` → Electrical and Electronics Engineering
- `me` → Mechanical Engineering
- `ce` → Civil Engineering

## Template-Specific Instructions

### IEEE Template
- **Document Class**: `IEEEtran`
- **Author Format**: Column-based layout with `\IEEEauthorblock` commands
- **Address Format**: "City, Country" format
- **Email Format**: Individual emails per author block
- **Affiliations**: Grouped by department with superscripts

### Springer Template
- **Document Class**: `sn-jnl` with `sn-mathphys-num` option
- **Author Format**: Inline layout with `\fnm` and `\sur` commands
- **Address Format**: Full institutional address with street, city, postal code
- **Email Format**: Hyperlinked emails with `\email{}` command
- **Affiliations**: Detailed `\affil` blocks with `\orgdiv`, `\orgname`, `\orgaddress`

### ACM Template
- **Status**: Author formatting implementation pending
- **Document Class**: `acmart` with `sigconf` option
- **Note**: Currently uses basic author format, advanced formatting in development

## Overleaf Integration Instructions

### Critical Step: Template Selection
⚠️ **IMPORTANT**: Always start with the correct template in Overleaf:

1. **For IEEE Papers**:
   - Create new project → Templates → Conference → IEEE Conference Template
   - Replace generated LaTeX with system output

2. **For Springer Papers**:
   - Create new project → Templates → Academic Journal → Springer
   - Select "Springer Nature LaTeX Template" 
   - Replace generated LaTeX with system output

3. **For ACM Papers**:
   - Create new project → Templates → Conference → ACM Conference
   - Replace generated LaTeX with system output

### Common Overleaf Errors and Solutions

#### Error: "Document class not found"
- **Cause**: Wrong template selected in Overleaf
- **Solution**: Start with correct template (see above)

#### Error: "Package not found"
- **Cause**: Missing required packages for template
- **Solution**: Use template-specific packages included in our output

#### Error: "Unknown command \\fnm"
- **Cause**: Using Springer author commands in non-Springer template
- **Solution**: Ensure you're using Springer template in Overleaf

#### Error: "Unknown command \\IEEEauthorblock"
- **Cause**: Using IEEE author commands in non-IEEE template
- **Solution**: Ensure you're using IEEE template in Overleaf

## Processing Workflow

### Step 1: Document Upload
1. Click "Choose File" or drag-and-drop document
2. Verify file format is supported (.txt or .docx)
3. Wait for file validation

### Step 2: Template Selection
1. Choose target template (IEEE, Springer, ACM)
2. Select processing options:
   - Enable/disable compression
   - Equation detection
   - Table parsing

### Step 3: Processing
1. Click "Process Document"
2. Wait for analysis completion
3. Review detected elements (title, authors, sections, tables)

### Step 4: LaTeX Generation
1. Click "Generate LaTeX"
2. Copy generated LaTeX code
3. Paste into appropriate Overleaf template

### Step 5: Compilation
1. Compile in Overleaf
2. Verify author formatting
3. Check section structure and references

## Troubleshooting Guide

### Document Processing Issues

#### "No authors detected"
- **Cause**: Authors not in expected format
- **Solution**: Use semicolon-separated format as shown above

#### "No sections found"
- **Cause**: Document doesn't use numbered sections (1., 2., etc.)
- **Solution**: Manually format sections with numbers before upload

#### "Table parsing failed"
- **Cause**: Tables not in `||====||` format (for .txt) or complex table structure
- **Solution**: Simplify table structure or use .docx format

### LaTeX Compilation Issues

#### Compilation fails in Overleaf
1. Check template selection (most common issue)
2. Verify all required packages are included
3. Check for special characters that need escaping
4. Ensure bibliography files exist if referenced

#### Author formatting incorrect
1. Verify template-specific format requirements
2. Check corresponding author asterisk placement
3. Ensure department abbreviations are recognized

#### Equations not rendering
1. Check equation detection in processing options
2. Verify LaTeX equation syntax
3. Ensure math packages are included

## Best Practices

### Document Preparation
1. **Use clear section numbering**: 1., 2., 3. for main sections
2. **Format authors consistently**: Always use the semicolon-separated format
3. **Simplify tables**: Avoid complex merged cells and nested structures
4. **Check equations**: Ensure mathematical expressions are clearly formatted

### Template Usage
1. **Always start with correct Overleaf template**
2. **Don't mix template commands** (e.g., IEEE commands in Springer template)
3. **Keep original template structure** when replacing content
4. **Test compilation after each major change**

### Quality Control
1. **Review generated LaTeX** before copying to Overleaf
2. **Check author affiliations** are correctly grouped
3. **Verify table captions** and references
4. **Test equation rendering** in final PDF

## Advanced Features

### Custom Department Mappings
For departments not in the default list, the system will use the original text. To add new mappings, contact system administrator.

### Equation Detection
- **OMML Support**: Advanced equation detection for .docx files
- **Text Patterns**: Basic equation detection for .txt files
- **LaTeX Conversion**: Automatic conversion to LaTeX syntax

### Table Processing
- **Caption Detection**: Automatic table caption identification
- **Label Generation**: Automatic `\label{}` generation for references
- **Format Optimization**: Template-specific table formatting

## Support and Maintenance

### File Backup
The system doesn't store uploaded files. Always keep backups of original documents.

### Version Control
For collaborative work, use version control for both source documents and generated LaTeX.

### Updates
Check documentation regularly for new features and template support updates.

## Known Limitations
Refer to `Limitations.md` for comprehensive list of current system constraints and workarounds.

## Contact Information
For technical support or feature requests, contact the development team or refer to the project repository.