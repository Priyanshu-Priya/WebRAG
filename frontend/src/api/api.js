import axios from "axios";

// In production, set VITE_API_URL in Render env vars (e.g., https://webrag-zkg6.onrender.com/api)
const API_BASE_URL = import.meta.env.VITE_API_URL || (
  window.location.origin.includes("localhost") 
    ? "http://localhost:8000/api" 
    : "/api"
);

export const getWsUrl = (collectionId) => {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  if (import.meta.env.VITE_API_URL) {
    // Extract host from VITE_API_URL (e.g., "https://webrag-zkg6.onrender.com/api" -> "webrag-zkg6.onrender.com")
    const backendHost = new URL(import.meta.env.VITE_API_URL).host;
    return `${protocol}//${backendHost}/api/ws/${collectionId}`;
  }
  if (window.location.origin.includes("localhost")) {
    return `${protocol}//localhost:8000/api/ws/${collectionId}`;
  }
  return `${protocol}//${window.location.host}/api/ws/${collectionId}`;
};

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

export const apiService = {
  // Collections
  getCollections: () => api.get("/collections").then(res => res.data),
  createCollection: (data) => api.post("/collections", data).then(res => res.data),
  deleteCollection: (id) => api.delete(`/collections/${id}`).then(res => res.data),
  
  // Indexing
  indexCollection: (id) => api.post(`/index/${id}`).then(res => res.data),
  
  // Chat & Search
  chat: (collectionId, question) => api.post("/chat", { collection_id: collectionId, question }).then(res => res.data),
  search: (collectionId, query, k = 5) => api.post("/search", { collection_id: collectionId, query, k }).then(res => res.data),
  
  // Stats & History
  getHistory: (collectionId) => api.get(`/history/${collectionId}`).then(res => res.data),
  getChanges: (collectionId) => api.get(`/changes/${collectionId}`).then(res => res.data),
  
  // Settings
  getSettings: () => api.get("/settings").then(res => res.data),
  updateSettings: (data) => api.put("/settings", data).then(res => res.data),
};

export default apiService;
