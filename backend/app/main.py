import os
import uuid
from datetime import datetime
from flask import Flask, request, jsonify, send_file, send_from_directory
from flask_cors import CORS
from werkzeug.utils import secure_filename

from models import UploadResponse, GlossaryResponse, ExplainRequest, ExplainResponse, PaperData
from store import store
from db import (
    init_db,
    create_user,
    list_users,
    upsert_paper,
    get_paper_meta,
    list_papers,
    get_user_papers_with_paths,
    delete_user_and_papers,
    delete_paper,
)
from pdf_io import extract_text_from_pdf
from llm import DocumentAnalyzer, TermExplainer

app = Flask(__name__)
CORS(app)
try:
    init_db()
except Exception as e:
    print(f"DB init error at startup: {e}")

# Configure upload settings
UPLOAD_FOLDER = os.environ.get('GLOSSIFY_UPLOADS', '/tmp/glossify_uploads')
ALLOWED_EXTENSIONS = {'pdf'}

app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

def allowed_file(filename):
    # Check if the file name ends with the allowed extentions
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
        file_size = len(file_content)
        
        # Extract text from PDF
        text, title_guess = extract_text_from_pdf(file_content)
        
        if not text:
            return jsonify({'error': 'Could not extract text from PDF'}), 400
        
        # Generate paper ID
        paper_id = str(uuid.uuid4())
        user_id = request.form.get('user_id') or request.args.get('user_id') or 'anonymous'
        
        # Analyze document to extract both domains and glossary
        domain_tags = []
        glossary = {}
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
        # Store PDF to disk
        try:
            os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
            file_path = os.path.join(app.config['UPLOAD_FOLDER'], f"{paper_id}.pdf")
            with open(file_path, 'wb') as f:
                f.write(file_content)
        except Exception as e:
            print(f"[Upload] Failed to save PDF: {repr(e)}")
            return jsonify({"error": "Failed to persist PDF"}), 500

        # Page count (best-effort)
        try:
            from pypdf import PdfReader
            import io
            pages = len(PdfReader(io.BytesIO(file_content)).pages)
        except Exception:
            pages = None

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
        # Persist to DB
        try:
            upsert_paper(
                paper_id=paper_id,
                user_id=user_id,
                title=paper_data.title,
                domain_tags=paper_data.domain_tags,
                glossary=paper_data.glossary,
                text=text,
                file_path=file_path,
                pages=pages,
                file_size=file_size,
            )
        except Exception as e:
            print(f"[Upload] Failed to persist metadata: {repr(e)}")

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
        glossary = None
        if paper_data and paper_data.glossary:
            glossary = paper_data.glossary
        else:
            # Fallback to DB
            meta = get_paper_meta(paper_id)
            if not meta:
                return jsonify({'error': 'Paper not found'}), 404
            try:
                import json as _json
                glossary = (_json.loads(meta.get('glossary') or '{}'))
            except Exception:
                glossary = {}

        if not isinstance(glossary, dict):
            glossary = {}

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
        force_ai = bool(data.get('force_ai', False))
        
        if not paper_id or not term:
            return jsonify({'error': 'paper_id and term are required'}), 400
        
        # Get paper data
        paper_data = store.get_paper(paper_id)
        if not paper_data:
            # Try DB
            try:
                meta = get_paper_meta(paper_id)
                if not meta:
                    return jsonify({'error': 'Paper not found'}), 404
                paper_data = PaperData(
                    paper_id=paper_id,
                    title=meta['title'],
                    text=meta.get('text') or '',
                    domain_tags=(meta.get('domain_tags') and __import__('json').loads(meta['domain_tags'])) or [],
                    glossary=(meta.get('glossary') and __import__('json').loads(meta['glossary'])) or {},
                    created_at=datetime.now(),
                )
            except Exception:
                return jsonify({'error': 'Paper not found'}), 404
        
        # Short-circuit for overly long selections to avoid wasting LLM tokens
        try:
            if isinstance(term, str) and len(term.strip()) > 120 and not force_ai:
                resp = ExplainResponse(
                    definition="Selection is quite long. Please highlight a shorter term or phrase for a better explanation.",
                    source="System",
                    domain=paper_data.domain_tags[0] if paper_data.domain_tags else None,
                )
                return jsonify(resp.model_dump()), 200
        except Exception:
            pass

        # Explain term: use glossary unless force_ai is requested
        definition = None
        source = "LLM"

        if not force_ai and paper_data.glossary and term in paper_data.glossary:
            definition = paper_data.glossary[term]
            source = "Doc (Glossary)"

        # If not in glossary or forcing AI, use LLM
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

 

# Static frontend serving (for Docker single-space deployment)
FRONTEND_DIR = os.path.join(os.path.dirname(__file__), "static")

