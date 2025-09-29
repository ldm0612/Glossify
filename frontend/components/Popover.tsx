import React, { useState, useRef, useEffect } from 'react';
import { ExplainResponse } from '../types';

interface PopoverProps {
  isVisible: boolean;
  position: { x: number; y: number };
  onClose: () => void;
  explanation: ExplainResponse | null;
  isLoading: boolean;
}

export const Popover: React.FC<PopoverProps> = ({
  isVisible,
  position,
  onClose,
  explanation,
  isLoading,
}) => {
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    if (isVisible) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isVisible, onClose]);

  if (!isVisible) return null;

  const getGoogleSearchUrl = (term: string, domain?: string) => {
    const searchQuery = domain ? `${term} ${domain}` : term;
    return `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
  };

  return (
    <div
      ref={popoverRef}
      className="fixed z-50 bg-white border border-gray-300 rounded-lg shadow-lg p-4 max-w-sm"
      style={{
        left: position.x,
        top: position.y + 20,
      }}
    >
      {isLoading ? (
        <div className="flex items-center space-x-2">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
          <span className="text-sm text-gray-600">Loading explanation...</span>
        </div>
      ) : explanation ? (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              {explanation.source}
            </span>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              ✕
            </button>
          </div>
          
          <p className="text-sm text-gray-800 leading-relaxed">
            {explanation.definition}
          </p>
          
          <div className="flex items-center justify-between pt-2 border-t border-gray-200">
            <a
              href={getGoogleSearchUrl(explanation.definition.split(' ')[0], explanation.domain)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-primary-600 hover:text-primary-700 transition-colors"
            >
              Google this {explanation.domain ? `(${explanation.domain})` : ''}
            </a>
          </div>
        </div>
      ) : (
        <div className="text-sm text-gray-600">
          No explanation available
        </div>
      )}
    </div>
  );
};
