import React, { useState, useEffect, useRef, useCallback } from "react";
import "./App.css";

const API = "";
const WS_URL = `${window.location.protocol === "https:" ? "wss" : "ws"}://${window.location.host}/ws`;

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatTime(ts) {
  const d = new Date(ts * 1000);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getIcon(ext) {
  const map = {
    ".pdf": "📄", ".png": "🖼️", ".jpg": "🖼️", ".jpeg": "🖼️",
    ".gif": "🖼️", ".mp4": "🎬", ".mp3": "🎵", ".zip": "📦",
    ".rar": "📦", ".txt": "📝", ".doc": "📝", ".docx": "📝",
    ".py": "🐍", ".js": "⚡", ".ts": "⚡", ".json": "📋",
    ".csv": "📊", ".xlsx": "📊", ".apk": "📱",
  };
  return map[ext] || "📁";
}

export default function App() {
  const [files, setFiles] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [toast, setToast] = useState(null);
  const [progress, setProgress] = useState(0);
  const [textInput, setTextInput] = useState("");
  const [texts, setTexts] = useState([]);
  const wsRef = useRef(null);
  const dropRef = useRef(null);
  const fileInputRef = useRef(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const connectWS = useCallback(() => {
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => setConnected(true);
    ws.onclose = () => {
      setConnected(false);
      setTimeout(connectWS, 2000);
    };
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "files") setFiles(msg.data);
      else if (msg.type === "new_files")
        setFiles((prev) => [...msg.data, ...prev]);
      else if (msg.type === "deleted")
        setFiles((prev) => prev.filter((f) => f.filename !== msg.data.filename));
      else if (msg.type === "cleared") setFiles([]);
      else if (msg.type === "text_message")
        setTexts((prev) => [msg.data, ...prev]);
    };
  }, []);

  const sendText = async () => {
    if (!textInput.trim()) return;
    await fetch(`${API}/send-text`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: textInput })
    });
    setTextInput("");
  };

  useEffect(() => {
    connectWS();
    return () => wsRef.current?.close();
  }, [connectWS]);

  const uploadFiles = async (fileList) => {
    if (!fileList.length) return;
    setUploading(true);
    setProgress(0);
    const form = new FormData();
    Array.from(fileList).forEach((f) => form.append("files", f));

    const xhr = new XMLHttpRequest();
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) setProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      setUploading(false);
      setProgress(0);
      showToast(`${fileList.length} file(s) sent!`);
    };
    xhr.onerror = () => {
      setUploading(false);
      showToast("Upload failed", "error");
    };
    xhr.open("POST", `${API}/upload`);
    xhr.send(form);
  };

  const onDrop = (e) => {
    e.preventDefault();
    setDragging(false);
    uploadFiles(e.dataTransfer.files);
  };

  const onDragOver = (e) => { e.preventDefault(); setDragging(true); };
  const onDragLeave = () => setDragging(false);

  const deleteFile = async (filename) => {
    await fetch(`${API}/files/${encodeURIComponent(filename)}`, { method: "DELETE" });
    showToast("File removed");
  };

  const clearAll = async () => {
    if (!window.confirm("Clear all files?")) return;
    await fetch(`${API}/files`, { method: "DELETE" });
    showToast("All files cleared");
  };

  return (
    <div className="app">
      <div className="scanlines" />
      <header className="header">
        <div className="logo">
          <span className="logo-icon">⬡</span>
          <span className="logo-text">DROP<span className="accent">LINK</span></span>
        </div>
        <div className={`status ${connected ? "online" : "offline"}`}>
          <span className="dot" />
          {connected ? "CONNECTED" : "RECONNECTING..."}
        </div>
      </header>

      <main className="main">
        {/* Drop Zone */}
        <div
          ref={dropRef}
          className={`dropzone ${dragging ? "dragging" : ""} ${uploading ? "uploading" : ""}`}
          onDrop={onDrop}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onClick={() => !uploading && fileInputRef.current.click()}
        >
          <input
            ref={fileInputRef}
            type="file"
            multiple
            style={{ display: "none" }}
            onChange={(e) => uploadFiles(e.target.files)}
          />
          {uploading ? (
            <div className="upload-progress">
              <div className="progress-ring">
                <svg viewBox="0 0 80 80">
                  <circle cx="40" cy="40" r="34" className="ring-bg" />
                  <circle
                    cx="40" cy="40" r="34"
                    className="ring-fill"
                    strokeDasharray={`${2 * Math.PI * 34}`}
                    strokeDashoffset={`${2 * Math.PI * 34 * (1 - progress / 100)}`}
                  />
                </svg>
                <span className="ring-label">{progress}%</span>
              </div>
              <p>Transmitting...</p>
            </div>
          ) : (
            <div className="drop-content">
              <div className="drop-icon">⬆</div>
              <p className="drop-title">Drop files here</p>
              <p className="drop-sub">or tap to browse · PC ⟷ Mobile</p>
            </div>
          )}
        </div>

        {/* Text Share */}
        <div className="file-section">
          <div className="section-header">
            <span className="section-title">SEND TEXT</span>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <textarea
              className="text-input"
              placeholder="Type or paste text, links, notes..."
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              rows={3}
            />
            <button className="send-btn" onClick={sendText}>SEND</button>
          </div>

          {texts.length > 0 && (
            <div className="file-list" style={{ marginTop: "12px" }}>
              {texts.map((t) => (
                <div className="file-card" key={t.id}>
                  <span className="file-icon">💬</span>
                  <div className="file-info">
                    <span className="file-name" style={{ whiteSpace: "normal", wordBreak: "break-all" }}>
                      {t.text}
                    </span>
                    <span className="file-meta">{formatTime(t.sent_at)}</span>
                  </div>
                  <button
                    className="btn-dl"
                    style={{ fontSize: "0.75rem", width: "auto", padding: "0 10px" }}
                    onClick={() => { navigator.clipboard.writeText(t.text); showToast("Copied!"); }}
                  >COPY</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* File List */}
        <div className="file-section">
          <div className="section-header">
            <span className="section-title">FILES <span className="count">{files.length}</span></span>
            {files.length > 0 && (
              <button className="clear-btn" onClick={clearAll}>CLEAR ALL</button>
            )}
          </div>

          {files.length === 0 ? (
            <div className="empty">
              <span className="empty-icon">◈</span>
              <p>No files yet. Drop something.</p>
            </div>
          ) : (
            <div className="file-list">
              {files.map((f) => (
                <div className="file-card" key={f.filename}>
                  <span className="file-icon">{getIcon(f.extension)}</span>
                  <div className="file-info">
                    <span className="file-name">{f.name}</span>
                    <span className="file-meta">{formatSize(f.size)} · {formatTime(f.uploaded_at)}</span>
                  </div>
                  <div className="file-actions">
                    <a
                      className="btn-dl"
                      href={f.url || `${API}/download/${encodeURIComponent(f.filename)}`}
                      download
                    >↓</a>
                    <button className="btn-del" onClick={() => deleteFile(f.filename)}>✕</button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {toast && (
        <div className={`toast ${toast.type}`}>{toast.msg}</div>
      )}
    </div>
  );
}