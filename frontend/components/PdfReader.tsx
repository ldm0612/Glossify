import React, { useState, useRef } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
// Required for selectable text/annotation layers in react-pdf
import 'react-pdf/dist/esm/Page/TextLayer.css';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';

// Set up PDF.js worker
pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;

interface PdfReaderProps {
  file: File;
  paperId: string;
  text: string;
  onSelect: (term: string) => void;
}

export const PdfReader: React.FC<PdfReaderProps> = ({
  file,
  paperId,
  text,
  onSelect,
}) => {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [scale, setScale] = useState(1.0);
  const [pdfError, setPdfError] = useState(false);
  const pdfRef = useRef<HTMLDivElement>(null);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
    setPdfError(false);
  };

  const onDocumentLoadError = (error: Error) => {
    console.error('PDF load error:', error);
    setPdfError(true);
  };

  const handleTextSelection = () => {
    const selection = window.getSelection();
    if (!selection) return;
    const textSel = selection.toString().trim();
    if (!textSel || textSel.length < 1) return;

    // ensure selection is within the PDF container
    const anchorNode = selection.anchorNode as Node | null;
    if (
      anchorNode &&
      pdfRef.current &&
      !pdfRef.current.contains(
        (anchorNode as any).nodeType === 1 ? anchorNode : (anchorNode as any).parentElement
      )
    ) {
      return;
    }

    onSelect(textSel);
  };


    // If PDF fails to load, show a friendly message instead of text view
  if (pdfError) {
    return (
      <div className="p-4 border border-red-200 bg-red-50 rounded-lg text-sm text-red-800">
        We couldn't render the PDF. Please try re-uploading the file.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between mb-1">
        <div className="text-sm text-gray-600">
          {numPages ? `${numPages} page${numPages > 1 ? 's' : ''}` : 'Loading…'}
        </div>
        <div className="space-x-2">
          <button
            className="btn-secondary text-sm"
            onClick={() => setScale((s) => Math.max(0.5, parseFloat((s - 0.1).toFixed(2))))}
          >
            -
          </button>
          <button
            className="btn-secondary text-sm"
            onClick={() => setScale((s) => Math.min(3, parseFloat((s + 0.1).toFixed(2))))}
          >
            +
          </button>
        </div>
      </div>

      <div
        ref={pdfRef}
        className="relative border border-gray-200 rounded-lg overflow-auto max-h-[75vh]"
        onMouseUp={handleTextSelection}
        onTouchEnd={handleTextSelection}
      >
        <Document
          file={file}
          onLoadSuccess={onDocumentLoadSuccess}
          onLoadError={onDocumentLoadError}
          loading={
            <div className="flex items-center justify-center h-96 bg-gray-50">
              <div className="text-center">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                <p className="mt-2 text-sm text-gray-600">Loading PDF...</p>
              </div>
            </div>
          }
        >
          {numPages && numPages > 0 ? (
            Array.from({ length: numPages }, (_, i) => i + 1).map((n) => (
              <div key={n} className="flex justify-center py-3 bg-gray-50 first:pt-4">
                <Page
                  pageNumber={n}
                  scale={scale}
                  renderTextLayer={true}
                  renderAnnotationLayer={false}
                  className="shadow-sm bg-white"
                />
              </div>
            ))
          ) : (
            <></>
          )}
        </Document>
      </div>
    </div>
  );
};
