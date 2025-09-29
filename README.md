# Glossify

**An Interactive Academic Reading Assistant**

Glossify is a full-stack application that transforms academic PDFs into interactive reading experiences. Upload a research paper, article, or report, and get instant explanations for technical terms through intelligent highlighting and AI-powered definitions.

## 🌟 Features

- **PDF Upload & Processing**: Upload PDF documents with automatic text extraction
- **AI-Powered Analysis**: Automatic domain detection and glossary generation
- **Smart PDF Reader**: Scrollable, zoomable PDF viewer with selectable text
- **Explain/Glossary Panel**: Right-side panel with two tabs — Explain and Glossary
- **Instant Explanations**: Shows selected text and a definition; uses doc glossary first, then AI
- **Auto Glossary Build**: Glossary loads automatically after upload
- **Server Status Indicator**: Live health status shown in the header
- **Modern UI**: Clean, academic-focused interface built with React and Tailwind CSS

## 🏗️ Architecture

### Backend (Flask)
- **PDF Processing**: Extracts text from uploaded PDFs
- **LLM Integration**: Uses OpenAI GPT for document analysis and term explanation
- **Domain Detection**: Automatically identifies academic domains
- **Glossary Generation**: Creates document-specific technical term definitions

### Frontend (Next.js + React)
- **PDF Viewer**: Continuous scroll with zoom controls, selectable text via Text Layer
- **Explain Panel**: Shows what you highlighted and the explanation with source + domain
- **Glossary Tab**: Browse the full glossary; clicking a term triggers explanation
- **Auto Glossary**: Glossary is fetched after upload without an extra click
- **Responsive Design**: Works on desktop and mobile devices

## 🚀 Quick Start

### Prerequisites

- Python 3.8+
- Node.js 18+
- OpenAI API Key

### 1. Clone the Repository

```bash
git clone <repository-url>
cd Glossify
```

### 2. Backend Setup

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Set up environment variables
cp ../frontend/env.local.example .env
# Edit .env and add your OPENAI_API_KEY
```

**Required Environment Variables:**
```bash
OPENAI_API_KEY=your_openai_api_key_here
```

### 3. Frontend Setup

```bash
cd frontend

# Install dependencies
npm install

# Set up environment variables (optional)
cp env.local.example .env.local
# Edit .env.local if you need to change the API URL
```

### 4. Run the Application

**Terminal 1 - Backend:**
```bash
cd backend
python app/main.py
```
Backend will run on `http://localhost:5001`

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```
Frontend will run on `http://localhost:3000`

### 5. Using the Application

1. Open `http://localhost:3000` in your browser
2. Upload a PDF file (research paper, article, etc.)
3. Wait for the document to be processed; the glossary loads automatically
4. Scroll and zoom in the PDF on the left
5. Highlight any text — the Explain tab (right) shows the selected text and its definition
6. Switch to the Glossary tab (right) to browse all terms; click a term to explain it

## 📚 API Documentation

### Backend Endpoints

#### `POST /upload`
Upload and process a PDF file.

**Request:**
```bash
curl -X POST http://localhost:5001/upload \
  -F "file=@your-document.pdf"
```

**Response:**
```json
{
  "paper_id": "uuid-string",
  "title_guess": "Document Title",
  "domain_tags": ["Computer Science", "Machine Learning"],
  "glossary": {
    "algorithm": "A step-by-step procedure for solving a problem",
    "neural network": "A computing system inspired by biological neural networks"
  }
}
```

#### `POST /get_glossary`
Retrieve the glossary for a processed document.

**Request:**
```json
{
  "paper_id": "uuid-string"
}
```

**Response:**
```json
{
  "glossary": {
    "term": "definition",
    "another term": "another definition"
  },
  "total_terms": 15
}
```

#### `POST /explain`
Get an explanation for a specific term.

**Request:**
```json
{
  "paper_id": "uuid-string",
  "term": "machine learning"
}
```