@app.route('/', defaults={'path': ''})
@app.route('/<path:path>', methods=['GET'])
def serve_frontend(path: str):
    try:
        # Serve actual static file if it exists; otherwise SPA fallback
        if path:
            fp = os.path.join(FRONTEND_DIR, path)
            if os.path.exists(fp) and os.path.isfile(fp):
                return send_from_directory(FRONTEND_DIR, path)
        return send_from_directory(FRONTEND_DIR, 'index.html')
    except Exception as e:
        print(f"serve_frontend error: {e}")
        return jsonify({'error': 'Internal server error'}), 500


# Serve stored PDF file
@app.route('/paper/<paper_id>/file', methods=['GET'])
def get_paper_file(paper_id: str):
    try:
        meta = get_paper_meta(paper_id)
        if not meta:
            return jsonify({'error': 'Paper not found'}), 404
        file_path = meta.get('file_path')
        if not file_path or not os.path.exists(file_path):
            return jsonify({'error': 'File not found'}), 404
        return send_file(file_path, mimetype='application/pdf', as_attachment=False, download_name=f"{paper_id}.pdf")
    except Exception as e:
        print(f"get_paper_file error: {e}")
        return jsonify({'error': 'Internal server error'}), 500


# Return paper metadata (title, tags, sizes, etc.)
@app.route('/paper/<paper_id>/meta', methods=['GET'])
def get_paper_metadata(paper_id: str):
    try:
        meta = get_paper_meta(paper_id)
        if not meta:
            return jsonify({'error': 'Paper not found'}), 404
        # decode JSON fields
        import json as _json
        domain_tags = []
        try:
            domain_tags = _json.loads(meta.get('domain_tags') or '[]')
        except Exception:
            domain_tags = []
        return jsonify({
            'paper_id': meta['paper_id'],
            'title': meta['title'],
            'domain_tags': domain_tags,
            'file_size': meta.get('file_size'),
            'pages': meta.get('pages'),
            'created_at': meta.get('created_at'),
        })
    except Exception as e:
        print(f"get_paper_metadata error: {e}")
        return jsonify({'error': 'Internal server error'}), 500


# Delete a paper (DB record + stored PDF file)
@app.route('/paper/<paper_id>', methods=['DELETE'])
def delete_paper_endpoint(paper_id: str):
    try:
        meta = get_paper_meta(paper_id)
        if not meta:
            return ('', 204)
        file_path = meta.get('file_path')
        try:
            if file_path and os.path.exists(file_path):
                os.remove(file_path)
        except Exception:
            # Best-effort: continue even if file removal fails
            pass
        delete_paper(paper_id)
        return ('', 204)
    except Exception as e:
        print(f"delete_paper error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

# User/Profile endpoints (simple, local profiles)
@app.route('/users', methods=['GET'])
def users_list():
    try:
        return jsonify({"users": list_users()})
    except Exception as e:
        print(f"users_list error: {e}")
        return jsonify({"users": []})


@app.route('/users', methods=['POST'])
def users_create():
    try:
        data = request.get_json()
        name = (data or {}).get('name')
        if not name:
            return jsonify({"error": "name is required"}), 400
        uid = str(uuid.uuid4())
        avatar_url = (data or {}).get('avatar_url')
        u = create_user(uid, name, avatar_url)
        return jsonify(u)
    except Exception as e:
        print(f"users_create error: {e}")
        return jsonify({"error": "failed to create user"}), 500


@app.route('/papers', methods=['GET'])
def papers_list():
    try:
        user_id = request.args.get('user_id')
        if not user_id:
            return jsonify({"error": "user_id is required"}), 400
        papers = list_papers(user_id)
        return jsonify({"papers": papers})
    except Exception as e:
        print(f"papers_list error: {e}")
        return jsonify({"papers": []})


@app.route('/users/<user_id>', methods=['DELETE'])
def users_delete(user_id: str):
    try:
        # Collect file paths to remove from disk
        items = get_user_papers_with_paths(user_id)
        # Delete DB records
        delete_user_and_papers(user_id)
        # Remove files best-effort
        for it in items:
            fp = it.get('file_path')
            try:
                if fp and os.path.exists(fp):
                    os.remove(fp)
            except Exception:
                pass
        return ('', 204)
    except Exception as e:
        print(f"users_delete error: {e}")
        return jsonify({"error": "failed to delete user"}), 500

if __name__ == '__main__':
    # Load environment variables
    from dotenv import load_dotenv
    load_dotenv()
    
    # Check for required environment variables
    if not os.getenv('OPENAI_API_KEY'):
        print("Warning: OPENAI_API_KEY not found in environment variables")
    # Honor platform-provided port (e.g., Hugging Face Spaces)
    port = int(os.environ.get('PORT', 7860))
    app.run(debug=True, host='0.0.0.0', port=port)
