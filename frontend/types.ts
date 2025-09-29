export interface UploadResponse {
  paper_id: string;
  title_guess: string;
  domain_tags?: string[];
  glossary?: { [key: string]: string };
}

export interface GlossaryItem {
  term: string;
  definition: string;
  context?: string;
  confidence: number;
}

export interface GlossaryResponse {
  glossary: { [key: string]: string };
  total_terms: number;
}

export interface ExplainRequest {
  paper_id: string;
  term: string;
}

export interface ExplainResponse {
  definition: string;
  source: string; // "Doc (Glossary)" or "LLM"
  domain?: string;
}

export interface PaperData {
  paper_id: string;
  title: string;
  text: string;
  domain_tags?: string[];
  glossary?: GlossaryItem[];
  created_at: string;
}
