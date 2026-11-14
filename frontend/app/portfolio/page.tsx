"use client";
import { useState, useEffect } from "react";
import Link from "next/link";
import { useApi } from "@/components/useApi";

type P = { id: number; name: string; description: string | null; created_at: string; holdings_count: number; total_invested: string };

export default function PortfolioListPage() {
  const { url, rawUrl } = useApi();
  const [list, setList] = useState<P[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [desc, setDesc] = useState("");
  const [saving, setSaving] = useState(false);

  const load = () => fetch(url("/api/v1/portfolios")).then(r => r.json()).then(setList).catch(() => {}).finally(() => setLoading(false));
  useEffect(() => { load(); }, []);

  async function create() {
    if (!name.trim()) return;
    setSaving(true);
    await fetch(url("/api/v1/portfolios"), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), description: desc.trim() || null }) });
    setName(""); setDesc(""); setShowForm(false); setSaving(false); load();
  }

  async function del(id: number) {
    await fetch(rawUrl(`/api/v1/portfolios/${id}`), { method: "DELETE" });
    load();
  }

  if (loading) return <div className="p-6 space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 bg-bg-card rounded-lg animate-pulse" />)}</div>;

  if (!list.length && !showForm) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-48px)] p-8">
        <div className="text-center max-w-sm">
          <div className="w-14 h-14 rounded-2xl bg-blue-500/15 flex items-center justify-center mx-auto mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.5">
              <path d="M21 12V7H5a2 2 0 0 1 0-4h14v4 M3 5v14a2 2 0 0 0 2 2h16v-5 M18 12a2 2 0 0 0 0 4h4v-4Z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-txt-primary mb-2">No Portfolios Yet</h2>
          <p className="text-sm text-txt-secondary mb-6">Create your first portfolio to start tracking investments.</p>
          <button onClick={() => setShowForm(true)} className="px-5 py-2.5 bg-accent hover:bg-accent-dark text-white text-sm font-medium rounded-lg transition-colors">
            + Create Portfolio
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-bold text-txt-primary">My Portfolios</h2>
          <p className="text-xs text-txt-muted mt-1">{list.length} portfolio{list.length !== 1 && "s"}</p>
        </div>
        <button onClick={() => setShowForm(true)} className="px-4 py-2 bg-accent hover:bg-accent-dark text-white text-sm font-medium rounded-lg transition-colors">
          + New Portfolio
        </button>
      </div>

      {showForm && (
        <div className="bg-bg-card border border-accent/30 rounded-xl p-5 mb-6 animate-fade-in">
          <p className="text-sm font-medium text-txt-primary mb-3">Create New Portfolio</p>
          <div className="space-y-2.5">
            <input value={name} onChange={e => setName(e.target.value)} placeholder="Portfolio name (e.g. Long Term, SIP)"
              className="w-full bg-bg-input border border-border rounded-lg px-3 py-2 text-sm text-txt-primary placeholder-txt-dim focus:outline-none focus:border-accent/50" />
            <input value={desc} onChange={e => setDesc(e.target.value)} placeholder="Description (optional)"
              className="w-full bg-bg-input border border-border rounded-lg px-3 py-2 text-sm text-txt-primary placeholder-txt-dim focus:outline-none focus:border-accent/50" />
            <div className="flex gap-2 pt-1">
              <button onClick={create} disabled={saving || !name.trim()} className="px-4 py-2 bg-accent text-white text-sm rounded-lg hover:bg-accent-dark disabled:opacity-50 transition-colors">
                {saving ? "Creating..." : "Create"}
              </button>
              <button onClick={() => setShowForm(false)} className="px-4 py-2 text-txt-muted text-sm rounded-lg hover:text-txt-primary transition-colors">Cancel</button>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {list.map(p => (
          <div key={p.id} className="bg-bg-card border border-border rounded-xl hover:border-border-hover transition-colors group">
            <div className="flex items-center justify-between p-5">
              <Link href={`/portfolio/${p.id}`} className="flex-1">
                <h3 className="text-base font-semibold text-txt-primary group-hover:text-accent-light transition-colors">{p.name}</h3>
                {p.description && <p className="text-xs text-txt-muted mt-0.5">{p.description}</p>}
                <div className="flex gap-6 mt-2.5">
                  <span className="text-xs text-txt-muted"><strong className="text-txt-primary font-mono">{p.holdings_count}</strong> holdings</span>
                  <span className="text-xs text-txt-muted">Invested <strong className="text-txt-primary font-mono">₹{Number(p.total_invested).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong></span>
                </div>
              </Link>
              <button onClick={() => del(p.id)} className="text-txt-dim hover:text-loss transition-colors p-2" title="Delete">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
