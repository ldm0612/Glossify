import React from 'react';
import { ExplainResponse } from '../types';

interface ExplainPanelProps {
  selectedText: string;
  isLoading: boolean;
  explanation: ExplainResponse | null;
}

export const ExplainPanel: React.FC<ExplainPanelProps> = ({ selectedText, isLoading, explanation }) => {
  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
        <div className="text-sm text-gray-700 truncate">
          <span className="font-medium">Selected:</span>{" "}
          <span className="px-2 py-0.5 bg-white border rounded text-gray-900">{selectedText || "—"}</span>
        </div>
        {isLoading && (
          <div className="ml-3 text-xs text-gray-500">Looking up…</div>
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
            <div className="text-xs uppercase tracking-wide text-gray-500">
              {explanation.source}
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
