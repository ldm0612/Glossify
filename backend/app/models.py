from pydantic import BaseModel
from typing import List, Optional, Dict
from datetime import datetime

class UploadResponse(BaseModel):
    paper_id: str
    title_guess: str
    domain_tags: Optional[List[str]] = None
    glossary: Optional[Dict[str, str]] = None

class GlossaryResponse(BaseModel):
    glossary: Dict[str, str]
    total_terms: int

class ExplainRequest(BaseModel):
    paper_id: str
    term: str
    force_ai: Optional[bool] = False

class ExplainResponse(BaseModel):
    definition: str
    source: str  # "Doc (Glossary)" or "LLM"
    domain: Optional[str] = None

class PaperData(BaseModel):
    paper_id: str
    title: str
    text: str
    domain_tags: Optional[List[str]] = None
    glossary: Optional[Dict[str, str]] = None  
    created_at: datetime
