import React, { useState, useEffect } from "react";
import { Search as SearchIcon, Database, ExternalLink, RefreshCw, AlertCircle, Eye, X } from "lucide-react";
import apiService from "../api/api";

export default function Search() {
  const [collections, setCollections] = useState([]);
  const [selectedCol, setSelectedCol] = useState(null);
  
  const [queryValue, setQueryValue] = useState("");
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [kValue, setKValue] = useState(5);
  
  // Inspector snippet modal
  const [activeSnippet, setActiveSnippet] = useState(null);

  useEffect(() => {
    fetchCollections();
  }, []);

  const fetchCollections = async () => {
    try {
      const data = await apiService.getCollections();
      setCollections(data);
      if (data.length > 0) {
        setSelectedCol(data[0]);
      }
    } catch (e) {
      console.error("Error loading collections", e);
    }
  };

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!queryValue.trim() || !selectedCol || isLoading) return;

    setIsLoading(true);
    setResults([]);

    try {
      const searchRes = await apiService.search(selectedCol.id, queryValue.trim(), parseInt(kValue));
      setResults(searchRes);
    } catch (err) {
      console.error("Search failed", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-full flex flex-col bg-dark-950 p-6 overflow-y-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-white">Semantic Search Sandbox</h1>
        <p className="text-dark-400 text-sm">Query vector DB directly to fetch matching raw context passages without LLM processing.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Config Sidebar panel */}
        <div className="lg:col-span-1 space-y-4">
          <div className="rounded-xl border border-dark-800 bg-dark-900 p-5 space-y-4 shadow-sm">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider flex items-center space-x-2">
              <Database className="h-4 w-4 text-brand-400" />
              <span>Search Scope</span>
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-dark-400 uppercase tracking-wider mb-1.5">Context Collection</label>
                <select
                  value={selectedCol?.id || ""}
                  onChange={(e) => setSelectedCol(collections.find(c => c.id === parseInt(e.target.value)))}
                  className="w-full rounded-lg bg-dark-950 border border-dark-800 px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500 transition"
                >
                  {collections.map((col) => (
                    <option key={col.id} value={col.id}>{col.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-dark-400 uppercase tracking-wider mb-1.5">Max Top K Results</label>
                <input
                  type="number"
                  min="1"
                  max="20"
                  value={kValue}
                  onChange={(e) => setKValue(e.target.value)}
                  className="w-full rounded-lg bg-dark-950 border border-dark-800 px-3 py-2 text-sm text-white focus:outline-none focus:border-brand-500 transition"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Main results panel */}
        <div className="lg:col-span-3 space-y-4">
          {/* Query Bar */}
          <form onSubmit={handleSearch} className="flex items-center space-x-2">
            <div className="relative flex-1">
              <SearchIcon className="absolute left-3.5 top-3.5 h-4.5 w-4.5 text-dark-500" />
              <input
                disabled={!selectedCol}
                type="text"
                placeholder={selectedCol ? `Search terms in ${selectedCol.name}...` : "Create a collection first."}
                value={queryValue}
                onChange={(e) => setQueryValue(e.target.value)}
                className="w-full rounded-lg bg-dark-900 border border-dark-800 pl-11 pr-4 py-3.5 text-sm text-white placeholder-dark-600 focus:outline-none focus:border-brand-500 transition"
              />
            </div>
            <button
              type="submit"
              disabled={isLoading || !queryValue.trim() || !selectedCol}
              className={`px-5 py-3.5 rounded-lg flex items-center justify-center font-semibold text-white transition shrink-0 ${
                isLoading || !queryValue.trim() || !selectedCol
                  ? "bg-dark-800 border border-dark-700 text-dark-600 cursor-not-allowed"
                  : "bg-brand-600 hover:bg-brand-500"
              }`}
            >
              {isLoading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <span>Execute Search</span>
              )}
            </button>
          </form>

          {/* Search Result Grid */}
          <div className="space-y-4">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 space-y-3">
                <RefreshCw className="h-8 w-8 animate-spin text-brand-500" />
                <p className="text-sm text-dark-400">Searching vector space embeddings...</p>
              </div>
            ) : results.length === 0 ? (
              <div className="rounded-xl border border-dashed border-dark-800 p-16 text-center text-dark-500 bg-dark-900/10">
                <Database className="mx-auto mb-3 h-12 w-12 text-dark-700" />
                <p className="font-semibold text-dark-300">No matching search records</p>
                <p className="text-xs mt-1">Enter search keywords above to perform a vector search query.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4">
                {results.map((res, index) => (
                  <div 
                    key={index}
                    onClick={() => setActiveSnippet(res)}
                    className="group rounded-xl border border-dark-800 bg-dark-900 p-5 transition hover:border-dark-700 cursor-pointer shadow-sm select-none"
                  >
                    <div className="flex items-start justify-between">
                      <div className="min-w-0 pr-4">
                        <h3 className="font-bold text-white text-base group-hover:text-brand-300 transition truncate">{res.title}</h3>
                        <a 
                          href={res.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()} // Stop modal triggers on external link click
                          className="text-xs text-brand-400 hover:underline flex items-center space-x-1 mt-1 break-all"
                        >
                          <span className="truncate pr-1">{res.url}</span>
                          <ExternalLink className="h-3 w-3 shrink-0" />
                        </a>
                      </div>
                      <span className="inline-block rounded-full bg-brand-500/10 border border-brand-500/30 px-2.5 py-0.5 font-mono text-xs font-semibold text-brand-400 shrink-0">
                        Score: {Math.round(res.score * 10000) / 100}%
                      </span>
                    </div>

                    <p className="text-sm text-dark-300 leading-relaxed mt-4 line-clamp-3 bg-dark-950 p-3 rounded-lg border border-dark-850 font-mono">
                      {res.snippet}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Snippet Inspector Modal */}
      {activeSnippet && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-xl bg-dark-900 border border-dark-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-dark-800">
              <div>
                <h2 className="text-base font-bold text-white max-w-md truncate">{activeSnippet.title}</h2>
                <a
                  href={activeSnippet.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-brand-400 hover:underline flex items-center space-x-1 mt-0.5 break-all"
                >
                  <span>{activeSnippet.url}</span>
                  <ExternalLink className="h-3 w-3 inline shrink-0" />
                </a>
              </div>
              <button
                onClick={() => setActiveSnippet(null)}
                className="text-dark-500 hover:text-white p-1 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2">
              <span className="text-[10px] font-bold text-dark-400 uppercase tracking-wider flex items-center space-x-1.5 font-mono">
                <span>Passage Snippet</span>
                <span className="bg-brand-500/10 border border-brand-500/30 px-1.5 py-0.5 rounded text-[9px] font-bold text-brand-300">
                  Similarity Match: {Math.round(activeSnippet.score * 10000) / 100}%
                </span>
              </span>
              <div className="p-4 rounded-lg bg-dark-950 border border-dark-800 font-mono text-xs text-dark-200 leading-relaxed max-h-[300px] overflow-y-auto select-text select-all whitespace-pre-wrap">
                {activeSnippet.snippet}
              </div>
            </div>

            <div className="pt-3 border-t border-dark-800 flex justify-end">
              <button
                onClick={() => setActiveSnippet(null)}
                className="rounded-lg bg-dark-950 border border-dark-800 px-4 py-2 text-sm text-dark-300 hover:bg-dark-800 hover:text-white transition"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
