import React, { useState, useEffect } from "react";
import { Settings as SettingsIcon, Save, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import apiService from "../api/api";

export default function Settings() {
  const [formData, setFormData] = useState({
    max_crawl_depth: 2,
    max_pages: 20,
    chunk_size: 1000,
    embedding_model: "BAAI/bge-base-en-v1.5",
    refresh_interval: 6,
    top_k: 5,
    temperature: 0.0,
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setIsLoading(true);
    try {
      const data = await apiService.getSettings();
      setFormData(data);
    } catch (e) {
      console.error("Error loading settings", e);
      setErrorMsg("Failed to read system settings.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (key, value) => {
    setFormData((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    setSuccessMsg("");
    setErrorMsg("");

    try {
      const updated = await apiService.updateSettings(formData);
      setFormData(updated);
      setSuccessMsg("Settings updated and saved successfully.");
      setTimeout(() => setSuccessMsg(""), 4000);
    } catch (err) {
      console.error("Error saving settings", err);
      setErrorMsg("Could not save settings configurations.");
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-dark-950">
        <div className="flex flex-col items-center space-y-4">
          <RefreshCw className="h-10 w-10 animate-spin text-brand-500" />
          <p className="text-dark-300 font-medium">Loading system configurations...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-dark-950 p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-white flex items-center space-x-2">
          <SettingsIcon className="h-6 w-6 text-brand-500" />
          <span>System Settings</span>
        </h1>
        <p className="text-dark-400 text-sm mt-1">Configure crawling parameters, vector database chunking constraints, and QA engine thresholds.</p>
      </div>

      {successMsg && (
        <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 text-sm flex items-center space-x-2">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {errorMsg && (
        <div className="mb-6 p-4 bg-rose-500/10 border border-rose-500/30 rounded-lg text-rose-400 text-sm flex items-center space-x-2">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Crawler section */}
        <div className="rounded-xl border border-dark-800 bg-dark-900 p-6 space-y-4">
          <h2 className="text-md font-bold text-white border-b border-dark-800 pb-2">Web Crawler Parameters</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-dark-300 uppercase tracking-wider mb-2">Max Crawl Depth</label>
              <input
                type="number"
                min="1"
                max="5"
                value={formData.max_crawl_depth}
                onChange={(e) => handleInputChange("max_crawl_depth", parseInt(e.target.value))}
                className="w-full rounded-lg bg-dark-950 border border-dark-800 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500 transition"
                required
              />
              <span className="text-[10px] text-dark-500 mt-1 block">Number of page-hop levels from the seed URL.</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-dark-300 uppercase tracking-wider mb-2">Max Pages To Scrap</label>
              <input
                type="number"
                min="1"
                max="200"
                value={formData.max_pages}
                onChange={(e) => handleInputChange("max_pages", parseInt(e.target.value))}
                className="w-full rounded-lg bg-dark-950 border border-dark-800 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500 transition"
                required
              />
              <span className="text-[10px] text-dark-500 mt-1 block">Maximum total HTML nodes to index per collection.</span>
            </div>
          </div>
        </div>

        {/* Vector DB section */}
        <div className="rounded-xl border border-dark-800 bg-dark-900 p-6 space-y-4">
          <h2 className="text-md font-bold text-white border-b border-dark-800 pb-2">Vector Embeddings & Splitting</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-dark-300 uppercase tracking-wider mb-2">Chunk Split Size (Chars)</label>
              <input
                type="number"
                min="100"
                max="5000"
                value={formData.chunk_size}
                onChange={(e) => handleInputChange("chunk_size", parseInt(e.target.value))}
                className="w-full rounded-lg bg-dark-950 border border-dark-800 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500 transition"
                required
              />
              <span className="text-[10px] text-dark-500 mt-1 block">Text chunk length target (character count).</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-dark-300 uppercase tracking-wider mb-2">Embedding Model ModelName</label>
              <input
                type="text"
                value={formData.embedding_model}
                onChange={(e) => handleInputChange("embedding_model", e.target.value)}
                className="w-full rounded-lg bg-dark-950 border border-dark-800 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500 transition cursor-not-allowed"
                disabled
                required
              />
              <span className="text-[10px] text-dark-500 mt-1 block">Local model model name. (Cannot be modified in running sandbox).</span>
            </div>
          </div>
        </div>

        {/* Engine settings */}
        <div className="rounded-xl border border-dark-800 bg-dark-900 p-6 space-y-4">
          <h2 className="text-md font-bold text-white border-b border-dark-800 pb-2">Scheduler & QA Retrieval</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-xs font-semibold text-dark-300 uppercase tracking-wider mb-2">Auto Check Refresh (Hours)</label>
              <input
                type="number"
                min="1"
                max="168"
                value={formData.refresh_interval}
                onChange={(e) => handleInputChange("refresh_interval", parseInt(e.target.value))}
                className="w-full rounded-lg bg-dark-950 border border-dark-800 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500 transition"
                required
              />
              <span className="text-[10px] text-dark-500 mt-1 block">How often background scheduler checks page hashes.</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-dark-300 uppercase tracking-wider mb-2">QA Top K Chunks</label>
              <input
                type="number"
                min="1"
                max="10"
                value={formData.top_k}
                onChange={(e) => handleInputChange("top_k", parseInt(e.target.value))}
                className="w-full rounded-lg bg-dark-950 border border-dark-800 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500 transition"
                required
              />
              <span className="text-[10px] text-dark-500 mt-1 block">Number of document chunks injected into prompt.</span>
            </div>

            <div>
              <label className="block text-xs font-semibold text-dark-300 uppercase tracking-wider mb-2">Groq Temperature</label>
              <input
                type="number"
                min="0.0"
                max="1.0"
                step="0.1"
                value={formData.temperature}
                onChange={(e) => handleInputChange("temperature", parseFloat(e.target.value))}
                className="w-full rounded-lg bg-dark-950 border border-dark-800 px-4 py-2.5 text-sm text-white focus:outline-none focus:border-brand-500 transition"
                required
              />
              <span className="text-[10px] text-dark-500 mt-1 block">LLM creativity. Use 0.0 for strict RAG accuracy.</span>
            </div>
          </div>
        </div>

        <div className="flex justify-end pt-4 border-t border-dark-800">
          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center space-x-2 rounded-lg bg-brand-600 px-6 py-3 font-semibold text-white hover:bg-brand-500 transition shadow-lg"
          >
            {isSaving ? (
              <RefreshCw className="h-4.5 w-4.5 animate-spin" />
            ) : (
              <>
                <Save className="h-4.5 w-4.5" />
                <span>Save Configurations</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
