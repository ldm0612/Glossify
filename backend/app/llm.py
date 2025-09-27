import os
from openai import OpenAI
from typing import List, Optional, Dict, Any, Tuple
from abc import ABC, abstractmethod
from prompts import DOCUMENT_ANALYZER_SYSTEM_PROMPT
import json


class BaseLLMAdapter(ABC):
    """Base class for LLM adapters"""

    def __init__(self):
        self.client = OpenAI()
        self.model = "gpt-4o-mini"

    def _make_request(
        self,
        messages: List[Dict[str, str]],
        max_tokens: int = 200,
        temperature: float = 0.3,
    ) -> str:
        """Make a request to the LLM"""
        try:
            response = self.client.responses.create(
                model=self.model,
                input=messages,
                max_output_tokens=max_tokens,
                temperature=temperature,
            )
            return response.output[0].content[0].text.strip()
        except Exception as e:
            print(f"LLM request error: {e}")
            raise


class DocumentAnalyzer(BaseLLMAdapter):
    """Specialized agent for comprehensive document analysis - domain tagging and glossary extraction"""

    def analyze_document(
        self, title: str, full_text: str
    ) -> Tuple[List[str], Dict[str, str]]:
        """Analyze document to extract both domain tags and glossary in a single LLM call"""
        # Truncate text if too long
        max_text_length = 8000
        if len(full_text) > max_text_length:
            full_text = full_text[:max_text_length] + "..."

        messages = [
            {"role": "system", "content": DOCUMENT_ANALYZER_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": f"Title: {title}\n\nDocument Content:\n{full_text}\n\nAnalyze this document and extract domains and glossary as specified.",
            },
        ]

        response_text = self._make_request(messages, max_tokens=2000, temperature=0.3)

        try:
            result = json.loads(response_text)
            domains = result.get("domains", [])
            glossary = result.get("glossary", {})  # dict {term: definition}
            return domains, glossary
        except json.JSONDecodeError as e:
            print(f"Error parsing JSON response: {e}")
            print(f"Raw response: {response_text}")
            raise


class TermExplainer(BaseLLMAdapter):
    """Specialized agent for explaining terms"""

    def explain_term(self, term: str, context: Optional[str] = None) -> str:
        """Explain a term with optional context"""
        context_prompt = f" in the context of: {context}" if context else ""
        messages = [
            {
                "role": "system",
                "content": f"You are an expert at explaining technical terms{context_prompt}. Provide a clear, 2-3 sentence explanation.",
            },
            {"role": "user", "content": f"Explain the term: {term}"},
        ]

        return self._make_request(messages, max_tokens=200, temperature=0.3)
