import React, { useState, useRef } from 'react';
import { UploadResponse, ExplainResponse } from '../types';
import { uploadFile, getGlossary, explainTerm, healthCheck } from '../lib/api';
import { PdfReader } from '../components/PdfReader';
import { GlossaryPanel } from '../components/GlossaryPanel';
import { Tabs } from '../components/Tabs';
import { ExplainPanel } from '../components/ExplainPanel';

export default function Home() {
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [paperData, setPaperData] = useState<UploadResponse | null>(null);
  const [glossary, setGlossary] = useState<{ [key: string]: string }>({});
  const [isUploading, setIsUploading] = useState(false);
  const [isBuildingGlossary, setIsBuildingGlossary] = useState(false);
  const [selectedTerm, setSelectedTerm] = useState<string>('');
  const [activeTab, setActiveTab] = useState<'explain' | 'glossary'>('explain');
  const [selectedText, setSelectedText] = useState<string>('');
  const [explanation, setExplanation] = useState<ExplainResponse | null>(null);
  const [isExplaining, setIsExplaining] = useState(false);
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Normalize helper and glossary lookup map
  const normalize = (s: string) =>
    (s || '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\-\+]+/gu, ' ')
      .trim();

  const glossaryMap = React.useMemo(() => {
    const m = new Map<string, string>();
    Object.entries(glossary || {}).forEach(([k, v]) => m.set(normalize(k), v as string));
    return m;
  }, [glossary]);

  // Debounced explain when selectedText changes
  React.useEffect(() => {
    if (!paperData) return;
    if (!selectedText || selectedText.trim().length < 1) return;

    setIsExplaining(true);
    const id = setTimeout(async () => {
      try {
        const key = normalize(selectedText);
        const local =
          glossaryMap.get(key) ||
          glossaryMap.get(key.replace(/[\s\)\]\}\.,;:!\?\u3002\u201c\u201d"’']+$/u, '').trim());
        if (local) {
          setExplanation({
            definition: local,
            source: 'Doc (Glossary)',
            domain: paperData.domain_tags?.[0],
          });
        } else {
          const resp = await explainTerm(paperData.paper_id, selectedText);
          setExplanation(resp);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setIsExplaining(false);
      }
    }, 800);

    return () => clearTimeout(id);
  }, [selectedText, paperData, glossaryMap]);


  // Check server health on component mount
  React.useEffect(() => {
    const checkServerHealth = async () => {
      try {
        await healthCheck();
        setServerStatus('online');
      } catch (error) {
        console.error('Server health check failed:', error);
        setServerStatus('offline');
      }
    };

    checkServerHealth();
  }, []);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('Please select a PDF file');
      return;
    }

    setIsUploading(true);
    try {
      const response = await uploadFile(file);
      setUploadedFile(file);
      setPaperData(response);
      setGlossary({}); // Reset glossary; will auto-load below
    } catch (error) {
      console.error('Upload error:', error);
      alert('Failed to upload file. Please try again.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleGetGlossary = async () => {
    if (!paperData) return;

    setIsBuildingGlossary(true);
    try {
      const response = await getGlossary(paperData.paper_id);
      setGlossary(response.glossary);
    } catch (error) {
      console.error('Glossary retrieval error:', error);
      alert('Failed to get glossary. Please try again.');
    } finally {
      setIsBuildingGlossary(false);
    }
  };

  // Auto-load glossary after successful upload
  React.useEffect(() => {
    if (!paperData) return;
    handleGetGlossary();
  }, [paperData]);

  const handleExplainTerm = async (term: string): Promise<ExplainResponse> => {
    if (!paperData) {
      throw new Error('No paper data available');
    }

    try {
      const response = await explainTerm(paperData.paper_id, term);
      return response;
    } catch (error) {
      console.error('Explain term error:', error);
      throw error;
    }
  };

  const handleGlossaryTermClick = (term: string) => {
    setSelectedTerm(term);
    setSelectedText(term);
    setActiveTab('explain');
  };

  const handleReset = () => {
    setUploadedFile(null);
    setPaperData(null);
    setGlossary({});
    setSelectedTerm('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-2">Glossify</h1>
          <p className="text-lg text-gray-600 mb-4">Explain any term by highlighting it in the PDF.</p>
          
          {/* Server Status */}
          <div className="flex items-center justify-center space-x-2 mb-4">
            <div className={`w-2 h-2 rounded-full ${
              serverStatus === 'online' ? 'bg-green-500' : 
              serverStatus === 'offline' ? 'bg-red-500' : 'bg-yellow-500'
            }`}></div>
            <span className="text-sm text-gray-600">
              {serverStatus === 'online' ? 'Server Online' : 
               serverStatus === 'offline' ? 'Server Offline' : 'Checking...'}
            </span>
          </div>
        </div>

        {/* Upload Section */}
        <div className="card p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Upload PDF</h2>
          <div className="flex items-center space-x-4">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf"
              onChange={handleFileUpload}
              disabled={isUploading}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading || serverStatus === 'offline'}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isUploading ? 'Uploading...' : 'Choose PDF File'}
            </button>
            {paperData && (
              <button
                onClick={handleReset}
                className="btn-secondary"
              >
                Reset
              </button>
            )}
          </div>
          
          {paperData && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <h3 className="font-medium text-green-800">File Uploaded Successfully</h3>
              <p className="text-sm text-green-700 mt-1">
                <strong>Title:</strong> {paperData.title_guess}
              </p>
              {paperData.domain_tags && paperData.domain_tags.length > 0 && (
                <p className="text-sm text-green-700">
                  <strong>Domains:</strong> {paperData.domain_tags.join(', ')}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Main Content */}
        {paperData && uploadedFile && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* PDF Viewer */}
            <div className="lg:col-span-2">
              <div className="card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-semibold">PDF Viewer</h2>
                  {isBuildingGlossary && (
                    <div className="text-sm text-gray-500">Building glossary…</div>
                  )}
                </div>

                <PdfReader
                  file={uploadedFile}
                  paperId={paperData.paper_id}
                  text={paperData.title_guess}
                  onSelect={(t) => setSelectedText(t)}
                />
              </div>
            </div>

            {/* Right Panel: Explain / Glossary */}
            <div className="lg:col-span-1 flex flex-col overflow-hidden">
              <Tabs
                tabs={[
                  { key: 'explain', label: 'Explain' },
                  { key: 'glossary', label: `Glossary (${Object.keys(glossary).length})` },
                ]}
                active={activeTab}
                onChange={(k) => setActiveTab(k as 'explain' | 'glossary')}
              />
              <div className="flex-1">
                {activeTab === 'explain' ? (
                  <div className="card">
                    <ExplainPanel
                      selectedText={selectedText}
                      isLoading={isExplaining}
                      explanation={explanation}
                    />
                  </div>
                ) : (
                  <div className="p-0">
                    <GlossaryPanel
                      glossary={glossary}
                      onTermClick={handleGlossaryTermClick}
                      selectedTerm={selectedTerm}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Instructions */}
        {!paperData && (
          <div className="card p-6">
            <h2 className="text-xl font-semibold mb-4">How to Use</h2>
            <div className="space-y-3 text-gray-700">
              <div className="flex items-start space-x-3">
                <span className="flex-shrink-0 w-6 h-6 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-sm font-medium">1</span>
                <p>Upload a PDF file using the button above</p>
              </div>
              <div className="flex items-start space-x-3">
                <span className="flex-shrink-0 w-6 h-6 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-sm font-medium">2</span>
                <p>Glossary builds automatically after upload; open the Glossary tab to browse terms</p>
              </div>
              <div className="flex items-start space-x-3">
                <span className="flex-shrink-0 w-6 h-6 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-sm font-medium">3</span>
                <p>Select text in the PDF to get instant explanations</p>
              </div>
              
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
