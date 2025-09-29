import React from 'react';

interface GlossaryPanelProps {
  glossary: { [key: string]: string };
  onTermClick: (term: string) => void;
  selectedTerm?: string;
}

export const GlossaryPanel: React.FC<GlossaryPanelProps> = ({
  glossary,
  onTermClick,
  selectedTerm,
}) => {
  return (
    <div className="bg-white rounded-lg shadow-md border border-gray-200 h-full">
      <div className="p-4 border-b border-gray-200">
        <h3 className="text-lg font-semibold text-gray-800">Glossary</h3>
        <p className="text-sm text-gray-600 mt-1">
          {Object.keys(glossary).length} terms found
        </p>
      </div>
      
      <div className="p-4 overflow-y-auto max-h-96">
        {Object.keys(glossary).length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            <p>No glossary available yet.</p>
            <p className="text-sm mt-2">Upload a PDF and we’ll build a glossary automatically.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {Object.entries(glossary).map(([term, definition]) => (
              <div
                key={term}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  selectedTerm === term
                    ? 'border-primary-500 bg-primary-50'
                    : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                }`}
                onClick={() => onTermClick(term)}
              >
                <h4 className="font-medium text-gray-800 mb-1">
                  {term}
                </h4>
                <p className="text-sm text-gray-600 line-clamp-2">
                  {definition}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
