import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Folder, FileText, CheckCircle2, AlertCircle, RefreshCw, Activity, ArrowRight } from "lucide-react";
import apiService from "../api/api";

export default function Dashboard() {
  const [collections, setCollections] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [recentChanges, setRecentChanges] = useState([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const collectionsData = await apiService.getCollections();
      setCollections(collectionsData);
      
      const settingsData = await apiService.getSettings();
      setSettings(settingsData);

      // Fetch changes across all collections
      let allChanges = [];
      for (const col of collectionsData) {
        try {
          const colChanges = await apiService.getChanges(col.id);
          // Add collection info
          const enrichedChanges = colChanges.map(change => ({
            ...change,
            collectionName: col.name
          }));
          allChanges = [...allChanges, ...enrichedChanges];
        } catch (e) {
          console.error("Error fetching changes for collection", col.id, e);
        }
      }
      
      // Sort changes by timestamp descending
      allChanges.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
      setRecentChanges(allChanges.slice(0, 5)); // Keep top 5
    } catch (e) {
      console.error("Error loading dashboard data", e);
    } finally {
      setLoading(false);
    }
  };

  const getPagesCount = () => {
    return collections.reduce((acc, col) => acc + (col.pages ? col.pages.length : 0), 0);
  };

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center bg-dark-950">
        <div className="flex flex-col items-center space-y-4">
          <RefreshCw className="h-10 w-10 animate-spin text-brand-500" />
          <p className="text-dark-300 font-medium">Gathering workspace stats...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-dark-950 p-6">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-white">System Dashboard</h1>
          <p className="text-dark-400 text-sm">Real-time status overview of WebRAG collections and engines.</p>
        </div>
        <button 
          onClick={fetchData} 
          className="flex items-center space-x-2 rounded-lg bg-dark-900 border border-dark-700 px-4 py-2 text-sm text-dark-200 transition hover:bg-dark-800 hover:text-white shrink-0 self-start sm:self-auto"
        >
          <RefreshCw className="h-4 w-4" />
          <span>Refresh Stats</span>
        </button>
      </div>

      {/* Stats Widgets */}
      <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex items-center space-x-4 rounded-xl bg-dark-900 border border-dark-800 p-5 shadow-sm">
          <div className="rounded-lg bg-brand-500/10 p-3 text-brand-400">
            <Folder className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-dark-400 uppercase tracking-wider">Collections</p>
            <p className="text-2xl font-bold text-white">{collections.length}</p>
          </div>
        </div>

        <div className="flex items-center space-x-4 rounded-xl bg-dark-900 border border-dark-800 p-5 shadow-sm">
          <div className="rounded-lg bg-emerald-500/10 p-3 text-emerald-400">
            <FileText className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-dark-400 uppercase tracking-wider">Pages Indexed</p>
            <p className="text-2xl font-bold text-white">
              {collections.reduce((acc, col) => acc + (col.urls ? col.urls.length : 0), 0)} URL Seeds
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-4 rounded-xl bg-dark-900 border border-dark-800 p-5 shadow-sm">
          <div className="rounded-lg bg-sky-500/10 p-3 text-sky-400">
            <Activity className="h-6 w-6 animate-pulse-slow" />
          </div>
          <div>
            <p className="text-xs font-semibold text-dark-400 uppercase tracking-wider">Scheduler Status</p>
            <p className="text-lg font-bold text-white flex items-center space-x-1.5">
              <span>Active</span>
              <span className="inline-block h-2.5 w-2.5 rounded-full bg-emerald-500"></span>
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-4 rounded-xl bg-dark-900 border border-dark-800 p-5 shadow-sm">
          <div className="rounded-lg bg-amber-500/10 p-3 text-amber-400">
            <AlertCircle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-xs font-semibold text-dark-400 uppercase tracking-wider">Changes Tracked</p>
            <p className="text-2xl font-bold text-white">{recentChanges.length}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Collections Quickview */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Active Collections</h2>
            <Link to="/collections" className="text-xs font-medium text-brand-400 hover:text-brand-300 flex items-center space-x-1">
              <span>Manage all</span>
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {collections.length === 0 ? (
              <div className="col-span-2 rounded-xl border border-dashed border-dark-800 p-8 text-center text-dark-400 bg-dark-900/50">
                <Folder className="mx-auto mb-3 h-10 w-10 text-dark-600" />
                <p className="font-semibold text-dark-200">No collections exist yet</p>
                <p className="text-sm mt-1">Create your first collection of URLs to begin indexing.</p>
                <Link 
                  to="/collections" 
                  className="mt-4 inline-flex items-center rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-brand-500"
                >
                  Create Collection
                </Link>
              </div>
            ) : (
              collections.map((col) => (
                <div key={col.id} className="group relative rounded-xl bg-dark-900 border border-dark-800 p-5 transition hover:border-dark-700 hover:bg-dark-900/80 shadow-sm flex flex-col justify-between">
                  <div>
                    <div className="flex items-start justify-between">
                      <h3 className="font-bold text-white text-base group-hover:text-brand-300 transition">{col.name}</h3>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        col.status === "Ready" ? "bg-emerald-500/10 text-emerald-400" :
                        col.status === "Indexing" ? "bg-brand-500/10 text-brand-400 animate-pulse" :
                        col.status === "Failed" ? "bg-rose-500/10 text-rose-400" :
                        "bg-dark-700 text-dark-300"
                      }`}>
                        {col.status}
                      </span>
                    </div>
                    <p className="text-xs text-dark-400 mt-2 font-mono">
                      {col.urls ? col.urls.length : 0} Seed URL(s) configured
                    </p>
                    <p className="text-xs text-dark-500 mt-1">
                      Last Indexed: {col.last_indexed ? new Date(col.last_indexed).toLocaleString() : "Never"}
                    </p>
                  </div>

                  <div className="mt-5 flex items-center space-x-3 pt-3 border-t border-dark-800">
                    <Link
                      to={`/chat?collection=${col.id}`}
                      className="flex-1 text-center rounded-md bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-brand-500"
                    >
                      Ask AI
                    </Link>
                    <Link
                      to={`/collections?view=${col.id}`}
                      className="flex-1 text-center rounded-md bg-dark-800 px-3 py-1.5 text-xs font-semibold text-dark-200 border border-dark-700 transition hover:bg-dark-700 hover:text-white"
                    >
                      Configure
                    </Link>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Recent Activity / Changes Feed */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white">Recent Updates Detected</h2>
          <div className="rounded-xl border border-dark-800 bg-dark-900 p-5 shadow-sm space-y-4 max-h-[360px] overflow-y-auto">
            {recentChanges.length === 0 ? (
              <div className="text-center py-10 text-dark-400">
                <CheckCircle2 className="mx-auto mb-3 h-8 w-8 text-emerald-500/30" />
                <p className="font-semibold text-dark-200">No page changes detected</p>
                <p className="text-xs mt-1">Pages will show updates here once they are periodically refreshed.</p>
              </div>
            ) : (
              recentChanges.map((change) => (
                <div key={change.id} className="border-b border-dark-800 last:border-0 pb-3 last:pb-0 space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-brand-400">{change.collectionName}</span>
                    <span className="text-dark-500">{new Date(change.timestamp).toLocaleDateString()}</span>
                  </div>
                  <p className="text-sm font-medium text-white break-all">{change.page_url}</p>
                  <div className="flex items-center space-x-3 text-xs text-dark-400 font-mono pt-1">
                    <span className="text-emerald-400 font-bold">+{change.sections_added}</span>
                    <span className="text-rose-400 font-bold">-{change.sections_removed}</span>
                    <span className="text-sky-400 font-bold">~{change.paragraphs_changed}</span>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
