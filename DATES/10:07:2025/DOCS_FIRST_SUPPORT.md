# DOCX Document Formatting Rules for LaTeX Converter

## 🎯 Overview
This document outlines the formatting requirements for DOCX files to ensure optimal detection and conversion to LaTeX format. Following these rules will guarantee accurate section detection, content extraction, and proper LaTeX output generation.

## 📋 Section Numbering Rules

### ✅ **SUPPORTED** - Manual Numbering (REQUIRED)

#### **Main Sections**
```
1. Introduction
2. Literature Review  
3. Methodology
4. Results and Discussion
5. Conclusion
```

**Format Requirements:**
- **Number + Period + Space + Title**: `1. Introduction`
- **No extra spaces**: Avoid `1.  Introduction` (double space)
- **Consistent numbering**: Sequential numbers (1, 2, 3, 4, 5...)
- **Title case recommended**: "Introduction" not "INTRODUCTION"

#### **Subsections**
```
4.1 Performance Analysis
4.2 Evaluation Results
4.3 Discussion of Findings
```

**Format Requirements:**
- **Number.Subnumber + Space + Title**: `4.1 Performance Analysis`
- **No period after subnumber**: Use `4.1` not `4.1.`
- **Consistent parent numbering**: All subsections under section 4

#### **Sub-subsections**
```
4.1.1 Implementation Details
4.1.2 Testing Methodology
4.2.1 Quantitative Results
```

**Format Requirements:**
- **Number.Sub.Subsub + Space + Title**: `4.1.1 Implementation Details`
- **Three-level maximum recommended**
- **Logical hierarchy maintained**

#### **Roman Numeral Sections**
```
I. Introduction
II. Related Work
III. Methodology
IV. Results
V. Conclusion
```

**Format Requirements:**
- **Roman + Period + Space + Title**: `I. Introduction`
- **Uppercase Roman numerals**: I, II, III, IV, V, VI, VII, VIII, IX, X
- **Sequential ordering**: Don't skip numerals

### ❌ **NOT SUPPORTED** - Word Auto-Numbering

**Avoid using:**
- Word's built-in numbered list feature (Format → Numbering)
- Auto-generated numbering that appears as formatting only
- Outline numbering from Word's styles

**Why:** Word's auto-numbering is display-only and not extracted as actual text by document parsers.

## 📝 Document Structure Requirements

### **1. Title**
- **Position**: First substantial line of document
- **Length**: 10-200 characters
- **Format**: Clear, descriptive title without numbering
- **Example**: `"SecureAttend: A Multi-Factor Authentication Framework for Attendance Verification"`

### **2. Authors**
- **Position**: Immediately after title (within 2-3 lines)
- **Length**: 2-60 characters
- **Format**: Simple name(s), avoid institutional details
- **Example**: `"Akshit Harsola"` or `"John Smith, Jane Doe"`

### **3. Abstract**
- **Start indicator**: Must begin with "Abstract" followed by colon, dash, or em-dash
- **Supported formats**: 
  - `Abstract: In this paper...`
  - `Abstract— This research...`
  - `Abstract - We present...`
- **Position**: After authors, before main content

### **4. Keywords**
- **Start indicator**: Must begin with "Keywords" or "Index Terms"
- **Supported formats**:
  - `Keywords: machine learning, authentication, security`
  - `Index Terms— biometric verification, mobile applications`
- **Position**: After abstract, before introduction

## 📊 Table Formatting Rules

### **Table Structure**
```
||====||
||Header 1|Header 2|Header 3||
||Data 1|Data 2|Data 3||
||Row 2 Col 1|Row 2 Col 2|Row 2 Col 3||
||====||
```

**Rules:**
- **Table boundaries**: `||====||` marks start and end
- **Row format**: `||content|content|content||`
- **Column separator**: Single pipe `|` between columns
- **No nested tables**: Keep tables simple and flat
- **Caption**: Include descriptive caption before or after table

### **Table Content Guidelines**
- **Avoid section-like text** in tables (e.g., "1. Method", "2. Results")
- **Use descriptive headers**: "Author", "Method", "Advantages" instead of numbered items
- **Keep cell content concise**: Long paragraphs may interfere with detection

## 🔢 Mathematical Equations

