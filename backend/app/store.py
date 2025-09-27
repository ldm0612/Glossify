from typing import Dict, Optional
from datetime import datetime
from models import PaperData

class InMemoryStore:
    def __init__(self):
        self.papers: Dict[str, PaperData] = {}
    
    def store_paper(self, paper_data: PaperData) -> None:
        """Store paper data in memory"""
        self.papers[paper_data.paper_id] = paper_data
    
    def get_paper(self, paper_id: str) -> Optional[PaperData]:
        """Retrieve paper data by ID"""
        return self.papers.get(paper_id)
    
    def update_paper_glossary(self, paper_id: str, glossary: list) -> bool:
        """Update glossary for a paper"""
        if paper_id in self.papers:
            self.papers[paper_id].glossary = glossary
            return True
        return False
    
    def get_all_papers(self) -> Dict[str, PaperData]:
        """Get all stored papers"""
        return self.papers.copy()

# Global store instance
store = InMemoryStore()
