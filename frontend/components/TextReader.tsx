import React, { useState, useRef } from 'react';
import { ExplainResponse } from '../types';
import { Popover } from './Popover';

interface TextReaderProps {
  text: string;
  paperId: string;
  onExplainTerm: (term: string) => Promise<ExplainResponse>;
}

export const TextReader: React.FC<TextReaderProps> = ({
  text,
  paperId,
  onExplainTerm,
}) => {
  // Note: This component is now unused in the UI but kept for potential fallback use.
  const [selectedText, setSelectedText] = useState('');
  const [popoverPosition, setPopoverPosition] = useState({ x: 0, y: 0 });
  const [isPopoverVisible, setIsPopoverVisible] = useState(false);
  const [explanation, setExplanation] = useState<ExplainResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const textRef = useRef<HTMLDivElement>(null);

  const handleTextSelection = async () => {
    const selection = window.getSelection();
    if (!selection || selection.toString().trim() === '') {
      setIsPopoverVisible(false);
      return;
    }

    const selectedText = selection.toString().trim();
    if (selectedText.length < 2) {
      setIsPopoverVisible(false);
      return;
    }

    setSelectedText(selectedText);

    // Get selection position
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    setPopoverPosition({
      x: rect.left + window.scrollX,
      y: rect.top + window.scrollY,
    });

    setIsPopoverVisible(true);
    setIsLoading(true);

    try {
      const explanation = await onExplainTerm(selectedText);
      setExplanation(explanation);
    } catch (error) {
      console.error('Error explaining term:', error);
      setExplanation({
        definition: 'Unable to explain this term at this time.',
        source: 'Error',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePopoverClose = () => {
    setIsPopoverVisible(false);
    setExplanation(null);
    setSelectedText('');
  };

  return (
    <div className="relative">
      <div
        ref={textRef}
        className="prose max-w-none p-6 bg-white rounded-lg border border-gray-200 h-96 overflow-y-auto"
        onMouseUp={handleTextSelection}
        onTouchEnd={handleTextSelection}
      >
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-gray-800">
          {text}
        </div>
      </div>
      
      <Popover
        isVisible={isPopoverVisible}
        position={popoverPosition}
        onClose={handlePopoverClose}
        explanation={explanation}
        isLoading={isLoading}
      />
    </div>
  );
};