### **LaTeX Format (Recommended)**
```latex
$f(x) = a\theta + \Sigma_{n=1}^{\infty} [a_n\cos(\frac{n\pi x}{L}) + b_n\sin(\frac{n\pi x}{L})]$
```

**Guidelines:**
- **Inline equations**: Use single dollar signs `$equation$`
- **Display equations**: Use double dollar signs `$$equation$$` 
- **Complex equations**: Prefer LaTeX syntax for better preservation
- **Variables**: Use proper LaTeX formatting for subscripts/superscripts

## 📐 Content Organization Best Practices

### **Section Content**
- **Clear separation**: Leave blank line after section headers
- **Logical flow**: Content should directly relate to section title
- **Paragraph structure**: Use proper paragraph breaks
- **Length**: Aim for substantial content (minimum 25 words per section)

### **Formatting Guidelines**
- **Consistent style**: Use same formatting throughout document
- **Bold for emphasis**: Use sparingly, mainly for section headers
- **Avoid complex formatting**: Tables, images, and special layouts may cause parsing issues
- **Standard fonts**: Stick to common fonts (Times New Roman, Arial, Calibri)

## 🚫 Common Mistakes to Avoid

### **Section Numbering Errors**
- ❌ `1.Introduction` (missing space)
- ❌ `1 . Introduction` (space before period)
- ❌ `1- Introduction` (dash instead of period)
- ❌ `Section 1: Introduction` (extra text before number)

### **Table Content Issues**
- ❌ Using numbered lists in table headers ("1. Method", "2. Results")
- ❌ Section titles as table content ("Introduction", "Methodology")
- ❌ Complex nested table structures

### **Document Structure Problems**
- ❌ Missing abstract/keywords indicators
- ❌ Section content mixed with table content
- ❌ Inconsistent numbering (skipping numbers, wrong sequence)

## ✅ Validation Checklist

Before processing your document, verify:

- [ ] **Section Numbers**: All sections use manual numbering (1., 2., 3.)
- [ ] **Consistent Format**: Same numbering style throughout document
- [ ] **Clear Headers**: Section titles are descriptive and properly formatted
- [ ] **Table Boundaries**: All tables use `||====||` format
- [ ] **Abstract/Keywords**: Proper indicators used
- [ ] **Content Separation**: Clear distinction between sections and tables
- [ ] **No Auto-Numbering**: Word's auto-numbering features disabled
- [ ] **Sequential Order**: Sections follow logical numerical sequence

## 🔧 Testing Your Document

1. **Upload to Analyzer**: Use the DOCX Analyzer tool to test detection
2. **Check Debug Tab**: Verify sections show green ✅ SECTION indicators
3. **Review Table Filter**: Ensure table content doesn't interfere with sections
4. **Validate Content**: Confirm content extraction works properly
5. **Test LaTeX Generation**: Process through LaTeX converter for final validation

## 📈 Expected Results

When following these rules, you should achieve:
- **95%+ section detection accuracy**
- **Clean separation** between document content and table content
- **Proper LaTeX formatting** with correct section hierarchy
- **Accurate content extraction** with appropriate section boundaries
- **No false positives** from table headers or other formatted text

## 💡 Pro Tips

1. **Start Simple**: Begin with basic numbered sections before adding complex subsections
2. **Test Early**: Upload draft versions to verify formatting works
3. **Consistent Style**: Establish formatting standards at the beginning of your document
4. **Table Planning**: Design tables to avoid section-like content
5. **Content Review**: Ensure each section has substantial, relevant content
6. **Backup Strategy**: Keep a copy of your document before major formatting changes

## 🔄 Integration with LaTeX Converter

Following these formatting rules ensures seamless integration with the LaTeX Document Converter:

- **Automatic Section Detection**: No manual markup required
- **Proper Hierarchy**: Correct LaTeX section commands generated
- **Table Processing**: Tables converted to appropriate LaTeX table environments
- **Content Preservation**: All document content accurately transferred
- **Template Compatibility**: Works with IEEE, ACM, and Springer templates

---

**Version**: 1.0  
**Last Updated**: July 2025  
**Compatibility**: DOCX Analyzer v4.0+ and LaTeX Document Converter v2.0+