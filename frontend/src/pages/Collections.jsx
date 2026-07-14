import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import { Folder, Plus, Trash2, Globe, RefreshCw, Terminal, ExternalLink, Play, CheckCircle2, AlertCircle, X, ChevronRight, ChevronLeft } from "lucide-react";
import apiService, { getWsUrl } from "../api/api";

export default function Collections() {
  const [searchParams, setSearchParams] = useSearchParams();
  const viewId = searchParams.get("view");

  const [collections, setCollections] = useState([]);
  const [selectedCol, setSelectedCol] = useState(null);
  
  // Creation state
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newColName, setNewColName] = useState("");
  const [newUrls, setNewUrls] = useState([""]);
  const [errorMsg, setErrorMsg] = useState("");

  // Crawler WS and Logging state
  const [wsLogs, setWsLogs] = useState([]);
  const [crawlProgress, setCrawlProgress] = useState(0);
  const [isIndexing, setIsIndexing] = useState(false);
  const wsRef = useRef(null);
  const logTerminalEndRef = useRef(null);

  // Responsive state
  const [mobileActiveView, setMobileActiveView] = useState("list");

  useEffect(() => {
    fetchCollections();
  }, []);

  useEffect(() => {
    if (viewId && collections.length > 0) {
      const selected = collections.find(c => c.id === parseInt(viewId));
      if (selected) {
        setSelectedCol(selected);
        // Reset indexing / logs if shifting collections
        if (wsRef.current) {
          wsRef.current.close();
          wsRef.current = null;
        }
        setWsLogs([]);
        setCrawlProgress(0);
        setIsIndexing(selected.status === "Indexing");

        if (selected.status === "Indexing") {
          connectWebSocket(selected.id);
        }
        setMobileActiveView("detail"); // Deep link should show detail
      }
    } else if (collections.length > 0 && !selectedCol) {
      const firstCol = collections[0];
      setSelectedCol(firstCol);
      setIsIndexing(firstCol.status === "Indexing");
      if (firstCol.status === "Indexing") {
        connectWebSocket(firstCol.id);
      }
    }
  }, [viewId, collections]);

  useEffect(() => {
    // Scroll terminal log to bottom when logs update
    if (logTerminalEndRef.current) {
      logTerminalEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [wsLogs]);

  // Clean up WebSocket on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const fetchCollections = async () => {
    try {
      const data = await apiService.getCollections();
      setCollections(data);
    } catch (e) {
      console.error("Error fetching collections", e);
    }
  };

  const handleSelectCollection = (col, isExplicitClick = false) => {
    setSelectedCol(col);
    setSearchParams({ view: col.id });
    
    // Reset indexing / logs if shifting collections
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
    setWsLogs([]);
    setCrawlProgress(0);
    setIsIndexing(col.status === "Indexing");

    if (col.status === "Indexing") {
      connectWebSocket(col.id);
    }

    if (isExplicitClick) {
      setMobileActiveView("detail");
    }
  };

  const connectWebSocket = (collectionId) => {
    if (wsRef.current) {
      wsRef.current.close();
    }

    const wsUrl = getWsUrl(collectionId);
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setWsLogs([`[SYSTEM] Connected to indexer process socket.`]);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === "ping") return;

        const timestamp = new Date().toLocaleTimeString();
        const prefix = `[${timestamp}]`;

        if (data.type === "progress") {
          setWsLogs(prev => [...prev, `${prefix} ${data.message}`]);
          if (data.progress !== undefined) {
            setCrawlProgress(data.progress);
          }
        } else if (data.type === "info") {
          setWsLogs(prev => [...prev, `${prefix} INFO: ${data.message}`]);
        } else if (data.type === "warning") {
          setWsLogs(prev => [...prev, `${prefix} WARNING: ${data.message}`]);
        } else if (data.type === "error") {
          setWsLogs(prev => [...prev, `${prefix} ERROR: ${data.message}`]);
          setIsIndexing(false);
        } else if (data.type === "completed") {
          setWsLogs(prev => [...prev, `${prefix} SUCCESS: ${data.message}`]);
          setCrawlProgress(100);
          setIsIndexing(false);
          fetchCollections(); // Reload collections to get "Ready" status and new timestamps
        }
      } catch (e) {
        console.error("Error parsing socket frame", e);
      }
    };

    ws.onclose = () => {
      setWsLogs(prev => [...prev, `[SYSTEM] Socket disconnected.`]);
    };
  };

  const handleAddUrlField = () => {
    setNewUrls([...newUrls, ""]);
  };

  const handleRemoveUrlField = (index) => {
    const list = [...newUrls];
    list.splice(index, 1);
    setNewUrls(list);
  };

  const handleUrlChange = (index, value) => {
    const list = [...newUrls];
    list[index] = value;
    setNewUrls(list);
  };

  const handleCreateCollection = async (e) => {
    e.preventDefault();
    setErrorMsg("");

    if (!newColName.trim()) {
      setErrorMsg("Collection Name is required.");
      return;
    }

    const filteredUrls = newUrls.filter(u => u.trim() !== "");
    if (filteredUrls.length === 0) {
      setErrorMsg("At least one URL seed is required.");
      return;
    }

    try {
      const payload = {
        name: newColName.trim(),
        urls: filteredUrls
      };
      const created = await apiService.createCollection(payload);
      setCollections([...collections, created]);
      setShowCreateModal(false);
      
      // Reset form
      setNewColName("");
      setNewUrls([""]);
      handleSelectCollection(created);
    } catch (err) {
      setErrorMsg(err.response?.data?.detail || "Failed to create collection.");
    }
  };

  const handleDeleteCollection = async (id) => {
    if (!window.confirm("Are you sure you want to delete this collection? All vectors, settings, and histories will be lost permanently.")) {
      return;
    }

    try {
      await apiService.deleteCollection(id);
      const remaining = collections.filter(c => c.id !== id);
      setCollections(remaining);
      setSelectedCol(null);
      if (remaining.length > 0) {
        handleSelectCollection(remaining[0]);
      }
    } catch (e) {
      console.error("Failed to delete collection", e);
    }
  };

  const handleStartIndexing = async () => {
    if (!selectedCol) return;
    setIsIndexing(true);
    setWsLogs([`[SYSTEM] Triggering crawl indexes request...`]);
    setCrawlProgress(5);
    
    try {
      await apiService.indexCollection(selectedCol.id);
      connectWebSocket(selectedCol.id);
      
      // Update local status to indexing
      setCollections(prev => prev.map(c => c.id === selectedCol.id ? { ...c, status: "Indexing" } : c));
    } catch (e) {
      setWsLogs(prev => [...prev, `[SYSTEM] ERROR: Failed to launch index process: ${e.message}`]);
      setIsIndexing(false);
    }
  };

  return (
    <div className="h-full flex bg-dark-950 overflow-hidden w-full">
      {/* Sidebar List */}
      <div className={`w-full lg:w-80 border-r border-dark-800 bg-dark-900/60 flex flex-col justify-between shrink-0 h-full ${
        mobileActiveView === "detail" ? "hidden lg:flex" : "flex"
      }`}>
        <div className="p-4 border-b border-dark-800 flex items-center justify-between">
          <h2 className="text-lg font-bold text-white flex items-center space-x-2">
            <Folder className="h-5 w-5 text-brand-400" />
            <span>Collections</span>
          </h2>
          <button
            onClick={() => setShowCreateModal(true)}
            className="p-1.5 rounded-lg bg-brand-600 text-white hover:bg-brand-500 transition"
            title="Create Collection"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {collections.length === 0 ? (
            <p className="text-sm text-dark-500 text-center py-8">No collections found.</p>
          ) : (
            collections.map((col) => (
              <button
                key={col.id}
                onClick={() => handleSelectCollection(col, true)}
                className={`w-full text-left p-3 rounded-lg flex items-center justify-between border transition ${
                  selectedCol?.id === col.id
                    ? "bg-brand-600/10 border-brand-500/50 text-white"
                    : "bg-dark-900 border-dark-800 text-dark-300 hover:border-dark-700 hover:text-white"
                }`}
              >
                <div className="flex flex-col min-w-0 pr-2">
                  <span className="font-semibold text-sm truncate">{col.name}</span>
                  <span className="text-xs text-dark-400 mt-1 font-mono">
                    {col.urls ? col.urls.length : 0} URL Seeds
                  </span>
                </div>
                <ChevronRight className={`h-4 w-4 text-dark-500 shrink-0 transition ${
                  selectedCol?.id === col.id ? "text-brand-400 transform translate-x-1" : ""
                }`} />
              </button>
            ))
          )}
        </div>
      </div>

      {/* Main Details Panel */}
      <div className={`flex-1 overflow-y-auto p-6 flex flex-col justify-between h-full ${
        mobileActiveView === "list" ? "hidden lg:flex" : "flex"
      }`}>
        {selectedCol ? (
          <div className="space-y-6">
            {/* Title / Action Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-dark-800 gap-4">
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setMobileActiveView("list")}
                  className="lg:hidden p-1.5 rounded-lg bg-dark-800 border border-dark-700 text-dark-300 hover:text-white transition shrink-0"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <div>
                  <h1 className="text-2xl font-bold text-white truncate max-w-[200px] sm:max-w-xs">{selectedCol.name}</h1>
                  <p className="text-dark-400 text-sm mt-1 flex flex-wrap items-center">
                    <span>Status: </span>
                    <span className={`ml-1.5 font-bold ${
                      selectedCol.status === "Ready" ? "text-emerald-400" :
                      selectedCol.status === "Indexing" ? "text-brand-400" :
                      selectedCol.status === "Failed" ? "text-rose-400" :
                      "text-dark-300"
                    }`}>
                      {selectedCol.status}
                    </span>
                    {selectedCol.last_indexed && (
                      <span className="block sm:inline sm:ml-4 font-normal text-dark-500 text-xs sm:text-sm">
                        Last Indexed: {new Date(selectedCol.last_indexed).toLocaleString()}
                      </span>
                    )}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3 shrink-0 self-end sm:self-auto">
                <button
                  disabled={isIndexing}
                  onClick={handleStartIndexing}
                  className={`flex items-center space-x-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition ${
                    isIndexing
                      ? "bg-dark-800 border border-dark-700 text-dark-500 cursor-not-allowed"
                      : "bg-brand-600 hover:bg-brand-500"
                  }`}
                >
                  {isIndexing ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin text-brand-400" />
                      <span>Indexing...</span>
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4" />
                      <span>Run Index / Refresh</span>
                    </>
                  )}
                </button>

                <button
                  onClick={() => handleDeleteCollection(selectedCol.id)}
                  className="p-2 rounded-lg bg-dark-900 border border-dark-800 text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30 transition"
                  title="Delete Collection"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Core Columns */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Seed URLs List */}
              <div className="rounded-xl border border-dark-800 bg-dark-900 p-5 space-y-4">
                <h3 className="text-md font-semibold text-white flex items-center space-x-2">
                  <Globe className="h-4 w-4 text-dark-400" />
                  <span>Configured Seed URLs</span>
                </h3>
                <div className="space-y-2 max-h-[220px] overflow-y-auto">
                  {selectedCol.urls?.map((urlItem) => (
                    <a
                      key={urlItem.id}
                      href={urlItem.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-between p-3 rounded-lg bg-dark-950 border border-dark-800 hover:border-dark-700 transition text-sm group"
                    >
                      <span className="text-dark-300 group-hover:text-white truncate pr-2 break-all">{urlItem.url}</span>
                      <ExternalLink className="h-3.5 w-3.5 text-dark-500 shrink-0 group-hover:text-brand-400 transition" />
                    </a>
                  ))}
                </div>
              </div>

              {/* Progress Panel */}
              <div className="rounded-xl border border-dark-800 bg-dark-900 p-5 flex flex-col justify-between">
                <div>
                  <h3 className="text-md font-semibold text-white">Indexing Engines Overview</h3>
                  <p className="text-xs text-dark-400 mt-1">Status feedback on document retrieval and parsing runs.</p>
                </div>
                
                {isIndexing ? (
                  <div className="space-y-3 mt-4">
                    <div className="flex justify-between text-xs font-semibold text-dark-300">
                      <span>Crawler Progress</span>
                      <span>{crawlProgress}%</span>
                    </div>
                    <div className="h-2 w-full bg-dark-950 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-brand-500 rounded-full transition-all duration-500" 
                        style={{ width: `${crawlProgress}%` }}
                      ></div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center space-x-3 mt-4 text-sm bg-dark-950 p-4 border border-dark-800 rounded-lg">
                    {selectedCol.status === "Ready" ? (
                      <>
                        <CheckCircle2 className="h-6 w-6 text-emerald-400 shrink-0" />
                        <span className="text-dark-200">The index is loaded and ready. You can query it in the Chat workspace.</span>
                      </>
                    ) : selectedCol.status === "Failed" ? (
                      <>
                        <AlertCircle className="h-6 w-6 text-rose-400 shrink-0" />
                        <span className="text-dark-200">The last indexing run failed. Run again to check error codes.</span>
                      </>
                    ) : (
                      <>
                        <AlertCircle className="h-6 w-6 text-dark-500 shrink-0" />
                        <span className="text-dark-400">Click the index button above to start parsing content.</span>
                      </>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Websocket Logger console */}
            {(isIndexing || wsLogs.length > 0) && (
              <div className="rounded-xl border border-dark-800 bg-dark-900 overflow-hidden shadow-lg flex flex-col">
                <div className="flex items-center justify-between px-4 py-3 bg-dark-950 border-b border-dark-800">
                  <div className="flex items-center space-x-2 text-xs font-bold text-dark-300 uppercase tracking-wider">
                    <Terminal className="h-4 w-4 text-emerald-400 animate-pulse" />
                    <span>Real-Time Indexer Logs</span>
                  </div>
                  <button 
                    onClick={() => setWsLogs([])} 
                    className="text-xs text-dark-500 hover:text-dark-300"
                  >
                    Clear log
                  </button>
                </div>
                <div className="p-4 bg-black font-mono text-xs text-emerald-400 h-64 overflow-y-auto space-y-1.5 scrollbar-thin select-text">
                  {wsLogs.map((log, i) => (
                    <div key={i} className="break-all whitespace-pre-wrap">{log}</div>
                  ))}
                  <div ref={logTerminalEndRef} />
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center text-dark-400">
            <Folder className="h-16 w-16 text-dark-800 mb-4 animate-bounce" />
            <h2 className="text-xl font-bold text-dark-200">No Collection Selected</h2>
            <p className="text-sm mt-1 max-w-sm">Select an existing collection from the side panel or create a new one to begin.</p>
          </div>
        )}
      </div>

      {/* Creation Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-xl bg-dark-900 border border-dark-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-dark-800">
              <h2 className="text-lg font-bold text-white">Create New Collection</h2>
              <button
                onClick={() => setShowCreateModal(false)}
                className="text-dark-500 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {errorMsg && (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-400 text-sm flex items-center space-x-2">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleCreateCollection} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-dark-300 uppercase tracking-wider mb-1.5">Collection Name</label>
                <input
                  type="text"
                  placeholder="e.g. Python Docs, React Docs"
                  value={newColName}
                  onChange={(e) => setNewColName(e.target.value)}
                  className="w-full rounded-lg bg-dark-950 border border-dark-800 px-4 py-2 text-sm text-white placeholder-dark-600 focus:outline-none focus:border-brand-500 transition"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-dark-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
                  <span>URL Seed List</span>
                  <button
                    type="button"
                    onClick={handleAddUrlField}
                    className="text-xs text-brand-400 hover:text-brand-300 font-semibold flex items-center space-x-1"
                  >
                    <Plus className="h-3 w-3" />
                    <span>Add Link</span>
                  </button>
                </label>

                <div className="space-y-2 max-h-[180px] overflow-y-auto">
                  {newUrls.map((url, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <input
                        type="url"
                        placeholder="https://example.com/docs"
                        value={url}
                        onChange={(e) => handleUrlChange(index, e.target.value)}
                        className="flex-1 rounded-lg bg-dark-950 border border-dark-800 px-4 py-2 text-sm text-white placeholder-dark-600 focus:outline-none focus:border-brand-500 transition"
                        required
                      />
                      {newUrls.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveUrlField(index)}
                          className="p-2 rounded-lg bg-dark-950 border border-dark-800 text-rose-400 hover:bg-rose-500/10 hover:border-rose-500/30 transition shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-4 border-t border-dark-800 flex items-center justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="rounded-lg bg-dark-950 border border-dark-800 px-4 py-2 text-sm text-dark-300 hover:bg-dark-800 hover:text-white transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-500 transition"
                >
                  Create & Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
