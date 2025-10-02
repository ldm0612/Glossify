import React from 'react';
import { ExplainResponse } from '../types';

interface ExplainPanelProps {
  selectedText: string;
  isLoading: boolean;
  explanation: ExplainResponse | null;
  mode?: 'local' | 'ai' | null;
  domainTags?: string[];
  onAskAI?: (term: string) => void;
  onGoogleSearch?: (term: string, domainTags?: string[]) => void;
  onCancel?: () => void;
}

export const ExplainPanel: React.FC<ExplainPanelProps> = ({ selectedText, isLoading, explanation, mode, domainTags, onAskAI, onGoogleSearch, onCancel }) => {
  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
        <div className="text-sm text-gray-700 truncate">
          <span className="font-medium">Selected:</span>{" "}
          <span className="px-2 py-0.5 bg-white border rounded text-gray-900">{selectedText || "—"}</span>
        </div>
        {isLoading && (
          <div className="ml-3 flex items-center space-x-3 text-xs text-gray-600">
            {mode === 'ai' ? (
              <>
                <span className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></span>
                <span>the word doesn’t seem to be defined in this article, inquiring AI for definition</span>
              </>
            ) : (
              <span>Looking up…</span>
            )}
            {onCancel && (
              <button className="btn-secondary !px-2 !py-1" onClick={onCancel}>Cancel</button>
            )}
          </div>
        )}
      </div>
      <div className="p-4 overflow-auto">
        {!selectedText && (
          <p className="text-sm text-gray-500">
            Highlight a term in the PDF to see its explanation here.
          </p>
        )}
        {selectedText && !isLoading && explanation && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs uppercase tracking-wide text-gray-500">{mode === 'local' ? 'In-Document' : 'AI'}</span>
                {explanation.source && (
                  <span className="ml-2 text-xs text-gray-400">{explanation.source}</span>
                )}
              </div>
              <div className="space-x-2">
                {mode === 'local' && (
                  <button
                    className="btn-secondary text-xs"
                    onClick={() => selectedText && onAskAI && onAskAI(selectedText)}
                  >
                    Ask AI
                  </button>
                )}
                <button
                  className="btn-secondary text-xs"
                  onClick={() => selectedText && onGoogleSearch && onGoogleSearch(selectedText, domainTags)}
                >
                  Google
                </button>
              </div>
            </div>
            <div className="text-sm text-gray-900 leading-relaxed whitespace-pre-wrap">
              {explanation.definition}
            </div>
            {explanation.domain && (
              <div className="text-xs text-gray-500">
                Domain: {explanation.domain}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
