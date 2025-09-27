import io
import re
from typing import Tuple, Optional
from pypdf import PdfReader

def extract_text_from_pdf(file_content: bytes) -> Tuple[str, str, Optional[str]]:
    """
    Extract text from PDF file content.
    Returns (full_text, first_page_text, title_guess)
    """
    try:
        # Create PDF reader from bytes
        pdf_reader = PdfReader(io.BytesIO(file_content))
        
        # Extract text from all pages
        text_parts = []
        
        for i, page in enumerate(pdf_reader.pages):
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)
        
        # Combine all text
        full_text = "\n".join(text_parts)
        
        # Basic de-hyphenation (remove hyphens at line breaks)
        full_text = re.sub(r'-\s*\n\s*', '', full_text)
        
        # Clean up multiple whitespace
        full_text = re.sub(r'\s+', ' ', full_text)
        
        # Try to extract title from metadata or first line
        title_guess = _extract_title_guess(pdf_reader, full_text)
        
        return full_text, title_guess
        
    except Exception as e:
        print(f"Error extracting text from PDF: {e}")
        return "", "", None

def _extract_title_guess(pdf_reader: PdfReader, text: str) -> Optional[str]:
    """Extract a title guess from PDF metadata or first line"""
    try:
        # Try metadata first
        if pdf_reader.metadata and pdf_reader.metadata.title:
            title = pdf_reader.metadata.title.strip()
            if title and len(title) > 3:
                return title
        
        # Fall back to first non-empty line
        lines = text.split('\n')
        for line in lines:
            line = line.strip()
            if line and len(line) > 3 and not line.isdigit():
                # Basic heuristic: first substantial line
                return line[:100]  # Limit length
        
        return None
        
    except Exception as e:
        print(f"Error extracting title: {e}")
        return None
