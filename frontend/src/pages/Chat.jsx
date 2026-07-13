import React, { useState, useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { MessageSquare, Send, BookOpen, ExternalLink, Bot, User, Trash2, Loader, Eye, X } from "lucide-react";
import apiService from "../api/api";

export default function Chat() {
  const [searchParams, setSearchParams] = useSearchParams();
  const activeColId = searchParams.get("collection");

  const [collections, setCollections] = useState([]);
  const [selectedCol, setSelectedCol] = useState(null);
  
  // Chat messaging state
  const [messages, setMessages] = useState([]);
  const [inputValue, setInputValue] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Inspector citation detail modal
  const [activeCitation, setActiveCitation] = useState(null);

  // Flashing source card highlight
  const [flashingSourceId, setFlashingSourceId] = useState(null);

  const messagesEndRef = useRef(null);

  useEffect(() => {
    fetchCollections();
  }, []);

  useEffect(() => {
    if (activeColId && collections.length > 0) {
      const selected = collections.find(c => c.id === parseInt(activeColId));
      if (selected) {
        handleSelectCollection(selected);
      }
    } else if (collections.length > 0 && !selectedCol) {
      handleSelectCollection(collections[0]);
    }
  }, [activeColId, collections]);

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, isLoading]);

  const fetchCollections = async () => {
    try {
      const data = await apiService.getCollections();
      // Only show collections that are ready or indexing
      setCollections(data);
    } catch (e) {
      console.error("Error loading collections", e);
    }
  };

  const handleSelectCollection = async (col) => {
    setSelectedCol(col);
    setSearchParams({ collection: col.id });
    setMessages([]);
    setIsLoading(true);

    try {
      // Load previous chat history
      const history = await apiService.getHistory(col.id);
      
      // Map database schema response to UI message objects
      const mappedMessages = [];
      history.forEach((h) => {
        // User message
        mappedMessages.push({
          id: `q-${h.id}`,
          role: "user",
          text: h.question,
          timestamp: h.timestamp
        });
        
        // AI message with sources
        let sources = [];
        try {
          if (h.sources_json) {
            sources = JSON.parse(h.sources_json);
          }
        } catch (e) {
          console.error("Failed to parse history sources json", e);
        }

        mappedMessages.push({
          id: `a-${h.id}`,
          role: "assistant",
          text: h.answer,
          sources: sources,
          timestamp: h.timestamp
        });
      });

      setMessages(mappedMessages);
    } catch (e) {
      console.error("Error loading chat history", e);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputValue.trim() || !selectedCol || isLoading) return;

    const userText = inputValue.trim();
    setInputValue("");
    
    // Add user message to UI
    const userMsgId = `user-${Date.now()}`;
    setMessages(prev => [...prev, {
      id: userMsgId,
      role: "user",
      text: userText,
      timestamp: new Date().toISOString()
    }]);

    setIsLoading(true);

    try {
      const response = await apiService.chat(selectedCol.id, userText);
      
      // Add assistant response to UI
      setMessages(prev => [...prev, {
        id: `ai-${Date.now()}`,
        role: "assistant",
        text: response.answer,
        sources: response.sources || [],
        timestamp: new Date().toISOString()
      }]);
    } catch (err) {
      console.error("Chat error", err);
      setMessages(prev => [...prev, {
        id: `err-${Date.now()}`,
        role: "assistant",
        text: `Error connecting to AI service: ${err.response?.data?.detail || err.message}. Please check your Groq API settings.`,
        sources: [],
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCitationClick = (idx, sources, msgId) => {
    if (!sources || idx <= 0 || idx > sources.length) return;
    const source = sources[idx - 1];
    
    const cardId = `src-${msgId}-${idx - 1}`;
    setFlashingSourceId(cardId);
    setTimeout(() => {
      setFlashingSourceId(null);
    }, 1500);

    const element = document.getElementById(cardId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }

    setActiveCitation(source);
  };

  const formatCitations = (text) => {
    if (!text) return "";
    return text.replace(/\[(\d+)\]/g, "[$1](#citation-$1)");
  };

  return (
    <div className="h-full flex bg-dark-950 overflow-hidden">
      {/* Left panel: Collection selector */}
      <div className="w-64 border-r border-dark-800 bg-dark-900/60 flex flex-col">
        <div className="p-4 border-b border-dark-800">
          <h2 className="text-sm font-bold text-dark-300 uppercase tracking-wider flex items-center space-x-2">
            <MessageSquare className="h-4 w-4 text-brand-400" />
            <span>Chat Session</span>
          </h2>
          <p className="text-xs text-dark-500 mt-1">Select a context collection to query against.</p>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-1.5">
          {collections.map((col) => (
            <button
              key={col.id}
              onClick={() => handleSelectCollection(col)}
              className={`w-full text-left px-3 py-2.5 rounded-lg text-sm font-semibold transition border ${
                selectedCol?.id === col.id
                  ? "bg-brand-600/10 border-brand-500/50 text-white"
                  : "bg-dark-900 border-dark-800 text-dark-300 hover:border-dark-700 hover:text-white"
              }`}
            >
              <div className="truncate">{col.name}</div>
              <div className="text-[10px] text-dark-500 font-mono mt-0.5">
                {col.status === "Ready" ? "● Ready" : `○ ${col.status}`}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main chat window */}
      <div className="flex-1 flex flex-col bg-dark-950">
        {selectedCol ? (
          <>
            {/* Header info */}
            <div className="px-6 py-4 bg-dark-900 border-b border-dark-800 flex items-center justify-between">
              <div>
                <h3 className="font-bold text-white text-sm">Grounded QA Chatbot</h3>
                <p className="text-xs text-dark-400">Context namespace: <span className="text-brand-400 font-mono">{selectedCol.name}</span></p>
              </div>
              <div className="rounded-full bg-brand-500/10 border border-brand-500/30 px-3 py-1 text-[11px] font-bold text-brand-400 uppercase tracking-wider">
                RAG Shield Active
              </div>
            </div>

            {/* Message Thread */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
              {messages.length === 0 && !isLoading ? (
                <div className="h-full flex flex-col items-center justify-center text-center text-dark-400">
                  <Bot className="h-16 w-16 text-brand-500/20 mb-4 animate-bounce" />
                  <h3 className="text-lg font-bold text-dark-200">Ask the Python / Web Pages</h3>
                  <p className="text-xs mt-1 max-w-sm">Type a question below. The assistant will answer using only retrieved information from the collection page dumps.</p>
                </div>
              ) : (
                messages.map((msg) => (
                  <div key={msg.id} className={`flex space-x-4 ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                    
                    {msg.role !== "user" && (
                      <div className="h-8 w-8 rounded-lg bg-brand-600/20 text-brand-400 border border-brand-500/30 flex items-center justify-center shrink-0">
                        <Bot className="h-4.5 w-4.5" />
                      </div>
                    )}

                    <div className={`max-w-[80%] rounded-xl px-5 py-4 border ${
                      msg.role === "user"
                        ? "bg-brand-600 border-brand-500/40 text-white"
                        : "bg-dark-900 border-dark-800 text-dark-200"
                    }`}>
                      {/* Source Citations at the TOP */}
                      {msg.role === "assistant" && msg.sources && msg.sources.length > 0 && (
                        <div className="mb-4 pb-3 border-b border-dark-800 space-y-2">
                          <span className="text-[10px] font-bold text-dark-400 uppercase tracking-wider flex items-center space-x-1.5">
                            <BookOpen className="h-3.5 w-3.5 text-brand-400" />
                            <span>Sources used ({msg.sources.length})</span>
                          </span>

                          <div className="flex flex-wrap gap-2 mt-1.5">
                            {msg.sources.map((src, idx) => {
                              let domain = "Link";
                              try {
                                domain = new URL(src.url).hostname.replace("www.", "");
                              } catch (e) {}

                              const cardId = `src-${msg.id}-${idx}`;
                              const isFlashing = flashingSourceId === cardId;

                              return (
                                <div
                                  id={cardId}
                                  key={idx}
                                  className={`group/card flex items-center space-x-2 rounded-lg bg-dark-950/60 p-2 text-xs border select-none cursor-pointer transition-all duration-300 max-w-[200px] shrink-0 ${
                                    isFlashing 
                                      ? "border-brand-400 ring-2 ring-brand-500/20 bg-brand-500/5 scale-105" 
                                      : "border-dark-800 hover:border-dark-600 hover:bg-dark-950"
                                  }`}
                                  onClick={() => setActiveCitation(src)}
                                >
                                  {/* Citation Index Badge */}
                                  <div className="h-5 w-5 rounded-full bg-dark-800 border border-dark-700 text-dark-300 font-bold text-[9px] flex items-center justify-center shrink-0 group-hover/card:bg-brand-500/10 group-hover/card:text-brand-400 group-hover/card:border-brand-500/30 transition">
                                    {idx + 1}
                                  </div>
                                  
                                  {/* Domain Favicon */}
                                  <img
                                    src={`https://www.google.com/s2/favicons?sz=32&domain=${domain}`}
                                    alt=""
                                    onError={(e) => {
                                      e.target.style.display = "none";
                                    }}
                                    className="h-3.5 w-3.5 object-contain shrink-0"
                                  />

                                  <div className="min-w-0 flex-1">
                                    <div className="font-semibold text-white truncate group-hover/card:text-brand-400 transition">{src.title || domain}</div>
                                    <div className="text-[10px] text-dark-500 font-mono truncate">{domain}</div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Text/Markdown */}
                      <div className="text-sm leading-relaxed prose prose-invert max-w-none">
                        {msg.role === "user" ? (
                          <p className="whitespace-pre-wrap">{msg.text}</p>
                        ) : (
                          <ReactMarkdown
                            components={{
                              a: ({ href, children, ...props }) => {
                                const citationMatch = href?.match(/#citation-(\d+)/);
                                if (citationMatch) {
                                  const citationIdx = parseInt(citationMatch[1]);
                                  return (
                                    <sup className="mx-0.5 select-none">
                                      <button
                                        type="button"
                                        onClick={() => handleCitationClick(citationIdx, msg.sources, msg.id)}
                                        className="inline-flex items-center justify-center bg-brand-500/10 text-brand-400 hover:bg-brand-500 hover:text-white border border-brand-500/30 rounded-full h-3.5 w-3.5 text-[8px] font-bold transition-all duration-200 active:scale-90 cursor-pointer shadow-sm hover:shadow-brand-500/20"
                                        title={msg.sources?.[citationIdx - 1]?.title || "Source"}
                                      >
                                        {children}
                                      </button>
                                    </sup>
                                  );
                                }
                                return (
                                  <a href={href} target="_blank" rel="noopener noreferrer" className="text-brand-400 hover:underline inline-flex items-center space-x-0.5" {...props}>
                                    {children}
                                    <ExternalLink className="h-3 w-3 inline shrink-0" />
                                  </a>
                                );
                              }
                            }}
                          >
                            {formatCitations(msg.text)}
                          </ReactMarkdown>
                        )}
                      </div>
                    </div>

                    {msg.role === "user" && (
                      <div className="h-8 w-8 rounded-lg bg-dark-800 border border-dark-700 text-dark-300 flex items-center justify-center shrink-0">
                        <User className="h-4.5 w-4.5" />
                      </div>
                    )}
                  </div>
                ))
              )}

              {isLoading && (
                <div className="flex space-x-4 justify-start">
                  <div className="h-8 w-8 rounded-lg bg-brand-600/20 text-brand-400 border border-brand-500/30 flex items-center justify-center shrink-0">
                    <Bot className="h-4.5 w-4.5" />
                  </div>
                  <div className="rounded-xl px-5 py-4 border bg-dark-900 border-dark-800 text-dark-400 text-sm flex items-center space-x-2">
                    <Loader className="h-4 w-4 animate-spin text-brand-400" />
                    <span>Scrutinizing documents and synthesizing answer...</span>
                  </div>
                </div>
              )}
              
              <div ref={messagesEndRef} />
            </div>

            {/* Input Form */}
            <form onSubmit={handleSendMessage} className="p-4 bg-dark-900 border-t border-dark-800 flex items-center space-x-2">
              <input
                disabled={isLoading}
                type="text"
                placeholder={isLoading ? "Please wait..." : `Ask a question about page contents in ${selectedCol.name}...`}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                className="flex-1 rounded-lg bg-dark-950 border border-dark-800 px-4 py-3 text-sm text-white placeholder-dark-600 focus:outline-none focus:border-brand-500 transition"
              />
              <button
                type="submit"
                disabled={isLoading || !inputValue.trim()}
                className={`p-3 rounded-lg flex items-center justify-center transition shrink-0 ${
                  isLoading || !inputValue.trim()
                    ? "bg-dark-800 border border-dark-700 text-dark-600 cursor-not-allowed"
                    : "bg-brand-600 hover:bg-brand-500 text-white"
                }`}
              >
                <Send className="h-4 w-4" />
              </button>
            </form>
          </>
        ) : (
          <div className="h-full flex flex-col items-center justify-center text-center text-dark-400">
            <MessageSquare className="h-16 w-16 text-dark-800 mb-4" />
            <h2 className="text-xl font-bold text-dark-200">No Collection Loaded</h2>
            <p className="text-sm mt-1 max-w-sm">Create and index a collection in the Collections tab to chat with it.</p>
          </div>
        )}
      </div>

      {/* Citation Inspector Modal */}
      {activeCitation && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm">
          <div className="w-full max-w-2xl rounded-xl bg-dark-900 border border-dark-800 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-dark-800">
              <div>
                <h2 className="text-base font-bold text-white max-w-md truncate">{activeCitation.title}</h2>
                <a
                  href={activeCitation.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-brand-400 hover:underline flex items-center space-x-1 mt-0.5 break-all"
                >
                  <span>{activeCitation.url}</span>
                  <ExternalLink className="h-3 w-3 inline shrink-0" />
                </a>
              </div>
              <button
                onClick={() => setActiveCitation(null)}
                className="text-dark-500 hover:text-white p-1 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2">
              <span className="text-[10px] font-bold text-dark-400 uppercase tracking-wider flex items-center space-x-1.5">
                <span>Vector Metadata</span>
                <span className="bg-brand-500/10 border border-brand-500/30 px-1.5 py-0.5 rounded text-[9px] font-bold text-brand-300 font-mono">
                  Similarity Score: {Math.round(activeCitation.score * 10000) / 100}%
                </span>
              </span>
              <div className="p-4 rounded-lg bg-dark-950 border border-dark-800 font-mono text-xs text-dark-200 leading-relaxed max-h-[300px] overflow-y-auto select-text select-all whitespace-pre-wrap">
                {activeCitation.snippet}
              </div>
            </div>

            <div className="pt-3 border-t border-dark-800 flex justify-end">
              <button
                onClick={() => setActiveCitation(null)}
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