**Response:**
```json
{
  "definition": "A subset of artificial intelligence that enables computers to learn without being explicitly programmed.",
  "source": "Doc (Glossary)",
  "domain": "Computer Science"
}
```

#### `GET /health`
Health check endpoint.

**Response:**
```json
{
  "status": "healthy"
}
```

## 🛠️ Development

### Backend Development

The backend is built with Flask and includes:

- **PDF Processing**: Uses `pypdf` for text extraction
- **LLM Integration**: OpenAI GPT for document analysis
- **Data Models**: Pydantic models for type safety
- **CORS Support**: Configured for frontend integration

**Key Files:**
- `app/main.py`: Flask application and API endpoints
- `app/llm.py`: LLM integration and document analysis
- `app/pdf_io.py`: PDF text extraction
- `app/models.py`: Pydantic data models
- `app/store.py`: In-memory data storage

### Frontend Development

The frontend is built with Next.js and includes:

- **PDF Viewer**: React-PDF for document display with continuous scroll + zoom
- **Interactive Highlighting**: Custom selection handling within the PDF container
- **Explain/Glossary Panel**: Tabbed right panel for explanations and glossary browsing
- **API Integration**: Axios for backend communication
- **Responsive Design**: Tailwind CSS for styling

**Key Files:**
- `frontend/pages/index.tsx`: Main application page and layout
- `frontend/components/PdfReader.tsx`: Scrollable, zoomable PDF viewer with text selection
- `frontend/components/ExplainPanel.tsx`: Shows selected text and explanation
- `frontend/components/GlossaryPanel.tsx`: Glossary display and term selection
- `frontend/components/Tabs.tsx`: Simple tabs for the right panel
- `frontend/lib/api.ts`: Backend API integration

### Environment Variables

**Backend (.env):**
```bash
OPENAI_API_KEY=your_openai_api_key_here
```

**Frontend (.env.local):**
```bash
NEXT_PUBLIC_API_URL=http://localhost:5001
```

## 🎯 Use Cases

- **Academic Research**: Quickly understand technical papers
- **Student Learning**: Get instant explanations for complex terms
- **Professional Development**: Stay current with industry terminology
- **Document Analysis**: Extract key concepts from research papers

## 🔧 Configuration

### Backend Configuration

- **File Upload Limit**: 16MB maximum
- **Supported Formats**: PDF only
- **LLM Model**: GPT-3.5-turbo (configurable)
- **Timeout**: 30 seconds for LLM operations

### Frontend Configuration

- **PDF Worker**: Uses CDN-hosted PDF.js worker. If your environment blocks CDNs, switch to a local worker import in `frontend/components/PdfReader.tsx`.

## 🧭 User Experience Overview

- Upload a PDF; the app extracts text and analyzes it for domains and glossary terms.
- The PDF renders on the left. You can scroll through pages and adjust zoom.
- Highlight any word or phrase in the PDF:
  - If the term exists in the document glossary, the Explain tab shows that definition immediately.
  - Otherwise, the app asks the AI to explain it in context and shows the result.
- The right panel has two tabs:
  - Explain: shows the selected text and a clear explanation with source and domain.
  - Glossary: list of all extracted terms. Clicking a term switches back to Explain with its definition.

Tip: There’s a small server status indicator in the header so you know the backend is reachable.
- **API Timeout**: 30 seconds
- **Responsive Breakpoints**: Mobile-first design

## 🚨 Troubleshooting

### Common Issues

1. **PDF Not Loading**: Ensure the PDF has selectable text (not scanned images)
2. **API Connection Failed**: Check that the backend is running on port 5001
3. **OpenAI API Errors**: Verify your API key and account credits
4. **CORS Issues**: Ensure the backend CORS is properly configured

### Debug Mode

**Backend:**
```bash
cd backend
python app/main.py
# Debug mode is enabled by default
```

**Frontend:**
```bash
cd frontend
npm run dev
# Development mode with hot reload
```

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📞 Support

For issues and questions:
1. Check the troubleshooting section
2. Review the API documentation
3. Open an issue on GitHub

---

**Built with ❤️ for the academic community**
