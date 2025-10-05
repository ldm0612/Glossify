import React, { useEffect, useRef, useState } from 'react';
import { UploadResponse, ExplainResponse } from '../types';
import { uploadFile, getGlossary, explainTerm, healthCheck, listPapers, getPaperMeta, getPaperFile, listUsers, deleteUser, deletePaper } from '../lib/api';
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
  const [lookupMode, setLookupMode] = useState<'local' | 'ai' | null>(null);
  const [leftWidthPct, setLeftWidthPct] = useState<number>(66); // for resizable layout
  const isDraggingRef = useRef(false);
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'offline'>('checking');
  const [activeUserId, setActiveUserId] = useState<string | null>(null);
  const [activeUserName, setActiveUserName] = useState<string>('');
  const [library, setLibrary] = useState<Array<{ paper_id: string; title: string; file_size?: number; pages?: number; created_at: string }>>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const explainAbortRef = useRef<AbortController | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
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
    if (selectedText.length > 120) {
      setExplanation({ definition: 'Selection is quite long. Please highlight a shorter term or phrase.', source: 'System' });
      setLookupMode(null);
      return;
    }

    setIsExplaining(true);
    setLookupMode(null);
    // cancel any in-flight explain request
    if (explainAbortRef.current) {
      explainAbortRef.current.abort();
    }
    const controller = new AbortController();
    explainAbortRef.current = controller;
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
          setLookupMode('local');
        } else {
          setLookupMode('ai');
          const resp = await explainTerm(paperData.paper_id, selectedText, { signal: controller.signal });
          setExplanation(resp);
        }
      } catch (e) {
        // ignore cancels
        // @ts-ignore
        if (e?.name !== 'CanceledError' && e?.name !== 'AbortError') {
          console.error(e);
        }
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

  // Require active profile (Netflix-like)
  useEffect(() => {
    const uid = typeof window !== 'undefined' ? localStorage.getItem('glossify_active_user') : null;
    setActiveUserId(uid);
    if (!uid && typeof window !== 'undefined') {
      window.location.href = '/profiles';
    }
  }, []);

  // Load library for user
  useEffect(() => {
    const run = async () => {
      if (!activeUserId) return;
      try {
        const { papers } = await listPapers(activeUserId);
        setLibrary(papers || []);
        // Fetch user name for header display
        try {
          const { users } = await listUsers();
          const u = (users || []).find((x: any) => x.id === activeUserId);
          setActiveUserName(u?.name || '');
        } catch (e) {
          // ignore
        }
      } catch (e) {
        console.error(e);
      }
    };
    run();
  }, [activeUserId, paperData]);

  // Close menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (!menuRef.current) return;
      if (!(e.target instanceof Node)) return;
      if (!menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    window.addEventListener('click', handler);
    return () => window.removeEventListener('click', handler);
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
      const response = await uploadFile(file, activeUserId || undefined);
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

  const handleAskAI = async (term: string) => {
    if (!paperData) return;
    try {
      setIsExplaining(true);
      setLookupMode('ai');
      if (explainAbortRef.current) explainAbortRef.current.abort();
      const controller = new AbortController();
      explainAbortRef.current = controller;
      const resp = await explainTerm(paperData.paper_id, term, { forceAI: true, signal: controller.signal });
      setExplanation(resp);
    } catch (e) {
      console.error(e);
    } finally {
      setIsExplaining(false);
    }
  };

  const handleGoogleSearch = (term: string, domainTags?: string[]) => {
    const queryContext = domainTags && domainTags.length > 0 ? ` in the context of ${domainTags.join(', ')}` : '';
    const q = `${term}${queryContext}`;
    const url = `https://www.google.com/search?q=${encodeURIComponent(q)}`;
    if (typeof window !== 'undefined') {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  // Resizable divider handlers (desktop only)
  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!isDraggingRef.current) return;
      const container = document.getElementById('split-container');
      if (!container) return;
      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const pct = Math.min(85, Math.max(30, (x / rect.width) * 100));
      setLeftWidthPct(pct);
    };
    const onUp = () => {
      isDraggingRef.current = false;
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  }, []);

  const startDrag = () => {
    isDraggingRef.current = true;
    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'col-resize';
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
    setExplanation(null);
    if (explainAbortRef.current) {
      explainAbortRef.current.abort();
      explainAbortRef.current = null;
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const openFromLibrary = async (paperId: string) => {
    try {
      // Fetch meta then file
      const meta = await getPaperMeta(paperId);
      const blob = await getPaperFile(paperId);
      // Create a File object for react-pdf convenience
      const f = new File([blob], `${meta.title || 'document'}.pdf`, { type: 'application/pdf' });

      // Reset state then set as if newly uploaded
      setUploadedFile(f);
      setPaperData({
        paper_id: paperId,
        title_guess: meta.title || 'Untitled Document',
        domain_tags: meta.domain_tags || [],
      } as any);
      setGlossary({});
      setSelectedTerm('');
      setSelectedText('');
      setExplanation(null);
      setActiveTab('explain');

      // Load glossary from backend (now DB-backed fallback exists)
      const g = await getGlossary(paperId);
      setGlossary(g.glossary);
    } catch (e) {
      console.error('Failed to open from library', e);
      alert('Could not open the selected paper.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="container mx-auto px-4 py-6">
        {/* Top Bar: Server status (left), Account menu (right) */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${
              serverStatus === 'online' ? 'bg-green-500' : 
              serverStatus === 'offline' ? 'bg-red-500' : 'bg-yellow-500'
            }`}></div>
            <span className="text-sm text-gray-600">
              {serverStatus === 'online' ? 'Server Online' : 
               serverStatus === 'offline' ? 'Server Offline' : 'Checking...'}
            </span>
          </div>
          {activeUserId && (
            <div className="relative flex items-center gap-3" ref={menuRef}>
              <div className="text-sm text-gray-700 hidden sm:block">Signed in as <span className="font-medium">{activeUserName || activeUserId}</span></div>
              <button
                aria-label="Settings"
                className="inline-flex items-center justify-center w-9 h-9 rounded border bg-white hover:bg-gray-50"
                onClick={() => setMenuOpen((v) => !v)}
                title="Settings"
              >
                <span className="text-xl leading-none text-gray-700">⚙︎</span>
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full mt-2 w-44 rounded-md border bg-white shadow-md p-1 z-10">
                  <div className="px-3 py-2 text-xs text-gray-500">{activeUserName || activeUserId}</div>
                  <button
                    className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 rounded"
                    onClick={() => {
                      localStorage.removeItem('glossify_active_user');
                      setMenuOpen(false);
                      window.location.href = '/profiles';
                    }}
                  >
                    Switch Account
                  </button>
                  <button
                    className="w-full text-left px-3 py-2 text-sm text-red-700 hover:bg-red-50 rounded"
                    onClick={async () => {
                      if (!activeUserId) return;
                      const ok = window.confirm('Delete this account? All records may be lost.');
                      if (!ok) return;
                      try {
                        await deleteUser(activeUserId);
                      } catch (e) {
                        console.error(e);
                      }
                      localStorage.removeItem('glossify_active_user');
                      setMenuOpen(false);
                      window.location.href = '/profiles';
                    }}
                  >
                    Delete Account
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Library first (if any) */}
        {activeUserId && library && library.length > 0 && (
          <div className="card p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">Your Library</h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-600">
                    <th className="py-2 pr-4">Name</th>
                    <th className="py-2 pr-4">Date Uploaded</th>
                    <th className="py-2 pr-4">File Size</th>
                    <th className="py-2 pr-4">Total Pages</th>
                    <th className="py-2 pr-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {library.map((p) => (
                    <tr key={p.paper_id} className="border-t hover:bg-gray-50">
                      <td
                        className="py-2 pr-4 text-primary-700 underline underline-offset-2 cursor-pointer"
                        onClick={() => openFromLibrary(p.paper_id)}
                        title="Open"
                      >
                        {p.title}
                      </td>
                      <td className="py-2 pr-4">{new Date(p.created_at).toLocaleString()}</td>
                      <td className="py-2 pr-4">{p.file_size ? `${(p.file_size / (1024 * 1024)).toFixed(2)} MB` : '—'}</td>
                      <td className="py-2 pr-4">{p.pages ?? '—'}</td>
                      <td className="py-2 pr-2 text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            className="btn-secondary !py-1 !px-2 text-xs text-red-700 hover:bg-red-50"
                            onClick={async (e) => {
                              const ok = window.confirm('Delete this paper? This cannot be undone.');
                              if (!ok) return;
                              try {
                                await deletePaper(p.paper_id);
                                setLibrary((prev) => prev.filter((it) => it.paper_id !== p.paper_id));
                                // If the deleted paper is currently open, reset the viewer state
                                if (paperData?.paper_id === p.paper_id) {
                                  handleReset();
                                }
                              } catch (err) {
                                console.error(err);
                                alert('Failed to delete the paper.');
                              }
                            }}
                            title="Delete"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Upload Section (second) */}
        <div className="card p-6 mb-6">
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

        {/* How to Use (third, when no paper open) */}
        {!paperData && (
          <div className="card p-6 mb-6">
            <h2 className="text-xl font-semibold mb-4">How to Use</h2>
            <div className="space-y-3 text-gray-700">
              <div className="flex items-start space-x-3">
                <span className="flex-shrink-0 w-6 h-6 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-sm font-medium">1</span>
                <p>Choose or create an account, then upload a PDF.</p>
              </div>
              <div className="flex items-start space-x-3">
                <span className="flex-shrink-0 w-6 h-6 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-sm font-medium">2</span>
                <p>Glossary builds automatically after upload; open the Glossary tab to browse terms.</p>
              </div>
              <div className="flex items-start space-x-3">
                <span className="flex-shrink-0 w-6 h-6 bg-primary-100 text-primary-600 rounded-full flex items-center justify-center text-sm font-medium">3</span>
                <p>Select text in the PDF to get instant explanations. Use “Ask AI” or Google if needed.</p>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        {paperData && uploadedFile && (
          <div id="split-container" className="w-full">
            <div className="flex flex-col lg:flex-row gap-8">
              {/* Left: PDF Viewer */}
              <div
                className="lg:flex-shrink-0"
                style={{ flexBasis: `${leftWidthPct}%`, minWidth: 0 }}
              >
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

              {/* Draggable Divider (only visible on lg) */}
              <div
                className="hidden lg:block w-1 bg-gray-200 hover:bg-gray-300 cursor-col-resize"
                onMouseDown={startDrag}
                aria-label="Resize panels"
                title="Drag to resize"
              />

              {/* Right: Explain/Glossary */}
              <div className="flex-1 flex flex-col overflow-hidden" style={{ minWidth: 0 }}>
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
                        mode={lookupMode}
                        domainTags={paperData.domain_tags}
                        onAskAI={handleAskAI}
                        onGoogleSearch={handleGoogleSearch}
                        onCancel={() => {
                          if (explainAbortRef.current) {
                            explainAbortRef.current.abort();
                          }
                          setIsExplaining(false);
                        }}
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
          </div>
        )}

        
      </div>
    </div>
  );
}
