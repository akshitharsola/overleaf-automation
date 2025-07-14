# Overleaf Automation

A comprehensive document analysis and LaTeX conversion automation tool built with React and TypeScript. This project provides intelligent document processing capabilities to convert Word documents (.docx) into LaTeX format with automatic table detection, equation recognition, and formatting preservation.

## 🚀 Features

- **Document Analysis**: Intelligent parsing of .docx files with content extraction
- **LaTeX Generation**: Automatic conversion to LaTeX format with proper formatting
- **Table Detection**: Advanced table recognition and LaTeX table generation
- **Equation Support**: Mathematical equation detection and LaTeX conversion
- **Multiple Format Support**: ACM, IEEE, and Springer formatting styles
- **Real-time Preview**: Live preview of generated LaTeX output
- **Batch Processing**: Handle multiple documents efficiently

## 🛠️ Technologies Used

- **Frontend**: React 19.1.0, TypeScript 4.9.5
- **Document Processing**: JSZip for .docx parsing
- **UI Components**: Lucide React icons
- **Testing**: Jest, React Testing Library
- **Build Tools**: React Scripts 5.0.1

## 📦 Installation

1. Clone the repository:
```bash
git clone https://github.com/akshitharsola/overleaf-automation.git
cd overleaf-automation
```

2. Navigate to the main application:
```bash
cd docx-analyzer
```

3. Install dependencies:
```bash
npm install
```

4. Start the development server:
```bash
npm start
```

The application will be available at `http://localhost:3000`

## 🏗️ Project Structure

```
overleaf-automation/
├── docx-analyzer/           # Main React application
│   ├── src/
│   │   ├── components/      # React components
│   │   ├── utils/          # Utility functions
│   │   └── types/          # TypeScript definitions
├── DATES/                  # Development history and iterations
├── GUIDEs/                 # Implementation guides and documentation
├── LATEXs/                 # LaTeX generation components
├── Main I/                 # Instructions and limitations
└── README.md              # This file
```

## 🔧 Usage

1. **Upload Document**: Select a .docx file using the file input
2. **Choose Format**: Select your preferred LaTeX format (ACM, IEEE, Springer)
3. **Process**: Click "Analyze Document" to start processing
4. **Review**: Examine the generated LaTeX output
5. **Export**: Copy or download the LaTeX code

## 📚 Development History

This project has undergone multiple iterations and improvements:

- **09/07/2025**: Initial table detection and format examples
- **10/07/2025**: Added document support and LaTeX integration
- **11-12/07/2025**: Enhanced equation detection capabilities
- **12/07/2025**: Major refactoring with improved UI
- **13/07/2025**: Multiple attempts at unified document processing
- **14/07/2025**: Final enhanced unified processor implementation

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request. For major changes, please open an issue first to discuss what you would like to change.

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

## 👥 Authors

- **Akshith Arsola** - *Project Lead & Developer* - [akshitharsola](https://github.com/akshitharsola)
- **Claude (Anthropic)** - *AI Assistant & Co-Developer* - Development assistance, code optimization, and documentation

## 🔗 Links

- [GitHub Repository](https://github.com/akshitharsola/overleaf-automation)
- [Documentation](./GUIDEs/)
- [Project History](./DATES/)

## 🐛 Known Issues

- Large document processing may require optimization
- Complex table structures might need manual adjustment
- Equation detection accuracy depends on document formatting

## 🚀 Future Enhancements

- [ ] Support for additional document formats (.doc, .pdf)
- [ ] Enhanced equation recognition algorithms
- [ ] Cloud-based document processing
- [ ] Integration with Overleaf API
- [ ] Advanced formatting preservation
- [ ] Batch processing improvements

## 📞 Support

For support, please open an issue in the GitHub repository or contact the development team.

---

*Built with ❤️ by Akshith Arsola and Claude AI*