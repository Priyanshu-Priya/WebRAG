import React from "react";
import { HashRouter as Router, Routes, Route, NavLink } from "react-router-dom";
import { LayoutDashboard, Folder, MessageSquare, Search, Settings as SettingsIcon, ShieldAlert, Menu, X } from "lucide-react";

// Pages
import Dashboard from "./pages/Dashboard";
import Collections from "./pages/Collections";
import Chat from "./pages/Chat";
import SearchPage from "./pages/Search";
import Settings from "./pages/Settings";

function Sidebar({ isOpen, onClose }) {
  const navItems = [
    { to: "/", label: "Dashboard", icon: LayoutDashboard },
    { to: "/collections", label: "Collections", icon: Folder },
    { to: "/chat", label: "Grounded Chat", icon: MessageSquare },
    { to: "/search", label: "Semantic Search", icon: Search },
    { to: "/settings", label: "Settings", icon: SettingsIcon },
  ];

  return (
    <>
      {/* Backdrop for mobile */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-xs lg:hidden"
          onClick={onClose}
        />
      )}

      <aside className={`fixed lg:static top-0 bottom-0 left-0 z-50 w-64 bg-dark-900 border-r border-dark-800 flex flex-col justify-between shrink-0 h-full transition-transform duration-300 ease-in-out lg:translate-x-0 ${
        isOpen ? "translate-x-0" : "-translate-x-full"
      }`}>
        <div className="flex flex-col flex-1">
          {/* Header App Brand */}
          <div className="h-16 px-6 border-b border-dark-800 flex items-center justify-between bg-dark-950/20">
            <div className="flex items-center space-x-3">
              <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white font-bold shadow-lg shadow-brand-500/20">
                W
              </div>
              <div>
                <h1 className="font-bold text-white text-base leading-none tracking-tight">WebRAG</h1>
                <span className="text-[10px] text-brand-400 font-bold uppercase tracking-wider font-mono">Crawler Engine</span>
              </div>
            </div>
            {/* Close button on mobile */}
            <button 
              onClick={onClose}
              className="lg:hidden p-1.5 rounded-lg bg-dark-800 border border-dark-700 text-dark-400 hover:text-white transition"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Links Navigation */}
          <nav className="flex-1 px-4 py-6 space-y-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  onClick={onClose} // Auto close sidebar when clicked on mobile
                  className={({ isActive }) =>
                    `flex items-center space-x-3.5 px-4 py-3 rounded-xl text-sm font-semibold transition-all duration-200 border ${
                      isActive
                        ? "bg-brand-600 border-brand-500 text-white shadow-lg shadow-brand-500/10"
                        : "bg-transparent border-transparent text-dark-300 hover:bg-dark-800 hover:text-white"
                    }`
                  }
                >
                  <Icon className="h-4.5 w-4.5 shrink-0" />
                  <span>{item.label}</span>
                </NavLink>
              );
            })}
          </nav>
        </div>

        {/* Footer Branding */}
        <div className="p-4 border-t border-dark-800 bg-dark-950/25">
          <div className="flex items-center space-x-2 text-xs font-semibold text-dark-500">
            <ShieldAlert className="h-3.5 w-3.5 text-emerald-400" />
            <span>Grounded RAG Guard active</span>
          </div>
        </div>
      </aside>
    </>
  );
}

export default function App() {
  const [isSidebarOpen, setIsSidebarOpen] = React.useState(false);

  return (
    <Router>
      <div className="flex flex-col lg:flex-row h-screen w-screen overflow-hidden bg-dark-950">
        {/* Top mobile navigation header */}
        <header className="lg:hidden h-16 px-4 bg-dark-900 border-b border-dark-800 flex items-center justify-between shrink-0">
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 rounded-lg bg-dark-850 border border-dark-700 text-dark-200 hover:text-white transition"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center space-x-2">
              <div className="h-8 w-8 rounded-lg bg-gradient-to-tr from-brand-600 to-indigo-500 flex items-center justify-center text-white font-bold text-sm shadow-md">
                W
              </div>
              <span className="font-bold text-white text-sm">WebRAG</span>
            </div>
          </div>
          <div className="flex items-center space-x-1.5 text-[10px] font-bold text-emerald-400 uppercase tracking-wider bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 rounded-full">
            Shield Active
          </div>
        </header>

        <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />
        <main className="flex-1 h-full overflow-hidden relative">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/collections" element={<Collections />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/settings" element={<Settings />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
