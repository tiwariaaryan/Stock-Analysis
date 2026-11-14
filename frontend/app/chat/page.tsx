"use client";
import { useState, useRef, useEffect } from "react";
import MarkdownMessage from "@/components/MarkdownMessage";
import { RotateCcw } from "lucide-react";
import { useApi } from "@/components/useApi";

const SUGGESTIONS = [
  { icon: "📊", text: "How is my portfolio performing today?" },
  { icon: "⭐", text: "List down all the stocks of wishlist" },
  { icon: "🔍", text: "Analyze RELIANCE stock for me" },
  { icon: "💡", text: "Can you let me know what are the stocks in my portfolio?" },
  { icon: "📈", text: "Top gaining stocks today?" },
  { icon: "🎯", text: "Suggest stocks to buy on dip" },
];

type Msg = { role: "user" | "assistant"; content: string; time: Date };

export default function ChatPage() {
  const { url, userId, API } = useApi();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
  const [previews, setPreviews] = useState<{ name: string; url: string | null; type: string }[]>([]);
  const endRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs]);

  function handleFilesSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const newFiles = Array.from(e.target.files || []);
    if (!newFiles.length) return;

    const allFiles = [...attachedFiles, ...newFiles];
    setAttachedFiles(allFiles);

    const newPreviews = newFiles.map(f => {
      const isImage = f.type.startsWith("image/");
      return {
        name: f.name,
        url: isImage ? URL.createObjectURL(f) : null,
        type: f.type || "unknown",
      };
    });
    setPreviews(prev => [...prev, ...newPreviews]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeFile(index: number) {
    const newFiles = attachedFiles.filter((_, i) => i !== index);
    const removed = previews[index];
    if (removed?.url) URL.revokeObjectURL(removed.url);
    const newPreviews = previews.filter((_, i) => i !== index);
    setAttachedFiles(newFiles);
    setPreviews(newPreviews);
  }

  function clearFiles() {
    previews.forEach(p => { if (p.url) URL.revokeObjectURL(p.url); });
    setAttachedFiles([]);
    setPreviews([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function send(text?: string) {
    const msg = text || input.trim();
    if ((!msg && !attachedFiles.length) || loading) return;

    const fileNames = attachedFiles.map(f => f.name);
    const displayMsg = attachedFiles.length > 0
      ? `📎 [${attachedFiles.length} file(s): ${fileNames.join(", ")}] ${msg || "Analyze these files"}`
      : msg;
    setMsgs((p) => [...p, { role: "user", content: displayMsg, time: new Date() }]);
    setInput("");
    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("message", msg || "Please analyze these files and extract the stock holdings.");
      formData.append("user_id", String(userId || 1));
      for (const f of attachedFiles) {
        formData.append("files", f);
      }

      const res = await fetch(`${API}/api/v1/chat`, {
        method: "POST",
        body: formData,
      });
      const data = res.ok ? await res.json() : null;
      setMsgs((p) => [
        ...p,
        {
          role: "assistant",
          content: data?.reply || "Could not process. Check your Gemini API key.",
          time: new Date(),
        },
      ]);
    } catch {
      setMsgs((p) => [
        ...p,
        { role: "assistant", content: "Could not reach the backend.", time: new Date() },
      ]);
    }
    clearFiles();
    setLoading(false);
  }

  function handleReset() {
    setMsgs([]);
  }

  return (
    <div className="flex flex-col h-[calc(100vh-48px)] bg-bg-primary">
      {/* Header */}
      <div className="border-b border-border px-6 py-3 flex items-center justify-between bg-bg-card/40 backdrop-blur">
        <div>
          <h2 className="text-base font-bold text-txt-primary flex items-center gap-2">
            AI Research Assistant
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-accent/20 text-accent-light border border-accent/30">
              Live DB Context
            </span>
          </h2>
          <p className="text-[11px] text-txt-dim">
            Powered by Gemini &middot; Uses live portfolio &amp; wishlist data
          </p>
        </div>
        {msgs.length > 0 && (
          <button
            onClick={handleReset}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-txt-secondary hover:text-white hover:bg-bg-hover transition-colors border border-border"
          >
            <RotateCcw size={12} />
            <span>New Chat</span>
          </button>
        )}
      </div>

      {/* Messages Viewport */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-8 py-6">
        {!msgs.length ? (
          <div className="flex flex-col items-center justify-center min-h-[70vh] px-4">
            <div className="w-16 h-16 rounded-2xl bg-accent-muted border border-accent/30 flex items-center justify-center mb-5 shadow-lg shadow-accent/10">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.5">
                <path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z" />
              </svg>
            </div>
            <h3 className="text-2xl font-bold text-txt-primary mb-1.5 tracking-tight">
              InvestIntel AI Research
            </h3>
            <p className="text-sm text-txt-muted mb-8 text-center max-w-md">
              Ask about your portfolio holdings, target buy wishlist alerts, or deep stock analytics.
            </p>

            <div className="w-full max-w-xl grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s.text}
                  onClick={() => send(s.text)}
                  className="flex items-center gap-3 px-4 py-3 bg-[#13131f] border border-[#232338] rounded-xl text-[12.5px] text-slate-300 text-left hover:border-accent/40 hover:text-white hover:bg-[#181827] transition-all group shadow-sm"
                >
                  <span className="text-base group-hover:scale-110 transition-transform">
                    {s.icon}
                  </span>
                  <span className="line-clamp-2 leading-snug">{s.text}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-6">
            {msgs.map((m, i) => (
              <div
                key={i}
                className={`flex gap-3.5 animate-fade-in ${
                  m.role === "user" ? "justify-end" : "justify-start"
                }`}
              >
                {/* Assistant Avatar */}
                {m.role === "assistant" && (
                  <div className="w-8 h-8 rounded-xl bg-accent-muted border border-accent/30 flex items-center justify-center flex-shrink-0 mt-1 shadow-md shadow-accent/15">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2">
                      <path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z" />
                    </svg>
                  </div>
                )}

                {/* Message Bubble */}
                {m.role === "user" ? (
                  <div className="max-w-[75%] px-4 py-3 rounded-2xl rounded-tr-sm text-[13.5px] leading-relaxed bg-accent text-white shadow-lg shadow-accent/20">
                    <p className="whitespace-pre-wrap">{m.content}</p>
                    <p className="text-[10px] mt-1.5 text-white/60 text-right">
                      {m.time.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                ) : (
                  <div className="w-full max-w-[90%] bg-[#13131f] border border-[#232338] rounded-2xl rounded-tl-sm p-4 sm:p-5 shadow-xl shadow-black/40">
                    <MarkdownMessage content={m.content} time={m.time} />
                  </div>
                )}
              </div>
            ))}

            {loading && (
              <div className="flex gap-3.5 animate-fade-in items-start">
                <div className="w-8 h-8 rounded-xl bg-accent-muted border border-accent/30 flex items-center justify-center flex-shrink-0 mt-1">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" className="animate-spin">
                    <circle cx="12" cy="12" r="10" strokeDasharray="32" strokeDashoffset="16" />
                  </svg>
                </div>
                <div className="bg-[#13131f] border border-[#232338] rounded-2xl rounded-tl-sm px-5 py-4 flex items-center gap-2 shadow-lg">
                  <div className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <div className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <div className="w-2 h-2 bg-accent rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  <span className="text-[12px] text-txt-secondary ml-2">
                    Analyzing central database &amp; generating research...
                  </span>
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>
        )}
      </div>

      {/* Input Field */}
      <div className="border-t border-border p-4 bg-bg-card/30 backdrop-blur">
        <div className="max-w-4xl mx-auto">
          {previews.length > 0 && (
            <div className="mb-2 flex flex-wrap gap-2 animate-fade-in">
              {previews.map((p, i) => (
                <div key={i} className="relative group">
                  {p.url ? (
                    <img src={p.url} alt={p.name} className="h-14 w-14 rounded-lg border border-border object-cover" />
                  ) : (
                    <div className="h-14 w-14 rounded-lg border border-border bg-bg-input flex items-center justify-center">
                      <span className="text-[9px] text-txt-dim font-mono text-center leading-tight px-0.5">
                        {p.name.split(".").pop()?.toUpperCase() || "FILE"}
                      </span>
                    </div>
                  )}
                  <button onClick={() => removeFile(i)}
                    className="absolute -top-1 -right-1 w-4 h-4 bg-loss rounded-full flex items-center justify-center text-white text-[8px] opacity-0 group-hover:opacity-100 transition-opacity">
                    ✕
                  </button>
                  <p className="text-[8px] text-txt-dim text-center mt-0.5 max-w-[56px] truncate">{p.name}</p>
                </div>
              ))}
              <button onClick={() => fileInputRef.current?.click()}
                className="h-14 w-14 rounded-lg border border-dashed border-border hover:border-accent/40 flex items-center justify-center text-txt-dim hover:text-accent-light transition-colors">
                <span className="text-lg">+</span>
              </button>
            </div>
          )}
          <div className="relative flex items-center gap-2">
            <input type="file" ref={fileInputRef} accept="image/*,.pdf,.md,.txt,.csv,.json" multiple onChange={handleFilesSelect} className="hidden" />
            <button onClick={() => fileInputRef.current?.click()}
              className="w-9 h-9 rounded-lg bg-[#11111a] border border-[#242438] flex items-center justify-center text-txt-muted hover:text-accent-light hover:border-accent/40 transition-colors flex-shrink-0"
              title="Attach files (images, PDFs, text)">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
              </svg>
            </button>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send();
                }
              }}
              placeholder={attachedFiles.length ? `${attachedFiles.length} file(s) attached — add a message...` : "Ask about your portfolio, wishlist targets, or any stock..."}
              rows={1}
              className="flex-1 bg-[#11111a] border border-[#242438] rounded-xl px-4 py-3 pr-12 text-sm text-txt-primary placeholder-txt-dim resize-none focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent/50 transition-all shadow-inner"
            />
            <button
              onClick={() => send()}
              disabled={(!input.trim() && !attachedFiles.length) || loading}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 bg-accent rounded-lg flex items-center justify-center hover:bg-accent-dark transition-colors disabled:opacity-30 shadow-md shadow-accent/25"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" />
              </svg>
            </button>
          </div>
        </div>
        <p className="text-center text-[10.5px] text-txt-dim mt-2">
          Attach broker screenshots, PDFs, or text files &middot; Multi-file supported &middot; Not financial advice.
        </p>
      </div>
    </div>
  );
}
