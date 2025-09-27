import os
import uuid
from datetime import datetime
from flask import Flask, request, jsonify
from flask_cors import CORS
from werkzeug.utils import secure_filename

from models import UploadResponse, GlossaryResponse, ExplainRequest, ExplainResponse, PaperData
from store import store
from pdf_io import extract_text_from_pdf
from llm import DocumentAnalyzer, TermExplainer

app = Flask(__name__)
CORS(app)

# Configure upload settings
UPLOAD_FOLDER = '/tmp/uploads'
ALLOWED_EXTENSIONS = {'pdf'}

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

@app.route('/upload', methods=['POST'])
def upload_file():
    """Upload PDF file and extract text"""
    try:
        if 'file' not in request.files:
            return jsonify({'error': 'No file provided'}), 400
        
        file = request.files['file']
        if file.filename == '':
            return jsonify({'error': 'No file selected'}), 400
        
        if not allowed_file(file.filename):
            return jsonify({'error': 'Only PDF files are allowed'}), 400
        
        # Read file content
        file_content = file.read()
        
        # Extract text from PDF
        text, title_guess = extract_text_from_pdf(file_content)
        
        if not text:
            return jsonify({'error': 'Could not extract text from PDF'}), 400
        
        # Generate paper ID
        paper_id = str(uuid.uuid4())
        
        # Analyze document to extract both domains and glossary in one call
        domain_tags = []
        glossary = []
        try:
            document_analyzer = DocumentAnalyzer()
            domain_tags, glossary = document_analyzer.analyze_document(
                title_guess or "Untitled Document", 
                text
            )
        except Exception as e:
            print(f"[Upload] Document analysis failed: {repr(e)}")
            return jsonify({
                "error": "Document analysis failed",
                "details": str(e)
            }), 502 
        # Store paper data with both domains and glossary
        paper_data = PaperData(
            paper_id=paper_id,
            title=title_guess or "Untitled Document",
            text=text,
            domain_tags=domain_tags,
            glossary=glossary,
            created_at=datetime.now()
        )
        store.store_paper(paper_data)
        
        print("SAVED", store)
        
        resp = UploadResponse(
            paper_id=paper_id,
            title_guess=title_guess or "Untitled Document",
            domain_tags=domain_tags,
            glossary=glossary
        )
        
        return jsonify(resp.model_dump())
        
    except Exception as e:
        print(f"Error in upload: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/get_glossary', methods=['POST'])
def get_glossary_endpoint():
    """Get glossary for a paper (now generated during upload)"""
    try:
        data = request.get_json()
        paper_id = data.get('paper_id')
        
        if not paper_id:
            return jsonify({'error': 'paper_id is required'}), 400
        
        # Get paper data
        paper_data = store.get_paper(paper_id)
        if not paper_data:
            return jsonify({'error': 'Paper not found'}), 404
        
        # Return existing glossary (generated during upload)
        glossary = paper_data.glossary or []
        
        resp = GlossaryResponse(
            glossary=glossary,
            total_terms=len(glossary)
        )
        return jsonify(resp.model_dump()), 200
        
    except Exception as e:
        print(f"Error getting glossary: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/explain', methods=['POST'])
def explain_term():
    """Explain a term from the paper"""
    try:
        data = request.get_json()
        paper_id = data.get('paper_id')
        term = data.get('term')
        
        if not paper_id or not term:
            return jsonify({'error': 'paper_id and term are required'}), 400
        
        # Get paper data
        paper_data = store.get_paper(paper_id)
        if not paper_data:
            return jsonify({'error': 'Paper not found'}), 404
        
        # Check if term is in glossary
        definition = None
        source = "LLM"
        
        if paper_data.glossary and term in paper_data.glossary:
            definition = paper_data.glossary[term]
            source = "Doc (Glossary)"  
        
        # If not in glossary, use LLM
        if not definition:
            try:
                term_explainer = TermExplainer()
                definition = term_explainer.explain_term(term, paper_data.text[:1000])  # Use context
            except Exception as e:
                print(f"Error explaining term: {e}")
                definition = f"Unable to explain '{term}' at this time."
        
        resp = ExplainResponse(
            definition=definition,
            source=source,
            domain=paper_data.domain_tags[0] if paper_data.domain_tags else None
        )
        return jsonify(resp.model_dump()), 200   
        
    except Exception as e:
        print(f"Error explaining term: {e}")
        return jsonify({'error': 'Internal server error'}), 500

@app.route('/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({'status': 'healthy'})

if __name__ == '__main__':
    # Load environment variables
    from dotenv import load_dotenv
    load_dotenv()
    
    # Check for required environment variables
    if not os.getenv('OPENAI_API_KEY'):
        print("Warning: OPENAI_API_KEY not found in environment variables")
    
    app.run(debug=True, host='0.0.0.0', port=5001)
